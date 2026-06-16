/**
 * api/license/bind.js
 * POST /api/license/bind
 * 插件端激活：绑定授权码与机器码
 */

const pool = require('../lib/license-pool');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { code, machineCode, email } = req.body || {};
    if (!code || !machineCode) {
      res.status(400).json({ error: '缺少授权码或机器码' }); return;
    }
    const cleanCode = code.trim().toUpperCase();
    const cleanMachine = machineCode.trim().toUpperCase();
    if (cleanMachine.length < 6) {
      res.status(400).json({ error: '机器码格式无效' }); return;
    }

    const result = await pool.bindLicense(cleanCode, cleanMachine, email || '');

    if (result.error) {
      res.status(400).json({
        error: result.error,
        boundMachine: result.boundMachine || undefined
      });
      return;
    }

    const entry = result.entry;
    console.log(`Bind: ${cleanCode} -> ${cleanMachine} (${entry.plugin_id})`);
    res.json({
      success: true,
      alreadyBound: result.alreadyBound || false,
      pluginId: entry.plugin_id,
      plan: entry.plan,
      planName: pool.PLAN_NAMES[entry.plan],
      machineCode: cleanMachine,
      boundAt: entry.bound_at
    });
  } catch (err) {
    console.error('bind error:', err);
    res.status(500).json({ error: err.message });
  }
};
