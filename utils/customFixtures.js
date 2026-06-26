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
    }
});

module.exports = { test, expect: base.expect };
