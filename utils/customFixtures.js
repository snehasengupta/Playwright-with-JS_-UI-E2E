const base = require('@playwright/test');
const RegisterPage = require('../pages/RegisterPage');
const LoginPage = require('../pages/LoginPage');

/**
 * @typedef {Object} CustomFixtures
 * @property {RegisterPage} registerPage
 * @property {LoginPage} loginPage
 * @property {import('@playwright/test').Page} loggedInPage
 */

/** @type {import('@playwright/test').TestType<CustomFixtures, {}>} */
const test = base.test.extend({
    registerPage: async ({ page }, use) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate('/login');
        await registerPage.clickRegisterLink();
        await use(registerPage);
    },
    loginPage: async ({ page }, use) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate('/login');
        await use(loginPage);
    },
    loggedInPage: async ({ page, loginPage }, use) => {
        const { getLastRegisteredUser } = require('../utils/testDataHelper');
        const lastUser = getLastRegisteredUser();
        if (!lastUser) {
            throw new Error('No registered users found in fixtures/registered_users.csv. Please run registration tests first!');
        }
        await loginPage.login(lastUser.email, lastUser.password);
        await use(page);
    },
    autoLogsAndScreenshots: [async ({ page }, use, testInfo) => {
        const consoleLogs = [];
        const pageErrors = [];

        const consoleListener = (msg) => {
            consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
        };
        const errorListener = (err) => {
            pageErrors.push(err.stack || err.message);
        };

        page.on('console', consoleListener);
        page.on('pageerror', errorListener);

        try {
            await use();
        } finally {
            // Clean up event listeners
            page.off('console', consoleListener);
            page.off('pageerror', errorListener);

            const isFailed = testInfo.status !== testInfo.expectedStatus;

            // If the test failed, attach logs and a page screenshot (snapshot)
            if (isFailed) {
                const logs = [];
                
                logs.push('=== Playwright Test Failure Reason ===');
                if (testInfo.errors && testInfo.errors.length > 0) {
                    testInfo.errors.forEach((err, index) => {
                        logs.push(`Error ${index + 1}: ${err.message || err}`);
                        if (err.stack) {
                            logs.push(err.stack);
                        }
                    });
                } else {
                    logs.push('No test runner errors captured.');
                }

                if (pageErrors.length > 0) {
                    logs.push('\n=== Browser Page Errors ===');
                    logs.push(pageErrors.join('\n'));
                }

                if (consoleLogs.length > 0) {
                    logs.push('\n=== Browser Console Logs ===');
                    logs.push(consoleLogs.join('\n'));
                }

                await testInfo.attach('failure-reason-and-logs', {
                    body: logs.join('\n'),
                    contentType: 'text/plain'
                });

                // Attach snapshot if available (take screenshot)
                try {
                    const screenshot = await page.screenshot({ fullPage: true });
                    await testInfo.attach('failure-screenshot', {
                        body: screenshot,
                        contentType: 'image/png'
                    });
                } catch (e) {
                    console.error('Failed to capture failure screenshot/snapshot:', e);
                }
            }
        }
    }, { auto: true }]
});

module.exports = { test, expect: base.expect };
