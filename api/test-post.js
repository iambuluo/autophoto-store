module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  console.log('body type:', typeof req.body);
  console.log('body:', JSON.stringify(req.body));
  const { plugins, plan, name, email } = req.body || {};
  if (!plugins?.length) return res.status(400).json({ error: 'no plugins' });
  if (!email) return res.status(400).json({ error: 'no email' });
  res.status(200).json({ success: true, received: { plugins, plan, name, email }, time: Date.now() });
};
