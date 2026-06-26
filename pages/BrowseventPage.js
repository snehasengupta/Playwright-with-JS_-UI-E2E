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
        return this.page.getByTestId(locators.bookingCardTestId);
    }

    get searchInput() {
        return this.page.getByRole('textbox', { name: locators.searchBarPlaceholder });
    }

    get eventCard() {
        return this.page.getByTestId(locators.eventCardTestId);
    }

    get bookNowBtn() {
        return this.page.getByTestId(locators.bookNowBtnTestId);
    }

    eventCardText(text) {
        return this.page.getByText(text);
    }

    get confirmedStatus() {
        return this.page.getByText('confirmed');
    }

    get categoryDropdown() {
        return this.page.getByRole('combobox').first();
    }

    get cityDropdown() {
        return this.page.getByRole('combobox').nth(1);
    }

    async selectCategory(category) {
        await this.categoryDropdown.selectOption(category);
    }

    async selectCity(city) {
        await this.cityDropdown.selectOption(city);
    }

    async searchEvent(eventName) {
        await this.searchInput.click();
        await this.searchInput.fill(eventName);
    }

    async browseevent() {
        await this.page.getByRole('link', { name: locators.browseEventsBtnName }).click();
    }

    async selectEvent(eventText) {
        const filterText = eventText || locators.eventCardText;
        await this.page.getByRole('article')
            .filter({ hasText: filterText })
            .getByTestId(locators.bookNowBtnTestId)
            .click();
    }

    async confirmQuantity() {
        const plusButton = this.page.getByRole('button', { name: locators.plusBtnName });
        if (await plusButton.isEnabled()) {
            await plusButton.click();
        }
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


    get cancelButtons() {
        return this.page.getByRole('button', { name: 'Cancel Booking' });
    }

    bookingRefByValue(ref) {
        return this.page.getByText(ref, { exact: true });
    }

}

module.exports = BrowseEventPage;