const locators = require('../locators/CommonLocators');

class BasePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    /**
     * Navigates to a specific path using Playwright's baseURL
     * @param {string} path
     */
    async navigate(path) {
        await this.page.goto(path);
    }

    async logout() {
        await this.page.getByTestId(locators.logoutBtnTestId).click();
    }
}

module.exports = BasePage;
