/* ==========================================================
   Study Material Sharing Module (Student, Faculty & Admin)
   ========================================================== */

let materialSearchQuery = '';
let selectedMaterialSubject = '';

async function renderMaterialsView() {
    const container = document.getElementById('view-container');
    const user = getUser();
    const canUpload = user && (user.role === 'admin' || user.role === 'faculty');

    container.innerHTML = `
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
            <div>
                <h2>📖 Academic Study Materials</h2>
                <p style="color:var(--text-muted); font-size:0.88rem;">Download lecture notes, question banks, slide decks, and laboratory manuals.</p>
            </div>
            ${canUpload ? `
                <button class="btn-primary" onclick="openUploadMaterialModal()" style="display:flex; align-items:center; gap:8px;">
                    <span>📤</span> Upload Study Material
                </button>
            ` : ''}
        </div>

        <div class="notices-filter-bar" style="margin-bottom:20px;">
            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                <div style="min-width:200px;">
                    <select id="material-subject-filter" class="form-control" onchange="filterMaterialsBySubject(this.value)">
                        <option value="">All Subjects</option>
                    </select>
                </div>
            </div>

            <div style="position:relative; min-width:260px;">
                <input type="text" id="material-search-input" class="form-control" placeholder="Search by topic, subject..." 
                       value="${materialSearchQuery}" oninput="searchMaterials(this.value)" style="padding-left:36px;">
                <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);">🔍</span>
            </div>
        </div>

        <div id="materials-list-container">
            <div style="text-align:center; padding:40px; color:var(--text-muted);">Loading study materials...</div>
        </div>
    `;

    populateMaterialSubjectsDropdown();
    loadMaterials();
}

async function populateMaterialSubjectsDropdown() {
    try {
        const user = getUser();
        let subjects = [];
        if (user.role === 'student') {
            const data = await apiFetch('/student/subjects');
            subjects = data.subjects || [];
        } else if (user.role === 'faculty') {
            const data = await apiFetch('/faculty/subjects');
            subjects = data.subjects || [];
        } else {
            const data = await apiFetch('/admin/subjects');
            subjects = data.subjects || [];
        }

        const select = document.getElementById('material-subject-filter');
        if (!select) return;

        select.innerHTML = `<option value="">All Subjects</option>` + 
            subjects.map(s => `<option value="${s.id || s.subject_id}">${escapeHtml(s.code)} - ${escapeHtml(s.name)}</option>`).join('');
    } catch (e) {
        console.warn('Could not populate subjects filter:', e);
    }
}

function filterMaterialsBySubject(subId) {
    selectedMaterialSubject = subId;
    loadMaterials();
}

let materialSearchTimeout = null;
function searchMaterials(q) {
    materialSearchQuery = q.trim();
    clearTimeout(materialSearchTimeout);
    materialSearchTimeout = setTimeout(() => {
        loadMaterials();
    }, 300);
}

async function loadMaterials() {
    const container = document.getElementById('materials-list-container');
    if (!container) return;

    try {
        let endpoint = '/materials?';
        if (selectedMaterialSubject) endpoint += `&subject_id=${encodeURIComponent(selectedMaterialSubject)}`;
        if (materialSearchQuery) endpoint += `&search=${encodeURIComponent(materialSearchQuery)}`;

        const data = await apiFetch(endpoint);
        const materials = data.materials || [];

        if (materials.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align:center; padding:60px 20px; background:var(--card-bg); border-radius:12px; border:1px solid var(--border-color);">
                    <div style="font-size:3rem; margin-bottom:12px;">📚</div>
                    <h3>No Study Materials Uploaded Yet</h3>
                    <p style="color:var(--text-muted); max-width:420px; margin:8px auto;">
                        Materials uploaded by faculty for your semester and enrolled subjects will appear here.
                    </p>
                </div>
            `;
            return;
        }

        const user = getUser();
        const canDelete = (m) => user && (user.role === 'admin' || (user.role === 'faculty'));

        container.innerHTML = `
            <div class="materials-grid">
                ${materials.map(m => {
                    const ext = (m.file_type || m.file_name.split('.').pop() || 'FILE').toUpperCase();
                    let typeClass = 'type-FILE';
                    if (ext.includes('PDF')) typeClass = 'type-PDF';
                    else if (ext.includes('PPT')) typeClass = 'type-PPT';
                    else if (ext.includes('DOC')) typeClass = 'type-DOC';

                    const fileSizeFormatted = m.file_size ? `${(m.file_size / 1024).toFixed(1)} KB` : 'Doc';

                    return `
                        <div class="material-card">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                    <div class="file-type-icon ${typeClass}">
                                        ${ext.slice(0, 4)}
                                    </div>
                                    <span style="font-size:0.75rem; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:3px 8px; border-radius:6px;">
                                        Sem ${m.semester}
                                    </span>
                                </div>

                                <div style="font-size:0.75rem; color:var(--primary-color); font-weight:600; text-transform:uppercase; margin-bottom:4px;">
                                    ${escapeHtml(m.subject_code)} • ${escapeHtml(m.department_code)}
                                </div>
                                <h3 style="font-size:1.02rem; font-weight:700; color:var(--text-primary); margin:0 0 6px;">
                                    ${escapeHtml(m.title)}
                                </h3>
                                ${m.description ? `
                                    <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4; margin-bottom:12px;">
                                        ${escapeHtml(m.description)}
                                    </p>
                                ` : ''}
                            </div>

                            <div>
                                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px; display:flex; justify-content:space-between;">
                                    <span>👤 ${escapeHtml(m.faculty_name)}</span>
                                    <span>📦 ${fileSizeFormatted}</span>
                                </div>

                                <div style="display:flex; gap:8px;">
                                    <button class="btn-primary" onclick="downloadMaterialFile(${m.id})" 
                                            style="flex:1; padding:8px 12px; font-size:0.82rem; display:flex; align-items:center; justify-content:center; gap:6px;">
                                        ⬇️ Download
                                    </button>
                                    ${canDelete(m) ? `
                                        <button onclick="deleteMaterialFile(${m.id})" 
                                                style="padding:8px 12px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:8px; cursor:pointer;" 
                                                title="Delete File">🗑️</button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

async function downloadMaterialFile(id) {
    try {
        showToast('Preparing download...', 'info');
        const data = await apiFetch(`/materials/${id}`);
        const m = data.material;

        if (!m || !m.file_data) {
            throw new Error('Material download link not available.');
        }

        const a = document.createElement('a');
        a.href = m.file_data;
        a.download = m.file_name || 'Study_Material';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast(`Downloaded ${m.file_name}`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteMaterialFile(id) {
    if (!confirm('Are you sure you want to delete this study material?')) return;
    try {
        await apiFetch(`/materials/${id}`, { method: 'DELETE' });
        showToast('Study material deleted.', 'success');
        loadMaterials();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function openUploadMaterialModal() {
    const modal = document.getElementById('app-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '📤 Upload Study Material';

    // Fetch faculty subjects
    let subjects = [];
    const user = getUser();
    try {
        if (user.role === 'faculty') {
            const data = await apiFetch('/faculty/subjects');
            subjects = data.subjects || [];
        } else {
            const data = await apiFetch('/admin/subjects');
            subjects = data.subjects || [];
        }
    } catch (e) {}

    body.innerHTML = `
        <form id="upload-material-form" onsubmit="submitStudyMaterial(event)">
            <div class="form-group">
                <label>Material Title *</label>
                <input type="text" id="mat-form-title" class="form-control" placeholder="e.g. Unit 3: Graph Algorithms & Dynamic Programming" required>
            </div>

            <div class="form-group">
                <label>Target Subject *</label>
                <select id="mat-form-subject" class="form-control" required>
                    <option value="">-- Select Subject --</option>
                    ${subjects.map(s => `<option value="${s.id}">${escapeHtml(s.code)} - ${escapeHtml(s.name)} (Sem ${s.semester})</option>`).join('')}
                </select>
            </div>

            <div class="form-group">
                <label>Description / Notes for Students</label>
                <textarea id="mat-form-desc" class="form-control" rows="3" placeholder="Brief summary of topics covered in this document..."></textarea>
            </div>

            <div class="form-group">
                <label>Choose File (PDF, PPT/PPTX, DOC/DOCX) *</label>
                <input type="file" id="mat-form-file" class="form-control" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt" required>
                <small style="color:var(--text-muted); font-size:0.75rem;">Supported file formats: PDF, PowerPoint slides, Word documents up to 20MB.</small>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button type="button" class="btn-demo" onclick="document.getElementById('app-modal').classList.remove('active')">Cancel</button>
                <button type="submit" class="btn-primary" id="upload-mat-btn">Upload Material →</button>
            </div>
        </form>
    `;

    modal.classList.add('active');
}

async function submitStudyMaterial(e) {
    e.preventDefault();
    const btn = document.getElementById('upload-mat-btn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    const title = document.getElementById('mat-form-title').value.trim();
    const subject_id = document.getElementById('mat-form-subject').value;
    const description = document.getElementById('mat-form-desc').value.trim();
    const fileInput = document.getElementById('mat-form-file');

    if (!fileInput.files || !fileInput.files[0]) {
        showToast('Please select a file to upload.', 'error');
        btn.disabled = false;
        btn.textContent = 'Upload Material →';
        return;
    }

    const file = fileInput.files[0];
    const file_name = file.name;
    const file_size = file.size;
    const ext = file_name.split('.').pop().toUpperCase();
    const file_type = ext;

    try {
        const file_data = await fileToBase64(file);
        await apiFetch('/materials', {
            method: 'POST',
            body: JSON.stringify({
                title,
                subject_id,
                description,
                file_name,
                file_type,
                file_size,
                file_data
            })
        });

        showToast('Study material uploaded successfully!', 'success');
        document.getElementById('app-modal').classList.remove('active');
        loadMaterials();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload Material →';
    }
}
