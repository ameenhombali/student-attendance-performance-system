/* Authentication Page Logic & Quick Demo Login Handlers */

let currentPortal = 'student';

function initAuthView() {
    const roleTabs = document.querySelectorAll('.role-tab');
    roleTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            roleTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentPortal = e.target.dataset.role;

            const inputLabel = document.getElementById('login-identifier-label');
            const inputField = document.getElementById('usernameOrId');
            if (currentPortal === 'student') {
                inputLabel.textContent = 'USN / Student Username';
                inputField.placeholder = 'e.g. 3CS001 or ameen';
            } else if (currentPortal === 'faculty') {
                inputLabel.textContent = 'Faculty ID / Email / Username';
                inputField.placeholder = 'e.g. F101 or sharma';
            } else if (currentPortal === 'admin') {
                inputLabel.textContent = 'Admin Username / Email';
                inputField.placeholder = 'e.g. admin or admin@college.edu';
            }
        });
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const forgotBtn = document.getElementById('forgot-password-btn');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', handleForgotPassword);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const usernameOrId = document.getElementById('usernameOrId').value.trim();
    const password = document.getElementById('password').value;

    if (!usernameOrId || !password) {
        showToast('Please enter both username/ID and password.', 'error');
        return;
    }

    try {
        const res = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                usernameOrId,
                password,
                portalType: currentPortal
            })
        });

        setSession(res.token, res.user);
        showToast(`Welcome back, ${res.user.full_name}!`, 'success');

        // Redirect to appropriate dashboard view
        if (res.user.role === 'student') {
            window.location.hash = '#student-dashboard';
        } else if (res.user.role === 'admin') {
            window.location.hash = '#admin-dashboard';
        } else {
            window.location.hash = '#faculty-dashboard';
        }
        window.location.reload();
    } catch (err) {
        showToast(err.message || 'Invalid USN or password.', 'error');
    }
}

function quickDemoLogin(username, role) {
    // Select tab
    const roleTab = document.querySelector(`.role-tab[data-role="${role}"]`);
    if (roleTab) roleTab.click();

    document.getElementById('usernameOrId').value = username;
    let pwd = 'password123';
    if (role === 'student') pwd = 'student123';
    else if (role === 'admin') pwd = 'admin123';

    document.getElementById('password').value = pwd;

    // Trigger submit
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
}

async function handleForgotPassword() {
    const input = prompt('Enter your USN, Faculty ID, or registered Email address:');
    if (!input) return;

    try {
        const res = await apiFetch('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ identifier: input })
        });
        alert(res.message);
    } catch (err) {
        alert(err.message);
    }
}
