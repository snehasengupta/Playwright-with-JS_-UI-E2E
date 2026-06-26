const { test, expect } = require('../../utils/customFixtures');
const BrowseEventPage = require('../../pages/BrowseventPage');
const { getLastRegisteredUser, getBookingTestData } = require('../../utils/testDataHelper');

const lastUser = getLastRegisteredUser();
if (!lastUser) {
    throw new Error('No registered active users found in CSV. Please run registration/login tests first!');
}

test.describe('E2E Event Booking Flow', () => {
    test('TC_01: End to End journey from banner', { tag: '@endtoend' }, async ({ loggedInPage }) => {
        const testData = getBookingTestData(lastUser.email, 'TC_01: End to End journey from banner');
        if (!testData) {
            test.skip();
            return;
        }

        const browseEventPage = new BrowseEventPage(loggedInPage);

        // Click on the Browse Events link
        await browseEventPage.browseevent();
        await loggedInPage.waitForLoadState('domcontentloaded');

        // Select an event (assuming the method handles the card filtering and click)
        await browseEventPage.selectEvent();

        // Confirm quantity (e.g., increase by 1)
        await browseEventPage.confirmQuantity();

        // Enter customer details from CSV
        await browseEventPage.enterCustomerDetails(testData.fullName, testData.customerEmail, testData.phoneNumber);

        // Confirm booking
        await browseEventPage.confirmBooking();

        // Verify booking confirmation heading
        await expect(browseEventPage.bookingConfirmedHeading).toBeVisible();

        await browseEventPage.mybooking();

        const bookingRef = await browseEventPage.capturebookingref();

        await browseEventPage.mybooking();
        await loggedInPage.waitForLoadState('domcontentloaded');

        // confirm the booking landed in the list
        await expect(browseEventPage.bookingRefByValue(bookingRef)).toHaveCount(1);
    });

    test('TC_02: E2E journey from search event ', { tag: '@endtoend' }, async ({ loggedInPage }) => {
        const testData = getBookingTestData(lastUser.email, 'TC_02: E2E journey from search event ');
        if (!testData) {
            test.skip();
            return;
        }

        const browseEventPage = new BrowseEventPage(loggedInPage);

        // Go to events page
        await browseEventPage.browseevent();
        await loggedInPage.waitForLoadState('domcontentloaded');

        // Search for the event from CSV
        await browseEventPage.searchEvent(testData.searchTerm);

        // Verify event card and booking button are visible
        await expect(browseEventPage.eventCard.getByText('Sports')).toBeVisible();
        await expect(browseEventPage.eventCardText(`${testData.eventName}Fri, 23 OctSAI,`)).toBeVisible();
        await expect(browseEventPage.bookNowBtn).toBeVisible();

        // Select the event
        await browseEventPage.selectEvent(testData.eventName);

        // Enter customer details from CSV
        await browseEventPage.enterCustomerDetails(testData.fullName, testData.customerEmail, testData.phoneNumber);

        // Confirm booking
        await browseEventPage.confirmBooking();

        // Verify booking confirmation heading
        await expect(browseEventPage.bookingConfirmedHeading).toBeVisible();

        // Capture dynamic booking reference
        const bookingRef = await browseEventPage.capturebookingref();

        // Go to bookings page
        await browseEventPage.mybooking();
        await loggedInPage.waitForLoadState('domcontentloaded');

        // Confirm the booking landed in the list with correct details
        await expect(browseEventPage.bookingCardElement.first()).toBeVisible();
        await expect(browseEventPage.bookingRefByValue(bookingRef)).toBeVisible();
        await expect(browseEventPage.confirmedStatus.first()).toBeVisible();
        await expect(loggedInPage.getByRole('main')).toContainText(testData.eventName);
    });

    test('TC_03: E2E journey from category filter and city filer', { tag: '@endtoend' }, async ({ loggedInPage }) => {
        const testData = getBookingTestData(lastUser.email, 'TC_03: E2E journey from category filter and city filer');
        if (!testData) {
            test.skip();
            return;
        }

        const browseEventPage = new BrowseEventPage(loggedInPage);

        // Go directly to sports category page from CSV
        await browseEventPage.navigate(`/events?category=${testData.category}`);

        // Select category from CSV
        await browseEventPage.selectCategory(testData.categorySelect);
        await loggedInPage.waitForLoadState('domcontentloaded');

        // Select city from CSV
        await browseEventPage.selectCity(testData.citySelect);
        await loggedInPage.waitForLoadState('domcontentloaded');

        // Verify the filtered event is visible
        await expect(browseEventPage.eventCard.first()).toBeVisible();
        await expect(browseEventPage.eventCardText(`${testData.eventName}Thu, 22 OctMumbai`)).toBeVisible();
        await expect(browseEventPage.eventCardText(testData.eventName)).toBeVisible();
        await expect(browseEventPage.bookNowBtn).toBeVisible();

        // Select event
        await browseEventPage.selectEvent(testData.eventName);

        // Increase quantity by 1
        await browseEventPage.confirmQuantity();

        // Enter customer details from CSV
        await browseEventPage.enterCustomerDetails(testData.fullName, testData.customerEmail, testData.phoneNumber);

        // Confirm booking
        await browseEventPage.confirmBooking();

        // Verify booking confirmation heading
        await expect(browseEventPage.bookingConfirmedHeading).toBeVisible();

        // Capture dynamic booking reference
        const bookingRef = await browseEventPage.capturebookingref();

        // Go to bookings page
        await browseEventPage.mybooking();
        await loggedInPage.waitForLoadState('domcontentloaded');

        // Confirm the booking landed in the list with correct details
        await expect(browseEventPage.bookingCardElement.first()).toBeVisible();
        await expect(browseEventPage.bookingRefByValue(bookingRef)).toBeVisible();
        await expect(browseEventPage.confirmedStatus.first()).toBeVisible();
        await expect(loggedInPage.getByRole('main')).toContainText(testData.eventName);
    });

    test.afterEach(async ({ loggedInPage }) => {
        const browseEventPage = new BrowseEventPage(loggedInPage);

        // 1. Go to the My Bookings tab
        await browseEventPage.mybooking();
        await loggedInPage.waitForLoadState('domcontentloaded');

        // 2. Keep cancelling until none remain
        let count = await browseEventPage.cancelButtons.count();
        while (count > 0) {
            // Always click the first — the list re-renders after each cancel
            await browseEventPage.cancelButtons.first().click();

            // Handle the confirmation modal: click "Yes, cancel it"
            await browseEventPage.page.getByRole('button', { name: 'Yes, cancel it' }).click();

            // Wait for the DOM to drop one card before looping
            await expect(browseEventPage.cancelButtons).toHaveCount(count - 1);
            count = await browseEventPage.cancelButtons.count();
        }

        // 3. Logout once no cancel button/card left
        await browseEventPage.logout();
    });
});

