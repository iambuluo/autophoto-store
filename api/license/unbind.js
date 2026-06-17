/**
 * api/license/unbind.js
 * POST /api/license/unbind
 * 管理员解除授权码绑定（换绑/换设备用）
 */

const pool = require('../lib/license-pool');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { code, token } = req.body || {};
    if (!code || !token) {
      res.status(400).json({ error: '缺少参数' }); return;
    }

    // 验证管理员 token
    const adminToken = process.env.ADMIN_TOKEN || '4a65682ca358d86397d4269a3ee6dd1e11193bbcb5371213';
    if (token !== adminToken) {
      res.status(403).json({ error: 'Token 无效' }); return;
    }

    const cleanCode = code.trim().toUpperCase();
    const result = await pool.unbindLicense(cleanCode);

    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }

    console.log(`Unbind: ${cleanCode} -> ${result.machineCode} -> null`);
    res.json({
      success: true,
      code: cleanCode,
      oldMachineCode: result.machineCode
    });
  } catch (err) {
    console.error('unbind error:', err);
    res.status(500).json({ error: err.message });
  }
};
