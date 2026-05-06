// Urban Trove Earn JavaScript

// Mock data storage (in a real app, this would be a database)
let userData = {
    balance: 0,
    earnings: 0,
    deposits: 0,
    depositTotal: 0,
    vipTier: 'None',
    referralCode: '',
    referralLink: '',
    referralJoins: 0,
    referralDepositors: 0,
    registeredUser: null,
    transactions: []
};

const planOptions = {
    30000: 36900,
    40000: 49200,
    50000: 61500,
    60000: 73800
};

// Return rate for custom amounts
const RETURN_RATE = 0.23;

function getVipInfo(invites) {
    if (invites >= 25) return { tier: 'VIP 5', bonus: 10 };
    if (invites >= 20) return { tier: 'VIP 4', bonus: 8 };
    if (invites >= 15) return { tier: 'VIP 3', bonus: 6 };
    if (invites >= 10) return { tier: 'VIP 2', bonus: 4 };
    if (invites >= 5) return { tier: 'VIP 1', bonus: 2 };
    return { tier: 'None', bonus: 0 };
}

// Load data from localStorage
function loadData() {
    const stored = localStorage.getItem('urbanTroveData');
    if (stored) {
        userData = JSON.parse(stored);
    }
    updateDashboard();
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('urbanTroveData', JSON.stringify(userData));
}

// Update dashboard display
function updateDashboard() {
    const balanceEl      = document.getElementById('total-balance');
    const earningsEl     = document.getElementById('earnings');
    const depositsEl     = document.getElementById('deposits');
    const depositBalEl   = document.getElementById('deposit-balance');
    const vipStatusEl    = document.getElementById('vip-status');
    const vipInvitesEl   = document.getElementById('vip-invites');
    const refDepEl       = document.getElementById('referral-depositors');

    if (balanceEl)    balanceEl.textContent    = `UGX ${userData.balance.toLocaleString()}`;
    if (earningsEl)   earningsEl.textContent   = `UGX ${userData.earnings.toLocaleString()}`;
    if (depositsEl)   depositsEl.textContent   = userData.deposits;
    if (depositBalEl) depositBalEl.textContent = `UGX ${(userData.depositTotal || 0).toLocaleString()}`;
    if (vipStatusEl)  vipStatusEl.textContent  = userData.vipTier;
    if (vipInvitesEl) vipInvitesEl.textContent = userData.referralJoins || 0;
    if (refDepEl)     refDepEl.textContent     = userData.referralDepositors || 0;

    // Show referral link on dashboard
    const dashLink = document.getElementById('dashboard-referral-link');
    if (dashLink && userData.referralLink) dashLink.value = userData.referralLink;

    // VIP progress
    const depositors   = userData.referralDepositors || 0;
    const thresholds   = [5, 10, 15, 20, 25];
    const nextThreshold = thresholds.find(t => t > depositors) || 25;
    const progress     = Math.min(Math.round((depositors / nextThreshold) * 100), 100);
    const nextVipEl    = document.getElementById('next-vip-info');
    const progressEl   = document.getElementById('vip-progress');
    if (nextVipEl)  nextVipEl.textContent  = `${nextThreshold} depositors for VIP ${thresholds.indexOf(nextThreshold) + 1}`;
    if (progressEl) progressEl.textContent = `${depositors} / ${nextThreshold}`;

    // Fetch live referral stats from backend if available
    if (userData.referralCode) {
        fetch(`${API_BASE}/api/referral-stats/${userData.referralCode}`)
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                userData.referralJoins      = data.joins;
                userData.referralDepositors = data.depositors;
                userData.vipTier            = data.vipTier;
                saveData();
                if (vipInvitesEl) vipInvitesEl.textContent = data.joins;
                if (refDepEl)     refDepEl.textContent     = data.depositors;
                if (vipStatusEl)  vipStatusEl.textContent  = data.vipTier;
                if (progressEl)   progressEl.textContent   = `${data.depositors} / ${data.nextVipAt}`;
                if (nextVipEl)    nextVipEl.textContent    = `${data.nextVipAt} depositors for next VIP`;
            }
        })
        .catch(() => {}); // silent fail if backend offline
    }

    const tbody = document.getElementById('transaction-body');
    if (tbody) {
        tbody.innerHTML = '';
        userData.transactions.forEach(transaction => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = transaction.date;
            row.insertCell(1).textContent = transaction.type;
            row.insertCell(2).textContent = `UGX ${transaction.amount.toLocaleString()}`;
            row.insertCell(3).textContent = transaction.status;
        });
    }
}

// ════════════════════════════════════════════════════════════
//  PAYMENT GATEWAY CONFIGURATION
//  Replace these with your actual payment provider details
// ════════════════════════════════════════════════════════════

const PAYMENT_CONFIG = {
    // Set to true when you have a real payment gateway
    ENABLED: false,
    
    // Your payment gateway details (replace with actual values)
    GATEWAY: {
        API_URL: 'https://api.your-payment-gateway.com/v1/payments',
        PUBLIC_KEY: 'pk_test_your_public_key_here',
        SECRET_KEY: 'sk_test_your_secret_key_here', // Keep this secure!
        WEBHOOK_SECRET: 'your_webhook_secret_here'
    },
    
    // Supported payment methods
    METHODS: {
        MOBILE_MONEY: true,
        CARD: true,
        BANK_TRANSFER: false
    },
    
    // Currency and limits
    CURRENCY: 'UGX',
    MIN_AMOUNT: 30000,
    
    // Callback URLs
    SUCCESS_URL: window.location.origin + '/payment-success.html',
    CANCEL_URL: window.location.origin + '/deposit.html',
    WEBHOOK_URL: window.location.origin + '/api/payment-webhook'
};

// Backend API base URL
const API_BASE = window.location.origin;

// Handle deposit form submission
async function handleDeposit(event) {
    event.preventDefault();

    const planInput    = document.getElementById('plan');
    const name         = document.getElementById('dep-name')?.value.trim();
    const email        = document.getElementById('dep-email')?.value.trim();
    const phone        = document.getElementById('dep-phone')?.value.trim();
    const network      = document.getElementById('dep-network')?.value;
    const referralCode = document.getElementById('referral-code')?.value.trim();
    const submitBtn    = document.getElementById('deposit-submit-btn');

    const amount = parseFloat(planInput?.value);

    if (!amount || amount < PAYMENT_CONFIG.MIN_AMOUNT) {
        showStatus(`Please choose a valid investment plan with at least ${PAYMENT_CONFIG.CURRENCY} ${PAYMENT_CONFIG.MIN_AMOUNT.toLocaleString()}.`, 'error');
        return;
    }

    if (!name || !email || !phone) {
        showStatus('Please fill in your name, email and phone number.', 'error');
        return;
    }

    // Validate phone number format for Uganda
    if (!/^0[7][0-9]{8}$/.test(phone)) {
        showStatus('Please enter a valid Ugandan phone number (e.g., 0702762675)', 'error');
        return;
    }

    if (submitBtn) { 
        submitBtn.disabled = true; 
        submitBtn.textContent = '⏳ Processing...'; 
    }

    // Check if payment gateway is configured
    if (PAYMENT_CONFIG.ENABLED && PAYMENT_CONFIG.GATEWAY.PUBLIC_KEY !== 'pk_test_your_public_key_here') {
        // Use real payment gateway
        await processRealPayment(amount, name, email, phone, network, referralCode);
    } else {
        // Show manual payment instructions
        showManualPaymentInstructions(amount, phone, network, name, email, referralCode);
    }

    if (submitBtn) { 
        submitBtn.disabled = false; 
        submitBtn.textContent = '💳 DEPOSIT NOW'; 
    }
}

// Process payment through configured gateway
async function processRealPayment(amount, name, email, phone, network, referralCode) {
    const txRef = `UTE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    try {
        // Prepare payment data for your gateway
        const paymentData = {
            // Standard fields - customize based on your gateway's API
            reference: txRef,
            amount: amount,
            currency: PAYMENT_CONFIG.CURRENCY,
            
            // Customer information
            customer: {
                name: name,
                email: email,
                phone: phone
            },
            
            // Payment method
            payment_method: network === 'MPS' ? 'mtn_mobile_money' : 'airtel_money',
            
            // Callback URLs
            callback_url: PAYMENT_CONFIG.SUCCESS_URL + `?tx_ref=${txRef}`,
            return_url: PAYMENT_CONFIG.SUCCESS_URL,
            cancel_url: PAYMENT_CONFIG.CANCEL_URL,
            
            // Additional metadata
            metadata: {
                referral_code: referralCode || '',
                plan_type: 'investment',
                source: 'urban_trove_earn'
            }
        };

        showStatus('🔄 Connecting to payment gateway...', '');

        // Call your payment gateway API
        const response = await fetch(PAYMENT_CONFIG.GATEWAY.API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYMENT_CONFIG.GATEWAY.PUBLIC_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            // Record pending transaction
            userData.transactions.unshift({
                date: new Date().toLocaleDateString(),
                depositTimestamp: Date.now(),
                type: 'Deposit',
                amount: amount,
                earnings: Math.round(amount * RETURN_RATE),
                status: 'Processing Payment',
                txRef: txRef,
                gateway: 'api'
            });
            
            saveData();
            updateDashboard();

            showStatus('🔄 Redirecting to payment gateway...', '');
            
            // Redirect to payment page (customize based on your gateway response)
            if (result.data && result.data.payment_url) {
                window.location.href = result.data.payment_url;
            } else if (result.payment_url) {
                window.location.href = result.payment_url;
            } else {
                throw new Error('No payment URL received from gateway');
            }
            
        } else {
            throw new Error(result.message || 'Payment initialization failed');
        }

    } catch (error) {
        console.error('Payment gateway error:', error);
        showStatus(`❌ Payment failed: ${error.message}. Please try again or use manual payment.`, 'error');
        
        // Fallback to manual payment
        setTimeout(() => {
            showManualPaymentInstructions(amount, phone, network, name, email, referralCode);
        }, 2000);
    }
}

// Manual payment instructions (fallback)
function showManualPaymentInstructions(amount, phone, network, name, email, referralCode) {
    const networkName = network === 'MPS' ? 'MTN Mobile Money' : 'Airtel Money';
    const paymentNumber = '0702762675'; // Replace with your actual payment number
    
    const instructions = `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #856404; margin-bottom: 15px;">📱 Complete Your Payment</h3>
            <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p><strong>Amount:</strong> UGX ${amount.toLocaleString()}</p>
                <p><strong>Send to:</strong> ${paymentNumber}</p>
                <p><strong>Network:</strong> ${networkName}</p>
                <p><strong>Your Phone:</strong> ${phone}</p>
            </div>
            
            <h4 style="color: #856404; margin: 15px 0 10px;">Payment Steps:</h4>
            <ol style="color: #856404; line-height: 1.6;">
                <li>Dial *165# (MTN) or *185# (Airtel)</li>
                <li>Select "Send Money"</li>
                <li>Enter: <strong>${paymentNumber}</strong></li>
                <li>Enter amount: <strong>UGX ${amount.toLocaleString()}</strong></li>
                <li>Enter your PIN to confirm</li>
                <li>Click "Confirm Payment" below after sending</li>
            </ol>
            
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="confirmManualPayment('${amount}', '${phone}', '${network}', '${name}', '${email}', '${referralCode}')" 
                        style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                    ✅ I HAVE SENT THE MONEY
                </button>
            </div>
            
            <p style="font-size: 0.9rem; color: #856404; margin-top: 15px; text-align: center;">
                ⚠️ Only click "I HAVE SENT THE MONEY" after completing the mobile money transfer
            </p>
        </div>
    `;
    
    showStatus(instructions, 'info');
}

// Confirm manual payment
async function confirmManualPayment(amount, phone, network, name, email, referralCode) {
    const txRef = `UTE-MANUAL-${Date.now()}`;
    
    // Record as pending verification
    userData.transactions.unshift({
        date: new Date().toLocaleDateString(),
        depositTimestamp: Date.now(),
        type: 'Deposit',
        amount: parseFloat(amount),
        earnings: Math.round(parseFloat(amount) * RETURN_RATE),
        status: 'Pending Verification',
        txRef: txRef,
        phone: phone,
        network: network,
        gateway: 'manual'
    });
    
    saveData();
    updateDashboard();

    // Send to backend for admin review
    try {
        await fetch(`${API_BASE}/api/record-deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                amount: parseFloat(amount), 
                email, 
                phone, 
                name, 
                network, 
                referralCode: referralCode || '', 
                txRef,
                status: 'pending_verification'
            })
        });
    } catch (err) {
        console.log('Backend offline, recorded locally');
    }

    showStatus(`
        <div style="background: #d4edda; border: 1px solid #28a745; border-radius: 8px; padding: 20px; text-align: center;">
            <h3 style="color: #155724;">✅ Payment Confirmation Received</h3>
            <p style="color: #155724; margin: 10px 0;">Reference: <strong>${txRef}</strong></p>
            <p style="color: #155724;">Your deposit is being verified. You will receive your 23% returns after admin confirms payment and 16-day period.</p>
            <div style="margin-top: 15px;">
                <button onclick="window.location.href='dashboard.html'" 
                        style="background: #002a5c; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                    Go to Dashboard
                </button>
            </div>
        </div>
    `, 'success');

    // Clear form
    document.getElementById('deposit-form').reset();
}

function handlePaymentCallback() { /* no payment gateway — nothing to handle */ }

function updatePlanNote() {
    const planInput = document.getElementById('plan');
    const planNote  = document.getElementById('plan-note');
    if (!planInput || !planNote || !planInput.value) return;
    const amount      = parseFloat(planInput.value);
    const returnAmount = planOptions[amount] || Math.round(amount * 1.23);
    const percentage  = ((returnAmount - amount) / amount) * 100;
    planNote.textContent = `We add you ${percentage.toFixed(2)}% for the amount you have invested there.`;
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('deposit-status');
    if (!statusDiv) return;
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
}

function validateEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}

function validatePassword(password) {
    const lengthRule = password.length >= 8;
    const uppercaseRule = /[A-Z]/.test(password);
    const numberRule = /[0-9]/.test(password);
    const specialRule = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return { lengthRule, uppercaseRule, numberRule, specialRule };
}

function updatePasswordRequirements(password) {
    const rules = validatePassword(password);
    document.getElementById('req-length').className = rules.lengthRule ? 'valid' : 'invalid';
    document.getElementById('req-uppercase').className = rules.uppercaseRule ? 'valid' : 'invalid';
    document.getElementById('req-number').className = rules.numberRule ? 'valid' : 'invalid';
    document.getElementById('req-special').className = rules.specialRule ? 'valid' : 'invalid';
}

function showRegisterStatus(message, type) {
    const statusDiv = document.getElementById('register-status');
    if (!statusDiv) return;
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
}

function handleRegister(event) {
    event.preventDefault();
    const username    = document.getElementById('username').value.trim();
    const lastname    = document.getElementById('lastname').value.trim();
    const email       = document.getElementById('email').value.trim();
    const country     = document.getElementById('country').value;
    const password    = document.getElementById('password').value;
    const agreeTerms  = document.getElementById('agree-terms').checked;
    const referralCode = document.getElementById('reg-referral-code')?.value.trim() || '';

    if (!username || !lastname || !email || !country || !password) {
        showRegisterStatus('Please fill in all required fields.', 'error');
        return;
    }
    if (!validateEmail(email)) {
        showRegisterStatus('Please enter a valid email address.', 'error');
        return;
    }
    const passwordRules = validatePassword(password);
    if (!passwordRules.lengthRule || !passwordRules.uppercaseRule || !passwordRules.numberRule || !passwordRules.specialRule) {
        showRegisterStatus('Password must meet all strength requirements.', 'error');
        return;
    }
    if (!agreeTerms) {
        showRegisterStatus('You must agree to the terms and conditions.', 'error');
        return;
    }

    // Try to register via backend API first, fall back to localStorage
    fetch(`${API_BASE}/api/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, lastname, email, country, password, referralCode })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === 'success') {
            _completeRegistration(username, lastname, email, country, password, data.referralCode, data.referralLink, referralCode);
        } else {
            showRegisterStatus(data.message || 'Registration failed.', 'error');
        }
    })
    .catch(() => {
        // Backend not running — generate referral code locally
        const localCode = 'UTE-' + username.replace(/\s+/g,'').toUpperCase().substring(0,6) + '-' + Math.random().toString(36).substr(2,4).toUpperCase();
        const localLink = `${window.location.origin}/register.html?ref=${localCode}`;
        _completeRegistration(username, lastname, email, country, password, localCode, localLink, referralCode);
    });
}

function _completeRegistration(username, lastname, email, country, password, referralCode, referralLink, usedReferralCode) {
    userData.registeredUser = {
        username, lastname, email, country, password,
        referralCode,
        referralLink,
        usedReferralCode: usedReferralCode || null,
        registeredAt: new Date().toLocaleString()
    };
    userData.referralCode      = referralCode;
    userData.referralLink      = referralLink;
    userData.referralJoins     = 0;
    userData.referralDepositors = 0;
    saveData();

    showRegisterStatus('Registration successful! Redirecting to your dashboard...', 'success');
    document.getElementById('register-form').reset();
    updatePasswordRequirements('');

    // Show referral link box briefly then redirect
    const box = document.getElementById('referral-link-box');
    const linkInput = document.getElementById('referral-link-display');
    if (box && linkInput) {
        linkInput.value = referralLink;
        box.style.display = 'block';
    }

    // Redirect to dashboard after 2 seconds
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
}

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const loginStatus = document.getElementById('login-status');

    if (!username || !password) {
        loginStatus.textContent = 'Please enter both username and password.';
        loginStatus.className = 'status-message error';
        loginStatus.style.display = 'block';
        return;
    }

    if (!userData.registeredUser) {
        loginStatus.textContent = 'No registered account found. Please register first.';
        loginStatus.className = 'status-message error';
        loginStatus.style.display = 'block';
        return;
    }

    if (username !== userData.registeredUser.username || password !== userData.registeredUser.password) {
        loginStatus.textContent = 'Incorrect username or password.';
        loginStatus.className = 'status-message error';
        loginStatus.style.display = 'block';
        return;
    }

    userData.loggedIn = true;
    saveData();
    loginStatus.textContent = 'Login successful! Redirecting...';
    loginStatus.className = 'status-message success';
    loginStatus.style.display = 'block';
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
}

function handleLogout() {
    userData.loggedIn = false;
    saveData();
    window.location.href = 'login.html';
}

function getReferralCode() {
    return userData.referralCode || '';
}

function updateVipPage() {
    const vipCodeEl      = document.getElementById('display-referral-code');
    const currentVipTierEl = document.getElementById('current-vip-tier');
    const referralDepositsEl = document.getElementById('referral-deposits');
    if (vipCodeEl) vipCodeEl.textContent = userData.referralCode || '—';
    const vipInfo = getVipInfo(userData.referralDepositors || 0);
    userData.vipTier = vipInfo.tier;
    if (referralDepositsEl) referralDepositsEl.textContent = userData.referralDepositors || 0;
    if (currentVipTierEl)   currentVipTierEl.textContent   = userData.vipTier;
    saveData();
}

function handleVipForm(event) {
    event.preventDefault();
    const vipResult = document.getElementById('vip-result');
    const vipInfo   = getVipInfo(userData.referralDepositors || 0);
    userData.vipTier = vipInfo.tier;
    saveData();
    updateDashboard();
    updateVipPage();
    if (vipResult) vipResult.innerHTML = `Your current tier is <strong>${vipInfo.tier}</strong> with a <strong>${vipInfo.bonus}% bonus</strong> on your earnings.`;
}

function handleReferralForm() { /* removed — referral page now uses backend API */ }

function updateReferralPage() {
    const linkDisplay = document.getElementById('referral-link-display');
    const joinsEl     = document.getElementById('ref-joins');
    const depEl       = document.getElementById('ref-depositors');
    const vipEl       = document.getElementById('ref-vip-status');
    const nextEl      = document.getElementById('ref-next-vip');
    const barEl       = document.getElementById('vip-progress-bar');
    const barText     = document.getElementById('vip-progress-text');

    if (linkDisplay && userData.referralLink) linkDisplay.value = userData.referralLink;

    // Show local data first
    const depositors   = userData.referralDepositors || 0;
    const thresholds   = [5, 10, 15, 20, 25];
    const nextThreshold = thresholds.find(t => t > depositors) || 25;
    const progress     = Math.min(Math.round((depositors / nextThreshold) * 100), 100);

    if (joinsEl) joinsEl.textContent = userData.referralJoins || 0;
    if (depEl)   depEl.textContent   = depositors;
    if (vipEl)   vipEl.textContent   = userData.vipTier || 'None';
    if (nextEl)  nextEl.textContent  = `${nextThreshold} depositors`;
    if (barEl)   barEl.style.width   = `${progress}%`;
    if (barText) barText.textContent = `${depositors} / ${nextThreshold} depositors for VIP ${thresholds.indexOf(nextThreshold) + 1}`;

    // Fetch live stats from backend
    if (userData.referralCode) {
        fetch(`${API_BASE}/api/referral-stats/${userData.referralCode}`)
        .then(r => r.json())
        .then(data => {
            if (data.status !== 'success') return;
            userData.referralJoins      = data.joins;
            userData.referralDepositors = data.depositors;
            userData.vipTier            = data.vipTier;
            saveData();

            if (linkDisplay) linkDisplay.value = data.referralLink;
            if (joinsEl) joinsEl.textContent = data.joins;
            if (depEl)   depEl.textContent   = data.depositors;
            if (vipEl)   vipEl.textContent   = data.vipTier;
            if (nextEl)  nextEl.textContent  = `${data.nextVipAt} depositors`;
            if (barEl)   barEl.style.width   = `${data.progressPercent}%`;
            if (barText) barText.textContent = `${data.depositors} / ${data.nextVipAt} depositors for next VIP`;
        })
        .catch(() => {});
    }
}

function updateProfilePage() {
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileCountry = document.getElementById('profile-country');
    const profileDate = document.getElementById('profile-date');
    const profileReferral = document.getElementById('profile-referral');
    const profileVip = document.getElementById('profile-vip');
    const profileReferrals = document.getElementById('profile-referrals');
    const profileStatus = document.getElementById('profile-status');

    if (!profileName) return;
    if (!userData.registeredUser) {
        profileName.textContent = 'Guest';
        profileEmail.textContent = 'No account information available.';
        profileCountry.textContent = '-';
        profileDate.textContent = '-';
        profileReferral.textContent = userData.referralCode || '—';
        profileVip.textContent = 'None';
        profileReferrals.textContent = userData.referralDepositors || 0;
        if (profileStatus) {
            profileStatus.textContent = 'You have not registered yet. Please register to save your profile and access the full service.';
            profileStatus.className = 'status-message error';
            profileStatus.style.display = 'block';
        }
        return;
    }

    profileName.textContent = `${userData.registeredUser.username} ${userData.registeredUser.lastname}`;
    profileEmail.textContent = userData.registeredUser.email;
    profileCountry.textContent = userData.registeredUser.country;
    profileDate.textContent = userData.registeredUser.registeredAt;
    profileReferral.textContent = userData.referralCode || '—';
    profileVip.textContent = userData.vipTier;
    profileReferrals.textContent = userData.referralDepositors || 0;
    if (profileStatus) {
        profileStatus.textContent = 'Your registered profile is loaded successfully.';
        profileStatus.className = 'status-message success';
        profileStatus.style.display = 'block';
    }
}

function updateNavForLoginState() {
    const logoutBtn = document.getElementById('logout-btn');
    const loginLink = document.getElementById('nav-login');
    const registerLink = document.getElementById('nav-register');
    if (!logoutBtn) return;
    if (userData.loggedIn) {
        logoutBtn.style.display = 'inline';
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
    } else {
        logoutBtn.style.display = 'none';
        if (loginLink) loginLink.style.display = 'inline';
        if (registerLink) registerLink.style.display = 'inline';
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    updateNavForLoginState();

    const depositForm = document.getElementById('deposit-form');
    if (depositForm) {
        depositForm.addEventListener('submit', handleDeposit);
    }

    const planSelect = document.getElementById('plan');
    if (planSelect) {
        planSelect.addEventListener('change', updatePlanNote);
        updatePlanNote();
    }

    const vipForm = document.getElementById('vip-form');
    if (vipForm) {
        vipForm.addEventListener('submit', handleVipForm);
        updateVipPage();
    }

    const referralForm = document.getElementById('referral-form');
    if (referralForm) {
        updateReferralPage();
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', function(event) {
            updatePasswordRequirements(event.target.value);
        });
    }

    const profileCard = document.getElementById('profile-card');
    if (profileCard) {
        updateProfilePage();
    }
});