const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

function readDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ users: {} }, null, 2));
    }
    const data = fs.readFileSync(DB_PATH);
    return JSON.parse(data);
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getUser(userId) {
    const db = readDB();
    if (!db.users[userId]) {
        db.users[userId] = {
            balance: 0,
            isAdmin: false,
            lastClaimed: null
        };
        writeDB(db);
    }
    return db.users[userId];
}

function updateBalance(userId, amount) {
    const db = readDB();
    if (!db.users[userId]) {
        db.users[userId] = { balance: 0, isAdmin: false, lastClaimed: null };
    }
    db.users[userId].balance += amount;
    writeDB(db);
    return db.users[userId].balance;
}

function updateLastClaimed(userId) {
    const db = readDB();
    if (!db.users[userId]) {
        db.users[userId] = { balance: 0, isAdmin: false, lastClaimed: null };
    }
    db.users[userId].lastClaimed = new Date().toISOString();
    writeDB(db);
}

function setAdmin(userId, status) {
    const db = readDB();
    if (!db.users[userId]) {
        db.users[userId] = { balance: 0, isAdmin: false, lastClaimed: null };
    }
    db.users[userId].isAdmin = status;
    writeDB(db);
}

module.exports = {
    getUser,
    updateBalance,
    updateLastClaimed,
    setAdmin,
    readDB
};
