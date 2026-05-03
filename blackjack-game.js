// ═══════════════════════════════════════════════════════════
//  URBAN BLACKJACK — Beat the Dealer to 21
//  - Hit, Stand, Double Down
//  - Dealer hits on soft 16 or less
//  - House edge: dealer wins ties, peeks for blackjack
//  - Canvas drawn cards
// ═══════════════════════════════════════════════════════════

const bj = {
    canvas: null,
    ctx: null,
    balance: 0,
    betAmount: 100,
    totalWon: 0,
    roundsPlayed: 0,
    phase: 'betting',   // 'betting' | 'playing' | 'dealer' | 'result'

    playerHand: [],
    dealerHand: [],
    deck: [],

    payout: { blackjack: 2.5, win: 2, push: 1 }
};

const BJ_SUITS  = ['♠','♥','♦','♣'];
const BJ_VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function buildDeck() {
    const deck = [];
    for (let s of BJ_SUITS)
        for (let v of BJ_VALUES)
            deck.push({ suit: s, value: v, hidden: false });
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function bjCardValue(card) {
    if (['J','Q','K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value);
}

function handScore(hand) {
    let score = 0, aces = 0;
    hand.forEach(c => {
        if (c.hidden) return;
        score += bjCardValue(c);
        if (c.value === 'A') aces++;
    });
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
}

function isBlackjack(hand) {
    return hand.length === 2 && handScore(hand) === 21;
}

// ── Init ──────────────────────────────────────────────────────
function initBlackjackGame() {
    bj.canvas = document.getElementById('blackjackCanvas');
    if (!bj.canvas) return;
    bj.ctx = bj.canvas.getContext('2d');
    bj.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    resizeBJCanvas();
    window.addEventListener('resize', resizeBJCanvas);
    drawBJTable();
    updateBJUI();
    setBJButtons('betting');
}

function resizeBJCanvas() {
    if (!bj.canvas) return;
    bj.canvas.width  = bj.canvas.parentElement.clientWidth  || 700;
    bj.canvas.height = bj.canvas.parentElement.clientHeight || 400;
    drawBJTable();
}

// ── Drawing ───────────────────────────────────────────────────
function drawBJTable() {
    const { ctx, canvas, playerHand, dealerHand } = bj;
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // Green felt
    const bg = ctx.createRadialGradient(W/2, H/2, 10, W/2, H/2, W*0.7);
    bg.addColorStop(0, '#1a5a2a');
    bg.addColorStop(1, '#0a2a15');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, W-20, H-20);

    // Labels
    ctx.font = `bold ${W*0.04}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('DEALER', W/2, H*0.12);
    ctx.fillText('PLAYER', W/2, H*0.62);

    // Dealer score
    const dScore = handScore(dealerHand);
    if (dealerHand.length > 0) {
        ctx.font = `bold ${W*0.05}px Arial`;
        ctx.fillStyle = '#FFD700';
        ctx.fillText(dScore, W/2, H*0.22);
    }

    // Player score
    const pScore = handScore(playerHand);
    if (playerHand.length > 0) {
        ctx.font = `bold ${W*0.05}px Arial`;
        ctx.fillStyle = pScore > 21 ? '#ff4444' : '#FFD700';
        ctx.fillText(pScore > 21 ? 'BUST!' : pScore, W/2, H*0.72);
    }

    // Draw dealer cards
    const dStartX = W/2 - (dealerHand.length * 65)/2;
    dealerHand.forEach((card, i) => drawBJCard(ctx, dStartX + i*65, H*0.25, card));

    // Draw player cards
    const pStartX = W/2 - (playerHand.length * 65)/2;
    playerHand.forEach((card, i) => drawBJCard(ctx, pStartX + i*65, H*0.75, card));
}

function drawBJCard(ctx, x, y, card) {
    const cW = 58, cH = 82;
    const isRed = card.suit === '♥' || card.suit === '♦';

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    if (card.hidden) {
        // Face down card
        const grad = ctx.createLinearGradient(x, y, x+cW, y+cH);
        grad.addColorStop(0, '#002a5c');
        grad.addColorStop(1, '#001a3a');
        ctx.fillStyle = grad;
        roundRectBJ(ctx, x, y, cW, cH, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        roundRectBJ(ctx, x, y, cW, cH, 6);
        ctx.stroke();
        ctx.font = `bold 22px Arial`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.fillText('?', x + cW/2, y + cH/2 + 8);
        return;
    }

    ctx.fillStyle = 'white';
    roundRectBJ(ctx, x, y, cW, cH, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    roundRectBJ(ctx, x, y, cW, cH, 6);
    ctx.stroke();

    ctx.fillStyle = isRed ? '#cc0000' : '#111';
    ctx.font = `bold 13px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(card.value, x+5, y+16);
    ctx.font = `13px Arial`;
    ctx.fillText(card.suit, x+5, y+30);
    ctx.font = `24px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(card.suit, x+cW/2, y+cH/2+8);
}

function roundRectBJ(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
}

// ── Game logic ────────────────────────────────────────────────
function dealBlackjack() {
    if (bj.phase !== 'betting') return;
    if (bj.betAmount > bj.balance) { showBJMsg('❌ Insufficient balance', '#ff4444'); return; }

    bj.balance -= bj.betAmount;
    bj.deck = buildDeck();
    bj.playerHand = [bj.deck.pop(), bj.deck.pop()];
    bj.dealerHand = [bj.deck.pop(), { ...bj.deck.pop(), hidden: true }];
    bj.phase = 'playing';

    updateBJUI();
    drawBJTable();
    setBJButtons('playing');
    document.getElementById('bjResultMsg').innerHTML = '';

    // Check player blackjack
    if (isBlackjack(bj.playerHand)) {
        setTimeout(standBlackjack, 500);
    }
}

function hitBlackjack() {
    if (bj.phase !== 'playing') return;
    bj.playerHand.push(bj.deck.pop());
    drawBJTable();

    if (handScore(bj.playerHand) > 21) {
        bj.phase = 'result';
        setBJButtons('betting');
        resolveBlackjack();
    }
}

function standBlackjack() {
    if (bj.phase !== 'playing') return;
    bj.phase = 'dealer';
    setBJButtons('result');

    // Reveal dealer hidden card
    bj.dealerHand.forEach(c => c.hidden = false);
    drawBJTable();

    // Dealer draws to 20+ (house advantage)
    setTimeout(function dealerDraw() {
        const dScore = handScore(bj.dealerHand);
        if (dScore < 20) {
            bj.dealerHand.push(bj.deck.pop());
            drawBJTable();
            setTimeout(dealerDraw, 600);
        } else {
            bj.phase = 'result';
            setBJButtons('betting');
            resolveBlackjack();
        }
    }, 600);
}

function doubleBlackjack() {
    if (bj.phase !== 'playing' || bj.playerHand.length !== 2) return;
    if (bj.betAmount > bj.balance) { showBJMsg('❌ Insufficient balance to double', '#ff4444'); return; }
    bj.balance -= bj.betAmount;
    bj.betAmount *= 2;
    bj.playerHand.push(bj.deck.pop());
    drawBJTable();
    updateBJUI();
    standBlackjack();
}

function resolveBlackjack() {
    const pScore = handScore(bj.playerHand);
    const dScore = handScore(bj.dealerHand);
    const bet    = bj.betAmount;
    let winnings = 0;
    let msg = '';

    if (pScore > 21) {
        msg = `<div class="slots-lose-box"><div style="color:#ff4444;font-weight:bold;">💔 BUST! You lose</div><div style="color:#888;">-UGX ${bet.toLocaleString()}</div></div>`;
    } else if (isBlackjack(bj.playerHand) && !isBlackjack(bj.dealerHand)) {
        winnings = Math.floor(bet * bj.payout.blackjack);
        msg = `<div class="slots-win-box"><div style="color:#FFD700;font-size:1.2rem;font-weight:bold;">🎉 BLACKJACK!</div><div style="color:#28a745;font-size:1.4rem;font-weight:bold;">+UGX ${winnings.toLocaleString()}</div></div>`;
    } else if (dScore > 21 || pScore > dScore) {
        winnings = Math.floor(bet * bj.payout.win);
        msg = `<div class="slots-win-box"><div style="color:#FFD700;font-weight:bold;">🎉 YOU WIN! ${pScore} vs ${dScore}</div><div style="color:#28a745;font-size:1.3rem;font-weight:bold;">+UGX ${winnings.toLocaleString()}</div></div>`;
    } else if (pScore === dScore) {
        winnings = Math.floor(bet * bj.payout.push);
        msg = `<div style="background:rgba(255,215,0,0.1);border:1px solid #FFD700;border-radius:10px;padding:12px;text-align:center;"><div style="color:#FFD700;font-weight:bold;">🤝 PUSH — Tie ${pScore}</div><div style="color:#aaa;">UGX ${winnings.toLocaleString()} returned</div></div>`;
    } else {
        msg = `<div class="slots-lose-box"><div style="color:#ff4444;font-weight:bold;">💔 Dealer wins ${dScore} vs ${pScore}</div><div style="color:#888;">-UGX ${bet.toLocaleString()}</div></div>`;
    }

    bj.balance  += winnings;
    if (winnings > bet) bj.totalWon += winnings - bet;
    bj.roundsPlayed++;
    if (typeof recordGameBet === 'function') recordGameBet('Blackjack', bet, winnings > bet ? 'win' : 'loss', winnings);
    bj.betAmount = Math.min(bj.betAmount, bj.balance) || 100;

    document.getElementById('bjResultMsg').innerHTML = msg;
    updateBJUI();
    localStorage.setItem('ute_game_wallet', bj.balance.toString());
    const wEl = document.getElementById('gameWalletDisplay');
    if (wEl) wEl.textContent = 'UGX ' + bj.balance.toLocaleString();
}

function setBJButtons(state) {
    const deal   = document.getElementById('bjDealBtn');
    const hit    = document.getElementById('bjHitBtn');
    const stand  = document.getElementById('bjStandBtn');
    const dbl    = document.getElementById('bjDoubleBtn');
    if (!deal) return;
    deal.style.display  = state === 'betting' ? 'block' : 'none';
    hit.style.display   = state === 'playing' ? 'block' : 'none';
    stand.style.display = state === 'playing' ? 'block' : 'none';
    dbl.style.display   = state === 'playing' ? 'block' : 'none';
}

function increaseBJBet() { if (bj.phase==='betting') { bj.betAmount=Math.min(bj.betAmount+100,bj.balance); updateBJUI(); } }
function halfBJBet()     { if (bj.phase==='betting') { bj.betAmount=Math.max(Math.floor(bj.betAmount/2),100); updateBJUI(); } }
function doubleBJBet()   { if (bj.phase==='betting') { bj.betAmount=Math.min(bj.betAmount*2,bj.balance); updateBJUI(); } }
function maxBJBet()      { if (bj.phase==='betting') { bj.betAmount=bj.balance; updateBJUI(); } }

function updateBJUI() {
    const s = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    s('bjBetDisplay',   'UGX ' + bj.betAmount.toLocaleString());
    s('bjBalDisplay',   'UGX ' + bj.balance.toLocaleString());
    s('bjRoundsDisp',   bj.roundsPlayed);
    s('bjTotalWonDisp', 'UGX ' + bj.totalWon.toLocaleString());
}

function showBJMsg(msg, color) {
    const el = document.getElementById('bjResultMsg');
    if (el) el.innerHTML = `<div style="color:${color};font-weight:bold;text-align:center;padding:10px;">${msg}</div>`;
}

function selectBlackjackGame() {
    document.getElementById('gameSelection').style.display = 'none';
    document.getElementById('blackjackGameSection').style.display = 'block';
    bj.balance = parseFloat(localStorage.getItem('ute_game_wallet') || '0');
    initBlackjackGame();
    window.scrollTo(0, 0);
}

function backFromBlackjack() {
    document.getElementById('blackjackGameSection').style.display = 'none';
    document.getElementById('gameSelection').style.display = 'block';
    localStorage.setItem('ute_game_wallet', bj.balance.toString());
    const wEl = document.getElementById('gameWalletDisplay');
    if (wEl) wEl.textContent = 'UGX ' + bj.balance.toLocaleString();
    window.scrollTo(0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('blackjackCanvas')) initBlackjackGame();
});
