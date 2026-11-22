const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// GET /api/materials - List study materials
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { subject_id, search } = req.query;
        let sql = `
            SELECT m.id, m.title, m.description, m.subject_id, m.department_id, m.semester, m.section,
                   m.file_name, m.file_type, m.file_size, m.created_at,
                   s.name as subject_name, s.code as subject_code,
                   d.name as department_name, d.code as department_code,
                   u.full_name as faculty_name
            FROM study_materials m
            JOIN subjects s ON m.subject_id = s.id
            JOIN departments d ON m.department_id = d.id
            JOIN faculty f ON m.faculty_id = f.id
            JOIN users u ON f.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        // Role-based visibility scoping
        if (req.user.role === 'student') {
            const stu = await db.get('SELECT department_id, semester, section FROM students WHERE user_id = ?', [req.user.id]);
            if (!stu) {
                return res.status(403).json({ error: 'Student record not found.' });
            }
            // Show materials matching dept+semester AND (section matches student's section OR section is NULL = all sections)
            sql += ` AND m.department_id = ? AND m.semester = ? AND (m.section IS NULL OR m.section = ?)`;
            params.push(stu.department_id, stu.semester, stu.section);
        } else if (req.user.role === 'faculty') {
            // Optional: filter by faculty's own uploads
            if (req.query.my_materials === 'true') {
                const fac = await db.get('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
                if (fac) {
                    sql += ` AND m.faculty_id = ?`;
                    params.push(fac.id);
                }
            }
        }

        if (subject_id) {
            sql += ` AND m.subject_id = ?`;
            params.push(subject_id);
        }

        if (search) {
            sql += ` AND (LOWER(m.title) LIKE LOWER(?) OR LOWER(s.name) LIKE LOWER(?) OR LOWER(s.code) LIKE LOWER(?))`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY m.created_at DESC`;

        const materials = await db.all(sql, params);
        return res.json({ materials });
    } catch (err) {
        console.error('Error fetching study materials:', err);
        return res.status(500).json({ error: 'Failed to fetch study materials.' });
    }
});

// GET /api/materials/:id - Download/view single material (with file_data)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const material = await db.get(
            `SELECT m.*, s.name as subject_name, s.code as subject_code, d.name as department_name, u.full_name as faculty_name
             FROM study_materials m
             JOIN subjects s ON m.subject_id = s.id
             JOIN departments d ON m.department_id = d.id
             JOIN faculty f ON m.faculty_id = f.id
             JOIN users u ON f.user_id = u.id
             WHERE m.id = ?`,
            [req.params.id]
        );

        if (!material) {
            return res.status(404).json({ error: 'Study material not found.' });
        }

        // Student department & semester check
        if (req.user.role === 'student') {
            const stu = await db.get('SELECT department_id, semester FROM students WHERE user_id = ?', [req.user.id]);
            if (!stu || stu.department_id !== material.department_id || stu.semester !== material.semester) {
                return res.status(403).json({ error: 'You are not enrolled in the department/semester for this material.' });
            }
        }

        return res.json({ material });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch material.' });
    }
});

// POST /api/materials - Upload Study Material (Faculty & Admin)
router.post('/', authenticateToken, requireRole(['faculty', 'admin']), async (req, res) => {
    try {
        const { title, description, subject_id, section, file_name, file_type, file_size, file_data } = req.body;

        if (!title || !subject_id || !file_name || !file_data) {
            return res.status(400).json({ error: 'Title, subject, file name, and file data are required.' });
        }

        // Validate subject exists
        const subject = await db.get('SELECT * FROM subjects WHERE id = ?', [subject_id]);
        if (!subject) {
            return res.status(404).json({ error: 'Selected subject not found.' });
        }

        let facultyId = null;
        if (req.user.role === 'faculty') {
            const fac = await db.get('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
            if (!fac) return res.status(403).json({ error: 'Faculty profile not found.' });
            facultyId = fac.id;
        } else {
            // Admin uploading on behalf of subject's faculty
            facultyId = subject.faculty_id || 1;
        }

        // Determine file type
        const ext = file_name.split('.').pop().toUpperCase();
        const detectedType = file_type || ext || 'FILE';

        // section: null means visible to all sections
        const targetSection = section && section !== '' && section !== 'All' ? section : null;

        const insertRes = await db.run(
            `INSERT INTO study_materials 
             (title, description, subject_id, department_id, semester, section, faculty_id, file_name, file_type, file_size, file_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title.trim(),
                description ? description.trim() : null,
                subject.id,
                subject.department_id,
                subject.semester,
                targetSection,
                facultyId,
                file_name.trim(),
                detectedType,
                file_size || 0,
                file_data
            ]
        );

        await logAudit(req, 'STUDY_MATERIAL_UPLOADED', `Uploaded material: "${title.trim()}" (${file_name}) for subject ${subject.name}${targetSection ? ' Section ' + targetSection : ''}.`, insertRes.id);

        return res.status(201).json({
            message: 'Study material uploaded successfully.',
            materialId: insertRes.id
        });
    } catch (err) {
        console.error('Error uploading material:', err);
        return res.status(500).json({ error: 'Failed to upload study material.' });
    }
});

// DELETE /api/materials/:id - Delete study material
router.delete('/:id', authenticateToken, requireRole(['faculty', 'admin']), async (req, res) => {
    try {
        const mat = await db.get('SELECT * FROM study_materials WHERE id = ?', [req.params.id]);
        if (!mat) {
            return res.status(404).json({ error: 'Study material not found.' });
        }

        if (req.user.role === 'faculty') {
            const fac = await db.get('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
            if (!fac || fac.id !== mat.faculty_id) {
                return res.status(403).json({ error: 'You are only authorized to delete materials you uploaded.' });
            }
        }

        await db.run('DELETE FROM study_materials WHERE id = ?', [req.params.id]);
        await logAudit(req, 'STUDY_MATERIAL_DELETED', `Deleted study material: "${mat.title}" (${mat.file_name}).`, mat.id);

        return res.json({ message: 'Study material deleted successfully.' });
    } catch (err) {
        console.error('Error deleting study material:', err);
        return res.status(500).json({ error: 'Failed to delete study material.' });
    }
});

module.exports = router;
