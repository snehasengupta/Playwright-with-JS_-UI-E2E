const fs = require('fs');
const path = require('path');

// Paths to test result sources
const ALLURE_RESULTS_DIR = path.join(__dirname, '..', '..', 'test-results', 'allure-results');
const JUNIT_RESULTS_FILE = path.join(__dirname, '..', '..', 'test-results', 'results.xml');

// ──────────────────────────────────────────────
// Classification Patterns
// ──────────────────────────────────────────────

const SELECTOR_PATTERNS = [
    /TimeoutError.*locator\.(click|fill|check|press|hover|waitFor)/i,
    /TimeoutError.*getBy(Role|TestId|Text|Placeholder|Label)/i,
    /locator\..*: Timeout \d+ms exceeded/i,
    /waiting for locator/i
];

const ASSERTION_PATTERNS = [
    /expect\(received\)\.(toBe|toEqual|toHaveText|toHaveURL|toContain|toMatch)/i,
    /Expected:.*Received:/i,
    /AssertionError/i
];

const ENVIRONMENT_PATTERNS = [
    /net::ERR_/i,
    /ERR_CONNECTION_REFUSED/i,
    /ERR_NAME_NOT_RESOLVED/i,
    /Navigation timeout.*exceeded/i,
    /page\.goto.*Timeout/i
];

// FIX #3: toBeVisible requires corroborating zero-match evidence
const VISIBILITY_PATTERN = /expect\(locator\)\.toBeVisible/i;
const ZERO_MATCH_EVIDENCE = /0 elements? (found|matched|resolved)|locator resolved to 0|resolved to 0 elements/i;

/**
 * Classify a failure based on its error message and stack trace.
 * @param {string} errorMessage
 * @param {string} stackTrace
 * @returns {"selector"|"assertion"|"environment"|"unattributable"}
 */
function classify(errorMessage, stackTrace) {
    const combined = `${errorMessage}\n${stackTrace}`;

    // toBeVisible needs corroborating evidence of zero matches
    if (VISIBILITY_PATTERN.test(combined)) {
        return ZERO_MATCH_EVIDENCE.test(combined) ? 'selector' : 'unattributable';
    }

    if (SELECTOR_PATTERNS.some(p => p.test(combined))) return 'selector';
    if (ASSERTION_PATTERNS.some(p => p.test(combined))) return 'assertion';
    if (ENVIRONMENT_PATTERNS.some(p => p.test(combined))) return 'environment';

    // Last resort: check if the stack trace references locators/ or pages/
    const hasLocatorOrPageFrame = /[\\/](locators|pages)[\\/]/.test(stackTrace);
    return hasLocatorOrPageFrame ? 'selector' : 'unattributable';
}

/**
 * Parse a single Allure result JSON file and extract failure info if applicable.
 * @param {string} filePath
 * @returns {object|null} Failure object or null if not a failure
 */
function parseAllureResult(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = JSON.parse(content);

        // Only process failed or broken tests
        if (result.status !== 'failed' && result.status !== 'broken') {
            return null;
        }

        const testName = result.name || 'Unknown Test';
        const fullName = result.fullName || '';
        const errorMessage = (result.statusDetails && result.statusDetails.message) || '';
        const stackTrace = (result.statusDetails && result.statusDetails.trace) || '';

        // Extract spec file from fullName (format: "path/to/file.spec.js:line:col")
        let specFile = '';
        if (fullName) {
            const match = fullName.match(/^(.+?\.(spec|test)?\.(js|ts)):?\d*/);
            if (match) {
                specFile = match[1];
            } else {
                // Fallback: take everything before the first colon
                specFile = fullName.split(':')[0];
            }
        }

        return {
            specFile,
            testName,
            errorMessage,
            stackTrace,
            source: 'allure'
        };
    } catch (e) {
        console.error(`  Warning: Could not parse Allure result ${filePath}: ${e.message}`);
        return null;
    }
}

/**
 * Parse JUnit XML results file as fallback.
 * Uses regex-based parsing to avoid external XML dependencies.
 * @param {string} filePath
 * @returns {Array} Array of failure objects
 */
function parseJUnitXML(filePath) {
    const failures = [];

    try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Match <testcase> elements that contain <failure> children
        const testcaseRegex = /<testcase\s+([^>]*)>([\s\S]*?)<\/testcase>/g;
        let match;

        while ((match = testcaseRegex.exec(content)) !== null) {
            const attrs = match[1];
            const body = match[2];

            // Check if this testcase has a <failure> element
            const failureMatch = body.match(/<failure\s*(?:[^>]*)>([\s\S]*?)<\/failure>/);
            if (!failureMatch) continue;

            const failureText = failureMatch[1].trim();

            // Extract attributes
            const nameMatch = attrs.match(/name="([^"]*)"/);
            const classMatch = attrs.match(/classname="([^"]*)"/);

            const testName = nameMatch ? nameMatch[1] : 'Unknown Test';
            const className = classMatch ? classMatch[1] : '';

            // Derive spec file from classname (Playwright JUnit format)
            let specFile = className.replace(/\./g, '/');
            if (!specFile.endsWith('.js') && !specFile.endsWith('.ts')) {
                specFile += '.js';
            }

            // Split failure text into message (first line) and stack trace (rest)
            const lines = failureText.split('\n');
            const errorMessage = lines[0] || '';
            const stackTrace = lines.slice(1).join('\n');

            failures.push({
                specFile,
                testName,
                errorMessage,
                stackTrace,
                source: 'junit'
            });
        }
    } catch (e) {
        console.error(`  Warning: Could not parse JUnit XML ${filePath}: ${e.message}`);
    }

    return failures;
}

/**
 * Parse and classify all test failures from the most recent test run.
 * Reads Allure JSON results (preferred) or JUnit XML (fallback).
 *
 * @returns {{ selectorFailures: Array, skippedFailures: Array }}
 */
function parseAndClassifyFailures() {
    const selectorFailures = [];
    const skippedFailures = [];
    let rawFailures = [];
    let allureSourceUsable = false;

    // Primary source: Allure JSON results
    if (fs.existsSync(ALLURE_RESULTS_DIR)) {
        const files = fs.readdirSync(ALLURE_RESULTS_DIR)
            .filter(f => f.endsWith('-result.json'));

        if (files.length > 0) {
            allureSourceUsable = true;
            console.log(`  Reading ${files.length} Allure result files...`);
            for (const file of files) {
                const failure = parseAllureResult(path.join(ALLURE_RESULTS_DIR, file));
                if (failure) {
                    rawFailures.push(failure);
                }
            }
        }
    }

    // Fallback: JUnit XML
    if (!allureSourceUsable && fs.existsSync(JUNIT_RESULTS_FILE)) {
        console.log('  Allure results unavailable, falling back to JUnit XML...');
        rawFailures = parseJUnitXML(JUNIT_RESULTS_FILE);
    }

    if (rawFailures.length === 0) {
        console.log('  No test failures found in any result source.');
        return { selectorFailures, skippedFailures };
    }

    // Classify each failure
    for (const failure of rawFailures) {
        const classification = classify(failure.errorMessage, failure.stackTrace);
        failure.classification = classification;

        if (classification === 'selector') {
            selectorFailures.push(failure);
        } else {
            skippedFailures.push({
                ...failure,
                skipReason: `Not selector-related (classified as: ${classification})`
            });
        }
    }

    return { selectorFailures, skippedFailures };
}

module.exports = { parseAndClassifyFailures, classify };
