const https = require('https');
const path = require('path');

// Project root for resolving paths
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// Base URL from playwright config (hardcoded to match project config)
const BASE_URL = 'https://eventhub.rahulshettyacademy.com';

const MAX_ITERATIONS = 10;
const AUTH_TIMEOUT_MS = 15000;

// ──────────────────────────────────────────────
// Claude Tool Definitions
// ──────────────────────────────────────────────

const TOOL_DEFINITIONS = [
    {
        name: 'get_accessibility_tree',
        description: 'Get the full accessibility tree of the current page. Returns all interactive elements with their roles, names, and properties. Use this first to understand what elements exist on the page.',
        input_schema: { type: 'object', properties: {}, required: [] }
    },
    {
        name: 'try_selector',
        description: 'Test a Playwright selector on the current page. Returns the number of elements matched and their accessible names. Use this to verify if a candidate selector resolves correctly.',
        input_schema: {
            type: 'object',
            properties: {
                selector_code: {
                    type: 'string',
                    description: 'The Playwright selector expression to test, e.g. "page.getByRole(\'textbox\', {name: \'Email Address\'})" or "page.getByTestId(\'login-btn\')"'
                }
            },
            required: ['selector_code']
        }
    },
    {
        name: 'navigate_to_path',
        description: 'Navigate the browser to a path relative to the base URL of the application.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'URL path, e.g. /login or /admin' }
            },
            required: ['path']
        }
    },
    {
        name: 'propose_fix',
        description: 'Propose the final locator fix after verifying with try_selector that exactly 1 element matched. Only call this after try_selector has confirmed a single unambiguous match.',
        input_schema: {
            type: 'object',
            properties: {
                file: { type: 'string', description: 'Relative path to the locator file to fix' },
                original_line: { type: 'string', description: 'The exact original line of code to replace' },
                fixed_line: { type: 'string', description: 'The corrected line of code' },
                reasoning: { type: 'string', description: 'Brief explanation of why this fix is correct' }
            },
            required: ['file', 'original_line', 'fixed_line', 'reasoning']
        }
    }
];

// ──────────────────────────────────────────────
// Claude API Communication
// ──────────────────────────────────────────────

/**
 * Call Claude Messages API with tool_use support.
 * @param {string} apiKey
 * @param {Array} messages - Conversation history
 * @param {string} systemPrompt
 * @returns {Promise<object>} Claude response
 */
function callClaude(apiKey, messages, systemPrompt) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: systemPrompt,
            tools: TOOL_DEFINITIONS,
            messages
        });

        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    if (response.error) {
                        reject(new Error(`Claude API error: ${response.error.message}`));
                    } else {
                        resolve(response);
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Claude response: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => reject(new Error(`Connection error: ${e.message}`)));
        req.write(data);
        req.end();
    });
}

// ──────────────────────────────────────────────
// Tool Execution Handlers
// ──────────────────────────────────────────────

/**
 * Execute get_accessibility_tree tool on the live page.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} Accessibility tree as formatted string
 */
async function executeGetAccessibilityTree(page) {
    try {
        const snapshot = await page.accessibility.snapshot();
        if (!snapshot) {
            return 'No accessibility tree available for this page.';
        }
        return formatAccessibilityTree(snapshot, 0);
    } catch (e) {
        return `Error getting accessibility tree: ${e.message}`;
    }
}

/**
 * Format an accessibility tree node into a readable string.
 * @param {object} node
 * @param {number} depth
 * @returns {string}
 */
function formatAccessibilityTree(node, depth) {
    const indent = '  '.repeat(depth);
    let result = '';

    const role = node.role || 'none';
    const name = node.name || '';
    const value = node.value || '';

    let line = `${indent}[${role}]`;
    if (name) line += ` "${name}"`;
    if (value) line += ` value="${value}"`;
    if (node.checked !== undefined) line += ` checked=${node.checked}`;
    if (node.disabled) line += ` disabled`;
    if (node.focused) line += ` focused`;
    result += line + '\n';

    if (node.children) {
        for (const child of node.children) {
            result += formatAccessibilityTree(child, depth + 1);
        }
    }

    return result;
}

/**
 * Execute try_selector tool — test a Playwright selector on the live page.
 * @param {import('@playwright/test').Page} page
 * @param {string} selectorCode - e.g. "page.getByRole('textbox', {name: 'Email'})"
 * @returns {Promise<{matchCount: number, elements: string[]}>}
 */
async function executeTrySelector(page, selectorCode) {
    try {
        // Parse the selector code to build the actual Playwright locator
        const locator = buildLocatorFromCode(page, selectorCode);
        const count = await locator.count();

        const elements = [];
        for (let i = 0; i < Math.min(count, 5); i++) {
            try {
                const el = locator.nth(i);
                const tagName = await el.evaluate(e => e.tagName.toLowerCase());
                const text = await el.evaluate(e => e.textContent?.substring(0, 50) || '');
                const role = await el.getAttribute('role') || '';
                elements.push(`${tagName}${role ? `[role=${role}]` : ''}: "${text.trim()}"`);
            } catch (_) {
                elements.push(`(element ${i} - could not read details)`);
            }
        }

        return { matchCount: count, elements };
    } catch (e) {
        return { matchCount: 0, elements: [], error: e.message };
    }
}

/**
 * Build a Playwright locator from a selector code string.
 * Supports: getByRole, getByTestId, getByText, getByPlaceholder, getByLabel, locator
 * @param {import('@playwright/test').Page} page
 * @param {string} code
 * @returns {import('@playwright/test').Locator}
 */
function buildLocatorFromCode(page, code) {
    // Normalize: strip "page." prefix if present
    const normalized = code.replace(/^page\./, '');

    // getByRole('role', {name: 'value'})
    const roleMatch = normalized.match(/getByRole\(\s*'([^']+)'\s*(?:,\s*\{[^}]*name\s*:\s*'([^']*)'[^}]*\})?\s*\)/);
    if (roleMatch) {
        const role = roleMatch[1];
        const name = roleMatch[2];
        return name ? page.getByRole(role, { name }) : page.getByRole(role);
    }

    // getByTestId('value')
    const testIdMatch = normalized.match(/getByTestId\(\s*'([^']+)'\s*\)/);
    if (testIdMatch) {
        return page.getByTestId(testIdMatch[1]);
    }

    // getByText('value') with optional exact flag
    const textMatch = normalized.match(/getByText\(\s*'([^']+)'\s*(?:,\s*\{[^}]*exact\s*:\s*(true|false)[^}]*\})?\s*\)/);
    if (textMatch) {
        const text = textMatch[1];
        const exact = textMatch[2] === 'true';
        return exact ? page.getByText(text, { exact: true }) : page.getByText(text);
    }

    // getByPlaceholder('value')
    const placeholderMatch = normalized.match(/getByPlaceholder\(\s*'([^']+)'\s*\)/);
    if (placeholderMatch) {
        return page.getByPlaceholder(placeholderMatch[1]);
    }

    // getByLabel('value')
    const labelMatch = normalized.match(/getByLabel\(\s*'([^']+)'\s*\)/);
    if (labelMatch) {
        return page.getByLabel(labelMatch[1]);
    }

    // locator('css-or-xpath')
    const locatorMatch = normalized.match(/locator\(\s*'([^']+)'\s*\)/);
    if (locatorMatch) {
        return page.locator(locatorMatch[1]);
    }

    // Fallback: try as CSS selector
    return page.locator(code);
}

/**
 * Execute navigate_to_path tool.
 * @param {import('@playwright/test').Page} page
 * @param {string} urlPath
 * @returns {Promise<string>}
 */
async function executeNavigateToPath(page, urlPath) {
    try {
        const fullUrl = BASE_URL + urlPath;
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        return `Navigated to ${fullUrl}. Current URL: ${page.url()}`;
    } catch (e) {
        return `Navigation failed: ${e.message}`;
    }
}

// ──────────────────────────────────────────────
// Auth Circuit Breaker
// ──────────────────────────────────────────────

/**
 * Attempt to log in to the application.
 * Uses getLastRegisteredUser() from testDataHelper.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>} true if login succeeded
 */
async function attemptLogin(page) {
    try {
        const { getLastRegisteredUser } = require(path.join(PROJECT_ROOT, 'utils', 'testDataHelper'));
        const user = getLastRegisteredUser();

        if (!user) {
            console.log('  Auth circuit breaker: No registered users available.');
            return false;
        }

        console.log(`  Attempting login as: ${user.email}`);
        await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: AUTH_TIMEOUT_MS });

        // Use the same locator strategy as LoginPage.js
        await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
        await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
        await page.getByRole('button', { name: 'Sign In' }).click();

        // Wait for navigation away from login page
        await page.waitForURL(url => !url.toString().includes('/login'), { timeout: AUTH_TIMEOUT_MS });

        console.log('  Login succeeded.');
        return true;
    } catch (e) {
        console.log(`  Auth circuit breaker TRIGGERED: Login failed — ${e.message}`);
        return false;
    }
}

// ──────────────────────────────────────────────
// Main Healing Agent
// ──────────────────────────────────────────────

/**
 * Run the agentic healing loop for a single failure.
 * Launches a fresh browser, navigates to the target page, and uses Claude's
 * tool_use to find and verify a replacement selector.
 *
 * @param {object} failureContext - Output from stack-analyzer
 * @param {string} apiKey - Anthropic API key
 * @param {{ dryRun: boolean }} options
 * @returns {Promise<{success: boolean, fix: object|null, selectorHistory: Array, escalationReason: string|null}>}
 */
async function healWithBrowser(failureContext, apiKey, options = {}) {
    const { dryRun = false } = options;

    // FIX #2: Fresh browser context per attempt — never reused
    let browser = null;
    const selectorHistory = [];

    try {
        // Dynamic import of playwright (it's a devDependency)
        const { chromium } = require('playwright');

        console.log('  Launching browser...');
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1200, height: 700 }
        });
        const page = await context.newPage();

        // Auth circuit breaker
        if (failureContext.requiresAuth) {
            console.log('  Target page requires authentication. Attempting login...');
            const loginSuccess = await attemptLogin(page);
            if (!loginSuccess) {
                return {
                    success: false,
                    fix: null,
                    selectorHistory,
                    escalationReason: 'auth-blocked'
                };
            }
        }

        // Navigate to the target page
        console.log(`  Navigating to ${failureContext.targetPagePath}...`);
        await page.goto(BASE_URL + failureContext.targetPagePath, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Build the system prompt
        const systemPrompt = buildSystemPrompt(failureContext);

        // Claude conversation history
        const messages = [
            {
                role: 'user',
                content: `The test "${failureContext.specFile}" is failing. The broken locator is in file "${failureContext.healTarget}" at line ${failureContext.healLine}.\n\nBroken locator key: ${failureContext.brokenLocatorKey}\nBroken locator value: '${failureContext.brokenLocatorValue}'\nUsed in page object as: ${failureContext.locatorUsageInPage}\n\nPlease use get_accessibility_tree first to see what's on the page, then use try_selector to find the correct replacement, and finally call propose_fix when you have exactly one match.`
            }
        ];

        // FIX #1: Track the LAST try_selector result per selector string (kept for audit trail)
        const lastSelectorResult = new Map();

        // Track ONLY the single most recent try_selector call for propose_fix validation
        let lastTriedSelector = null;

        // Tool-use loop
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            console.log(`  Iteration ${iteration + 1}/${MAX_ITERATIONS}...`);

            const response = await callClaude(apiKey, messages, systemPrompt);

            // Check if Claude wants to use tools
            const toolUseBlocks = (response.content || []).filter(b => b.type === 'tool_use');
            const textBlocks = (response.content || []).filter(b => b.type === 'text');

            // If Claude responded with text only (no tool calls), it's done
            if (toolUseBlocks.length === 0) {
                const textContent = textBlocks.map(b => b.text).join('\n');
                console.log(`  Claude ended without proposing a fix: ${textContent.substring(0, 200)}`);
                break;
            }

            // Add assistant response to conversation history
            messages.push({ role: 'assistant', content: response.content });

            // Process each tool call
            const toolResults = [];

            for (const toolBlock of toolUseBlocks) {
                const toolName = toolBlock.name;
                const toolInput = toolBlock.input || {};
                let toolResult = '';

                console.log(`    Tool: ${toolName}${toolInput.selector_code ? ` — "${toolInput.selector_code}"` : ''}`);

                switch (toolName) {
                    case 'get_accessibility_tree':
                        toolResult = await executeGetAccessibilityTree(page);
                        break;

                    case 'try_selector': {
                        const selectorResult = await executeTrySelector(page, toolInput.selector_code);
                        selectorHistory.push({
                            selector: toolInput.selector_code,
                            matchCount: selectorResult.matchCount,
                            elements: selectorResult.elements,
                            iteration: iteration + 1
                        });

                        // FIX #1: Track LAST result for this exact selector (audit trail)
                        lastSelectorResult.set(toolInput.selector_code, {
                            matchCount: selectorResult.matchCount,
                            timestamp: Date.now()
                        });

                        // Overwrite — only the most recent try_selector matters for validation
                        lastTriedSelector = {
                            selector_code: toolInput.selector_code,
                            matchCount: selectorResult.matchCount
                        };

                        toolResult = JSON.stringify({
                            matchCount: selectorResult.matchCount,
                            elements: selectorResult.elements,
                            error: selectorResult.error || null
                        });
                        console.log(`      → ${selectorResult.matchCount} match(es)`);
                        break;
                    }

                    case 'navigate_to_path':
                        toolResult = await executeNavigateToPath(page, toolInput.path);
                        break;

                    case 'propose_fix': {
                        const proposedFix = toolInput;
                        // Validates against the immediately preceding try_selector only — not full history — to prevent accepting a fix based on a stale or coincidentally-matching earlier attempt.
                        const fixedValue = extractValueFromFixedLine(proposedFix.fixed_line);
                        const lastTriedValue = lastTriedSelector
                            ? extractValueFromSelectorCode(lastTriedSelector.selector_code)
                            : null;

                        const validated = lastTriedSelector !== null
                            && lastTriedSelector.matchCount === 1
                            && lastTriedValue === fixedValue;

                        if (!validated) {
                            const reason = !lastTriedSelector
                                ? 'no try_selector was called before propose_fix'
                                : lastTriedSelector.matchCount !== 1
                                    ? `last try_selector matched ${lastTriedSelector.matchCount} element(s), not exactly 1`
                                    : `value mismatch — fix proposes "${fixedValue}" but last tried selector resolved "${lastTriedValue}"`;
                            console.log(`      → propose_fix REJECTED: ${reason}`);
                            return {
                                success: false,
                                fix: proposedFix,
                                selectorHistory,
                                escalationReason: 'ambiguous-match'
                            };
                        }

                        console.log('      → propose_fix ACCEPTED (verified single match on last try_selector)');
                        return {
                            success: true,
                            fix: {
                                file: proposedFix.file,
                                originalLine: proposedFix.original_line,
                                fixedLine: proposedFix.fixed_line,
                                reasoning: proposedFix.reasoning
                            },
                            selectorHistory,
                            escalationReason: null
                        };
                    }

                    default:
                        toolResult = `Unknown tool: ${toolName}`;
                }

                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolBlock.id,
                    content: toolResult
                });
            }

            // Add tool results to conversation
            messages.push({ role: 'user', content: toolResults });
        }

        // Loop exhausted without a fix
        console.log('  Max iterations reached without a fix.');
        return {
            success: false,
            fix: null,
            selectorHistory,
            escalationReason: 'max-iterations'
        };

    } catch (e) {
        console.error(`  Healing agent error: ${e.message}`);
        return {
            success: false,
            fix: null,
            selectorHistory,
            escalationReason: `error: ${e.message}`
        };
    } finally {
        if (browser) {
            await browser.close();
            console.log('  Browser closed.');
        }
    }
}

/**
 * Build the system prompt for Claude based on the failure context.
 * @param {object} ctx - Failure context from stack-analyzer
 * @returns {string}
 */
function buildSystemPrompt(ctx) {
    return `You are a Playwright locator repair agent for a Page Object Model framework.

A test is failing because a locator no longer matches any element on the live page.

BROKEN LOCATOR DETAILS:
- File: ${ctx.healTarget}
- Key: ${ctx.brokenLocatorKey}
- Current value: '${ctx.brokenLocatorValue}'
- Used in page object as: ${ctx.locatorUsageInPage}

YOUR TASK:
1. Call get_accessibility_tree to see all elements currently on the page
2. Identify which element the broken locator was INTENDED to target (based on the key name and how it was used)
3. Call try_selector with candidate replacement selectors
4. When try_selector returns EXACTLY 1 match, call propose_fix

RULES:
- NEVER call propose_fix if try_selector returned 0 matches or more than 1 match
- Prefer resilient selectors: getByRole > getByTestId > getByText > getByPlaceholder > CSS
- The fix should update the VALUE in the locator file (the string), not change the selector method used in the page object
- For example, if the locator is emailRoleName: 'Email' and the page now has a textbox named 'Email Address', the fix is: emailRoleName: 'Email Address'
- Keep the fix minimal — only change what's broken`;
}

/**
 * Extract the locator value from a fixed line of code.
 * e.g., "emailRoleName: 'Email Address'" → "Email Address"
 * @param {string} fixedLine
 * @returns {string}
 */
function extractValueFromFixedLine(fixedLine) {
    const match = fixedLine.match(/['"]([^'"]+)['"]/);
    return match ? match[1] : fixedLine;
}

/**
 * Extract the locator value from a Playwright selector code string.
 * e.g., "page.getByRole('textbox', {name: 'Email Address'})" → "Email Address"
 * e.g., "page.getByTestId('login-btn')" → "login-btn"
 * e.g., "page.getByText('Submit')" → "Submit"
 * @param {string} selectorCode
 * @returns {string}
 */
function extractValueFromSelectorCode(selectorCode) {
    // Try to extract the name parameter from getByRole('role', {name: 'value'})
    const nameMatch = selectorCode.match(/name\s*:\s*['"]([^'"]+)['"]/);
    if (nameMatch) return nameMatch[1];

    // Try to extract the first argument from getByTestId/getByText/getByPlaceholder/getByLabel('value')
    const argMatch = selectorCode.match(/getBy(?:TestId|Text|Placeholder|Label)\s*\(\s*['"]([^'"]+)['"]/);
    if (argMatch) return argMatch[1];

    // Fallback: extract any quoted string
    const fallback = selectorCode.match(/['"]([^'"]+)['"]/);
    return fallback ? fallback[1] : selectorCode;
}

module.exports = { healWithBrowser };
