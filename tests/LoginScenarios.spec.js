const { test, expect } = require('./customFixtures');
const { getLastRegisteredUser } = require('../utils/testDataHelper');
const BrowseEventPage = require('../pages/BrowseventPage');

test.describe('Login Flow', () => {
    test('TC_006: Valid Login Scenario', async ({ loginPage, page }) => {
        const lastUser = getLastRegisteredUser();

        // Fail clearly if no users exist in registered_users.csv
        if (!lastUser) {
            throw new Error('No registered users found in fixtures/registered_users.csv. Please run registration tests first!');
        }

        // Perform login action
        await loginPage.login(lastUser.email, lastUser.password);

        // Instantiate BrowseEventPage manually since fixture was renamed
        const browseEventPage = new BrowseEventPage(page);

        // Assert that the landing page featured events heading is visible
        await expect(browseEventPage.featuredEventsHeading).toBeVisible();
    });

    test('TC_007: Login with invalid email format', async ({ loginPage }) => {
        await loginPage.login('invalidemail', 'Password123');
        await expect(loginPage.emailValidationError).toBeVisible();
    });

    test('TC_008: Login with short password', async ({ loginPage }) => {
        await loginPage.login('invalidemail123@test.com', '12345');
        await expect(loginPage.passwordMinLengthError).toBeVisible();
    });

    test('TC_009: Login with unregistered credentials', async ({ loginPage, page }) => {
        await loginPage.login('unregistered_user_999@test.com', 'ValidPassword123');

        // Instantiate BrowseEventPage manually since fixture was renamed
        const browseEventPage = new BrowseEventPage(page);

        await expect(browseEventPage.featuredEventsHeading).not.toBeVisible();
    });
});
