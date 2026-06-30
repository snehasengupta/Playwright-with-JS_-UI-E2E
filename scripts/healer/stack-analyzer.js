const fs = require('fs');
const path = require('path');

// Project root directory
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// Auth-gated locator files — these pages require login to access
const AUTH_GATED_LOCATORS = [
    'AdminLocators.js',
    'BookingFormLocators.js',
    'BrowseventPageLocators.js'
];

// Locator/page file → target page path mapping
const PAGE_PATH_MAP = {
    'LoginPageLocators.js': '/login',
    'LoginPage.js': '/login',
    'RegisterPageLocators.js': '/login',
    'RegisterPage.js': '/login',
    'AdminLocators.js': '/admin',
    'Adminpage.js': '/admin',
    'BrowseventPageLocators.js': '/',
    'BrowseventPage.js': '/',
    'BookingFormLocators.js': '/',
    'BookingFormPage.js': '/',
    'CommonLocators.js': '/',
    'BasePage.js': '/'
};

/**
 * Parse a stack trace string into structured frame objects.
 * @param {string} stackTrace
 * @returns {Array<{method: string, file: string, line: number, col: number}>}
 */
function parseStackFrames(stackTrace) {
    const frames = [];
    const frameRegex = /at\s+(?:(.*?)\s+)?\(?(.+?):(\d+):(\d+)\)?/g;
    let match;

    while ((match = frameRegex.exec(stackTrace)) !== null) {
        const file = match[2].replace(/\\/g, '/');

        // Skip node_modules and node internals
        if (file.includes('node_modules/') || file.startsWith('node:')) {
            continue;
        }

        frames.push({
            method: match[1] || '<anonymous>',
            file: file,
            line: parseInt(match[3], 10),
            col: parseInt(match[4], 10)
        });
    }

    return frames;
}

/**
 * Extract a locator key-value pair from a locators file at a given line.
 * Checks the exact reported line first, falling back to closest neighbors.
 * @param {string} filePath - Absolute path to the locator file
 * @param {number} targetLine - Line number to read
 * @returns {{ key: string, value: string }|null}
 */
function extractLocatorAtLine(filePath, targetLine) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        const kvRegex = /^\s*(\w+)\s*:\s*['"](.+?)['"]/;

        // Check the exact reported line first — this is the
        // authoritative source of truth from the stack trace.
        const exactLine = lines[targetLine - 1];
        if (exactLine) {
            const exactMatch = exactLine.match(kvRegex);
            if (exactMatch) {
                return { key: exactMatch[1], value: exactMatch[2] };
            }
        }

        // Only fall back to neighbors (closest first) if the exact
        // line itself didn't contain a parseable key:value pair —
        // this covers cases where the stack trace line number is
        // off by one due to how V8/Playwright report locations.
        for (const offset of [-1, 1, -2, 2]) {
            const line = lines[targetLine - 1 + offset];
            if (!line) continue;
            const match = line.match(kvRegex);
            if (match) {
                return { key: match[1], value: match[2] };
            }
        }
    } catch (e) {
        console.error(`  Warning: Could not read locator file ${filePath}: ${e.message}`);
    }
    return null;
}

/**
 * Find the page object that imports a given locator file.
 * Reads all files in pages/ and searches for require() references.
 * @param {string} locatorFileName - e.g., 'LoginPageLocators.js'
 * @returns {{ pageFile: string, usageLine: number, usageCode: string }|null}
 */
function findPageObjectForLocator(locatorFileName) {
    const pagesDir = path.join(PROJECT_ROOT, 'pages');

    try {
        const pageFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.js'));

        for (const pageFile of pageFiles) {
            const filePath = path.join(pagesDir, pageFile);
            const content = fs.readFileSync(filePath, 'utf-8');

            // Check if this page imports the locator file
            const locatorBaseName = locatorFileName.replace(/\.js$/, '');
            const importPattern = new RegExp(
                `(require\\(['"][^'"]*${locatorBaseName}['"]\\s*\\)` +
                `|from\\s+['"][^'"]*${locatorBaseName}['"])`
            );

            if (importPattern.test(content)) {
                const lines = content.split(/\r?\n/);

                // Find the line that uses a locator reference (e.g., locators.emailRoleName)
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('locators.')) {
                        return {
                            pageFile: path.join('pages', pageFile),
                            pageFilePath: filePath,
                            usageLine: i + 1,
                            usageCode: lines[i].trim()
                        };
                    }
                }

                // Found the import but no locators. usage — still return the page file
                return {
                    pageFile: path.join('pages', pageFile),
                    pageFilePath: filePath,
                    usageLine: 0,
                    usageCode: ''
                };
            }
        }
    } catch (e) {
        console.error(`  Warning: Could not search pages directory: ${e.message}`);
    }

    return null;
}

/**
 * Find how a specific locator key is used in the page object.
 * @param {string} pageFilePath - Absolute path to the page object
 * @param {string} locatorKey - e.g., 'emailRoleName'
 * @returns {string} The line of code showing how the locator is used
 */
function findLocatorUsage(pageFilePath, locatorKey) {
    try {
        const content = fs.readFileSync(pageFilePath, 'utf-8');
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            if (line.includes(`locators.${locatorKey}`)) {
                return line.trim();
            }
        }
    } catch (e) {
        // Ignore read errors
    }
    return '';
}

/**
 * Check if a spec file uses the loggedInPage fixture (requires auth).
 * @param {string} specFile - Relative path to the spec file
 * @returns {boolean}
 */
function specRequiresAuth(specFile) {
    try {
        const filePath = path.join(PROJECT_ROOT, specFile);
        const content = fs.readFileSync(filePath, 'utf-8');
        return content.includes('loggedInPage');
    } catch (e) {
        return false;
    }
}

/**
 * Analyze a stack trace to identify the exact file and line to heal.
 *
 * Priority: locators/ > pages/ > tests/
 * Also determines auth requirements and target page path.
 *
 * @param {string} stackTrace - Full stack trace string
 * @param {string} specFile - The spec file that failed
 * @returns {object|null} Heal target info or null if unattributable
 */
function analyzeStack(stackTrace, specFile) {
    const frames = parseStackFrames(stackTrace);

    if (frames.length === 0) {
        console.log('  No parseable stack frames found.');
        return null;
    }

    // Bucket frames by directory
    const locatorFrames = frames.filter(f => /[\\/]locators[\\/]/.test(f.file));
    const pageFrames = frames.filter(f => /[\\/]pages[\\/]/.test(f.file));

    // Select heal target with priority: locators > pages
    let healFrame = null;
    let healType = '';

    if (locatorFrames.length > 0) {
        healFrame = locatorFrames[0];
        healType = 'locator';
    } else if (pageFrames.length > 0) {
        healFrame = pageFrames[0];
        healType = 'page';
    } else {
        console.log('  Stack trace has no frames in locators/ or pages/ — unattributable.');
        return null;
    }

    // Resolve paths
    const healFileName = path.basename(healFrame.file);
    const healTargetRelative = healType === 'locator'
        ? path.join('locators', healFileName)
        : path.join('pages', healFileName);
    const healTargetAbsolute = path.join(PROJECT_ROOT, healTargetRelative);

    // Extract the broken locator key/value (only for locator files)
    let brokenLocatorKey = '';
    let brokenLocatorValue = '';
    let locatorUsageInPage = '';
    let pageObjectFile = '';
    let pageObjectLine = 0;

    if (healType === 'locator') {
        const locatorInfo = extractLocatorAtLine(healTargetAbsolute, healFrame.line);
        if (locatorInfo) {
            brokenLocatorKey = locatorInfo.key;
            brokenLocatorValue = locatorInfo.value;
        }

        // Find the page object that uses this locator
        const pageInfo = findPageObjectForLocator(healFileName);
        if (pageInfo) {
            pageObjectFile = pageInfo.pageFile;
            pageObjectLine = pageInfo.usageLine;

            // Find how the specific broken locator key is used
            if (brokenLocatorKey) {
                locatorUsageInPage = findLocatorUsage(pageInfo.pageFilePath, brokenLocatorKey);
            }
        }
    } else {
        // For page objects, read the line to understand what locator it references
        try {
            const content = fs.readFileSync(healTargetAbsolute, 'utf-8');
            const lines = content.split(/\r?\n/);
            const targetLine = lines[healFrame.line - 1] || '';
            locatorUsageInPage = targetLine.trim();

            // Try to extract locator reference from the page object line
            const locRefMatch = targetLine.match(/locators\.(\w+)/);
            if (locRefMatch) {
                brokenLocatorKey = locRefMatch[1];

                // Find the actual locator file and read the value
                const requireMatch = content.match(/require\(['"](.+?locators.+?)['"]\)/);
                if (requireMatch) {
                    const locatorFilePath = path.resolve(path.dirname(healTargetAbsolute), requireMatch[1]);
                    const normalizedPath = locatorFilePath.endsWith('.js') ? locatorFilePath : locatorFilePath + '.js';
                    try {
                        const locContent = fs.readFileSync(normalizedPath, 'utf-8');
                        const valMatch = locContent.match(new RegExp(`${brokenLocatorKey}\\s*:\\s*['"](.+?)['"]`));
                        if (valMatch) {
                            brokenLocatorValue = valMatch[1];
                        }
                    } catch (_) { /* ignore */ }
                }
            }

            pageObjectFile = healTargetRelative;
            pageObjectLine = healFrame.line;
        } catch (e) {
            // Ignore read errors
        }
    }

    // Determine auth requirement
    const requiresAuth = specRequiresAuth(specFile)
        || AUTH_GATED_LOCATORS.includes(healFileName);

    // Determine target page path
    const targetPagePath = PAGE_PATH_MAP[healFileName] || '/';

    return {
        healTarget: healTargetRelative,
        healTargetAbsolute,
        healLine: healFrame.line,
        healType,
        pageObjectFile,
        pageObjectLine,
        specFile,
        brokenLocatorKey,
        brokenLocatorValue,
        locatorUsageInPage,
        requiresAuth,
        targetPagePath
    };
}

module.exports = { analyzeStack };
