const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// All admin routes strictly require 'admin' role
router.use(authenticateToken);
router.use(requireRole('admin'));

// GET /api/admin/dashboard - Overall college statistics
router.get('/dashboard', async (req, res) => {
    try {
        const studentCountRes = await db.get('SELECT COUNT(*) as count FROM students');
        const facultyCountRes = await db.get('SELECT COUNT(*) as count FROM faculty');
        const deptCountRes = await db.get('SELECT COUNT(*) as count FROM departments');
        const subjectCountRes = await db.get('SELECT COUNT(*) as count FROM subjects');
        const noticeCountRes = await db.get('SELECT COUNT(*) as count FROM notices');
        const materialCountRes = await db.get('SELECT COUNT(*) as count FROM study_materials');
        const pendingCorrectionsRes = await db.get("SELECT COUNT(*) as count FROM attendance_corrections WHERE status = 'Pending'");

        // Overall Attendance
        const attStats = await db.get(`
            SELECT 
                COUNT(*) as total_records,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count
            FROM attendance
        `);
        const totalAtt = attStats ? attStats.total_records || 0 : 0;
        const presentAtt = attStats ? attStats.present_count || 0 : 0;
        const overallAttendancePct = totalAtt > 0 ? parseFloat(((presentAtt / totalAtt) * 100).toFixed(1)) : 100;

        // Threshold
        const thresholdRow = await db.get("SELECT value FROM settings WHERE key = 'min_attendance_threshold'");
        const minThreshold = thresholdRow ? parseFloat(thresholdRow.value) : 75.0;

        // Low Attendance Count
        const lowAttCountRes = await db.get(`
            SELECT COUNT(*) as count FROM (
                SELECT student_id,
                       CAST(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as pct
                FROM attendance
                GROUP BY student_id
                HAVING pct < ?
            )
        `, [minThreshold]);

        // Recent Audit Logs
        const recentAudit = await db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 6');

        // Recent Notices
        const recentNotices = await db.all('SELECT id, title, category, publish_date, is_important FROM notices ORDER BY created_at DESC LIMIT 5');

        return res.json({
            stats: {
                total_students: studentCountRes ? studentCountRes.count : 0,
                total_faculty: facultyCountRes ? facultyCountRes.count : 0,
                total_departments: deptCountRes ? deptCountRes.count : 0,
                total_subjects: subjectCountRes ? subjectCountRes.count : 0,
                total_notices: noticeCountRes ? noticeCountRes.count : 0,
                total_materials: materialCountRes ? materialCountRes.count : 0,
                pending_corrections: pendingCorrectionsRes ? pendingCorrectionsRes.count : 0,
                overall_attendance_pct: overallAttendancePct,
                low_attendance_students: lowAttCountRes ? lowAttCountRes.count : 0,
                min_threshold: minThreshold
            },
            recent_audit: recentAudit,
            recent_notices: recentNotices
        });
    } catch (err) {
        console.error('Error fetching admin dashboard:', err);
        return res.status(500).json({ error: 'Failed to fetch admin dashboard.' });
    }
});

// ==========================================
// 1. STUDENT ACCOUNTS MANAGEMENT
// ==========================================

// GET /api/admin/students - List students
router.get('/students', async (req, res) => {
    try {
        const { search, department_id, semester } = req.query;
        let sql = `
            SELECT s.id as student_id, s.usn, s.semester, s.section, s.photo_url,
                   u.id as user_id, u.username, u.full_name, u.email, u.created_at,
                   d.id as department_id, d.name as department_name, d.code as department_code,
                   (
                       SELECT ROUND(CAST(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1)
                       FROM attendance WHERE student_id = s.id
                   ) as attendance_pct
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN departments d ON s.department_id = d.id
            WHERE 1=1
        `;
        const params = [];

        if (department_id) {
            sql += ` AND s.department_id = ?`;
            params.push(department_id);
        }
        if (semester) {
            sql += ` AND s.semester = ?`;
            params.push(semester);
        }
        if (search) {
            sql += ` AND (LOWER(s.usn) LIKE LOWER(?) OR LOWER(u.full_name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY s.usn ASC`;

        const students = await db.all(sql, params);
        return res.json({ students });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch students list.' });
    }
});

// POST /api/admin/students - Create single student
router.post('/students', async (req, res) => {
    try {
        const { usn, full_name, email, department_id, semester, section, password, photo_url } = req.body;

        if (!usn || !full_name || !email || !department_id || !semester || !section) {
            return res.status(400).json({ error: 'USN, full name, email, department, semester, and section are required.' });
        }

        const trimmedUsn = usn.trim().toUpperCase();
        const trimmedEmail = email.trim().toLowerCase();

        // Duplicate checks
        const existingUsn = await db.get('SELECT id FROM students WHERE UPPER(usn) = ?', [trimmedUsn]);
        if (existingUsn) return res.status(400).json({ error: `USN '${trimmedUsn}' already exists.` });

        const existingEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [trimmedEmail]);
        if (existingEmail) return res.status(400).json({ error: `Email '${trimmedEmail}' already registered.` });

        const passwordHash = await bcrypt.hash(password || 'student123', 10);

        const userRes = await db.run(
            `INSERT INTO users (username, password_hash, role, full_name, email)
             VALUES (?, ?, 'student', ?, ?)`,
            [trimmedUsn, passwordHash, full_name.trim(), trimmedEmail]
        );

        const stuRes = await db.run(
            `INSERT INTO students (user_id, usn, department_id, semester, section, photo_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userRes.id, trimmedUsn, department_id, semester, section.trim().toUpperCase(), photo_url || null]
        );

        // Seed default empty marks for enrolled subjects
        const subjects = await db.all('SELECT id FROM subjects WHERE department_id = ? AND semester = ?', [department_id, semester]);
        for (const sub of subjects) {
            await db.run(
                `INSERT OR IGNORE INTO marks (student_id, subject_id, internal_1, internal_2, assignment, lab, project, final_exam)
                 VALUES (?, ?, 0, 0, 0, 0, 0, 0)`,
                [stuRes.id, sub.id]
            );
        }

        await logAudit(req, 'STUDENT_CREATED', `Created student ${full_name.trim()} (${trimmedUsn}) in Department ID ${department_id}.`, stuRes.id);

        return res.status(201).json({ message: 'Student account created successfully.', student_id: stuRes.id });
    } catch (err) {
        console.error('Error creating student:', err);
        return res.status(500).json({ error: 'Failed to create student.' });
    }
});

// PUT /api/admin/students/:id - Update student
router.put('/students/:id', async (req, res) => {
    try {
        const studentId = req.params.id;
        const { full_name, email, department_id, semester, section, photo_url } = req.body;

        const stu = await db.get('SELECT * FROM students WHERE id = ?', [studentId]);
        if (!stu) return res.status(404).json({ error: 'Student record not found.' });

        if (full_name || email) {
            await db.run(
                `UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email) WHERE id = ?`,
                [full_name ? full_name.trim() : null, email ? email.trim().toLowerCase() : null, stu.user_id]
            );
        }

        await db.run(
            `UPDATE students SET 
                department_id = COALESCE(?, department_id),
                semester = COALESCE(?, semester),
                section = COALESCE(?, section),
                photo_url = COALESCE(?, photo_url)
             WHERE id = ?`,
            [
                department_id || null,
                semester || null,
                section ? section.trim().toUpperCase() : null,
                photo_url !== undefined ? photo_url : stu.photo_url,
                studentId
            ]
        );

        await logAudit(req, 'STUDENT_UPDATED', `Updated student ID ${studentId} (${stu.usn}).`, studentId);

        return res.json({ message: 'Student updated successfully.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update student.' });
    }
});

// DELETE /api/admin/students/:id - Delete student
router.delete('/students/:id', async (req, res) => {
    try {
        const studentId = req.params.id;
        const stu = await db.get('SELECT s.*, u.full_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?', [studentId]);
        if (!stu) return res.status(404).json({ error: 'Student not found.' });

        // Deleting from users cascades to students, attendance, marks, notifications
        await db.run('DELETE FROM users WHERE id = ?', [stu.user_id]);
        await logAudit(req, 'STUDENT_DELETED', `Deleted student ${stu.full_name} (${stu.usn}).`, studentId);

        return res.json({ message: 'Student deleted successfully.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to delete student.' });
    }
});

// ==========================================
// 2. FACULTY ACCOUNTS MANAGEMENT
// ==========================================

// GET /api/admin/faculty
router.get('/faculty', async (req, res) => {
    try {
        const facultyList = await db.all(`
            SELECT f.id as faculty_id, f.faculty_id as fid_code, f.designation,
                   u.id as user_id, u.username, u.full_name, u.email, u.created_at,
                   d.id as department_id, d.name as department_name, d.code as department_code,
                   (SELECT COUNT(*) FROM subjects WHERE faculty_id = f.id) as subjects_count
            FROM faculty f
            JOIN users u ON f.user_id = u.id
            JOIN departments d ON f.department_id = d.id
            ORDER BY u.full_name ASC
        `);
        return res.json({ faculty: facultyList });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch faculty list.' });
    }
});

// POST /api/admin/faculty
router.post('/faculty', async (req, res) => {
    try {
        const { faculty_id, full_name, email, department_id, designation, password } = req.body;
        if (!faculty_id || !full_name || !email || !department_id) {
            return res.status(400).json({ error: 'Faculty ID, name, email, and department are required.' });
        }

        const fidCode = faculty_id.trim().toUpperCase();
        const existingFid = await db.get('SELECT id FROM faculty WHERE UPPER(faculty_id) = ?', [fidCode]);
        if (existingFid) return res.status(400).json({ error: `Faculty ID '${fidCode}' already exists.` });

        const existingEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [email.trim().toLowerCase()]);
        if (existingEmail) return res.status(400).json({ error: `Email '${email}' already registered.` });

        const passwordHash = await bcrypt.hash(password || 'password123', 10);
        const username = fidCode.toLowerCase();

        const userRes = await db.run(
            `INSERT INTO users (username, password_hash, role, full_name, email)
             VALUES (?, ?, 'faculty', ?, ?)`,
            [username, passwordHash, full_name.trim(), email.trim().toLowerCase()]
        );

        const facRes = await db.run(
            `INSERT INTO faculty (user_id, faculty_id, department_id, designation)
             VALUES (?, ?, ?, ?)`,
            [userRes.id, fidCode, department_id, designation || 'Assistant Professor']
        );

        await logAudit(req, 'FACULTY_CREATED', `Created faculty account ${full_name} (${fidCode}).`, facRes.id);

        return res.status(201).json({ message: 'Faculty created successfully.', faculty_id: facRes.id });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to create faculty.' });
    }
});

// DELETE /api/admin/faculty/:id
router.delete('/faculty/:id', async (req, res) => {
    try {
        const fac = await db.get('SELECT f.*, u.full_name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = ?', [req.params.id]);
        if (!fac) return res.status(404).json({ error: 'Faculty not found.' });

        await db.run('DELETE FROM users WHERE id = ?', [fac.user_id]);
        await logAudit(req, 'FACULTY_DELETED', `Deleted faculty ${fac.full_name} (${fac.faculty_id}).`, req.params.id);

        return res.json({ message: 'Faculty deleted successfully.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to delete faculty.' });
    }
});

// ==========================================
// 3. DEPARTMENTS & SUBJECTS
// ==========================================

// GET /api/admin/departments
router.get('/departments', async (req, res) => {
    try {
        const departments = await db.all(`
            SELECT d.*, 
                   (SELECT COUNT(*) FROM students WHERE department_id = d.id) as students_count,
                   (SELECT COUNT(*) FROM faculty WHERE department_id = d.id) as faculty_count,
                   (SELECT COUNT(*) FROM subjects WHERE department_id = d.id) as subjects_count
            FROM departments d
            ORDER BY d.code ASC
        `);
        return res.json({ departments });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch departments.' });
    }
});

// POST /api/admin/departments
router.post('/departments', async (req, res) => {
    try {
        const { code, name } = req.body;
        if (!code || !name) return res.status(400).json({ error: 'Department code and name required.' });

        const dRes = await db.run('INSERT INTO departments (code, name) VALUES (?, ?)', [code.trim().toUpperCase(), name.trim()]);
        await logAudit(req, 'DEPARTMENT_CREATED', `Added department ${name} (${code}).`, dRes.id);
        return res.status(201).json({ message: 'Department added.', id: dRes.id });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to add department.' });
    }
});

// GET /api/admin/subjects
router.get('/subjects', async (req, res) => {
    try {
        const subjects = await db.all(`
            SELECT s.*, d.name as department_name, d.code as department_code,
                   u.full_name as faculty_name
            FROM subjects s
            JOIN departments d ON s.department_id = d.id
            JOIN faculty f ON s.faculty_id = f.id
            JOIN users u ON f.user_id = u.id
            ORDER BY s.semester ASC, s.code ASC
        `);
        return res.json({ subjects });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch subjects.' });
    }
});

// POST /api/admin/subjects
router.post('/subjects', async (req, res) => {
    try {
        const { code, name, department_id, semester, faculty_id } = req.body;
        if (!code || !name || !department_id || !semester || !faculty_id) {
            return res.status(400).json({ error: 'Code, name, department, semester, and faculty are required.' });
        }

        const subRes = await db.run(
            'INSERT INTO subjects (code, name, department_id, semester, faculty_id) VALUES (?, ?, ?, ?, ?)',
            [code.trim().toUpperCase(), name.trim(), department_id, semester, faculty_id]
        );
        await logAudit(req, 'SUBJECT_CREATED', `Created subject ${name} (${code}).`, subRes.id);
        return res.status(201).json({ message: 'Subject created successfully.', id: subRes.id });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to create subject.' });
    }
});

// ==========================================
// 4. BULK STUDENT IMPORT VIA EXCEL
// ==========================================

// GET /api/admin/students/excel-template - Download Excel template
router.get('/students/excel-template', (req, res) => {
    try {
        const templateData = [
            {
                'USN': '3CS011',
                'Full Name': 'Manish Gowda',
                'Email': 'manish@student.college.edu',
                'Department Code': 'CSE',
                'Semester': 5,
                'Section': 'A',
                'Password (Optional)': 'student123'
            },
            {
                'USN': '3CS012',
                'Full Name': 'Kavya Nair',
                'Email': 'kavya@student.college.edu',
                'Department Code': 'CSE',
                'Semester': 5,
                'Section': 'A',
                'Password (Optional)': 'student123'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to generate template.' });
    }
});

// POST /api/admin/students/import-preview - Validate & preview uploaded Excel file
router.post('/students/import-preview', async (req, res) => {
    try {
        const { file_data } = req.body;
        if (!file_data) {
            return res.status(400).json({ error: 'No file data received.' });
        }

        // Base64 to buffer
        const base64Data = file_data.replace(/^data:.*?;base64,/, '');
        const fileBuffer = Buffer.from(base64Data, 'base64');
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
            return res.status(400).json({ error: 'The uploaded Excel spreadsheet is empty.' });
        }

        // Departments map (code -> id)
        const depts = await db.all('SELECT id, code, name FROM departments');
        const deptMap = {};
        depts.forEach(d => { deptMap[d.code.toUpperCase()] = d.id; });

        // Existing USNs and Emails in DB
        const existingUsers = await db.all('SELECT LOWER(username) as username, LOWER(email) as email FROM users');
        const dbUsernames = new Set(existingUsers.map(u => u.username));
        const dbEmails = new Set(existingUsers.map(u => u.email));

        const seenFileUsns = new Set();
        const seenFileEmails = new Set();

        const previewRows = [];
        let validCount = 0;
        let invalidCount = 0;

        rawRows.forEach((row, index) => {
            const rowNumber = index + 2; // header is row 1
            const usn = String(row['USN'] || row['usn'] || '').trim().toUpperCase();
            const fullName = String(row['Full Name'] || row['Name'] || row['name'] || '').trim();
            const email = String(row['Email'] || row['email'] || '').trim().toLowerCase();
            const deptCode = String(row['Department Code'] || row['Department'] || row['dept'] || '').trim().toUpperCase();
            const semester = parseInt(row['Semester'] || row['sem'] || 5, 10);
            const section = String(row['Section'] || row['sec'] || 'A').trim().toUpperCase();
            const password = String(row['Password (Optional)'] || row['Password'] || 'student123').trim();

            const errors = [];

            if (!usn) errors.push('USN is required');
            if (!fullName) errors.push('Full name is required');
            if (!email || !email.includes('@')) errors.push('Valid email is required');
            if (!deptCode || !deptMap[deptCode]) errors.push(`Unknown department code '${deptCode}'`);
            if (isNaN(semester) || semester < 1 || semester > 8) errors.push('Semester must be 1-8');
            if (!section) errors.push('Section is required');

            // Duplicate in file check
            if (usn) {
                if (seenFileUsns.has(usn)) errors.push(`Duplicate USN in file: ${usn}`);
                seenFileUsns.add(usn);
            }
            if (email) {
                if (seenFileEmails.has(email)) errors.push(`Duplicate Email in file: ${email}`);
                seenFileEmails.add(email);
            }

            // Duplicate in DB check
            if (usn && dbUsernames.has(usn.toLowerCase())) errors.push(`USN '${usn}' already exists in database`);
            if (email && dbEmails.has(email)) errors.push(`Email '${email}' already registered in database`);

            const isValid = errors.length === 0;
            if (isValid) validCount++; else invalidCount++;

            previewRows.push({
                row_number: rowNumber,
                usn,
                full_name: fullName,
                email,
                department_code: deptCode,
                department_id: deptMap[deptCode] || null,
                semester,
                section,
                password,
                is_valid: isValid,
                errors: errors
            });
        });

        return res.json({
            total_rows: rawRows.length,
            valid_count: validCount,
            invalid_count: invalidCount,
            rows: previewRows
        });
    } catch (err) {
        console.error('Excel preview error:', err);
        return res.status(500).json({ error: 'Failed to parse Excel file: ' + err.message });
    }
});

// POST /api/admin/students/import-confirm - Execute bulk import of valid rows
router.post('/students/import-confirm', async (req, res) => {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'No student rows provided to import.' });
        }

        const validRows = rows.filter(r => r.is_valid);
        if (validRows.length === 0) {
            return res.status(400).json({ error: 'No valid rows to import.' });
        }

        let importedCount = 0;
        const defaultHash = await bcrypt.hash('student123', 10);

        for (const r of validRows) {
            try {
                const passHash = (r.password && r.password !== 'student123') 
                    ? await bcrypt.hash(r.password, 10) 
                    : defaultHash;

                const uRes = await db.run(
                    `INSERT INTO users (username, password_hash, role, full_name, email)
                     VALUES (?, ?, 'student', ?, ?)`,
                    [r.usn, passHash, r.full_name, r.email]
                );

                const sRes = await db.run(
                    `INSERT INTO students (user_id, usn, department_id, semester, section)
                     VALUES (?, ?, ?, ?, ?)`,
                    [uRes.id, r.usn, r.department_id, r.semester, r.section]
                );

                // Seed marks entries for department subjects
                const subs = await db.all('SELECT id FROM subjects WHERE department_id = ? AND semester = ?', [r.department_id, r.semester]);
                for (const sub of subs) {
                    await db.run(
                        `INSERT OR IGNORE INTO marks (student_id, subject_id, internal_1, internal_2, assignment, lab, project, final_exam)
                         VALUES (?, ?, 0, 0, 0, 0, 0, 0)`,
                        [sRes.id, sub.id]
                    );
                }

                importedCount++;
            } catch (rowErr) {
                console.error(`Error importing row ${r.usn}:`, rowErr.message);
            }
        }

        await logAudit(
            req, 
            'BULK_STUDENT_IMPORT', 
            `Imported ${importedCount} student accounts out of ${rows.length} spreadsheet records.`,
            null
        );

        return res.json({
            message: `Successfully imported ${importedCount} student accounts.`,
            imported_count: importedCount,
            rejected_count: rows.length - importedCount
        });
    } catch (err) {
        console.error('Bulk import error:', err);
        return res.status(500).json({ error: 'Bulk import failed: ' + err.message });
    }
});

// ==========================================
// 5. AUDIT LOGS
// ==========================================

// GET /api/admin/audit-logs - View audit logs with filters
router.get('/audit-logs', async (req, res) => {
    try {
        const { action, role, search, limit = 50, offset = 0 } = req.query;
        let sql = `SELECT * FROM audit_logs WHERE 1=1`;
        const params = [];

        if (action) {
            sql += ` AND action = ?`;
            params.push(action);
        }
        if (role) {
            sql += ` AND user_role = ?`;
            params.push(role);
        }
        if (search) {
            sql += ` AND (LOWER(user_name) LIKE LOWER(?) OR LOWER(details) LIKE LOWER(?) OR LOWER(action) LIKE LOWER(?))`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const logs = await db.all(sql, params);
        const totalCountRes = await db.get('SELECT COUNT(*) as count FROM audit_logs');

        return res.json({
            logs,
            total: totalCountRes ? totalCountRes.count : 0
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch audit logs.' });
    }
});

module.exports = router;
