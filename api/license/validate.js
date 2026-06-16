/**
 * api/license/validate.js
 * GET /api/license/validate?code=xxx&machineCode=xxx
 * 在线心跳验证（插件可选调用）
 */

const pool = require('../lib/license-pool');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { code, machineCode } = req.query || {};
    if (!code || !machineCode) {
      res.status(400).json({ error: '缺少参数' }); return;
    }
    const result = await pool.validateLicense(
      code.trim().toUpperCase(),
      machineCode.trim().toUpperCase()
    );
    if (!result.valid) { res.status(403).json(result); return; }
    res.json(result);
  } catch (err) {
    console.error('validate error:', err);
    res.status(500).json({ error: err.message });
  }
};
