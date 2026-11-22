const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./database');

async function seedDatabase(forceReset = false) {
    try {
        console.log('--- Starting Database Initialization & Seeding ---');

        if (forceReset) {
            console.log('🧹 Force reset requested. Dropping existing tables...');
            await db.exec(`
                PRAGMA foreign_keys = OFF;
                DROP TABLE IF EXISTS audit_logs;
                DROP TABLE IF EXISTS attendance_corrections;
                DROP TABLE IF EXISTS study_materials;
                DROP TABLE IF EXISTS notice_reads;
                DROP TABLE IF EXISTS notices;
                DROP TABLE IF EXISTS notifications;
                DROP TABLE IF EXISTS attendance;
                DROP TABLE IF EXISTS marks;
                DROP TABLE IF EXISTS subjects;
                DROP TABLE IF EXISTS students;
                DROP TABLE IF EXISTS faculty;
                DROP TABLE IF EXISTS users;
                DROP TABLE IF EXISTS departments;
                DROP TABLE IF EXISTS settings;
                PRAGMA foreign_keys = ON;
            `);
        }

        // Read and execute schema (with embedded fallback for serverless environments)
        let schemaSql = null;
        try {
            const schemaCandidates = [
                path.resolve(__dirname, 'schema.sql'),
                path.resolve(__dirname, '../db/schema.sql'),
                path.resolve(process.cwd(), 'db/schema.sql')
            ];
            for (const cand of schemaCandidates) {
                if (fs.existsSync(cand)) {
                    schemaSql = fs.readFileSync(cand, 'utf8');
                    break;
                }
            }
        } catch (e) {
            console.warn('Could not read schema.sql from disk, using embedded schema fallback.');
        }

        if (!schemaSql) {
            schemaSql = `
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS departments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('student', 'faculty', 'admin')),
                    full_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS students (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE NOT NULL,
                    usn TEXT UNIQUE NOT NULL,
                    department_id INTEGER NOT NULL,
                    semester INTEGER NOT NULL,
                    section TEXT NOT NULL,
                    photo_url TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (department_id) REFERENCES departments(id)
                );

                CREATE TABLE IF NOT EXISTS faculty (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE NOT NULL,
                    faculty_id TEXT UNIQUE NOT NULL,
                    department_id INTEGER NOT NULL,
                    designation TEXT DEFAULT 'Assistant Professor',
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (department_id) REFERENCES departments(id)
                );

                CREATE TABLE IF NOT EXISTS subjects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    department_id INTEGER NOT NULL,
                    semester INTEGER NOT NULL,
                    faculty_id INTEGER NOT NULL,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
                );

                CREATE TABLE IF NOT EXISTS attendance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    subject_id INTEGER NOT NULL,
                    faculty_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    class_period TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('Present', 'Absent')),
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id),
                    FOREIGN KEY (faculty_id) REFERENCES faculty(id),
                    UNIQUE(student_id, subject_id, date, class_period)
                );

                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    type TEXT NOT NULL,
                    is_read INTEGER DEFAULT 0,
                    attendance_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                    FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS marks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    subject_id INTEGER NOT NULL,
                    internal_1 REAL DEFAULT 0,
                    internal_2 REAL DEFAULT 0,
                    assignment REAL DEFAULT 0,
                    lab REAL DEFAULT 0,
                    project REAL DEFAULT 0,
                    final_exam REAL DEFAULT 0,
                    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id),
                    UNIQUE(student_id, subject_id)
                );

                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS notices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    category TEXT NOT NULL CHECK(category IN ('Academic', 'Examination', 'Events', 'Holidays', 'General')),
                    is_important INTEGER DEFAULT 0,
                    attachment_name TEXT,
                    attachment_data TEXT,
                    published_by INTEGER NOT NULL,
                    published_role TEXT NOT NULL,
                    publish_date TEXT NOT NULL,
                    expiry_date TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS notice_reads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    notice_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(notice_id, user_id)
                );

                CREATE TABLE IF NOT EXISTS study_materials (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    subject_id INTEGER NOT NULL,
                    department_id INTEGER NOT NULL,
                    semester INTEGER NOT NULL,
                    section TEXT DEFAULT NULL,
                    faculty_id INTEGER NOT NULL,
                    file_name TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    file_size INTEGER DEFAULT 0,
                    file_data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
                    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS attendance_corrections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    attendance_id INTEGER NOT NULL,
                    subject_id INTEGER NOT NULL,
                    faculty_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    class_period TEXT NOT NULL,
                    current_status TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    attachment_name TEXT,
                    attachment_data TEXT,
                    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected')),
                    faculty_remarks TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    reviewed_at DATETIME,
                    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                    FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id),
                    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
                );

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    user_name TEXT NOT NULL,
                    user_role TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details TEXT,
                    record_id INTEGER,
                    ip_address TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `;
        }

        await db.exec(schemaSql);
        console.log('✅ Database schema verified.');

        // Safe column addition for existing databases
        try {
            await db.run('ALTER TABLE students ADD COLUMN photo_url TEXT');
        } catch (e) {
            // Column already exists, safe to ignore
        }
        // Add section column to study_materials (for per-section targeting)
        try {
            await db.run('ALTER TABLE study_materials ADD COLUMN section TEXT DEFAULT NULL');
        } catch (e) {
            // Column already exists, safe to ignore
        }

        // Ensure Settings exist
        const defaultSettings = [
            ['min_attendance_threshold', '75'],
            ['college_name', 'National Institute of Engineering & Technology'],
            ['college_code', 'NIET-560001'],
            ['academic_year', '2026-2027']
        ];
        for (const [k, v] of defaultSettings) {
            const exists = await db.get('SELECT key FROM settings WHERE key = ?', [k]);
            if (!exists) {
                await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [k, v]);
            }
        }

        // Ensure Admin user exists
        const existingAdmin = await db.get("SELECT id FROM users WHERE role = 'admin'");
        let adminUserId = existingAdmin ? existingAdmin.id : null;
        if (!existingAdmin) {
            const adminPasswordHash = await bcrypt.hash('admin123', 10);
            const adminRes = await db.run(
                "INSERT INTO users (username, password_hash, role, full_name, email) VALUES (?, ?, 'admin', ?, ?)",
                ['admin', adminPasswordHash, 'System Administrator', 'admin@college.edu']
            );
            adminUserId = adminRes.id;
            console.log('🛡️ Default Admin account created (admin / admin123)');
        }

        // Check if users already exist to prevent re-seeding faculty and students if data exists
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        const cseDeptRow = await db.get("SELECT id FROM departments WHERE code = 'CSE'");
        let cseId = cseDeptRow ? cseDeptRow.id : null;

        if (forceReset || !cseId || (userCount && userCount.count <= 1)) {
            const facultyPasswordHash = await bcrypt.hash('password123', 10);
            const studentPasswordHash = await bcrypt.hash('student123', 10);

            // Seed Departments if not present
            if (!cseId) {
                const cseDept = await db.run("INSERT INTO departments (code, name) VALUES ('CSE', 'Computer Science & Engineering')");
                await db.run("INSERT INTO departments (code, name) VALUES ('ECE', 'Electronics & Communication Engineering')");
                cseId = cseDept.id;
            }

            // Seed Faculty
            const facultyData = [
                { name: 'Dr. Sharma', email: 'sharma@college.edu', username: 'sharma', fid: 'F101', desig: 'Professor' },
                { name: 'Prof. Verma', email: 'verma@college.edu', username: 'verma', fid: 'F102', desig: 'Associate Professor' },
                { name: 'Dr. Rao', email: 'rao@college.edu', username: 'rao', fid: 'F103', desig: 'Assistant Professor' }
            ];

            const facultyMap = {};
            for (const f of facultyData) {
                const existingF = await db.get('SELECT id FROM users WHERE username = ?', [f.username]);
                let uid = existingF ? existingF.id : null;
                if (!existingF) {
                    const userRes = await db.run(
                        "INSERT INTO users (username, password_hash, role, full_name, email) VALUES (?, ?, 'faculty', ?, ?)",
                        [f.username, facultyPasswordHash, f.name, f.email]
                    );
                    uid = userRes.id;
                    const facRes = await db.run(
                        "INSERT INTO faculty (user_id, faculty_id, department_id, designation) VALUES (?, ?, ?, ?)",
                        [uid, f.fid, cseId, f.desig]
                    );
                    facultyMap[f.name] = facRes.id;
                } else {
                    const fac = await db.get('SELECT id FROM faculty WHERE user_id = ?', [uid]);
                    if (fac) facultyMap[f.name] = fac.id;
                }
            }

            // Seed Subjects
            const subjectData = [
                { code: 'CS501', name: 'Python Programming', sem: 5, facultyName: 'Dr. Sharma' },
                { code: 'CS502', name: 'Database Management Systems', sem: 5, facultyName: 'Prof. Verma' },
                { code: 'CS503', name: 'Operating Systems', sem: 5, facultyName: 'Dr. Rao' },
                { code: 'CS504', name: 'Computer Networks', sem: 5, facultyName: 'Dr. Sharma' },
                { code: 'CS505', name: 'Software Engineering', sem: 5, facultyName: 'Prof. Verma' }
            ];

            const subjectMap = {};
            for (const sub of subjectData) {
                const facId = facultyMap[sub.facultyName] || 1;
                const existingSub = await db.get('SELECT id FROM subjects WHERE code = ?', [sub.code]);
                if (!existingSub) {
                    const subRes = await db.run(
                        "INSERT INTO subjects (code, name, department_id, semester, faculty_id) VALUES (?, ?, ?, ?, ?)",
                        [sub.code, sub.name, cseId, sub.sem, facId]
                    );
                    subjectMap[sub.code] = subRes.id;
                } else {
                    subjectMap[sub.code] = existingSub.id;
                }
            }

            // Seed Students
            const studentList = [
                { name: 'Ameen Hombali', usn: '3CS001', username: '3CS001', email: 'ameen@student.college.edu' },
                { name: 'Rahul Kumar', usn: '3CS002', username: '3CS002', email: 'rahul@student.college.edu' },
                { name: 'Ali Ahmed', usn: '3CS003', username: '3CS003', email: 'ali@student.college.edu' },
                { name: 'Ahmed Khan', usn: '3CS004', username: '3CS004', email: 'ahmed@student.college.edu' },
                { name: 'Priya Sharma', usn: '3CS005', username: '3CS005', email: 'priya@student.college.edu' },
                { name: 'Sneha Patil', usn: '3CS006', username: '3CS006', email: 'sneha@student.college.edu' },
                { name: 'Vikram Singh', usn: '3CS007', username: '3CS007', email: 'vikram@student.college.edu' },
                { name: 'Ananya Roy', usn: '3CS008', username: '3CS008', email: 'ananya@student.college.edu' },
                { name: 'Rohan Deshmukh', usn: '3CS009', username: '3CS009', email: 'rohan@student.college.edu' },
                { name: 'Fatima Zohra', usn: '3CS010', username: '3CS010', email: 'fatima@student.college.edu' }
            ];

            const studentDbList = [];
            for (const s of studentList) {
                const existingU = await db.get('SELECT id FROM users WHERE username = ?', [s.username]);
                let uid = existingU ? existingU.id : null;
                if (!existingU) {
                    const uRes = await db.run(
                        "INSERT INTO users (username, password_hash, role, full_name, email) VALUES (?, ?, 'student', ?, ?)",
                        [s.username, studentPasswordHash, s.name, s.email]
                    );
                    uid = uRes.id;
                    const sRes = await db.run(
                        "INSERT INTO students (user_id, usn, department_id, semester, section) VALUES (?, ?, ?, 5, 'A')",
                        [uid, s.usn, cseId]
                    );
                    studentDbList.push({ id: sRes.id, name: s.name, usn: s.usn });
                } else {
                    const stu = await db.get('SELECT id FROM students WHERE user_id = ?', [uid]);
                    if (stu) studentDbList.push({ id: stu.id, name: s.name, usn: s.usn });
                }
            }

            // Seed Historical Attendance
            const attCount = await db.get('SELECT COUNT(*) as count FROM attendance');
            if (!attCount || attCount.count === 0) {
                console.log('🌱 Seeding historical attendance logs...');
                const dates = ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'];
                const periodMap = {
                    'CS501': '10:00 AM - 11:00 AM',
                    'CS502': '11:15 AM - 12:15 PM',
                    'CS503': '01:15 PM - 02:15 PM',
                    'CS504': '02:15 PM - 03:15 PM',
                    'CS505': '03:30 PM - 04:30 PM'
                };

                for (const dateStr of dates) {
                    for (const subCode of Object.keys(subjectMap)) {
                        const subId = subjectMap[subCode];
                        const subObj = subjectData.find(s => s.code === subCode);
                        const facId = facultyMap[subObj.facultyName] || 1;
                        const period = periodMap[subCode];

                        for (const stu of studentDbList) {
                            let status = (Math.random() < 0.88) ? 'Present' : 'Absent';
                            if (stu.usn === '3CS001') status = (Math.random() < 0.95) ? 'Present' : 'Absent';
                            if (stu.usn === '3CS003') status = (Math.random() < 0.65) ? 'Present' : 'Absent';

                            const attRes = await db.run(
                                "INSERT INTO attendance (student_id, subject_id, faculty_id, date, class_period, status) VALUES (?, ?, ?, ?, ?, ?)",
                                [stu.id, subId, facId, dateStr, period, status]
                            );

                            if (dateStr >= '2026-09-16') {
                                const isPres = (status === 'Present');
                                const icon = isPres ? '✅' : '❌';
                                const title = isPres ? 'Attendance Marked' : 'Attendance Alert';
                                const type = isPres ? 'present_alert' : 'absent_alert';
                                const msg = `${icon} ${title}: You were marked ${status} for ${subObj.name} class on ${dateStr} at ${period.split(' - ')[0]}.`;
                                await db.run(
                                    "INSERT INTO notifications (student_id, title, message, type, is_read, attendance_id) VALUES (?, ?, ?, ?, 0, ?)",
                                    [stu.id, title, msg, type, attRes.id]
                                );
                            }
                        }
                    }
                }
            }

            // Seed Marks
            const marksCount = await db.get('SELECT COUNT(*) as count FROM marks');
            if (!marksCount || marksCount.count === 0) {
                console.log('🌱 Seeding student academic performance marks...');
                for (const stu of studentDbList) {
                    for (const subCode of Object.keys(subjectMap)) {
                        const subId = subjectMap[subCode];
                        await db.run(
                            `INSERT INTO marks (student_id, subject_id, internal_1, internal_2, assignment, lab, project, final_exam)
                             VALUES (?, ?, 21, 22, 9, 18, 18, 85)`,
                            [stu.id, subId]
                        );
                    }
                }
            }
        }

        // Seed Sample Notices if table is empty
        const noticeCount = await db.get('SELECT COUNT(*) as count FROM notices');
        if (!noticeCount || noticeCount.count === 0) {
            console.log('📢 Seeding sample college notices...');
            const sampleNotices = [
                {
                    title: 'Mid-Term Examinations Schedule Announced',
                    description: 'The Semester 5 Internal Assessment II examinations will commence from December 1st, 2026. All students must maintain a minimum of 75% attendance to be eligible to sit for exams. Timetable and hall ticket details are available in the department office.',
                    category: 'Examination',
                    is_important: 1,
                    publish_date: '2026-11-10',
                    expiry_date: '2026-12-15'
                },
                {
                    title: 'Campus Hackathon 2026: Innovate & Build',
                    description: 'Department of Computer Science is hosting the annual 36-hour Hackathon on November 28-29, 2026. Teams of 2 to 4 students from CSE and ECE can register. Cash prizes worth ₹50,000 to be won! Registration closes November 22nd.',
                    category: 'Events',
                    is_important: 1,
                    publish_date: '2026-11-12',
                    expiry_date: '2026-11-29'
                },
                {
                    title: 'Winter Break & College Holiday Circular',
                    description: 'The college will observe a gazetted holiday on November 25th on account of Founders Day. Regular academic classes and lab sessions will resume on November 26th at 09:00 AM.',
                    category: 'Holidays',
                    is_important: 0,
                    publish_date: '2026-11-05',
                    expiry_date: '2026-11-26'
                },
                {
                    title: 'Submission of Final Year Project Proposals',
                    description: 'All 5th semester students are hereby instructed to submit their preliminary major project problem statements and guide allotment forms to their respective project coordinators by end of this week.',
                    category: 'Academic',
                    is_important: 0,
                    publish_date: '2026-11-08',
                    expiry_date: '2026-12-05'
                }
            ];

            const adminUser = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
            const pubId = adminUser ? adminUser.id : 1;

            for (const n of sampleNotices) {
                await db.run(
                    `INSERT INTO notices (title, description, category, is_important, published_by, published_role, publish_date, expiry_date)
                     VALUES (?, ?, ?, ?, ?, 'admin', ?, ?)`,
                    [n.title, n.description, n.category, n.is_important, pubId, n.publish_date, n.expiry_date]
                );
            }
        }

        // Seed Sample Study Materials if table is empty
        const matCount = await db.get('SELECT COUNT(*) as count FROM study_materials');
        if (!matCount || matCount.count === 0) {
            console.log('📚 Seeding sample study materials...');
            const cseDept = await db.get("SELECT id FROM departments WHERE code = 'CSE'");
            const depId = cseDept ? cseDept.id : 1;
            const subCS501 = await db.get("SELECT id, faculty_id FROM subjects WHERE code = 'CS501'");
            const subCS502 = await db.get("SELECT id, faculty_id FROM subjects WHERE code = 'CS502'");

            if (subCS501) {
                await db.run(
                    `INSERT INTO study_materials (title, description, subject_id, department_id, semester, faculty_id, file_name, file_type, file_size, file_data)
                     VALUES (?, ?, ?, ?, 5, ?, ?, 'PDF', 142850, ?)`,
                    [
                        'Module 1 & 2: Python Advanced Data Structures & OOP',
                        'Comprehensive lecture notes covering Generators, Decorators, Metaclasses, and Object-Oriented Design in Python 3.12.',
                        subCS501.id,
                        depId,
                        subCS501.faculty_id,
                        'Python_Unit1_Unit2_Notes.pdf',
                        'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg== (sample document placeholder)'
                    ]
                );
            }

            if (subCS502) {
                await db.run(
                    `INSERT INTO study_materials (title, description, subject_id, department_id, semester, faculty_id, file_name, file_type, file_size, file_data)
                     VALUES (?, ?, ?, ?, 5, ?, ?, 'PPTX', 289400, ?)`,
                    [
                        'DBMS Transaction Management & Concurrency Control',
                        'Slide deck detailing ACID properties, serializability, two-phase locking protocols, and deadlock recovery strategies.',
                        subCS502.id,
                        depId,
                        subCS502.faculty_id,
                        'DBMS_Concurrency_Control.pptx',
                        'data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,UEsDBBQAAAAIA= (sample presentation placeholder)'
                    ]
                );
            }
        }

        // Seed Sample Attendance Correction Request if table is empty
        const corrCount = await db.get('SELECT COUNT(*) as count FROM attendance_corrections');
        if (!corrCount || corrCount.count === 0) {
            console.log('📝 Seeding sample attendance correction request...');
            const sampleAbsent = await db.get(`
                SELECT a.id, a.student_id, a.subject_id, a.faculty_id, a.date, a.class_period
                FROM attendance a
                WHERE a.status = 'Absent'
                LIMIT 1
            `);
            if (sampleAbsent) {
                await db.run(
                    `INSERT INTO attendance_corrections 
                     (student_id, attendance_id, subject_id, faculty_id, date, class_period, current_status, reason, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'Absent', 'Was representing college in State Level Coding Competition; duty leave form signed by HOD attached.', 'Pending')`,
                    [sampleAbsent.student_id, sampleAbsent.id, sampleAbsent.subject_id, sampleAbsent.faculty_id, sampleAbsent.date, sampleAbsent.class_period]
                );
            }
        }

        // Seed Initial Audit Logs if table is empty
        const auditCount = await db.get('SELECT COUNT(*) as count FROM audit_logs');
        if (!auditCount || auditCount.count === 0) {
            const adminUser = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
            const aid = adminUser ? adminUser.id : 1;
            await db.run(
                `INSERT INTO audit_logs (user_id, user_name, user_role, action, details, ip_address)
                 VALUES (?, 'System Administrator', 'admin', 'SYSTEM_INITIALIZATION', 'System tables and college configuration initialized successfully.', '127.0.0.1')`,
                [aid]
            );
        }

        console.log('✅ Seeding completed successfully!');
        console.log('--- Ready Accounts ---');
        console.log('Student Accounts: 3CS001 / student123 (Ameen Hombali), 3CS002 / student123 (Rahul Kumar)');
        console.log('Faculty Accounts: sharma / password123 (F101), verma / password123 (F102)');
        console.log('Admin Account:   admin / admin123 (System Administrator)');

    } catch (err) {
        console.error('❌ Error seeding database:', err);
        throw err;
    }
}

if (require.main === module) {
    seedDatabase().then(() => process.exit(0));
}

module.exports = seedDatabase;
