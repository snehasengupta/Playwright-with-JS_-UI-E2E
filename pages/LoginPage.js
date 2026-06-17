const BasePage = require('./BasePage');
const locators = require('../locators/LoginPageLocators');

class LoginPage extends BasePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        super(page);
        this.emailInput = page.locator(locators.emailInput);
        this.passwordInput = page.locator(locators.passwordInput);
        this.loginButton = page.locator(locators.loginButton);
    }


    /**
     * Perform login action
     * @param {string} email 
     * @param {string} password 
     */
    async login(email, password) {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.loginButton.click();
    }
}

module.exports = LoginPage;
