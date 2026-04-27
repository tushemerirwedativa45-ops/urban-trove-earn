// Admin credentials — only these 5 can access the panel
const ADMINS = [
    { username: 'kabs the coder',           password: '45k45a@#' },
    { username: 'heptaknight',              password: '45450'    },
    { username: 'patrick forex raider',     password: '45450'    },
    { username: 'john baptist forex raider',password: '45450'    },
    { username: 'tonny',                    password: '45450'    }
];

const ADMIN_SESSION_KEY = 'ute_admin_session';

// ── Login page logic ──────────────────────────────────────────────
const loginForm = document.getElementById('admin-login-form');
if (loginForm) {
    // If already logged in as admin, go straight to panel
    if (sessionStorage.getItem(ADMIN_SESSION_KEY)) {
        window.location.href = 'admin-panel.html';
    }

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('admin-username').value.trim();
        const password = document.getElementById('admin-password').value;
        const status   = document.getElementById('admin-login-status');

        const match = ADMINS.find(a =>
            a.username.toLowerCase() === username.toLowerCase() && a.password === password
        );

        if (match) {
            sessionStorage.setItem(ADMIN_SESSION_KEY, match.username);
            status.textContent = 'Access granted. Loading panel...';
            status.className = 'success';
            status.style.display = 'block';
            setTimeout(() => { window.location.href = 'admin-panel.html'; }, 800);
        } else {
            status.textContent = 'Invalid username or password. Access denied.';
            status.className = 'error';
            status.style.display = 'block';
        }
    });
}

// ── Panel page logic ──────────────────────────────────────────────
function adminLogout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = 'admin.html';
}

function loadPanelData() {
    const adminName = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!adminName) {
        window.location.href = 'admin.html';
        return;
    }

    const displayEl = document.getElementById('admin-display-name');
    const welcomeEl = document.getElementById('admin-welcome-name');
    if (displayEl) displayEl.textContent = adminName;
    if (welcomeEl) welcomeEl.textContent = 'Welcome, ' + adminName;

    const refreshEl = document.getElementById('refresh-time');
    if (refreshEl) refreshEl.textContent = new Date().toLocaleString();

    const stored = localStorage.getItem('urbanTroveData');
    const data = stored ? JSON.parse(stored) : null;

    const hasUser      = data && data.registeredUser;
    const transactions = (data && data.transactions) ? data.transactions : [];
    const deposits     = transactions.filter(t => t.type === 'Deposit');
    const referrals    = transactions.filter(t => t.type === 'Referral Deposit');

    setEl('stat-total-users',       hasUser ? 1 : 0);
    setEl('stat-total-deposits',    deposits.length);
    setEl('stat-referral-deposits', referrals.length);
    setEl('stat-vip-tier',          (data && data.vipTier) ? data.vipTier : 'None');
}

function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escHtml(str) {
    if (!str) return '—';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Run panel loader if we are on the panel page
if (document.getElementById('stat-total-users')) {
    loadPanelData();
}
