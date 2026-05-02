const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// ── In-memory store ──────────────────────────────────────────
let userDatabase     = [];
let depositDatabase  = [];
let withdrawDatabase = [];
let referralDatabase = {};

// ── Helpers ───────────────────────────────────────────────────
function generateReferralCode(username) {
    const clean = username.replace(/\s+/g, '').toUpperCase().substring(0, 6);
    const rand  = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `UTE-${clean}-${rand}`;
}

function getVipInfo(depositors) {
    if (depositors >= 25) return { tier: 'VIP 5', bonus: 10 };
    if (depositors >= 20) return { tier: 'VIP 4', bonus: 8 };
    if (depositors >= 15) return { tier: 'VIP 3', bonus: 6 };
    if (depositors >= 10) return { tier: 'VIP 2', bonus: 4 };
    if (depositors >= 5)  return { tier: 'VIP 1', bonus: 2 };
    return { tier: 'None', bonus: 0 };
}

// ════════════════════════════════════════════════════════════
//  SERVE FRONTEND FILES
// ════════════════════════════════════════════════════════════
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ════════════════════════════════════════════════════════════
//  1. REGISTER USER & GENERATE REFERRAL LINK
// ════════════════════════════════════════════════════════════
app.post('/api/register', (req, res) => {
    const { username, lastname, email, country, password, referralCode } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    if (userDatabase.find(u => u.email === email)) {
        return res.status(400).json({ status: 'error', message: 'Email already registered' });
    }

    const newReferralCode = generateReferralCode(username);

    const newUser = {
        username,
        lastname,
        email,
        country,
        password,
        referralCode:       newReferralCode,
        usedReferralCode:   referralCode || null,
        registeredAt:       new Date().toLocaleString(),
        vipTier:            'None',
        referralJoins:      0,
        referralDepositors: 0
    };

    userDatabase.push(newUser);
    referralDatabase[newReferralCode] = { joins: [], depositors: [] };

    if (referralCode && referralDatabase[referralCode]) {
        referralDatabase[referralCode].joins.push({ username, email, joinedAt: new Date().toLocaleString() });
        const referrer = userDatabase.find(u => u.referralCode === referralCode);
        if (referrer) {
            referrer.referralJoins++;
            console.log(`[REFERRAL] ${username} joined via ${referrer.username}'s link`);
        }
    }

    console.log(`[REGISTER] ${username} | Code: ${newReferralCode}`);

    return res.json({
        status:       'success',
        message:      'Registration successful',
        referralCode: newReferralCode,
        referralLink: `http://localhost:3000/register.html?ref=${newReferralCode}`
    });
});

// ════════════════════════════════════════════════════════════
//  2. GET REFERRAL STATS
// ════════════════════════════════════════════════════════════
app.get('/api/referral-stats/:referralCode', (req, res) => {
    const code = req.params.referralCode;
    const user = userDatabase.find(u => u.referralCode === code);

    if (!user) {
        return res.status(404).json({ status: 'error', message: 'Referral code not found' });
    }

    const depositors    = user.referralDepositors;
    const vipInfo       = getVipInfo(depositors);
    const thresholds    = [5, 10, 15, 20, 25];
    const nextThreshold = thresholds.find(t => t > depositors) || 25;

    return res.json({
        status:          'success',
        referralCode:    code,
        referralLink:    `http://localhost:3000/register.html?ref=${code}`,
        joins:           user.referralJoins,
        depositors,
        vipTier:         vipInfo.tier,
        vipBonus:        vipInfo.bonus,
        nextVipAt:       nextThreshold,
        progressPercent: Math.min(Math.round((depositors / nextThreshold) * 100), 100)
    });
});

// ════════════════════════════════════════════════════════════
//  3. RECORD DEPOSIT (called by frontend after payment confirmed)
// ════════════════════════════════════════════════════════════
app.post('/api/record-deposit', (req, res) => {
    const { amount, email, phone, name, planAmount, referralCode, txRef } = req.body;

    if (!amount || !email) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    if (amount < 30000) {
        return res.status(400).json({ status: 'error', message: 'Minimum deposit is UGX 30,000' });
    }

    depositDatabase.push({
        txRef:       txRef || `UTE-${Date.now()}`,
        amount,
        email,
        phone,
        name,
        planAmount,
        referralCode: referralCode || '',
        status:       'completed',
        timestamp:    new Date().toLocaleString()
    });

    // Update referrer depositor count if applicable
    if (referralCode) {
        const depositorUser = userDatabase.find(u => u.email === email);
        const referrer      = userDatabase.find(u => u.referralCode === referralCode);
        if (referrer && depositorUser) {
            const alreadyCounted = referralDatabase[referralCode]?.depositors.find(d => d.email === email);
            if (!alreadyCounted) {
                referralDatabase[referralCode].depositors.push({ email, amount, depositedAt: new Date().toLocaleString() });
                referrer.referralDepositors++;
                const vipInfo  = getVipInfo(referrer.referralDepositors);
                referrer.vipTier = vipInfo.tier;
                console.log(`[REFERRAL DEPOSIT] ${email} via ${referrer.username} | VIP: ${referrer.vipTier}`);
            }
        }
    }

    console.log(`[DEPOSIT RECORDED] ${email} — UGX ${amount}`);

    return res.json({ status: 'success', message: 'Deposit recorded successfully' });
});

// ════════════════════════════════════════════════════════════
//  4. RECORD WITHDRAWAL (called by frontend when user withdraws)
// ════════════════════════════════════════════════════════════
app.post('/api/record-withdrawal', (req, res) => {
    const { amount, phone, email, name, network } = req.body;

    if (!amount || !phone || !name) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    if (amount < 5000) {
        return res.status(400).json({ status: 'error', message: 'Minimum withdrawal is UGX 5,000' });
    }

    const reference = `UTE-WD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    withdrawDatabase.push({
        reference,
        amount,
        phone,
        email,
        name,
        network:   network || 'MTN',
        status:    'pending',
        timestamp: new Date().toLocaleString()
    });

    console.log(`[WITHDRAWAL RECORDED] ${phone} — UGX ${amount} | ref: ${reference}`);

    return res.json({
        status:    'success',
        message:   `Withdrawal of UGX ${Number(amount).toLocaleString()} recorded for ${phone}`,
        reference
    });
});

// ════════════════════════════════════════════════════════════
//  5. VIEW ALL DEPOSITS (Admin)
// ════════════════════════════════════════════════════════════
app.get('/api/view-deposits', (req, res) => {
    res.json({
        title:       'All Deposit Records — Urban Trove Earn',
        total:       depositDatabase.length,
        totalAmount: depositDatabase.reduce((s, d) => s + d.amount, 0),
        deposits:    depositDatabase
    });
});

// ════════════════════════════════════════════════════════════
//  6. VIEW ALL WITHDRAWALS (Admin)
// ════════════════════════════════════════════════════════════
app.get('/api/view-withdrawals', (req, res) => {
    res.json({
        title:       'All Withdrawal Records — Urban Trove Earn',
        total:       withdrawDatabase.length,
        withdrawals: withdrawDatabase
    });
});

// ════════════════════════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════════════════════════
app.listen(3000, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   Urban Trove Earn Backend — Port 3000   ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Frontend:  http://localhost:3000         ║');
    console.log('║  Register:  POST /api/register            ║');
    console.log('║  Deposit:   POST /api/record-deposit      ║');
    console.log('║  Withdraw:  POST /api/record-withdrawal   ║');
    console.log('║  Referral:  GET  /api/referral-stats/:code║');
    console.log('║  Admin:     GET  /api/view-deposits       ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
