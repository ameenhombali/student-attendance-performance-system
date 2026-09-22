/* Utility Functions for Smart Student Attendance Application */

const API_BASE = '/api';

// Token Management
function getToken() {
    return localStorage.getItem('college_auth_token');
}

function getUser() {
    const userStr = localStorage.getItem('college_user_info');
    return userStr ? JSON.parse(userStr) : null;
}

function setSession(token, user) {
    localStorage.setItem('college_auth_token', token);
    localStorage.setItem('college_user_info', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('college_auth_token');
    localStorage.removeItem('college_user_info');
}

// API Request Wrapper with Auth Header
async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json();

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            // Unauthorized / Token Expired
            if (endpoint !== '/auth/login') {
                clearSession();
                window.location.reload();
            }
        }
        throw new Error(data.message || data.error || 'An error occurred');
    }

    return data;
}

// Toast Notifications
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : '⚠️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Date Formatter (YYYY-MM-DD -> 18 Sep 2026)
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Percentage Status Badge HTML Generator
function getStatusBadgeHTML(percentage, minThreshold = 75) {
    if (percentage >= 85) {
        return `<span class="badge badge-green">🟢 ${percentage}% Good</span>`;
    } else if (percentage >= minThreshold) {
        return `<span class="badge badge-yellow">🟡 ${percentage}% Warning</span>`;
    } else {
        return `<span class="badge badge-red">🔴 ${percentage}% Low</span>`;
    }
}

// Academic Year Formatter (Semester 5 -> 3rd Year)
function getAcademicYear(semester) {
    if (!semester) return '3rd Year';
    const yearNum = Math.ceil(semester / 2);
    const suffixes = ['st', 'nd', 'rd', 'th'];
    const suffix = (yearNum >= 1 && yearNum <= 3) ? suffixes[yearNum - 1] : 'th';
    return `${yearNum}${suffix} Year`;
}

// Reset Demo Data Helper
async function resetDemoData() {
    if (!confirm('Are you sure you want to reset the database to initial demo state? All newly marked attendance will be reset.')) return;
    try {
        const res = await apiFetch('/settings/reset-demo', { method: 'POST' });
        showToast(res.message, 'success');
        setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
        showToast('Failed to reset demo database: ' + err.message, 'error');
    }
}

