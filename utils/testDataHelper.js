const fs = require('fs');
const path = require('path');

const TEST_DATA_FILE_JSON = path.join(__dirname, '..', 'fixtures', 'registered_users.json');
const TEST_DATA_FILE_CSV = path.join(__dirname, '..', 'fixtures', 'registered_users.csv');
const TEST_DATA_FILE_EVENT_CSV = path.join(__dirname, '..', 'fixtures', 'admin_event_data.csv');
const TEST_DATA_FILE_DELETE_CSV = path.join(__dirname, '..', 'fixtures', 'delete_event_data.csv');
const ENV_FILE_PATH = path.join(__dirname, '..', '.env');

/**
 * Escapes characters in a CSV field according to RFC 4180
 * @param {any} val
 * @returns {string}
 */
function escapeCsv(val) {
    if (val === null || val === undefined) {
        return '""';
    }
    return `"${String(val).replace(/"/g, '""')}"`;
}

/**
 * Parses a CSV string into a 2D array
 * @param {string} content
 * @returns {Array<Array<string>>}
 */
function parseCsv(content) {
    const lines = [];
    let currentLine = [];
    let currentVal = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    currentVal += '"';
                    i++; // skip next quote
                } else {
                    inQuotes = false;
                }
            } else {
                currentVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentLine.push(currentVal);
                currentVal = '';
            } else if (char === '\r') {
                // Ignore carriage return
            } else if (char === '\n') {
                currentLine.push(currentVal);
                lines.push(currentLine);
                currentLine = [];
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
    }
    if (currentLine.length > 0 || currentVal !== '') {
        currentLine.push(currentVal);
        lines.push(currentLine);
    }
    return lines;
}

/**
 * Clean and load environment variables from the .env file dynamically
 * @returns {Object} A map of environment variable keys to values
 */
function loadEnv() {
    if (!fs.existsSync(ENV_FILE_PATH)) {
        return {};
    }
    const content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
    const env = {};
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const equalsIdx = trimmed.indexOf('=');
        if (equalsIdx > 0) {
            const key = trimmed.substring(0, equalsIdx).trim();
            let value = trimmed.substring(equalsIdx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            env[key] = value;
        }
    }
    return env;
}

/**
 * Append a key-value pair to the .env file
 * @param {string} key 
 * @param {string} value 
 */
function saveEnvValue(key, value) {
    const line = `${key}="${value.replace(/"/g, '\\"')}"\n`;
    fs.appendFileSync(ENV_FILE_PATH, line, 'utf-8');
}

/**
 * Generate a sanitized environment variable name for a given email address
 * @param {string} email 
 * @returns {string} e.g. "PASSWORD_user_123_test_com"
 */
function sanitizeEmailForEnv(email) {
    return `PASSWORD_${email.replace(/[@.]/g, '_')}`;
}

// 1. One-Time JSON to CSV migration
if (!fs.existsSync(TEST_DATA_FILE_CSV) && fs.existsSync(TEST_DATA_FILE_JSON)) {
    try {
        const jsonContent = fs.readFileSync(TEST_DATA_FILE_JSON, 'utf-8');
        const users = JSON.parse(jsonContent);
        if (Array.isArray(users)) {
            const header = 'Run,Email,Password,final Password';
            const rows = users.map(user => {
                return `${escapeCsv('yes')},${escapeCsv(user.email)},${escapeCsv(user.password)},${escapeCsv(user.password)}`;
            });
            const csvContent = [header, ...rows].join('\n') + '\n';
            const dir = path.dirname(TEST_DATA_FILE_CSV);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(TEST_DATA_FILE_CSV, csvContent, 'utf-8');
            fs.renameSync(TEST_DATA_FILE_JSON, TEST_DATA_FILE_JSON + '.bak');
        }
    } catch (e) {
        console.error('Error migrating registered_users.json to registered_users.csv:', e);
    }
}

// 2. One-Time CSV to ENV migration (Move raw passwords from CSV to .env)
if (fs.existsSync(TEST_DATA_FILE_CSV)) {
    try {
        const rawContent = fs.readFileSync(TEST_DATA_FILE_CSV, 'utf-8');
        const rows = parseCsv(rawContent);
        if (rows.length > 1) {
            const headers = rows[0].map(h => h.trim());
            const runIdx = headers.indexOf('Run');
            const emailIdx = headers.indexOf('Email');
            const passwordIdx = headers.indexOf('Password');
            const finalPasswordIdx = headers.indexOf('final Password');

            let modified = false;
            const currentEnv = loadEnv();

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < headers.length) continue;
                const email = row[emailIdx];
                const password = row[passwordIdx];
                if (password && password !== 'STORED_IN_ENV') {
                    const envKey = sanitizeEmailForEnv(email);
                    if (!currentEnv[envKey]) {
                        saveEnvValue(envKey, password);
                        currentEnv[envKey] = password;
                    }
                    row[passwordIdx] = 'STORED_IN_ENV';
                    row[finalPasswordIdx] = 'STORED_IN_ENV';
                    modified = true;
                }
            }

            if (modified) {
                const csvContent = rows.map(r => r.map(cell => escapeCsv(cell)).join(',')).join('\n') + '\n';
                fs.writeFileSync(TEST_DATA_FILE_CSV, csvContent, 'utf-8');
                console.log('Successfully migrated passwords from registered_users.csv to .env file.');
            }
        }
    } catch (e) {
        console.error('Error migrating CSV passwords to env file:', e);
    }
}

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
 * Save registered user credentials to CSV file and password to env file
 * @param {string} email 
 * @param {string} password 
 */
function saveRegisteredUser(email, password) {
    const dir = path.dirname(TEST_DATA_FILE_CSV);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const header = 'Run,Email,Password,final Password';
    const placeholder = 'STORED_IN_ENV';
    const row = `${escapeCsv('yes')},${escapeCsv(email)},${escapeCsv(placeholder)},${escapeCsv(placeholder)}`;

    if (!fs.existsSync(TEST_DATA_FILE_CSV)) {
        fs.writeFileSync(TEST_DATA_FILE_CSV, header + '\n' + row + '\n', 'utf-8');
    } else {
        let content = fs.readFileSync(TEST_DATA_FILE_CSV, 'utf-8');
        if (content && !content.endsWith('\n')) {
            content += '\n';
        }
        fs.writeFileSync(TEST_DATA_FILE_CSV, content + row + '\n', 'utf-8');
    }

    // Save to env file
    const envKey = sanitizeEmailForEnv(email);
    saveEnvValue(envKey, password);
}

/**
 * Read all registered users from CSV file
 * @returns {Array<{Run: string, email: string, password: string, finalPassword: string}>}
 */
function getRegisteredUsers() {
    if (!fs.existsSync(TEST_DATA_FILE_CSV)) {
        return [];
    }
    const content = fs.readFileSync(TEST_DATA_FILE_CSV, 'utf-8');
    const rows = parseCsv(content);
    if (rows.length === 0) {
        return [];
    }
    const headers = rows[0].map(h => h.trim());
    const runIdx = headers.indexOf('Run');
    const emailIdx = headers.indexOf('Email');
    const passwordIdx = headers.indexOf('Password');
    const finalPasswordIdx = headers.indexOf('final Password');

    const env = loadEnv();

    const users = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < headers.length) {
            continue; // skip malformed/empty lines
        }
        const email = row[emailIdx];
        const envKey = sanitizeEmailForEnv(email);
        const resolvedPassword = env[envKey] || row[passwordIdx];
        const resolvedFinalPassword = env[envKey] || row[finalPasswordIdx];

        users.push({
            Run: row[runIdx],
            email: email,
            password: resolvedPassword,
            finalPassword: resolvedFinalPassword
        });
    }
    return users;
}

/**
 * Get the most recently registered user
 * @returns {{Run: string, email: string, password: string, finalPassword: string} | null}
 */
function getLastRegisteredUser() {
    const users = getRegisteredUsers();
    const activeUsers = users.filter(user => user.Run && user.Run.trim().toLowerCase() === 'yes');
    return activeUsers.length > 0 ? activeUsers[activeUsers.length - 1] : null;
}

/**
 * Retrieve all event test data rows from fixtures/admin_event_data.csv matching email and test name
 * @param {string} email 
 * @param {string} testName 
 * @returns {Array<Object>}
 */
function getAllEventTestData(email, testName) {
    if (!fs.existsSync(TEST_DATA_FILE_EVENT_CSV)) {
        throw new Error(`Event test data CSV file does not exist at ${TEST_DATA_FILE_EVENT_CSV}`);
    }
    const content = fs.readFileSync(TEST_DATA_FILE_EVENT_CSV, 'utf-8');
    const rows = parseCsv(content);
    if (rows.length === 0) {
        return [];
    }

    const headers = rows[0].map(h => h.trim());
    const emailIdx = headers.indexOf('Email');
    const testNameIdx = headers.indexOf('Test Name');
    const titleIdx = headers.indexOf('title');
    const descriptionIdx = headers.indexOf('description');
    const categoryIdx = headers.indexOf('category');
    const cityIdx = headers.indexOf('city');
    const venueIdx = headers.indexOf('venue');
    const priceIdx = headers.indexOf('price');
    const dateTimeIdx = headers.indexOf('dateTime');
    const seatsIdx = headers.indexOf('seats');

    if (emailIdx === -1 || testNameIdx === -1) {
        throw new Error('CSV headers must include "Email" and "Test Name"');
    }

    const results = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < headers.length) {
            continue; // skip empty/malformed lines
        }
        
        if (row[emailIdx].trim().toLowerCase() === email.trim().toLowerCase() && row[testNameIdx].trim() === testName.trim()) {
            results.push({
                title: row[titleIdx],
                description: row[descriptionIdx],
                category: row[categoryIdx],
                city: row[cityIdx],
                venue: row[venueIdx],
                price: row[priceIdx],
                dateTime: row[dateTimeIdx],
                seats: row[seatsIdx]
            });
        }
    }
    return results;
}

/**
 * Retrieve first event test data from fixtures/admin_event_data.csv matching email and test name
 * @param {string} email 
 * @param {string} testName 
 * @returns {Object}
 */
function getEventTestData(email, testName) {
    const list = getAllEventTestData(email, testName);
    if (list.length === 0) {
        throw new Error(`No matching event test data found in CSV for Email: "${email}" and Test Name: "${testName}"`);
    }
    return list[0];
}

/**
 * Save event to delete in delete_event_data.csv
 * @param {string} email 
 * @param {string} testName 
 * @param {string} title 
 * @param {string} runVal 
 */
function saveDeleteEventData(email, testName, title, runVal = 'yes') {
    const dir = path.dirname(TEST_DATA_FILE_DELETE_CSV);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const header = 'Run,Email,Test Name,title';
    const row = `${escapeCsv(runVal)},${escapeCsv(email)},${escapeCsv(testName)},${escapeCsv(title)}`;

    if (!fs.existsSync(TEST_DATA_FILE_DELETE_CSV)) {
        fs.writeFileSync(TEST_DATA_FILE_DELETE_CSV, header + '\n' + row + '\n', 'utf-8');
    } else {
        let content = fs.readFileSync(TEST_DATA_FILE_DELETE_CSV, 'utf-8');
        if (content && !content.endsWith('\n')) {
            content += '\n';
        }
        fs.writeFileSync(TEST_DATA_FILE_DELETE_CSV, content + row + '\n', 'utf-8');
    }
}

/**
 * Retrieve all active delete event data rows from CSV matching email and test name
 * @param {string} email 
 * @param {string} testName 
 * @returns {Array<Object>}
 */
function getAllDeleteEventData(email, testName) {
    if (!fs.existsSync(TEST_DATA_FILE_DELETE_CSV)) {
        return [];
    }
    const content = fs.readFileSync(TEST_DATA_FILE_DELETE_CSV, 'utf-8');
    const rows = parseCsv(content);
    if (rows.length === 0) {
        return [];
    }

    const headers = rows[0].map(h => h.trim());
    const runIdx = headers.indexOf('Run');
    const emailIdx = headers.indexOf('Email');
    const testNameIdx = headers.indexOf('Test Name');
    const titleIdx = headers.indexOf('title');

    if (runIdx === -1 || emailIdx === -1 || testNameIdx === -1 || titleIdx === -1) {
        throw new Error('CSV headers must include "Run", "Email", "Test Name" and "title"');
    }

    const results = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < headers.length) {
            continue; // skip empty/malformed lines
        }
        
        const runVal = row[runIdx];
        const emailVal = row[emailIdx];
        const testNameVal = row[testNameIdx];

        if (runVal && runVal.trim().toLowerCase() === 'yes' &&
            emailVal.trim().toLowerCase() === email.trim().toLowerCase() &&
            testNameVal.trim() === testName.trim()) {
            results.push({
                Run: row[runIdx],
                Email: row[emailIdx],
                testName: row[testNameIdx],
                title: row[titleIdx]
            });
        }
    }
    return results;
}

/**
 * Retrieve active delete event data from CSV matching email and test name
 * @param {string} email 
 * @param {string} testName 
 * @returns {Object|null}
 */
function getDeleteEventData(email, testName) {
    const list = getAllDeleteEventData(email, testName);
    return list.length > 0 ? list[list.length - 1] : null;
}

/**
 * Retrieve booking test data from fixtures/booking_test_data.csv matching email and test name
 * @param {string} email 
 * @param {string} testName 
 * @returns {Object|null}
 */
function getBookingTestData(email, testName) {
    const filePath = path.join(__dirname, '..', 'fixtures', 'booking_test_data.csv');
    if (!fs.existsSync(filePath)) {
        throw new Error(`Booking test data CSV file does not exist at ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCsv(content);
    if (rows.length === 0) {
        return null;
    }

    const headers = rows[0].map(h => h.trim());
    const runIdx = headers.indexOf('Run');
    const emailIdx = headers.indexOf('Email');
    const testNameIdx = headers.indexOf('Test Name');
    const searchTermIdx = headers.indexOf('SearchTerm');
    const categoryIdx = headers.indexOf('Category');
    const categorySelectIdx = headers.indexOf('CategorySelect');
    const citySelectIdx = headers.indexOf('CitySelect');
    const eventNameIdx = headers.indexOf('EventName');
    const fullNameIdx = headers.indexOf('FullName');
    const customerEmailIdx = headers.indexOf('CustomerEmail');
    const phoneNumberIdx = headers.indexOf('PhoneNumber');

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < headers.length) {
            continue;
        }
        
        const runVal = row[runIdx] ? row[runIdx].trim().toLowerCase() : '';
        const emailVal = row[emailIdx] ? row[emailIdx].trim().toLowerCase() : '';
        const testNameVal = row[testNameIdx] ? row[testNameIdx].trim() : '';

        if (runVal === 'yes' && emailVal === email.trim().toLowerCase() && testNameVal === testName.trim()) {
            return {
                searchTerm: row[searchTermIdx],
                category: row[categoryIdx],
                categorySelect: row[categorySelectIdx],
                citySelect: row[citySelectIdx],
                eventName: row[eventNameIdx],
                fullName: row[fullNameIdx],
                customerEmail: row[customerEmailIdx],
                phoneNumber: row[phoneNumberIdx]
            };
        }
    }
    return null;
}

module.exports = {
    generateRandomEmail,
    generateRandomPassword,
    saveRegisteredUser,
    getRegisteredUsers,
    getLastRegisteredUser,
    getEventTestData,
    getAllEventTestData,
    saveDeleteEventData,
    getDeleteEventData,
    getAllDeleteEventData,
    getBookingTestData,
};
