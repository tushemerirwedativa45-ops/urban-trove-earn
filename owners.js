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

    try {
        // Fetch users from database
        const usersRes = await fetch(`${BACKEND}/api/view-users`);
        const usersData = await usersRes.json();
        const users = usersData.users || [];

        // Fetch deposits from database
        const depositsRes = await fetch(`${BACKEND}/api/view-deposits`);
        const depositsData = await depositsRes.json();
        const deposits = depositsData.deposits || [];

        // Fetch withdrawals from database
        const withdrawRes = await fetch(`${BACKEND}/api/view-withdrawals`);
        const withdrawData = await withdrawRes.json();
        const withdrawals = withdrawData.withdrawals || [];

        const totalDeposited = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
        const totalWithdrawn = withdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);

        // Overview stats
        setEl('ov-users',    users.length);
        setEl('ov-deposits', deposits.length);
        setEl('ov-amount',   'UGX ' + totalDeposited.toLocaleString());
        setEl('ov-earnings', 'UGX ' + totalWithdrawn.toLocaleString());
        setEl('ov-referrals', deposits.filter(d => d.referral_code).length);
        setEl('ov-vip', '—');

        // Users table
        const userTableEl = document.getElementById('ov-user-table');
        if (userTableEl) {
            if (users.length === 0) {
                userTableEl.innerHTML = '<div class="empty-state">No users registered yet.</div>';
            } else {
                const rows = users.map((u, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${escHtml(u.username)}</td>
                        <td>${escHtml(u.lastname)}</td>
                        <td>${escHtml(u.email)}</td>
                        <td>${escHtml(u.country)}</td>
                        <td>${escHtml(u.registered_at)}</td>
                        <td><span class="badge ${deposits.find(d => d.email === u.email) ? 'completed' : 'pending'}">${deposits.find(d => d.email === u.email) ? 'Yes' : 'No'}</span></td>
                        <td>${escHtml(u.vip_tier || 'None')}</td>
                        <td>${u.referral_depositors || 0}</td>
                    </tr>`).join('');
                userTableEl.innerHTML = `
                    <table class="txn-table">
                        <thead>
                            <tr><th>#</th><th>Username</th><th>Last Name</th><th>Email</th>
                            <th>Country</th><th>Registered</th><th>Deposited</th><th>VIP</th><th>Referrals</th></tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>`;
            }
        }

        // Transactions table
        const txnEl = document.getElementById('txn-container');
        if (txnEl) {
            if (deposits.length === 0) {
                txnEl.innerHTML = '<div class="empty-state">No transactions recorded yet.</div>';
            } else {
                const rows = deposits.map((d, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${escHtml(d.created_at)}</td>
                        <td>Deposit</td>
                        <td style="color:#c9a800;font-weight:bold;">UGX ${Number(d.amount).toLocaleString()}</td>
                        <td><span class="badge completed">${escHtml(d.status)}</span></td>
                    </tr>`).join('');
                txnEl.innerHTML = `
                    <table class="txn-table">
                        <thead>
                            <tr><th>#</th><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>`;
            }
        }

    } catch (err) {
        console.error('[OWNERS] Failed to load data:', err.message);
        const userTableEl = document.getElementById('ov-user-table');
        if (userTableEl) userTableEl.innerHTML = '<div class="empty-state">Could not load data from server.</div>';
    }

    // Highlight the logged-in owner card
    document.querySelectorAll('.owner-card').forEach(c => c.classList.remove('you'));
    const myCard = document.getElementById('owner-card-' + ownerKey);
    if (myCard) myCard.classList.add('you');

    // Mark logged-in owner as online
    document.querySelectorAll('.online-dot').forEach(d => d.classList.remove('active'));
    const myDot = document.getElementById('dot-' + ownerKey);
    if (myDot) myDot.classList.add('active');
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
