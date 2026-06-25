const { test, expect } = require('./customFixtures');
const { generateRandomEmail, generateRandomPassword, saveRegisteredUser, getLastRegisteredUser } = require('../utils/testDataHelper');

test.describe.serial('Registration Flow', () => {
    test('TC_001: Register a new user successfully', async ({ registerPage }) => {
        const email = generateRandomEmail();
        const password = generateRandomPassword();

        await registerPage.register(email, password);

        // Save credentials to fixtures/registered_users.csv for login tests
        saveRegisteredUser(email, password);

        await registerPage.logout();
    });

    test('TC_002: Register with existing user', async ({ registerPage }) => {
        // Re-use the last registered user to trigger "already registered" error
        const lastUser = getLastRegisteredUser();
        const email = lastUser ? lastUser.email : 'snehasengupta089@test.com';
        const password = lastUser ? lastUser.password : 'Sneha@1234';

        await registerPage.register(email, password);
        await expect(registerPage.duplicateEmailError).toBeVisible();
    });
});

test('TC_003: Missing email field in Register Form', async ({ registerPage }) => {
    const email = '';
    const password = generateRandomPassword();
    await registerPage.register(email, password);
    await expect(registerPage.emailValidationError).toBeVisible();
});

test('TC_004: Missing password field in Register Form', async ({ registerPage }) => {
    const email = generateRandomEmail();
    const password = '';
    await registerPage.register(email, password);
    await expect(registerPage.passwordRequirementsError).toBeVisible();
});

test('TC_005: Confirm password mismatch from register form', async ({ registerPage }) => {
    const email = generateRandomEmail();
    const password = generateRandomPassword();
    await registerPage.register(email, password, generateRandomPassword());
    await expect(registerPage.passwordsMismatchError).toBeVisible();
});
