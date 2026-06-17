const fs = require('fs');
const path = require('path');

const TEST_DATA_FILE = path.join(__dirname, '..', 'fixtures', 'registered_users.json');

/**
 * Generate a random email address
 * @returns {string} A unique email like "user_a3f8b2@test.com"
 */
function generateRandomEmail() {
    const randomId = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now().toString(36);
    return `user_${randomId}_${timestamp}@test.com`;
}

/**
 * Generate a random password that meets common requirements
 * (uppercase, lowercase, number, special char, 10 chars)
 * @returns {string}
 */
function generateRandomPassword() {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '@#$!&';

    let password = '';
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += special[Math.floor(Math.random() * special.length)];

    const allChars = upper + lower + digits + special;
    for (let i = 0; i < 6; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    return password;
}

/**
 * Save registered user credentials to JSON file
 * Appends to the array of existing users
 * @param {string} email 
 * @param {string} password 
 */
function saveRegisteredUser(email, password) {
    const dir = path.dirname(TEST_DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    let users = [];
    if (fs.existsSync(TEST_DATA_FILE)) {
        const data = fs.readFileSync(TEST_DATA_FILE, 'utf-8');
        users = JSON.parse(data);
    }

    users.push({
        email,
        password,
        registeredAt: new Date().toISOString()
    });

    fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * Read all registered users from JSON file
 * @returns {Array<{email: string, password: string, registeredAt: string}>}
 */
function getRegisteredUsers() {
    if (!fs.existsSync(TEST_DATA_FILE)) {
        return [];
    }
    const data = fs.readFileSync(TEST_DATA_FILE, 'utf-8');
    return JSON.parse(data);
}

/**
 * Get the most recently registered user
 * @returns {{email: string, password: string, registeredAt: string} | null}
 */
function getLastRegisteredUser() {
    const users = getRegisteredUsers();
    return users.length > 0 ? users[users.length - 1] : null;
}

module.exports = {
    generateRandomEmail,
    generateRandomPassword,
    saveRegisteredUser,
    getRegisteredUsers,
    getLastRegisteredUser,
};
