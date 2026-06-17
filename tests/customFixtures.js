const base = require('@playwright/test');
const RegisterPage = require('../pages/RegisterPage');
const LoginPage = require('../pages/LoginPage');

const test = base.test.extend({
    registerPage: async ({ page }, use) => {
        const registerPage = new RegisterPage(page);
        await registerPage.navigate('/login');
        await registerPage.clickRegisterLink();
        await use(registerPage);
    },//setup for register test cases
    loginPage: async ({ page }, use) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate('/login');
        await use(loginPage);
    }
});

module.exports = { test, expect: base.expect };
