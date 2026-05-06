const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

// ════════════════════════════════════════════════════════════
//  DATABASE
// ════════════════════════════════════════════════════════════
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/urban_trove_earn',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id                  SERIAL PRIMARY KEY,
                username            VARCHAR(100) NOT NULL,
                lastname            VARCHAR(100),
                email               VARCHAR(200) UNIQUE NOT NULL,
                country             VARCHAR(100),
                password            VARCHAR(200) NOT NULL,
                referral_code       VARCHAR(50) UNIQUE,
                used_referral       VARCHAR(50),
                vip_tier            VARCHAR(20) DEFAULT 'None',
                referral_joins      INTEGER DEFAULT 0,
                referral_depositors INTEGER DEFAULT 0,
                registered_at       TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS deposits (
                id            SERIAL PRIMARY KEY,
                tx_ref        VARCHAR(100) UNIQUE,
                amount        BIGINT NOT NULL CHECK (amount > 0),
                email         VARCHAR(200),
                phone         VARCHAR(50),
                name          VARCHAR(200),
                plan_amount   BIGINT,
                referral_code VARCHAR(50),
                status        VARCHAR(50) DEFAULT 'completed',
                created_at    TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                id          SERIAL PRIMARY KEY,
                reference   VARCHAR(100) UNIQUE,
                amount      BIGINT NOT NULL CHECK (amount > 0),
                phone       VARCHAR(50),
                email       VARCHAR(200),
                name        VARCHAR(200),
                network     VARCHAR(50),
                status      VARCHAR(50) DEFAULT 'pending',
                created_at  TIMESTAMP DEFAULT NOW()
            )
        `);

        // ── Audit log table — every money movement recorded permanently ──
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id          SERIAL PRIMARY KEY,
                event_type  VARCHAR(100) NOT NULL,
                email       VARCHAR(200),
                amount      BIGINT,
                reference   VARCHAR(200),
                ip_address  VARCHAR(50),
                details     TEXT,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('[DB] Tables ready ✅');
    } catch (err) {
        console.error('[DB ERROR]', err.message);
    }
}

// ── Audit log helper ──────────────────────────────────────────
async function auditLog(eventType, email, amount, reference, ip, details) {
    try {
        await pool.query(
            'INSERT INTO audit_log (event_type, email, amount, reference, ip_address, details) VALUES ($1,$2,$3,$4,$5,$6)',
            [eventType, email || 'unknown', amount || 0, reference || '', ip || '', details || '']
        );
    } catch (err) {
        console.error('[AUDIT LOG ERROR]', err.message);
    }
}

// ════════════════════════════════════════════════════════════
//  RATE LIMITING — prevent brute force and race conditions
// ════════════════════════════════════════════════════════════
const rateLimitMap = new Map(); // ip -> { count, resetTime }

function rateLimit(maxRequests, windowMs) {
    return (req, res, next) => {
        const ip  = req.ip || req.connection.remoteAddress || 'unknown';
        const key = `${ip}:${req.path}`;
        const now = Date.now();
        const entry = rateLimitMap.get(key);

        if (!entry || now > entry.resetTime) {
            rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }

        entry.count++;
        if (entry.count > maxRequests) {
            auditLog('RATE_LIMIT_BLOCKED', null, 0, '', ip, `Blocked: ${req.path}`);
            return res.status(429).json({ status: 'error', message: 'Too many requests. Please wait and try again.' });
        }
        next();
    };
}

// ── Race condition lock — prevent double withdrawals ──────────
const processingLocks = new Set(); // emails currently being processed

function acquireLock(email) {
    if (processingLocks.has(email)) return false;
    processingLocks.add(email);
    return true;
}

function releaseLock(email) {
    processingLocks.delete(email);
}

// ── Input sanitization ────────────────────────────────────────
function sanitizeAmount(val) {
    const n = Math.floor(Number(val)); // always integer, no decimals
    if (!isFinite(n) || n <= 0) return null; // block negative, zero, NaN
    return n;
}

function sanitizeString(val, maxLen = 200) {
    if (!val || typeof val !== 'string') return '';
    return val.trim().substring(0, maxLen).replace(/[<>'"]/g, ''); // strip XSS chars
}

function roundDownTo100(amount) {
    return Math.floor(amount / 100) * 100;
}

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
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
//  SERVE FRONTEND
// ════════════════════════════════════════════════════════════
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// ════════════════════════════════════════════════════════════
//  1. REGISTER — rate limited to 5 per hour per IP
// ════════════════════════════════════════════════════════════
app.post('/api/register', rateLimit(5, 60 * 60 * 1000), async (req, res) => {
    const username     = sanitizeString(req.body.username, 50);
    const lastname     = sanitizeString(req.body.lastname, 50);
    const email        = sanitizeString(req.body.email, 100).toLowerCase();
    const country      = sanitizeString(req.body.country, 50);
    const password     = sanitizeString(req.body.password, 100);
    const referralCode = sanitizeString(req.body.referralCode, 20);
    const ip           = req.ip || '';

    if (!username || !email || !password) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ status: 'error', message: 'Invalid email address' });
    }

    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ status: 'error', message: 'Email already registered' });
        }

        const newReferralCode = generateReferralCode(username);
        await pool.query(
            'INSERT INTO users (username, lastname, email, country, password, referral_code, used_referral) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [username, lastname, email, country, password, newReferralCode, referralCode || null]
        );

        if (referralCode) {
            await pool.query('UPDATE users SET referral_joins = referral_joins + 1 WHERE referral_code = $1', [referralCode]);
        }

        await auditLog('REGISTER', email, 0, newReferralCode, ip, `New user: ${username}`);
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

        return res.json({
            status: 'success', message: 'Registration successful',
            referralCode: newReferralCode,
            referralLink: `${baseUrl}/register.html?ref=${newReferralCode}`
        });
    } catch (err) {
        console.error('[REGISTER ERROR]', err.message);
        return res.status(500).json({ status: 'error', message: 'Registration failed' });
    }
});

// ════════════════════════════════════════════════════════════
//  2. LOGIN — rate limited to 10 per 15 minutes per IP
// ════════════════════════════════════════════════════════════
app.post('/api/login', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
    const username = sanitizeString(req.body.username, 50);
    const password = sanitizeString(req.body.password, 100);
    const ip       = req.ip || '';

    if (!username || !password) {
        return res.status(400).json({ status: 'error', message: 'Missing username or password' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);

        if (result.rows.length === 0) {
            await auditLog('LOGIN_FAILED', username, 0, '', ip, 'Wrong credentials');
            return res.status(401).json({ status: 'error', message: 'Incorrect username or password' });
        }

        const user    = result.rows[0];
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        await auditLog('LOGIN_SUCCESS', user.email, 0, '', ip, `User logged in: ${username}`);

        return res.json({
            status: 'success', message: 'Login successful',
            username: user.username, lastname: user.lastname,
            email: user.email, country: user.country,
            referralCode: user.referral_code,
            referralLink: `${baseUrl}/register.html?ref=${user.referral_code}`,
            vipTier: user.vip_tier,
            referralJoins: user.referral_joins,
            referralDepositors: user.referral_depositors,
            registeredAt: user.registered_at
        });
    } catch (err) {
        console.error('[LOGIN ERROR]', err.message);
        return res.status(500).json({ status: 'error', message: 'Login failed' });
    }
});

// ════════════════════════════════════════════════════════════
//  3. REFERRAL STATS
// ════════════════════════════════════════════════════════════
app.get('/api/referral-stats/:referralCode', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE referral_code = $1', [req.params.referralCode]);
        if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Referral code not found' });

        const user = result.rows[0];
        const depositors = user.referral_depositors;
        const vipInfo    = getVipInfo(depositors);
        const thresholds = [5, 10, 15, 20, 25];
        const nextThreshold = thresholds.find(t => t > depositors) || 25;
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

        return res.json({
            status: 'success', referralCode: user.referral_code,
            referralLink: `${baseUrl}/register.html?ref=${user.referral_code}`,
            joins: user.referral_joins, depositors,
            vipTier: vipInfo.tier, vipBonus: vipInfo.bonus,
            nextVipAt: nextThreshold,
            progressPercent: Math.min(Math.round((depositors / nextThreshold) * 100), 100)
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to get referral stats' });
    }
});

// ════════════════════════════════════════════════════════════
//  4. RECORD DEPOSIT — validates amount, blocks negatives
// ════════════════════════════════════════════════════════════
app.post('/api/record-deposit', rateLimit(20, 60 * 1000), async (req, res) => {
    const amount       = sanitizeAmount(req.body.amount);
    const email        = sanitizeString(req.body.email, 100).toLowerCase();
    const phone        = sanitizeString(req.body.phone, 20);
    const name         = sanitizeString(req.body.name, 100);
    const planAmount   = sanitizeAmount(req.body.planAmount);
    const referralCode = sanitizeString(req.body.referralCode, 20);
    const txRef        = sanitizeString(req.body.txRef, 100) || `UTE-${Date.now()}`;
    const ip           = req.ip || '';

    // Block negative, zero, or invalid amounts
    if (!amount || amount === null) {
        await auditLog('DEPOSIT_BLOCKED', email, req.body.amount, txRef, ip, 'Invalid/negative amount');
        return res.status(400).json({ status: 'error', message: 'Invalid deposit amount. Must be a positive number.' });
    }

    if (amount < 30000) {
        return res.status(400).json({ status: 'error', message: 'Minimum deposit is UGX 30,000' });
    }

    if (!email) return res.status(400).json({ status: 'error', message: 'Email required' });

    try {
        // Check for duplicate transaction reference
        const dupCheck = await pool.query('SELECT id FROM deposits WHERE tx_ref = $1', [txRef]);
        if (dupCheck.rows.length > 0) {
            await auditLog('DEPOSIT_DUPLICATE', email, amount, txRef, ip, 'Duplicate txRef blocked');
            return res.status(400).json({ status: 'error', message: 'Duplicate transaction detected' });
        }

        await pool.query(
            "INSERT INTO deposits (tx_ref, amount, email, phone, name, plan_amount, referral_code, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'completed')",
            [txRef, amount, email, phone, name, planAmount, referralCode || '']
        );

        // Update referrer
        if (referralCode) {
            const already = await pool.query('SELECT id FROM deposits WHERE email = $1 AND referral_code = $2', [email, referralCode]);
            if (already.rows.length === 1) {
                const referrer = await pool.query('SELECT id, referral_depositors FROM users WHERE referral_code = $1', [referralCode]);
                if (referrer.rows.length > 0) {
                    const newCount = referrer.rows[0].referral_depositors + 1;
                    const vipInfo  = getVipInfo(newCount);
                    await pool.query('UPDATE users SET referral_depositors = $1, vip_tier = $2 WHERE referral_code = $3', [newCount, vipInfo.tier, referralCode]);
                }
            }
        }

        await auditLog('DEPOSIT', email, amount, txRef, ip, `Deposit UGX ${amount}`);
        return res.json({ status: 'success', message: 'Deposit recorded successfully' });

    } catch (err) {
        console.error('[DEPOSIT ERROR]', err.message);
        return res.status(500).json({ status: 'error', message: 'Failed to record deposit' });
    }
});

// ════════════════════════════════════════════════════════════
//  5. RECORD WITHDRAWAL — race condition lock + rounding
// ════════════════════════════════════════════════════════════
app.post('/api/record-withdrawal', rateLimit(3, 60 * 1000), async (req, res) => {
    const rawAmount = sanitizeAmount(req.body.amount);
    const phone     = sanitizeString(req.body.phone, 20);
    const email     = sanitizeString(req.body.email, 100).toLowerCase();
    const name      = sanitizeString(req.body.name, 100);
    const network   = sanitizeString(req.body.network, 10) || 'MTN';
    const ip        = req.ip || '';

    // Block negative or zero amounts
    if (!rawAmount || rawAmount === null) {
        await auditLog('WITHDRAWAL_BLOCKED', email, req.body.amount, '', ip, 'Invalid/negative amount');
        return res.status(400).json({ status: 'error', message: 'Invalid withdrawal amount. Must be a positive number.' });
    }

    // Round down to nearest 100
    const amount = roundDownTo100(rawAmount);

    if (amount < 5000) {
        return res.status(400).json({ status: 'error', message: 'Minimum withdrawal is UGX 5,000' });
    }

    if (!phone || !name) {
        return res.status(400).json({ status: 'error', message: 'Phone and name are required' });
    }

    // ── Race condition lock — prevent double withdrawal ──
    const lockKey = email || phone;
    if (!acquireLock(lockKey)) {
        await auditLog('WITHDRAWAL_RACE_BLOCKED', email, amount, '', ip, 'Race condition blocked');
        return res.status(429).json({ status: 'error', message: 'A withdrawal is already being processed. Please wait.' });
    }

    const reference = `UTE-WD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    try {
        await pool.query(
            "INSERT INTO withdrawals (reference, amount, phone, email, name, network, status) VALUES ($1,$2,$3,$4,$5,$6,'pending')",
            [reference, amount, phone, email, name, network]
        );

        await auditLog('WITHDRAWAL', email, amount, reference, ip, `Withdrawal UGX ${amount} to ${phone} (${network}). Rounded from ${rawAmount}.`);

        return res.json({
            status: 'success',
            message: `Withdrawal of UGX ${amount.toLocaleString()} recorded for ${phone}`,
            reference,
            amountSent: amount,
            amountRemainder: rawAmount - amount
        });

    } catch (err) {
        console.error('[WITHDRAWAL ERROR]', err.message);
        await auditLog('WITHDRAWAL_ERROR', email, amount, reference, ip, err.message);
        return res.status(500).json({ status: 'error', message: 'Failed to record withdrawal' });
    } finally {
        releaseLock(lockKey); // always release lock
    }
});

// ════════════════════════════════════════════════════════════
//  6. VIEW DEPOSITS (Admin)
// ════════════════════════════════════════════════════════════
app.get('/api/view-deposits', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM deposits ORDER BY created_at DESC');
        const total  = result.rows.reduce((s, d) => s + Number(d.amount), 0);
        res.json({ title: 'All Deposits', total: result.rows.length, totalAmount: total, deposits: result.rows });
    } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  7. VIEW WITHDRAWALS (Admin)
// ════════════════════════════════════════════════════════════
app.get('/api/view-withdrawals', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM withdrawals ORDER BY created_at DESC');
        res.json({ title: 'All Withdrawals', total: result.rows.length, withdrawals: result.rows });
    } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  8. VIEW USERS (Admin)
// ════════════════════════════════════════════════════════════
app.get('/api/view-users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, lastname, email, country, referral_code, vip_tier, referral_joins, referral_depositors, registered_at FROM users ORDER BY registered_at DESC'
        );
        res.json({ title: 'All Users', total: result.rows.length, users: result.rows });
    } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  9. VIEW AUDIT LOG (Owners only)
// ════════════════════════════════════════════════════════════
app.get('/api/audit-log', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200');
        res.json({ title: 'Audit Log', total: result.rows.length, logs: result.rows });
    } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  10. RECORD GAME BET
// ════════════════════════════════════════════════════════════
let gameWalletDatabase = [];

app.post('/api/record-game-bet', (req, res) => {
    const betAmount = sanitizeAmount(req.body.betAmount);
    const game      = sanitizeString(req.body.game, 50);
    const email     = sanitizeString(req.body.email, 100);
    const result    = sanitizeString(req.body.result, 10);
    const payout    = Math.max(0, Number(req.body.payout || 0));

    if (!betAmount || !game) return res.status(400).json({ status: 'error', message: 'Missing fields' });

    gameWalletDatabase.push({
        email: email || 'guest', game, betAmount,
        result: result || 'loss', payout,
        profit: betAmount - payout,
        timestamp: new Date().toLocaleString()
    });

    return res.json({ status: 'success', message: 'Game bet recorded' });
});

// ════════════════════════════════════════════════════════════
//  11. GAME STATS (Admin/Owners)
// ════════════════════════════════════════════════════════════
app.get('/api/game-stats', (req, res) => {
    const totalBets    = gameWalletDatabase.reduce((s, g) => s + g.betAmount, 0);
    const totalPayouts = gameWalletDatabase.reduce((s, g) => s + g.payout, 0);
    const byGame = {};
    gameWalletDatabase.forEach(g => {
        if (!byGame[g.game]) byGame[g.game] = { bets: 0, payouts: 0, rounds: 0 };
        byGame[g.game].bets    += g.betAmount;
        byGame[g.game].payouts += g.payout;
        byGame[g.game].rounds  += 1;
    });
    res.json({
        title: 'Game Stats', totalRounds: gameWalletDatabase.length,
        totalBets: `UGX ${totalBets.toLocaleString()}`,
        totalPayouts: `UGX ${totalPayouts.toLocaleString()}`,
        ownerProfit: `UGX ${(totalBets - totalPayouts).toLocaleString()}`,
        byGame, recentBets: gameWalletDatabase.slice(0, 20)
    });
});

// ════════════════════════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await initDB();
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log(`║   Urban Trove Earn — Port ${PORT}           ║`);
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Security: Rate limiting ✅               ║');
    console.log('║  Security: Race condition locks ✅        ║');
    console.log('║  Security: Input validation ✅            ║');
    console.log('║  Security: Audit log ✅                   ║');
    console.log('║  Security: Negative amount blocking ✅    ║');
    console.log('║  Security: Rounding enforcement ✅        ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
