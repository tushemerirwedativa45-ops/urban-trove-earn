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

async function loadPanelData() {
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

    const BACKEND = window.location.origin;

    try {
        const usersRes     = await fetch(`${BACKEND}/api/view-users`);
        const usersData    = await usersRes.json();
        const users        = usersData.users || [];

        const depositsRes  = await fetch(`${BACKEND}/api/view-deposits`);
        const depositsData = await depositsRes.json();
        const deposits     = depositsData.deposits || [];

        const withdrawRes  = await fetch(`${BACKEND}/api/view-withdrawals`);
        const withdrawData = await withdrawRes.json();
        const withdrawals  = withdrawData.withdrawals || [];

        const referrals    = deposits.filter(d => d.referral_code && d.referral_code !== '');
        const totalInvested  = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
        const totalWithdrawn = withdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);
        const netBalance     = totalInvested - totalWithdrawn;

        // ── Stat boxes ──
        setEl('stat-total-users',       users.length);
        setEl('stat-total-deposits',    deposits.length);
        setEl('stat-referral-deposits', referrals.length);
        setEl('stat-vip-tier',          users.length > 0 ? (users[0].vip_tier || 'None') : 'None');

        // ── Chart stat cards ──
        setEl('chart-total-invested',   'UGX ' + totalInvested.toLocaleString());
        setEl('chart-total-withdrawn',  'UGX ' + totalWithdrawn.toLocaleString());
        setEl('chart-net-balance',      'UGX ' + netBalance.toLocaleString());
        setEl('chart-active-investors', users.length);

        // ── Build chart data ──
        buildCharts(deposits, withdrawals);
        buildRecentDeposits(deposits);

    } catch (err) {
        console.error('[ADMIN] Failed to load data:', err.message);
    }
}

// ── Build all charts ──────────────────────────────────────────
function buildCharts(deposits, withdrawals) {
    // Group deposits by date
    const dateMap = {};
    deposits.forEach(d => {
        const date = d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Unknown';
        if (!dateMap[date]) dateMap[date] = 0;
        dateMap[date] += Number(d.amount || 0);
    });

    const labels  = Object.keys(dateMap).slice(-10); // last 10 dates
    const amounts = labels.map(l => dateMap[l]);

    // ── Line Chart — Investments Over Time ──
    const lineCtx = document.getElementById('investmentLineChart');
    if (lineCtx) {
        if (window._lineChart) window._lineChart.destroy();
        window._lineChart = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['No data'],
                datasets: [{
                    label: 'UGX Invested',
                    data: amounts.length > 0 ? amounts : [0],
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40,167,69,0.15)',
                    borderWidth: 2,
                    pointBackgroundColor: '#FFD700',
                    pointRadius: 5,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#aaa' } } },
                scales: {
                    x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#aaa', callback: v => 'UGX ' + Number(v).toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    // ── Bar Chart — Deposits vs Withdrawals ──
    const barCtx = document.getElementById('depositBarChart');
    if (barCtx) {
        if (window._barChart) window._barChart.destroy();
        const totalDep = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
        const totalWd  = withdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);
        window._barChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Total Deposits', 'Total Withdrawals', 'Net Profit'],
                datasets: [{
                    label: 'UGX',
                    data: [totalDep, totalWd, totalDep - totalWd],
                    backgroundColor: ['rgba(40,167,69,0.7)', 'rgba(220,53,69,0.7)', 'rgba(255,215,0,0.7)'],
                    borderColor:     ['#28a745', '#dc3545', '#FFD700'],
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#aaa', callback: v => 'UGX ' + Number(v).toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    // ── Doughnut Chart — Investment Plans ──
    const doughCtx = document.getElementById('plansDoughnutChart');
    if (doughCtx) {
        if (window._doughChart) window._doughChart.destroy();
        const planCounts = { '30000': 0, '40000': 0, '50000': 0, '60000': 0, 'Custom': 0 };
        deposits.forEach(d => {
            const amt = String(d.amount);
            if (planCounts[amt] !== undefined) planCounts[amt]++;
            else planCounts['Custom']++;
        });
        window._doughChart = new Chart(doughCtx, {
            type: 'doughnut',
            data: {
                labels: ['UGX 30K Plan', 'UGX 40K Plan', 'UGX 50K Plan', 'UGX 60K Plan', 'Custom'],
                datasets: [{
                    data: Object.values(planCounts),
                    backgroundColor: ['#28a745','#FFD700','#00cfff','#c084fc','#ff9900'],
                    borderColor: '#0a0a2a',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#aaa', font: { size: 11 } } }
                }
            }
        });
    }
}

// ── Recent deposits list ──────────────────────────────────────
function buildRecentDeposits(deposits) {
    const el = document.getElementById('recent-deposits-list');
    if (!el) return;
    const recent = deposits.slice(0, 8);
    if (recent.length === 0) {
        el.innerHTML = '<div style="color:#555;text-align:center;padding:20px;">No deposits yet.</div>';
        return;
    }
    el.innerHTML = recent.map(d => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div>
                <div style="color:#ddd;font-size:0.82rem;">${escHtml(d.email || '—')}</div>
                <div style="color:#888;font-size:0.75rem;">${escHtml(d.created_at || '—')}</div>
            </div>
            <div style="color:#28a745;font-weight:bold;font-size:0.9rem;">UGX ${Number(d.amount).toLocaleString()}</div>
        </div>`).join('');
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

    // Admin change password
    const adminPwdForm = document.getElementById('admin-change-pwd-form');
    if (adminPwdForm) {
        adminPwdForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const adminName = sessionStorage.getItem(ADMIN_SESSION_KEY);
            const current   = document.getElementById('acp-current').value;
            const newPwd    = document.getElementById('acp-new').value;
            const confirm   = document.getElementById('acp-confirm').value;
            const status    = document.getElementById('acp-status');

            const admin = ADMINS.find(a => a.username.toLowerCase() === adminName.toLowerCase());
            if (!admin || current !== admin.password) {
                status.textContent = '❌ Current password is incorrect.';
                status.style.cssText = 'display:block;background:rgba(220,53,69,0.2);color:#ff6b6b;border:1px solid #dc3545;';
                return;
            }
            if (newPwd.length < 5) {
                status.textContent = '❌ New password must be at least 5 characters.';
                status.style.cssText = 'display:block;background:rgba(220,53,69,0.2);color:#ff6b6b;border:1px solid #dc3545;';
                return;
            }
            if (newPwd !== confirm) {
                status.textContent = '❌ Passwords do not match.';
                status.style.cssText = 'display:block;background:rgba(220,53,69,0.2);color:#ff6b6b;border:1px solid #dc3545;';
                return;
            }
            admin.password = newPwd;
            status.textContent = '✅ Password updated successfully! Remember your new password.';
            status.style.cssText = 'display:block;background:rgba(40,167,69,0.2);color:#28a745;border:1px solid #28a745;';
            adminPwdForm.reset();
        });
    }
}
