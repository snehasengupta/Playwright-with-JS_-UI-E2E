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

    get bookingConfirmedHeading() {
        return this.page.getByRole('heading', { name: locators.bookingConfirmedHeading });
    }

    get bookingCardElement() {
        return this.page.locator(locators.bookingCardSelector);
    }

    async browseevent() {
        await this.page.getByRole('link', { name: locators.browseEventsBtnName }).click();
    }

    async selectEvent() {
        await this.page.getByRole('article')
            .filter({ hasText: locators.eventCardText })
            .getByTestId(locators.bookNowBtnTestId)
            .click();
    }

    async confirmQuantity() {
        await this.page.getByRole('button', { name: locators.plusBtnName }).click();
    }

    async enterCustomerDetails(fullName, email, phoneNumber) {
        await this.page.getByRole('textbox', { name: locators.fullNamePlaceholder }).click();
        await this.page.getByRole('textbox', { name: locators.fullNamePlaceholder }).fill(fullName);
        await this.page.getByTestId(locators.customerEmailTestId).click();
        await this.page.getByTestId(locators.customerEmailTestId).fill(email);
        await this.page.getByRole('textbox', { name: locators.phoneNumberPlaceholder }).click();
        await this.page.getByRole('textbox', { name: locators.phoneNumberPlaceholder }).fill(phoneNumber);
    }

    async confirmBooking() {
        await this.page.getByRole('button', { name: locators.confirmBookingBtnName }).click();
    }

    async capturebookingref() {
        return (await this.page.locator(locators.bookingRefSelector).first().textContent()).trim();
    }

    async mybooking() {
        await this.page.getByTestId(locators.myBookingsNavTestId).click();
    }


    bookingRefByValue(ref) {
        return this.page.getByText(ref, { exact: true });
    }

}

module.exports = BrowseEventPage;