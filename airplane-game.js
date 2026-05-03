// ═══════════════════════════════════════════════════════════
//  URBAN JET — Aviator / JetX style crash game
//  - Auto-runs continuously (no START button needed)
//  - Jet drawn entirely on canvas (no image file)
//  - Flight path curves upward like Aviator
//  - Multiplier grows exponentially
//  - Bet before round starts, cashout anytime during flight
//  - Shows win/loss result clearly
//  - Recent crash history bar
// ═══════════════════════════════════════════════════════════

// ── Navigation ───────────────────────────────────────────────────
function selectGame(gameType) {
    document.getElementById('gameSelection').style.display = 'none';
    document.getElementById('urbanjetGameSection').style.display = 'block';
    if (gameType === 'airplane') initUrbanJet();
    window.scrollTo(0, 0);
}

function backToSelection() {
    document.getElementById('gameSelection').style.display = 'block';
    document.getElementById('urbanjetGameSection').style.display = 'none';
    jet.stop();
    window.scrollTo(0, 0);
}

// ── Game State ───────────────────────────────────────────────────
const jet = {
    // canvas
    canvas: null,
    ctx: null,
    animId: null,

    // round state
    phase: 'waiting',   // 'waiting' | 'flying' | 'crashed'
    multiplier: 1.00,
    crashAt: 1.00,
    startTime: 0,
    waitTime: 5000,      // ms between rounds
    waitStart: 0,
    countdown: 5,

    // flight path
    pathPoints: [],      // [{x,y}] drawn as trail

    // bets
    bets: {
        1: { amount: 0, placed: false, cashedOut: false },
        2: { amount: 0, placed: false, cashedOut: false }
    },
    betAmounts: { 1: 100, 2: 100 },

    // stats
    balance: 100,  // testing balance
    history: [],         // last crash multipliers
    roundsPlayed: 0,
    totalWon: 0,

    stop() {
        cancelAnimationFrame(this.animId);
        this.phase = 'waiting';
    }
};

// ── Crash point generator ────────────────────────────────────────
function generateCrashPoint() {
    const betPlaced = jet.bets[1].placed || jet.bets[2].placed;

    if (betPlaced) {
        // House always wins — crash before 1.09x when bet is placed
        const r = Math.random();
        return 1.00 + Math.random() * 0.01; // always crashes at 1.00-1.01x (instant loss)
    } else {
        // No bet placed — fly freely, can go high
        const r = Math.random();
        if (r < 0.05) return 1.00;
        const crash = Math.max(1.00, 0.99 / (1 - r * 0.95));
        return Math.min(crash, 50.00);
    }
}

// ── Init ─────────────────────────────────────────────────────────
function initUrbanJet() {
    jet.canvas = document.getElementById('jetCanvas');
    jet.ctx    = jet.canvas.getContext('2d');

    // Load balance from game wallet
    const walletBal = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    jet.balance = walletBal;

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    updateBetDisplays();
    updateBalanceDisplay();
    startWaitPhase();
    loop();
}

function resizeCanvas() {
    const area = jet.canvas.parentElement;
    jet.canvas.width  = area.clientWidth  || 800;
    jet.canvas.height = area.clientHeight || 480;
}

// ── Main loop ─────────────────────────────────────────────────────
function loop() {
    const now = Date.now();

    if (jet.phase === 'waiting') {
        const elapsed = now - jet.waitStart;
        const remaining = Math.ceil((jet.waitTime - elapsed) / 1000);
        jet.countdown = Math.max(0, remaining);
        drawWaiting();
        if (elapsed >= jet.waitTime) startFlyingPhase();

    } else if (jet.phase === 'flying') {
        const elapsed = now - jet.startTime;
        // Multiplier grows exponentially: 1.00 * e^(k*t)
        const k = 0.00006;
        jet.multiplier = Math.max(1.00, Math.exp(k * elapsed));

        updateOddsDisplay();
        drawFlying(elapsed);

        if (jet.multiplier >= jet.crashAt) {
            doCrash();
            return;
        }

    } else if (jet.phase === 'crashed') {
        drawCrashed();
    }

    jet.animId = requestAnimationFrame(loop);
}

// ── Phase transitions ─────────────────────────────────────────────
function startWaitPhase() {
    jet.phase      = 'waiting';
    jet.waitStart  = Date.now();
    jet.countdown  = jet.waitTime / 1000;
    jet.pathPoints = [];
    jet.multiplier = 1.00;
    jet.crashAt    = generateCrashPoint();

    // Reset bet UI for new round
    for (let i = 1; i <= 2; i++) {
        if (!jet.bets[i].placed) {
            // allow placing bets
            enableBetBtn(i);
        }
        jet.bets[i].cashedOut = false;
        document.getElementById(`betResult${i}`).innerHTML = '';
        document.getElementById(`cashoutSection${i}`).style.display = 'none';
    }

    document.getElementById('crashOverlay').style.display = 'none';
    document.getElementById('multiplierText').textContent  = '1.00x';
    document.getElementById('multiplierText').style.color  = '#FFD700';
}

function startFlyingPhase() {
    jet.phase     = 'flying';
    jet.startTime = Date.now();
    jet.pathPoints = [];

    // Show cashout for already placed bets — keep bet buttons enabled for new bets
    for (let i = 1; i <= 2; i++) {
        if (jet.bets[i].placed) {
            const btn = document.getElementById(`placeBetBtn${i}`);
            btn.disabled = true;
            document.getElementById(`cashoutSection${i}`).style.display = 'flex';
            document.getElementById(`betResult${i}`).innerHTML = '';
        }
    }
}

function doCrash() {
    jet.phase = 'crashed';
    cancelAnimationFrame(jet.animId);

    // Process any uncashed bets as losses
    for (let i = 1; i <= 2; i++) {
        if (jet.bets[i].placed && !jet.bets[i].cashedOut) {
            document.getElementById(`betResult${i}`).innerHTML =
                `<span class="lose">💥 CRASHED at ${jet.crashAt.toFixed(2)}x — Lost UGX ${jet.bets[i].amount.toLocaleString()}</span>`;
            jet.bets[i].placed = false;
        }
        document.getElementById(`cashoutSection${i}`).style.display = 'none';
    }

    // History
    jet.history.unshift(jet.crashAt);
    if (jet.history.length > 12) jet.history.pop();
    jet.roundsPlayed++;
    updateHistory();
    // Record all lost bets to backend
    [1,2].forEach(i => { if (!jet.bets[i].cashedOut && jet.bets[i].amount) { if (typeof recordGameBet === 'function') recordGameBet('Urban Jet', jet.bets[i].amount, 'loss', 0); } });
    updateBalanceDisplay();
    updateStatsDisplay();
    // Sync balance back to game wallet
    localStorage.setItem('ute_game_wallet', jet.balance.toString());
    const _wEl = document.getElementById('gameWalletDisplay');
    if (_wEl) _wEl.textContent = 'UGX ' + jet.balance.toLocaleString();

    // Show crash overlay with countdown
    const overlay = document.getElementById('crashOverlay');
    overlay.style.display = 'flex';
    document.getElementById('crashMultiplierDisplay').textContent = 'Crashed at ' + jet.crashAt.toFixed(2) + 'x';

    let cd = Math.ceil(jet.waitTime / 1000);
    const cdEl = document.getElementById('nextRoundCountdown');
    cdEl.textContent = `Next round in ${cd}s`;

    const iv = setInterval(() => {
        cd--;
        cdEl.textContent = cd > 0 ? `Next round in ${cd}s` : 'Starting...';
        if (cd <= 0) {
            clearInterval(iv);
            startWaitPhase();
            jet.animId = requestAnimationFrame(loop);
        }
    }, 1000);
}

// ── Drawing ───────────────────────────────────────────────────────
function drawWaiting() {
    const { ctx, canvas, countdown } = jet;
    const W = canvas.width, H = canvas.height;

    // Background
    drawSky(ctx, W, H);
    drawStars(ctx, W, H);
    drawGround(ctx, W, H);

    // Waiting message
    ctx.save();
    ctx.textAlign = 'center';

    ctx.font = `bold ${W * 0.045}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('PLACING BETS', W / 2, H / 2 - 30);

    ctx.font = `bold ${W * 0.1}px Arial`;
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
    ctx.fillText(countdown + 's', W / 2, H / 2 + 50);
    ctx.shadowBlur = 0;

    ctx.restore();

    // Draw jet sitting on ground
    drawJet(ctx, 80, H - 80, 0, 0.8);
}

function drawFlying(elapsed) {
    const { ctx, canvas } = jet;
    const W = canvas.width, H = canvas.height;

    drawSky(ctx, W, H);
    drawStars(ctx, W, H);
    drawGround(ctx, W, H);

    // Compute jet position along a curve
    const progress = Math.min(elapsed / 18000, 1);  // 18s max flight
    const jetX = 80 + progress * (W * 0.75);
    const curveY = H - 80 - Math.pow(progress, 1.4) * (H * 0.78);
    const jetY = Math.max(40, curveY);

    // Angle based on movement direction
    const prevProgress = Math.max(0, progress - 0.01);
    const prevX = 80 + prevProgress * (W * 0.75);
    const prevY = H - 80 - Math.pow(prevProgress, 1.4) * (H * 0.78);
    const angle = Math.atan2(jetY - prevY, jetX - prevX);

    // Store path
    jet.pathPoints.push({ x: jetX, y: jetY });
    if (jet.pathPoints.length > 300) jet.pathPoints.shift();

    // Draw trail
    drawTrail(ctx);

    // Draw jet
    drawJet(ctx, jetX, jetY, angle, 1.0);

    // Engine glow
    drawEngineGlow(ctx, jetX, jetY, angle);
}

function drawCrashed() {
    const { ctx, canvas } = jet;
    const W = canvas.width, H = canvas.height;

    drawSky(ctx, W, H, true);   // red tint
    drawGround(ctx, W, H);

    // Draw explosion at last known position
    const last = jet.pathPoints[jet.pathPoints.length - 1] || { x: W * 0.6, y: H * 0.3 };
    drawExplosion(ctx, last.x, last.y);

    // CRASHED text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold ${W * 0.09}px Arial`;
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 30;
    ctx.fillText('CRASHED!', W / 2, H / 2 - 10);
    ctx.font = `bold ${W * 0.055}px Arial`;
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700';
    ctx.fillText(jet.crashAt.toFixed(2) + 'x', W / 2, H / 2 + 50);
    ctx.shadowBlur = 0;
    ctx.restore();
}

// ── Canvas drawing helpers ────────────────────────────────────────
function drawSky(ctx, W, H, crashed = false) {
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (crashed) {
        grad.addColorStop(0, '#1a0000');
        grad.addColorStop(1, '#3a0a0a');
    } else {
        grad.addColorStop(0, '#0a0a2a');
        grad.addColorStop(0.6, '#0d1a3a');
        grad.addColorStop(1, '#1a2a1a');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

function drawStars(ctx, W, H) {
    // Static stars using seeded positions
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const stars = [[50,30],[120,15],[200,45],[310,20],[420,35],[530,10],[640,28],[720,18],
                   [80,80],[180,65],[290,90],[400,70],[510,55],[620,85],[700,60],[760,75],
                   [30,120],[150,110],[260,130],[370,105],[480,125],[590,115],[680,135]];
    stars.forEach(([x, y]) => {
        if (x < W && y < H * 0.5) {
            ctx.beginPath();
            ctx.arc(x * (W / 800), y * (H / 480), 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawGround(ctx, W, H) {
    // Ground strip
    const grad = ctx.createLinearGradient(0, H - 60, 0, H);
    grad.addColorStop(0, '#1a3a1a');
    grad.addColorStop(1, '#0a1a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - 60, W, 60);

    // Runway line
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(0, H - 30);
    ctx.lineTo(W, H - 30);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawTrail(ctx) {
    const pts = jet.pathPoints;
    if (pts.length < 2) return;

    // Glowing trail
    ctx.save();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < pts.length; i++) {
        const alpha = i / pts.length;
        ctx.strokeStyle = `rgba(255, 165, 0, ${alpha * 0.7})`;
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 8 * alpha;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawJet(ctx, x, y, angle, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    const W = 54, H = 22;

    // ── Fuselage ──
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);                          // nose
    ctx.bezierCurveTo(W * 0.3, -H * 0.35, -W * 0.1, -H * 0.4, -W / 2, -H * 0.2);
    ctx.lineTo(-W / 2, H * 0.2);
    ctx.bezierCurveTo(-W * 0.1, H * 0.4, W * 0.3, H * 0.35, W / 2, 0);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
    bodyGrad.addColorStop(0, '#c0c8d8');
    bodyGrad.addColorStop(0.4, '#e8eef8');
    bodyGrad.addColorStop(1, '#8090a8');
    ctx.fillStyle = bodyGrad;
    ctx.shadowColor = 'rgba(100,150,255,0.4)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Main wing ──
    ctx.beginPath();
    ctx.moveTo(W * 0.05, 0);
    ctx.lineTo(-W * 0.15, -H * 1.1);
    ctx.lineTo(-W * 0.45, -H * 1.0);
    ctx.lineTo(-W * 0.42, -H * 0.15);
    ctx.closePath();
    const wingGrad = ctx.createLinearGradient(0, -H, -W * 0.4, 0);
    wingGrad.addColorStop(0, '#d0d8e8');
    wingGrad.addColorStop(1, '#7080a0');
    ctx.fillStyle = wingGrad;
    ctx.fill();

    // Wing underside
    ctx.beginPath();
    ctx.moveTo(W * 0.05, 0);
    ctx.lineTo(-W * 0.15, H * 1.1);
    ctx.lineTo(-W * 0.45, H * 1.0);
    ctx.lineTo(-W * 0.42, H * 0.15);
    ctx.closePath();
    ctx.fillStyle = wingGrad;
    ctx.fill();

    // ── Tail fin (vertical) ──
    ctx.beginPath();
    ctx.moveTo(-W * 0.3, 0);
    ctx.lineTo(-W * 0.5, -H * 0.85);
    ctx.lineTo(-W * 0.48, -H * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#b0b8c8';
    ctx.fill();

    // ── Tail stabilisers ──
    ctx.beginPath();
    ctx.moveTo(-W * 0.32, 0);
    ctx.lineTo(-W * 0.5, -H * 0.55);
    ctx.lineTo(-W * 0.5, H * 0.55);
    ctx.closePath();
    ctx.fillStyle = '#a0a8b8';
    ctx.fill();

    // ── Cockpit window ──
    ctx.beginPath();
    ctx.ellipse(W * 0.22, -H * 0.08, W * 0.1, H * 0.18, -0.2, 0, Math.PI * 2);
    const cockpitGrad = ctx.createRadialGradient(W * 0.22, -H * 0.1, 1, W * 0.22, -H * 0.08, W * 0.1);
    cockpitGrad.addColorStop(0, 'rgba(180,220,255,0.95)');
    cockpitGrad.addColorStop(1, 'rgba(60,120,200,0.7)');
    ctx.fillStyle = cockpitGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Engine pod ──
    ctx.beginPath();
    ctx.ellipse(-W * 0.05, H * 0.28, W * 0.14, H * 0.12, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#606878';
    ctx.fill();

    // Engine intake ring
    ctx.beginPath();
    ctx.ellipse(-W * 0.18, H * 0.28, W * 0.04, H * 0.12, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#303840';
    ctx.fill();

    // ── Urban Trove logo stripe ──
    ctx.beginPath();
    ctx.moveTo(W * 0.1, -H * 0.05);
    ctx.lineTo(-W * 0.35, -H * 0.05);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();

    ctx.restore();
}

function drawEngineGlow(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Flame / exhaust
    const flameLen = 18 + Math.random() * 14;
    const grad = ctx.createLinearGradient(-27, 0, -27 - flameLen, 0);
    grad.addColorStop(0, 'rgba(255,200,50,0.95)');
    grad.addColorStop(0.4, 'rgba(255,100,20,0.7)');
    grad.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.beginPath();
    ctx.moveTo(-27, 6);
    ctx.lineTo(-27 - flameLen, 0);
    ctx.lineTo(-27, -6);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();
}

function drawExplosion(ctx, x, y) {
    const rings = [
        { r: 60, color: 'rgba(255,50,0,0.15)' },
        { r: 40, color: 'rgba(255,120,0,0.3)' },
        { r: 22, color: 'rgba(255,200,0,0.6)' },
        { r: 10, color: 'rgba(255,255,200,0.9)' }
    ];
    rings.forEach(({ r, color }) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    });

    // Debris lines
    ctx.strokeStyle = 'rgba(255,150,0,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
        ctx.lineTo(x + Math.cos(a) * 55, y + Math.sin(a) * 55);
        ctx.stroke();
    }
}

// ── Odds display ──────────────────────────────────────────────────
function updateOddsDisplay() {
    const el = document.getElementById('multiplierText');
    el.textContent = jet.multiplier.toFixed(2) + 'x';

    // Colour shifts: white → yellow → orange → red as it climbs
    if (jet.multiplier < 2)       el.style.color = '#ffffff';
    else if (jet.multiplier < 5)  el.style.color = '#FFD700';
    else if (jet.multiplier < 10) el.style.color = '#ff9900';
    else                          el.style.color = '#ff3333';

    // Update cashout button multipliers
    for (let i = 1; i <= 2; i++) {
        if (jet.bets[i].placed && !jet.bets[i].cashedOut) {
            const el2 = document.getElementById(`cashoutMultiplier${i}`);
            if (el2) el2.textContent = jet.multiplier.toFixed(2) + 'x';
        }
    }
}

// ── Bet controls ──────────────────────────────────────────────────
function increaseBet(slot) {
    if (jet.bets[slot].placed) return;
    jet.betAmounts[slot] = Math.min(jet.betAmounts[slot] + 100, jet.balance);
    updateBetDisplays();
}

function decreaseBet(slot) {
    // Decrease disabled — user can only increase stake
    return;
}

function placeBet(slot) {
    // Allow betting during waiting AND flying phases
    if (jet.phase === 'crashed') {
        showBetMsg(slot, '⏳ Wait for next round to start', '#FFD700');
        return;
    }
    if (jet.bets[slot].placed) return;

    const amount = jet.betAmounts[slot];
    if (!amount || amount < 100) {
        showBetMsg(slot, '❌ Minimum bet is UGX 100', '#ff4444');
        return;
    }
    if (amount > jet.balance) {
        showBetMsg(slot, '❌ Insufficient balance', '#ff4444');
        return;
    }

    jet.balance -= amount;
    jet.bets[slot] = { amount, placed: true, cashedOut: false };

    const btn = document.getElementById(`placeBetBtn${slot}`);
    btn.textContent = `BET: UGX ${amount.toLocaleString()}`;
    btn.style.background = 'linear-gradient(135deg,#28a745,#20c997)';
    btn.disabled = true;

    document.getElementById(`betPlaceholder${slot}`).classList.add('active');
    updateBalanceDisplay();

    // Show BET ACCEPTED message
    showBetMsg(slot, `✅ BET ACCEPTED — UGX ${amount.toLocaleString()}`, '#28a745');

    // If plane is already flying, show cashout button immediately
    if (jet.phase === 'flying') {
        document.getElementById(`cashoutSection${slot}`).style.display = 'flex';
        document.getElementById(`cashoutMultiplier${slot}`).textContent = jet.multiplier.toFixed(2) + 'x';
    }
}

function cashoutBet(slot) {
    if (jet.phase !== 'flying') return;
    if (!jet.bets[slot].placed || jet.bets[slot].cashedOut) return;

    const bet      = jet.bets[slot].amount;
    const multi    = jet.multiplier;
    const winnings = Math.floor(bet * multi);
    const profit   = winnings - bet;

    jet.balance += winnings;
    jet.totalWon += profit;
    jet.bets[slot].cashedOut = true;
    jet.bets[slot].placed    = false;

    document.getElementById(`cashoutSection${slot}`).style.display = 'none';

    // ── WIN MESSAGE ──
    document.getElementById(`betResult${slot}`).innerHTML = `
        <div class="win-popup">
            <div class="win-title">🎉 YOU WON!</div>
            <div class="win-amount">UGX ${winnings.toLocaleString()}</div>
            <div class="win-detail">${bet.toLocaleString()} × ${multi.toFixed(2)}x = ${winnings.toLocaleString()}</div>
        </div>`;

    updateBalanceDisplay();
    updateStatsDisplay();
}

function enableBetBtn(slot) {
    const btn = document.getElementById(`placeBetBtn${slot}`);
    btn.textContent = 'PLACE BET';
    btn.style.background = '';
    btn.disabled = false;
    document.getElementById(`betPlaceholder${slot}`).classList.remove('active');
}

function showBetMsg(slot, msg, color) {
    const el = document.getElementById(`betResult${slot}`);
    el.innerHTML = `<span style="color:${color};font-size:0.85rem;">${msg}</span>`;
}

// ── UI updates ────────────────────────────────────────────────────
function updateBetDisplays() {
    for (let i = 1; i <= 2; i++) {
        const el = document.getElementById(`stakeAmount${i}`);
        if (el) el.textContent = `UGX ${jet.betAmounts[i].toLocaleString()}`;
    }
}

function updateBalanceDisplay() {
    const el = document.getElementById('gameBalanceAmount');
    if (el) el.textContent = `UGX ${jet.balance.toLocaleString()}`;
}

function updateStatsDisplay() {
    const r = document.getElementById('roundsPlayed');
    const w = document.getElementById('totalWinnings');
    if (r) r.textContent = jet.roundsPlayed;
    if (w) w.textContent = `UGX ${jet.totalWon.toLocaleString()}`;
}

function updateHistory() {
    const el = document.getElementById('oddsHistory');
    if (!el) return;
    el.innerHTML = jet.history.map(v => {
        const color = v < 1.5 ? '#ff4444' : v < 3 ? '#FFD700' : '#28a745';
        return `<div class="odds-item" style="background:${color}22;border:1px solid ${color};color:${color};">${v.toFixed(2)}x</div>`;
    }).join('');
}

// ── DOM ready ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('jetCanvas')) {
        initUrbanJet();
    }
});
