// ═══════════════════════════════════════════════════════════
//  URBAN HORSE RACING — Pick Your Horse
//  - 6 horses with different odds
//  - Canvas animated race
//  - House edge: favourite rarely wins
//  - Linked to game wallet
// ═══════════════════════════════════════════════════════════

const racing = {
    canvas: null,
    ctx: null,
    animId: null,
    balance: 0,
    betAmount: 100,
    betHorse: null,
    totalWon: 0,
    roundsPlayed: 0,
    isRacing: false,

    horses: [
        { name: 'Thunder',   color: '#ff4444', odds: 2.0,  x: 0, lane: 0 },
        { name: 'Lightning', color: '#FFD700', odds: 3.5,  x: 0, lane: 1 },
        { name: 'Storm',     color: '#00cfff', odds: 5.0,  x: 0, lane: 2 },
        { name: 'Blaze',     color: '#28a745', odds: 7.0,  x: 0, lane: 3 },
        { name: 'Shadow',    color: '#c084fc', odds: 10.0, x: 0, lane: 4 },
        { name: 'Rocket',    color: '#ff9900', odds: 15.0, x: 0, lane: 5 }
    ],

    finishOrder: [],
    speeds: []
};

function initRacingGame() {
    racing.canvas = document.getElementById('racingCanvas');
    if (!racing.canvas) return;
    racing.ctx = racing.canvas.getContext('2d');
    racing.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');

    // Build horse buttons
    const container = document.getElementById('horseButtons');
    if (container && container.children.length === 0) {
        racing.horses.forEach((horse, i) => {
            const btn = document.createElement('button');
            btn.className = 'horse-btn';
            btn.style.cssText = `padding:8px 12px;border-radius:7px;border:2px solid #1a3a1a;background:${horse.color}22;color:${horse.color};cursor:pointer;font-weight:bold;text-align:left;transition:all 0.3s;`;
            btn.innerHTML = `${i+1}. ${horse.name} <span style="float:right;color:#FFD700;">${horse.odds}x</span>`;
            btn.onclick = () => selectHorse(i);
            container.appendChild(btn);
        });
    }

    resizeRacingCanvas();
    window.addEventListener('resize', resizeRacingCanvas);
    resetHorses();
    drawRace();
    updateRacingUI();
}

function resizeRacingCanvas() {
    if (!racing.canvas) return;
    racing.canvas.width  = racing.canvas.parentElement.clientWidth  || 700;
    racing.canvas.height = racing.canvas.parentElement.clientHeight || 400;
    drawRace();
}

function resetHorses() {
    racing.horses.forEach(h => { h.x = 0; });
    racing.finishOrder = [];
}

// ── Drawing ───────────────────────────────────────────────────
function drawRace() {
    const { ctx, canvas, horses } = racing;
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const laneH = H / horses.length;
    const trackStart = W * 0.22;
    const trackEnd   = W * 0.95;
    const trackW     = trackEnd - trackStart;

    // Background — grass
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a4a1a');
    bg.addColorStop(1, '#0a2a0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Track lanes
    horses.forEach((horse, i) => {
        const ly = i * laneH;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(trackStart, ly, trackW, laneH);

        // Lane divider
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(trackStart, ly + laneH);
        ctx.lineTo(trackEnd, ly + laneH);
        ctx.stroke();
    });

    // Finish line
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(trackEnd, 0);
    ctx.lineTo(trackEnd, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Horse names and odds on left
    horses.forEach((horse, i) => {
        const ly = i * laneH + laneH / 2;
        ctx.font = `bold ${laneH * 0.28}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillStyle = horse.color;
        ctx.fillText(`${i+1}. ${horse.name}`, 5, ly - 4);
        ctx.font = `${laneH * 0.22}px Arial`;
        ctx.fillStyle = '#aaa';
        ctx.fillText(`${horse.odds}x`, 5, ly + laneH * 0.22);
    });

    // Draw horses
    horses.forEach((horse, i) => {
        const hx = trackStart + horse.x * trackW;
        const hy = i * laneH + laneH * 0.15;
        const hw = laneH * 0.7;
        const hh = laneH * 0.65;
        drawHorse(ctx, hx, hy, hw, hh, horse.color, i + 1);
    });

    // Finish order display
    if (racing.finishOrder.length > 0) {
        ctx.font = `bold ${W * 0.025}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('🏆 ' + racing.finishOrder.map((h,i) => `${i+1}. ${h.name}`).join('  '), W/2, H - 8);
    }
}

function drawHorse(ctx, x, y, w, h, color, num) {
    ctx.save();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + w*0.4, y + h*0.45, w*0.38, h*0.28, 0, 0, Math.PI*2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.ellipse(x + w*0.78, y + h*0.28, w*0.18, h*0.2, -0.3, 0, Math.PI*2);
    ctx.fill();

    // Neck
    ctx.beginPath();
    ctx.moveTo(x + w*0.62, y + h*0.35);
    ctx.lineTo(x + w*0.72, y + h*0.18);
    ctx.lineTo(x + w*0.82, y + h*0.22);
    ctx.lineTo(x + w*0.72, y + h*0.42);
    ctx.closePath();
    ctx.fill();

    // Legs (animated)
    const legAnim = Math.sin(Date.now() * 0.015 + num) * 0.15;
    ctx.strokeStyle = color;
    ctx.lineWidth = h * 0.08;
    ctx.lineCap = 'round';

    // Front legs
    ctx.beginPath();
    ctx.moveTo(x + w*0.55, y + h*0.65);
    ctx.lineTo(x + w*0.5 + legAnim*w, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w*0.65, y + h*0.65);
    ctx.lineTo(x + w*0.7 - legAnim*w, y + h);
    ctx.stroke();

    // Back legs
    ctx.beginPath();
    ctx.moveTo(x + w*0.25, y + h*0.65);
    ctx.lineTo(x + w*0.2 - legAnim*w, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w*0.35, y + h*0.65);
    ctx.lineTo(x + w*0.4 + legAnim*w, y + h);
    ctx.stroke();

    // Tail
    ctx.strokeStyle = color;
    ctx.lineWidth = h * 0.06;
    ctx.beginPath();
    ctx.moveTo(x + w*0.05, y + h*0.4);
    ctx.quadraticCurveTo(x - w*0.1, y + h*0.3, x - w*0.05, y + h*0.6);
    ctx.stroke();

    // Number
    ctx.font = `bold ${h*0.3}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.fillText(num, x + w*0.4, y + h*0.52);

    ctx.restore();
}

// ── Race logic ────────────────────────────────────────────────
function startRace() {
    if (racing.isRacing) return;
    if (!racing.betHorse) { showRacingMsg('❌ Pick a horse first', '#ff4444'); return; }
    if (racing.betAmount > racing.balance) { showRacingMsg('❌ Insufficient balance', '#ff4444'); return; }

    racing.balance   -= racing.betAmount;
    racing.isRacing   = true;
    racing.finishOrder = [];
    document.getElementById('racingStartBtn').disabled = true;
    document.getElementById('racingResultMsg').innerHTML = '';
    updateRacingUI();
    resetHorses();

    // Determine winner with house edge
    const winner = generateRaceWinner();

    // Set speeds — winner gets highest average speed
    racing.speeds = racing.horses.map((h, i) => {
        const base = 0.008 + Math.random() * 0.006;
        return i === winner ? base + 0.004 : base;
    });

    function animateRace() {
        let allFinished = true;

        racing.horses.forEach((horse, i) => {
            if (horse.x < 1) {
                allFinished = false;
                horse.x += racing.speeds[i] * (0.9 + Math.random() * 0.2);
                if (horse.x >= 1) {
                    horse.x = 1;
                    if (!racing.finishOrder.find(h => h.name === horse.name)) {
                        racing.finishOrder.push(horse);
                    }
                }
            }
        });

        drawRace();

        if (!allFinished) {
            racing.animId = requestAnimationFrame(animateRace);
        } else {
            racing.isRacing = false;
            document.getElementById('racingStartBtn').disabled = false;
            resolveRace();
        }
    }

    racing.animId = requestAnimationFrame(animateRace);
}

function generateRaceWinner() {
    const betIdx = racing.betHorse;
    const houseWins = Math.random() < 0.65;

    if (houseWins) {
        // Pick a horse that is NOT the player's bet
        const losers = racing.horses.map((h,i) => i).filter(i => i !== betIdx);
        return losers[Math.floor(Math.random() * losers.length)];
    }

    // Player's horse wins
    return betIdx;
}

function resolveRace() {
    const winner    = racing.finishOrder[0];
    const winnerIdx = racing.horses.indexOf(winner);
    const bet       = racing.betAmount;
    const won       = winnerIdx === racing.betHorse;

    if (won) {
        const winnings = Math.floor(bet * winner.odds);
        racing.balance  += winnings;
        racing.totalWon += winnings - bet;
        document.getElementById('racingResultMsg').innerHTML = `
            <div class="slots-win-box">
                <div style="color:${winner.color};font-size:1.1rem;font-weight:bold;">🏆 ${winner.name} WINS!</div>
                <div style="color:#28a745;font-size:1.4rem;font-weight:bold;">+UGX ${winnings.toLocaleString()}</div>
                <div style="color:#aaa;font-size:0.82rem;">${bet.toLocaleString()} × ${winner.odds}x</div>
            </div>`;
    } else {
        document.getElementById('racingResultMsg').innerHTML = `
            <div class="slots-lose-box">
                <div style="color:#ff4444;font-weight:bold;">💔 ${winner.name} wins — You lose</div>
                <div style="color:#888;font-size:0.85rem;">-UGX ${bet.toLocaleString()}</div>
            </div>`;
    }

    racing.roundsPlayed++;
    updateRacingUI();
    localStorage.setItem('ute_game_wallet', racing.balance.toString());
    const wEl = document.getElementById('gameWalletDisplay');
    if (wEl) wEl.textContent = 'UGX ' + racing.balance.toLocaleString();
}

function selectHorse(idx) {
    racing.betHorse = idx;
    document.querySelectorAll('.horse-btn').forEach((b, i) => {
        b.style.borderColor = i === idx ? '#FFD700' : '#1a1a3a';
    });
    const h = racing.horses[idx];
    showRacingMsg(`Betting on ${h.name} — Odds: ${h.odds}x`, h.color);
}

function increaseRacingBet() { if (!racing.isRacing) { racing.betAmount=Math.min(racing.betAmount+100,racing.balance); updateRacingUI(); } }
function halfRacingBet()     { if (!racing.isRacing) { racing.betAmount=Math.max(Math.floor(racing.betAmount/2),100); updateRacingUI(); } }
function doubleRacingBet()   { if (!racing.isRacing) { racing.betAmount=Math.min(racing.betAmount*2,racing.balance); updateRacingUI(); } }
function maxRacingBet()      { if (!racing.isRacing) { racing.betAmount=racing.balance; updateRacingUI(); } }

function updateRacingUI() {
    const s = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    s('racingBetDisplay',   'UGX ' + racing.betAmount.toLocaleString());
    s('racingBalDisplay',   'UGX ' + racing.balance.toLocaleString());
    s('racingRoundsDisp',   racing.roundsPlayed);
    s('racingTotalWonDisp', 'UGX ' + racing.totalWon.toLocaleString());
}

function showRacingMsg(msg, color) {
    const el = document.getElementById('racingResultMsg');
    if (el) el.innerHTML = `<div style="color:${color};font-size:0.88rem;text-align:center;padding:8px;">${msg}</div>`;
}

function selectRacingGame() {
    document.getElementById('gameSelection').style.display = 'none';
    document.getElementById('racingGameSection').style.display = 'block';
    racing.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    initRacingGame();
    window.scrollTo(0, 0);
}

function backFromRacing() {
    document.getElementById('racingGameSection').style.display = 'none';
    document.getElementById('gameSelection').style.display = 'block';
    cancelAnimationFrame(racing.animId);
    localStorage.setItem('ute_game_wallet', racing.balance.toString());
    const wEl = document.getElementById('gameWalletDisplay');
    if (wEl) wEl.textContent = 'UGX ' + racing.balance.toLocaleString();
    window.scrollTo(0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('racingCanvas')) initRacingGame();
});
