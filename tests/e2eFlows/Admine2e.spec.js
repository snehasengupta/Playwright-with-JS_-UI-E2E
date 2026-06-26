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
const updateDataList = getAllEventTestData(lastUser.email, 'TC_003:Update Event');

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

    updateDataList.forEach((updateData, index) => {
        test(`TC_003:Update Event - Run ${index + 1}: ${updateData.title}`, async ({ loggedInPage }) => {
            const adminPage = new AdminPage(loggedInPage);

            // Navigate to the admin panel
            await adminPage.goToAdminSection();

            // Ensure event is visible in table
            await expect(adminPage.getEventCell(updateData.title)).toBeVisible();
            
            // Update event price using POM method
            await adminPage.updateEventPrice(updateData.title, updateData.price);
            
            // Verify successful event update using POM property
            await expect(adminPage.eventUpdatedMessage).toBeVisible();
        });
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
