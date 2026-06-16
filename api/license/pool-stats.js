/**
 * api/license/pool-stats.js
 *
 * 合并管理员操作接口（Supabase 版）：
 *
 * GET  /api/license/pool-stats?token=xxx           → 码池统计
 * GET  /api/license/pool-stats?token=xxx&action=list  → 所有授权码明细
 * POST /api/license/pool-stats (body: {action:'remark',code,remark,token}) → 保存备注
 * POST /api/license/pool-stats (body: {action:'revoke',code,token}) → 吊销授权码
 */

const pool = require('../lib/license-pool');

const _rateMap = new Map();
function checkRate(ip, limit = 20) {
  const now = Date.now();
  const entry = _rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    _rateMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRate(ip)) {
    res.status(429).json({ error: '请求过于频繁，请稍后再试' }); return;
  }

  const adminToken = process.env.ADMIN_TOKEN || 'autophoto-admin-secret';

  // ===== GET 请求 =====
  if (req.method === 'GET') {
    const { token, action } = req.query;
    if (!token || token !== adminToken) {
      console.warn(`[Admin] 无效 Token，IP: ${ip}`);
      res.status(403).json({ error: 'Unauthorized' }); return;
    }

    try {
      if (action === 'list') {
        const licenses = await pool.getAllLicenses();
        const result = licenses.map(l => ({
          code: l.code, pluginId: l.plugin_id, plan: l.plan, status: l.status,
          issuedEmail: l.issued_email || null, boundEmail: l.bound_email || null,
          machineCode: l.machine_code || null,
          boundAt: l.bound_at || null, issuedAt: l.issued_at || null,
          createdAt: l.created_at || null,
          remark: l.remark || ''
        }));
        res.json({ licenses: result, total: result.length });
      } else {
        const stats = await pool.getPoolStats();
        const allLicenses = await pool.getAllLicenses();
        res.json({
          stats,
          summary: {
            total:    allLicenses.length,
            unused:   allLicenses.filter(l => l.status === 'unused').length,
            issued:   allLicenses.filter(l => l.status === 'issued').length,
            bound:    allLicenses.filter(l => l.status === 'bound').length,
            revoked:  allLicenses.filter(l => l.status === 'revoked').length
          }
        });
      }
    } catch (err) {
      console.error('pool-stats error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // ===== POST 请求 =====
  if (req.method === 'POST') {
    const { token, action, code, remark } = req.body || {};
    if (!token || token !== adminToken) {
      res.status(403).json({ error: 'Unauthorized' }); return;
    }
    if (!code) { res.status(400).json({ error: '缺少 code 参数' }); return; }

    try {
      const { getClient } = require('../lib/supabase');
      const supabase = getClient();

      if (action === 'remark') {
        await supabase
          .from('licenses')
          .update({ remark: (remark || '').trim().slice(0, 200) || null })
          .eq('code', code.trim().toUpperCase());
        res.json({ success: true });
      } else if (action === 'revoke') {
        const result = await pool.revokeLicense(code.trim().toUpperCase());
        if (result.error) { res.status(400).json({ error: result.error }); return; }
        console.log(`[Admin] 吊销授权码: ${code}`);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: '未知 action' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
