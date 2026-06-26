const BasePage = require('./BasePage');
const locators = require('../locators/AdminLocators');

class AdminPage extends BasePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        super(page);
        this.adminButton = page.getByRole('button', { name: locators.adminButtonName });
        this.manageEventsLink = page.getByRole('navigation').getByRole('link', { name: locators.manageEventsLinkName });
        this.eventTitleInput = page.getByTestId(locators.eventTitleInputTestId);
        this.eventDescriptionInput = page.getByRole('textbox', { name: locators.eventDescriptionRoleName });
        this.categorySelect = page.getByLabel(locators.categoryLabel);
        this.cityInput = page.getByRole('textbox', { name: locators.cityRoleName });
        this.venueInput = page.getByRole('textbox', { name: locators.venueRoleName });
        this.priceInput = page.getByRole('spinbutton', { name: locators.priceRoleName });
        this.dateTimeInput = page.getByRole('textbox', { name: locators.dateTimeRoleName });
        this.seatsInput = page.getByRole('spinbutton', { name: locators.seatsRoleName });
        this.addEventButton = page.getByTestId(locators.addEventBtnTestId);
        this.confirmDialogYesButton = page.getByTestId(locators.confirmDialogYesTestId);
    }

    async goToAdminSection() {
        await this.adminButton.click();
        await this.manageEventsLink.click();
    }

    async createEvent(eventDetails) {
        const { title, description, category, city, venue, price, dateTime, seats } = eventDetails;

        await this.eventTitleInput.click();
        await this.eventTitleInput.fill(title);

        await this.eventDescriptionInput.click();
        await this.eventDescriptionInput.fill(description);

        await this.categorySelect.selectOption(category);

        await this.cityInput.click();
        await this.cityInput.fill(city);

        await this.venueInput.click();
        await this.venueInput.fill(venue);

        await this.priceInput.click();
        await this.priceInput.fill(price);

        await this.dateTimeInput.click();
        await this.dateTimeInput.press('ArrowRight');
        await this.dateTimeInput.fill(dateTime);

        await this.seatsInput.click();
        await this.seatsInput.fill(seats);

        await this.addEventButton.click();
    }

    get eventCreatedMessage() {
        return this.page.getByText(locators.msgEventCreated);
    }

    getEventCell(title) {
        return this.page.getByRole('cell', { name: title });
    }

    async deleteEvent(title) {
        const row = this.page.getByRole('row', { name: title });
        await row.getByTestId('delete-event-btn').click();
        await this.confirmDialogYesButton.click();
    }

    get eventDeletedMessage() {
        return this.page.getByText(locators.msgEventDeleted);
    }

    async updateEventPrice(title, newPrice) {
        const row = this.page.getByRole('row', { name: title });
        await row.getByTestId(locators.editEventBtnTestId).click();
        await this.priceInput.click();
        await this.priceInput.fill(String(newPrice));
        await this.addEventButton.click();
    }

    get eventUpdatedMessage() {
        return this.page.getByText(locators.msgEventUpdated);
    }

    get newEventContainer() {
        return this.page.locator('div').filter({ hasText: locators.newEventContainerText }).first();
    }

    get totalEventsElement() {
        return this.page.getByText(locators.totalEventsText);
    }

    get limitTextElement() {
        return this.page.getByText(locators.limitText);
    }

    get limitErrorElement() {
        return this.page.getByText(locators.limitErrorText);
    }

    async clickNewEventContainer() {
        await this.newEventContainer.click();
    }

    async clickTotalEvents() {
        await this.totalEventsElement.click();
    }

    async clickLimitText() {
        await this.limitTextElement.click();
    }
}

module.exports = AdminPage;
