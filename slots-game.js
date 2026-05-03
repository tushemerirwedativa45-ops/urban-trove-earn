// ═══════════════════════════════════════════════════════════
//  URBAN SLOTS — Professional Slot Machine
//  - 3 reels, 5 symbols
//  - Win lines: 3 of a kind, 2 of a kind
//  - House edge built in (player loses ~60%)
//  - Canvas animated spinning reels
//  - Linked to game wallet
// ═══════════════════════════════════════════════════════════

const slots = {
    canvas: null,
    ctx: null,
    animId: null,
    isSpinning: false,
    balance: 0,
    betAmount: 100,
    totalWon: 0,
    roundsPlayed: 0,

    // Reel state
    reels: [0, 0, 0],           // final symbol index per reel
    spinOffsets: [0, 0, 0],     // current animation offset
    spinSpeeds: [0, 0, 0],
    spinDone: [false, false, false],

    // Symbols: emoji, name, payout multiplier for 3-of-a-kind
    symbols: [
        { emoji: '7️⃣',  name: 'Seven',    color: '#ff3333', payout3: 50,  payout2: 5  },
        { emoji: '💎',  name: 'Diamond',  color: '#00cfff', payout3: 30,  payout2: 3  },
        { emoji: '🍒',  name: 'Cherry',   color: '#ff6b6b', payout3: 20,  payout2: 2  },
        { emoji: '🍋',  name: 'Lemon',    color: '#FFD700', payout3: 15,  payout2: 1  },
        { emoji: '🍇',  name: 'Grape',    color: '#c084fc', payout3: 10,  payout2: 0  },
        { emoji: '🔔',  name: 'Bell',     color: '#fbbf24', payout3: 8,   payout2: 0  },
        { emoji: '⭐',  name: 'Star',     color: '#f59e0b', payout3: 5,   payout2: 0  },
        { emoji: '🍀',  name: 'Clover',   color: '#28a745', payout3: 3,   payout2: 0  }
    ],

    // Weighted reel strips — lower index symbols appear less often (house edge)
    reelStrip: [7,7,7,6,6,6,5,5,5,4,4,4,3,3,2,2,1,0]
};

// ── Init ──────────────────────────────────────────────────────
function initSlotsGame() {
    slots.canvas = document.getElementById('slotsCanvas');
    if (!slots.canvas) return;
    slots.ctx = slots.canvas.getContext('2d');

    // Load balance from game wallet
    slots.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');

    resizeSlotsCanvas();
    window.addEventListener('resize', resizeSlotsCanvas);

    drawSlots();
    updateSlotsUI();
}

function resizeSlotsCanvas() {
    if (!slots.canvas) return;
    slots.canvas.width  = slots.canvas.parentElement.clientWidth  || 600;
    slots.canvas.height = slots.canvas.parentElement.clientHeight || 400;
    if (!slots.isSpinning) drawSlots();
}

// ── Drawing ───────────────────────────────────────────────────
function drawSlots(spinOffsets) {
    const { ctx, canvas, symbols, reelStrip } = slots;
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const offsets = spinOffsets || [0, 0, 0];

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0a2e');
    bg.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Machine frame
    ctx.fillStyle = 'rgba(255,215,0,0.08)';
    ctx.fillRect(W*0.05, H*0.05, W*0.9, H*0.9);

    // Reel dimensions
    const reelW   = W * 0.25;
    const reelH   = H * 0.65;
    const reelY   = H * 0.15;
    const gap     = W * 0.04;
    const totalW  = reelW * 3 + gap * 2;
    const startX  = (W - totalW) / 2;
    const symH    = reelH / 3;

    // Draw each reel
    for (let r = 0; r < 3; r++) {
        const rx = startX + r * (reelW + gap);

        // Reel background
        ctx.fillStyle = '#0a0a1a';
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        roundRectSlots(ctx, rx, reelY, reelW, reelH, 10);
        ctx.fill();
        ctx.stroke();

        // Clip to reel area
        ctx.save();
        ctx.beginPath();
        roundRectSlots(ctx, rx, reelY, reelW, reelH, 10);
        ctx.clip();

        // Draw 3 visible symbols + partial ones above/below
        const offset = offsets[r] % slots.reelStrip.length;
        for (let s = -1; s <= 3; s++) {
            const stripIdx = ((Math.floor(offset) + s) % slots.reelStrip.length + slots.reelStrip.length) % slots.reelStrip.length;
            const symIdx   = slots.reelStrip[stripIdx];
            const sym      = symbols[symIdx];
            const sy       = reelY + s * symH - (offset % 1) * symH;

            if (sy + symH < reelY || sy > reelY + reelH) continue;

            // Symbol background
            const symGrad = ctx.createLinearGradient(rx, sy, rx, sy + symH);
            symGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
            symGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
            ctx.fillStyle = symGrad;
            ctx.fillRect(rx + 2, sy + 2, reelW - 4, symH - 4);

            // Symbol emoji
            ctx.font = `${symH * 0.55}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(sym.emoji, rx + reelW / 2, sy + symH / 2);
        }

        ctx.restore();

        // Reel border overlay
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        roundRectSlots(ctx, rx, reelY, reelW, reelH, 10);
        ctx.stroke();
    }

    // Win line highlight (middle row)
    ctx.strokeStyle = 'rgba(255,215,0,0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(startX - 10, reelY + reelH / 2);
    ctx.lineTo(startX + totalW + 10, reelY + reelH / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Title
    ctx.font = `bold ${W * 0.06}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15;
    ctx.fillText('URBAN SLOTS', W / 2, H * 0.1);
    ctx.shadowBlur = 0;
}

function roundRectSlots(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ── Spin logic ────────────────────────────────────────────────
function spinSlots() {
    if (slots.isSpinning) return;
    if (slots.betAmount < 100) { showSlotsMsg('❌ Minimum bet is UGX 100', '#ff4444'); return; }
    if (slots.betAmount > slots.balance) { showSlotsMsg('❌ Insufficient balance', '#ff4444'); return; }

    slots.balance   -= slots.betAmount;
    slots.isSpinning = true;
    slots.spinDone   = [false, false, false];

    document.getElementById('slotsSpinBtn').disabled = true;
    document.getElementById('slotsResultMsg').innerHTML = '';
    updateSlotsUI();

    // Determine results with house edge
    const results = generateSlotsResult();
    slots.reels = results;

    // Set spin speeds — reel 1 stops first, reel 3 last
    const baseSpeed = 25;
    slots.spinOffsets = [0, 0, 0];
    slots.spinSpeeds  = [baseSpeed, baseSpeed * 1.2, baseSpeed * 1.5];

    // Target offsets for each reel to land on result
    const targetOffsets = results.map(symIdx => {
        const pos = slots.reelStrip.lastIndexOf(symIdx);
        return pos >= 0 ? pos : 0;
    });

    // Add extra full rotations for effect
    const extraSpins = [
        slots.reelStrip.length * 4,
        slots.reelStrip.length * 5,
        slots.reelStrip.length * 6
    ];

    const finalOffsets = targetOffsets.map((t, i) => t + extraSpins[i]);
    const stopTimes    = [1800, 2600, 3400]; // ms when each reel stops

    const startTime = Date.now();

    function animateSpin() {
        const elapsed = Date.now() - startTime;
        const offsets = [0, 0, 0];

        for (let r = 0; r < 3; r++) {
            if (elapsed >= stopTimes[r]) {
                offsets[r]       = finalOffsets[r];
                slots.spinDone[r] = true;
            } else {
                const progress = elapsed / stopTimes[r];
                const eased    = 1 - Math.pow(1 - progress, 3);
                offsets[r]     = eased * finalOffsets[r];
            }
        }

        drawSlots(offsets);

        if (slots.spinDone.every(d => d)) {
            slots.isSpinning = false;
            drawSlots(finalOffsets);
            resolveSlots(results);
            document.getElementById('slotsSpinBtn').disabled = false;
            // Sync wallet
            localStorage.setItem('ute_game_wallet', slots.balance.toString());
            const wEl = document.getElementById('gameWalletDisplay');
            if (wEl) wEl.textContent = 'UGX ' + slots.balance.toLocaleString();
        } else {
            slots.animId = requestAnimationFrame(animateSpin);
        }
    }

    slots.animId = requestAnimationFrame(animateSpin);
}

// ── House edge result generator ───────────────────────────────
function generateSlotsResult() {
    const loseChance = 0.95; // house always wins 95%

    if (Math.random() < loseChance) {
        // Force a losing combination — all different
        const r1 = Math.floor(Math.random() * slots.symbols.length);
        let r2, r3;
        do { r2 = Math.floor(Math.random() * slots.symbols.length); } while (r2 === r1);
        do { r3 = Math.floor(Math.random() * slots.symbols.length); } while (r3 === r1 || r3 === r2);
        return [r1, r2, r3];
    }

    // Allow a win — weighted toward low-value symbols
    const winType = Math.random();
    if (winType < 0.15) {
        // 3 of a kind — weighted toward low value
        const weights = [0.01, 0.02, 0.04, 0.06, 0.10, 0.15, 0.25, 0.37];
        const sym = weightedRandom(weights);
        return [sym, sym, sym];
    } else {
        // 2 of a kind
        const sym = Math.floor(Math.random() * slots.symbols.length);
        const other = (sym + 1 + Math.floor(Math.random() * (slots.symbols.length - 1))) % slots.symbols.length;
        const pos = Math.floor(Math.random() * 3);
        const result = [other, other, other];
        result[pos] = sym;
        return result;
    }
}

function weightedRandom(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

// ── Resolve win/loss ──────────────────────────────────────────
function resolveSlots(results) {
    const [r1, r2, r3] = results;
    const bet = slots.betAmount;
    let winnings = 0;
    let msg = '';

    if (r1 === r2 && r2 === r3) {
        // 3 of a kind
        const sym = slots.symbols[r1];
        winnings = bet * sym.payout3;
        msg = `<div class="slots-win-box">
            <div style="font-size:1.8rem;">${sym.emoji}${sym.emoji}${sym.emoji}</div>
            <div style="color:#FFD700;font-size:1.3rem;font-weight:bold;">🎉 3 OF A KIND!</div>
            <div style="color:#28a745;font-size:1.6rem;font-weight:bold;">+UGX ${winnings.toLocaleString()}</div>
            <div style="color:#aaa;font-size:0.85rem;">${bet.toLocaleString()} × ${sym.payout3}x</div>
        </div>`;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
        // 2 of a kind
        const matchSym = r1 === r2 ? r1 : r2 === r3 ? r2 : r1;
        const sym = slots.symbols[matchSym];
        if (sym.payout2 > 0) {
            winnings = bet * sym.payout2;
            msg = `<div class="slots-win-box" style="border-color:#FFD700;">
                <div style="font-size:1.4rem;">${sym.emoji}${sym.emoji}</div>
                <div style="color:#FFD700;font-size:1.1rem;font-weight:bold;">2 OF A KIND!</div>
                <div style="color:#28a745;font-size:1.3rem;font-weight:bold;">+UGX ${winnings.toLocaleString()}</div>
            </div>`;
        } else {
            msg = `<div class="slots-lose-box"><div style="color:#ff4444;font-weight:bold;">💔 No win this time</div><div style="color:#888;font-size:0.85rem;">-UGX ${bet.toLocaleString()}</div></div>`;
        }
    } else {
        msg = `<div class="slots-lose-box"><div style="color:#ff4444;font-weight:bold;">💔 No win this time</div><div style="color:#888;font-size:0.85rem;">-UGX ${bet.toLocaleString()}</div></div>`;
    }

    if (winnings > 0) {
        slots.balance  += winnings;
        slots.totalWon += winnings - bet;
    }

    slots.roundsPlayed++;
    if (typeof recordGameBet === 'function') recordGameBet('Urban Slots', bet, winnings > 0 ? 'win' : 'loss', winnings);
    document.getElementById('slotsResultMsg').innerHTML = msg;
    updateSlotsUI();
}

// ── Bet controls ──────────────────────────────────────────────
function increaseSlotsbet() {
    if (slots.isSpinning) return;
    slots.betAmount = Math.min(slots.betAmount + 100, slots.balance);
    updateSlotsUI();
}

function halfSlotsBet() {
    if (slots.isSpinning) return;
    slots.betAmount = Math.max(Math.floor(slots.betAmount / 2), 100);
    updateSlotsUI();
}

function doubleSlotsBet() {
    if (slots.isSpinning) return;
    slots.betAmount = Math.min(slots.betAmount * 2, slots.balance);
    updateSlotsUI();
}

function maxSlotsBet() {
    if (slots.isSpinning) return;
    slots.betAmount = slots.balance;
    updateSlotsUI();
}

// ── UI ────────────────────────────────────────────────────────
function updateSlotsUI() {
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('slotsBetDisplay',   'UGX ' + slots.betAmount.toLocaleString());
    s('slotsBalDisplay',   'UGX ' + slots.balance.toLocaleString());
    s('slotsRoundsDisp',   slots.roundsPlayed);
    s('slotsTotalWonDisp', 'UGX ' + slots.totalWon.toLocaleString());
}

function showSlotsMsg(msg, color) {
    const el = document.getElementById('slotsResultMsg');
    if (el) el.innerHTML = `<div style="color:${color};font-weight:bold;text-align:center;padding:10px;">${msg}</div>`;
}

// ── Navigation ────────────────────────────────────────────────
function selectSlotsGame() {
    document.getElementById('gameSelection').style.display = 'none';
    document.getElementById('slotsGameSection').style.display = 'block';
    slots.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    initSlotsGame();
    window.scrollTo(0, 0);
}

function backFromSlots() {
    document.getElementById('slotsGameSection').style.display = 'none';
    document.getElementById('gameSelection').style.display  = 'block';
    cancelAnimationFrame(slots.animId);
    localStorage.setItem('ute_game_wallet', slots.balance.toString());
    const wEl = document.getElementById('gameWalletDisplay');
    if (wEl) wEl.textContent = 'UGX ' + slots.balance.toLocaleString();
    window.scrollTo(0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('slotsCanvas')) initSlotsGame();
});
