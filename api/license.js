/**
 * api/license.js - 授权码绑定 & 在线验证 API
 *
 * POST /api/license/bind
 *   body: { code, machineCode, email? }
 *   -> 首次激活：绑定授权码与机器码
 *
 * GET  /api/license/validate?code=xxx&machineCode=xxx
 *   -> 在线心跳验证（可选，插件平时本地验证即可）
 *
 * GET  /api/license/pool-stats
 *   -> 管理员查看码池状态
 */

const pool = require('./lib/license-pool');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const pathname = req.url.split('?')[0];

  try {
    if (req.method === 'POST' && pathname.endsWith('/bind')) {
      await handleBind(req, res);
    } else if (req.method === 'GET') {
      if (pathname.endsWith('/validate')) {
        await handleValidate(req, res);
      } else if (pathname.endsWith('/pool-stats')) {
        await handlePoolStats(req, res);
      } else {
        await handleQuery(req, res);
      }
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    console.error('license API error:', err);
    res.status(500).json({ error: err.message });
  }
};

async function handleBind(req, res) {
  const { code, machineCode, email } = req.body || {};
  if (!code || !machineCode) {
    res.status(400).json({ error: '缺少授权码或机器码' }); return;
  }
  const cleanCode = code.trim().toUpperCase();
  const cleanMachine = machineCode.trim().toUpperCase();
  if (cleanMachine.length < 6) {
    res.status(400).json({ error: '机器码格式无效' }); return;
  }
  const result = pool.bindLicense(cleanCode, cleanMachine, email || '');
  if (result.error) {
    res.status(400).json({ error: result.error, boundMachine: result.boundMachine || undefined });
    return;
  }
  const entry = result.entry;
  console.log('Bind: ' + cleanCode + ' -> ' + cleanMachine + ' (' + entry.pluginId + ')');
  res.json({
    success: true,
    alreadyBound: result.alreadyBound || false,
    pluginId: entry.pluginId,
    plan: entry.plan,
    planName: pool.PLAN_NAMES[entry.plan],
    machineCode: cleanMachine,
    boundAt: entry.boundAt
  });
}

async function handleValidate(req, res) {
  const { code, machineCode } = req.query || {};
  if (!code || !machineCode) { res.status(400).json({ error: '缺少参数' }); return; }
  const result = pool.validateLicense(code.trim().toUpperCase(), machineCode.trim().toUpperCase());
  if (!result.valid) { res.status(403).json(result); return; }
  res.json(result);
}

async function handleQuery(req, res) {
  const { code } = req.query || {};
  if (!code) { res.status(400).json({ error: '缺少 code 参数' }); return; }
  const entry = pool.findByCode(code.trim().toUpperCase());
  if (!entry) { res.status(404).json({ error: '授权码不存在' }); return; }
  res.json({
    code: entry.code,
    pluginId: entry.pluginId,
    pluginName: pool.PLUGIN_NAMES_CN[entry.pluginId] || entry.pluginId,
    planName: pool.PLAN_NAMES[entry.plan] || entry.plan,
    status: entry.status,
    ...(entry.status === 'bound' ? { bound: true, boundAt: entry.boundAt } : {})
  });
}

async function handlePoolStats(req, res) {
  const token = req.query.token;
  const adminToken = process.env.ADMIN_TOKEN || 'autophoto-admin-secret';
  if (token !== adminToken) { res.status(403).json({ error: 'Unauthorized' }); return; }
  const stats = pool.getPoolStats();
  const db = pool.readDB();
  res.json({
    stats,
    summary: {
      total: db.licenses.length,
      unused: db.licenses.filter(l => l.status === 'unused').length,
      issued: db.licenses.filter(l => l.status === 'issued').length,
      bound: db.licenses.filter(l => l.status === 'bound').length,
      revoked: db.licenses.filter(l => l.status === 'revoked').length
    }
  });
}
