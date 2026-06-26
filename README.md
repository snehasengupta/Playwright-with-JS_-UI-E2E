# Playwright E2E UI Automation Framework

This repository contains a robust, scalable End-to-End (E2E) UI automation testing framework built with **Playwright** and **JavaScript** for the EventHub application.

---

## 🌟 Key Architecture & Design Patterns

### 1. Page Object Model (POM)
All UI interactions are abstracted within Page Object classes located in the `pages/` directory (extending `BasePage.js`). Spec files focus solely on assertions and high-level workflows.

### 2. Centralized Locators
To improve maintainability, selector values and validation messages are separated from page objects and stored in the `locators/` directory.

### 3. Custom Playwright Fixtures
Page context setup, pre-navigation, and authentication states are automated using custom fixtures defined in `tests/customFixtures.js`. 
- `registerPage`: Handles registration page pre-navigation.
- `loginPage`: Handles login page pre-navigation.
- `loggedInPage`: Reuses stored credentials to pre-authenticate the browser session, keeping tests focused and fast.

### 4. Dynamic & Secure Test Data Management (`utils/testDataHelper.js`)
- **CSV Data Driven Testing**: The framework reads and writes credentials and test data using local CSV files under `fixtures/`.
- **Security Isolation**: On execution, raw passwords registered by the framework are securely migrated from `registered_users.csv` to a local `.env` file, leaving a `STORED_IN_ENV` placeholder in the CSV.
- **Master Switch (`Run` column)**: The `Run` column (case-insensitive `yes` / `no`) in `registered_users.csv` serves as a master switch. The framework dynamically selects the last registered active user having `Run` set to `yes` for authentication fixtures.
- **Admin & Event Tracking**: Creates, updates, and deletes events dynamically by reading data rows from `admin_event_data.csv` and managing deletion targets via `delete_event_data.csv`.

---

## 📁 Directory Structure

```
├── fixtures/               # Test data CSV tables
│   ├── registered_users.csv# Registered credentials & Run master switch
│   ├── admin_event_data.csv# Input details for creating and updating events
│   └── delete_event_data.csv# Tracks events registered for deletion
├── locators/               # Centralized locator definitions
├── pages/                  # Page Object Model (POM) classes
├── tests/                  # Test suites
│   ├── e2eFlows/           # E2E business flow specs
│   │   ├── Admine2e.spec.js# Admin panel creation/update/delete flow
│   │   └── BookEvente2e.js # Event browsing and ticket booking flow
│   ├── LoginScenarios.spec.js # User authentication specs
│   └── RegistrationScenarios.spec.js # User signup & validation specs
└── utils/                  # Global helper scripts & CSV parsers
```

---

## 🚀 Getting Started

### 1. Install Dependencies
Ensure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
npm install
```

### 2. Run Test Suites
You can run all tests or execute specific specs in headed or headless mode:

- **Run All Tests**:
  ```bash
  npx playwright test
  ```

- **Run Registration Scenarios**:
  ```bash
  npx playwright test tests/RegistrationScenarios.spec.js --headed
  ```

- **Run Login Scenarios**:
  ```bash
  npx playwright test tests/LoginScenarios.spec.js --headed
  ```

- **Run Admin Event Management Flow**:
  ```bash
  npx playwright test tests/e2eFlows/Admine2e.spec.js --headed
  ```

- **Run Booking E2E Journey**:
  ```bash
  npx playwright test tests/e2eFlows/BookEvente2e.js --headed
  ```

---

## 📊 Reporting & Debugging
After running the tests, you can generate and view the interactive HTML report by running:
```bash
npx playwright show-report
```
