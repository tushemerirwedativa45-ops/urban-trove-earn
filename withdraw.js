// ═══════════════════════════════════════════════════════════
//  URBAN TROVE EARN — Withdrawal System
//  - 16-day lock from deposit date
//  - Shows countdown per deposit
//  - Only unlocked earnings can be withdrawn
//  - Calls backend Flutterwave Transfer API
// ═══════════════════════════════════════════════════════════

const LOCK_DAYS    = 16;
const LOCK_MS      = LOCK_DAYS * 24 * 60 * 60 * 1000;
const MIN_WITHDRAW = 5000;

// ── Load and render withdrawal page ──────────────────────────
function initWithdrawPage() {
    loadData();
    renderDepositSlots();
    renderWithdrawHistory();
    updateWithdrawBalances();
    prefillUserDetails();

    // Update countdowns every second
    setInterval(() => {
        renderDepositSlots();
        updateWithdrawBalances();
    }, 1000);

    const form = document.getElementById('withdraw-form');
    if (form) form.addEventListener('submit', handleWithdrawSubmit);
}

// ── Calculate available (unlocked) earnings ───────────────────
function getWithdrawStats() {
    const transactions = userData.transactions || [];
    let availableEarnings = 0;
    let lockedEarnings    = 0;
    let totalWithdrawn    = 0;
    let nextUnlockMs      = null;

    // Find all completed deposits and check if 16 days have passed
    transactions.forEach(txn => {
        if (txn.type === 'Deposit' && txn.status === 'Completed') {
            const depositDate = txn.depositTimestamp || new Date(txn.date).getTime();
            const unlockDate  = depositDate + LOCK_MS;
            const now         = Date.now();
            const earnings    = txn.earnings || Math.round(txn.amount * 0.23);

            if (now >= unlockDate) {
                // Unlocked — earnings available
                if (!txn.withdrawn) availableEarnings += earnings;
            } else {
                // Still locked
                lockedEarnings += earnings;
                if (!nextUnlockMs || unlockDate < nextUnlockMs) {
                    nextUnlockMs = unlockDate;
                }
            }
        }

        if (txn.type === 'Withdrawal') {
            totalWithdrawn += txn.amount || 0;
        }
    });

    return { availableEarnings, lockedEarnings, totalWithdrawn, nextUnlockMs };
}

// ── Render deposit slots with countdown ──────────────────────
function renderDepositSlots() {
    const container = document.getElementById('deposit-slots-container');
    if (!container) return;

    const deposits = (userData.transactions || []).filter(
        t => t.type === 'Deposit' && t.status === 'Completed'
    );

    if (deposits.length === 0) {
        container.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">No deposits found. Make a deposit first.</p>';
        return;
    }

    container.innerHTML = deposits.map((txn, i) => {
        const depositDate = txn.depositTimestamp || new Date(txn.date).getTime();
        const unlockDate  = depositDate + LOCK_MS;
        const now         = Date.now();
        const earnings    = txn.earnings || Math.round(txn.amount * 0.23);
        const isUnlocked  = now >= unlockDate;
        const remaining   = unlockDate - now;

        let statusHtml;
        if (isUnlocked) {
            statusHtml = `<span class="unlocked-badge">✅ UNLOCKED</span>`;
        } else {
            statusHtml = `<span class="countdown-badge">🔒 ${formatCountdown(remaining)}</span>`;
        }

        const withdrawnTag = txn.withdrawn
            ? `<span style="font-size:0.78rem;color:#888;"> (withdrawn)</span>` : '';

        return `
            <div class="deposit-slot ${isUnlocked ? 'unlocked' : 'locked-slot'}">
                <div class="slot-info">
                    <h4>Deposit #${i + 1} — ${txn.date}</h4>
                    <p>Deposited: UGX ${txn.amount.toLocaleString()} &nbsp;|&nbsp; Earnings: UGX ${earnings.toLocaleString()}${withdrawnTag}</p>
                    <p style="font-size:0.82rem;color:#888;">Unlock date: ${new Date(unlockDate).toLocaleDateString('en-UG', { day:'numeric', month:'long', year:'numeric' })}</p>
                </div>
                <div class="slot-status">
                    <div class="slot-amount">UGX ${earnings.toLocaleString()}</div>
                    ${statusHtml}
                </div>
            </div>`;
    }).join('');
}

// ── Update balance cards and form ─────────────────────────────
function updateWithdrawBalances() {
    const stats = getWithdrawStats();

    setEl('wd-available',     `UGX ${stats.availableEarnings.toLocaleString()}`);
    setEl('wd-locked',        `UGX ${stats.lockedEarnings.toLocaleString()}`);
    setEl('wd-earnings',      `UGX ${(userData.earnings || 0).toLocaleString()}`);
    setEl('wd-withdrawn',     `UGX ${stats.totalWithdrawn.toLocaleString()}`);
    setEl('wd-form-available',`UGX ${stats.availableEarnings.toLocaleString()}`);

    const submitBtn    = document.getElementById('withdraw-submit-btn');
    const lockedNotice = document.getElementById('locked-notice');

    if (stats.availableEarnings <= 0) {
        // Nothing available — show locked notice with countdown
        if (lockedNotice) {
            lockedNotice.style.display = 'block';
            if (stats.nextUnlockMs) {
                const remaining = stats.nextUnlockMs - Date.now();
                setEl('next-unlock-countdown', formatCountdown(remaining));
            } else {
                setEl('next-unlock-countdown', 'Make a deposit first');
            }
        }
        if (submitBtn) submitBtn.disabled = true;
    } else {
        if (lockedNotice) lockedNotice.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
}

// ── Handle withdrawal form submit ─────────────────────────────
async function handleWithdrawSubmit(event) {
    event.preventDefault();

    const amount  = parseFloat(document.getElementById('wd-amount').value);
    const phone   = document.getElementById('wd-phone').value.trim();
    const network = document.getElementById('wd-network').value;
    const name    = document.getElementById('wd-name').value.trim();
    const btn     = document.getElementById('withdraw-submit-btn');

    const stats = getWithdrawStats();

    // Validations
    if (!amount || amount < MIN_WITHDRAW) {
        showWdStatus(`❌ Minimum withdrawal is UGX ${MIN_WITHDRAW.toLocaleString()}`, 'error');
        return;
    }
    if (amount > stats.availableEarnings) {
        showWdStatus(`❌ You can only withdraw up to UGX ${stats.availableEarnings.toLocaleString()} (your unlocked earnings)`, 'error');
        return;
    }
    if (!phone) {
        showWdStatus('❌ Please enter your mobile money number', 'error');
        return;
    }
    if (!name) {
        showWdStatus('❌ Please enter your full name', 'error');
        return;
    }

    btn.disabled    = true;
    btn.textContent = '⏳ Processing...';
    showWdStatus('Sending withdrawal request...', '');

    try {
        const response = await fetch(`${API_BASE}/api/withdraw`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, phone, name, network })
        });

        const data = await response.json();

        if (data.status === 'success') {
            // Mark the deposit(s) as withdrawn in localStorage
            markDepositsWithdrawn(amount);

            // Record withdrawal transaction
            userData.transactions.unshift({
                date:      new Date().toLocaleDateString(),
                type:      'Withdrawal',
                amount:    amount,
                phone:     phone,
                network:   network,
                reference: data.reference,
                status:    'Processing'
            });

            userData.totalWithdrawn = (userData.totalWithdrawn || 0) + amount;
            saveData();
            updateDashboard();
            renderWithdrawHistory();
            updateWithdrawBalances();
            renderDepositSlots();

            showWdStatus(
                `✅ Withdrawal of UGX ${amount.toLocaleString()} sent to ${phone} (${network === 'MPS' ? 'MTN' : 'Airtel'}). Reference: ${data.reference}. You will receive the money within a few minutes.`,
                'success'
            );

            document.getElementById('withdraw-form').reset();
            prefillUserDetails();

        } else {
            showWdStatus(`❌ ${data.message || 'Withdrawal failed. Try again.'}`, 'error');
        }

    } catch (err) {
        // Backend offline — still record locally
        markDepositsWithdrawn(amount);
        userData.transactions.unshift({
            date:    new Date().toLocaleDateString(),
            type:    'Withdrawal',
            amount:  amount,
            phone:   phone,
            network: network,
            status:  'Pending (offline)'
        });
        userData.totalWithdrawn = (userData.totalWithdrawn || 0) + amount;
        saveData();
        renderWithdrawHistory();
        updateWithdrawBalances();
        showWdStatus('⚠️ Backend offline. Withdrawal recorded locally and will be processed when server is back online.', 'error');
    }

    btn.disabled    = false;
    btn.textContent = '💸 WITHDRAW NOW';
}

// ── Mark deposits as withdrawn ────────────────────────────────
function markDepositsWithdrawn(withdrawAmount) {
    let remaining = withdrawAmount;
    const now     = Date.now();

    (userData.transactions || []).forEach(txn => {
        if (txn.type === 'Deposit' && txn.status === 'Completed' && !txn.withdrawn) {
            const depositDate = txn.depositTimestamp || new Date(txn.date).getTime();
            const unlockDate  = depositDate + LOCK_MS;
            if (now >= unlockDate && remaining > 0) {
                const earnings = txn.earnings || Math.round(txn.amount * 0.23);
                if (earnings <= remaining) {
                    txn.withdrawn = true;
                    remaining -= earnings;
                }
            }
        }
    });
}

// ── Render withdrawal history table ──────────────────────────
function renderWithdrawHistory() {
    const tbody = document.getElementById('withdraw-history-body');
    if (!tbody) return;

    const withdrawals = (userData.transactions || []).filter(t => t.type === 'Withdrawal');

    if (withdrawals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">No withdrawals yet.</td></tr>';
        return;
    }

    tbody.innerHTML = withdrawals.map(w => `
        <tr>
            <td>${w.date}</td>
            <td style="color:#28a745;font-weight:bold;">UGX ${w.amount.toLocaleString()}</td>
            <td>${w.phone || '—'}</td>
            <td>${w.network === 'MPS' ? 'MTN' : w.network === 'ATE' ? 'Airtel' : w.network || '—'}</td>
            <td><span class="badge ${w.status === 'Completed' ? 'yes' : 'no'}" style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:bold;background:${w.status==='Completed'?'rgba(40,167,69,0.15)':'rgba(255,193,7,0.15)'};color:${w.status==='Completed'?'#28a745':'#856404'};border:1px solid ${w.status==='Completed'?'#28a745':'#ffc107'};">${w.status}</span></td>
        </tr>`).join('');
}

// ── Pre-fill user details ─────────────────────────────────────
function prefillUserDetails() {
    if (!userData.registeredUser) return;
    const nameEl = document.getElementById('wd-name');
    if (nameEl && !nameEl.value) {
        nameEl.value = `${userData.registeredUser.username} ${userData.registeredUser.lastname}`;
    }
}

// ── Helpers ───────────────────────────────────────────────────
function formatCountdown(ms) {
    if (ms <= 0) return 'Unlocked';
    const days    = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours   = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function showWdStatus(msg, type) {
    const el = document.getElementById('withdraw-status');
    if (!el) return;
    el.style.display = 'block';
    el.textContent   = msg;
    el.className     = type === 'success'
        ? 'status-message success'
        : type === 'error'
        ? 'status-message error'
        : 'status-message';
}

// ── Init on page load ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('withdraw-form')) {
        initWithdrawPage();
    }
});
