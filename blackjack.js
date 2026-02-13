const suits = [
    { name: '♠', code: 'S' },
    { name: '♥', code: 'H' },
    { name: '♦', code: 'D' },
    { name: '♣', code: 'C' }
];
const values = [
    { name: '2', code: '2' },
    { name: '3', code: '3' },
    { name: '4', code: '4' },
    { name: '5', code: '5' },
    { name: '6', code: '6' },
    { name: '7', code: '7' },
    { name: '8', code: '8' },
    { name: '9', code: '9' },
    { name: '10', code: '0' },
    { name: 'J', code: 'J' },
    { name: 'Q', code: 'Q' },
    { name: 'K', code: 'K' },
    { name: 'A', code: 'A' }
];

function createDeck() {
    let deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push({ 
                suit: suit.name, 
                value: value.name,
                image: `https://deckofcardsapi.com/static/img/${value.code}${suit.code}.png`
            });
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

function calculateScore(hand) {
    let score = 0;
    let aces = 0;
    for (let card of hand) {
        if (card.value === 'A') {
            aces += 1;
            score += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
            score += 10;
        } else {
            score += parseInt(card.value);
        }
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces -= 1;
    }
    return score;
}

class BlackjackGame {
    constructor(userId, bet) {
        this.userId = userId;
        this.bet = bet;
        this.deck = createDeck();
        this.playerHand = [this.deck.pop(), this.deck.pop()];
        this.dealerHand = [this.deck.pop(), this.deck.pop()];
        this.status = 'playing'; // playing, win, loss, draw
    }

    hit() {
        this.playerHand.push(this.deck.pop());
        if (calculateScore(this.playerHand) > 21) {
            this.status = 'loss';
        }
        return this.getState();
    }

    stand() {
        let dealerScore = calculateScore(this.dealerHand);
        while (dealerScore < 17) {
            this.dealerHand.push(this.deck.pop());
            dealerScore = calculateScore(this.dealerHand);
        }

        const playerScore = calculateScore(this.playerHand);
        if (dealerScore > 21 || playerScore > dealerScore) {
            this.status = 'win';
        } else if (playerScore < dealerScore) {
            this.status = 'loss';
        } else {
            this.status = 'draw';
        }
        return this.getState();
    }

    getState() {
        return {
            playerHand: this.playerHand,
            dealerHand: this.dealerHand,
            playerScore: calculateScore(this.playerHand),
            dealerScore: calculateScore(this.dealerHand),
            status: this.status,
            bet: this.bet
        };
    }
}

module.exports = BlackjackGame;
