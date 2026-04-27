const express = require('express');
const axios   = require('axios');
const cors    = require('cors');
const crypto  = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

// ── Flutterwave keys (replace with your real keys when going live) ──
const FLW_SECRET_KEY    = 'FLWSECK_TEST-PLACEHOLDER';   // from Flutterwave dashboard
const FLW_PUBLIC_KEY    = 'FLWPUBK_TEST-PLACEHOLDER';
const FLW_WEBHOOK_HASH  = 'UTE_WEBHOOK_SECRET_HASH';     // set this in FLW dashboard → Webhooks
const FLW_BASE_URL      = 'https://api.flutterwave.com/v3';

// ── In-memory store (replace with a real DB like MongoDB/PostgreSQL in production) ──
let userDatabase    = [];   // registered users
let depositDatabase = [];   // all deposit records
let withdrawDatabase = [];  // all withdrawal records
let referralDatabase = {};  // { referralCode: { joins: [], depositors: [] } }

// ── Generate referral code from username ──
function generateReferralCode(username) {
    const clean = username.replace(/\s+/g, '').toUpperCase().substring(0, 6);
    const rand  = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `UTE-${clean}-${rand}`;
}

// ════════════════════════════════════════════════════════════
//  SERVE FRONTEND FILES
// ════════════════════════════════════════════════════════════
const path = require('path');
const frontendPath = path.join(__dirname, '..');

// Serve all static files (HTML, CSS, JS, images) from the project root
app.use(express.static(frontendPath));

// Serve index.html for the root URL
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

    // Check if email already registered
    if (userDatabase.find(u => u.email === email)) {
        return res.status(400).json({ status: 'error', message: 'Email already registered' });
    }

    // Generate unique referral code for this new user
    const newReferralCode = generateReferralCode(username);

    const newUser = {
        username,
        lastname,
        email,
        country,
        password,
        referralCode:     newReferralCode,
        usedReferralCode: referralCode || null,
        registeredAt:     new Date().toLocaleString(),
        vipTier:          'None',
        referralJoins:    0,    // people who registered using this user's link
        referralDepositors: 0   // people who deposited after joining via this user's link
    };

    userDatabase.push(newUser);

    // Init referral tracking for this user
    referralDatabase[newReferralCode] = { joins: [], depositors: [] };

    // If this user registered via someone's referral link, record the join
    if (referralCode && referralDatabase[referralCode]) {
        referralDatabase[referralCode].joins.push({ username, email, joinedAt: new Date().toLocaleString() });
        // Update the referrer's join count
        const referrer = userDatabase.find(u => u.referralCode === referralCode);
        if (referrer) {
            referrer.referralJoins++;
            console.log(`[REFERRAL] ${username} joined via ${referrer.username}'s link`);
        }
    }

    console.log(`[REGISTER] New user: ${username} | Referral code: ${newReferralCode}`);

    return res.json({
        status:       'success',
        message:      'Registration successful',
        referralCode: newReferralCode,
        referralLink: `http://localhost:3000/register.html?ref=${newReferralCode}`
    });
});

// ════════════════════════════════════════════════════════════
//  2. GET REFERRAL STATS (Frontend polls this for dashboard)
// ════════════════════════════════════════════════════════════
app.get('/api/referral-stats/:referralCode', (req, res) => {
    const code = req.params.referralCode;
    const user = userDatabase.find(u => u.referralCode === code);

    if (!user) {
        return res.status(404).json({ status: 'error', message: 'Referral code not found' });
    }

    const depositors = user.referralDepositors;
    const vipInfo    = getVipInfo(depositors);

    // Calculate next VIP threshold
    const thresholds = [5, 10, 15, 20, 25];
    const nextThreshold = thresholds.find(t => t > depositors) || 25;

    return res.json({
        status:           'success',
        referralCode:     code,
        referralLink:     `http://localhost:3000/register.html?ref=${code}`,
        joins:            user.referralJoins,
        depositors:       depositors,
        vipTier:          vipInfo.tier,
        vipBonus:         vipInfo.bonus,
        nextVipAt:        nextThreshold,
        progressPercent:  Math.min(Math.round((depositors / nextThreshold) * 100), 100)
    });
});

// ════════════════════════════════════════════════════════════
//  3. INITIATE FLUTTERWAVE PAYMENT (Deposit)
// ════════════════════════════════════════════════════════════
app.post('/api/initiate-payment', async (req, res) => {
    const { amount, email, phone, name, planAmount, referralCode } = req.body;

    // Validate required fields
    if (!amount || !email || !phone || !name) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields: amount, email, phone, name' });
    }

    if (amount < 30000) {
        return res.status(400).json({ status: 'error', message: 'Minimum deposit is UGX 30,000' });
    }

    // Generate unique transaction reference
    const txRef = `UTE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    try {
        // Call Flutterwave API to create a payment link
        const response = await axios.post(
            `${FLW_BASE_URL}/payments`,
            {
                tx_ref:           txRef,
                amount:           amount,
                currency:         'UGX',
                redirect_url:     'http://localhost:3000/payment-callback',  // change to your domain when live
                payment_options:  'card,mobilemoneyuganda,ussd',
                customer: {
                    email:        email,
                    phonenumber:  phone,
                    name:         name
                },
                customizations: {
                    title:        'Urban Trove Earn',
                    description:  `Investment Deposit — UGX ${Number(amount).toLocaleString()}`,
                    logo:         'http://localhost:3000/logo.png'
                },
                meta: {
                    plan_amount:   planAmount,
                    referral_code: referralCode || ''
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${FLW_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.status === 'success') {
            // Save pending deposit record
            depositDatabase.push({
                txRef,
                amount,
                email,
                phone,
                name,
                planAmount,
                referralCode: referralCode || '',
                status:       'pending',
                timestamp:    new Date().toLocaleString()
            });

            console.log(`[DEPOSIT] Payment initiated — txRef: ${txRef}, amount: UGX ${amount}`);

            // Return the Flutterwave payment link to the frontend
            return res.json({
                status:       'success',
                txRef,
                paymentLink:  response.data.data.link
            });
        } else {
            return res.status(500).json({ status: 'error', message: 'Failed to create payment link' });
        }

    } catch (err) {
        console.error('[DEPOSIT ERROR]', err.response?.data || err.message);
        return res.status(500).json({
            status:  'error',
            message: err.response?.data?.message || 'Payment initiation failed'
        });
    }
});

// ════════════════════════════════════════════════════════════
//  2. PAYMENT CALLBACK (Flutterwave redirects user here after payment)
//  Verifies the transaction and updates the deposit record
// ════════════════════════════════════════════════════════════
app.get('/payment-callback', async (req, res) => {
    const { transaction_id, tx_ref, status } = req.query;

    if (status === 'cancelled') {
        return res.redirect('/deposit.html?payment=cancelled');
    }

    if (status !== 'successful' || !transaction_id) {
        return res.redirect('/deposit.html?payment=failed');
    }

    try {
        // Verify the transaction with Flutterwave to confirm it is real
        const verify = await axios.get(
            `${FLW_BASE_URL}/transactions/${transaction_id}/verify`,
            {
                headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` }
            }
        );

        const txData = verify.data.data;

        // Security checks — make sure amount and currency match
        const deposit = depositDatabase.find(d => d.txRef === tx_ref);

        if (
            verify.data.status === 'success'     &&
            txData.status       === 'successful' &&
            txData.currency     === 'UGX'        &&
            deposit             &&
            txData.amount       >= deposit.amount
        ) {
            // Mark deposit as completed
            deposit.status        = 'completed';
            deposit.transactionId = transaction_id;
            deposit.completedAt   = new Date().toLocaleString();

            console.log(`[DEPOSIT VERIFIED] txRef: ${tx_ref}, amount: UGX ${txData.amount}`);

            // Notify referrer if this depositor came via a referral link
            const depositorUser = userDatabase.find(u => u.email === deposit.email);
            if (depositorUser && depositorUser.usedReferralCode) {
                const referrer = userDatabase.find(u => u.referralCode === depositorUser.usedReferralCode);
                if (referrer) {
                    // Check if this depositor hasn't been counted before
                    const alreadyCounted = referralDatabase[depositorUser.usedReferralCode]?.depositors
                        .find(d => d.email === deposit.email);
                    if (!alreadyCounted) {
                        referralDatabase[depositorUser.usedReferralCode].depositors.push({
                            email:       deposit.email,
                            amount:      deposit.amount,
                            depositedAt: new Date().toLocaleString()
                        });
                        referrer.referralDepositors++;
                        // Auto-update referrer VIP tier
                        const vipInfo = getVipInfo(referrer.referralDepositors);
                        referrer.vipTier = vipInfo.tier;
                        console.log(`[REFERRAL DEPOSIT] ${deposit.email} deposited via ${referrer.username}'s link. Depositors: ${referrer.referralDepositors} | VIP: ${referrer.vipTier}`);
                    }
                }
            }

            // Redirect to deposit page with success
            return res.redirect(`/deposit.html?payment=success&txRef=${tx_ref}&amount=${deposit.amount}`);
        } else {
            deposit && (deposit.status = 'failed');
            return res.redirect('/deposit.html?payment=failed');
        }

    } catch (err) {
        console.error('[VERIFY ERROR]', err.response?.data || err.message);
        return res.redirect('/deposit.html?payment=failed');
    }
});

// ════════════════════════════════════════════════════════════
//  3. FLUTTERWAVE WEBHOOK
//  Flutterwave calls this automatically when payment status changes
//  Set this URL in your Flutterwave dashboard → Settings → Webhooks
// ════════════════════════════════════════════════════════════
app.post('/webhook/flutterwave', (req, res) => {
    // Verify the webhook is genuinely from Flutterwave using the secret hash
    const signature = req.headers['verif-hash'];
    if (!signature || signature !== FLW_WEBHOOK_HASH) {
        console.warn('[WEBHOOK] Unauthorized webhook attempt blocked');
        return res.sendStatus(401);
    }

    const payload = req.body;
    console.log('[WEBHOOK] Received:', JSON.stringify(payload, null, 2));

    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
        const txRef  = payload.data.tx_ref;
        const amount = payload.data.amount;

        // Find and update the deposit record
        const deposit = depositDatabase.find(d => d.txRef === txRef);
        if (deposit && deposit.status === 'pending') {
            deposit.status        = 'completed';
            deposit.transactionId = payload.data.id;
            deposit.completedAt   = new Date().toLocaleString();
            console.log(`[WEBHOOK] Deposit confirmed — txRef: ${txRef}, UGX ${amount}`);
        }
    }

    if (payload.event === 'transfer.completed') {
        const reference = payload.data.reference;
        const withdrawal = withdrawDatabase.find(w => w.reference === reference);
        if (withdrawal) {
            withdrawal.status      = payload.data.status;
            withdrawal.completedAt = new Date().toLocaleString();
            console.log(`[WEBHOOK] Withdrawal ${payload.data.status} — ref: ${reference}`);
        }
    }

    res.sendStatus(200);
});

// ════════════════════════════════════════════════════════════
//  4. INITIATE WITHDRAWAL (Payout to user's mobile money)
//  Called when user requests to withdraw their earnings
// ════════════════════════════════════════════════════════════
app.post('/api/withdraw', async (req, res) => {
    const { amount, phone, email, name, network } = req.body;

    // Validate
    if (!amount || !phone || !name) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields: amount, phone, name' });
    }

    if (amount < 5000) {
        return res.status(400).json({ status: 'error', message: 'Minimum withdrawal is UGX 5,000' });
    }

    const reference = `UTE-WD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    try {
        // Call Flutterwave Transfer API to send money to user's mobile money
        const response = await axios.post(
            `${FLW_BASE_URL}/transfers`,
            {
                account_bank:     network || 'MPS',  // MPS = MTN Uganda, ATE = Airtel Uganda
                account_number:   phone,
                amount:           amount,
                currency:         'UGX',
                narration:        'Urban Trove Earn — Investment Return',
                reference:        reference,
                callback_url:     'http://localhost:3000/webhook/flutterwave',
                debit_currency:   'UGX'
            },
            {
                headers: {
                    Authorization: `Bearer ${FLW_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.status === 'success') {
            // Save withdrawal record
            withdrawDatabase.push({
                reference,
                amount,
                phone,
                email,
                name,
                network:   network || 'MPS',
                status:    'pending',
                timestamp: new Date().toLocaleString()
            });

            console.log(`[WITHDRAWAL] Initiated — ref: ${reference}, UGX ${amount} to ${phone}`);

            return res.json({
                status:    'success',
                message:   `Withdrawal of UGX ${Number(amount).toLocaleString()} initiated to ${phone}`,
                reference
            });
        } else {
            return res.status(500).json({ status: 'error', message: 'Withdrawal initiation failed' });
        }

    } catch (err) {
        console.error('[WITHDRAWAL ERROR]', err.response?.data || err.message);
        return res.status(500).json({
            status:  'error',
            message: err.response?.data?.message || 'Withdrawal failed'
        });
    }
});

// ════════════════════════════════════════════════════════════
//  5. GET DEPOSIT STATUS BY TXREF (Frontend polls this)
//  Frontend calls this after redirect to confirm payment
// ════════════════════════════════════════════════════════════
app.get('/api/deposit-status/:txRef', (req, res) => {
    const deposit = depositDatabase.find(d => d.txRef === req.params.txRef);
    if (!deposit) {
        return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }
    return res.json({
        status:        'success',
        txRef:         deposit.txRef,
        amount:        deposit.amount,
        planAmount:    deposit.planAmount,
        paymentStatus: deposit.status,        // pending | completed | failed
        transactionId: deposit.transactionId || null,
        completedAt:   deposit.completedAt   || null
    });
});

// ════════════════════════════════════════════════════════════
//  6. VIEW ALL DEPOSITS (Admin use)
// ════════════════════════════════════════════════════════════
app.get('/api/view-deposits', (req, res) => {
    res.json({
        title:         'All Deposit Records — Urban Trove Earn',
        total:         depositDatabase.length,
        completed:     depositDatabase.filter(d => d.status === 'completed').length,
        pending:       depositDatabase.filter(d => d.status === 'pending').length,
        totalAmount:   depositDatabase.filter(d => d.status === 'completed').reduce((s, d) => s + d.amount, 0),
        deposits:      depositDatabase
    });
});

// ════════════════════════════════════════════════════════════
//  6. VIEW ALL WITHDRAWALS (Admin use)
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
    console.log('║  Frontend:    http://localhost:3000       ║');
    console.log('║  Deposits:    POST /api/initiate-payment  ║');
    console.log('║  Withdraw:    POST /api/withdraw          ║');
    console.log('║  Webhook:     POST /webhook/flutterwave   ║');
    console.log('║  View data:   GET  /api/view-deposits     ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
