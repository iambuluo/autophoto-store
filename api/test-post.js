module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { plugins, plan, name, email } = req.body || {};
  if (!plugins?.length) return res.status(400).json({ error: 'no plugins' });

  // Test crypto
  const crypto = require('crypto');
  const randomBytes = crypto.randomBytes(5).toString('hex');
  const randomInt = crypto.randomInt ? crypto.randomInt(1000, 9999) : 'no-randomInt';

  res.status(200).json({
    success: true,
    plugins, plan, name, email,
    crypto_test: { randomBytes, randomInt },
    time: Date.now()
  });
};
