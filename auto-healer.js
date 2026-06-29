const https = require('https');
const fs = require('fs');
const path = require('path');

const apiKey = process.argv[2] || '';
const failedTestFile = process.argv[3] || '';

if (!apiKey || !failedTestFile) {
  console.log('Usage: node auto-healer.js <apiKey> <testFile>');
  process.exit(1);
}

// Read the failed test file
const testCode = fs.readFileSync(failedTestFile, 'utf8');

const prompt = `You are a Playwright test automation expert.

This Playwright test is failing. Analyze the code and fix ONLY broken selectors or locators.

Rules:
1. Only fix selectors/locators that are likely broken
2. Use more resilient selectors (data-testid, role, text)
3. Return ONLY the fixed code, no explanation
4. Keep everything else exactly the same

Failed Test Code:
${testCode}

Return only the complete fixed JavaScript code.`;

const data = JSON.stringify({
  model: 'claude-sonnet-4-6',
  max_tokens: 2000,
  messages: [{ role: 'user', content: prompt }]
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
        console.log('API Error:', response.error.message);
        process.exit(1);
      }

      let fixedCode = response.content[0].text;

      // Remove markdown code blocks if present
      fixedCode = fixedCode.replace(/```javascript\n?/g, '').replace(/```\n?/g, '').trim();

      // Backup original file
      const backupFile = failedTestFile + '.backup';
      fs.copyFileSync(failedTestFile, backupFile);
      console.log('Original backed up to:', backupFile);

      // Write fixed code
      fs.writeFileSync(failedTestFile, fixedCode);
      console.log('Auto-healed:', failedTestFile);

      // Save healing report
      const report = {
        timestamp: new Date().toISOString(),
        file: failedTestFile,
        status: 'healed',
        backup: backupFile
      };
      fs.writeFileSync('healing-report.json', JSON.stringify(report, null, 2));

    } catch (e) {
      console.log('Healing failed:', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.log('Connection error:', e.message);
  process.exit(1);
});

req.write(data);
req.end();
