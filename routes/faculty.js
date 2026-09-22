const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All faculty routes require authentication and 'faculty' role
router.use(authenticateToken);
router.use(requireRole('faculty'));

// Helper to get faculty_id for logged in user
async function getFacultyId(req) {
    if (req.user.faculty_id) return req.user.faculty_id;
    const fac = await db.get('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    return fac ? fac.id : null;
}

// GET /api/faculty/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        if (!facultyId) return res.status(404).json({ error: 'Faculty profile not found.' });

        const faculty = await db.get(
            `SELECT f.id, f.faculty_id as fid_code, f.designation, u.full_name, u.email, d.name as department_name
             FROM faculty f
             JOIN users u ON f.user_id = u.id
             JOIN departments d ON f.department_id = d.id
             WHERE f.id = ?`,
            [facultyId]
        );

        // Subjects handled
        const subjects = await db.all(
            `SELECT id, code, name, semester FROM subjects WHERE faculty_id = ?`,
            [facultyId]
        );

        // Total students handled in faculty's department / semester
        const totalStudentsRes = await db.get(
            `SELECT COUNT(DISTINCT s.id) as total_students
             FROM students s
             JOIN subjects sub ON s.department_id = sub.department_id AND s.semester = sub.semester
             WHERE sub.faculty_id = ?`,
            [facultyId]
        );

        // Recent attendance sessions marked by this faculty
        const recentSessions = await db.all(
            `SELECT 
                a.date, a.class_period, sub.id as subject_id, sub.code as subject_code, sub.name as subject_name,
                COUNT(a.id) as total_students,
                SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
                SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent_count
             FROM attendance a
             JOIN subjects sub ON a.subject_id = sub.id
             WHERE a.faculty_id = ?
             GROUP BY a.date, a.class_period, sub.id
             ORDER BY a.date DESC, a.timestamp DESC LIMIT 5`,
            [facultyId]
        );

        return res.json({
            faculty,
            subjects,
            total_students: totalStudentsRes ? totalStudentsRes.total_students : 0,
            recent_sessions: recentSessions
        });
    } catch (err) {
        console.error('Error loading faculty dashboard:', err);
        return res.status(500).json({ error: 'Failed to load faculty dashboard.' });
    }
});

// GET /api/faculty/subjects
router.get('/subjects', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const subjects = await db.all(
            `SELECT s.id, s.code, s.name, s.semester, d.id as department_id, d.name as department_name, d.code as department_code
             FROM subjects s
             JOIN departments d ON s.department_id = d.id
             WHERE s.faculty_id = ?`,
            [facultyId]
        );
        return res.json({ subjects });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch assigned subjects.' });
    }
});

// GET /api/faculty/students (Fetch student roster for marking attendance)
router.get('/students', async (req, res) => {
    try {
        const { subject_id, semester, section, date, class_period } = req.query;

        if (!subject_id) {
            return res.status(400).json({ error: 'Subject selection is required.' });
        }

        const subject = await db.get('SELECT * FROM subjects WHERE id = ?', [subject_id]);
        if (!subject) return res.status(404).json({ error: 'Subject not found.' });

        const sem = semester || subject.semester;
        const sec = section || 'A';

        // Fetch students in this department, semester, and section
        const students = await db.all(
            `SELECT s.id as student_id, s.usn, s.semester, s.section, u.full_name, u.email
             FROM students s
             JOIN users u ON s.user_id = u.id
             WHERE s.department_id = ? AND s.semester = ? AND s.section = ?
             ORDER BY s.usn ASC`,
            [subject.department_id, sem, sec]
        );

        // Check if attendance already submitted for this specific date, subject, and class_period
        let alreadySubmitted = false;
        let existingMap = {};

        if (date && class_period) {
            const existingRecords = await db.all(
                `SELECT student_id, status FROM attendance
                 WHERE subject_id = ? AND date = ? AND class_period = ?`,
                [subject_id, date, class_period]
            );

            if (existingRecords && existingRecords.length > 0) {
                alreadySubmitted = true;
                existingRecords.forEach(r => {
                    existingMap[r.student_id] = r.status;
                });
            }
        }

        const studentRoster = students.map(st => ({
            ...st,
            status: existingMap[st.student_id] || 'Present' // Default to Present for UI convenience
        }));

        return res.json({
            subject,
            already_submitted: alreadySubmitted,
            students: studentRoster
        });
    } catch (err) {
        console.error('Error fetching student roster:', err);
        return res.status(500).json({ error: 'Failed to fetch student roster.' });
    }
});

// POST /api/faculty/attendance (Submit Attendance Batch & Generate Notifications)
router.post('/attendance', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const { subject_id, date, class_period, attendance_list } = req.body;

        if (!subject_id || !date || !class_period || !Array.isArray(attendance_list) || attendance_list.length === 0) {
            return res.status(400).json({ error: 'Missing required attendance fields or empty student list.' });
        }

        // 1. Prevent Duplicate Submission Check
        const existingCount = await db.get(
            `SELECT COUNT(*) as count FROM attendance 
             WHERE subject_id = ? AND date = ? AND class_period = ?`,
            [subject_id, date, class_period]
        );

        if (existingCount && existingCount.count > 0) {
            return res.status(409).json({
                error: 'DUPLICATE_ENTRY',
                message: `Attendance for this Subject, Date (${date}), and Class Period (${class_period}) has ALREADY been submitted. Duplicate submission is not permitted.`
            });
        }

        // Get Subject Info for Notification text
        const subject = await db.get('SELECT name, code FROM subjects WHERE id = ?', [subject_id]);
        const subjectName = subject ? `${subject.code} - ${subject.name}` : 'Class';

        let presentCount = 0;
        let absentCount = 0;

        // Perform inserts in transaction batch
        for (const item of attendance_list) {
            const { student_id, status } = item;
            const validStatus = (status === 'Absent') ? 'Absent' : 'Present';

            if (validStatus === 'Present') presentCount++;
            else absentCount++;

            // Insert Attendance Record
            const attRes = await db.run(
                `INSERT INTO attendance (student_id, subject_id, faculty_id, date, class_period, status)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [student_id, subject_id, facultyId, date, class_period, validStatus]
            );

            // Generate Notification for Student
            const isPres = (validStatus === 'Present');
            const icon = isPres ? '✅' : '❌';
            const title = isPres ? 'Attendance Marked' : 'Attendance Alert';
            const type = isPres ? 'present_alert' : 'absent_alert';
            const msg = `${icon} ${title}: You were marked ${validStatus} for ${subjectName} class on ${date} at ${class_period.split(' - ')[0]}.`;

            await db.run(
                `INSERT INTO notifications (student_id, title, message, type, is_read, attendance_id)
                 VALUES (?, ?, ?, ?, 0, ?)`,
                [student_id, title, msg, type, attRes.id]
            );
        }

        return res.json({
            message: 'Attendance submitted successfully and student notifications generated!',
            total_students: attendance_list.length,
            present_count: presentCount,
            absent_count: absentCount,
            date,
            class_period
        });
    } catch (err) {
        console.error('Error submitting attendance:', err);
        return res.status(500).json({ error: 'Failed to submit attendance. Please try again.' });
    }
});

// GET /api/faculty/attendance/history
router.get('/attendance/history', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const { subject_id, date } = req.query;

        let query = `
            SELECT 
                a.date, a.class_period,
                sub.id as subject_id, sub.code as subject_code, sub.name as subject_name,
                COUNT(a.id) as total_students,
                SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
                SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
                ROUND(CAST(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(a.id) * 100, 1) as percentage
            FROM attendance a
            JOIN subjects sub ON a.subject_id = sub.id
            WHERE a.faculty_id = ?
        `;
        const params = [facultyId];

        if (subject_id) {
            query += ` AND a.subject_id = ?`;
            params.push(subject_id);
        }
        if (date) {
            query += ` AND a.date = ?`;
            params.push(date);
        }

        query += ` GROUP BY a.date, a.class_period, sub.id ORDER BY a.date DESC, a.timestamp DESC`;

        const sessions = await db.all(query, params);
        return res.json({ sessions });
    } catch (err) {
        console.error('Error fetching faculty attendance history:', err);
        return res.status(500).json({ error: 'Failed to fetch attendance history.' });
    }
});

// GET /api/faculty/attendance/session-detail
router.get('/attendance/session-detail', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const { subject_id, date, class_period } = req.query;

        if (!subject_id || !date || !class_period) {
            return res.status(400).json({ error: 'Subject, Date, and Class Period are required.' });
        }

        const details = await db.all(
            `SELECT a.id, a.status, s.usn, u.full_name, u.email
             FROM attendance a
             JOIN students s ON a.student_id = s.id
             JOIN users u ON s.user_id = u.id
             WHERE a.faculty_id = ? AND a.subject_id = ? AND a.date = ? AND a.class_period = ?
             ORDER BY s.usn ASC`,
            [facultyId, subject_id, date, class_period]
        );

        return res.json({ details });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch session roster details.' });
    }
});

// GET /api/faculty/marks (Get student marks for a subject)
router.get('/marks', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const { subject_id } = req.query;

        if (!subject_id) {
            return res.status(400).json({ error: 'Subject ID is required.' });
        }

        const subject = await db.get('SELECT * FROM subjects WHERE id = ? AND faculty_id = ?', [subject_id, facultyId]);
        if (!subject) return res.status(403).json({ error: 'Not authorized for this subject.' });

        const studentMarks = await db.all(
            `SELECT s.id as student_id, s.usn, u.full_name,
                    COALESCE(m.internal_1, 0) as internal_1,
                    COALESCE(m.internal_2, 0) as internal_2,
                    COALESCE(m.assignment, 0) as assignment,
                    COALESCE(m.lab, 0) as lab,
                    COALESCE(m.project, 0) as project,
                    COALESCE(m.final_exam, 0) as final_exam
             FROM students s
             JOIN users u ON s.user_id = u.id
             LEFT JOIN marks m ON m.student_id = s.id AND m.subject_id = ?
             WHERE s.department_id = ? AND s.semester = ?
             ORDER BY s.usn ASC`,
            [subject_id, subject.department_id, subject.semester]
        );

        return res.json({ subject, marks: studentMarks });
    } catch (err) {
        console.error('Error fetching student marks:', err);
        return res.status(500).json({ error: 'Failed to fetch student marks.' });
    }
});

// POST /api/faculty/marks (Update Marks)
router.post('/marks', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const { subject_id, marks_list } = req.body;

        if (!subject_id || !Array.isArray(marks_list)) {
            return res.status(400).json({ error: 'Invalid marks entry payload.' });
        }

        for (const item of marks_list) {
            const { student_id, internal_1, internal_2, assignment, lab, project, final_exam } = item;

            await db.run(
                `INSERT INTO marks (student_id, subject_id, internal_1, internal_2, assignment, lab, project, final_exam)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(student_id, subject_id) DO UPDATE SET
                    internal_1 = excluded.internal_1,
                    internal_2 = excluded.internal_2,
                    assignment = excluded.assignment,
                    lab = excluded.lab,
                    project = excluded.project,
                    final_exam = excluded.final_exam`,
                [student_id, subject_id, internal_1 || 0, internal_2 || 0, assignment || 0, lab || 0, project || 0, final_exam || 0]
            );
        }

        return res.json({ message: 'Marks updated successfully for all students!' });
    } catch (err) {
        console.error('Error saving marks:', err);
        return res.status(500).json({ error: 'Failed to save student marks.' });
    }
});

module.exports = router;
