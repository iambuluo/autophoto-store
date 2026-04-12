module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { plugins, plan, name, email } = req.body || {};
  if (!plugins?.length) return res.status(400).json({ error: 'no plugins' });

  // 测试 fetch
  try {
    const resp = await fetch('https://api.github.com/zen', { method: 'GET' });
    const text = await resp.text();
    res.status(200).json({ success: true, github_zen: text, time: Date.now() });
  } catch (e) {
    res.status(200).json({ success: false, error: e.message });
  }
};
