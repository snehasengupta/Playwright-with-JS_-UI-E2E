const BasePage = require('./BasePage');
const locators = require('../locators/LoginPageLocators');

class LoginPage extends BasePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        super(page);
        this.emailInput = page.getByRole('textbox', { name: locators.emailRoleName });
        this.passwordInput = page.getByRole('textbox', { name: locators.passwordRoleName });
        this.loginButton = page.getByRole('button', { name: locators.signInBtnRoleName });
    }

    /**
     * Perform login action
     * @param {string} email 
     * @param {string} password 
     */
    async login(email, password) {
        await this.emailInput.click();
        await this.emailInput.fill(email);
        await this.passwordInput.click();
        await this.passwordInput.fill(password);
        await this.loginButton.click();
    }

    get emailValidationError() {
        return this.page.getByText(locators.msgValidEmailRequired);
    }

    get passwordMinLengthError() {
        return this.page.getByText(locators.msgPasswordMinLength);
    }
}

module.exports = LoginPage;
