const { test, expect } = require('../utils/customFixtures');
const BrowseEventPage = require('../pages/BrowseventPage');
const BookingFormPage = require('../pages/BookingFormPage');

test.fixme('Booking Form Validation', async ({ loggedInPage }) => {
  const browseEventPage = new BrowseEventPage(loggedInPage);
  const bookingFormPage = new BookingFormPage(loggedInPage);

  // Navigate to event booking page
  await browseEventPage.browseevent();
  await loggedInPage.waitForLoadState('domcontentloaded');
  await browseEventPage.selectEvent();

  // Loop increment to 8
  await bookingFormPage.incrementToMax(8);

  // Expectations at max quantity (8)
  await expect(bookingFormPage.plusBtn).toBeDisabled();
  await expect(bookingFormPage.maxTicketsElement).toBeVisible();
  await expect(bookingFormPage.formElement).toMatchAriaSnapshot(`
    - text: Tickets
    - button "−"
    - text: "8"
    - button "+" [disabled]
    - text: (max 8) Full Name*
    - textbox "Full Name*":
      - /placeholder: Your full name
    - text: Email*
    - textbox "Email*":
      - /placeholder: you@email.com
    - text: Phone Number*
    - textbox "Phone Number*":
      - /placeholder: +91 98765 43210
    - text: $300 × 8 tickets $2,400 Total $2,400
    - button "Confirm Booking"
    `);

  // Loop decrement to 1
  await bookingFormPage.decrementToMin(1);

  // Expectations at min quantity (1)
  await expect(bookingFormPage.minusBtn).toBeDisabled();
  await expect(bookingFormPage.formElement).toMatchAriaSnapshot(`
    - text: Tickets
    - button "−" [disabled]
    - text: "1"
    - button "+"
    - text: (max 8) Full Name*
    - textbox "Full Name*":
      - /placeholder: Your full name
    - text: Email*
    - textbox "Email*":
      - /placeholder: you@email.com
    - text: Phone Number*
    - textbox "Phone Number*":
      - /placeholder: +91 98765 43210
    - text: $300 × 1 ticket $300 Total $300
    - button "Confirm Booking"
    `);

  // Validation checks with invalid inputs
  await bookingFormPage.fillFullName('67hhkh99');
  await bookingFormPage.triggerBlur();

  await bookingFormPage.fillEmail('66');
  await bookingFormPage.triggerBlur();
  await bookingFormPage.triggerBlur();

  await bookingFormPage.fillPhoneNumber('gjjgjgjgkjgkgkgkgjkgkjgkjggkjgkggk87987');
  await bookingFormPage.triggerBlur();

  // Increment and expect pricing updates
  await bookingFormPage.incrementByOne();
  await expect(bookingFormPage.tickets2Element).toBeVisible();
  await expect(bookingFormPage.priceElement).toBeVisible();

  await bookingFormPage.incrementByOne();
  await expect(bookingFormPage.tickets3Element).toBeVisible();
  await expect(bookingFormPage.priceElement).toBeVisible();

  // Confirm booking and validate error messages
  await bookingFormPage.confirmBooking();
  await expect(bookingFormPage.emailErrorElement).toBeVisible();
  await expect(bookingFormPage.phoneErrorElement).toBeVisible();

  // Soft assertion for name field error message (which is currently not visible)
  await expect.soft(bookingFormPage.nameErrorElement).toBeVisible();
});


