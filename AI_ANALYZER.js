const https = require('https');
const fs = require('fs');

// Get build log passed as argument
const buildLog = process.argv[2] || 'No log provided';
const apiKey = process.argv[3] || '';

const prompt = `You are a CI/CD expert. Analyze this Jenkins build log and provide:
1. Root cause of failure (1-2 sentences)
2. Exact fix needed (step by step)
3. Prevention tips

Build Log:
${buildLog.substring(0, 3000)}`;

const data = JSON.stringify({
  model: 'claude-sonnet-4-6',
  max_tokens: 500,
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
      const analysis = response.content[0].text;
      console.log(analysis);
    } catch (e) {
      console.log('Analysis failed: ' + e.message);
    }
  });
});

req.on('error', (e) => console.log('Error: ' + e.message));
req.write(data);
req.end();
