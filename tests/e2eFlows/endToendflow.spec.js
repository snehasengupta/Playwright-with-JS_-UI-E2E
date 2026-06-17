const { test, expect } = require('../customFixtures');
const BrowseEventPage = require('../../pages/BrowseventPage');

test.describe('E2E Event Booking Flow', () => {
    test('TC_01: End to End journey', async ({ loggedInPage }) => {
        // Instantiate BrowseEventPage using the authenticated page returned by the fixture
        const browseEventPage = new BrowseEventPage(loggedInPage);

        // Click on the Browse Events link
        await browseEventPage.browseevent();

    });
});
