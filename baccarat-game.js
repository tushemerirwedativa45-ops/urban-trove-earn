// ═══════════════════════════════════════════════════════════
//  URBAN BACCARAT — Professional Card Game
//  - Banker vs Player
//  - Bet on Player (1.95x), Banker (1.90x), Tie (8x)
//  - House edge: Banker wins 60% of the time
//  - Canvas drawn cards
// ═══════════════════════════════════════════════════════════

const baccarat = {
    canvas: null,
    ctx: null,
    balance: 0,
    betAmount: 100,
    betOn: null,       // 'player' | 'banker' | 'tie'
    isDealing: false,
    totalWon: 0,
    roundsPlayed: 0,
    playerCards: [],
    bankerCards: [],
    playerScore: 0,
    bankerScore: 0,

    payouts: { player: 1.95, banker: 1.90, tie: 8 }
};

const SUITS  = ['♠', '♥', '♦', '♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function cardValue(val) {
    if (['10','J','Q','K'].includes(val)) return 0;
    if (val === 'A') return 1;
    return parseInt(val);
}

function baccaratScore(cards) {
    return cards.reduce((s, c) => s + cardValue(c.value), 0) % 10;
}

function dealCard() {
    return {
        suit:  SUITS[Math.floor(Math.random() * 4)],
        value: VALUES[Math.floor(Math.random() * 13)],
        red:   false
    };
}

function initBaccaratGame() {
    baccarat.canvas = document.getElementById('baccaratCanvas');
    if (!baccarat.canvas) return;
    baccarat.ctx = baccarat.canvas.getContext('2d');
    baccarat.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    resizeBaccaratCanvas();
    window.addEventListener('resize', resizeBaccaratCanvas);
    drawBaccaratTable();
    updateBaccaratUI();
}

function resizeBaccaratCanvas() {
    if (!baccarat.canvas) return;
    baccarat.canvas.width  = baccarat.canvas.parentElement.clientWidth  || 700;
    baccarat.canvas.height = baccarat.canvas.parentElement.clientHeight || 380;
    drawBaccaratTable();
}

// ── Drawing ───────────────────────────────────────────────────
function drawBaccaratTable() {
    const { ctx, canvas, playerCards, bankerCards, playerScore, bankerScore } = baccarat;
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // Background — green felt
    const bg = ctx.createRadialGradient(W/2, H/2, 10, W/2, H/2, W*0.7);
    bg.addColorStop(0, '#1a4a2a');
    bg.addColorStop(1, '#0a2a15');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Table border
    ctx.strokeStyle = 'rgba(255,215,0,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, W-20, H-20);

    // Title
    ctx.font = `bold ${W*0.05}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 10;
    ctx.fillText('BACCARAT', W/2, H*0.1);
    ctx.shadowBlur = 0;

    // Player side
    ctx.font = `bold ${W*0.04}px Arial`;
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'left';
    ctx.fillText('PLAYER', W*0.08, H*0.28);

    // Banker side
    ctx.textAlign = 'right';
    ctx.fillText('BANKER', W*0.92, H*0.28);

    // Draw player cards
    playerCards.forEach((card, i) => drawCard(ctx, W*0.08 + i*70, H*0.32, card));

    // Draw banker cards
    bankerCards.forEach((card, i) => drawCard(ctx, W*0.92 - 60 - i*70, H*0.32, card));

    // Scores
    if (playerCards.length > 0) {
        ctx.font = `bold ${W*0.06}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(playerScore, W*0.08, H*0.75);
    }
    if (bankerCards.length > 0) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(bankerScore, W*0.92, H*0.75);
    }

    // VS
    ctx.font = `bold ${W*0.06}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('VS', W/2, H*0.55);
}

function drawCard(ctx, x, y, card) {
    const cW = 55, cH = 80;
    const isRed = card.suit === '♥' || card.suit === '♦';

    // Card shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Card body
    ctx.fillStyle = 'white';
    roundRectBacc(ctx, x, y, cW, cH, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Card border
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    roundRectBacc(ctx, x, y, cW, cH, 6);
    ctx.stroke();

    // Value and suit
    ctx.fillStyle = isRed ? '#cc0000' : '#111';
    ctx.font = `bold 13px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(card.value, x + 5, y + 16);
    ctx.font = `14px Arial`;
    ctx.fillText(card.suit, x + 5, y + 30);

    // Center suit
    ctx.font = `22px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(card.suit, x + cW/2, y + cH/2 + 8);
}

function roundRectBacc(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
}

// ── Game logic ────────────────────────────────────────────────
function dealBaccarat() {
    if (baccarat.isDealing) return;
    if (!baccarat.betOn) { showBaccaratMsg('❌ Choose Player, Banker or Tie first', '#ff4444'); return; }
    if (baccarat.betAmount > baccarat.balance) { showBaccaratMsg('❌ Insufficient balance', '#ff4444'); return; }

    baccarat.balance   -= baccarat.betAmount;
    baccarat.isDealing  = true;
    document.getElementById('baccaratDealBtn').disabled = true;
    document.getElementById('baccaratResultMsg').innerHTML = '';
    updateBaccaratUI();

    // House edge — banker wins 60%
    let pScore, bScore;
    const houseWins = Math.random() < 0.60;

    if (houseWins && baccarat.betOn !== 'banker') {
        // Force banker win
        bScore = Math.floor(Math.random() * 4) + 6; // 6-9
        do { pScore = Math.floor(Math.random() * 10); } while (pScore >= bScore);
    } else if (houseWins && baccarat.betOn === 'banker') {
        // Player bet — force player win
        pScore = Math.floor(Math.random() * 4) + 6;
        do { bScore = Math.floor(Math.random() * 10); } while (bScore >= pScore);
    } else {
        // Fair result
        pScore = Math.floor(Math.random() * 10);
        bScore = Math.floor(Math.random() * 10);
    }

    // Build cards that produce these scores
    baccarat.playerCards = buildCards(pScore);
    baccarat.bankerCards  = buildCards(bScore);
    baccarat.playerScore  = pScore;
    baccarat.bankerScore  = bScore;

    // Animate deal with delay
    setTimeout(() => {
        drawBaccaratTable();
        resolveBaccarat(pScore, bScore);
        baccarat.isDealing = false;
        document.getElementById('baccaratDealBtn').disabled = false;
        localStorage.setItem('ute_game_wallet', baccarat.balance.toString());
        const wEl = document.getElementById('gameWalletDisplay');
        if (wEl) wEl.textContent = 'UGX ' + baccarat.balance.toLocaleString();
    }, 800);
}

function buildCards(targetScore) {
    // Build 2 cards that sum to targetScore mod 10
    const v1 = Math.floor(Math.random() * 10);
    const v2 = (targetScore - v1 + 10) % 10;
    return [
        { suit: SUITS[Math.floor(Math.random()*4)], value: v1 === 0 ? '10' : String(v1) },
        { suit: SUITS[Math.floor(Math.random()*4)], value: v2 === 0 ? '10' : String(v2) }
    ];
}

function resolveBaccarat(pScore, bScore) {
    const bet = baccarat.betAmount;
    let winnings = 0;
    let result = '';

    if (pScore > bScore) result = 'player';
    else if (bScore > pScore) result = 'banker';
    else result = 'tie';

    const won = result === baccarat.betOn;
    const payout = baccarat.payouts[baccarat.betOn];

    if (won) {
        winnings = Math.floor(bet * payout);
        baccarat.balance  += winnings;
        baccarat.totalWon += winnings - bet;
        document.getElementById('baccaratResultMsg').innerHTML = `
            <div class="slots-win-box">
                <div style="color:#FFD700;font-size:1.1rem;font-weight:bold;">🎉 YOU WIN!</div>
                <div style="color:#28a745;font-size:1.5rem;font-weight:bold;">+UGX ${winnings.toLocaleString()}</div>
                <div style="color:#aaa;font-size:0.82rem;">Player ${pScore} vs Banker ${bScore} — ${result.toUpperCase()} wins</div>
            </div>`;
    } else {
        document.getElementById('baccaratResultMsg').innerHTML = `
            <div class="slots-lose-box">
                <div style="color:#ff4444;font-weight:bold;">💔 ${result.toUpperCase()} wins — You lose</div>
                <div style="color:#888;font-size:0.85rem;">Player ${pScore} vs Banker ${bScore} | -UGX ${bet.toLocaleString()}</div>
            </div>`;
    }

    baccarat.roundsPlayed++;
    updateBaccaratUI();
}

// ── Bet controls ──────────────────────────────────────────────
function selectBaccaratBet(type) {
    baccarat.betOn = type;
    ['player','banker','tie'].forEach(t => {
        const el = document.getElementById('bacc-' + t);
        if (el) el.style.borderColor = t === type ? '#FFD700' : '#1a1a3a';
    });
    const payouts = { player: '1.95x', banker: '1.90x', tie: '8x' };
    showBaccaratMsg(`Betting on ${type.toUpperCase()} — Payout: ${payouts[type]}`, '#FFD700');
}

function increaseBaccaratBet() { if (!baccarat.isDealing) { baccarat.betAmount = Math.min(baccarat.betAmount + 100, baccarat.balance); updateBaccaratUI(); } }
function halfBaccaratBet()     { if (!baccarat.isDealing) { baccarat.betAmount = Math.max(Math.floor(baccarat.betAmount/2), 100); updateBaccaratUI(); } }
function doubleBaccaratBet()   { if (!baccarat.isDealing) { baccarat.betAmount = Math.min(baccarat.betAmount*2, baccarat.balance); updateBaccaratUI(); } }
function maxBaccaratBet()      { if (!baccarat.isDealing) { baccarat.betAmount = baccarat.balance; updateBaccaratUI(); } }

function updateBaccaratUI() {
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('baccaratBetDisplay',   'UGX ' + baccarat.betAmount.toLocaleString());
    s('baccaratBalDisplay',   'UGX ' + baccarat.balance.toLocaleString());
    s('baccaratRoundsDisp',   baccarat.roundsPlayed);
    s('baccaratTotalWonDisp', 'UGX ' + baccarat.totalWon.toLocaleString());
}

function showBaccaratMsg(msg, color) {
    const el = document.getElementById('baccaratResultMsg');
    if (el) el.innerHTML = `<div style="color:${color};font-size:0.88rem;text-align:center;padding:8px;">${msg}</div>`;
}

// ── Navigation ────────────────────────────────────────────────
function selectBaccaratGame() {
    document.getElementById('gameSelection').style.display = 'none';
    document.getElementById('baccaratGameSection').style.display = 'block';
    baccarat.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    initBaccaratGame();
    window.scrollTo(0, 0);
}

function backFromBaccarat() {
    document.getElementById('baccaratGameSection').style.display = 'none';
    document.getElementById('gameSelection').style.display = 'block';
    localStorage.setItem('ute_game_wallet', baccarat.balance.toString());
    const wEl = document.getElementById('gameWalletDisplay');
    if (wEl) wEl.textContent = 'UGX ' + baccarat.balance.toLocaleString();
    window.scrollTo(0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('baccaratCanvas')) initBaccaratGame();
});
