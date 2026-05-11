// Owners credentials — only these 4 can access
const OWNERS = [
    { username: 'kabs the coder',            password: '45k45a@#', key: 'kabs'    },
    { username: 'heptaknight',               password: '4545',     key: 'hepta'   },
    { username: 'patrick forex raider',      password: '4545',     key: 'patrick' },
    { username: 'john baptist forex raider', password: '4545',     key: 'john'    }
];

const OWNER_SESSION_KEY  = 'ute_owner_session';
const OWNER_CHAT_KEY     = 'ute_owner_chat';

// ── Owners login page logic ───────────────────────────────────────
const ownersLoginForm = document.getElementById('owners-login-form');
if (ownersLoginForm) {
    if (sessionStorage.getItem(OWNER_SESSION_KEY)) {
        window.location.href = 'owners.html';
    }

    ownersLoginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('owner-username').value.trim();
        const password = document.getElementById('owner-password').value;
        const status   = document.getElementById('owners-login-status');

        const match = OWNERS.find(o =>
            o.username.toLowerCase() === username.toLowerCase() && o.password === password
        );

        if (match) {
            sessionStorage.setItem(OWNER_SESSION_KEY, JSON.stringify({ username: match.username, key: match.key }));
            status.textContent = 'Access granted. Loading Owners Page...';
            status.className = 'success';
            status.style.display = 'block';
            setTimeout(() => { window.location.href = 'owners.html'; }, 800);
        } else {
            status.textContent = 'Access denied. You are not an authorised owner.';
            status.className = 'error';
            status.style.display = 'block';
        }
    });
}

// ── Guard: must be called on owners.html ─────────────────────────
function guardOwnerPage() {
    const session = sessionStorage.getItem(OWNER_SESSION_KEY);
    if (!session) {
        window.location.href = 'owners-login.html';
        return null;
    }
    return JSON.parse(session);
}

// ── Tab switching ─────────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    event.currentTarget.classList.add('active');

    if (name === 'chat') {
        loadChat();
        scrollChatToBottom();
    }
    if (name === 'auditlog') {
        loadAuditLog();
    }
}

// ── Logout ────────────────────────────────────────────────────────
function ownersLogout() {
    sessionStorage.removeItem(OWNER_SESSION_KEY);
    window.location.href = 'admin.html';
}

// ── Helpers ───────────────────────────────────────────────────────
function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function escHtml(str) {
    if (!str) return '—';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Load overview & transactions data from DATABASE ─────────────
async function loadData(ownerKey) {
    const BACKEND = window.location.origin;

    // Always load local data first so owners see data immediately
    const localUsers    = loadLocalUsers();
    const localDeposits = loadLocalDeposits();

    let dbUsers     = [];
    let dbDeposits  = [];
    let dbWithdrawals = [];

    // Try to fetch from backend database
    try {
        const [usersRes, depositsRes, withdrawRes] = await Promise.all([
            fetch(`${BACKEND}/api/view-users`),
            fetch(`${BACKEND}/api/view-deposits`),
            fetch(`${BACKEND}/api/view-withdrawals`)
        ]);
        const usersData    = await usersRes.json();
        const depositsData = await depositsRes.json();
        const withdrawData = await withdrawRes.json();
        dbUsers      = usersData.users      || [];
        dbDeposits   = depositsData.deposits || [];
        dbWithdrawals = withdrawData.withdrawals || [];
    } catch (err) {
        console.log('[OWNERS] Backend offline, using local data only');
    }

    // Merge database + local data, avoid duplicates by email
    const seenEmails = new Set(dbUsers.map(u => u.email));
    const extraLocalUsers = localUsers.filter(u => !seenEmails.has(u.email));
    const allUsers = [...dbUsers, ...extraLocalUsers];

    const seenRefs = new Set(dbDeposits.map(d => d.tx_ref));
    const extraLocalDeposits = localDeposits.filter(d => !seenRefs.has(d.tx_ref));
    const allDeposits = [...dbDeposits, ...extraLocalDeposits];

    const totalDeposited = allDeposits.reduce((s, d) => s + Number(d.amount || 0), 0);
    const totalWithdrawn = dbWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);

    // Overview stats
    setEl('ov-users',    allUsers.length);
    setEl('ov-deposits', allDeposits.length);
    setEl('ov-amount',   'UGX ' + totalDeposited.toLocaleString());
    setEl('ov-earnings', 'UGX ' + totalWithdrawn.toLocaleString());
    setEl('ov-referrals', allDeposits.filter(d => d.referral_code).length);
    setEl('ov-vip', '—');

    // Users table
    const userTableEl = document.getElementById('ov-user-table');
    if (userTableEl) {
        if (allUsers.length === 0) {
            userTableEl.innerHTML = '<div class="empty-state">No users registered yet.</div>';
        } else {
            const rows = allUsers.map((u, i) => {
                const userDeposits = allDeposits.filter(d => d.email === u.email);
                const hasDeposited = userDeposits.length > 0;
                const totalUserDeposits = userDeposits.reduce((s, d) => s + Number(d.amount || 0), 0);

                let planDetails = 'No deposits yet';
                if (hasDeposited) {
                    planDetails = userDeposits.map(d => {
                        const amount = Number(d.amount || 0);
                        let planType, expectedReturn;
                        if (amount === 30000)      { planType = 'Plan 1 (Entry)';    expectedReturn = 'UGX 36,900'; }
                        else if (amount === 40000) { planType = 'Plan 2 (Popular)';  expectedReturn = 'UGX 49,200'; }
                        else if (amount === 50000) { planType = 'Plan 3 (Standard)'; expectedReturn = 'UGX 61,500'; }
                        else if (amount === 60000) { planType = 'Plan 4 (Premium)';  expectedReturn = 'UGX 73,800'; }
                        else if (d.customInvestment) {
                            planType = `Custom (${d.customInvestment.days} days)`;
                            expectedReturn = `UGX ${d.customInvestment.totalReturn.toLocaleString()}`;
                        } else {
                            planType = 'Custom Amount';
                            expectedReturn = `UGX ${Math.round(amount * 1.23).toLocaleString()}`;
                        }
                        return `${planType}: UGX ${amount.toLocaleString()} → ${expectedReturn}`;
                    }).join('<br>');
                }

                return `
                    <tr>
                        <td>${i + 1}</td>
                        <td><strong>${escHtml(u.username || 'N/A')}</strong><br><small style="color:#888;">${escHtml(u.lastname || '')}</small></td>
                        <td>${escHtml(u.email || 'N/A')}</td>
                        <td>${escHtml(u.country || 'N/A')}</td>
                        <td><small>${escHtml(u.registered_at || u.registeredAt || 'N/A')}</small></td>
                        <td><span class="badge ${hasDeposited ? 'completed' : 'pending'}">${hasDeposited ? `${userDeposits.length} deposit(s)` : 'No deposits'}</span></td>
                        <td style="max-width:300px;font-size:0.85rem;line-height:1.6;">${planDetails}</td>
                        <td><strong style="color:#c9a800;">UGX ${totalUserDeposits.toLocaleString()}</strong></td>
                        <td><span class="badge ${u.vip_tier && u.vip_tier !== 'None' ? 'completed' : 'pending'}">${escHtml(u.vip_tier || 'None')}</span></td>
                        <td>${u.referral_depositors || 0}</td>
                        <td><small style="color:#888;">${escHtml(u.referral_code || 'N/A')}</small></td>
                    </tr>`;
            }).join('');

            userTableEl.innerHTML = `
                <table class="txn-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Username</th><th>Email</th><th>Country</th>
                            <th>Registered</th><th>Deposit Status</th>
                            <th>Investment Plans & Returns</th>
                            <th>Total Deposited</th><th>VIP</th>
                            <th>Referrals</th><th>Referral Code</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        }
    }

    // Transactions table
    const txnEl = document.getElementById('txn-container');
    if (txnEl) {
        if (allDeposits.length === 0) {
            txnEl.innerHTML = '<div class="empty-state">No transactions recorded yet.</div>';
        } else {
            const rows = allDeposits.map((d, i) => {
                const amount = Number(d.amount || 0);
                let planType, expectedReturn, investmentPeriod = '16 days';
                if (amount === 30000)      { planType = 'Plan 1 (Entry)';    expectedReturn = 'UGX 36,900'; }
                else if (amount === 40000) { planType = 'Plan 2 (Popular)';  expectedReturn = 'UGX 49,200'; }
                else if (amount === 50000) { planType = 'Plan 3 (Standard)'; expectedReturn = 'UGX 61,500'; }
                else if (amount === 60000) { planType = 'Plan 4 (Premium)';  expectedReturn = 'UGX 73,800'; }
                else if (d.customInvestment) {
                    planType = 'Custom Investment';
                    expectedReturn = `UGX ${d.customInvestment.totalReturn.toLocaleString()}`;
                    investmentPeriod = `${d.customInvestment.days} days`;
                } else {
                    planType = 'Custom Amount';
                    expectedReturn = `UGX ${Math.round(amount * 1.23).toLocaleString()}`;
                }
                const gateway = d.gateway || 'manual';
                const badge   = gateway === 'sandbox' ? 'pending' : gateway === 'manual' ? 'recorded' : 'completed';
                return `
                    <tr>
                        <td>${i + 1}</td>
                        <td><small>${escHtml(d.created_at || d.date || 'N/A')}</small></td>
                        <td><strong>${escHtml(d.name || 'N/A')}</strong><br><small style="color:#888;">${escHtml(d.email || 'N/A')}</small></td>
                        <td><span class="badge completed">${planType}</span><br><small style="color:#888;">${investmentPeriod}</small></td>
                        <td style="color:#c9a800;font-weight:bold;">UGX ${amount.toLocaleString()}</td>
                        <td style="color:#28a745;font-weight:bold;">${expectedReturn}</td>
                        <td><span class="badge ${badge}">${escHtml(d.status || 'completed')}</span></td>
                        <td><span class="badge ${badge}">${gateway.toUpperCase()}</span></td>
                        <td><small style="color:#888;">${escHtml(d.tx_ref || d.txRef || 'N/A')}</small></td>
                    </tr>`;
            }).join('');

            txnEl.innerHTML = `
                <table class="txn-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Date</th><th>Customer</th>
                            <th>Investment Plan</th><th>Amount</th>
                            <th>Expected Return</th><th>Status</th>
                            <th>Gateway</th><th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        }
    }

    // Highlight owner card and online dot
    document.querySelectorAll('.owner-card').forEach(c => c.classList.remove('you'));
    const myCard = document.getElementById('owner-card-' + ownerKey);
    if (myCard) myCard.classList.add('you');

    document.querySelectorAll('.online-dot').forEach(d => d.classList.remove('active'));
    const myDot = document.getElementById('dot-' + ownerKey);
    if (myDot) myDot.classList.add('active');
}

// ── Load local storage data ─────────────────────────────────
function loadLocalUsers() {
    const users = [];
    const seenEmails = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('urbanTroveData')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.registeredUser && data.registeredUser.email) {
                    if (!seenEmails.has(data.registeredUser.email)) {
                        seenEmails.add(data.registeredUser.email);
                        users.push({
                            username:            data.registeredUser.username,
                            lastname:            data.registeredUser.lastname,
                            email:               data.registeredUser.email,
                            country:             data.registeredUser.country,
                            registered_at:       data.registeredUser.registeredAt,
                            vip_tier:            data.vipTier || 'None',
                            referral_depositors: data.referralDepositors || 0,
                            referral_code:       data.referralCode || 'N/A'
                        });
                    }
                }
            } catch (e) {}
        }
    }
    return users;
}

function loadLocalDeposits() {
    const deposits = [];
    const seenRefs = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('urbanTroveData')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.transactions) {
                    data.transactions.forEach(txn => {
                        if (txn.type === 'Deposit' && !seenRefs.has(txn.txRef)) {
                            seenRefs.add(txn.txRef);
                            deposits.push({
                                amount:          txn.amount,
                                email:           data.registeredUser ? data.registeredUser.email : 'unknown',
                                name:            data.registeredUser ? `${data.registeredUser.username} ${data.registeredUser.lastname || ''}`.trim() : 'Unknown',
                                created_at:      txn.date,
                                status:          txn.status,
                                tx_ref:          txn.txRef,
                                gateway:         txn.gateway || 'local',
                                customInvestment: txn.customInvestment || null,
                                referral_code:   data.registeredUser ? data.registeredUser.usedReferralCode : null
                            });
                        }
                    });
                }
            } catch (e) {}
        }
    }
    return deposits;
}

// ── Load audit log data ──────────────────────────────────────────
async function loadAuditLog() {
    const BACKEND = window.location.origin;
    const container = document.getElementById('audit-log-container');
    if (!container) return;

    try {
        const response = await fetch(`${BACKEND}/api/audit-log`);
        const data = await response.json();
        const logs = data.logs || [];

        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-state">No audit log entries found.</div>';
            return;
        }

        const rows = logs.map((log, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${escHtml(log.created_at)}</td>
                <td><span class="badge ${log.event_type.includes('BLOCKED') ? 'pending' : log.event_type.includes('ERROR') ? 'pending' : 'completed'}">${escHtml(log.event_type)}</span></td>
                <td>${escHtml(log.email || 'N/A')}</td>
                <td style="color:#c9a800;font-weight:bold;">${log.amount ? 'UGX ' + Number(log.amount).toLocaleString() : '—'}</td>
                <td>${escHtml(log.reference || '—')}</td>
                <td>${escHtml(log.ip_address || '—')}</td>
                <td style="max-width:200px;word-wrap:break-word;">${escHtml(log.details || '—')}</td>
            </tr>`).join('');

        container.innerHTML = `
            <table class="txn-table">
                <thead>
                    <tr>
                        <th>#</th><th>Date</th><th>Event</th><th>Email</th>
                        <th>Amount</th><th>Reference</th><th>IP</th><th>Details</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;

    } catch (err) {
        console.error('[AUDIT LOG] Failed to load:', err.message);
        container.innerHTML = '<div class="empty-state">Could not load audit log from server.</div>';
    }
}

// ── Chat ──────────────────────────────────────────────────────────
function getChatMessages() {
    const raw = localStorage.getItem(OWNER_CHAT_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveChatMessages(msgs) {
    localStorage.setItem(OWNER_CHAT_KEY, JSON.stringify(msgs));
}

function loadChat() {
    const session  = JSON.parse(sessionStorage.getItem(OWNER_SESSION_KEY));
    const msgs     = getChatMessages();
    const container = document.getElementById('chat-messages');
    const emptyEl   = document.getElementById('chat-empty');
    if (!container) return;

    if (msgs.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    // Only re-render if count changed (avoid flicker on poll)
    if (container.dataset.count === String(msgs.length)) return;
    container.dataset.count = msgs.length;

    container.innerHTML = msgs.map(m => {
        const isMine = m.sender === session.username;
        return `<div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
            <div class="msg-sender">${escHtml(m.sender)}</div>
            <div>${escHtml(m.text)}</div>
            <div class="msg-time">${escHtml(m.time)}</div>
        </div>`;
    }).join('');

    scrollChatToBottom();
}

function scrollChatToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
    const input   = document.getElementById('chat-input');
    const text    = input ? input.value.trim() : '';
    if (!text) return;

    const session = JSON.parse(sessionStorage.getItem(OWNER_SESSION_KEY));
    const msgs    = getChatMessages();

    msgs.push({
        sender: session.username,
        text:   text,
        time:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    saveChatMessages(msgs);
    input.value = '';
    loadChat();
    scrollChatToBottom();
}

// ── Init ──────────────────────────────────────────────────────────
(function init() {
    // Only run on owners.html
    if (!document.getElementById('tab-overview')) return;

    const session = guardOwnerPage();
    if (!session) return;

    // Show name in header
    setEl('owner-badge-name', session.username);

    loadData(session.key);

    // Owner change password
    const ownerPwdForm = document.getElementById('owner-change-pwd-form');
    if (ownerPwdForm) {
        ownerPwdForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const current = document.getElementById('ocp-current').value;
            const newPwd  = document.getElementById('ocp-new').value;
            const confirm = document.getElementById('ocp-confirm').value;
            const status  = document.getElementById('ocp-status');

            const owner = OWNERS.find(o => o.username.toLowerCase() === session.username.toLowerCase());
            if (!owner || current !== owner.password) {
                status.textContent = '❌ Current password is incorrect.';
                status.style.cssText = 'display:block;background:rgba(220,53,69,0.15);color:#ff6b6b;border:1px solid #dc3545;';
                return;
            }
            if (newPwd.length < 4) {
                status.textContent = '❌ New password must be at least 4 characters.';
                status.style.cssText = 'display:block;background:rgba(220,53,69,0.15);color:#ff6b6b;border:1px solid #dc3545;';
                return;
            }
            if (newPwd !== confirm) {
                status.textContent = '❌ Passwords do not match.';
                status.style.cssText = 'display:block;background:rgba(220,53,69,0.15);color:#ff6b6b;border:1px solid #dc3545;';
                return;
            }
            owner.password = newPwd;
            status.textContent = '✅ Password updated! Remember your new password.';
            status.style.cssText = 'display:block;background:rgba(40,167,69,0.15);color:#28a745;border:1px solid #28a745;';
            ownerPwdForm.reset();
        });
    }

    // Poll chat every 3 seconds (simulates real-time for same-device testing)
    setInterval(() => {
        const activeChat = document.getElementById('tab-chat');
        if (activeChat && activeChat.classList.contains('active')) {
            loadChat();
        }
    }, 3000);
})();
