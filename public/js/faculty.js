/* Faculty Portal Controllers & Attendance Submission Engine */

let currentAttendanceRoster = [];

// Render Faculty Dashboard View
async function renderFacultyDashboard() {
    const container = document.getElementById('view-container');
    container.innerHTML = `<div class="flex-center" style="padding: 60px;">Loading faculty dashboard...</div>`;

    try {
        const data = await apiFetch('/faculty/dashboard');
        const { faculty, subjects, total_students, recent_sessions } = data;

        container.innerHTML = `
            <div class="dashboard-header">
                <h2>Welcome, ${faculty.full_name} 👋</h2>
                <p>Faculty ID: <strong>${faculty.fid_code}</strong> | Designation: <strong>${faculty.designation}</strong> | Dept: <strong>${faculty.department_name}</strong></p>
            </div>

            <div class="stat-grid">
                <div class="stat-card">
                    <div class="stat-info">
                        <div class="stat-label">Assigned Subjects</div>
                        <div class="stat-value">${subjects.length}</div>
                    </div>
                    <div class="stat-icon indigo">📖</div>
                </div>

                <div class="stat-card">
                    <div class="stat-info">
                        <div class="stat-label">Total Students Handled</div>
                        <div class="stat-value">${total_students}</div>
                    </div>
                    <div class="stat-icon green">👥</div>
                </div>

                <div class="stat-card">
                    <div class="stat-info">
                        <div class="stat-label">Recent Submissions</div>
                        <div class="stat-value">${recent_sessions.length}</div>
                    </div>
                    <div class="stat-icon yellow">📝</div>
                </div>
            </div>

            <div class="grid-2">
                <!-- Action Card -->
                <div class="card">
                    <div class="card-header">
                        <h3>Quick Actions</h3>
                    </div>
                    <div style="display:flex; gap:16px; flex-wrap:wrap;">
                        <a href="#faculty-mark-attendance" class="btn-primary" style="text-decoration:none; display:inline-block; text-align:center; flex:1; min-width:200px; padding:16px;">
                            📋 Mark Attendance Now
                        </a>
                        <a href="#faculty-marks" class="btn-secondary" style="text-decoration:none; display:inline-block; text-align:center; flex:1; min-width:200px; padding:16px;">
                            ✏️ Enter Student Test Marks
                        </a>
                    </div>
                </div>

                <!-- Assigned Subjects List -->
                <div class="card">
                    <div class="card-header">
                        <h3>Assigned Subjects</h3>
                    </div>
                    <ul style="list-style:none;">
                        ${subjects.map(s => `
                            <li style="padding:10px 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <strong>${s.code}</strong> - ${s.name}
                                    <div style="font-size:0.78rem; color:var(--text-muted);">Semester ${s.semester}</div>
                                </div>
                                <a href="#faculty-mark-attendance" class="btn-secondary" style="padding:4px 10px; font-size:0.8rem; text-decoration:none;">Mark</a>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>

            <!-- Recent Submitted Sessions -->
            <div class="card">
                <div class="card-header">
                    <h3>Recent Attendance Logs</h3>
                    <a href="#faculty-history" class="sidebar-link" style="padding:4px 8px; font-size:0.8rem;">View All →</a>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Period</th>
                                <th>Subject</th>
                                <th>Students</th>
                                <th>Present</th>
                                <th>Absent</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recent_sessions.length === 0 ? `<tr><td colspan="6" style="text-align:center;">No recent attendance sessions submitted.</td></tr>` :
                              recent_sessions.map(s => `
                                <tr>
                                    <td>${formatDate(s.date)}</td>
                                    <td>${s.class_period}</td>
                                    <td><strong>${s.subject_code}</strong> - ${s.subject_name}</td>
                                    <td>${s.total_students}</td>
                                    <td><span class="badge badge-green">${s.present_count} Present</span></td>
                                    <td><span class="badge badge-red">${s.absent_count} Absent</span></td>
                                </tr>
                              `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="alert-banner alert-danger">Error: ${err.message}</div>`;
    }
}

// Render Mark Attendance Page
async function renderFacultyMarkAttendance() {
    const container = document.getElementById('view-container');
    container.innerHTML = `<div class="flex-center" style="padding: 60px;">Loading subjects roster...</div>`;

    try {
        const subData = await apiFetch('/faculty/subjects');
        const subjects = subData.subjects;

        if (subjects.length === 0) {
            container.innerHTML = `<div class="alert-banner alert-warning">No subjects assigned to your faculty profile.</div>`;
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];

        container.innerHTML = `
            <div class="dashboard-header">
                <h2>Mark Student Attendance</h2>
                <p>Select subject, class details, date, and time period to mark roster attendance</p>
            </div>

            <!-- Selection Bar -->
            <div class="filter-bar">
                <div class="filter-group">
                    <label>Subject</label>
                    <select class="form-control" id="mark-subject-id" onchange="loadStudentRoster()">
                        ${subjects.map(s => `<option value="${s.id}" data-sem="${s.semester}">${s.code} - ${s.name} (Sem ${s.semester})</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Section</label>
                    <select class="form-control" id="mark-section" onchange="loadStudentRoster()">
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Date</label>
                    <input type="date" class="form-control" id="mark-date" value="${todayStr}" onchange="loadStudentRoster()">
                </div>
                <div class="filter-group">
                    <label>Class Period / Time</label>
                    <select class="form-control" id="mark-period" onchange="loadStudentRoster()">
                        <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                        <option value="11:15 AM - 12:15 PM">11:15 AM - 12:15 PM</option>
                        <option value="01:15 PM - 02:15 PM">01:15 PM - 02:15 PM</option>
                        <option value="02:15 PM - 03:15 PM">02:15 PM - 03:15 PM</option>
                        <option value="03:30 PM - 04:30 PM">03:30 PM - 04:30 PM</option>
                    </select>
                </div>
            </div>

            <div id="duplicate-warning-box"></div>

            <!-- Student Roster Container -->
            <div class="card">
                <div class="roster-header">
                    <h3>Student Roster</h3>
                    <div class="bulk-actions">
                        <button class="btn-secondary" onclick="markAllRoster('Present')">Mark All Present</button>
                        <button class="btn-secondary" onclick="markAllRoster('Absent')">Mark All Absent</button>
                        <button class="btn-secondary" onclick="loadStudentRoster()">Reset</button>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>USN</th>
                                <th>Student Name</th>
                                <th>Status Toggle</th>
                            </tr>
                        </thead>
                        <tbody id="roster-tbody">
                            <tr><td colspan="3" style="text-align:center;">Select class to load roster.</td></tr>
                        </tbody>
                    </table>
                </div>

                <div style="margin-top:24px; text-align:right;">
                    <button id="submit-attendance-btn" class="btn-success" onclick="submitAttendanceForm()">
                        📤 Submit Attendance & Notify Students
                    </button>
                </div>
            </div>
        `;

        loadStudentRoster();
    } catch (err) {
        container.innerHTML = `<div class="alert-banner alert-danger">Error: ${err.message}</div>`;
    }
}

// Fetch Student Roster and check duplicate submission status
async function loadStudentRoster() {
    const subjectId = document.getElementById('mark-subject-id')?.value;
    const section = document.getElementById('mark-section')?.value || 'A';
    const date = document.getElementById('mark-date')?.value;
    const period = document.getElementById('mark-period')?.value;

    if (!subjectId) return;

    const tbody = document.getElementById('roster-tbody');
    const warningBox = document.getElementById('duplicate-warning-box');
    const submitBtn = document.getElementById('submit-attendance-btn');

    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Loading roster...</td></tr>`;

    try {
        const res = await apiFetch(`/faculty/students?subject_id=${subjectId}&section=${section}&date=${date}&class_period=${encodeURIComponent(period)}`);
        const { students, already_submitted } = res;

        currentAttendanceRoster = students.map(s => ({
            student_id: s.student_id,
            usn: s.usn,
            name: s.full_name,
            status: s.status || 'Present'
        }));

        if (already_submitted) {
            warningBox.innerHTML = `
                <div class="alert-banner alert-danger">
                    <span>🚫</span>
                    <div>
                        <strong>Attendance Already Submitted!</strong> Attendance for this subject, date (${date}), and class period (${period}) has already been recorded. Re-submitting is disabled to prevent duplicate database records.
                    </div>
                </div>
            `;
            if (submitBtn) submitBtn.disabled = true;
        } else {
            warningBox.innerHTML = '';
            if (submitBtn) submitBtn.disabled = false;
        }

        renderRosterTable();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--status-red);">Failed to load roster: ${err.message}</td></tr>`;
    }
}

function renderRosterTable() {
    const tbody = document.getElementById('roster-tbody');
    if (currentAttendanceRoster.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No students found for selected class.</td></tr>`;
        return;
    }

    tbody.innerHTML = currentAttendanceRoster.map((st, idx) => `
        <tr>
            <td><strong>${st.usn}</strong></td>
            <td>${st.name}</td>
            <td>
                <div class="toggle-btn-group">
                    <button class="toggle-btn btn-present ${st.status === 'Present' ? 'active' : ''}" onclick="setRosterStatus(${idx}, 'Present')">Present</button>
                    <button class="toggle-btn btn-absent ${st.status === 'Absent' ? 'active' : ''}" onclick="setRosterStatus(${idx}, 'Absent')">Absent</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function setRosterStatus(index, status) {
    if (currentAttendanceRoster[index]) {
        currentAttendanceRoster[index].status = status;
        renderRosterTable();
    }
}

function markAllRoster(status) {
    currentAttendanceRoster.forEach(st => st.status = status);
    renderRosterTable();
}

async function submitAttendanceForm() {
    const subjectId = document.getElementById('mark-subject-id')?.value;
    const date = document.getElementById('mark-date')?.value;
    const period = document.getElementById('mark-period')?.value;

    if (!subjectId || !date || !period) {
        showToast('Please select subject, date and class period.', 'error');
        return;
    }

    if (currentAttendanceRoster.length === 0) {
        showToast('No students in roster to submit.', 'error');
        return;
    }

    const payload = {
        subject_id: parseInt(subjectId),
        date,
        class_period: period,
        attendance_list: currentAttendanceRoster.map(s => ({
            student_id: s.student_id,
            status: s.status
        }))
    };

    try {
        const res = await apiFetch('/faculty/attendance', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        showToast(`✅ ${res.message} (${res.present_count} Present, ${res.absent_count} Absent)`, 'success');
        loadStudentRoster(); // Refresh status and trigger duplicate lock
    } catch (err) {
        if (err.message.includes('DUPLICATE_ENTRY') || err.message.includes('already been submitted')) {
            alert(`⚠️ Duplicate Submission Blocked!\n\n${err.message}`);
        } else {
            showToast(err.message || 'Failed to submit attendance', 'error');
        }
    }
}

// Render Faculty Attendance History View
async function renderFacultyHistory() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="dashboard-header">
            <h2>Faculty Attendance History</h2>
            <p>Review previously submitted attendance sessions</p>
        </div>

        <div class="card">
            <div class="table-toolbar">
                <select class="form-control" id="fac-hist-subject" onchange="fetchFacultyHistory()" style="width: auto;">
                    <option value="">All Subjects</option>
                </select>
                <input type="date" class="form-control" id="fac-hist-date" onchange="fetchFacultyHistory()" style="width: auto;">
            </div>

            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time Period</th>
                            <th>Subject</th>
                            <th>Total Students</th>
                            <th>Present</th>
                            <th>Absent</th>
                            <th>Attendance %</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody id="fac-hist-tbody">
                        <tr><td colspan="8" style="text-align:center;">Loading logs...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Populate subject filter
    try {
        const subData = await apiFetch('/faculty/subjects');
        const select = document.getElementById('fac-hist-subject');
        subData.subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.code} - ${s.name}`;
            select.appendChild(opt);
        });
    } catch (e) {}

    fetchFacultyHistory();
}

async function fetchFacultyHistory() {
    const subject_id = document.getElementById('fac-hist-subject')?.value || '';
    const date = document.getElementById('fac-hist-date')?.value || '';

    const params = new URLSearchParams();
    if (subject_id) params.append('subject_id', subject_id);
    if (date) params.append('date', date);

    try {
        const res = await apiFetch(`/faculty/attendance/history?${params.toString()}`);
        const { sessions } = res;

        const tbody = document.getElementById('fac-hist-tbody');
        if (sessions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;">No submitted attendance sessions found.</td></tr>`;
            return;
        }

        tbody.innerHTML = sessions.map(s => `
            <tr>
                <td>${formatDate(s.date)}</td>
                <td>${s.class_period}</td>
                <td><strong>${s.subject_code}</strong> - ${s.subject_name}</td>
                <td>${s.total_students}</td>
                <td><span class="badge badge-green">${s.present_count} Present</span></td>
                <td><span class="badge badge-red">${s.absent_count} Absent</span></td>
                <td><strong>${s.percentage}%</strong></td>
                <td>
                    <button class="btn-secondary" style="padding:4px 10px; font-size:0.78rem;" 
                            onclick="openFacultySessionDetailModal(${s.subject_id}, '${s.date}', '${s.class_period}', '${s.subject_name}')">
                        View Roster
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to fetch faculty history', 'error');
    }
}

async function openFacultySessionDetailModal(subjectId, date, period, subjectName) {
    const modal = document.getElementById('app-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = `${subjectName} (${formatDate(date)} - ${period})`;
    modalBody.innerHTML = `Loading session student roster...`;
    modal.classList.add('active');

    try {
        const res = await apiFetch(`/faculty/attendance/session-detail?subject_id=${subjectId}&date=${date}&class_period=${encodeURIComponent(period)}`);
        const { details } = res;

        modalBody.innerHTML = `
            <div class="table-responsive" style="max-height: 380px;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>USN</th>
                            <th>Student Name</th>
                            <th>Recorded Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${details.map(d => `
                            <tr>
                                <td><strong>${d.usn}</strong></td>
                                <td>${d.full_name}</td>
                                <td>${d.status === 'Present' ? '<span class="badge badge-green">Present</span>' : '<span class="badge badge-red">Absent</span>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        modalBody.innerHTML = `<div style="color:var(--status-red);">Error loading roster detail.</div>`;
    }
}

// Render Faculty Marks Management View
async function renderFacultyMarks() {
    const container = document.getElementById('view-container');
    container.innerHTML = `<div class="flex-center" style="padding: 60px;">Loading subjects...</div>`;

    try {
        const subData = await apiFetch('/faculty/subjects');
        const subjects = subData.subjects;

        if (subjects.length === 0) {
            container.innerHTML = `<div class="alert-banner alert-warning">No subjects assigned to your profile.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="dashboard-header">
                <h2>Enter Student Test Marks</h2>
                <p>Input and update internal exam scores, assignments, lab, project and final exam marks</p>
            </div>

            <div class="filter-bar">
                <div class="filter-group">
                    <label>Select Subject</label>
                    <select class="form-control" id="marks-subject-id" onchange="loadStudentMarksRoster()">
                        ${subjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>Student Scores</h3>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>USN</th>
                                <th>Name</th>
                                <th>IA 1 (25)</th>
                                <th>IA 2 (25)</th>
                                <th>Assign (10)</th>
                                <th>Lab (20)</th>
                                <th>Proj (20)</th>
                                <th>Final (100)</th>
                            </tr>
                        </thead>
                        <tbody id="marks-tbody">
                            <tr><td colspan="8" style="text-align:center;">Select subject to view scores.</td></tr>
                        </tbody>
                    </table>
                </div>

                <div style="margin-top:20px; text-align:right;">
                    <button class="btn-success" onclick="saveStudentMarksForm()">💾 Save All Marks</button>
                </div>
            </div>
        `;

        loadStudentMarksRoster();
    } catch (err) {
        container.innerHTML = `<div class="alert-banner alert-danger">Error: ${err.message}</div>`;
    }
}

async function loadStudentMarksRoster() {
    const subjectId = document.getElementById('marks-subject-id')?.value;
    if (!subjectId) return;

    const tbody = document.getElementById('marks-tbody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Loading scores...</td></tr>`;

    try {
        const res = await apiFetch(`/faculty/marks?subject_id=${subjectId}`);
        const { marks } = res;

        tbody.innerHTML = marks.map(m => `
            <tr data-student-id="${m.student_id}">
                <td><strong>${m.usn}</strong></td>
                <td>${m.full_name}</td>
                <td><input type="number" min="0" max="25" class="form-control mark-input" data-field="internal_1" value="${m.internal_1}" style="width:70px; padding:6px;"></td>
                <td><input type="number" min="0" max="25" class="form-control mark-input" data-field="internal_2" value="${m.internal_2}" style="width:70px; padding:6px;"></td>
                <td><input type="number" min="0" max="10" class="form-control mark-input" data-field="assignment" value="${m.assignment}" style="width:70px; padding:6px;"></td>
                <td><input type="number" min="0" max="20" class="form-control mark-input" data-field="lab" value="${m.lab}" style="width:70px; padding:6px;"></td>
                <td><input type="number" min="0" max="20" class="form-control mark-input" data-field="project" value="${m.project}" style="width:70px; padding:6px;"></td>
                <td><input type="number" min="0" max="100" class="form-control mark-input" data-field="final_exam" value="${m.final_exam}" style="width:80px; padding:6px;"></td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--status-red);">Failed to load student scores: ${err.message}</td></tr>`;
    }
}

async function saveStudentMarksForm() {
    const subjectId = document.getElementById('marks-subject-id')?.value;
    if (!subjectId) return;

    const rows = document.querySelectorAll('#marks-tbody tr[data-student-id]');
    const marksList = [];

    rows.forEach(tr => {
        const studentId = tr.dataset.studentId;
        const inputs = tr.querySelectorAll('.mark-input');
        const item = { student_id: parseInt(studentId) };

        inputs.forEach(inp => {
            item[inp.dataset.field] = parseFloat(inp.value) || 0;
        });
        marksList.push(item);
    });

    try {
        const res = await apiFetch('/faculty/marks', {
            method: 'POST',
            body: JSON.stringify({
                subject_id: parseInt(subjectId),
                marks_list: marksList
            })
        });

        showToast(res.message, 'success');
    } catch (err) {
        showToast(err.message || 'Failed to save marks', 'error');
    }
}
