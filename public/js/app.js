/* Main Single Page Application Router & Global Event Manager */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let notifPollInterval = null;

async function initApp() {
    // Check if public ID verification route is requested
    const currentHash = window.location.hash || '';
    if (currentHash.startsWith('#verify-id')) {
        const urlParams = new URLSearchParams(currentHash.split('?')[1]);
        const usn = urlParams.get('usn');
        if (usn) {
            renderVerifyIdPublicView(usn);
            return;
        }
    }

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
                    <button class="role-tab" data-role="admin">🛡️ Admin Login</button>
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
                        <button class="btn-demo" onclick="quickDemoLogin('admin', 'admin')">🛡️ Administrator</button>
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

    let portalLabel = 'Student Portal';
    let sidebarMenu = '';

    if (user.role === 'student') {
        portalLabel = 'Student Portal';
        sidebarMenu = `
            <div class="sidebar-menu-title">Student Portal</div>
            <li class="sidebar-item"><a href="#student-dashboard" class="sidebar-link" id="nav-student-dashboard">📊 Dashboard</a></li>
            <li class="sidebar-item"><a href="#student-id-card" class="sidebar-link" id="nav-student-id-card">🪪 Digital ID Card</a></li>
            <li class="sidebar-item"><a href="#student-history" class="sidebar-link" id="nav-student-history">📜 Attendance History</a></li>
            <li class="sidebar-item"><a href="#student-corrections" class="sidebar-link" id="nav-student-corrections">📝 Correction Requests</a></li>
            <li class="sidebar-item"><a href="#student-subject-wise" class="sidebar-link" id="nav-student-subject-wise">📚 Subject-Wise</a></li>
            <li class="sidebar-item"><a href="#notices" class="sidebar-link" id="nav-notices">📢 Notice Board</a></li>
            <li class="sidebar-item"><a href="#study-materials" class="sidebar-link" id="nav-study-materials">📖 Study Materials</a></li>
            <li class="sidebar-item"><a href="#student-marks" class="sidebar-link" id="nav-student-marks">🏆 Test Marks & Analytics</a></li>
        `;
    } else if (user.role === 'faculty') {
        portalLabel = 'Faculty Portal';
        sidebarMenu = `
            <div class="sidebar-menu-title">Faculty Portal</div>
            <li class="sidebar-item"><a href="#faculty-dashboard" class="sidebar-link" id="nav-faculty-dashboard">📊 Dashboard</a></li>
            <li class="sidebar-item"><a href="#faculty-mark-attendance" class="sidebar-link" id="nav-faculty-mark-attendance">📋 Mark Attendance</a></li>
            <li class="sidebar-item"><a href="#faculty-history" class="sidebar-link" id="nav-faculty-history">📜 Submitted History</a></li>
            <li class="sidebar-item"><a href="#faculty-corrections" class="sidebar-link" id="nav-faculty-corrections">📝 Correction Requests</a></li>
            <li class="sidebar-item"><a href="#faculty-marks" class="sidebar-link" id="nav-faculty-marks">✏️ Manage Student Marks</a></li>
            <li class="sidebar-item"><a href="#study-materials" class="sidebar-link" id="nav-study-materials">📖 Study Materials</a></li>
            <li class="sidebar-item"><a href="#notices" class="sidebar-link" id="nav-notices">📢 Notice Board</a></li>
        `;
    } else if (user.role === 'admin') {
        portalLabel = 'Admin Portal';
        sidebarMenu = `
            <div class="sidebar-menu-title">Admin Portal</div>
            <li class="sidebar-item"><a href="#admin-dashboard" class="sidebar-link" id="nav-admin-dashboard">📊 Dashboard</a></li>
            <li class="sidebar-item"><a href="#admin-students" class="sidebar-link" id="nav-admin-students">👨‍🎓 Manage Students</a></li>
            <li class="sidebar-item"><a href="#admin-faculty" class="sidebar-link" id="nav-admin-faculty">👨‍🏫 Manage Faculty</a></li>
            <li class="sidebar-item"><a href="#admin-academics" class="sidebar-link" id="nav-admin-academics">🏛️ Academic Setup</a></li>
            <li class="sidebar-item"><a href="#admin-bulk-import" class="sidebar-link" id="nav-admin-bulk-import">📥 Bulk Excel Import</a></li>
            <li class="sidebar-item"><a href="#admin-id-cards" class="sidebar-link" id="nav-admin-id-cards">🪪 Digital ID Cards</a></li>
            <li class="sidebar-item"><a href="#notices" class="sidebar-link" id="nav-notices">📢 Notice Board</a></li>
            <li class="sidebar-item"><a href="#study-materials" class="sidebar-link" id="nav-study-materials">📖 Study Materials</a></li>
            <li class="sidebar-item"><a href="#admin-audit-logs" class="sidebar-link" id="nav-admin-audit-logs">🛡️ Audit Logs</a></li>
        `;
    }

    app.innerHTML = `
        <div class="app-container">
            <!-- Sidebar -->
            <aside class="sidebar">
                <div class="sidebar-header">
                    <div class="logo-badge">🎓</div>
                    <div>
                        <h2>Smart Campus</h2>
                        <div style="font-size:0.72rem; color:var(--text-muted);">${portalLabel}</div>
                    </div>
                </div>

                <ul class="sidebar-menu">
                    ${sidebarMenu}
                </ul>

                <div class="sidebar-footer">
                    <div class="user-profile-summary">
                        <div class="user-avatar">${user.full_name ? user.full_name.charAt(0) : 'U'}</div>
                        <div class="user-info-text">
                            <h4>${escapeHtml(user.full_name || user.username)}</h4>
                            <p>${user.role === 'student' ? 'USN: ' + (user.usn || '') : (user.role === 'admin' ? 'Administrator' : user.designation || 'Faculty')}</p>
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
                        ${user.role === 'student' ? `
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

    let hash = window.location.hash || (
        user.role === 'student' ? '#student-dashboard' : (user.role === 'admin' ? '#admin-dashboard' : '#faculty-dashboard')
    );

    // Public QR verification check
    if (hash.startsWith('#verify-id')) {
        const urlParams = new URLSearchParams(hash.split('?')[1]);
        const usn = urlParams.get('usn');
        if (usn) {
            renderVerifyIdPublicView(usn);
            return;
        }
    }

    // Remove active state from all nav links
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));

    const navId = `nav-${hash.replace('#', '')}`;
    const activeNav = document.getElementById(navId);
    if (activeNav) activeNav.classList.add('active');

    const topbarHeading = document.getElementById('topbar-heading');

    // Common routes (Notices & Study Materials accessible from all 3 portals)
    if (hash === '#notices') {
        topbarHeading.textContent = 'College Notice Board';
        renderNoticesView();
        return;
    } else if (hash === '#study-materials') {
        topbarHeading.textContent = 'Study Materials & Course Documents';
        renderMaterialsView();
        return;
    }

    // Role-specific routing
    if (user.role === 'student') {
        if (hash === '#student-dashboard') {
            topbarHeading.textContent = 'Student Dashboard';
            renderStudentDashboard();
        } else if (hash === '#student-id-card') {
            topbarHeading.textContent = 'Digital Student ID Card';
            renderStudentIdCard();
        } else if (hash === '#student-history') {
            topbarHeading.textContent = 'Attendance History';
            renderStudentHistory();
        } else if (hash === '#student-corrections') {
            topbarHeading.textContent = 'Attendance Correction Requests';
            renderStudentCorrections();
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
        } else if (hash === '#faculty-corrections') {
            topbarHeading.textContent = 'Attendance Correction Requests';
            renderFacultyCorrections();
        } else if (hash === '#faculty-marks') {
            topbarHeading.textContent = 'Manage Student Academic Marks';
            renderFacultyMarks();
        } else {
            window.location.hash = '#faculty-dashboard';
        }
    } else if (user.role === 'admin') {
        if (hash === '#admin-dashboard') {
            topbarHeading.textContent = 'Administrator Control Center';
            renderAdminDashboard();
        } else if (hash === '#admin-students') {
            topbarHeading.textContent = 'Student Accounts Directory';
            renderAdminStudents();
        } else if (hash === '#admin-faculty') {
            topbarHeading.textContent = 'Faculty Accounts Directory';
            renderAdminFaculty();
        } else if (hash === '#admin-academics') {
            topbarHeading.textContent = 'Academic Setup & Curriculum';
            renderAdminAcademics();
        } else if (hash === '#admin-bulk-import') {
            topbarHeading.textContent = 'Bulk Student Import (Excel)';
            renderAdminBulkImport();
        } else if (hash === '#admin-id-cards') {
            topbarHeading.textContent = 'Digital Student ID Cards';
            renderAdminIdCards();
        } else if (hash === '#admin-audit-logs') {
            topbarHeading.textContent = 'System Audit Logs';
            renderAdminAuditLogs();
        } else {
            window.location.hash = '#admin-dashboard';
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
                        <div class="notif-title">${escapeHtml(n.title)}</div>
                        <div class="notif-msg">${escapeHtml(n.message)}</div>
                        <div class="notif-time">${formatDate(n.created_at)}</div>
                    </div>
                `).join('');
            }
        }
    } catch (e) {}
}

async function markSingleNotificationRead(id) {
    try {
        await apiFetch(`/student/notifications/${id}/read`, { method: 'POST' });
        pollStudentNotifications();
    } catch (e) {}
}

async function markAllNotificationsRead() {
    try {
        await apiFetch('/student/notifications/read-all', { method: 'POST' });
        pollStudentNotifications();
    } catch (e) {}
}

async function logoutUser() {
    if (notifPollInterval) clearInterval(notifPollInterval);
    try {
        await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {}
    clearSession();
    window.location.hash = '';
    window.location.reload();
}

async function resetDemoData() {
    if (!confirm('Are you sure you want to reset the database to clean demo data?')) return;
    try {
        showToast('Resetting demo database...', 'info');
        await apiFetch('/settings/reset-demo', { method: 'POST' });
        showToast('Database reset successfully! Reloading...', 'success');
        clearSession();
        setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
        showToast(e.message, 'error');
    }
}
