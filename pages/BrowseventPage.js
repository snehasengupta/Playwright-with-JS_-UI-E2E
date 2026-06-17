const BasePage = require('./BasePage');
const locators = require('../locators/BrowseventPageLocators');

class BrowseEventPage extends BasePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        super(page);
    }

    get featuredEventsHeading() {
        return this.page.getByRole('heading', { name: locators.featuredEventsHeading });
    }

    async browseevent() {
        await this.page.getByRole('link', { name: locators.browseEventsBtnName }).click();
    }

}

module.exports = BrowseEventPage;