const https = require('https');

const payload = JSON.stringify({
  plugins: ["dreamstime"],
  plan: "annual",
  email: "test@test.com",
  name: "testuser"
});

const options = {
  hostname: 'www.autophoto.store',
  port: 443,
  path: '/api/stripe',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  },
  timeout: 20000
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
    process.exit(0);
  });
});
req.on('error', e => { console.log('Error:', e.message); process.exit(1); });
req.on('timeout', () => { console.log('Timeout'); req.destroy(); process.exit(1); });
req.write(payload);
req.end();
