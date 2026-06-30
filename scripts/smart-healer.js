#!/usr/bin/env node

/**
 * Smart Auto-Healer v3 — Main Orchestrator
 *
 * Phases:
 *   0. CLASSIFY — Parse test results, classify failures
 *   1. LOCATE  — Extract heal target from stack trace
 *   2. HEAL    — Agentic browser loop with Claude tool_use
 *   3. VERIFY  — Re-run the failing test to confirm the fix
 *   4. ESCALATE — Write escalation details if healing fails
 *
 * Usage: node scripts/smart-healer.js <API_KEY> [--dry-run] [--max-heal N]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { parseAndClassifyFailures } = require('./healer/result-parser');
const { analyzeStack } = require('./healer/stack-analyzer');
const { healWithBrowser } = require('./healer/healing-agent');
const { escalate } = require('./healer/email-notifier');

// Project root
const PROJECT_ROOT = path.join(__dirname, '..');
const HEALING_REPORT_FILE = path.join(PROJECT_ROOT, 'healing-report.json');
const MAX_REPORT_ENTRIES = 20;

// Load environment variables from .env file
function loadEnv() {
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const equalsIdx = trimmed.indexOf('=');
            if (equalsIdx > 0) {
                const key = trimmed.substring(0, equalsIdx).trim();
                let value = trimmed.substring(equalsIdx + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length - 1);
                }
                process.env[key] = value;
            }
        }
    }
}
loadEnv();

// ──────────────────────────────────────────────
// Argument Parsing
// ──────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        apiKey: '',
        dryRun: false,
        maxHeal: 3
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dry-run') {
            config.dryRun = true;
        } else if (args[i] === '--max-heal' && args[i + 1]) {
            config.maxHeal = parseInt(args[i + 1], 10) || 3;
            i++;
        } else if (!args[i].startsWith('--') && !config.apiKey) {
            config.apiKey = args[i];
        }
    }

    if (!config.apiKey && process.env.ANTHROPIC_API_KEY) {
        config.apiKey = process.env.ANTHROPIC_API_KEY;
    }

    return config;
}

// ──────────────────────────────────────────────
// Backup & Restore Utilities
// ──────────────────────────────────────────────

/**
 * Create a timestamped backup of a file.
 * @param {string} filePath - Absolute path to the file
 * @returns {string} Backup file path
 */
function createBackup(filePath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
}

/**
 * Restore a file from its most recent backup.
 * @param {string} filePath - Absolute path to the file
 * @param {string} backupPath - Absolute path to the backup
 */
function restoreBackup(filePath, backupPath) {
    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, filePath);
        console.log(`  Restored from backup: ${backupPath}`);
    } else {
        console.error(`  WARNING: Backup not found at ${backupPath}. Cannot restore.`);
    }
}

/**
 * Apply a fix to the target file by replacing the original line with the fixed line.
 * @param {string} filePath - Absolute path to the file
 * @param {object} fix - { originalLine, fixedLine }
 * @param {number} targetLine - The target line number in the file
 * @returns {{ applied: boolean, reason?: string }}
 */
function applyFix(filePath, fix, targetLine) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const lineIndex = targetLine - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
        return {
            applied: false,
            reason: `target line ${targetLine} is out of bounds (file has ${lines.length} lines)`
        };
    }

    const actualLine = lines[lineIndex];
    if (actualLine.trim() !== fix.originalLine.trim()) {
        return {
            applied: false,
            reason: `line ${targetLine} does not match expected original_line — ` +
                    `expected "${fix.originalLine.trim()}", found "${actualLine.trim()}"`
        };
    }

    // Preserve original indentation when writing the replacement
    const indentMatch = actualLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    lines[lineIndex] = indent + fix.fixedLine.trim();

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`  Fix applied to: ${filePath} (line ${targetLine})`);
    return { applied: true };
}

// ──────────────────────────────────────────────
// Re-run a specific test and check results
// ──────────────────────────────────────────────

/**
 * Re-run a specific spec file and return pass/fail.
 * @param {string} specFile - Relative path to the spec file
 * @returns {{ passed: boolean, output: string }}
 */
function rerunTest(specFile) {
    try {
        console.log(`  Re-running: npx playwright test ${specFile}`);
        const output = execSync(`npx playwright test ${specFile} --reporter=json`, {
            cwd: PROJECT_ROOT,
            encoding: 'utf-8',
            timeout: 120000, // 2 minute timeout
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // If execSync didn't throw, the test passed
        return { passed: true, output };
    } catch (e) {
        // execSync throws on non-zero exit code
        const output = (e.stdout || '') + (e.stderr || '');

        // Empty stdout means the process likely crashed before Playwright
        // could write reporter output (e.g. a syntax error introduced by
        // the fix) — this must NOT be treated as a pass.
        if (!e.stdout || e.stdout.trim() === '') {
            return {
                passed: false,
                output: output || 'No output captured — test process likely crashed before producing results'
            };
        }

        try {
            const jsonResult = JSON.parse(e.stdout);
            const failedCount = jsonResult.stats?.unexpected || 0;
            return { passed: failedCount === 0, output };
        } catch (_) {
            return { passed: false, output };
        }
    }
}

// ──────────────────────────────────────────────
// Healing Report Management
// ──────────────────────────────────────────────

/**
 * Append an entry to the healing report (rolling window of MAX_REPORT_ENTRIES).
 * @param {object} entry
 */
function appendToHealingReport(entry) {
    let report = [];

    try {
        if (fs.existsSync(HEALING_REPORT_FILE)) {
            const content = fs.readFileSync(HEALING_REPORT_FILE, 'utf-8');
            report = JSON.parse(content);
            if (!Array.isArray(report)) report = [report];
        }
    } catch (_) {
        report = [];
    }

    report.push({
        timestamp: new Date().toISOString(),
        ...entry
    });

    // Rolling window: trim to last MAX_REPORT_ENTRIES entries
    if (report.length > MAX_REPORT_ENTRIES) {
        report = report.slice(report.length - MAX_REPORT_ENTRIES);
    }

    fs.writeFileSync(HEALING_REPORT_FILE, JSON.stringify(report, null, 2));
}

// ──────────────────────────────────────────────
// Main Orchestrator
// ──────────────────────────────────────────────

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║        Smart Auto-Healer v3                         ║');
    console.log('║  Phases: Classify → Locate → Heal → Verify         ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    const config = parseArgs();

    if (!config.apiKey) {
        console.log('ERROR: API key is required. Pass it as an argument or set ANTHROPIC_API_KEY in your .env file.');
        console.log('Usage: node scripts/smart-healer.js [API_KEY] [--dry-run] [--max-heal N]');
        process.exit(1);
    }

    if (config.dryRun) {
        console.log('🔍 DRY RUN MODE — Full agentic loop will execute, but no files will be modified.');
        console.log('');
    }

    // ─── PHASE 0: CLASSIFY ───────────────────────────
    console.log('━━━ PHASE 0: Classify Failures ━━━');
    const { selectorFailures, skippedFailures } = parseAndClassifyFailures();

    console.log(`  Total failures found: ${selectorFailures.length + skippedFailures.length}`);
    console.log(`  Selector failures (healable): ${selectorFailures.length}`);
    console.log(`  Skipped (not selector-related): ${skippedFailures.length}`);

    if (skippedFailures.length > 0) {
        console.log('  Skipped failures:');
        for (const sf of skippedFailures) {
            console.log(`    ✕ ${sf.testName} — ${sf.skipReason}`);
        }
    }

    // Write skipped failures to report
    for (const sf of skippedFailures) {
        appendToHealingReport({
            status: 'skipped',
            testName: sf.testName,
            specFile: sf.specFile,
            classification: sf.classification,
            reason: sf.skipReason
        });
    }

    if (selectorFailures.length === 0) {
        console.log('');
        console.log('No selector failures to heal. Done.');
        process.exit(0);
    }

    // Cap enforcement
    const toHeal = selectorFailures.slice(0, config.maxHeal);
    if (selectorFailures.length > config.maxHeal) {
        console.log(`  ⚠ Capping at ${config.maxHeal} healing attempts. ${selectorFailures.length - config.maxHeal} selector failure(s) will not be attempted this run.`);
    }

    console.log('');

    // ─── PROCESS EACH FAILURE (independent attempts) ──
    let healed = 0;
    let escalated = 0;

    for (let i = 0; i < toHeal.length; i++) {
        const failure = toHeal[i];
        console.log(`━━━ Attempt ${i + 1}/${toHeal.length}: ${failure.testName} ━━━`);

        // ─── PHASE 1: LOCATE ─────────────────────────
        console.log('  Phase 1: Locating heal target...');
        const target = analyzeStack(failure.stackTrace, failure.specFile);

        if (!target) {
            console.log('  Could not identify heal target from stack trace — skipping.');
            appendToHealingReport({
                status: 'skipped',
                testName: failure.testName,
                specFile: failure.specFile,
                reason: 'unattributable — no locator/page frame in stack trace'
            });
            continue;
        }

        console.log(`  Heal target: ${target.healTarget} (line ${target.healLine})`);
        console.log(`  Broken locator: ${target.brokenLocatorKey} = '${target.brokenLocatorValue}'`);
        console.log(`  Page object usage: ${target.locatorUsageInPage}`);
        console.log(`  Auth required: ${target.requiresAuth}`);
        console.log(`  Target page: ${target.targetPagePath}`);
        console.log('');

        // ─── PHASE 2: HEAL ───────────────────────────
        console.log('  Phase 2: Running agentic healing loop...');
        const result = await healWithBrowser(target, config.apiKey, { dryRun: config.dryRun });

        if (!result.success) {
            console.log(`  Healing failed: ${result.escalationReason}`);
            escalate(
                { ...failure, healTarget: target.healTarget, targetFile: target.healTarget },
                result
            );
            escalated++;
            continue; // POLICY: keep going to next attempt
        }

        console.log(`  Fix proposed: ${result.fix.originalLine} → ${result.fix.fixedLine}`);
        console.log(`  Reasoning: ${result.fix.reasoning}`);
        console.log('');

        // ─── DRY RUN: Skip file write and verification ──
        if (config.dryRun) {
            console.log('  [DRY RUN] Would apply this fix:');
            console.log(`    File:     ${result.fix.file}`);
            console.log(`    Original: ${result.fix.originalLine}`);
            console.log(`    Fixed:    ${result.fix.fixedLine}`);
            console.log('  [DRY RUN] No files modified. Moving to next.');
            appendToHealingReport({
                status: 'dry-run',
                testName: failure.testName,
                specFile: failure.specFile,
                target: target.healTarget,
                proposedFix: result.fix
            });
            healed++; // Count as "would have healed" for summary purposes
            continue;
        }

        // ─── PHASE 3: VERIFY ─────────────────────────
        console.log('  Phase 3: Applying fix and verifying...');

        // Backup
        const backupPath = createBackup(target.healTargetAbsolute);
        console.log(`  Backup created: ${backupPath}`);

        const applyResult = applyFix(target.healTargetAbsolute, result.fix, target.healLine);

        if (!applyResult.applied) {
            console.log(`  ❌ Fix could not be applied: ${applyResult.reason}`);
            restoreBackup(target.healTargetAbsolute, backupPath);
            escalate(
                { ...failure, healTarget: target.healTarget, targetFile: target.healTarget },
                { ...result, escalationReason: 'fix-not-applicable', applyFailureReason: applyResult.reason }
            );
            escalated++;
            console.log('');
            continue;
        }

        // Re-run the specific failing test
        const rerunResult = rerunTest(failure.specFile);

        if (rerunResult.passed) {
            console.log('  ✅ Re-run PASSED — fix is confirmed!');
            healed++;
            appendToHealingReport({
                status: 'healed',
                testName: failure.testName,
                specFile: failure.specFile,
                target: target.healTarget,
                fix: result.fix,
                backup: backupPath,
                selectorHistory: result.selectorHistory,
                matchCount: 1,
                attempts: 1
            });
        } else {
            console.log('  ❌ Re-run FAILED — restoring backup and escalating.');
            restoreBackup(target.healTargetAbsolute, backupPath);
            escalate(
                { ...failure, healTarget: target.healTarget, targetFile: target.healTarget },
                { ...result, escalationReason: 're-run-failed', wasBackupRestored: true }
            );
            escalated++;
        }

        console.log('');
    }

    // ─── FINAL SUMMARY ──────────────────────────────
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║                   SUMMARY                           ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Healed:    ${String(healed).padEnd(42)}║`);
    console.log(`║  Skipped:   ${String(skippedFailures.length).padEnd(42)}║`);
    console.log(`║  Escalated: ${String(escalated).padEnd(42)}║`);
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    if (config.dryRun) {
        console.log('This was a DRY RUN. No files were modified on disk.');
    }

    // Exit code: 0 if no escalations, 1 if any
    process.exit(escalated > 0 ? 1 : 0);
}

// Run
main().catch(e => {
    console.error(`Fatal error: ${e.message}`);
    process.exit(1);
});
