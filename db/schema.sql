-- Smart Student Attendance & Academic Performance Management System
-- SQLite Schema Definition

PRAGMA foreign_keys = ON;

-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

-- Users Table (Authentication & Core Profiles)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student', 'faculty', 'admin')),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Students Table
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

-- Faculty Table
CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    faculty_id TEXT UNIQUE NOT NULL,
    department_id INTEGER NOT NULL,
    designation TEXT DEFAULT 'Assistant Professor',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- Subjects Table
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

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    faculty_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    class_period TEXT NOT NULL, -- e.g. "10:00 AM - 11:00 AM"
    status TEXT NOT NULL CHECK(status IN ('Present', 'Absent')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (faculty_id) REFERENCES faculty(id),
    UNIQUE(student_id, subject_id, date, class_period)
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'present_alert', 'absent_alert', 'warning', 'notice', 'correction'
    is_read INTEGER DEFAULT 0, -- 0 for unread, 1 for read
    attendance_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE
);

-- Marks Table (Academic Performance)
CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    internal_1 REAL DEFAULT 0, -- Max 25
    internal_2 REAL DEFAULT 0, -- Max 25
    assignment REAL DEFAULT 0, -- Max 10
    lab REAL DEFAULT 0,       -- Max 20
    project REAL DEFAULT 0,   -- Max 20
    final_exam REAL DEFAULT 0, -- Max 100
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    UNIQUE(student_id, subject_id)
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL
);

-- Notices Table
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

-- Notice Reads (Tracking Read/Unread Status per User)
CREATE TABLE IF NOT EXISTS notice_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notice_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(notice_id, user_id)
);

-- Study Materials Table
CREATE TABLE IF NOT EXISTS study_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    subject_id INTEGER NOT NULL,
    department_id INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    section TEXT DEFAULT NULL, -- NULL means visible to all sections
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

-- Attendance Correction Requests Table
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

-- Audit Logs Table
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
