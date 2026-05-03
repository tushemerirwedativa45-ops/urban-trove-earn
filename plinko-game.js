// ═══════════════════════════════════════════════════════════
//  URBAN PLINKO — Ball Drop Game
//  - Ball drops through pegs bouncing left/right
//  - 9 multiplier buckets at bottom
//  - House edge: ball weighted toward low multipliers
//  - Canvas physics animation
// ═══════════════════════════════════════════════════════════

const plinko = {
    canvas: null,
    ctx: null,
    animId: null,
    balance: 0,
    betAmount: 100,
    totalWon: 0,
    roundsPlayed: 0,
    isDropping: false,

    // Ball state
    ball: null,

    // Peg grid
    rows: 8,
    pegs: [],

    // Multiplier buckets (house edge — center buckets have low multipliers)
    buckets: [10, 3, 1.5, 0.5, 0.3, 0.5, 1.5, 3, 10],
    bucketColors: ['#FFD700','#28a745','#20c997','#dc3545','#ff4444','#dc3545','#20c997','#28a745','#FFD700']
};

function initPlinkoGame() {
    plinko.canvas = document.getElementById('plinkoCanvas');
    if (!plinko.canvas) return;
    plinko.ctx = plinko.canvas.getContext('2d');
    plinko.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    resizePlinkoCanvas();
    window.addEventListener('resize', resizePlinkoCanvas);
    buildPegs();
    drawPlinko();
    updatePlinkoUI();
}

function resizePlinkoCanvas() {
    if (!plinko.canvas) return;
    plinko.canvas.width  = plinko.canvas.parentElement.clientWidth  || 500;
    plinko.canvas.height = plinko.canvas.parentElement.clientHeight || 500;
    buildPegs();
    drawPlinko();
}

function buildPegs() {
    const { canvas, rows } = plinko;
    const W = canvas.width, H = canvas.height;
    plinko.pegs = [];

    for (let r = 0; r < rows; r++) {
        const cols = r + 3;
        const spacing = W / (cols + 1);
        for (let c = 0; c < cols; c++) {
            plinko.pegs.push({
                x: spacing * (c + 1),
                y: H * 0.15 + r * (H * 0.62 / rows)
            });
        }
    }
}

function drawPlinko(ballX, ballY) {
    const { ctx, canvas, pegs, buckets, bucketColors } = plinko;
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0a2a');
    bg.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = `bold ${W*0.07}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 10;
    ctx.fillText('PLINKO', W/2, H*0.1);
    ctx.shadowBlur = 0;

    // Draw pegs
    pegs.forEach(peg => {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    // Draw buckets
    const bucketW = W / buckets.length;
    const bucketY = H * 0.82;
    buckets.forEach((mult, i) => {
        const bx = i * bucketW;
        ctx.fillStyle = bucketColors[i] + '33';
        ctx.strokeStyle = bucketColors[i];
        ctx.lineWidth = 2;
        ctx.fillRect(bx + 2, bucketY, bucketW - 4, H * 0.12);
        ctx.strokeRect(bx + 2, bucketY, bucketW - 4, H * 0.12);

        ctx.font = `bold ${W*0.028}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillStyle = bucketColors[i];
        ctx.fillText(mult + 'x', bx + bucketW/2, bucketY + H*0.07);
    });

    // Draw ball
    if (ballX !== undefined && ballY !== undefined) {
        ctx.beginPath();
        ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);
        const ballGrad = ctx.createRadialGradient(ballX-3, ballY-3, 1, ballX, ballY, 10);
        ballGrad.addColorStop(0, '#ff6b6b');
        ballGrad.addColorStop(1, '#cc0000');
        ctx.fillStyle = ballGrad;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ── Drop ball ─────────────────────────────────────────────────
function dropPlinko() {
    if (plinko.isDropping) return;
    if (plinko.betAmount > plinko.balance) { showPlinkoMsg('❌ Insufficient balance', '#ff4444'); return; }
    if (plinko.betAmount < 100) { showPlinkoMsg('❌ Minimum bet is UGX 100', '#ff4444'); return; }

    plinko.balance   -= plinko.betAmount;
    plinko.isDropping = true;
    document.getElementById('plinkoDropBtn').disabled = true;
    document.getElementById('plinkoResultMsg').innerHTML = '';
    updatePlinkoUI();

    const W = plinko.canvas.width;
    const H = plinko.canvas.height;

    // House edge — weight ball toward center (low multiplier) buckets
    const bucketWeights = [0.01, 0.01, 0.02, 0.05, 0.82, 0.05, 0.02, 0.01, 0.01]; // 82% land on 0.3x (loss)
    const targetBucket  = weightedRandomPlinko(bucketWeights);
    const bucketW       = W / plinko.buckets.length;
    const targetX       = targetBucket * bucketW + bucketW / 2;

    // Simulate ball path
    let bx = W / 2 + (Math.random() - 0.5) * 20;
    let by = H * 0.12;
    let vx = (targetX - bx) / 60 + (Math.random() - 0.5) * 2;
    let vy = 2;
    const gravity = 0.3;
    const finalY  = H * 0.85;

    function animateBall() {
        vy += gravity;
        bx += vx;
        by += vy;

        // Bounce off pegs
        plinko.pegs.forEach(peg => {
            const dx = bx - peg.x;
            const dy = by - peg.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 14) {
                vx = dx / dist * 3 + (Math.random() - 0.5) * 1.5;
                vy = Math.abs(vy) * 0.6;
                by = peg.y + dy / dist * 14;
            }
        });

        // Wall bounce
        if (bx < 10) { bx = 10; vx = Math.abs(vx); }
        if (bx > W - 10) { bx = W - 10; vx = -Math.abs(vx); }

        drawPlinko(bx, by);

        if (by < finalY) {
            plinko.animId = requestAnimationFrame(animateBall);
        } else {
            // Determine which bucket
            const bucket = Math.min(Math.floor(bx / bucketW), plinko.buckets.length - 1);
            plinko.isDropping = false;
            document.getElementById('plinkoDropBtn').disabled = false;
            resolvePlinko(bucket, bx);
        }
    }

    plinko.animId = requestAnimationFrame(animateBall);
}

function weightedRandomPlinko(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

function resolvePlinko(bucket, finalX) {
    const mult    = plinko.buckets[bucket];
    const bet     = plinko.betAmount;
    const winnings = Math.floor(bet * mult);
    const profit   = winnings - bet;

    plinko.balance  += winnings;
    if (profit > 0) plinko.totalWon += profit;
    plinko.roundsPlayed++;

    const color = mult >= 3 ? '#28a745' : mult >= 1 ? '#FFD700' : '#ff4444';
    document.getElementById('plinkoResultMsg').innerHTML = profit > 0
        ? `<div class="slots-win-box"><div style="color:#FFD700;font-weight:bold;">🎉 ${mult}x MULTIPLIER!</div><div style="color:#28a745;font-size:1.3rem;font-weight:bold;">+UGX ${winnings.toLocaleString()}</div></div>`
        : `<div class="slots-lose-box"><div style="color:${color};font-weight:bold;">${mult}x — UGX ${winnings.toLocaleString()}</div><div style="color:#888;font-size:0.85rem;">-UGX ${(bet-winnings).toLocaleString()}</div></div>`;

    updatePlinkoUI();
    localStorage.setItem('ute_game_wallet', plinko.balance.toString());
    const wEl = document.getElementById('gameWalletDisplay');
    if (wEl) wEl.textContent = 'UGX ' + plinko.balance.toLocaleString();
}

function increasePlinkoBet() { if (!plinko.isDropping) { plinko.betAmount = Math.min(plinko.betAmount+100, plinko.balance); updatePlinkoUI(); } }
function halfPlinkoBet()     { if (!plinko.isDropping) { plinko.betAmount = Math.max(Math.floor(plinko.betAmount/2), 100); updatePlinkoUI(); } }
function doublePlinkoBet()   { if (!plinko.isDropping) { plinko.betAmount = Math.min(plinko.betAmount*2, plinko.balance); updatePlinkoUI(); } }
function maxPlinkoBet()      { if (!plinko.isDropping) { plinko.betAmount = plinko.balance; updatePlinkoUI(); } }

function updatePlinkoUI() {
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('plinkoBetDisplay',   'UGX ' + plinko.betAmount.toLocaleString());
    s('plinkoBalDisplay',   'UGX ' + plinko.balance.toLocaleString());
    s('plinkoRoundsDisp',   plinko.roundsPlayed);
    s('plinkoTotalWonDisp', 'UGX ' + plinko.totalWon.toLocaleString());
}

function showPlinkoMsg(msg, color) {
    const el = document.getElementById('plinkoResultMsg');
    if (el) el.innerHTML = `<div style="color:${color};font-weight:bold;text-align:center;padding:10px;">${msg}</div>`;
}

function selectPlinkoGame() {
    document.getElementById('gameSelection').style.display = 'none';
    document.getElementById('plinkoGameSection').style.display = 'block';
    plinko.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    initPlinkoGame();
    window.scrollTo(0, 0);
}

function backFromPlinko() {
    document.getElementById('plinkoGameSection').style.display = 'none';
    document.getElementById('gameSelection').style.display = 'block';
    cancelAnimationFrame(plinko.animId);
    localStorage.setItem('ute_game_wallet', plinko.balance.toString());
    const wEl = document.getElementById('gameWalletDisplay');
    if (wEl) wEl.textContent = 'UGX ' + plinko.balance.toLocaleString();
    window.scrollTo(0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('plinkoCanvas')) initPlinkoGame();
});
