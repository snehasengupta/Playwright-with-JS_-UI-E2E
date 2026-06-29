const https = require('https');
const fs = require('fs');

// argv[2] = API key, argv[3] = build log (optional)
const apiKey = process.argv[2] || '';
const buildLog = process.argv[3] || 'Build completed - analyze and provide general CI/CD health tips';

if (!apiKey) {
  fs.writeFileSync('ai-analysis.txt', 'Error: No API key provided');
  process.exit(1);
}

const prompt = `You are a CI/CD expert. Analyze this Jenkins build log and provide:
1. Root cause of failure (1-2 sentences, or "All tests passed" if successful)
2. Exact fix needed (step by step, or "No action needed" if successful)
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
      if (response.error) {
        fs.writeFileSync('ai-analysis.txt', 'API Error: ' + response.error.message);
        return;
      }
      const analysis = response.content[0].text;
      fs.writeFileSync('ai-analysis.txt', analysis);
      console.log('AI Analysis saved successfully');
    } catch (e) {
      fs.writeFileSync('ai-analysis.txt', 'Analysis failed: ' + e.message + '\nRaw: ' + body);
      console.log('Analysis failed: ' + e.message);
    }
  });
});

req.on('error', (e) => {
  fs.writeFileSync('ai-analysis.txt', 'Connection error: ' + e.message);
  console.log('Error: ' + e.message);
});

req.write(data);
req.end();
