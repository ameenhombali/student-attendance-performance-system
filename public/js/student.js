/* Student Portal Controllers & Visual Charting */

let studentMarksChart = null;

// Render Student Dashboard View
async function renderStudentDashboard() {
    const container = document.getElementById('view-container');
    container.innerHTML = `<div class="flex-center" style="padding: 60px;"><div class="spinner">Loading dashboard...</div></div>`;

    try {
        const data = await apiFetch('/student/dashboard');
        const { student, stats, recent_notifications, recent_attendance } = data;
        const recent_materials = data.recent_materials || [];

        let warningBannerHTML = '';
        if (stats.is_low_attendance || (stats.low_attendance_warnings && stats.low_attendance_warnings.length > 0)) {
            const warningSubjects = stats.low_attendance_warnings.map(w => `${w.subject_name} (${w.percentage}%)`).join(', ');
            warningBannerHTML = `
                <div class="alert-banner alert-danger">
                    <span>⚠️</span>
                    <div>
                        <strong>Low Attendance Warning!</strong> 
                        Your attendance is below the college minimum threshold (${stats.min_threshold}%). 
                        ${warningSubjects ? `Subjects requiring attention: <u>${warningSubjects}</u>` : ''}
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="dashboard-header">
                <h2>Welcome, ${student.full_name} 👋</h2>
                <div class="student-profile-info" style="margin-top: 8px; color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6;">
                    <div><strong>USN:</strong> ${student.usn}</div>
                    <div><strong>${getAcademicYear(student.semester)}</strong> | Semester ${student.semester} | Section ${student.section}</div>
                    <div>${student.department_name}</div>
                </div>
            </div>

            ${warningBannerHTML}

            <!-- Stat Cards -->
            <div class="stat-grid">
                <div class="stat-card">
                    <div class="stat-info">
                        <div class="stat-label">Overall Attendance</div>
                        <div class="stat-value">${stats.overall_percentage}%</div>
                        <div style="margin-top:6px;">${getStatusBadgeHTML(stats.overall_percentage, stats.min_threshold)}</div>
                    </div>
                    <div class="stat-icon indigo">📊</div>
                </div>

                <div class="stat-card">
                    <div class="stat-info">
                        <div class="stat-label">Total Classes</div>
                        <div class="stat-value">${stats.total_classes}</div>
                    </div>
                    <div class="stat-icon indigo">📚</div>
                </div>

                <div class="stat-card">
                    <div class="stat-info">
                        <div class="stat-label">Present</div>
                        <div class="stat-value" style="color: var(--status-green);">${stats.present}</div>
                    </div>
                    <div class="stat-icon green">✅</div>
                </div>

                <div class="stat-card">
                    <div class="stat-info">
                        <div class="stat-label">Absent</div>
                        <div class="stat-value" style="color: var(--status-red);">${stats.absent}</div>
                    </div>
                    <div class="stat-icon red">❌</div>
                </div>
            </div>

            <div class="grid-2">
                <!-- Recent Attendance Activity -->
                <div class="card">
                    <div class="card-header">
                        <h3>Recent Attendance Logs</h3>
                        <a href="#student-history" class="sidebar-link" style="padding:4px 8px; font-size:0.8rem;">View All →</a>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Subject</th>
                                    <th>Faculty</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recent_attendance.length === 0 ? `<tr><td colspan="5" style="text-align:center;">No recent attendance logged.</td></tr>` : 
                                  recent_attendance.map(a => `
                                    <tr>
                                        <td>${formatDate(a.date)}</td>
                                        <td>${a.class_period}</td>
                                        <td><strong>${a.subject_code}</strong> - ${a.subject_name}</td>
                                        <td>${a.faculty_name}</td>
                                        <td>
                                            ${a.status === 'Present' ? '<span class="badge badge-green">Present</span>' : '<span class="badge badge-red">Absent</span>'}
                                        </td>
                                    </tr>
                                  `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Recent Notifications Card -->
                <div class="card">
                    <div class="card-header">
                        <h3>Recent Notifications</h3>
                    </div>
                    <div class="notif-list" style="max-height: auto;">
                        ${recent_notifications.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem; padding:10px;">No recent notifications.</div>` :
                          recent_notifications.map(n => `
                            <div class="notif-item ${n.is_read === 0 ? 'unread' : ''}">
                                <div class="notif-title">${n.title}</div>
                                <div class="notif-msg">${n.message}</div>
                                <div class="notif-time">${formatDate(n.created_at)}</div>
                            </div>
                          `).join('')}
                    </div>
                </div>
            </div>

            <!-- Recent Course Study Materials -->
            <div class="card" style="margin-top:24px;">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0;">📖 Course Study Materials & Lecture Notes</h3>
                        <p style="color:var(--text-muted); font-size:0.82rem; margin:4px 0 0;">Latest study documents uploaded by your course faculty</p>
                    </div>
                    <a href="#study-materials" class="sidebar-link" style="padding:6px 12px; font-size:0.82rem; background:rgba(99,102,241,0.1); border-radius:6px; color:#818cf8; text-decoration:none;">View All Materials →</a>
                </div>
                <div style="padding:16px;">
                    ${recent_materials.length === 0 ? `
                        <div style="text-align:center; padding:30px; color:var(--text-muted);">
                            <div style="font-size:2rem; margin-bottom:8px;">📚</div>
                            <p>No study materials uploaded for your semester yet.</p>
                        </div>
                    ` : `
                        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px;">
                            ${recent_materials.map(m => `
                                <div style="background:var(--bg-primary); border:1px solid var(--border-color); border-radius:10px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
                                    <div>
                                        <div style="font-size:0.75rem; color:#818cf8; font-weight:600; text-transform:uppercase; margin-bottom:4px;">
                                            ${escapeHtml(m.subject_code)} • ${escapeHtml(m.subject_name)}
                                        </div>
                                        <h4 style="font-size:0.95rem; font-weight:700; margin:0 0 8px; line-height:1.4;">
                                            ${escapeHtml(m.title)}
                                        </h4>
                                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px;">
                                            👤 ${escapeHtml(m.faculty_name)} • 📄 ${(m.file_type || 'PDF').toUpperCase()}
                                        </div>
                                    </div>
                                    <button class="btn-primary" onclick="downloadMaterialFile(${m.id})" 
                                            style="width:100%; padding:8px 12px; font-size:0.82rem; display:flex; align-items:center; justify-content:center; gap:6px;">
                                        ⬇ Download ${escapeHtml(m.file_type || 'PDF')}
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="alert-banner alert-danger">Error loading dashboard: ${err.message}</div>`;
    }
}

// Render Attendance History View
async function renderStudentHistory() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="dashboard-header">
            <h2>Attendance History</h2>
            <p>Detailed log of all classes attended and missed</p>
        </div>

        <!-- Summary Top Bar -->
        <div class="stat-grid" id="history-stats">
            <div class="stat-card"><div class="stat-info"><div class="stat-label">Total Classes</div><div class="stat-value" id="hist-total">-</div></div></div>
            <div class="stat-card"><div class="stat-info"><div class="stat-label">Present</div><div class="stat-value" style="color:var(--status-green);" id="hist-present">-</div></div></div>
            <div class="stat-card"><div class="stat-info"><div class="stat-label">Absent</div><div class="stat-value" style="color:var(--status-red);" id="hist-absent">-</div></div></div>
            <div class="stat-card"><div class="stat-info"><div class="stat-label">Percentage</div><div class="stat-value" id="hist-pct">-</div></div></div>
        </div>

        <div class="card">
            <div class="table-toolbar">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="hist-search" placeholder="Search by subject, faculty or date..." oninput="fetchHistoryData()">
                </div>
                <div style="display:flex; gap:10px;">
                    <select class="form-control" id="hist-subject-filter" onchange="fetchHistoryData()" style="width: auto;">
                        <option value="">All Subjects</option>
                    </select>
                    <select class="form-control" id="hist-status-filter" onchange="fetchHistoryData()" style="width: auto;">
                        <option value="">All Statuses</option>
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                    </select>
                </div>
            </div>

            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Faculty</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="history-table-body">
                        <tr><td colspan="5" style="text-align:center;">Loading records...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Populate subject dropdown options
    try {
        const subData = await apiFetch('/student/attendance/subject-wise');
        const select = document.getElementById('hist-subject-filter');
        subData.subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.subject_id;
            opt.textContent = `${s.subject_code} - ${s.subject_name}`;
            select.appendChild(opt);
        });
    } catch (e) {}

    fetchHistoryData();
}

async function fetchHistoryData() {
    const search = document.getElementById('hist-search')?.value || '';
    const subject_id = document.getElementById('hist-subject-filter')?.value || '';
    const status = document.getElementById('hist-status-filter')?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (subject_id) params.append('subject_id', subject_id);
    if (status) params.append('status', status);

    try {
        const res = await apiFetch(`/student/attendance/history?${params.toString()}`);
        const { summary, records } = res;

        document.getElementById('hist-total').textContent = summary.total;
        document.getElementById('hist-present').textContent = summary.present;
        document.getElementById('hist-absent').textContent = summary.absent;
        document.getElementById('hist-pct').textContent = `${summary.percentage}%`;

        const tbody = document.getElementById('history-table-body');
        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px;">No attendance records matching filter criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => `
            <tr>
                <td>${formatDate(r.date)}</td>
                <td>${r.class_period}</td>
                <td><strong>${r.subject_code}</strong> - ${r.subject_name}</td>
                <td>${r.faculty_name}</td>
                <td>${r.status === 'Present' ? '<span class="badge badge-green">Present</span>' : '<span class="badge badge-red">Absent</span>'}</td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to load history records', 'error');
    }
}

// Render Subject-Wise Attendance View
async function renderStudentSubjectWise() {
    const container = document.getElementById('view-container');
    container.innerHTML = `<div class="flex-center" style="padding: 60px;">Loading subjects...</div>`;

    try {
        const data = await apiFetch('/student/attendance/subject-wise');
        const { subjects, min_threshold } = data;

        container.innerHTML = `
            <div class="dashboard-header">
                <h2>Subject-Wise Attendance</h2>
                <p>Track your presence status across all enrolled subjects (Minimum required: ${min_threshold}%)</p>
            </div>

            <div class="subject-grid">
                ${subjects.map(s => `
                    <div class="subject-card" onclick="openSubjectDetailModal(${s.subject_id}, '${s.subject_name}')">
                        <div class="subject-card-header">
                            <div>
                                <h4>${s.subject_name}</h4>
                                <span class="code">${s.subject_code} | Faculty: ${s.faculty_name}</span>
                            </div>
                            ${getStatusBadgeHTML(s.percentage, min_threshold)}
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar ${s.color_status}" style="width: ${s.percentage}%;"></div>
                        </div>
                        <div class="subject-stats-mini">
                            <span>Total Classes: <strong>${s.total_classes}</strong></span>
                            <span>Attended: <strong style="color:var(--status-green);">${s.present}</strong></span>
                            <span>Absent: <strong style="color:var(--status-red);">${s.absent}</strong></span>
                        </div>
                        <div style="margin-top:12px; font-size:0.78rem; color:var(--accent-indigo); text-align:right;">Click for history log →</div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="alert-banner alert-danger">Error: ${err.message}</div>`;
    }
}

// Modal for Subject Detailed Log
async function openSubjectDetailModal(subjectId, subjectName) {
    const modal = document.getElementById('app-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = `${subjectName} - Attendance History`;
    modalBody.innerHTML = `Loading subject logs...`;
    modal.classList.add('active');

    try {
        const res = await apiFetch(`/student/attendance/history?subject_id=${subjectId}`);
        const { records, summary } = res;

        modalBody.innerHTML = `
            <div style="display:flex; justify-content:space-around; background:var(--bg-primary); padding:12px; border-radius:var(--radius-sm); margin-bottom:16px;">
                <div>Total: <strong>${summary.total}</strong></div>
                <div>Present: <strong style="color:var(--status-green);">${summary.present}</strong></div>
                <div>Absent: <strong style="color:var(--status-red);">${summary.absent}</strong></div>
                <div>Attendance: <strong>${summary.percentage}%</strong></div>
            </div>
            <div class="table-responsive" style="max-height: 350px;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.map(r => `
                            <tr>
                                <td>${formatDate(r.date)}</td>
                                <td>${r.class_period}</td>
                                <td>${r.status === 'Present' ? '<span class="badge badge-green">Present</span>' : '<span class="badge badge-red">Absent</span>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        modalBody.innerHTML = `<div style="color:var(--status-red);">Failed to load logs.</div>`;
    }
}

// Render Academic Performance & Marks View with Chart.js
async function renderStudentMarks() {
    const container = document.getElementById('view-container');
    container.innerHTML = `<div class="flex-center" style="padding: 60px;">Loading performance data...</div>`;

    try {
        const data = await apiFetch('/student/marks');
        const { marks, overall_academic_pct } = data;

        container.innerHTML = `
            <div class="dashboard-header">
                <h2>Academic Performance & Analytics</h2>
                <p>Subject marks breakdown, continuous evaluations, and analytical trend</p>
            </div>

            <div class="stat-grid">
                <div class="stat-card">
                    <div class="stat-info">
                        <div class="stat-label">Overall Academic Percentage</div>
                        <div class="stat-value">${overall_academic_pct}%</div>
                    </div>
                    <div class="stat-icon green">🏆</div>
                </div>
            </div>

            <div class="grid-2">
                <!-- Marks Breakdown Table -->
                <div class="card">
                    <div class="card-header">
                        <h3>Subject Test Scores Breakdown</h3>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>IA 1 (25)</th>
                                    <th>IA 2 (25)</th>
                                    <th>Assign (10)</th>
                                    <th>Lab (20)</th>
                                    <th>Proj (20)</th>
                                    <th>Final (100)</th>
                                    <th>Total %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${marks.map(m => `
                                    <tr>
                                        <td><strong>${m.subject_code}</strong><br><small>${m.subject_name}</small></td>
                                        <td>${m.internal_1}</td>
                                        <td>${m.internal_2}</td>
                                        <td>${m.assignment}</td>
                                        <td>${m.lab}</td>
                                        <td>${m.project}</td>
                                        <td>${m.final_exam}</td>
                                        <td><strong>${m.percentage}%</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Visual Chart.js Container -->
                <div class="card">
                    <div class="card-header">
                        <h3>Performance Radar / Bar Chart</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="marksChart"></canvas>
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:12px; text-align:center;">
                        * Note: Academic performance analysis displays subject score percentages.
                    </p>
                </div>
            </div>
        `;

        // Render Chart.js
        setTimeout(() => {
            const ctx = document.getElementById('marksChart').getContext('2d');
            if (studentMarksChart) studentMarksChart.destroy();

            const labels = marks.map(m => m.subject_code);
            const percentages = marks.map(m => m.percentage);

            studentMarksChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Subject Score (%)',
                        data: percentages,
                        backgroundColor: 'rgba(99, 102, 241, 0.6)',
                        borderColor: '#6366f1',
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#f8fafc' } }
                    }
                }
            });
        }, 100);

    } catch (err) {
        container.innerHTML = `<div class="alert-banner alert-danger">Error: ${err.message}</div>`;
    }
}

// ==========================================================
// DIGITAL STUDENT ID CARD
// ==========================================================
async function renderStudentIdCard() {
    const container = document.getElementById('view-container');
    container.innerHTML = `<div style="text-align:center; padding:50px; color:var(--text-muted);">Generating your official digital identity badge...</div>`;

    try {
        const data = await apiFetch('/student/id-card');
        const c = data.id_card;

        container.innerHTML = `
            <div class="page-header" style="text-align:center; margin-bottom:20px;">
                <h2>🪪 Digital Student Identity Card</h2>
                <p style="color:var(--text-muted); font-size:0.88rem;">Official verified smart card for library access, campus attendance, and examination entry.</p>
            </div>

            <div class="id-card-container">
                <div class="id-card-badge" id="printable-id-card">
                    <div class="id-card-lanyard-hole"></div>

                    <div class="id-card-header">
                        <div class="college-crest">🏛️</div>
                        <h3>${escapeHtml(c.college_name)}</h3>
                        <p>Affiliated to VTU • Approved by AICTE • ISO 9001:2015</p>
                    </div>

                    <div class="id-card-body">
                        <div class="id-card-photo-wrapper">
                            ${c.photo_url 
                                ? `<img src="${c.photo_url}" class="id-card-photo" alt="Student Photo">` 
                                : `<div class="id-card-photo" style="display:flex; align-items:center; justify-content:center; font-size:2.5rem; color:#818cf8;">${c.full_name.charAt(0)}</div>`}
                            <div class="id-card-verified-badge" title="Verified College Registry ID">✓</div>
                        </div>

                        <h3 class="id-card-name">${escapeHtml(c.full_name)}</h3>
                        <div class="id-card-usn">USN: ${escapeHtml(c.usn)}</div>

                        <div class="id-card-details-grid">
                            <div class="id-detail-item">
                                <span class="id-detail-label">Department</span>
                                <span class="id-detail-val">${escapeHtml(c.department_name)}</span>
                            </div>
                            <div class="id-detail-item">
                                <span class="id-detail-label">Course / Branch</span>
                                <span class="id-detail-val">B.E. (${escapeHtml(c.department_code)})</span>
                            </div>
                            <div class="id-detail-item">
                                <span class="id-detail-label">Semester & Section</span>
                                <span class="id-detail-val">Sem ${c.semester} / Sec '${escapeHtml(c.section)}'</span>
                            </div>
                            <div class="id-detail-item">
                                <span class="id-detail-label">Academic Year</span>
                                <span class="id-detail-val">${escapeHtml(c.academic_year)}</span>
                            </div>
                        </div>

                        <div class="id-card-qr-box">
                            <div id="student-qr-container"></div>
                            <div class="id-card-qr-caption">SCAN TO VERIFY ID</div>
                        </div>
                    </div>

                    <div class="id-card-footer">
                        <span>🛡️ Verified Identity</span>
                        <span>Official Student Registry</span>
                    </div>
                </div>

                <div class="id-card-actions">
                    <button class="btn-primary" onclick="window.print()">🖨️ Download / Print ID Card (PDF)</button>
                    <button class="btn-demo" onclick="openUpdateStudentPhotoModal()">📷 Update Photo</button>
                </div>
            </div>
        `;

        renderQrCodeToElement('student-qr-container', `${window.location.origin}/#verify-id?usn=${c.usn}`);

    } catch (err) {
        container.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

function openUpdateStudentPhotoModal() {
    const modal = document.getElementById('app-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '📷 Update ID Card Photo';
    body.innerHTML = `
        <form onsubmit="submitStudentPhoto(event)">
            <div class="form-group">
                <label>Choose New Photograph (JPG, PNG)</label>
                <input type="file" id="stu-photo-input" class="form-control" accept="image/jpeg,image/png" required>
                <small style="color:var(--text-muted); font-size:0.75rem;">Passport-style front-facing photo recommended (max 5MB).</small>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button type="button" class="btn-demo" onclick="document.getElementById('app-modal').classList.remove('active')">Cancel</button>
                <button type="submit" class="btn-primary">Save Photograph →</button>
            </div>
        </form>
    `;
    modal.classList.add('active');
}

async function submitStudentPhoto(e) {
    e.preventDefault();
    const input = document.getElementById('stu-photo-input');
    if (!input.files || !input.files[0]) return;
    try {
        const photo_url = await fileToBase64(input.files[0]);
        await apiFetch('/student/upload-photo', {
            method: 'POST',
            body: JSON.stringify({ photo_url })
        });
        showToast('Photograph updated successfully!', 'success');
        document.getElementById('app-modal').classList.remove('active');
        renderStudentIdCard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==========================================================
// ATTENDANCE CORRECTION REQUESTS (STUDENT)
// ==========================================================
async function renderStudentCorrections() {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
            <div>
                <h2>📝 Attendance Correction Requests</h2>
                <p style="color:var(--text-muted); font-size:0.88rem;">Dispute incorrect absence entries with medical certificates, duty leave proof, or on-duty forms.</p>
            </div>
            <button class="btn-primary" onclick="openSubmitCorrectionModal()">
                <span>➕</span> Request Attendance Correction
            </button>
        </div>

        <div id="student-corrections-list">
            <div style="text-align:center; padding:40px; color:var(--text-muted);">Loading correction requests...</div>
        </div>
    `;

    loadStudentCorrections();
}

async function loadStudentCorrections() {
    const container = document.getElementById('student-corrections-list');
    if (!container) return;

    try {
        const data = await apiFetch('/student/correction-requests');
        const requests = data.requests || [];

        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align:center; padding:60px 20px; background:var(--card-bg); border-radius:12px; border:1px solid var(--border-color);">
                    <div style="font-size:3rem; margin-bottom:12px;">✅</div>
                    <h3>No Correction Requests Filed</h3>
                    <p style="color:var(--text-muted); max-width:400px; margin:8px auto;">
                        If you were marked absent for a class you attended (e.g., college duty, sports, or medical leave), click "Request Attendance Correction" above.
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Subject</th>
                            <th>Faculty</th>
                            <th>Reason</th>
                            <th>Attachment</th>
                            <th>Status</th>
                            <th>Faculty Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => `
                            <tr>
                                <td>
                                    <strong>${formatDate(r.date)}</strong>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(r.class_period)}</div>
                                </td>
                                <td>
                                    <strong>${escapeHtml(r.subject_code)}</strong>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(r.subject_name)}</div>
                                </td>
                                <td>👤 ${escapeHtml(r.faculty_name)}</td>
                                <td style="max-width:240px; font-size:0.82rem;">${escapeHtml(r.reason)}</td>
                                <td>
                                    ${r.attachment_data ? `
                                        <a href="${r.attachment_data}" download="${r.attachment_name || 'proof.pdf'}" 
                                           style="color:#818cf8; font-size:0.78rem; text-decoration:none;">
                                            📎 ${escapeHtml(r.attachment_name || 'Proof')}
                                        </a>
                                    ` : '<span style="color:var(--text-muted); font-size:0.75rem;">None</span>'}
                                </td>
                                <td><span class="status-pill status-${r.status}">${r.status}</span></td>
                                <td style="font-size:0.8rem; color:var(--text-secondary);">${escapeHtml(r.faculty_remarks || '-')}</td>
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

async function openSubmitCorrectionModal() {
    const modal = document.getElementById('app-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '📝 Request Attendance Correction';
    body.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Fetching your absent class records...</div>`;
    modal.classList.add('active');

    try {
        const data = await apiFetch('/student/absent-sessions');
        const absents = data.absent_sessions || [];

        if (absents.length === 0) {
            body.innerHTML = `
                <div style="text-align:center; padding:30px 10px;">
                    <div style="font-size:2.5rem; margin-bottom:10px;">🌟</div>
                    <h4>No Absent Records Found</h4>
                    <p style="color:var(--text-muted); font-size:0.85rem;">You currently have 100% attendance or have no recorded absences.</p>
                </div>
            `;
            return;
        }

        body.innerHTML = `
            <form id="submit-correction-form" onsubmit="submitCorrectionRequest(event)">
                <div class="form-group">
                    <label>Select Disputed Absent Session *</label>
                    <select id="corr-form-att-id" class="form-control" required>
                        <option value="">-- Choose Class Session --</option>
                        ${absents.map(a => `
                            <option value="${a.id}" ${a.correction_status === 'Pending' ? 'disabled' : ''}>
                                ${formatDate(a.date)} | ${a.subject_code} - ${a.subject_name} (${a.class_period}) ${a.correction_status === 'Pending' ? '[Pending Review]' : ''}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Reason for Correction / Absence Justification *</label>
                    <textarea id="corr-form-reason" class="form-control" rows="3" 
                              placeholder="e.g. Attended college hackathon / was present in room 302 / duty leave signed by HOD..." required></textarea>
                </div>

                <div class="form-group">
                    <label>Attach Supporting Proof Document (Optional)</label>
                    <input type="file" id="corr-form-file" class="form-control" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx">
                    <small style="color:var(--text-muted); font-size:0.75rem;">Duty leave slip, event certificate, or medical slip (PDF/Image).</small>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                    <button type="button" class="btn-demo" onclick="document.getElementById('app-modal').classList.remove('active')">Cancel</button>
                    <button type="submit" class="btn-primary" id="submit-corr-btn">Submit Request →</button>
                </div>
            </form>
        `;
    } catch (err) {
        body.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

async function submitCorrectionRequest(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-corr-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const attendance_id = document.getElementById('corr-form-att-id').value;
    const reason = document.getElementById('corr-form-reason').value.trim();
    const fileInput = document.getElementById('corr-form-file');

    let attachment_name = null;
    let attachment_data = null;

    if (fileInput.files && fileInput.files[0]) {
        attachment_name = fileInput.files[0].name;
        attachment_data = await fileToBase64(fileInput.files[0]);
    }

    try {
        await apiFetch('/student/correction-requests', {
            method: 'POST',
            body: JSON.stringify({ attendance_id, reason, attachment_name, attachment_data })
        });

        showToast('Correction request submitted for faculty review!', 'success');
        document.getElementById('app-modal').classList.remove('active');
        loadStudentCorrections();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Request →';
    }
}

// ==========================================================
// PUBLIC ID VERIFICATION VIEW (FOR SCANNED QR CODES)
// ==========================================================
async function renderVerifyIdPublicView(usn) {
    const container = document.getElementById('view-container') || document.getElementById('app');
    container.innerHTML = `<div style="text-align:center; padding:60px; color:var(--text-muted);">Verifying Student ID in College Registry...</div>`;

    try {
        const data = await apiFetch(`/student/verify-id/${usn}`);
        const s = data.student;

        container.innerHTML = `
            <div style="max-width:500px; margin:40px auto; padding:20px;">
                <div style="background:var(--card-bg); border:2px solid #10b981; border-radius:16px; padding:30px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.3);">
                    <div style="font-size:3rem; margin-bottom:12px;">✅</div>
                    <h2 style="color:#10b981; margin:0 0 6px;">Authentic Student ID</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:20px;">
                        This identity card is verified against the official college student database registry.
                    </p>

                    <div class="user-avatar" style="width:90px; height:90px; font-size:2rem; margin:0 auto 16px; border:3px solid #10b981;">
                        ${s.photo_url ? `<img src="${s.photo_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : s.full_name.charAt(0)}
                    </div>

                    <h3 style="margin:0 0 4px; font-size:1.3rem;">${escapeHtml(s.full_name)}</h3>
                    <div style="color:#818cf8; font-weight:700; font-size:1rem; margin-bottom:14px;">USN: ${escapeHtml(s.usn)}</div>

                    <div style="text-align:left; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:10px; padding:16px; font-size:0.88rem; line-height:1.7;">
                        <div><strong>College:</strong> ${escapeHtml(s.college_name)}</div>
                        <div><strong>Department:</strong> ${escapeHtml(s.department)} (${escapeHtml(s.department_code)})</div>
                        <div><strong>Semester & Section:</strong> Semester ${s.semester} (Section '${escapeHtml(s.section)}')</div>
                        <div><strong>Academic Year:</strong> ${escapeHtml(s.academic_year)}</div>
                        <div><strong>Registry Status:</strong> <span style="color:#10b981; font-weight:700;">● Active / Verified</span></div>
                    </div>

                    <div style="margin-top:20px;">
                        <button class="btn-demo" onclick="window.location.hash='#student-dashboard'">← Back to Dashboard</button>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `
            <div style="max-width:500px; margin:40px auto; padding:20px;">
                <div style="background:var(--card-bg); border:2px solid #ef4444; border-radius:16px; padding:30px; text-align:center;">
                    <div style="font-size:3rem; margin-bottom:12px;">❌</div>
                    <h2 style="color:#ef4444; margin:0 0 6px;">Invalid Student ID</h2>
                    <p style="color:var(--text-secondary);">${err.message}</p>
                    <button class="btn-demo" onclick="window.location.hash=''" style="margin-top:16px;">Go to Login</button>
                </div>
            </div>
        `;
    }
}
