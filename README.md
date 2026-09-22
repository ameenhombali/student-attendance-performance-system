# Smart Student Attendance & Academic Performance Management System

A full-stack, production-ready college web application built with **Node.js**, **Express**, **SQLite**, and modern **ES6 JavaScript/CSS3**, featuring **Chart.js** performance visualization.

---

## 🌟 Key Features

### 1. 👨‍🎓 Student Portal
- **Student Dashboard**: Real-time summary displaying Name, USN, Department, Semester, Section, Overall Attendance %, Total Classes, Present, and Absent counts.
- **Dynamic Attendance Status**: Visual status indicators (🟢 **Green** >= 85%, 🟡 **Yellow** 75-84%, 🔴 **Red** < 75%) dynamically calculated from database queries.
- **Low Attendance Alert Banner**: Automatically flags attendance dropped below the college configurable threshold (default: `75%`).
- **Real-Time Notifications**:
  - Bell icon badge with unread counter.
  - Automatic notification generation whenever faculty marks attendance:
    - *Present*: `"✅ Attendance Marked: You were marked Present for [Subject] class on [Date] at [Time]."`
    - *Absent*: `"❌ Attendance Alert: You were marked Absent for [Subject] class on [Date] at [Time]."`
  - Dropdown log with options to mark individual or all notifications as read.
- **Attendance History**: Interactive table listing Date, Time, Subject, Faculty, and Status. Supports multi-field filtering by Subject, Date, Status (Present/Absent), and instant search.
- **Subject-Wise Breakdown**: Visual progress bars and cards for every enrolled subject. Clicking any subject opens an in-depth modal log of all sessions for that subject.
- **Academic Performance & Analytics**: Internal 1, Internal 2, Assignment, Lab, Project, and Final Exam mark breakdown with integrated **Chart.js** graphical score visualizers.

---

### 2. 👨‍🏫 Faculty Portal
- **Faculty Dashboard**: Overview showing handled subjects, total student count, and recent submitted class attendance sessions.
- **Mark Class Attendance**:
  - Select Department, Semester, Section, Subject, Date, and Class Period.
  - Roster list with interactive **Present / Absent** toggle switches for each student.
  - Shortcut actions: `[ Mark All Present ]`, `[ Mark All Absent ]`, and `[ Reset ]`.
- **Strict Duplicate Submission Prevention**:
  - Backend database composite check on `(subject_id, date, class_period, section)`.
  - Prevents accidental double submissions, warning faculty and disabling re-submission for the same period.
- **Faculty Attendance History**: View past class logs with student presence breakdown modals.
- **Student Marks Management**: Interface to enter and update internal exam scores, assignments, lab work, project scores, and final exam marks.

---

## 🔑 Demo Credentials (1-Click Login Ready)

The system automatically initializes and seeds realistic demo data on first launch:

| Role | Username / USN | Password | Details |
| :--- | :--- | :--- | :--- |
| **Student (Normal)** | `ameen` or `101` | `password123` | High Attendance (~90%), 5 subjects |
| **Student (Low Attn Alert)** | `ali` or `103` | `password123` | Low Attendance (~65%), triggers 🔴 Alert Banner |
| **Student** | `rahul` or `102` | `password123` | Medium Attendance (~78%), 🟡 Warning |
| **Faculty** | `sharma` or `F101` | `password123` | Handles Python Programming & Computer Networks |
| **Faculty** | `verma` or `F102` | `password123` | Handles Database Management Systems & Software Engg |
| **Faculty** | `rao` or `F103` | `password123` | Handles Operating Systems |

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (File-based database `database.sqlite` with automatic DDL schema & seeding engine)
- **Frontend**: HTML5, CSS3 (Modern design system, glassmorphism, responsive CSS grid/flexbox), Vanilla JavaScript (SPA architecture)
- **Data Visualization**: Chart.js (Interactive bar/radar charts)
- **Security**: bcryptjs password hashing, JWT session token management, Role-Based Access Control (RBAC) middleware

---

## 🚀 Quick Setup & Running Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Application**:
   ```bash
   npm start
   ```

3. **Access in Browser**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 📂 Project Folder Structure

```text
├── package.json
├── server.js                     # Express server & static file host
├── database.sqlite               # Auto-created SQLite database file
├── db/
│   ├── database.js               # SQLite connection helper & promise wrappers
│   ├── schema.sql                # Table definitions & DDL schema
│   └── seed.js                   # Seeder script for demo users, attendance & marks
├── middleware/
│   └── auth.js                   # JWT authentication & RBAC authorization
├── routes/
│   ├── auth.js                   # Login, session validation, forgot password
│   ├── student.js                # Student dashboard, history, subject breakdown, notifications, marks
│   ├── faculty.js                # Faculty dashboard, attendance submission, history, marks entry
│   └── settings.js               # Configurable attendance threshold settings
└── public/
    ├── index.html                # Main SPA page container
    ├── css/
    │   ├── main.css              # Core design system & theme variables
    │   ├── dashboard.css         # Cards, widgets, stat grids
    │   └── tables.css            # Data tables, toolbar, search inputs
    └── js/
        ├── utils.js              # Token management, fetch API wrapper, toasts
        ├── auth.js               # Login form logic & 1-click demo handlers
        ├── student.js            # Student portal controllers & Chart.js renderer
        ├── faculty.js            # Faculty portal controllers & attendance toggles
        └── app.js                # SPA router, topbar shell, notification sync
```

---

## 🔄 Core Attendance Submission Workflow

```text
Faculty Logs In
     ↓
Selects Subject, Date, & Class Period
     ↓
Toggles Student Present/Absent Roster
     ↓
Clicks Submit Attendance
     ↓
Backend performs Duplicate Check (Blocks if already submitted)
     ↓
Saves records to ATTENDANCE table in SQLite DB
     ↓
Generates individual NOTIFICATIONS for each student ("✅ Attendance Marked" / "❌ Attendance Alert")
     ↓
Recalculates Student Subject-Wise & Overall Attendance Percentages
     ↓
Updates Student Dashboard, Attendance History, & Notification Bell Badge in real-time
```
