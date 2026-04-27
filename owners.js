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

// ── Load overview & transactions data ────────────────────────────
function loadData(ownerKey) {
    const stored = localStorage.getItem('urbanTroveData');
    const data   = stored ? JSON.parse(stored) : null;

    const transactions  = (data && data.transactions) ? data.transactions : [];
    const deposits      = transactions.filter(t => t.type === 'Deposit');
    const referrals     = transactions.filter(t => t.type === 'Referral Deposit');
    const interestTxns  = transactions.filter(t => t.type === 'Interest Return');
    const totalDeposited = deposits.reduce((s, t) => s + (t.amount || 0), 0);
    const totalEarnings  = interestTxns.reduce((s, t) => s + (t.amount || 0), 0);
    const hasUser        = data && data.registeredUser;

    // Overview stats
    setEl('ov-users',    hasUser ? 1 : 0);
    setEl('ov-deposits', deposits.length);
    setEl('ov-amount',   'UGX ' + totalDeposited.toLocaleString());
    setEl('ov-earnings', 'UGX ' + totalEarnings.toLocaleString());
    setEl('ov-referrals', referrals.length);
    setEl('ov-vip',      (data && data.vipTier) ? data.vipTier : 'None');

    // User table
    const userTableEl = document.getElementById('ov-user-table');
    if (userTableEl) {
        if (!hasUser) {
            userTableEl.innerHTML = '<div class="empty-state">No user registered yet.</div>';
        } else {
            const u = data.registeredUser;
            userTableEl.innerHTML = `
                <table class="txn-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Username</th><th>Last Name</th><th>Email</th>
                            <th>Country</th><th>Registered At</th><th>Deposited</th>
                            <th>VIP</th><th>Referrals</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td>
                            <td>${escHtml(u.username)}</td>
                            <td>${escHtml(u.lastname)}</td>
                            <td>${escHtml(u.email)}</td>
                            <td>${escHtml(u.country)}</td>
                            <td>${escHtml(u.registeredAt)}</td>
                            <td><span class="badge ${deposits.length > 0 ? 'completed' : 'pending'}">${deposits.length > 0 ? 'Yes' : 'No'}</span></td>
                            <td>${escHtml(data.vipTier || 'None')}</td>
                            <td>${data.referralDeposits || 0}</td>
                        </tr>
                    </tbody>
                </table>`;
        }
    }

    // All transactions
    const txnEl = document.getElementById('txn-container');
    if (txnEl) {
        if (transactions.length === 0) {
            txnEl.innerHTML = '<div class="empty-state">No transactions recorded yet.</div>';
        } else {
            const rows = transactions.map((t, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${escHtml(t.date)}</td>
                    <td>${escHtml(t.type)}</td>
                    <td style="color:#c9a800;font-weight:bold;">UGX ${Number(t.amount).toLocaleString()}</td>
                    <td><span class="badge ${t.status === 'Completed' ? 'completed' : 'recorded'}">${escHtml(t.status)}</span></td>
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

    // Highlight the logged-in owner's card
    document.querySelectorAll('.owner-card').forEach(c => c.classList.remove('you'));
    const myCard = document.getElementById('owner-card-' + ownerKey);
    if (myCard) myCard.classList.add('you');

    // Mark logged-in owner as online in chat bar
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

    // Poll chat every 3 seconds (simulates real-time for same-device testing)
    setInterval(() => {
        const activeChat = document.getElementById('tab-chat');
        if (activeChat && activeChat.classList.contains('active')) {
            loadChat();
        }
    }, 3000);
})();
