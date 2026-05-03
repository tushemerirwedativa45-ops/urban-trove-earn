// ═══════════════════════════════════════════════════════════
//  URBAN ROULETTE — Spin the Wheel
//  - European roulette (0-36)
//  - Bet types: Red/Black (1.9x), Even/Odd (1.9x), Number (35x)
//  - House edge: 0 always loses all bets, weighted toward house
//  - Canvas animated spinning wheel
// ═══════════════════════════════════════════════════════════

const roulette = {
    canvas: null,
    ctx: null,
    animId: null,
    balance: 0,
    betAmount: 100,
    betType: null,
    betValue: null,
    totalWon: 0,
    roundsPlayed: 0,
    isSpinning: false,
    wheelAngle: 0,
    ballAngle: 0,
    result: null,

    // European roulette numbers in wheel order
    numbers: [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],

    // Red numbers
    reds: [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],

    payouts: { red: 1.9, black: 1.9, even: 1.9, odd: 1.9, number: 35 }
};

function getNumberColor(n) {
    if (n === 0) return '#28a745';
    return roulette.reds.includes(n) ? '#cc0000' : '#111';
}

function initRouletteGame() {
    roulette.canvas = document.getElementById('rouletteCanvas');
    if (!roulette.canvas) return;
    roulette.ctx = roulette.canvas.getContext('2d');
    roulette.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');

    // Build number grid
    const grid = document.getElementById('rouletteNumberGrid');
    if (grid && grid.children.length === 0) {
        for (let n = 0; n <= 36; n++) {
            const btn = document.createElement('button');
            btn.id = 'rb-' + n;
            btn.className = 'roulette-bet-btn';
            btn.textContent = n;
            const isRed = roulette.reds.includes(n);
            btn.style.cssText = `padding:5px 2px;border-radius:4px;border:1px solid #1a1a3a;background:${n===0?'#28a74533':isRed?'#cc000033':'rgba(0,0,0,0.4)'};color:${n===0?'#28a745':isRed?'#ff6b6b':'white'};cursor:pointer;font-size:0.75rem;font-weight:bold;`;
            btn.onclick = () => selectRouletteBet('number', n);
            grid.appendChild(btn);
        }
    }

    resizeRouletteCanvas();
    window.addEventListener('resize', resizeRouletteCanvas);
    drawRouletteWheel(0, null);
    updateRouletteUI();
}

function resizeRouletteCanvas() {
    if (!roulette.canvas) return;
    roulette.canvas.width  = roulette.canvas.parentElement.clientWidth  || 500;
    roulette.canvas.height = roulette.canvas.parentElement.clientHeight || 500;
    drawRouletteWheel(roulette.wheelAngle, roulette.result);
}

// ── Drawing ───────────────────────────────────────────────────
function drawRouletteWheel(angle, result) {
    const { ctx, canvas, numbers } = roulette;
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2;
    const outerR = Math.min(W, H) * 0.44;
    const innerR = outerR * 0.55;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    const sliceAngle = (Math.PI * 2) / numbers.length;

    // Draw wheel slices
    numbers.forEach((num, i) => {
        const startA = angle + i * sliceAngle - Math.PI/2;
        const endA   = startA + sliceAngle;
        const color  = getNumberColor(num);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startA, endA);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Number text
        const midA = startA + sliceAngle/2;
        const tx = cx + (outerR * 0.78) * Math.cos(midA);
        const ty = cy + (outerR * 0.78) * Math.sin(midA);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(midA + Math.PI/2);
        ctx.font = `bold ${outerR*0.07}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.fillText(num, 0, 0);
        ctx.restore();
    });

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI*2);
    const innerGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, innerR);
    innerGrad.addColorStop(0, '#1a1a3a');
    innerGrad.addColorStop(1, '#0a0a2a');
    ctx.fillStyle = innerGrad;
    ctx.fill();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI*2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    // Pointer at top
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR - 5);
    ctx.lineTo(cx - 10, cy - outerR + 15);
    ctx.lineTo(cx + 10, cy - outerR + 15);
    ctx.closePath();
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    // Result display
    if (result !== null) {
        const rColor = getNumberColor(result);
        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.55, 0, Math.PI*2);
        ctx.fillStyle = rColor;
        ctx.fill();
        ctx.font = `bold ${innerR*0.45}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.fillText(result, cx, cy + innerR*0.15);
    }
}

// ── Spin logic ────────────────────────────────────────────────
function spinRoulette() {
    if (roulette.isSpinning) return;
    if (!roulette.betType) { showRouletteMsg('❌ Choose a bet type first', '#ff4444'); return; }
    if (roulette.betAmount > roulette.balance) { showRouletteMsg('❌ Insufficient balance', '#ff4444'); return; }

    roulette.balance   -= roulette.betAmount;
    roulette.isSpinning = true;
    roulette.result     = null;
    document.getElementById('rouletteSpinBtn').disabled = true;
    document.getElementById('rouletteResultMsg').innerHTML = '';
    updateRouletteUI();

    // House edge — determine result
    const result = generateRouletteResult();
    const numbers = roulette.numbers;
    const targetIdx = numbers.indexOf(result);
    const sliceAngle = (Math.PI * 2) / numbers.length;

    // Spin animation
    const totalRotation = Math.PI * 2 * 8 + (numbers.length - targetIdx) * sliceAngle;
    const duration = 4000;
    const startTime = Date.now();
    const startAngle = roulette.wheelAngle;

    function animateWheel() {
        const elapsed  = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 4);
        roulette.wheelAngle = startAngle + totalRotation * eased;

        drawRouletteWheel(roulette.wheelAngle, progress > 0.95 ? result : null);

        if (progress < 1) {
            roulette.animId = requestAnimationFrame(animateWheel);
        } else {
            roulette.isSpinning = false;
            roulette.result = result;
            drawRouletteWheel(roulette.wheelAngle, result);
            resolveRoulette(result);
            document.getElementById('rouletteSpinBtn').disabled = false;
            localStorage.setItem('ute_game_wallet', roulette.balance.toString());
            const wEl = document.getElementById('gameWalletDisplay');
            if (wEl) wEl.textContent = 'UGX ' + roulette.balance.toLocaleString();
        }
    }

    roulette.animId = requestAnimationFrame(animateWheel);
}

function generateRouletteResult() {
    const houseWins = Math.random() < 0.95; // house always wins 95%

    if (houseWins) {
        // Return a number that makes player lose
        const losers = roulette.numbers.filter(n => !playerWouldWin(n));
        if (losers.length > 0) return losers[Math.floor(Math.random() * losers.length)];
    }

    return roulette.numbers[Math.floor(Math.random() * roulette.numbers.length)];
}

function playerWouldWin(n) {
    const { betType, betValue, reds } = roulette;
    if (n === 0) return false;
    if (betType === 'red')    return reds.includes(n);
    if (betType === 'black')  return !reds.includes(n);
    if (betType === 'even')   return n % 2 === 0;
    if (betType === 'odd')    return n % 2 !== 0;
    if (betType === 'number') return n === betValue;
    return false;
}

function resolveRoulette(result) {
    const bet  = roulette.betAmount;
    const won  = playerWouldWin(result);
    const rColor = getNumberColor(result);
    const rLabel = result === 0 ? '0 (Green)' : roulette.reds.includes(result) ? `${result} Red` : `${result} Black`;

    if (won) {
        const payout   = roulette.payouts[roulette.betType];
        const winnings = Math.floor(bet * payout);
        roulette.balance  += winnings;
        roulette.totalWon += winnings - bet;
        document.getElementById('rouletteResultMsg').innerHTML = `
            <div class="slots-win-box">
                <div style="color:#FFD700;font-weight:bold;">🎉 ${rLabel} — YOU WIN!</div>
                <div style="color:#28a745;font-size:1.4rem;font-weight:bold;">+UGX ${winnings.toLocaleString()}</div>
            </div>`;
    } else {
        document.getElementById('rouletteResultMsg').innerHTML = `
            <div class="slots-lose-box">
                <div style="color:#ff4444;font-weight:bold;">💔 ${rLabel} — You lose</div>
                <div style="color:#888;font-size:0.85rem;">-UGX ${bet.toLocaleString()}</div>
            </div>`;
    }

    roulette.roundsPlayed++;
    if (typeof recordGameBet === 'function') recordGameBet('Roulette', bet, won ? 'win' : 'loss', won ? Math.floor(bet * roulette.payouts[roulette.betType]) : 0);
    updateRouletteUI();
}

// ── Bet controls ──────────────────────────────────────────────
function selectRouletteBet(type, value) {
    roulette.betType  = type;
    roulette.betValue = value || null;
    document.querySelectorAll('.roulette-bet-btn').forEach(b => b.style.borderColor = '#1a1a3a');
    const el = document.getElementById('rb-' + (value !== undefined ? value : type));
    if (el) el.style.borderColor = '#FFD700';
    const labels = { red:'Red (1.9x)', black:'Black (1.9x)', even:'Even (1.9x)', odd:'Odd (1.9x)', number:`Number ${value} (35x)` };
    showRouletteMsg('Betting on: ' + (labels[type] || type), '#FFD700');
}

function increaseRouletteBet() { if (!roulette.isSpinning) { roulette.betAmount=Math.min(roulette.betAmount+100,roulette.balance); updateRouletteUI(); } }
function halfRouletteBet()     { if (!roulette.isSpinning) { roulette.betAmount=Math.max(Math.floor(roulette.betAmount/2),100); updateRouletteUI(); } }
function doubleRouletteBet()   { if (!roulette.isSpinning) { roulette.betAmount=Math.min(roulette.betAmount*2,roulette.balance); updateRouletteUI(); } }
function maxRouletteBet()      { if (!roulette.isSpinning) { roulette.betAmount=roulette.balance; updateRouletteUI(); } }

function updateRouletteUI() {
    const s = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    s('rouletteBetDisplay',   'UGX ' + roulette.betAmount.toLocaleString());
    s('rouletteBalDisplay',   'UGX ' + roulette.balance.toLocaleString());
    s('rouletteRoundsDisp',   roulette.roundsPlayed);
    s('rouletteTotalWonDisp', 'UGX ' + roulette.totalWon.toLocaleString());
}

function showRouletteMsg(msg, color) {
    const el = document.getElementById('rouletteResultMsg');
    if (el) el.innerHTML = `<div style="color:${color};font-size:0.88rem;text-align:center;padding:8px;">${msg}</div>`;
}

function selectRouletteGame() {
    document.getElementById('gameSelection').style.display = 'none';
    document.getElementById('rouletteGameSection').style.display = 'block';
    roulette.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    initRouletteGame();
    window.scrollTo(0, 0);
}

function backFromRoulette() {
    document.getElementById('rouletteGameSection').style.display = 'none';
    document.getElementById('gameSelection').style.display = 'block';
    cancelAnimationFrame(roulette.animId);
    localStorage.setItem('ute_game_wallet', roulette.balance.toString());
    const wEl = document.getElementById('gameWalletDisplay');
    if (wEl) wEl.textContent = 'UGX ' + roulette.balance.toLocaleString();
    window.scrollTo(0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('rouletteCanvas')) initRouletteGame();
});
