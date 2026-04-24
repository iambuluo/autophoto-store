/**
 * api/license-generate.js - 管理员生成授权码 API
 *
 * POST /api/license/generate
 *   body: { pluginId, plan, count, token }
 */

const pool = require('./lib/license-pool');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { pluginId, plan, count, token } = req.body || {};

    // 简单的 token 验证
    const adminToken = process.env.ADMIN_TOKEN || 'autophoto-admin-secret';
    if (!token || token !== adminToken) {
      res.status(403).json({ error: 'Unauthorized: 无效的管理员 Token' });
      return;
    }

    if (!pluginId || !plan) {
      res.status(400).json({ error: '缺少 pluginId 或 plan 参数' });
      return;
    }

    const n = Math.min(Math.max(parseInt(count) || 10, 1), 500);
    const codes = pool.generateCodes(pluginId, plan, n);

    console.log('Admin generated ' + codes.length + ' codes for ' + pluginId + '/' + plan);

    res.json({ success: true, pluginId, plan, count: codes.length, codes });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  }
};
