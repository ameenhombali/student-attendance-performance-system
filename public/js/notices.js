/* ==========================================================
   Notice Board Module (Student, Faculty & Admin)
   ========================================================== */

let currentNoticeCategory = 'All';
let noticeSearchQuery = '';

async function renderNoticesView() {
    const container = document.getElementById('view-container');
    const user = getUser();
    const canCreate = user && (user.role === 'admin' || user.role === 'faculty');

    container.innerHTML = `
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
            <div>
                <h2>📢 College Notice Board</h2>
                <p style="color:var(--text-muted); font-size:0.88rem;">Official announcements, circulars, examination notices, and holiday schedules.</p>
            </div>
            ${canCreate ? `
                <button class="btn-primary" onclick="openCreateNoticeModal()" style="display:flex; align-items:center; gap:8px;">
                    <span>➕</span> Publish Notice
                </button>
            ` : ''}
        </div>

        <div class="notices-filter-bar">
            <div class="category-pills" id="notice-category-pills">
                <button class="cat-pill ${currentNoticeCategory === 'All' ? 'active' : ''}" onclick="filterNoticesByCategory('All')">All Notices</button>
                <button class="cat-pill ${currentNoticeCategory === 'Academic' ? 'active' : ''}" onclick="filterNoticesByCategory('Academic')">📘 Academic</button>
                <button class="cat-pill ${currentNoticeCategory === 'Examination' ? 'active' : ''}" onclick="filterNoticesByCategory('Examination')">📝 Examination</button>
                <button class="cat-pill ${currentNoticeCategory === 'Events' ? 'active' : ''}" onclick="filterNoticesByCategory('Events')">🎉 Events</button>
                <button class="cat-pill ${currentNoticeCategory === 'Holidays' ? 'active' : ''}" onclick="filterNoticesByCategory('Holidays')">🏖️ Holidays</button>
                <button class="cat-pill ${currentNoticeCategory === 'General' ? 'active' : ''}" onclick="filterNoticesByCategory('General')">📌 General</button>
            </div>

            <div style="position:relative; min-width:240px;">
                <input type="text" id="notice-search-input" class="form-control" placeholder="Search notices..." 
                       value="${noticeSearchQuery}" oninput="searchNotices(this.value)" style="padding-left:36px;">
                <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);">🔍</span>
            </div>
        </div>

        <div id="notices-list-container">
            <div style="text-align:center; padding:40px; color:var(--text-muted);">Loading notice board...</div>
        </div>
    `;

    loadNotices();
}

function filterNoticesByCategory(cat) {
    currentNoticeCategory = cat;
    document.querySelectorAll('#notice-category-pills .cat-pill').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(cat) || (cat === 'All' && btn.textContent === 'All Notices'));
    });
    loadNotices();
}

let noticeSearchTimeout = null;
function searchNotices(query) {
    noticeSearchQuery = query.trim();
    clearTimeout(noticeSearchTimeout);
    noticeSearchTimeout = setTimeout(() => {
        loadNotices();
    }, 300);
}

async function loadNotices() {
    const listContainer = document.getElementById('notices-list-container');
    if (!listContainer) return;

    try {
        let endpoint = `/notices?category=${encodeURIComponent(currentNoticeCategory)}`;
        if (noticeSearchQuery) {
            endpoint += `&search=${encodeURIComponent(noticeSearchQuery)}`;
        }

        const data = await apiFetch(endpoint);
        const notices = data.notices || [];

        if (notices.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state" style="text-align:center; padding:60px 20px; background:var(--card-bg); border-radius:12px; border:1px solid var(--border-color);">
                    <div style="font-size:3rem; margin-bottom:12px;">📭</div>
                    <h3>No Notices Found</h3>
                    <p style="color:var(--text-muted); max-width:400px; margin:8px auto;">There are no active notices published in this category matching your search criteria.</p>
                </div>
            `;
            return;
        }

        const user = getUser();
        const canDelete = (n) => user && (user.role === 'admin' || (user.role === 'faculty' && n.published_by === user.id));

        listContainer.innerHTML = `
            <div class="notice-grid">
                ${notices.map(n => `
                    <div class="notice-card ${n.is_important ? 'important' : ''}" onclick="openViewNoticeModal(${n.id})">
                        <div>
                            <div class="notice-badge-group">
                                <span class="notice-badge badge-${n.category}">${n.category}</span>
                                ${n.is_important ? `<span class="notice-badge badge-important-star">⭐ Important</span>` : ''}
                                ${n.is_read ? `<span style="font-size:0.7rem; color:var(--text-muted);">✓ Read</span>` : `<span style="font-size:0.7rem; color:#10b981; font-weight:700;">● Unread</span>`}
                            </div>
                            <h3 class="notice-title">${escapeHtml(n.title)}</h3>
                            <p class="notice-desc">${escapeHtml(n.description)}</p>
                            ${n.attachment_name ? `
                                <div style="display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; color:#818cf8; background:rgba(99,102,241,0.1); padding:4px 10px; border-radius:6px; margin-bottom:12px;">
                                    📎 ${escapeHtml(n.attachment_name)}
                                </div>
                            ` : ''}
                        </div>

                        <div class="notice-meta">
                            <div>
                                <span>🗓️ ${formatDate(n.publish_date)}</span>
                                <span style="margin-left:8px;">👤 ${escapeHtml(n.publisher_name)}</span>
                            </div>
                            ${canDelete(n) ? `
                                <button onclick="event.stopPropagation(); deleteNotice(${n.id})" 
                                        style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.9rem;" 
                                        title="Delete Notice">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        listContainer.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
}

async function openViewNoticeModal(noticeId) {
    try {
        const data = await apiFetch(`/notices/${noticeId}`);
        const n = data.notice;
        const modal = document.getElementById('app-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        title.textContent = n.title;
        body.innerHTML = `
            <div style="padding:10px 0;">
                <div style="display:flex; gap:8px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
                    <span class="notice-badge badge-${n.category}">${n.category}</span>
                    ${n.is_important ? `<span class="notice-badge badge-important-star">⭐ Important</span>` : ''}
                    <span style="font-size:0.75rem; color:var(--text-muted);">Published on ${formatDate(n.publish_date)} by <strong>${escapeHtml(n.publisher_name)}</strong></span>
                    ${n.expiry_date ? `<span style="font-size:0.75rem; color:var(--text-muted);">• Valid until: ${formatDate(n.expiry_date)}</span>` : ''}
                </div>

                <div style="white-space:pre-wrap; line-height:1.6; color:var(--text-primary); font-size:0.95rem; margin-bottom:20px; background:rgba(255,255,255,0.02); padding:16px; border-radius:8px; border:1px solid var(--border-color);">
                    ${escapeHtml(n.description)}
                </div>

                ${n.attachment_data ? `
                    <div style="margin-top:16px; padding:14px; background:rgba(99,102,241,0.08); border-radius:8px; border:1px solid rgba(99,102,241,0.2); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:600; font-size:0.88rem; color:#818cf8;">Attached Document</div>
                            <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(n.attachment_name || 'Notice_Attachment.pdf')}</div>
                        </div>
                        <a href="${n.attachment_data}" download="${n.attachment_name || 'Notice_Attachment.pdf'}" class="btn-primary" style="padding:6px 14px; font-size:0.82rem; text-decoration:none;">
                            ⬇️ Download Attachment
                        </a>
                    </div>
                ` : ''}
            </div>
        `;

        modal.classList.add('active');
        // Refresh notices list to update read badge
        loadNotices();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function openCreateNoticeModal() {
    const modal = document.getElementById('app-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '📢 Publish Official Notice';
    body.innerHTML = `
        <form id="create-notice-form" onsubmit="submitNotice(event)">
            <div class="form-group">
                <label>Notice Title *</label>
                <input type="text" id="notice-form-title" class="form-control" placeholder="e.g. Mid-Term Examination Schedule" required>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                    <label>Category *</label>
                    <select id="notice-form-category" class="form-control" required>
                        <option value="Academic">Academic</option>
                        <option value="Examination">Examination</option>
                        <option value="Events">Events</option>
                        <option value="Holidays">Holidays</option>
                        <option value="General">General</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Expiry Date (Optional)</label>
                    <input type="date" id="notice-form-expiry" class="form-control">
                </div>
            </div>

            <div class="form-group">
                <label>Notice Content & Description *</label>
                <textarea id="notice-form-desc" class="form-control" rows="5" placeholder="Detailed notification circular text..." required></textarea>
            </div>

            <div class="form-group" style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="notice-form-important" style="width:18px; height:18px; accent-color:#f59e0b;">
                <label for="notice-form-important" style="margin:0; cursor:pointer; font-weight:600; color:#f59e0b;">
                    ⭐ Mark as High Priority / Important (Pin to top)
                </label>
            </div>

            <div class="form-group">
                <label>Attach PDF or Document (Optional)</label>
                <input type="file" id="notice-form-file" class="form-control" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg">
                <small style="color:var(--text-muted); font-size:0.75rem;">Supports PDF, Word Documents, and Images up to 20MB.</small>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button type="button" class="btn-demo" onclick="document.getElementById('app-modal').classList.remove('active')">Cancel</button>
                <button type="submit" class="btn-primary" id="publish-notice-btn">Publish Notice →</button>
            </div>
        </form>
    `;

    modal.classList.add('active');
}

async function submitNotice(e) {
    e.preventDefault();
    const btn = document.getElementById('publish-notice-btn');
    btn.disabled = true;
    btn.textContent = 'Publishing...';

    const title = document.getElementById('notice-form-title').value.trim();
    const description = document.getElementById('notice-form-desc').value.trim();
    const category = document.getElementById('notice-form-category').value;
    const expiry_date = document.getElementById('notice-form-expiry').value || null;
    const is_important = document.getElementById('notice-form-important').checked;
    const fileInput = document.getElementById('notice-form-file');

    let attachment_name = null;
    let attachment_data = null;

    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        attachment_name = file.name;
        attachment_data = await fileToBase64(file);
    }

    try {
        await apiFetch('/notices', {
            method: 'POST',
            body: JSON.stringify({
                title,
                description,
                category,
                expiry_date,
                is_important,
                attachment_name,
                attachment_data
            })
        });

        showToast('Notice published successfully!', 'success');
        document.getElementById('app-modal').classList.remove('active');
        loadNotices();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Publish Notice →';
    }
}

async function deleteNotice(noticeId) {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
        await apiFetch(`/notices/${noticeId}`, { method: 'DELETE' });
        showToast('Notice deleted successfully.', 'success');
        loadNotices();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}
