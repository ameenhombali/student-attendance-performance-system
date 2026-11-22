const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// ==========================================================
// PUBLIC DIGITAL ID CARD VERIFICATION (QR CODE SCAN TARGET)
// Safe: Returns public verification details ONLY. Never exposes passwords, hashes, or sensitive contact info.
// ==========================================================
router.get('/verify-id/:usn', async (req, res) => {
    try {
        const student = await db.get(
            `SELECT s.id, s.usn, s.semester, s.section, s.photo_url,
                    u.full_name,
                    d.name as department_name, d.code as department_code
             FROM students s
             JOIN users u ON s.user_id = u.id
             JOIN departments d ON s.department_id = d.id
             WHERE UPPER(s.usn) = UPPER(?)`,
            [req.params.usn]
        );

        if (!student) {
            return res.status(404).json({
                verified: false,
                message: 'Invalid Student ID. No matching student record found in college registry.'
            });
        }

        const collegeNameRow = await db.get("SELECT value FROM settings WHERE key = 'college_name'");
        const academicYearRow = await db.get("SELECT value FROM settings WHERE key = 'academic_year'");

        return res.json({
            verified: true,
            status: 'Active Student Record',
            student: {
                full_name: student.full_name,
                usn: student.usn,
                department: student.department_name,
                department_code: student.department_code,
                semester: student.semester,
                section: student.section,
                photo_url: student.photo_url || null,
                college_name: collegeNameRow ? collegeNameRow.value : 'National Institute of Engineering & Technology',
                academic_year: academicYearRow ? academicYearRow.value : '2026-2027',
                verification_timestamp: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('ID verification error:', err);
        return res.status(500).json({ error: 'Failed to verify Student ID.' });
    }
});

// All subsequent student routes require authentication and 'student' role
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
            `SELECT s.id, s.usn, s.semester, s.section, s.photo_url, u.full_name, u.email, d.name as department_name, d.code as department_code
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

// GET /api/student/id-card - Digital Student ID Card data
router.get('/id-card', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const student = await db.get(
            `SELECT s.id as student_id, s.usn, s.semester, s.section, s.photo_url,
                    u.full_name, u.email,
                    d.name as department_name, d.code as department_code
             FROM students s
             JOIN users u ON s.user_id = u.id
             JOIN departments d ON s.department_id = d.id
             WHERE s.id = ?`,
            [studentId]
        );

        if (!student) return res.status(404).json({ error: 'Student record not found.' });

        const collegeNameRow = await db.get("SELECT value FROM settings WHERE key = 'college_name'");
        const academicYearRow = await db.get("SELECT value FROM settings WHERE key = 'academic_year'");
        const collegeCodeRow = await db.get("SELECT value FROM settings WHERE key = 'college_code'");

        // Verification token string for QR code verification
        const qrPayload = JSON.stringify({
            usn: student.usn,
            name: student.full_name,
            dept: student.department_code,
            sem: student.semester,
            sec: student.section,
            verified: true
        });

        return res.json({
            id_card: {
                full_name: student.full_name,
                usn: student.usn,
                email: student.email,
                department_name: student.department_name,
                department_code: student.department_code,
                semester: student.semester,
                section: student.section,
                photo_url: student.photo_url || null,
                college_name: collegeNameRow ? collegeNameRow.value : 'National Institute of Engineering & Technology',
                college_code: collegeCodeRow ? collegeCodeRow.value : 'NIET-560001',
                academic_year: academicYearRow ? academicYearRow.value : '2026-2027',
                qr_code_data: qrPayload,
                issue_date: 'August 2026',
                valid_thru: 'July 2027'
            }
        });
    } catch (err) {
        console.error('Error fetching student ID card:', err);
        return res.status(500).json({ error: 'Failed to fetch student ID card data.' });
    }
});

// POST /api/student/upload-photo - Update student photograph
router.post('/upload-photo', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const { photo_url } = req.body;

        if (!photo_url) {
            return res.status(400).json({ error: 'Photo data is required.' });
        }

        await db.run('UPDATE students SET photo_url = ? WHERE id = ?', [photo_url, studentId]);
        await logAudit(req, 'STUDENT_PHOTO_UPDATED', `Student updated their digital ID card photograph.`, studentId);

        return res.json({ message: 'ID card photo updated successfully.', photo_url });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update photo.' });
    }
});

// ==========================================================
// ATTENDANCE CORRECTION REQUESTS (STUDENT)
// ==========================================================

// GET /api/student/absent-sessions - List past absent sessions to request correction
router.get('/absent-sessions', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const absentSessions = await db.all(
            `SELECT a.id, a.date, a.class_period, a.status, 
                    sub.id as subject_id, sub.code as subject_code, sub.name as subject_name,
                    u.full_name as faculty_name,
                    ac.id as correction_id, ac.status as correction_status
             FROM attendance a
             JOIN subjects sub ON a.subject_id = sub.id
             JOIN faculty f ON a.faculty_id = f.id
             JOIN users u ON f.user_id = u.id
             LEFT JOIN attendance_corrections ac ON a.id = ac.attendance_id
             WHERE a.student_id = ? AND a.status = 'Absent'
             ORDER BY a.date DESC, a.timestamp DESC`,
            [studentId]
        );
        return res.json({ absent_sessions: absentSessions });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch absent attendance records.' });
    }
});

// GET /api/student/correction-requests - View past correction requests
router.get('/correction-requests', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const requests = await db.all(
            `SELECT ac.*, 
                    sub.code as subject_code, sub.name as subject_name,
                    COALESCE(u.full_name, 'Subject Faculty') as faculty_name
             FROM attendance_corrections ac
             JOIN subjects sub ON ac.subject_id = sub.id
             LEFT JOIN faculty f ON (ac.faculty_id = f.id OR sub.faculty_id = f.id)
             LEFT JOIN users u ON f.user_id = u.id
             WHERE ac.student_id = ?
             ORDER BY ac.created_at DESC`,
            [studentId]
        );
        return res.json({ requests });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch correction requests.' });
    }
});

// POST /api/student/correction-requests - Submit attendance correction request
router.post('/correction-requests', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const { attendance_id, reason, attachment_name, attachment_data } = req.body;

        if (!attendance_id || !reason) {
            return res.status(400).json({ error: 'Attendance session selection and reason are required.' });
        }

        // Validate attendance record exists and belongs to this student and was marked Absent
        const att = await db.get(
            `SELECT a.*, sub.name as subject_name, sub.code as subject_code, sub.faculty_id as sub_faculty_id
             FROM attendance a
             JOIN subjects sub ON a.subject_id = sub.id
             WHERE a.id = ? AND a.student_id = ?`,
            [attendance_id, studentId]
        );

        if (!att) {
            return res.status(404).json({ error: 'Attendance record not found or does not belong to you.' });
        }

        if (att.status !== 'Absent') {
            return res.status(400).json({ error: `This class session is already recorded as '${att.status}'. Only 'Absent' records can be disputed.` });
        }

        // Prevent duplicate requests: Check if there is already an active request for this attendance record
        const existingReq = await db.get(
            `SELECT id, status FROM attendance_corrections WHERE attendance_id = ?`,
            [attendance_id]
        );
        if (existingReq) {
            if (existingReq.status === 'Pending') {
                return res.status(400).json({ error: 'A correction request for this class session is already pending review by faculty.' });
            } else if (existingReq.status === 'Approved') {
                return res.status(400).json({ error: 'A correction request for this class session has already been approved.' });
            }
        }

        const targetFacultyId = att.faculty_id || att.sub_faculty_id || 1;

        const insertRes = await db.run(
            `INSERT INTO attendance_corrections 
             (student_id, attendance_id, subject_id, faculty_id, date, class_period, current_status, reason, attachment_name, attachment_data, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Absent', ?, ?, ?, 'Pending')`,
            [
                studentId,
                att.id,
                att.subject_id,
                targetFacultyId,
                att.date,
                att.class_period,
                reason.trim(),
                attachment_name || null,
                attachment_data || null
            ]
        );

        await logAudit(
            req, 
            'ATTENDANCE_CORRECTION_REQUESTED', 
            `Student requested attendance correction for ${att.subject_name} on ${att.date}. Reason: ${reason.trim()}`,
            insertRes.id
        );

        return res.status(201).json({
            message: 'Attendance correction request submitted successfully. It will be reviewed by your subject faculty.',
            request_id: insertRes.id
        });
    } catch (err) {
        console.error('Error submitting correction request:', err);
        return res.status(500).json({ error: 'Failed to submit correction request.' });
    }
});

// GET /api/student/attendance/history & /api/student/history (Attendance History with summary)
router.get(['/attendance/history', '/history'], async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const { subject_id, status, from_date, to_date, search } = req.query;

        let sql = `
            SELECT a.id, a.date, a.class_period, a.status, a.timestamp,
                   sub.name as subject_name, sub.code as subject_code,
                   COALESCE(u.full_name, 'Faculty') as faculty_name,
                   ac.id as correction_id, ac.status as correction_status
            FROM attendance a
            JOIN subjects sub ON a.subject_id = sub.id
            LEFT JOIN faculty f ON a.faculty_id = f.id
            LEFT JOIN users u ON f.user_id = u.id
            LEFT JOIN attendance_corrections ac ON a.id = ac.attendance_id
            WHERE a.student_id = ?
        `;
        const params = [studentId];

        if (subject_id) {
            sql += ` AND a.subject_id = ?`;
            params.push(subject_id);
        }
        if (status) {
            sql += ` AND a.status = ?`;
            params.push(status);
        }
        if (from_date) {
            sql += ` AND a.date >= ?`;
            params.push(from_date);
        }
        if (to_date) {
            sql += ` AND a.date <= ?`;
            params.push(to_date);
        }
        if (search) {
            sql += ` AND (LOWER(sub.name) LIKE LOWER(?) OR LOWER(sub.code) LIKE LOWER(?) OR LOWER(u.full_name) LIKE LOWER(?))`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY a.date DESC, a.timestamp DESC`;

        const logs = await db.all(sql, params);

        const total = logs.length;
        const present = logs.filter(l => l.status === 'Present').length;
        const absent = total - present;
        const percentage = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 100.0;

        const summary = {
            total,
            present,
            absent,
            percentage
        };

        return res.json({ 
            history: logs,
            records: logs,
            summary
        });
    } catch (err) {
        console.error('Error fetching student history:', err);
        return res.status(500).json({ error: 'Failed to fetch attendance history.' });
    }
});

// GET /api/student/attendance/subject-wise & /api/student/subjects (Subject-wise breakdown)
router.get(['/attendance/subject-wise', '/subjects'], async (req, res) => {
    try {
        const studentId = await getStudentId(req);

        const subjects = await db.all(
            `SELECT 
                sub.id as subject_id, sub.code as subject_code, sub.name as subject_name, sub.semester,
                COALESCE(u.full_name, 'Faculty') as faculty_name, u.email as faculty_email,
                COUNT(a.id) as total_classes,
                SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
                SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent_count
             FROM subjects sub
             JOIN students s ON s.id = ? AND s.department_id = sub.department_id AND s.semester = sub.semester
             LEFT JOIN faculty f ON sub.faculty_id = f.id
             LEFT JOIN users u ON f.user_id = u.id
             LEFT JOIN attendance a ON a.subject_id = sub.id AND a.student_id = s.id
             GROUP BY sub.id
             ORDER BY sub.code ASC`,
            [studentId]
        );

        const thresholdSetting = await db.get("SELECT value FROM settings WHERE key = 'min_attendance_threshold'");
        const minThreshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 75.0;

        let grandTotal = 0;
        let grandPresent = 0;

        const formattedSubjects = subjects.map(s => {
            const total = s.total_classes || 0;
            const pres = s.present_count || 0;
            const abs = total >= pres ? total - pres : (s.absent_count || 0);
            const pct = total > 0 ? parseFloat(((pres / total) * 100).toFixed(1)) : 100.0;
            
            grandTotal += total;
            grandPresent += pres;

            let color_status = 'green';
            if (pct < minThreshold) {
                color_status = 'red';
            } else if (pct < 85) {
                color_status = 'yellow';
            }

            return {
                subject_id: s.subject_id,
                subject_code: s.subject_code,
                subject_name: s.subject_name,
                semester: s.semester,
                faculty_name: s.faculty_name,
                faculty_email: s.faculty_email,
                total_classes: total,
                present: pres,
                present_count: pres,
                absent: abs,
                absent_count: abs,
                percentage: pct,
                color_status,
                is_low: pct < minThreshold
            };
        });

        const overallPct = grandTotal > 0 ? parseFloat(((grandPresent / grandTotal) * 100).toFixed(1)) : 100.0;
        const lowAttendanceWarnings = formattedSubjects.filter(s => s.is_low);

        return res.json({
            min_threshold: minThreshold,
            overall_percentage: overallPct,
            is_low_attendance: overallPct < minThreshold,
            low_attendance_warnings: lowAttendanceWarnings,
            subjects: formattedSubjects
        });
    } catch (err) {
        console.error('Error fetching subject breakdown:', err);
        return res.status(500).json({ error: 'Failed to fetch subject-wise breakdown.' });
    }
});

// GET /api/student/subjects/:subjectId/logs (In-depth subject sessions modal)
router.get('/subjects/:subjectId/logs', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const { subjectId } = req.params;

        const logs = await db.all(
            `SELECT a.id, a.date, a.class_period, a.status, a.timestamp, u.full_name as faculty_name
             FROM attendance a
             JOIN faculty f ON a.faculty_id = f.id
             JOIN users u ON f.user_id = u.id
             WHERE a.student_id = ? AND a.subject_id = ?
             ORDER BY a.date DESC, a.timestamp DESC`,
            [studentId, subjectId]
        );

        return res.json({ logs });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch subject log.' });
    }
});

// GET /api/student/notifications
router.get('/notifications', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        const notifications = await db.all(
            `SELECT * FROM notifications WHERE student_id = ? ORDER BY created_at DESC LIMIT 30`,
            [studentId]
        );
        const unreadCount = await db.get(
            `SELECT COUNT(*) as count FROM notifications WHERE student_id = ? AND is_read = 0`,
            [studentId]
        );

        return res.json({
            notifications,
            unread_count: unreadCount ? unreadCount.count : 0
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
});

// POST /api/student/notifications/:id/read
router.post('/notifications/:id/read', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND student_id = ?', [req.params.id, studentId]);
        return res.json({ message: 'Notification marked as read.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update notification.' });
    }
});

// POST /api/student/notifications/read-all
router.post('/notifications/read-all', async (req, res) => {
    try {
        const studentId = await getStudentId(req);
        await db.run('UPDATE notifications SET is_read = 1 WHERE student_id = ?', [studentId]);
        return res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to mark all notifications as read.' });
    }
});

// GET /api/student/marks (Academic marks & test analytics)
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
