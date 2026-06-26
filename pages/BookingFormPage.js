const BasePage = require('./BasePage');
const locators = require('../locators/BookingFormLocators');

class BookingFormPage extends BasePage {
    constructor(page) {
        super(page);
    }

    get ticketCountElement() {
        return this.page.locator(locators.ticketCountSelector);
    }

    get plusBtn() {
        return this.page.getByRole('button', { name: locators.plusBtnName });
    }

    get minusBtn() {
        return this.page.getByRole('button', { name: locators.minusBtnName });
    }

    get maxTicketsElement() {
        return this.page.getByText(locators.maxTicketsText);
    }

    get formElement() {
        return this.page.locator(locators.formSelector);
    }

    get fullNameInput() {
        return this.page.getByRole('textbox', { name: locators.fullNamePlaceholder });
    }

    get customerEmailInput() {
        return this.page.getByTestId(locators.customerEmailTestId);
    }

    get phoneNumberInput() {
        return this.page.getByRole('textbox', { name: locators.phoneNumberPlaceholder });
    }

    get blurArea() {
        return this.page.getByText(locators.blurAreaText);
    }

    get tickets2Element() {
        return this.page.getByText(locators.tickets2Text);
    }

    get tickets3Element() {
        return this.page.getByText(locators.tickets3Text);
    }

    get priceElement() {
        return this.page.getByText(locators.priceText).nth(locators.priceIndex);
    }

    get confirmBookingBtn() {
        return this.page.getByRole('button', { name: locators.confirmBookingBtnName });
    }

    get emailErrorElement() {
        return this.page.getByText(locators.emailErrorText);
    }

    get phoneErrorElement() {
        return this.page.getByText(locators.phoneErrorText);
    }

    get nameErrorElement() {
        return this.page.getByText(locators.nameErrorText);
    }

    // Actions
    async getTicketCount() {
        const text = await this.ticketCountElement.textContent();
        return parseInt(text.trim(), 10);
    }

    async incrementToMax(max = 8) {
        while (true) {
            const count = await this.getTicketCount();
            if (count === max) {
                break;
            }
            await this.plusBtn.click();
        }
    }

    async decrementToMin(min = 1) {
        while (true) {
            const count = await this.getTicketCount();
            if (count === min) {
                break;
            }
            await this.minusBtn.click();
        }
    }

    async fillFullName(name) {
        await this.fullNameInput.click();
        await this.fullNameInput.fill(name);
    }

    async fillEmail(email) {
        await this.customerEmailInput.fill(email);
    }

    async fillPhoneNumber(phone) {
        await this.phoneNumberInput.click();
        await this.phoneNumberInput.fill(phone);
    }

    async triggerBlur() {
        await this.blurArea.click();
    }

    async incrementByOne() {
        await this.plusBtn.click();
    }

    async confirmBooking() {
        await this.confirmBookingBtn.click();
    }
}

module.exports = BookingFormPage;
