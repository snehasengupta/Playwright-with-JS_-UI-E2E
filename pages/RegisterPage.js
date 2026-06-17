const BasePage = require('./BasePage');
const locators = require('../locators/RegisterPageLocators');

class RegisterPage extends BasePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        super(page);
    }


    async clickRegisterLink() {
        await this.page.getByRole('link', { name: locators.registerLinkName }).click();
    }

    async register(email, password, confirmPassword = password) {
        await this.page.getByTestId(locators.emailTestId).click();
        await this.page.getByTestId(locators.emailTestId).fill(email);
        await this.page.getByTestId(locators.passwordTestId).click();
        await this.page.getByTestId(locators.passwordTestId).fill(password);
        await this.page.getByRole('textbox', { name: locators.confirmPasswordRoleName }).click();
        await this.page.getByRole('textbox', { name: locators.confirmPasswordRoleName }).fill(confirmPassword);
        await this.page.getByTestId(locators.registerBtnTestId).click();
    }

    // Error element getters for spec file assertions
    get duplicateEmailError() {
        return this.page.getByText(locators.msgEmailRegistered);
    }

    get emailValidationError() {
        return this.page.getByText(locators.msgValidEmailRequired);
    }

    get passwordRequirementsError() {
        return this.page.getByText(locators.msgPasswordRequirements);
    }

    get passwordsMismatchError() {
        return this.page.getByText(locators.msgPasswordsMismatch);
    }
}

module.exports = RegisterPage;