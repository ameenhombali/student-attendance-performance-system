const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

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

        // Pending attendance correction requests count
        const pendingCorrectionsRes = await db.get(
            `SELECT COUNT(*) as count FROM attendance_corrections 
             WHERE faculty_id = ? AND status = 'Pending'`,
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
             GROUP BY a.date, a.class_period, a.subject_id
             ORDER BY a.date DESC, a.timestamp DESC
             LIMIT 5`,
            [facultyId]
        );

        return res.json({
            faculty,
            subjects,
            stats: {
                total_subjects: subjects.length,
                total_students: totalStudentsRes ? totalStudentsRes.total_students : 0,
                total_sessions: recentSessions.length,
                pending_corrections: pendingCorrectionsRes ? pendingCorrectionsRes.count : 0
            },
            recent_sessions: recentSessions
        });
    } catch (err) {
        console.error('Error fetching faculty dashboard:', err);
        return res.status(500).json({ error: 'Failed to fetch faculty dashboard data.' });
    }
});

// GET /api/faculty/subjects
router.get('/subjects', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const subjects = await db.all(
            `SELECT s.*, d.name as department_name, d.code as department_code
             FROM subjects s
             JOIN departments d ON s.department_id = d.id
             WHERE s.faculty_id = ?
             ORDER BY s.semester ASC, s.code ASC`,
            [facultyId]
        );
        return res.json({ subjects });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch faculty subjects.' });
    }
});

// GET /api/faculty/roster
router.get('/roster', async (req, res) => {
    try {
        const { subject_id, date, class_period, semester, section } = req.query;

        if (!subject_id) {
            return res.status(400).json({ error: 'Subject ID is required to fetch roster.' });
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

        // Check for existing attendance records for this session
        const existingRecords = await db.all(
            `SELECT student_id, status FROM attendance 
             WHERE subject_id = ? AND date = ? AND class_period = ?`,
            [subject_id, date, class_period]
        );
        const existingMap = {};
        existingRecords.forEach(r => { existingMap[r.student_id] = r.status; });

        // Get Subject Info for Notification text
        const subject = await db.get('SELECT name, code FROM subjects WHERE id = ?', [subject_id]);
        const subjectName = subject ? `${subject.code} - ${subject.name}` : 'Class';

        let presentCount = 0;
        let absentCount = 0;

        // Perform inserts or updates in batch using INSERT OR REPLACE
        for (const item of attendance_list) {
            const { student_id, status } = item;
            const validStatus = (status === 'Absent') ? 'Absent' : 'Present';

            if (validStatus === 'Present') presentCount++; else absentCount++;

            // Check if attendance record already exists for this student/session
            const existingRec = await db.get(
                `SELECT id FROM attendance WHERE student_id = ? AND subject_id = ? AND date = ? AND class_period = ?`,
                [student_id, subject_id, date, class_period]
            );

            let attId;
            if (existingRec) {
                // Update existing record
                await db.run(
                    `UPDATE attendance SET status = ?, faculty_id = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?`,
                    [validStatus, facultyId, existingRec.id]
                );
                attId = existingRec.id;
            } else {
                // Insert new attendance record
                const insertRes = await db.run(
                    `INSERT INTO attendance (student_id, subject_id, faculty_id, date, class_period, status) VALUES (?, ?, ?, ?, ?, ?)`,
                    [student_id, subject_id, facultyId, date, class_period, validStatus]
                );
                // SQLite run returns lastID as insertId
                attId = insertRes.lastID || insertRes.id;
            }

            // Generate Notification for Student (replace any prior notification for same attendance)
            const isPres = (validStatus === 'Present');
            const icon = isPres ? '✅' : '❌';
            const title = isPres ? 'Attendance Marked' : 'Attendance Alert';
            const type = isPres ? 'present_alert' : 'absent_alert';
            const msg = `${icon} ${title}: You were marked ${validStatus} for ${subjectName} class on ${date} at ${class_period.split(' - ')[0]}.`;

            // Delete old notification for this attendance if exists
            await db.run(`DELETE FROM notifications WHERE attendance_id = ?`, [attId]);
            await db.run(
                `INSERT INTO notifications (student_id, title, message, type, is_read, attendance_id) VALUES (?, ?, ?, ?, 0, ?)`,
                [student_id, title, msg, type, attId]
            );
        }

        await logAudit(
            req,
            'ATTENDANCE_MARKED',
            `Marked attendance for ${subjectName} on ${date} (${class_period}): ${presentCount} Present, ${absentCount} Absent.`,
            subject_id
        );

        return res.status(201).json({
            message: 'Attendance submitted successfully.',
            stats: {
                total: attendance_list.length,
                present: presentCount,
                absent: absentCount
            }
        });
    } catch (err) {
        console.error('Error submitting attendance:', err);
        return res.status(500).json({ error: 'Failed to submit attendance.' });
    }
});

// GET /api/faculty/history (List past class attendance batches)
router.get('/history', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const { subject_id, from_date, to_date } = req.query;

        let sql = `
            SELECT 
                a.date, a.class_period, sub.id as subject_id, sub.code as subject_code, sub.name as subject_name,
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
            sql += ` AND a.subject_id = ?`;
            params.push(subject_id);
        }

        if (from_date) {
            sql += ` AND a.date >= ?`;
            params.push(from_date);
        }

        if (to_date) {
            sql += ` AND a.date <= ?`;
            params.push(to_date);
        }

        sql += ` GROUP BY a.date, a.class_period, a.subject_id ORDER BY a.date DESC, a.timestamp DESC`;

        const history = await db.all(sql, params);
        return res.json({ history });
    } catch (err) {
        console.error('Error fetching attendance history:', err);
        return res.status(500).json({ error: 'Failed to fetch attendance history.' });
    }
});

// GET /api/faculty/history/session-details
router.get('/history/session-details', async (req, res) => {
    try {
        const { subject_id, date, class_period } = req.query;
        if (!subject_id || !date || !class_period) {
            return res.status(400).json({ error: 'subject_id, date, and class_period are required.' });
        }

        const records = await db.all(
            `SELECT a.id, a.status, s.usn, u.full_name, u.email
             FROM attendance a
             JOIN students s ON a.student_id = s.id
             JOIN users u ON s.user_id = u.id
             WHERE a.subject_id = ? AND a.date = ? AND a.class_period = ?
             ORDER BY s.usn ASC`,
            [subject_id, date, class_period]
        );

        return res.json({ students: records });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch session student breakdown.' });
    }
});

// ==========================================
// ATTENDANCE CORRECTION REQUESTS (FACULTY)
// ==========================================

// GET /api/faculty/correction-requests - View correction requests
router.get('/correction-requests', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const { status } = req.query;

        let sql = `
            SELECT ac.*, 
                   s.usn, s.semester, s.section,
                   u.full_name as student_name, u.email as student_email,
                   sub.name as subject_name, sub.code as subject_code
            FROM attendance_corrections ac
            JOIN students s ON ac.student_id = s.id
            JOIN users u ON s.user_id = u.id
            JOIN subjects sub ON ac.subject_id = sub.id
            WHERE (ac.faculty_id = ? OR sub.faculty_id = ?)
        `;
        const params = [facultyId, facultyId];

        if (status && status !== 'All') {
            sql += ` AND ac.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY CASE WHEN ac.status = 'Pending' THEN 1 ELSE 2 END, ac.created_at DESC`;

        const requests = await db.all(sql, params);
        return res.json({ requests });
    } catch (err) {
        console.error('Error fetching correction requests:', err);
        return res.status(500).json({ error: 'Failed to fetch correction requests.' });
    }
});

// PUT /api/faculty/correction-requests/:id - Review (Approve / Reject)
router.put('/correction-requests/:id', async (req, res) => {
    try {
        const facultyId = await getFacultyId(req);
        const { action, remarks } = req.body;

        if (!action || !['Approved', 'Rejected'].includes(action)) {
            return res.status(400).json({ error: "Action must be 'Approved' or 'Rejected'." });
        }

        const reqRecord = await db.get(
            `SELECT ac.*, s.user_id as student_user_id, u.full_name as student_name, sub.name as subject_name
             FROM attendance_corrections ac
             JOIN students s ON ac.student_id = s.id
             JOIN users u ON s.user_id = u.id
             JOIN subjects sub ON ac.subject_id = sub.id
             WHERE ac.id = ? AND (ac.faculty_id = ? OR sub.faculty_id = ?)`,
            [req.params.id, facultyId, facultyId]
        );

        if (!reqRecord) {
            return res.status(404).json({ error: 'Correction request not found or not assigned to you.' });
        }

        if (reqRecord.status !== 'Pending') {
            return res.status(400).json({ error: `This request has already been ${reqRecord.status}.` });
        }

        const now = new Date().toISOString();

        if (action === 'Approved') {
            // 1. Update correction request status (reviewed_at timestamp)
            await db.run(
                `UPDATE attendance_corrections 
                 SET status = 'Approved', faculty_remarks = ?, reviewed_at = ? 
                 WHERE id = ?`,
                [remarks ? remarks.trim() : 'Approved by Faculty', now, reqRecord.id]
            );

            // 2. Update actual attendance record to Present
            await db.run(
                `UPDATE attendance SET status = 'Present' WHERE id = ?`,
                [reqRecord.attendance_id]
            );

            // 3. Notify student
            const notifMsg = `✅ Attendance Correction Approved: Your absence for ${reqRecord.subject_name} on ${reqRecord.date} has been corrected to Present.`;
            await db.run(
                `INSERT INTO notifications (student_id, title, message, type, is_read, attendance_id)
                 VALUES (?, 'Attendance Correction Approved', ?, 'present_alert', 0, ?)`,
                [reqRecord.student_id, notifMsg, reqRecord.attendance_id]
            );

            // 4. Log audit event
            await logAudit(
                req, 
                'ATTENDANCE_CORRECTION_APPROVED', 
                `Approved attendance correction for ${reqRecord.student_name} (${reqRecord.subject_name} on ${reqRecord.date}). Remarks: ${remarks || 'None'}`,
                reqRecord.attendance_id
            );

            return res.json({ message: 'Correction request APPROVED. Student attendance updated to Present.' });

        } else {
            // Rejected
            await db.run(
                `UPDATE attendance_corrections 
                 SET status = 'Rejected', faculty_remarks = ?, reviewed_at = ? 
                 WHERE id = ?`,
                [remarks ? remarks.trim() : 'Rejected by Faculty', now, reqRecord.id]
            );

            // Notify student
            const notifMsg = `❌ Attendance Correction Rejected: Your request for ${reqRecord.subject_name} on ${reqRecord.date} was rejected. Remarks: ${remarks || 'Insufficient justification'}`;
            await db.run(
                `INSERT INTO notifications (student_id, title, message, type, is_read, attendance_id)
                 VALUES (?, 'Attendance Correction Rejected', ?, 'warning', 0, ?)`,
                [reqRecord.student_id, notifMsg, reqRecord.attendance_id]
            );

            await logAudit(
                req, 
                'ATTENDANCE_CORRECTION_REJECTED', 
                `Rejected attendance correction for ${reqRecord.student_name} (${reqRecord.subject_name} on ${reqRecord.date}). Remarks: ${remarks || 'None'}`,
                reqRecord.attendance_id
            );

            return res.json({ message: 'Correction request REJECTED.' });
        }

    } catch (err) {
        console.error('Error reviewing correction request:', err);
        return res.status(500).json({ error: 'Failed to process correction request.' });
    }
});

// ==========================================
// MARKS MANAGEMENT (FACULTY)
// ==========================================

// GET /api/faculty/marks (Fetch student roster with current marks)
router.get('/marks', async (req, res) => {
    try {
        const { subject_id } = req.query;
        if (!subject_id) return res.status(400).json({ error: 'Subject ID required.' });

        const subject = await db.get('SELECT * FROM subjects WHERE id = ?', [subject_id]);
        if (!subject) return res.status(404).json({ error: 'Subject not found.' });

        const students = await db.all(
            `SELECT 
                s.id as student_id, s.usn, s.semester, s.section, u.full_name,
                m.internal_1, m.internal_2, m.assignment, m.lab, m.project, m.final_exam
             FROM students s
             JOIN users u ON s.user_id = u.id
             LEFT JOIN marks m ON s.id = m.student_id AND m.subject_id = ?
             WHERE s.department_id = ? AND s.semester = ?
             ORDER BY s.usn ASC`,
            [subject_id, subject.department_id, subject.semester]
        );

        // Normalize nulls to empty strings or 0
        const formattedStudents = students.map(s => ({
            ...s,
            internal_1: s.internal_1 !== null && s.internal_1 !== undefined ? s.internal_1 : '',
            internal_2: s.internal_2 !== null && s.internal_2 !== undefined ? s.internal_2 : '',
            assignment: s.assignment !== null && s.assignment !== undefined ? s.assignment : '',
            lab: s.lab !== null && s.lab !== undefined ? s.lab : '',
            project: s.project !== null && s.project !== undefined ? s.project : '',
            final_exam: s.final_exam !== null && s.final_exam !== undefined ? s.final_exam : ''
        }));

        return res.json({ subject, students: formattedStudents, marks: formattedStudents });
    } catch (err) {
        console.error('Error fetching student marks:', err);
        return res.status(500).json({ error: 'Failed to fetch student marks.' });
    }
});

// POST /api/faculty/marks (Update Marks)
router.post('/marks', async (req, res) => {
    try {
        const { subject_id, marks_list } = req.body;

        if (!subject_id || !Array.isArray(marks_list)) {
            return res.status(400).json({ error: 'Invalid marks entry payload.' });
        }

        const subject = await db.get('SELECT code, name FROM subjects WHERE id = ?', [subject_id]);
        const subjectName = subject ? `${subject.code} - ${subject.name}` : `Subject ID ${subject_id}`;

        for (const item of marks_list) {
            let { student_id, internal_1, internal_2, assignment, lab, project, final_exam } = item;

            internal_1 = parseFloat(internal_1) || 0;
            internal_2 = parseFloat(internal_2) || 0;
            assignment = parseFloat(assignment) || 0;
            lab = parseFloat(lab) || 0;
            project = parseFloat(project) || 0;
            final_exam = parseFloat(final_exam) || 0;

            // Strict Validation
            if (internal_1 < 0 || internal_1 > 25) { return res.status(400).json({ error: `IA 1 marks must be between 0 and 25 (received ${internal_1}).` }); }
            if (internal_2 < 0 || internal_2 > 25) { return res.status(400).json({ error: `IA 2 marks must be between 0 and 25 (received ${internal_2}).` }); }
            if (assignment < 0 || assignment > 10) { return res.status(400).json({ error: `Assignment marks must be between 0 and 10 (received ${assignment}).` }); }
            if (lab < 0 || lab > 20) { return res.status(400).json({ error: `Lab marks must be between 0 and 20 (received ${lab}).` }); }
            if (project < 0 || project > 20) { return res.status(400).json({ error: `Project marks must be between 0 and 20 (received ${project}).` }); }
            if (final_exam < 0 || final_exam > 100) { return res.status(400).json({ error: `Final exam marks must be between 0 and 100 (received ${final_exam}).` }); }

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
                [student_id, subject_id, internal_1, internal_2, assignment, lab, project, final_exam]
            );
        }

        await logAudit(
            req, 
            'MARKS_UPDATED', 
            `Updated academic marks for ${marks_list.length} students in ${subjectName}.`,
            subject_id
        );

        return res.json({ message: 'Marks updated successfully for all students!' });
    } catch (err) {
        console.error('Error saving marks:', err);
        return res.status(500).json({ error: 'Failed to save marks.' });
    }
});

module.exports = router;
