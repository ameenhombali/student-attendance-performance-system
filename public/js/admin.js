/* ==========================================================
   Admin Portal Module
   ========================================================== */

// ----------------------------------------------------------
// 1. ADMIN DASHBOARD
// ----------------------------------------------------------
async function renderAdminDashboard() {
    const container = document.getElementById('view-container');
    container.innerHTML = `<div style="text-align:center; padding:50px; color:var(--text-muted);">Loading admin control center...</div>`;

    try {
        const data = await apiFetch('/admin/dashboard');
        const s = data.stats;

        container.innerHTML = `
            <div class="page-header" style="margin-bottom:24px;">
                <h2>🛡️ Administrator Control Center</h2>
                <p style="color:var(--text-muted); font-size:0.88rem;">Campus-wide attendance monitoring, academic records, and system administration.</p>
            </div>

            <!-- Stats Overview Cards -->
            <div class="stats-overview-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:28px;">
                <div class="stat-card" style="border-left:4px solid #6366f1;">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Total Enrolled Students</div>
                    <div style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin:6px 0;">${s.total_students}</div>
                    <div style="font-size:0.78rem; color:#818cf8;"><a href="#admin-students" style="color:inherit; text-decoration:none;">Manage Students →</a></div>
                </div>

                <div class="stat-card" style="border-left:4px solid #10b981;">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Faculty Members</div>
                    <div style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin:6px 0;">${s.total_faculty}</div>
                    <div style="font-size:0.78rem; color:#34d399;"><a href="#admin-faculty" style="color:inherit; text-decoration:none;">View Faculty Roster →</a></div>
                </div>

                <div class="stat-card" style="border-left:4px solid #06b6d4;">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Overall Attendance Rate</div>
                    <div style="font-size:1.8rem; font-weight:800; color:${s.overall_attendance_pct >= s.min_threshold ? '#10b981' : '#ef4444'}; margin:6px 0;">
                        ${s.overall_attendance_pct}%
                    </div>
                    <div style="font-size:0.78rem; color:var(--text-muted);">Threshold: ${s.min_threshold}%</div>
                </div>

                <div class="stat-card" style="border-left:4px solid #f59e0b;">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Low Attendance Flagged</div>
                    <div style="font-size:1.8rem; font-weight:800; color:#f59e0b; margin:6px 0;">${s.low_attendance_students}</div>
                    <div style="font-size:0.78rem; color:var(--text-muted);">Students under ${s.min_threshold}%</div>
                </div>

                <div class="stat-card" style="border-left:4px solid #a855f7;">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Departments / Subjects</div>
                    <div style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin:6px 0;">${s.total_departments} / ${s.total_subjects}</div>
                    <div style="font-size:0.78rem; color:#c084fc;"><a href="#admin-academics" style="color:inherit; text-decoration:none;">Academic Structure →</a></div>
                </div>

                <div class="stat-card" style="border-left:4px solid #ec4899;">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Active Notices / Materials</div>
                    <div style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin:6px 0;">${s.total_notices} / ${s.total_materials}</div>
                    <div style="font-size:0.78rem; color:#f472b6;"><a href="#notices" style="color:inherit; text-decoration:none;">Campus Feed →</a></div>
                </div>
            </div>

            <!-- Quick Action Shortcuts -->
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:28px;">
                <button class="btn-primary" onclick="window.location.hash='#admin-bulk-import'">📥 Bulk Import Students (Excel)</button>
                <button class="btn-demo" onclick="window.location.hash='#admin-students'">👨‍🎓 Add / Manage Students</button>
                <button class="btn-demo" onclick="openCreateNoticeModal()">📢 Publish Notice</button>
                <button class="btn-demo" onclick="window.location.hash='#admin-audit-logs'">🛡️ View Audit Logs</button>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
                <!-- Recent Audit Logs -->
                <div class="dashboard-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="font-size:1.05rem; margin:0;">🛡️ Recent Audit Logs</h3>
                        <a href="#admin-audit-logs" style="font-size:0.8rem; color:var(--primary-color);">View All →</a>
                    </div>
                    <div style="font-size:0.85rem;">
                        ${(data.recent_audit || []).map(a => `
                            <div style="padding:10px 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <span class="audit-action-tag">${escapeHtml(a.action)}</span>
                                    <span style="margin-left:6px; color:var(--text-secondary); font-size:0.8rem;">${escapeHtml(a.user_name)}</span>
                                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(a.details)}</div>
                                </div>
                                <div style="font-size:0.72rem; color:var(--text-muted); white-space:nowrap;">${formatDate(a.created_at)}</div>
                            </div>
                        `).join('') || '<div style="color:var(--text-muted); text-align:center; padding:20px;">No recent audit logs.</div>'}
                    </div>
                </div>

                <!-- Active Notices -->
                <div class="dashboard-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="font-size:1.05rem; margin:0;">📢 Active Notices</h3>
                        <a href="#notices" style="font-size:0.8rem; color:var(--primary-color);">Notice Board →</a>
                    </div>
                    <div style="font-size:0.85rem;">
                        ${(data.recent_notices || []).map(n => `
                            <div style="padding:10px 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <span class="notice-badge badge-${n.category}">${n.category}</span>
                                    <strong style="margin-left:6px; color:var(--text-primary);">${escapeHtml(n.title)}</strong>
                                </div>
                                <div style="font-size:0.72rem; color:var(--text-muted); white-space:nowrap;">${formatDate(n.publish_date)}</div>
                            </div>
                        `).join('') || '<div style="color:var(--text-muted); text-align:center; padding:20px;">No active notices.</div>'}
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

// ----------------------------------------------------------
// 2. MANAGE STUDENTS
// ----------------------------------------------------------
let adminStudentSearch = '';
let adminStudentDept = '';

async function renderAdminStudents() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
            <div>
                <h2>👨‍🎓 Student Accounts Management</h2>
                <p style="color:var(--text-muted); font-size:0.88rem;">Create, update, view Digital ID cards, and manage enrolled college students.</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-demo" onclick="window.location.hash='#admin-bulk-import'">📥 Bulk Excel Import</button>
                <button class="btn-primary" onclick="openAddStudentModal()">➕ Add Student</button>
            </div>
        </div>

        <div class="notices-filter-bar" style="margin-bottom:20px;">
            <div style="display:flex; gap:12px; align-items:center;">
                <select id="admin-stu-dept-filter" class="form-control" onchange="filterAdminStudentsByDept(this.value)" style="min-width:180px;">
                    <option value="">All Departments</option>
                </select>
            </div>

            <div style="position:relative; min-width:280px;">
                <input type="text" class="form-control" placeholder="Search by USN, name, or email..." 
                       value="${adminStudentSearch}" oninput="searchAdminStudents(this.value)" style="padding-left:36px;">
                <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);">🔍</span>
            </div>
        </div>

        <div id="admin-students-table-container">
            <div style="text-align:center; padding:40px; color:var(--text-muted);">Loading students list...</div>
        </div>
    `;

    populateAdminDeptsDropdown();
    loadAdminStudents();
}

async function populateAdminDeptsDropdown() {
    try {
        const data = await apiFetch('/admin/departments');
        const sel = document.getElementById('admin-stu-dept-filter');
        if (sel) {
            sel.innerHTML = `<option value="">All Departments</option>` +
                data.departments.map(d => `<option value="${d.id}">${escapeHtml(d.code)} - ${escapeHtml(d.name)}</option>`).join('');
        }
    } catch (e) {}
}

function filterAdminStudentsByDept(val) {
    adminStudentDept = val;
    loadAdminStudents();
}

let adminStuSearchTimeout = null;
function searchAdminStudents(val) {
    adminStudentSearch = val.trim();
    clearTimeout(adminStuSearchTimeout);
    adminStuSearchTimeout = setTimeout(() => {
        loadAdminStudents();
    }, 300);
}

async function loadAdminStudents() {
    const container = document.getElementById('admin-students-table-container');
    if (!container) return;

    try {
        let endpoint = `/admin/students?`;
        if (adminStudentDept) endpoint += `&department_id=${encodeURIComponent(adminStudentDept)}`;
        if (adminStudentSearch) endpoint += `&search=${encodeURIComponent(adminStudentSearch)}`;

        const data = await apiFetch(endpoint);
        const students = data.students || [];

        if (students.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">No student accounts found.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>USN</th>
                            <th>Student Name</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>Sem / Sec</th>
                            <th>Attendance</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(s => {
                            const pct = s.attendance_pct !== null ? `${s.attendance_pct}%` : 'N/A';
                            const isLow = s.attendance_pct !== null && s.attendance_pct < 75;
                            return `
                                <tr>
                                    <td><strong style="color:#818cf8;">${escapeHtml(s.usn)}</strong></td>
                                    <td>
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <div class="user-avatar" style="width:28px; height:28px; font-size:0.75rem;">
                                                ${s.photo_url ? `<img src="${s.photo_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : s.full_name.charAt(0)}
                                            </div>
                                            <span>${escapeHtml(s.full_name)}</span>
                                        </div>
                                    </td>
                                    <td style="color:var(--text-muted); font-size:0.82rem;">${escapeHtml(s.email)}</td>
                                    <td>${escapeHtml(s.department_code)}</td>
                                    <td>Sem ${s.semester} (${s.section})</td>
                                    <td>
                                        <span class="status-pill ${isLow ? 'status-Rejected' : 'status-Approved'}">
                                            ${pct}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="display:flex; gap:6px;">
                                            <button class="btn-demo" onclick="openStudentIdCardModal('${s.usn}')" style="padding:4px 8px; font-size:0.75rem;" title="View Digital ID Card">🪪 ID Card</button>
                                            <button onclick="deleteStudentAccount(${s.student_id}, '${escapeHtml(s.usn)}')" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Delete Student">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

async function openAddStudentModal() {
    const modal = document.getElementById('app-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '👨‍🎓 Register New Student Account';

    // Fetch departments
    let depts = [];
    try {
        const d = await apiFetch('/admin/departments');
        depts = d.departments || [];
    } catch (e) {}

    body.innerHTML = `
        <form id="add-student-form" onsubmit="submitNewStudent(event)">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                    <label>USN (University Seat Number) *</label>
                    <input type="text" id="new-stu-usn" class="form-control" placeholder="e.g. 3CS011" required>
                </div>
                <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="new-stu-name" class="form-control" placeholder="e.g. John Doe" required>
                </div>
            </div>

            <div class="form-group">
                <label>Email Address *</label>
                <input type="email" id="new-stu-email" class="form-control" placeholder="e.g. john@student.college.edu" required>
            </div>

            <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:12px;">
                <div class="form-group">
                    <label>Department *</label>
                    <select id="new-stu-dept" class="form-control" required>
                        <option value="">Select Department</option>
                        ${depts.map(d => `<option value="${d.id}">${escapeHtml(d.code)} - ${escapeHtml(d.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Semester *</label>
                    <input type="number" id="new-stu-sem" class="form-control" min="1" max="8" value="5" required>
                </div>
                <div class="form-group">
                    <label>Section *</label>
                    <input type="text" id="new-stu-sec" class="form-control" value="A" maxlength="2" required>
                </div>
            </div>

            <div class="form-group">
                <label>Password (Default: student123)</label>
                <input type="password" id="new-stu-pass" class="form-control" placeholder="student123">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button type="button" class="btn-demo" onclick="document.getElementById('app-modal').classList.remove('active')">Cancel</button>
                <button type="submit" class="btn-primary">Register Student →</button>
            </div>
        </form>
    `;

    modal.classList.add('active');
}

async function submitNewStudent(e) {
    e.preventDefault();
    const usn = document.getElementById('new-stu-usn').value.trim();
    const full_name = document.getElementById('new-stu-name').value.trim();
    const email = document.getElementById('new-stu-email').value.trim();
    const department_id = document.getElementById('new-stu-dept').value;
    const semester = parseInt(document.getElementById('new-stu-sem').value, 10);
    const section = document.getElementById('new-stu-sec').value.trim();
    const password = document.getElementById('new-stu-pass').value || 'student123';

    try {
        await apiFetch('/admin/students', {
            method: 'POST',
            body: JSON.stringify({ usn, full_name, email, department_id, semester, section, password })
        });
        showToast('Student registered successfully!', 'success');
        document.getElementById('app-modal').classList.remove('active');
        loadAdminStudents();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteStudentAccount(id, usn) {
    if (!confirm(`Are you sure you want to permanently delete student account ${usn}? All associated attendance logs and marks will be removed.`)) return;
    try {
        await apiFetch(`/admin/students/${id}`, { method: 'DELETE' });
        showToast(`Student ${usn} deleted successfully.`, 'success');
        loadAdminStudents();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ----------------------------------------------------------
// 3. MANAGE FACULTY
// ----------------------------------------------------------
async function renderAdminFaculty() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
            <div>
                <h2>👨‍🏫 Faculty Accounts Management</h2>
                <p style="color:var(--text-muted); font-size:0.88rem;">Manage teaching faculty, designations, department assignments, and subject handling.</p>
            </div>
            <button class="btn-primary" onclick="openAddFacultyModal()">➕ Add Faculty</button>
        </div>

        <div id="admin-faculty-table-container">
            <div style="text-align:center; padding:40px; color:var(--text-muted);">Loading faculty list...</div>
        </div>
    `;

    loadAdminFaculty();
}

async function loadAdminFaculty() {
    const container = document.getElementById('admin-faculty-table-container');
    try {
        const data = await apiFetch('/admin/faculty');
        const list = data.faculty || [];

        container.innerHTML = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Faculty ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>Designation</th>
                            <th>Subjects Handled</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(f => `
                            <tr>
                                <td><strong style="color:#10b981;">${escapeHtml(f.fid_code)}</strong></td>
                                <td><strong>${escapeHtml(f.full_name)}</strong></td>
                                <td style="color:var(--text-muted); font-size:0.82rem;">${escapeHtml(f.email)}</td>
                                <td>${escapeHtml(f.department_code)}</td>
                                <td>${escapeHtml(f.designation)}</td>
                                <td><span style="background:rgba(99,102,241,0.15); color:#818cf8; padding:3px 8px; border-radius:10px; font-size:0.75rem;">${f.subjects_count} Subject(s)</span></td>
                                <td>
                                    <button onclick="deleteFacultyAccount(${f.faculty_id}, '${escapeHtml(f.full_name)}')" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Delete Faculty">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

async function openAddFacultyModal() {
    const modal = document.getElementById('app-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '👨‍🏫 Add New Faculty Member';

    let depts = [];
    try {
        const d = await apiFetch('/admin/departments');
        depts = d.departments || [];
    } catch (e) {}

    body.innerHTML = `
        <form id="add-faculty-form" onsubmit="submitNewFaculty(event)">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                    <label>Faculty ID *</label>
                    <input type="text" id="new-fac-id" class="form-control" placeholder="e.g. F104" required>
                </div>
                <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="new-fac-name" class="form-control" placeholder="e.g. Dr. Ramesh Gupta" required>
                </div>
            </div>

            <div class="form-group">
                <label>Email Address *</label>
                <input type="email" id="new-fac-email" class="form-control" placeholder="e.g. ramesh@college.edu" required>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                    <label>Department *</label>
                    <select id="new-fac-dept" class="form-control" required>
                        <option value="">Select Department</option>
                        ${depts.map(d => `<option value="${d.id}">${escapeHtml(d.code)} - ${escapeHtml(d.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Designation</label>
                    <select id="new-fac-desig" class="form-control">
                        <option value="Assistant Professor">Assistant Professor</option>
                        <option value="Associate Professor">Associate Professor</option>
                        <option value="Professor">Professor</option>
                        <option value="Head of Department">Head of Department</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>Password (Default: password123)</label>
                <input type="password" id="new-fac-pass" class="form-control" placeholder="password123">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button type="button" class="btn-demo" onclick="document.getElementById('app-modal').classList.remove('active')">Cancel</button>
                <button type="submit" class="btn-primary">Register Faculty →</button>
            </div>
        </form>
    `;

    modal.classList.add('active');
}

async function submitNewFaculty(e) {
    e.preventDefault();
    const faculty_id = document.getElementById('new-fac-id').value.trim();
    const full_name = document.getElementById('new-fac-name').value.trim();
    const email = document.getElementById('new-fac-email').value.trim();
    const department_id = document.getElementById('new-fac-dept').value;
    const designation = document.getElementById('new-fac-desig').value;
    const password = document.getElementById('new-fac-pass').value || 'password123';

    try {
        await apiFetch('/admin/faculty', {
            method: 'POST',
            body: JSON.stringify({ faculty_id, full_name, email, department_id, designation, password })
        });
        showToast('Faculty member registered successfully!', 'success');
        document.getElementById('app-modal').classList.remove('active');
        loadAdminFaculty();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteFacultyAccount(id, name) {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    try {
        await apiFetch(`/admin/faculty/${id}`, { method: 'DELETE' });
        showToast('Faculty account deleted.', 'success');
        loadAdminFaculty();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ----------------------------------------------------------
// 4. BULK STUDENT IMPORT VIA EXCEL
// ----------------------------------------------------------
let parsedExcelRows = [];

async function renderAdminBulkImport() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="page-header" style="margin-bottom:20px;">
            <h2>📥 Bulk Student Import (Excel)</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Import hundreds of students in seconds with automatic USN, email, and department validation.</p>
        </div>

        <div style="display:flex; gap:14px; margin-bottom:24px; flex-wrap:wrap;">
            <a href="/api/admin/students/excel-template" class="btn-demo" download="student_import_template.xlsx" style="text-decoration:none; display:inline-flex; align-items:center; gap:8px;">
                <span>📥</span> Download Excel Template (.xlsx)
            </a>
        </div>

        <!-- Upload Zone -->
        <div class="dropzone" id="excel-dropzone" onclick="document.getElementById('excel-file-input').click()">
            <input type="file" id="excel-file-input" accept=".xlsx,.xls" style="display:none;" onchange="handleExcelFileSelect(event)">
            <div style="font-size:3rem; margin-bottom:10px;">📊</div>
            <h3 style="margin-bottom:6px;">Upload Student Excel Spreadsheet</h3>
            <p style="color:var(--text-muted); font-size:0.85rem; max-width:400px; margin:0 auto;">
                Click to browse or drop your .xlsx or .xls file here.
            </p>
        </div>

        <div id="bulk-preview-section" style="margin-top:24px;"></div>
    `;
}

async function handleExcelFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const previewSection = document.getElementById('bulk-preview-section');
    previewSection.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Analyzing spreadsheet and validating rows...</div>`;

    try {
        const file_data = await fileToBase64(file);
        const data = await apiFetch('/admin/students/import-preview', {
            method: 'POST',
            body: JSON.stringify({ file_data })
        });

        parsedExcelRows = data.rows || [];

        previewSection.innerHTML = `
            <div class="preview-summary-boxes">
                <div class="summary-stat-card">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Total Rows</div>
                    <div style="font-size:1.6rem; font-weight:800; color:var(--text-primary);">${data.total_rows}</div>
                </div>
                <div class="summary-stat-card valid">
                    <div style="font-size:0.75rem; color:#10b981; text-transform:uppercase;">Valid Records</div>
                    <div style="font-size:1.6rem; font-weight:800; color:#10b981;">${data.valid_count}</div>
                </div>
                <div class="summary-stat-card invalid">
                    <div style="font-size:0.75rem; color:#ef4444; text-transform:uppercase;">Invalid / Duplicate</div>
                    <div style="font-size:1.6rem; font-weight:800; color:#ef4444;">${data.invalid_count}</div>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <h4>Spreadsheet Validation Preview</h4>
                ${data.valid_count > 0 ? `
                    <button class="btn-primary" onclick="confirmBulkImport()">
                        Confirm & Import ${data.valid_count} Valid Student(s) →
                    </button>
                ` : `<span style="color:#ef4444; font-size:0.85rem;">No valid rows to import. Please fix errors and re-upload.</span>`}
            </div>

            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Row #</th>
                            <th>Status</th>
                            <th>USN</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Dept</th>
                            <th>Sem</th>
                            <th>Sec</th>
                            <th>Validation Errors</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${parsedExcelRows.map(r => `
                            <tr style="${!r.is_valid ? 'background:rgba(239,68,68,0.06);' : ''}">
                                <td>${r.row_number}</td>
                                <td>
                                    ${r.is_valid ? `<span class="status-pill status-Approved">✓ Ready</span>` : `<span class="status-pill status-Rejected">✕ Error</span>`}
                                </td>
                                <td><strong>${escapeHtml(r.usn || '-')}</strong></td>
                                <td>${escapeHtml(r.full_name || '-')}</td>
                                <td style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(r.email || '-')}</td>
                                <td>${escapeHtml(r.department_code || '-')}</td>
                                <td>${r.semester || '-'}</td>
                                <td>${escapeHtml(r.section || '-')}</td>
                                <td style="color:#ef4444; font-size:0.78rem;">
                                    ${r.errors ? r.errors.join('; ') : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        previewSection.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

async function confirmBulkImport() {
    if (!parsedExcelRows || parsedExcelRows.length === 0) return;
    try {
        showToast('Importing student accounts...', 'info');
        const res = await apiFetch('/admin/students/import-confirm', {
            method: 'POST',
            body: JSON.stringify({ rows: parsedExcelRows })
        });

        showToast(res.message, 'success');
        document.getElementById('bulk-preview-section').innerHTML = `
            <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:12px; padding:30px; text-align:center;">
                <div style="font-size:3rem; margin-bottom:10px;">🎉</div>
                <h3>Import Completed!</h3>
                <p style="color:var(--text-secondary); margin:8px 0 16px;">
                    ${res.imported_count} new student accounts have been created in the database and seeded with required subject records.
                </p>
                <button class="btn-primary" onclick="window.location.hash='#admin-students'">View Students Directory →</button>
            </div>
        `;
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ----------------------------------------------------------
// 5. AUDIT LOGS
// ----------------------------------------------------------
let auditActionFilter = '';
let auditSearchQuery = '';

async function renderAdminAuditLogs() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="page-header" style="margin-bottom:20px;">
            <h2>🛡️ System Audit Logs</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Tamper-proof compliance log tracking all system events, attendance entries, marks changes, and logins.</p>
        </div>

        <div class="notices-filter-bar" style="margin-bottom:20px;">
            <div style="display:flex; gap:12px; align-items:center;">
                <select id="audit-action-select" class="form-control" onchange="filterAuditByAction(this.value)" style="min-width:200px;">
                    <option value="">All Actions</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="LOGOUT">LOGOUT</option>
                    <option value="ATTENDANCE_MARKED">ATTENDANCE_MARKED</option>
                    <option value="ATTENDANCE_CORRECTION_APPROVED">ATTENDANCE_CORRECTION_APPROVED</option>
                    <option value="ATTENDANCE_CORRECTION_REJECTED">ATTENDANCE_CORRECTION_REJECTED</option>
                    <option value="MARKS_UPDATED">MARKS_UPDATED</option>
                    <option value="STUDENT_CREATED">STUDENT_CREATED</option>
                    <option value="BULK_STUDENT_IMPORT">BULK_STUDENT_IMPORT</option>
                    <option value="NOTICE_CREATED">NOTICE_CREATED</option>
                    <option value="STUDY_MATERIAL_UPLOADED">STUDY_MATERIAL_UPLOADED</option>
                </select>
            </div>

            <div style="position:relative; min-width:280px;">
                <input type="text" class="form-control" placeholder="Search user, action, details..." 
                       value="${auditSearchQuery}" oninput="searchAuditLogs(this.value)" style="padding-left:36px;">
                <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);">🔍</span>
            </div>
        </div>

        <div id="admin-audit-table-container">
            <div style="text-align:center; padding:40px; color:var(--text-muted);">Loading audit logs...</div>
        </div>
    `;

    loadAdminAuditLogs();
}

function filterAuditByAction(val) {
    auditActionFilter = val;
    loadAdminAuditLogs();
}

let auditSearchTimeout = null;
function searchAuditLogs(val) {
    auditSearchQuery = val.trim();
    clearTimeout(auditSearchTimeout);
    auditSearchTimeout = setTimeout(() => {
        loadAdminAuditLogs();
    }, 300);
}

async function loadAdminAuditLogs() {
    const container = document.getElementById('admin-audit-table-container');
    if (!container) return;

    try {
        let endpoint = `/admin/audit-logs?limit=50`;
        if (auditActionFilter) endpoint += `&action=${encodeURIComponent(auditActionFilter)}`;
        if (auditSearchQuery) endpoint += `&search=${encodeURIComponent(auditSearchQuery)}`;

        const data = await apiFetch(endpoint);
        const logs = data.logs || [];

        if (logs.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">No audit events matching criteria.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Action</th>
                            <th>User Name</th>
                            <th>Role</th>
                            <th>Details</th>
                            <th>IP Address</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(l => `
                            <tr>
                                <td><span class="audit-action-tag">${escapeHtml(l.action)}</span></td>
                                <td><strong>${escapeHtml(l.user_name)}</strong></td>
                                <td><span style="text-transform:uppercase; font-size:0.75rem; color:var(--text-muted);">${escapeHtml(l.user_role)}</span></td>
                                <td style="font-size:0.82rem; color:var(--text-secondary); max-width:350px;">${escapeHtml(l.details)}</td>
                                <td style="font-family:monospace; font-size:0.75rem; color:var(--text-muted);">${escapeHtml(l.ip_address || '127.0.0.1')}</td>
                                <td style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap;">${formatDate(l.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

// ----------------------------------------------------------
// 6. ACADEMIC STRUCTURE (DEPARTMENTS & SUBJECTS)
// ----------------------------------------------------------
async function renderAdminAcademics() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="page-header" style="margin-bottom:20px;">
            <h2>🏛️ Academic Structure</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Manage departments, degree programs, semesters, and course subject assignments.</p>
        </div>

        <div style="display:grid; grid-template-columns:1fr 2fr; gap:24px;">
            <!-- Departments List -->
            <div class="dashboard-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <h3 style="font-size:1.05rem; margin:0;">Departments</h3>
                </div>
                <div id="admin-depts-list">Loading...</div>
            </div>

            <!-- Subjects List -->
            <div class="dashboard-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <h3 style="font-size:1.05rem; margin:0;">Course Subjects</h3>
                </div>
                <div id="admin-subjects-list">Loading...</div>
            </div>
        </div>
    `;

    loadAdminAcademics();
}

async function loadAdminAcademics() {
    try {
        const dData = await apiFetch('/admin/departments');
        const sData = await apiFetch('/admin/subjects');

        const deptsList = document.getElementById('admin-depts-list');
        const subsList = document.getElementById('admin-subjects-list');

        if (deptsList) {
            deptsList.innerHTML = dData.departments.map(d => `
                <div style="padding:12px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:var(--primary-color);">${escapeHtml(d.code)}</strong>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${d.students_count} Students</span>
                    </div>
                    <div style="font-size:0.88rem; color:var(--text-primary); margin-top:2px;">${escapeHtml(d.name)}</div>
                </div>
            `).join('');
        }

        if (subsList) {
            subsList.innerHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Subject Name</th>
                                <th>Dept</th>
                                <th>Sem</th>
                                <th>Faculty</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sData.subjects.map(s => `
                                <tr>
                                    <td><strong style="color:#818cf8;">${escapeHtml(s.code)}</strong></td>
                                    <td>${escapeHtml(s.name)}</td>
                                    <td>${escapeHtml(s.department_code)}</td>
                                    <td>Sem ${s.semester}</td>
                                    <td>👤 ${escapeHtml(s.faculty_name)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ----------------------------------------------------------
// 7. DIGITAL ID CARDS (ADMIN VIEWER)
// ----------------------------------------------------------
async function renderAdminIdCards() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="page-header" style="margin-bottom:20px;">
            <h2>🪪 Digital Student ID Cards</h2>
            <p style="color:var(--text-muted); font-size:0.88rem;">Inspect and generate digital identity badges and QR verification tokens for any enrolled student.</p>
        </div>

        <div style="margin-bottom:20px; max-width:350px;">
            <input type="text" class="form-control" placeholder="Search student USN to view ID card..." oninput="searchIdCards(this.value)">
        </div>

        <div id="admin-id-cards-container">
            <div style="text-align:center; padding:40px; color:var(--text-muted);">Loading students...</div>
        </div>
    `;

    loadAdminIdCardsList();
}

async function loadAdminIdCardsList(filter = '') {
    const container = document.getElementById('admin-id-cards-container');
    try {
        const data = await apiFetch('/admin/students');
        let students = data.students || [];

        if (filter) {
            students = students.filter(s => s.usn.toLowerCase().includes(filter.toLowerCase()) || s.full_name.toLowerCase().includes(filter.toLowerCase()));
        }

        container.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px;">
                ${students.map(s => `
                    <div class="dashboard-card" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
                        <div class="user-avatar" style="width:64px; height:64px; font-size:1.5rem; margin-bottom:10px;">
                            ${s.photo_url ? `<img src="${s.photo_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : s.full_name.charAt(0)}
                        </div>
                        <h4 style="margin:0 0 4px;">${escapeHtml(s.full_name)}</h4>
                        <div style="color:#818cf8; font-weight:600; font-size:0.82rem; margin-bottom:6px;">${escapeHtml(s.usn)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:14px;">${escapeHtml(s.department_name)} • Sem ${s.semester}</div>
                        <button class="btn-primary" onclick="openStudentIdCardModal('${s.usn}')" style="width:100%; padding:6px 12px; font-size:0.82rem;">
                            View ID Card 🪪
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
}

function searchIdCards(val) {
    loadAdminIdCardsList(val.trim());
}

async function openStudentIdCardModal(usn) {
    const modal = document.getElementById('app-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = `🪪 Digital Student ID Card - ${usn}`;
    body.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Generating digital identity card...</div>`;
    modal.classList.add('active');

    try {
        const verifyData = await apiFetch(`/student/verify-id/${usn}`);
        const s = verifyData.student;

        body.innerHTML = `
            <div class="id-card-container">
                <div class="id-card-badge" id="printable-id-card">
                    <div class="id-card-lanyard-hole"></div>

                    <div class="id-card-header">
                        <div class="college-crest">🏛️</div>
                        <h3>${escapeHtml(s.college_name)}</h3>
                        <p>Affiliated to VTU • Approved by AICTE • ISO 9001:2015</p>
                    </div>

                    <div class="id-card-body">
                        <div class="id-card-photo-wrapper">
                            ${s.photo_url 
                                ? `<img src="${s.photo_url}" class="id-card-photo" alt="Student Photo">` 
                                : `<div class="id-card-photo" style="display:flex; align-items:center; justify-content:center; font-size:2.5rem; color:#818cf8;">${s.full_name.charAt(0)}</div>`}
                            <div class="id-card-verified-badge" title="Verified College Registry ID">✓</div>
                        </div>

                        <h3 class="id-card-name">${escapeHtml(s.full_name)}</h3>
                        <div class="id-card-usn">USN: ${escapeHtml(s.usn)}</div>

                        <div class="id-card-details-grid">
                            <div class="id-detail-item">
                                <span class="id-detail-label">Department</span>
                                <span class="id-detail-val">${escapeHtml(s.department)}</span>
                            </div>
                            <div class="id-detail-item">
                                <span class="id-detail-label">Course / Branch</span>
                                <span class="id-detail-val">B.E. (${escapeHtml(s.department_code)})</span>
                            </div>
                            <div class="id-detail-item">
                                <span class="id-detail-label">Semester & Section</span>
                                <span class="id-detail-val">Sem ${s.semester} / Sec '${escapeHtml(s.section)}'</span>
                            </div>
                            <div class="id-detail-item">
                                <span class="id-detail-label">Academic Year</span>
                                <span class="id-detail-val">${escapeHtml(s.academic_year)}</span>
                            </div>
                        </div>

                        <div class="id-card-qr-box">
                            <div id="modal-qr-container"></div>
                            <div class="id-card-qr-caption">SCAN TO VERIFY ID</div>
                        </div>
                    </div>

                    <div class="id-card-footer">
                        <span>🛡️ Valid Identity Card</span>
                        <span>Official Student Registry</span>
                    </div>
                </div>

                <div class="id-card-actions">
                    <button class="btn-primary" onclick="window.print()">🖨️ Download / Print Card (PDF)</button>
                </div>
            </div>
        `;

        renderQrCodeToElement('modal-qr-container', `${window.location.origin}/#verify-id?usn=${s.usn}`);

    } catch (err) {
        body.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

// ----------------------------------------------------------
// 8. QR CODE GENERATION HELPER (FALLBACK & LIB SUPPORT)
// ----------------------------------------------------------
function renderQrCodeToElement(elementId, text) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        try {
            new QRCode(el, {
                text: text,
                width: 90,
                height: 90,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
            return;
        } catch (e) {}
    }

    // High reliability SVG fallback generator
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(text)}`;
    el.innerHTML = `<img src="${qrApiUrl}" width="90" height="90" alt="QR Code" style="display:block;">`;
}
