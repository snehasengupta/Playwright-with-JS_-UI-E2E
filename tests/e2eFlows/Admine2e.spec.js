const { test, expect } = require('../../utils/customFixtures');
const AdminPage = require('../../pages/Adminpage');
const { getLastRegisteredUser, getAllEventTestData, saveDeleteEventData, getAllDeleteEventData } = require('../../utils/testDataHelper');
const fs = require('fs');
const path = require('path');

// Clean delete_event_data.csv at startup to ensure a fresh test run
const deleteCsvPath = path.join(__dirname, '..', '..', 'fixtures', 'delete_event_data.csv');
if (fs.existsSync(deleteCsvPath)) {
    try {
        fs.unlinkSync(deleteCsvPath);
    } catch (e) {
        console.error('Failed to unlink delete_event_data.csv:', e);
    }
}

const lastUser = getLastRegisteredUser();
if (!lastUser) {
    throw new Error('No registered active users found in CSV.');
}

// Get all matching test data rows for this test name
const eventDataList = getAllEventTestData(lastUser.email, 'TC_001:Create New Event');

test.describe('Admin Event Management', () => {
    eventDataList.forEach((eventData, index) => {
        test(`TC_001:Create New Event - Run ${index + 1}: ${eventData.title}`, async ({ loggedInPage }) => {
            const adminPage = new AdminPage(loggedInPage);

            // Navigate to the admin panel
            await adminPage.goToAdminSection();

            // Populate fields and click submit using CSV data
            await adminPage.createEvent(eventData);

            // Verify successful event creation
            await expect(adminPage.eventCreatedMessage).toBeVisible();
            await expect(adminPage.getEventCell(eventData.title)).toBeVisible();

            // Store the created event details in CSV for the Delete test case (TC_002)
            saveDeleteEventData(lastUser.email, 'TC_002:Delete Event', eventData.title);
        });
    });

    test('TC_003:Update Event', async ({ loggedInPage }) => {
        const adminPage = new AdminPage(loggedInPage);

        // Navigate to the admin panel
        await adminPage.goToAdminSection();

        // Ensure Arijit event is visible in table
        await expect(loggedInPage.locator('tbody')).toContainText('Arijit Singh in Sing');
        
        // Target the edit button specifically for 'Arijit Singh in Sing' to avoid strict mode violations
        await loggedInPage.getByRole('row', { name: 'Arijit Singh in Sing' }).getByTestId('edit-event-btn').click();
        
        await loggedInPage.getByRole('spinbutton', { name: 'Price ($)*' }).click();
        await loggedInPage.getByRole('spinbutton', { name: 'Price ($)*' }).fill('2000');
        await loggedInPage.getByTestId('add-event-btn').click();
        await expect(loggedInPage.getByText('Event updated!')).toBeVisible();
    });

    test('TC_002:Delete Event', async ({ loggedInPage }, testInfo) => {
        // Read the delete CSV dynamically at execution time to get fresh rows appended by TC_001
        const deleteDataList = getAllDeleteEventData(lastUser.email, testInfo.title);
        if (deleteDataList.length === 0) {
            console.log(`Skipping ${testInfo.title}: No active event deletion rows found in CSV.`);
            test.skip();
            return;
        }

        const adminPage = new AdminPage(loggedInPage);

        // Go to Admin Manage Events section
        await adminPage.goToAdminSection();

        // Loop over and delete all active events matching the criteria
        for (const deleteData of deleteDataList) {
            console.log(`Deleting event: "${deleteData.title}"`);
            await adminPage.deleteEvent(deleteData.title);

            // Assert successful deletion (use .first() to avoid strict mode violations from overlapping toast messages)
            await expect(adminPage.eventDeletedMessage.first()).toBeVisible();
            await expect(adminPage.getEventCell(deleteData.title)).not.toBeVisible();
        }
    });
});
