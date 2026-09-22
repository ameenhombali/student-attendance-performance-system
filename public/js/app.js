/* Main Single Page Application Router & Global Event Manager */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let notifPollInterval = null;

async function initApp() {
    const token = getToken();
    const user = getUser();

    // Close modal listeners
    const modal = document.getElementById('app-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
    }
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    if (!token || !user) {
        renderLoginView();
        return;
    }

    // Refresh user details from /api/auth/me to maintain session validity & fresh data
    try {
        const meData = await apiFetch('/auth/me');
        if (meData && meData.user) {
            localStorage.setItem('college_user_info', JSON.stringify(meData.user));
        }
    } catch (err) {
        clearSession();
        renderLoginView();
        return;
    }

    const currentUser = getUser() || user;

    // User is logged in -> render shell layout
    renderShellLayout(currentUser);

    // Initial Route dispatch
    handleRoute();

    // Listen to hash changes
    window.addEventListener('hashchange', handleRoute);

    // Start notification polling if user is student
    if (currentUser.role === 'student') {
        pollStudentNotifications();
        notifPollInterval = setInterval(pollStudentNotifications, 10000);
    }
}

function renderLoginView() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="login-container">
            <div class="login-card">
                <div class="login-header">
                    <div class="logo-icon">🎓</div>
                    <h1>Smart College Management</h1>
                    <p>Attendance & Academic Performance System</p>
                </div>

                <div class="role-tabs">
                    <button class="role-tab active" data-role="student">👨‍🎓 Student Login</button>
                    <button class="role-tab" data-role="faculty">👨‍🏫 Faculty Login</button>
                </div>

                <form id="login-form">
                    <div class="form-group">
                        <label id="login-identifier-label">USN / Student Username</label>
                        <input type="text" id="usernameOrId" class="form-control" placeholder="e.g. 3CS001 or ameen" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="password" class="form-control" placeholder="••••••••" required>
                    </div>

                    <button type="submit" class="btn-primary">Sign In →</button>
                </form>

                <div style="text-align:center; margin-top:16px;">
                    <button id="forgot-password-btn" style="background:none; border:none; color:var(--text-secondary); font-size:0.82rem; cursor:pointer; text-decoration:underline;">
                        Forgot Password?
                    </button>
                </div>

                <!-- 1-Click Demo Login Box -->
                <div class="demo-credentials-box">
                    <h4>⚡ Quick Demo Logins</h4>
                    <p style="color:var(--text-muted); font-size:0.75rem;">Click to test immediate real-world workflow:</p>
                    
                    <div class="demo-btn-group" style="flex-wrap:wrap;">
                        <button class="btn-demo" onclick="quickDemoLogin('3CS001', 'student')">👨‍🎓 Ameen (3CS001)</button>
                        <button class="btn-demo" onclick="quickDemoLogin('3CS002', 'student')">👨‍🎓 Rahul (3CS002)</button>
                        <button class="btn-demo" onclick="quickDemoLogin('3CS003', 'student')">🔴 Ali (3CS003)</button>
                        <button class="btn-demo" onclick="quickDemoLogin('sharma', 'faculty')">👨‍🏫 Faculty (Dr. Sharma)</button>
                        <button class="btn-demo" onclick="resetDemoData()" style="color:var(--status-yellow); border-color:rgba(245, 158, 11, 0.4);">🔄 Reset Demo Data</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    initAuthView();
}

function renderShellLayout(user) {
    const app = document.getElementById('app');

    const isStudent = user.role === 'student';

    const sidebarMenu = isStudent ? `
        <div class="sidebar-menu-title">Student Portal</div>
        <li class="sidebar-item"><a href="#student-dashboard" class="sidebar-link" id="nav-student-dashboard">📊 Dashboard</a></li>
        <li class="sidebar-item"><a href="#student-history" class="sidebar-link" id="nav-student-history">📜 Attendance History</a></li>
        <li class="sidebar-item"><a href="#student-subject-wise" class="sidebar-link" id="nav-student-subject-wise">📚 Subject-Wise</a></li>
        <li class="sidebar-item"><a href="#student-marks" class="sidebar-link" id="nav-student-marks">🏆 Test Marks & Analytics</a></li>
    ` : `
        <div class="sidebar-menu-title">Faculty Portal</div>
        <li class="sidebar-item"><a href="#faculty-dashboard" class="sidebar-link" id="nav-faculty-dashboard">📊 Dashboard</a></li>
        <li class="sidebar-item"><a href="#faculty-mark-attendance" class="sidebar-link" id="nav-faculty-mark-attendance">📋 Mark Attendance</a></li>
        <li class="sidebar-item"><a href="#faculty-history" class="sidebar-link" id="nav-faculty-history">📜 Submitted History</a></li>
        <li class="sidebar-item"><a href="#faculty-marks" class="sidebar-link" id="nav-faculty-marks">✏️ Manage Student Marks</a></li>
    `;

    app.innerHTML = `
        <div class="app-container">
            <!-- Sidebar -->
            <aside class="sidebar">
                <div class="sidebar-header">
                    <div class="logo-badge">🎓</div>
                    <div>
                        <h2>Smart Campus</h2>
                        <div style="font-size:0.72rem; color:var(--text-muted);">${isStudent ? 'Student Portal' : 'Faculty Portal'}</div>
                    </div>
                </div>

                <ul class="sidebar-menu">
                    ${sidebarMenu}
                </ul>

                <div class="sidebar-footer">
                    <div class="user-profile-summary">
                        <div class="user-avatar">${user.full_name.charAt(0)}</div>
                        <div class="user-info-text">
                            <h4>${user.full_name}</h4>
                            <p>${isStudent ? 'USN: ' + (user.usn || '') : user.designation || 'Faculty'}</p>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- Main Section -->
            <div class="main-wrapper">
                <!-- Topbar -->
                <header class="topbar">
                    <div class="topbar-title">
                        <h3 id="topbar-heading">Dashboard</h3>
                    </div>

                    <div class="topbar-actions">
                        ${isStudent ? `
                            <div class="notification-bell-container">
                                <button class="bell-btn" id="bell-btn" onclick="toggleNotificationDropdown()">
                                    🔔
                                    <span class="bell-badge hidden" id="bell-badge">0</span>
                                </button>
                                <div class="notification-dropdown" id="notification-dropdown">
                                    <div class="notif-header">
                                        <h4>Notifications</h4>
                                        <button class="mark-all-read-btn" onclick="markAllNotificationsRead()">Mark all as read</button>
                                    </div>
                                    <div class="notif-list" id="notif-dropdown-list">
                                        <div style="padding:15px; text-align:center; color:var(--text-muted);">No notifications yet.</div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <button class="btn-logout" onclick="logoutUser()">Logout 🚪</button>
                    </div>
                </header>

                <!-- Dynamic Page Container -->
                <main class="page-content" id="view-container">
                    <!-- Views injected here -->
                </main>
            </div>
        </div>
    `;
}

function handleRoute() {
    const user = getUser();
    if (!user) return;

    let hash = window.location.hash || (user.role === 'student' ? '#student-dashboard' : '#faculty-dashboard');

    // Remove active state from all nav links
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));

    const activeNav = document.getElementById(`nav-${hash.replace('#', '')}`);
    if (activeNav) activeNav.classList.add('active');

    const topbarHeading = document.getElementById('topbar-heading');

    if (user.role === 'student') {
        if (hash === '#student-dashboard') {
            topbarHeading.textContent = 'Student Dashboard';
            renderStudentDashboard();
        } else if (hash === '#student-history') {
            topbarHeading.textContent = 'Attendance History';
            renderStudentHistory();
        } else if (hash === '#student-subject-wise') {
            topbarHeading.textContent = 'Subject-Wise Attendance';
            renderStudentSubjectWise();
        } else if (hash === '#student-marks') {
            topbarHeading.textContent = 'Academic Performance & Test Scores';
            renderStudentMarks();
        } else {
            window.location.hash = '#student-dashboard';
        }
    } else if (user.role === 'faculty') {
        if (hash === '#faculty-dashboard') {
            topbarHeading.textContent = 'Faculty Dashboard';
            renderFacultyDashboard();
        } else if (hash === '#faculty-mark-attendance') {
            topbarHeading.textContent = 'Mark Class Attendance';
            renderFacultyMarkAttendance();
        } else if (hash === '#faculty-history') {
            topbarHeading.textContent = 'Submitted Attendance History';
            renderFacultyHistory();
        } else if (hash === '#faculty-marks') {
            topbarHeading.textContent = 'Manage Student Academic Marks';
            renderFacultyMarks();
        } else {
            window.location.hash = '#faculty-dashboard';
        }
    }
}

// Notification Dropdown Toggle & Sync
function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

let lastUnreadCount = 0;

async function pollStudentNotifications() {
    const user = getUser();
    if (!user || user.role !== 'student') return;

    try {
        const data = await apiFetch('/student/notifications');
        const { unread_count, notifications } = data;

        const badge = document.getElementById('bell-badge');
        if (badge) {
            if (unread_count > 0) {
                badge.textContent = unread_count;
                badge.classList.remove('hidden');

                // Trigger toast notification if new alert came in
                if (unread_count > lastUnreadCount && notifications.length > 0) {
                    const latest = notifications[0];
                    showToast(latest.message, latest.type === 'present_alert' ? 'success' : 'error');
                }
            } else {
                badge.classList.add('hidden');
            }
        }
        lastUnreadCount = unread_count;

        const listContainer = document.getElementById('notif-dropdown-list');
        if (listContainer) {
            if (notifications.length === 0) {
                listContainer.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-muted);">No notifications yet.</div>`;
            } else {
                listContainer.innerHTML = notifications.map(n => `
                    <div class="notif-item ${n.is_read === 0 ? 'unread' : ''}" onclick="markSingleNotificationRead(${n.id})">
                        <div class="notif-title">${n.title}</div>
                        <div class="notif-msg">${n.message}</div>
                        <div class="notif-time">${formatDate(n.created_at)}</div>
                    </div>
                `).join('');
            }
        }
    } catch (e) {}
}

async function markSingleNotificationRead(id) {
    try {
        await apiFetch(`/student/notifications/${id}/read`, { method: 'PUT' });
        pollStudentNotifications();
    } catch (e) {}
}

async function markAllNotificationsRead() {
    try {
        await apiFetch('/student/notifications/read-all', { method: 'PUT' });
        pollStudentNotifications();
    } catch (e) {}
}

function logoutUser() {
    if (notifPollInterval) clearInterval(notifPollInterval);
    clearSession();
    window.location.hash = '';
    window.location.reload();
}
