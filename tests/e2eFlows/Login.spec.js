const { test, expect } = require('../customFixtures');
const { getRegisteredUsers } = require('../../utils/testDataHelper');
const BrowseEventPage = require('../../pages/BrowseventPage');

test.describe('Login Flow', () => {
    test('TC_006: Valid Login Scenario', async ({ loginPage, page }) => {
        const users = getRegisteredUsers();
        // Pick the first registered user
        const firstUser = users[0];

        // Fail clearly if no users exist in registered_users.json
        if (!firstUser) {
            throw new Error('No registered users found in fixtures/registered_users.json. Please run registration tests first!');
        }

        // Perform login action
        await loginPage.login(firstUser.email, firstUser.password);

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
