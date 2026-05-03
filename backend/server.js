const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

// ════════════════════════════════════════════════════════════
//  DATABASE CONNECTION
//  On Render: set DATABASE_URL environment variable
//  Locally: uses localhost PostgreSQL
// ════════════════════════════════════════════════════════════
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/urban_trove_earn',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ── Create tables if they don't exist ────────────────────────
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id               SERIAL PRIMARY KEY,
                username         VARCHAR(100) NOT NULL,
                lastname         VARCHAR(100),
                email            VARCHAR(200) UNIQUE NOT NULL,
                country          VARCHAR(100),
                password         VARCHAR(200) NOT NULL,
                referral_code    VARCHAR(50) UNIQUE,
                used_referral    VARCHAR(50),
                vip_tier         VARCHAR(20) DEFAULT 'None',
                referral_joins   INTEGER DEFAULT 0,
                referral_depositors INTEGER DEFAULT 0,
                registered_at    TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS deposits (
                id            SERIAL PRIMARY KEY,
                tx_ref        VARCHAR(100),
                amount        BIGINT NOT NULL,
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
                reference   VARCHAR(100),
                amount      BIGINT NOT NULL,
                phone       VARCHAR(50),
                email       VARCHAR(200),
                name        VARCHAR(200),
                network     VARCHAR(50),
                status      VARCHAR(50) DEFAULT 'pending',
                created_at  TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('[DB] Tables ready ✅');
    } catch (err) {
        console.error('[DB ERROR]', err.message);
    }
}

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
//  1. REGISTER USER
// ════════════════════════════════════════════════════════════
app.post('/api/register', async (req, res) => {
    const { username, lastname, email, country, password, referralCode } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    try {
        // Check if email already exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ status: 'error', message: 'Email already registered' });
        }

        const newReferralCode = generateReferralCode(username);

        // Insert new user
        await pool.query(`
            INSERT INTO users (username, lastname, email, country, password, referral_code, used_referral)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [username, lastname, email, country, password, newReferralCode, referralCode || null]);

        // If registered via referral link — update referrer join count
        if (referralCode) {
            await pool.query(`
                UPDATE users SET referral_joins = referral_joins + 1
                WHERE referral_code = $1
            `, [referralCode]);
        }

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        console.log(`[REGISTER] ${username} | Code: ${newReferralCode}`);

        return res.json({
            status:       'success',
            message:      'Registration successful',
            referralCode: newReferralCode,
            referralLink: `${baseUrl}/register.html?ref=${newReferralCode}`
        });

    } catch (err) {
        console.error('[REGISTER ERROR]', err.message);
        return res.status(500).json({ status: 'error', message: 'Registration failed' });
    }
});

// ════════════════════════════════════════════════════════════
//  2. LOGIN USER
// ════════════════════════════════════════════════════════════
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: 'error', message: 'Missing username or password' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ status: 'error', message: 'Incorrect username or password' });
        }

        const user = result.rows[0];
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

        return res.json({
            status:       'success',
            message:      'Login successful',
            username:     user.username,
            lastname:     user.lastname,
            email:        user.email,
            country:      user.country,
            referralCode: user.referral_code,
            referralLink: `${baseUrl}/register.html?ref=${user.referral_code}`,
            vipTier:      user.vip_tier,
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
//  3. GET REFERRAL STATS
// ════════════════════════════════════════════════════════════
app.get('/api/referral-stats/:referralCode', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE referral_code = $1',
            [req.params.referralCode]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Referral code not found' });
        }

        const user          = result.rows[0];
        const depositors    = user.referral_depositors;
        const vipInfo       = getVipInfo(depositors);
        const thresholds    = [5, 10, 15, 20, 25];
        const nextThreshold = thresholds.find(t => t > depositors) || 25;
        const baseUrl       = process.env.BASE_URL || 'http://localhost:3000';

        return res.json({
            status:          'success',
            referralCode:    user.referral_code,
            referralLink:    `${baseUrl}/register.html?ref=${user.referral_code}`,
            joins:           user.referral_joins,
            depositors,
            vipTier:         vipInfo.tier,
            vipBonus:        vipInfo.bonus,
            nextVipAt:       nextThreshold,
            progressPercent: Math.min(Math.round((depositors / nextThreshold) * 100), 100)
        });

    } catch (err) {
        console.error('[REFERRAL STATS ERROR]', err.message);
        return res.status(500).json({ status: 'error', message: 'Failed to get referral stats' });
    }
});

// ════════════════════════════════════════════════════════════
//  4. RECORD DEPOSIT
// ════════════════════════════════════════════════════════════
app.post('/api/record-deposit', async (req, res) => {
    const { amount, email, phone, name, planAmount, referralCode, txRef } = req.body;

    if (!amount || !email) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    if (amount < 30000) {
        return res.status(400).json({ status: 'error', message: 'Minimum deposit is UGX 30,000' });
    }

    try {
        await pool.query(`
            INSERT INTO deposits (tx_ref, amount, email, phone, name, plan_amount, referral_code, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')
        `, [txRef || `UTE-${Date.now()}`, amount, email, phone, name, planAmount, referralCode || '']);

        // Update referrer depositor count
        if (referralCode) {
            // Check not already counted
            const already = await pool.query(
                'SELECT id FROM deposits WHERE email = $1 AND referral_code = $2',
                [email, referralCode]
            );
            if (already.rows.length === 1) {
                // First deposit via this referral — update referrer
                const referrer = await pool.query(
                    'SELECT id, referral_depositors FROM users WHERE referral_code = $1',
                    [referralCode]
                );
                if (referrer.rows.length > 0) {
                    const newCount = referrer.rows[0].referral_depositors + 1;
                    const vipInfo  = getVipInfo(newCount);
                    await pool.query(
                        'UPDATE users SET referral_depositors = $1, vip_tier = $2 WHERE referral_code = $3',
                        [newCount, vipInfo.tier, referralCode]
                    );
                    console.log(`[REFERRAL DEPOSIT] ${email} | VIP updated: ${vipInfo.tier}`);
                }
            }
        }

        console.log(`[DEPOSIT RECORDED] ${email} — UGX ${amount}`);
        return res.json({ status: 'success', message: 'Deposit recorded successfully' });

    } catch (err) {
        console.error('[DEPOSIT ERROR]', err.message);
        return res.status(500).json({ status: 'error', message: 'Failed to record deposit' });
    }
});

// ════════════════════════════════════════════════════════════
//  5. RECORD WITHDRAWAL
// ════════════════════════════════════════════════════════════
app.post('/api/record-withdrawal', async (req, res) => {
    const { amount, phone, email, name, network } = req.body;

    if (!amount || !phone || !name) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    if (amount < 5000) {
        return res.status(400).json({ status: 'error', message: 'Minimum withdrawal is UGX 5,000' });
    }

    const reference = `UTE-WD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    try {
        await pool.query(`
            INSERT INTO withdrawals (reference, amount, phone, email, name, network, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        `, [reference, amount, phone, email, name, network || 'MTN']);

        console.log(`[WITHDRAWAL RECORDED] ${phone} — UGX ${amount} | ref: ${reference}`);

        return res.json({
            status:    'success',
            message:   `Withdrawal of UGX ${Number(amount).toLocaleString()} recorded for ${phone}`,
            reference
        });

    } catch (err) {
        console.error('[WITHDRAWAL ERROR]', err.message);
        return res.status(500).json({ status: 'error', message: 'Failed to record withdrawal' });
    }
});

// ════════════════════════════════════════════════════════════
//  6. VIEW ALL DEPOSITS (Admin)
// ════════════════════════════════════════════════════════════
app.get('/api/view-deposits', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM deposits ORDER BY created_at DESC');
        const total  = result.rows.reduce((s, d) => s + Number(d.amount), 0);
        res.json({
            title:       'All Deposit Records — Urban Trove Earn',
            total:       result.rows.length,
            totalAmount: total,
            deposits:    result.rows
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ════════════════════════════════════════════════════════════
//  7. VIEW ALL WITHDRAWALS (Admin)
// ════════════════════════════════════════════════════════════
app.get('/api/view-withdrawals', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM withdrawals ORDER BY created_at DESC');
        res.json({
            title:       'All Withdrawal Records — Urban Trove Earn',
            total:       result.rows.length,
            withdrawals: result.rows
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ════════════════════════════════════════════════════════════
//  8. VIEW ALL USERS (Admin)
// ════════════════════════════════════════════════════════════
app.get('/api/view-users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, lastname, email, country, referral_code, vip_tier, referral_joins, referral_depositors, registered_at FROM users ORDER BY registered_at DESC'
        );
        res.json({
            title: 'All Registered Users — Urban Trove Earn',
            total: result.rows.length,
            users: result.rows
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ════════════════════════════════════════════════════════════
//  7. RECORD GAME WALLET TRANSACTION
//  Called every time a user loses money in games
//  This tracks all game losses as owner profit
// ════════════════════════════════════════════════════════════
let gameWalletDatabase = []; // tracks all game bets and losses

app.post('/api/record-game-bet', (req, res) => {
    const { email, game, betAmount, result, payout, profit } = req.body;

    if (!betAmount || !game) {
        return res.status(400).json({ status: 'error', message: 'Missing fields' });
    }

    gameWalletDatabase.push({
        email:     email || 'guest',
        game,
        betAmount: Number(betAmount),
        result:    result || 'loss',
        payout:    Number(payout || 0),
        profit:    Number(profit || betAmount), // owner profit = bet amount when player loses
        timestamp: new Date().toLocaleString()
    });

    console.log(`[GAME BET] ${game} | Bet: UGX ${betAmount} | Result: ${result} | Owner profit: UGX ${profit || betAmount}`);

    return res.json({ status: 'success', message: 'Game bet recorded' });
});

// ════════════════════════════════════════════════════════════
//  8. VIEW GAME WALLET STATS (Admin/Owners)
// ════════════════════════════════════════════════════════════
app.get('/api/game-stats', (req, res) => {
    const totalBets    = gameWalletDatabase.reduce((s, g) => s + g.betAmount, 0);
    const totalPayouts = gameWalletDatabase.reduce((s, g) => s + g.payout, 0);
    const ownerProfit  = totalBets - totalPayouts;

    const byGame = {};
    gameWalletDatabase.forEach(g => {
        if (!byGame[g.game]) byGame[g.game] = { bets: 0, payouts: 0, rounds: 0 };
        byGame[g.game].bets    += g.betAmount;
        byGame[g.game].payouts += g.payout;
        byGame[g.game].rounds  += 1;
    });

    res.json({
        title:        'Game Wallet Stats — Urban Trove Earn',
        totalRounds:  gameWalletDatabase.length,
        totalBets:    `UGX ${totalBets.toLocaleString()}`,
        totalPayouts: `UGX ${totalPayouts.toLocaleString()}`,
        ownerProfit:  `UGX ${ownerProfit.toLocaleString()}`,
        byGame,
        recentBets:   gameWalletDatabase.slice(0, 20)
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
    console.log('║  Frontend:  http://localhost:' + PORT + '         ║');
    console.log('║  Register:  POST /api/register            ║');
    console.log('║  Login:     POST /api/login               ║');
    console.log('║  Deposit:   POST /api/record-deposit      ║');
    console.log('║  Withdraw:  POST /api/record-withdrawal   ║');
    console.log('║  Admin:     GET  /api/view-deposits       ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
