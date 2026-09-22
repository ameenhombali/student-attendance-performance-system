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

        // Read and execute schema
        const schemaPath = path.resolve(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await db.exec(schemaSql);
        console.log('✅ Database schema verified.');

        // Check if users already exist to prevent re-seeding if data exists
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        if (!forceReset && userCount && userCount.count > 0) {
            console.log('ℹ️ Database already seeded with users. Skipping seed.');
            return;
        }

        const facultyPasswordHash = await bcrypt.hash('password123', 10);
        const studentPasswordHash = await bcrypt.hash('student123', 10);

        // 1. Seed Settings
        await db.run("INSERT INTO settings (key, value) VALUES ('min_attendance_threshold', '75')");

        // 2. Seed Departments
        const cseDept = await db.run("INSERT INTO departments (code, name) VALUES ('CSE', 'Computer Science & Engineering')");
        const eceDept = await db.run("INSERT INTO departments (code, name) VALUES ('ECE', 'Electronics & Communication Engineering')");
        const cseId = cseDept.id;

        // 3. Seed Faculty
        const facultyData = [
            { name: 'Dr. Sharma', email: 'sharma@college.edu', username: 'sharma', fid: 'F101', desig: 'Professor' },
            { name: 'Prof. Verma', email: 'verma@college.edu', username: 'verma', fid: 'F102', desig: 'Associate Professor' },
            { name: 'Dr. Rao', email: 'rao@college.edu', username: 'rao', fid: 'F103', desig: 'Assistant Professor' }
        ];

        const facultyMap = {}; // name -> faculty table id

        for (const f of facultyData) {
            const userRes = await db.run(
                "INSERT INTO users (username, password_hash, role, full_name, email) VALUES (?, ?, 'faculty', ?, ?)",
                [f.username, facultyPasswordHash, f.name, f.email]
            );
            const facRes = await db.run(
                "INSERT INTO faculty (user_id, faculty_id, department_id, designation) VALUES (?, ?, ?, ?)",
                [userRes.id, f.fid, cseId, f.desig]
            );
            facultyMap[f.name] = facRes.id;
        }

        // 4. Seed Subjects
        const subjectData = [
            { code: 'CS501', name: 'Python Programming', sem: 5, facultyName: 'Dr. Sharma' },
            { code: 'CS502', name: 'Database Management Systems', sem: 5, facultyName: 'Prof. Verma' },
            { code: 'CS503', name: 'Operating Systems', sem: 5, facultyName: 'Dr. Rao' },
            { code: 'CS504', name: 'Computer Networks', sem: 5, facultyName: 'Dr. Sharma' },
            { code: 'CS505', name: 'Software Engineering', sem: 5, facultyName: 'Prof. Verma' }
        ];

        const subjectMap = {}; // code -> subject table id

        for (const sub of subjectData) {
            const facId = facultyMap[sub.facultyName];
            const subRes = await db.run(
                "INSERT INTO subjects (code, name, department_id, semester, faculty_id) VALUES (?, ?, ?, ?, ?)",
                [sub.code, sub.name, cseId, sub.sem, facId]
            );
            subjectMap[sub.code] = subRes.id;
        }

        // 5. Seed Students
        const studentList = [
            { name: 'Ameen Hombali', usn: '3CS001', username: '3CS001', altUsername: 'ameen', email: 'ameen@student.college.edu' },
            { name: 'Rahul Kumar', usn: '3CS002', username: '3CS002', altUsername: 'rahul', email: 'rahul@student.college.edu' },
            { name: 'Ali Ahmed', usn: '3CS003', username: '3CS003', altUsername: 'ali', email: 'ali@student.college.edu' },
            { name: 'Ahmed Khan', usn: '3CS004', username: '3CS004', altUsername: 'ahmed', email: 'ahmed@student.college.edu' },
            { name: 'Priya Sharma', usn: '3CS005', username: '3CS005', altUsername: 'priya', email: 'priya@student.college.edu' },
            { name: 'Sneha Patil', usn: '3CS006', username: '3CS006', altUsername: 'sneha', email: 'sneha@student.college.edu' },
            { name: 'Vikram Singh', usn: '3CS007', username: '3CS007', altUsername: 'vikram', email: 'vikram@student.college.edu' },
            { name: 'Ananya Roy', usn: '3CS008', username: '3CS008', altUsername: 'ananya', email: 'ananya@student.college.edu' },
            { name: 'Rohan Deshmukh', usn: '3CS009', username: '3CS009', altUsername: 'rohan', email: 'rohan@student.college.edu' },
            { name: 'Fatima Zohra', usn: '3CS010', username: '3CS010', altUsername: 'fatima', email: 'fatima@student.college.edu' }
        ];

        const studentDbList = []; // Array of student db records

        for (const s of studentList) {
            const uRes = await db.run(
                "INSERT INTO users (username, password_hash, role, full_name, email) VALUES (?, ?, 'student', ?, ?)",
                [s.username, studentPasswordHash, s.name, s.email]
            );
            const sRes = await db.run(
                "INSERT INTO students (user_id, usn, department_id, semester, section) VALUES (?, ?, ?, 5, 'A')",
                [uRes.id, s.usn, cseId]
            );
            studentDbList.push({ id: sRes.id, name: s.name, usn: s.usn });
        }

        // 6. Seed Attendance Records (Historical past dates)
        console.log('🌱 Seeding historical attendance logs...');

        const dates = [
            '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14',
            '2026-09-15', '2026-09-16', '2026-09-17'
        ];

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
                const facId = facultyMap[subObj.facultyName];
                const period = periodMap[subCode];

                for (const stu of studentDbList) {
                    let status = 'Present';
                    if (stu.usn === '3CS003') { // Ali (Low Attendance ~65%)
                        status = (Math.random() < 0.65) ? 'Present' : 'Absent';
                    } else if (stu.usn === '3CS002') { // Rahul (~78%)
                        status = (Math.random() < 0.78) ? 'Present' : 'Absent';
                    } else if (stu.usn === '3CS001') { // Ameen (~92%)
                        status = (Math.random() < 0.92) ? 'Present' : 'Absent';
                    } else {
                        status = (Math.random() < 0.88) ? 'Present' : 'Absent';
                    }

                    const attRes = await db.run(
                        "INSERT INTO attendance (student_id, subject_id, faculty_id, date, class_period, status) VALUES (?, ?, ?, ?, ?, ?)",
                        [stu.id, subId, facId, dateStr, period, status]
                    );

                    // Create recent notifications for the last 2 dates
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

        // 7. Seed Marks
        console.log('🌱 Seeding student academic performance marks...');
        for (const stu of studentDbList) {
            for (const subCode of Object.keys(subjectMap)) {
                const subId = subjectMap[subCode];

                let ia1 = Math.floor(Math.random() * 6) + 19; // 19-24 out of 25
                let ia2 = Math.floor(Math.random() * 6) + 19; // 19-24 out of 25
                let assign = Math.floor(Math.random() * 3) + 8; // 8-10 out of 10
                let lab = Math.floor(Math.random() * 4) + 16;  // 16-20 out of 20
                let project = Math.floor(Math.random() * 4) + 16; // 16-20 out of 20
                let finalExam = Math.floor(Math.random() * 20) + 75; // 75-95 out of 100

                if (stu.usn === '3CS003') { // Ali slightly lower
                    ia1 = Math.floor(Math.random() * 6) + 14;
                    ia2 = Math.floor(Math.random() * 6) + 15;
                    assign = 7;
                    lab = 14;
                    project = 14;
                    finalExam = 65;
                }

                await db.run(
                    `INSERT INTO marks (student_id, subject_id, internal_1, internal_2, assignment, lab, project, final_exam)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [stu.id, subId, ia1, ia2, assign, lab, project, finalExam]
                );
            }
        }

        console.log('✅ Seeding completed successfully!');
        console.log('--- Demo Accounts Ready ---');
        console.log('Student Accounts: 3CS001 / student123 (Ameen Hombali), 3CS002 / student123 (Rahul Kumar), 3CS003 / student123 (Ali Ahmed)');
        console.log('Faculty Accounts: sharma / password123 (F101), verma / password123 (F102)');

    } catch (err) {
        console.error('❌ Error seeding database:', err);
    }
}

if (require.main === module) {
    seedDatabase().then(() => process.exit(0));
}

module.exports = seedDatabase;
