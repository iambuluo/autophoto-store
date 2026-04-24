/**
 * lib/license-pool.js — 授权码池管理
 *
 * 数据库文件: /tmp/license-pool.json
 * 结构:
 *   licenses[] — 所有授权码
 *   pools{}    — 每个 (pluginId, plan) 的码池统计
 */

const fs = require('fs');
const crypto = require('crypto');

const DB_FILE = '/tmp/license-pool.json';
const ADMIN_EMAIL = 'tourinn@gmail.com';

// 插件列表
const PLUGINS = [
  'shijuezhongguo', 'guangchang', 'xinchangchang', 'dreamstime',
  'adobe-stock', 'qingying-image', 'qingying-video'
];

// 授权方案
const PLANS = ['trial', 'annual', 'permanent'];

// 插件前缀（用于授权码格式 AP-{prefix}-{random})
const PREFIXES = {
  shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC',
  dreamstime: 'DT', 'adobe-stock': 'AS',
  'qingying-image': 'QY', 'qingying-video': 'QV'
};

const PLAN_NAMES = {
  trial: '试用版', annual: '年度授权', permanent: '永久授权'
};
const PLUGIN_NAMES_CN = {
  shijuezhongguo: '视觉中国自动提交插件',
  guangchang: '光厂批量填写助手',
  xinchangchang: '新片场AIGC提交助手',
  dreamstime: 'Dreamstime Auto Submitter',
  'adobe-stock': 'Adobe Stock关键词助手',
  'qingying-image': '清影批量生图片助手',
  'qingying-video': '清影批量生视频助手'
};

// ============================================================
// 初始化：确保每个 (plugin, plan) 有 100 个未使用授权码
// ============================================================
function initLicensePool(db) {
  let changed = false;
  for (const pluginId of PLUGINS) {
    for (const plan of PLANS) {
      const key = `${pluginId}:${plan}`;
      const unused = db.licenses.filter(
        l => l.pluginId === pluginId && l.plan === plan && l.status === 'unused'
      );
      if (unused.length < 100) {
        const needed = 100 - unused.length;
        for (let i = 0; i < needed; i++) {
          const prefix = PREFIXES[pluginId] || 'AP';
          const code = `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          db.licenses.push({
            code,
            pluginId,
            plan,
            status: 'unused',
            machineCode: null,
            boundEmail: null,
            boundAt: null,
            createdAt: new Date().toISOString(),
            issuedAt: null
          });
        }
        changed = true;
      }
    }
  }
  return changed;
}

// ============================================================
// 数据库读写
// ============================================================
function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(raw);
    // 每次读取时自动补码
    if (initLicensePool(db)) writeDB(db);
    return db;
  } catch {
    const db = { licenses: [], issuedOrders: [] };
    initLicensePool(db);
    writeDB(db);
    return db;
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ============================================================
// 核心操作
// ============================================================

/**
 * 从池中取一个未使用的授权码
 * @returns {{ code, pluginId, plan } | null}
 */
function allocateLicense(pluginId, plan, email, stripeSessionId) {
  const db = readDB();
  const entry = db.licenses.find(
    l => l.pluginId === pluginId && l.plan === plan && l.status === 'unused'
  );
  if (!entry) {
    console.warn(`⚠️ 码池告警: ${pluginId}/${plan} 已耗尽！`);
    return null;
  }
  entry.status = 'issued';
  entry.issuedAt = new Date().toISOString();
  entry.issuedEmail = email;
  entry.stripeSessionId = stripeSessionId;

  // 记录发行订单
  db.issuedOrders.push({
    orderId: stripeSessionId,
    code: entry.code,
    pluginId,
    plan,
    email,
    issuedAt: entry.issuedAt
  });

  writeDB(db);

  // 告警：剩余码低于阈值
  const remaining = db.licenses.filter(
    l => l.pluginId === pluginId && l.plan === plan && l.status === 'unused'
  ).length;
  if (remaining <= 10) {
    console.warn(`🚨 码池告警: ${pluginId}/${plan} 仅剩 ${remaining} 个未使用授权码！`);
  }

  return entry;
}

/**
 * 分配多个插件的授权码（多插件订单）
 * @returns {Array<{ code, pluginId, plan }>}
 */
function allocateMultipleLicenses(plugins, plan, email, stripeSessionId) {
  const results = [];
  for (const pluginId of plugins) {
    const entry = allocateLicense(pluginId, plan, email, stripeSessionId);
    if (!entry) {
      // 某个插件码池耗尽，记录但继续
      results.push({ pluginId, plan, code: null, error: '码池耗尽' });
    } else {
      results.push(entry);
    }
  }
  return results;
}

/**
 * 绑定授权码与机器码（插件首次激活时调用）
 */
function bindLicense(code, machineCode, email) {
  const db = readDB();
  const entry = db.licenses.find(l => l.code === code);
  if (!entry) return { error: '授权码不存在' };
  if (entry.status === 'bound') {
    if (entry.machineCode === machineCode) {
      // 同一台机器重绑定，正常
      return { success: true, alreadyBound: true, entry };
    }
    return { error: '授权码已被其他设备绑定', boundMachine: entry.machineCode };
  }
  if (entry.status === 'revoked') {
    return { error: '授权码已被管理员吊销' };
  }
  // 未发行的码不能绑定
  if (entry.status === 'unused') {
    return { error: '授权码尚未发行，请先完成购买' };
  }

  entry.status = 'bound';
  entry.machineCode = machineCode;
  entry.boundEmail = email;
  entry.boundAt = new Date().toISOString();
  writeDB(db);
  return { success: true, entry };
}

/**
 * 在线验证授权码 + 机器码（可选心跳用）
 */
function validateLicense(code, machineCode) {
  const db = readDB();
  const entry = db.licenses.find(l => l.code === code);
  if (!entry) return { valid: false, reason: '授权码不存在' };
  if (entry.status === 'revoked') return { valid: false, reason: '授权码已被吊销' };
  if (entry.status === 'unused') return { valid: false, reason: '授权码尚未发行' };
  if (entry.status === 'issued') return { valid: false, reason: '授权码尚未绑定设备' };
  if (entry.machineCode !== machineCode) {
    return { valid: false, reason: '机器码不匹配（设备变更或账号共享）' };
  }
  return {
    valid: true,
    pluginId: entry.pluginId,
    plan: entry.plan,
    planName: PLAN_NAMES[entry.plan],
    boundAt: entry.boundAt
  };
}

/**
 * 吊销授权码
 */
function revokeLicense(code) {
  const db = readDB();
  const entry = db.licenses.find(l => l.code === code);
  if (!entry) return { error: '授权码不存在' };
  entry.status = 'revoked';
  writeDB(db);
  return { success: true };
}

/**
 * 生成新授权码（管理员补充码池用）
 */
function generateCodes(pluginId, plan, count) {
  const db = readDB();
  const prefix = PREFIXES[pluginId] || 'AP';
  const results = [];
  for (let i = 0; i < count; i++) {
    let code;
    let attempts = 0;
    do {
      code = `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      attempts++;
    } while (db.licenses.find(l => l.code === code) && attempts < 10);

    db.licenses.push({
      code, pluginId, plan,
      status: 'unused',
      machineCode: null, boundEmail: null, boundAt: null,
      createdAt: new Date().toISOString(), issuedAt: null
    });
    results.push(code);
  }
  writeDB(db);
  return results;
}

/**
 * 获取码池统计
 */
function getPoolStats() {
  const db = readDB();
  const stats = {};
  for (const pluginId of PLUGINS) {
    stats[pluginId] = {};
    for (const plan of PLANS) {
      const pool = db.licenses.filter(l => l.pluginId === pluginId && l.plan === plan);
      stats[pluginId][plan] = {
        total: pool.length,
        unused: pool.filter(l => l.status === 'unused').length,
        issued: pool.filter(l => l.status === 'issued').length,
        bound: pool.filter(l => l.status === 'bound').length,
        revoked: pool.filter(l => l.status === 'revoked').length
      };
    }
  }
  return stats;
}

/**
 * 根据授权码查找记录
 */
function findByCode(code) {
  const db = readDB();
  return db.licenses.find(l => l.code === code) || null;
}

/**
 * 根据订单号查找发行记录
 */
function findByOrderId(orderId) {
  const db = readDB();
  return db.issuedOrders.filter(o => o.orderId === orderId);
}

module.exports = {
  PLUGINS, PLANS, PREFIXES, PLAN_NAMES, PLUGIN_NAMES_CN,
  readDB, writeDB, initLicensePool,
  allocateLicense, allocateMultipleLicenses,
  bindLicense, validateLicense, revokeLicense,
  generateCodes, getPoolStats, findByCode, findByOrderId,
  ADMIN_EMAIL
};
