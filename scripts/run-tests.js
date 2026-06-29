const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Determine paths
const resultsDir = path.join(__dirname, '..', 'test-results', 'allure-results');
const reportDir = path.join(__dirname, '..', 'test-results', 'allure-report');

// Run Playwright tests, forwarding all command-line arguments
console.log('Starting Playwright test runner...');
const playwrightArgs = ['playwright', 'test', ...process.argv.slice(2)];

const playwright = spawn('npx', playwrightArgs, {
    stdio: 'inherit',
    shell: true
});

playwright.on('close', (code) => {
    console.log(`Playwright process finished with exit code: ${code}`);

    // Check if the results directory exists and is not empty before generating the report
    if (fs.existsSync(resultsDir)) {
        console.log('Generating Allure report from results...');
        
        const allure = spawn('npx', ['allure', 'generate', resultsDir, '-o', reportDir], {
            stdio: 'inherit',
            shell: true
        });

        allure.on('close', (allureCode) => {
            if (allureCode === 0) {
                console.log(`Allure report successfully generated at: ${reportDir}`);
            } else {
                console.error(`Allure report generation failed with exit code: ${allureCode}`);
            }
            // Exit with the original Playwright test status code
            process.exit(code);
        });
    } else {
        console.warn(`No Allure results directory found at: ${resultsDir}. Skipping report generation.`);
        process.exit(code);
    }
});
