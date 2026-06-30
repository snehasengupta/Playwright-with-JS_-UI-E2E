const fs = require('fs');
const path = require('path');

const ESCALATION_FILE = path.join(__dirname, '..', '..', 'healing-escalation.json');

/**
 * Append an escalation entry to healing-escalation.json.
 * Never overwrites — a single run can produce multiple escalation entries.
 *
 * @param {object} failureDetails - Original failure info (specFile, testName, errorMessage, etc.)
 * @param {object} healingAttempt - Result from healing-agent (success, fix, selectorHistory, escalationReason)
 */
function escalate(failureDetails, healingAttempt) {
    const entry = {
        timestamp: new Date().toISOString(),
        testName: failureDetails.testName || 'Unknown',
        specFile: failureDetails.specFile || 'Unknown',
        targetFile: failureDetails.healTarget || failureDetails.targetFile || 'Unknown',
        originalError: (failureDetails.errorMessage || '').substring(0, 500),
        escalationReason: healingAttempt.escalationReason || 'unknown',
        healingDetails: {
            selectorHistory: healingAttempt.selectorHistory || [],
            proposedFix: healingAttempt.fix || null,
            wasBackupRestored: healingAttempt.wasBackupRestored || false
        },
        actionNeeded: getActionNeededMessage(healingAttempt.escalationReason)
    };

    // Read existing escalations (if any)
    let escalations = [];
    try {
        if (fs.existsSync(ESCALATION_FILE)) {
            const content = fs.readFileSync(ESCALATION_FILE, 'utf-8');
            escalations = JSON.parse(content);
            if (!Array.isArray(escalations)) {
                escalations = [escalations]; // Handle legacy single-object format
            }
        }
    } catch (e) {
        // If the file is corrupt, start fresh
        escalations = [];
    }

    // Append the new entry
    escalations.push(entry);

    // Write back
    fs.writeFileSync(ESCALATION_FILE, JSON.stringify(escalations, null, 2));

    // Console output for CI visibility
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log('  ║  ESCALATION — Human Review Required                 ║');
    console.log('  ╠══════════════════════════════════════════════════════╣');
    console.log(`  ║  Test:     ${entry.testName.substring(0, 43).padEnd(43)}║`);
    console.log(`  ║  Reason:   ${entry.escalationReason.substring(0, 43).padEnd(43)}║`);
    console.log(`  ║  Target:   ${entry.targetFile.substring(0, 43).padEnd(43)}║`);
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log(`  Details written to: ${ESCALATION_FILE}`);
    console.log('');
}

/**
 * Generate a human-readable action-needed message based on the escalation reason.
 * @param {string} reason
 * @returns {string}
 */
function getActionNeededMessage(reason) {
    switch (reason) {
        case 'fix-not-applicable':
            return 'The proposed fix could not be located at the expected line in the target file (the file may have changed since analysis, or the AI proposed an incorrectly formatted original_line). The original file has been restored from backup. Manual investigation required.';
        case 'ambiguous-match':
            return 'Multiple elements matched the candidate selector. Manual selector disambiguation required — inspect the page and choose the correct element.';
        case 'auth-blocked':
            return 'Could not log in to reach the target page. Check if login credentials are valid and the login page locators are not broken.';
        case 're-run-failed':
            return 'The proposed fix was applied but the test still failed on re-run. The original file has been restored from backup. Manual investigation required.';
        case 'max-iterations':
            return 'The healing agent exhausted its maximum iteration limit without finding a valid fix. The page structure may have changed significantly.';
        default:
            return `Unexpected escalation: ${reason}. Manual investigation required.`;
    }
}

module.exports = { escalate };
