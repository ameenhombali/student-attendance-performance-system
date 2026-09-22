const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All student routes require authentication and 'student' role
router.use(authenticateToken);
router.use(requireRole('student'));

// Helper to get student_id for logged in user
async function getStudentId(req) {
    if (req.user.student_id) return req.user.student_id;
    const student = await db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    return student ? student.id : null;
}

// GET /api/student/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        if (!studentId) return res.status(404).json({ error: 'Student record not found.' });

        // Get student info
        const student = await db.get(
            `SELECT s.id, s.usn, s.semester, s.section, u.full_name, u.email, d.name as department_name, d.code as department_code
             FROM students s
             JOIN users u ON s.user_id = u.id
             JOIN departments d ON s.department_id = d.id
             WHERE s.id = ?`,
            [studentId]
        );

        // Get overall attendance stats
        const attStats = await db.get(
            `SELECT 
                COUNT(*) as total_classes,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
                SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_count
             FROM attendance
             WHERE student_id = ?`,
            [studentId]
        );

        const totalClasses = attStats.total_classes || 0;
        const presentCount = attStats.present_count || 0;
        const absentCount = attStats.absent_count || 0;
        const overallPercentage = totalClasses > 0 ? parseFloat(((presentCount / totalClasses) * 100).toFixed(1)) : 100;

        // Get configurable threshold
        const thresholdSetting = await db.get("SELECT value FROM settings WHERE key = 'min_attendance_threshold'");
        const minThreshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 75.0;

        // Get subject-wise low attendance warnings
        const lowAttendanceSubjects = await db.all(
            `SELECT 
                sub.name as subject_name, sub.code as subject_code,
                COUNT(a.id) as total,
                SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present,
                ROUND(CAST(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(a.id) * 100, 1) as percentage
             FROM attendance a
             JOIN subjects sub ON a.subject_id = sub.id
             WHERE a.student_id = ?
             GROUP BY sub.id
             HAVING total > 0 AND percentage < ?`,
            [studentId, minThreshold]
        );

        // Get recent notifications (top 5)
        const recentNotifications = await db.all(
            `SELECT * FROM notifications 
             WHERE student_id = ? 
             ORDER BY created_at DESC LIMIT 5`,
            [studentId]
        );

        // Get recent attendance logs (top 5)
        const recentAttendance = await db.all(
            `SELECT a.id, a.date, a.class_period, a.status, sub.name as subject_name, sub.code as subject_code, u.full_name as faculty_name
             FROM attendance a
             JOIN subjects sub ON a.subject_id = sub.id
             JOIN faculty f ON a.faculty_id = f.id
             JOIN users u ON f.user_id = u.id
             WHERE a.student_id = ?
             ORDER BY a.date DESC, a.timestamp DESC LIMIT 5`,
            [studentId]
        );

        // Get overall academic marks percentage
        const marksAvg = await db.get(
            `SELECT 
                AVG((internal_1 + internal_2 + assignment + lab + project + final_exam) / 200.0 * 100) as avg_marks_pct
             FROM marks
             WHERE student_id = ?`,
            [studentId]
        );
        const academicPerformancePct = marksAvg && marksAvg.avg_marks_pct ? parseFloat(marksAvg.avg_marks_pct.toFixed(1)) : 85.0;

        return res.json({
            student,
            stats: {
                total_classes: totalClasses,
                present: presentCount,
                absent: absentCount,
                overall_percentage: overallPercentage,
                min_threshold: minThreshold,
                is_low_attendance: overallPercentage < minThreshold,
                academic_performance_pct: academicPerformancePct,
                low_attendance_warnings: lowAttendanceSubjects
            },
            recent_notifications: recentNotifications,
            recent_attendance: recentAttendance
        });
    } catch (err) {
        console.error('Error loading student dashboard:', err);
        return res.status(500).json({ error: 'Failed to load student dashboard.' });
    }
});

// GET /api/student/attendance/history
router.get('/attendance/history', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const { subject_id, status, search, start_date, end_date } = req.query;

        let query = `
            SELECT a.id, a.date, a.class_period, a.status, a.timestamp,
                   sub.id as subject_id, sub.name as subject_name, sub.code as subject_code,
                   u.full_name as faculty_name
            FROM attendance a
            JOIN subjects sub ON a.subject_id = sub.id
            JOIN faculty f ON a.faculty_id = f.id
            JOIN users u ON f.user_id = u.id
            WHERE a.student_id = ?
        `;
        const params = [studentId];

        if (subject_id) {
            query += ` AND a.subject_id = ?`;
            params.push(subject_id);
        }
        if (status) {
            query += ` AND a.status = ?`;
            params.push(status);
        }
        if (start_date) {
            query += ` AND a.date >= ?`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND a.date <= ?`;
            params.push(end_date);
        }
        if (search) {
            query += ` AND (sub.name LIKE ? OR sub.code LIKE ? OR u.full_name LIKE ? OR a.date LIKE ?)`;
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += ` ORDER BY a.date DESC, a.timestamp DESC`;

        const records = await db.all(query, params);

        // Compute totals for current filtered set
        const total = records.length;
        const present = records.filter(r => r.status === 'Present').length;
        const absent = records.filter(r => r.status === 'Absent').length;
        const percentage = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 100;

        return res.json({
            summary: {
                total,
                present,
                absent,
                percentage
            },
            records
        });
    } catch (err) {
        console.error('Error fetching attendance history:', err);
        return res.status(500).json({ error: 'Failed to fetch attendance history.' });
    }
});

// GET /api/student/attendance/subject-wise
router.get('/attendance/subject-wise', async (req, res) => {
    try {
        const studentId = await getStudentId(req);

        const thresholdSetting = await db.get("SELECT value FROM settings WHERE key = 'min_attendance_threshold'");
        const minThreshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 75.0;

        const subjects = await db.all(
            `SELECT 
                sub.id as subject_id,
                sub.code as subject_code,
                sub.name as subject_name,
                sub.semester,
                u.full_name as faculty_name,
                COUNT(a.id) as total_classes,
                SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent
             FROM subjects sub
             JOIN faculty f ON sub.faculty_id = f.id
             JOIN users u ON f.user_id = u.id
             LEFT JOIN attendance a ON a.subject_id = sub.id AND a.student_id = ?
             GROUP BY sub.id
             ORDER BY sub.code ASC`,
            [studentId]
        );

        const processed = subjects.map(s => {
            const total = s.total_classes || 0;
            const present = s.present || 0;
            const absent = s.absent || 0;
            const pct = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 100;

            let color = 'green';
            if (pct < minThreshold) color = 'red';
            else if (pct < 85) color = 'yellow';

            return {
                ...s,
                total_classes: total,
                present,
                absent,
                percentage: pct,
                color_status: color
            };
        });

        return res.json({
            min_threshold: minThreshold,
            subjects: processed
        });
    } catch (err) {
        console.error('Error fetching subject-wise attendance:', err);
        return res.status(500).json({ error: 'Failed to fetch subject-wise attendance.' });
    }
});

// GET /api/student/notifications
router.get('/notifications', async (req, res) => {
    try {
        const studentId = await getStudentId(req);

        const notifications = await db.all(
            `SELECT * FROM notifications 
             WHERE student_id = ? 
             ORDER BY created_at DESC`,
            [studentId]
        );

        const unreadCount = notifications.filter(n => n.is_read === 0).length;

        return res.json({
            unread_count: unreadCount,
            notifications
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
});

// PUT /api/student/notifications/:id/read
router.put('/notifications/:id/read', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const { id } = req.params;

        await db.run(
            `UPDATE notifications SET is_read = 1 WHERE id = ? AND student_id = ?`,
            [id, studentId]
        );

        return res.json({ message: 'Notification marked as read.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update notification status.' });
    }
});

// PUT /api/student/notifications/read-all
router.put('/notifications/read-all', async (req, res) => {
    try {
        const studentId = await getStudentId(req);

        await db.run(
            `UPDATE notifications SET is_read = 1 WHERE student_id = ?`,
            [studentId]
        );

        return res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update notifications.' });
    }
});

// GET /api/student/marks
router.get('/marks', async (req, res) => {
    try {
        const studentId = await getStudentId(req);

        const marks = await db.all(
            `SELECT 
                m.*, 
                sub.code as subject_code, 
                sub.name as subject_name,
                u.full_name as faculty_name,
                (
                    COALESCE(m.internal_1, 0) + 
                    COALESCE(m.internal_2, 0) + 
                    COALESCE(m.assignment, 0) + 
                    COALESCE(m.lab, 0) + 
                    COALESCE(m.project, 0) + 
                    COALESCE(m.final_exam, 0)
                ) as total_obtained,
                200.0 as total_max
             FROM marks m
             JOIN subjects sub ON m.subject_id = sub.id
             JOIN faculty f ON sub.faculty_id = f.id
             JOIN users u ON f.user_id = u.id
             WHERE m.student_id = ?
             ORDER BY sub.code ASC`,
            [studentId]
        );

        const formatted = marks.map(m => {
            const pct = parseFloat(((m.total_obtained / m.total_max) * 100).toFixed(1));
            return {
                ...m,
                percentage: pct
            };
        });

        // Calculate overall academic GPA / Percentage
        const grandTotalObtained = formatted.reduce((acc, curr) => acc + curr.total_obtained, 0);
        const grandTotalMax = formatted.length * 200;
        const overallAcademicPct = grandTotalMax > 0 ? parseFloat(((grandTotalObtained / grandTotalMax) * 100).toFixed(1)) : 0;

        return res.json({
            overall_academic_pct: overallAcademicPct,
            marks: formatted
        });
    } catch (err) {
        console.error('Error fetching student marks:', err);
        return res.status(500).json({ error: 'Failed to fetch academic performance data.' });
    }
});

module.exports = router;
