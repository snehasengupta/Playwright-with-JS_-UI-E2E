# Playwright E2E UI Automation Framework

This repository contains a robust, scalable, and maintainable **End-to-End (E2E) UI Automation Testing Framework** built with **Playwright** and **JavaScript** for the EventHub application.

---

## 🌟 Architecture & Design Patterns

### 1. Page Object Model (POM)
All UI components and interactions are encapsulated within Page Object classes located in the `pages/` directory (inheriting from [BasePage.js](file:///c:/Users/brist/OneDrive/Documents/PLAYWRIGHT_AUTOMATION/Playwright-with-JS_-UI-E2E/pages/BasePage.js)). Test specifications focus entirely on assertions, high-level business logic, and test step sequencing.

### 2. Centralized Locators
To maximize maintainability and reduce test flakiness, locator selector definitions and error validation messages are separated from page behavior and stored in the `locators/` directory.

### 3. Custom Playwright Fixtures
Page context management, pre-navigation hooks, and user authentication flows are handled via custom fixtures defined in [customFixtures.js](file:///c:/Users/brist/OneDrive/Documents/PLAYWRIGHT_AUTOMATION/Playwright-with-JS_-UI-E2E/utils/customFixtures.js):
- `registerPage`: Handles registration page setup and pre-navigation.
- `loginPage`: Handles login page setup and pre-navigation.
- `loggedInPage`: Automates the login workflow utilizing credentials stored in the CSV files. Reuses the authenticated state to speed up downstream tests.

### 4. Dynamic & Secure Test Data Management
Managed through [testDataHelper.js](file:///c:/Users/brist/OneDrive/Documents/PLAYWRIGHT_AUTOMATION/Playwright-with-JS_-UI-E2E/utils/testDataHelper.js):
- **CSV Data Driven Testing**: Reads and updates login credentials, event details, and booking scenarios dynamically from local files under `fixtures/`.
- **Security Isolation & Encryption**: Upon execution of registration scripts, plain text passwords in `registered_users.csv` are safely migrated to a local `.env` file, leaving a `STORED_IN_ENV` placeholder in the CSV to prevent credential leakage.
- **Run Execution Switch**: The `Run` column (accepts case-insensitive `yes` / `no`) in `registered_users.csv` acts as a master switch to toggle active testing users.
- **Dynamic CRUD Tracking**: Tracks admin actions (create, update, delete) dynamically by matching event titles in `admin_event_data.csv` and staging cleanup indices in `delete_event_data.csv`.

---

## 📁 Directory Structure

```
Playwright-with-JS_-UI-E2E/
├── fixtures/                      # Test data files (CSV format)
│   ├── admin_event_data.csv       # Event creation/modification details
│   ├── booking_test_data.csv      # Booking scenario inputs and assertions
│   ├── delete_event_data.csv      # Tracks items staged for deletions
│   └── registered_users.csv       # Credentials registry with Run execution switches
├── locators/                      # Element selectors mapping
│   ├── AdminLocators.js           # Locators for administrative flows
│   ├── BookingFormLocators.js     # Locators for registration/ticket purchase
│   ├── BrowseventPageLocators.js  # Locators for browsing and filtering events
│   ├── CommonLocators.js          # Shared global application locators
│   ├── LoginPageLocators.js       # Locators for login forms
│   └── RegisterPageLocators.js    # Locators for registration forms
├── pages/                         # Page Object Model (POM) page classes
│   ├── Adminpage.js               # Admin dashboard controls & creation
│   ├── BasePage.js                # Core page class containing global abstractions
│   ├── BookingFormPage.js         # Booking form interactions & validations
│   ├── BrowseventPage.js          # Event catalog browsing & selection
│   ├── LoginPage.js               # Login form actions
│   └── RegisterPage.js            # User registration actions
├── tests/                         # Playwright test specs
│   ├── e2eFlows/                  # Comprehensive business E2E scenarios
│   │   ├── Admine2e.spec.js       # Event creation, update, and deletion flow
│   │   └── BookEvente2e.js        # Searching, filtering, and booking flows
│   ├── Booking_form_validation.spec.js # Field validations, min/max tickets, pricing
│   ├── LoginScenarios.spec.js     # Success and failure authentication workflows
│   └── RegistrationScenarios.spec.js # Sign-up processes & validator checks
└── utils/                         # Global helper scripts & configuration
    ├── customFixtures.js          # Extends base Playwright tests with POM fixtures
    └── testDataHelper.js          # CSV parsers, environment manager, and generators
```

---

## 🚀 Getting Started

### 1. Prerequisite Installations
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

Clone the repository and install all required node modules:
```bash
npm install
```

Ensure Playwright browsers are installed:
```bash
npx playwright install
```

### 2. Configure Environment variables
A `.env` file will be auto-generated upon running registration tests, or you can create one in the root directory:
```env
# Example values (will be automatically filled by the framework)
USER_PASSWORD_1=YourSecurePassword
```

---

## 🏃 Running Tests

The test suites can be run via convenience npm scripts configured in `package.json`:

| Command | Description |
| :--- | :--- |
| `npm run test_registartion_e2e` | Run user registration tests (`RegistrationScenarios.spec.js`) in headed mode. |
| `npm run test_login_e2e` | Run authentication tests (`LoginScenarios.spec.js`) in headed mode. |
| `npm run test_booking_form_validation` | Run validation tests (`Booking_form_validation.spec.js`) in headed mode. |
| `npm run test_bookevent_e2e` | Run full ticket purchase flows (`BookEvente2e.js`) in headed mode. |
| `npm run test_admin_e2e` | Run event management CRUD flows (`Admine2e.spec.js`) in headed mode. |

Alternatively, you can run all tests using the Playwright CLI:
```bash
# Run all tests in headless mode
npx playwright test

# Run a specific spec file
npx playwright test tests/Booking_form_validation.spec.js

# Run tests in UI mode (interactive)
npx playwright test --ui
```

---

## 📊 Reporting & Debugging

### Interactive HTML Reports
After executing test suites, Playwright compiles a detailed, interactive HTML report highlighting test outcomes, execution durations, steps, screenshots on failure, and video recordings.

View the report using:
```bash
npx playwright show-report
```

> [!TIP]
> Test execution videos are stored locally under the `test-results/` directory, while test reports are generated inside `playwright-report/`.
