/* Student Portal Controllers & Visual Charting */

let studentMarksChart = null;

// Render Student Dashboard View
async function renderStudentDashboard() {
    const container = document.getElementById('view-container');
    container.innerHTML = `<div class="flex-center" style="padding: 60px;"><div class="spinner">Loading dashboard...</div></div>`;

    try {
        const data = await apiFetch('/student/dashboard');
        const { student, stats, recent_notifications, recent_attendance } = data;

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
