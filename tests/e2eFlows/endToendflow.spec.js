const { test, expect } = require('../customFixtures');
const BrowseEventPage = require('../../pages/BrowseventPage');

test.describe('E2E Event Booking Flow', () => {
    test('TC_01: End to End journey', async ({ loggedInPage }) => {
        // Instantiate BrowseEventPage using the authenticated page returned by the fixture
        const browseEventPage = new BrowseEventPage(loggedInPage);

        // Click on the Browse Events link
        await browseEventPage.browseevent();
        await loggedInPage.waitForLoadState('domcontentloaded');

        // Select an event (assuming the method handles the card filtering and click)
        await browseEventPage.selectEvent();

        // Confirm quantity (e.g., increase by 1)
        await browseEventPage.confirmQuantity();

        // Enter customer details
        await browseEventPage.enterCustomerDetails('test test', 'test@test.com', '8910883979');

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
});
