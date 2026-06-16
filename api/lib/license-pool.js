/**
 * api/lib/license-pool.js — 授权码池管理（Supabase 版）
 *
 * 数据存储: Supabase PostgreSQL
 * 表: licenses, issued_orders
 * 所有操作走 SUPABASE_SERVICE_ROLE_KEY（全权限，服务端专用）
 */

const crypto = require('crypto');
const { getClient } = require('./supabase');

const ADMIN_EMAIL = 'tourinn@gmail.com';

// 插件列表
const PLUGINS = [
  'shijuezhongguo', 'guangchang', 'xinchangchang', 'dreamstime',
  'adobe-stock', 'qingying-image', 'qingying-video'
];

// 授权方案
const PLANS = ['trial', 'annual', 'permanent'];

// 插件前缀
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
// 数据库操作（替代原来的 fs.readFile/writeFile）
// ============================================================

/**
 * 查询单条授权码
 */
async function getLicenseByCode(code) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (error) throw new Error('DB error: ' + error.message);
  return data;
}

/**
 * 查询一条未使用的授权码
 */
async function findUnusedLicense(pluginId, plan) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('plugin_id', pluginId)
    .eq('plan', plan)
    .eq('status', 'unused')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('DB error: ' + error.message);
  return data;
}

/**
 * 更新授权码记录
 */
async function updateLicense(code, updates) {
  const supabase = getClient();
  const { error } = await supabase
    .from('licenses')
    .update(updates)
    .eq('code', code);
  if (error) throw new Error('DB update error: ' + error.message);
}

/**
 * 插入发行订单
 */
async function insertIssuedOrder(order) {
  const supabase = getClient();
  const { error } = await supabase
    .from('issued_orders')
    .insert([order]);
  if (error) throw new Error('DB insert issued_order error: ' + error.message);
}

/**
 * 查询所有授权码（用于管理后台列表）
 */
async function getAllLicenses() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error('DB error: ' + error.message);
  return data || [];
}

/**
 * 统计各插件/方案的数量
 */
async function getPoolStats() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('licenses')
    .select('plugin_id, plan, status');

  if (error) throw new Error('DB error: ' + error.message);

  const stats = {};
  for (const pluginId of PLUGINS) {
    stats[pluginId] = {};
    for (const plan of PLANS) {
      stats[pluginId][plan] = { total: 0, unused: 0, issued: 0, bound: 0, revoked: 0 };
    }
  }

  for (const row of (data || [])) {
    const { plugin_id, plan, status } = row;
    if (!stats[plugin_id] || !stats[plugin_id][plan]) continue;
    stats[plugin_id][plan].total++;
    if (['unused', 'issued', 'bound', 'revoked'].includes(status)) {
      stats[plugin_id][plan][status]++;
    }
  }

  return stats;
}

/**
 * 批量插入授权码（初始化/补充码池）
 */
async function insertLicenses(records) {
  if (!records.length) return;
  const supabase = getClient();
  const { error } = await supabase
    .from('licenses')
    .insert(records);
  if (error) throw new Error('DB batch insert error: ' + error.message);
}

/**
 * 根据订单号查发行记录
 */
async function findByOrderId(orderId) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('issued_orders')
    .select('*')
    .eq('order_id', orderId);
  if (error) throw new Error('DB error: ' + error.message);
  return data || [];
}

// ============================================================
// 自动初始化：确保每个 (plugin, plan) 有至少 100 个未使用授权码
// ============================================================
async function ensureMinPoolSize(minCount = 100) {
  for (const pluginId of PLUGINS) {
    for (const plan of PLANS) {
      const supabase = getClient();
      const { count, error } = await supabase
        .from('licenses')
        .select('*', { count: 'exact', head: true })
        .eq('plugin_id', pluginId)
        .eq('plan', plan)
        .eq('status', 'unused');

      if (error) { console.error('检查码池失败:', error); continue; }

      if (count < minCount) {
        const needed = minCount - count;
        console.log(`📦 ${pluginId}/${plan} 码池不足${minCount}个，补充 ${needed} 个...`);
        const records = [];
        for (let i = 0; i < needed; i++) {
          const prefix = PREFIXES[pluginId] || 'AP';
          records.push({
            code: `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            plugin_id: pluginId,
            plan,
            status: 'unused',
            machine_code: null,
            bound_email: null,
            bound_at: null,
            created_at: new Date().toISOString(),
            issued_at: null,
            issued_email: null,
            stripe_session_id: null,
            remark: null
          });
        }
        await insertLicenses(records);
        console.log(`✅ 补充完成！${pluginId}/${plan} 现有 ${count + needed} 个未使用授权码`);
      }
    }
  }
}

// ============================================================
// 核心操作 API（原有接口，改为异步）
// ============================================================

/**
 * 从池中取一个未使用的授权码
 * @returns {{ code, pluginId, plan } | null}
 */
async function allocateLicense(pluginId, plan, email, stripeSessionId) {
  await ensureMinPoolSize(100);

  const entry = await findUnusedLicense(pluginId, plan);
  if (!entry) {
    console.warn(`⚠️ 码池告警: ${pluginId}/${plan} 已耗尽！`);
    return null;
  }

  const now = new Date().toISOString();
  await updateLicense(entry.code, {
    status: 'issued',
    issued_at: now,
    issued_email: email,
    stripe_session_id: stripeSessionId
  });

  await insertIssuedOrder({
    order_id: stripeSessionId,
    code: entry.code,
    plugin_id: pluginId,
    plan,
    email,
    issued_at: now
  });

  // 告警：剩余码低于阈值
  const supabase = getClient();
  const { count } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('plugin_id', pluginId)
    .eq('plan', plan)
    .eq('status', 'unused');

  if (count <= 10) {
    console.warn(`🚨 码池告警: ${pluginId}/${plan} 仅剩 ${count} 个未使用授权码！`);
  }

  return {
    code: entry.code,
    pluginId: entry.plugin_id,
    plan: entry.plan
  };
}

/**
 * 分配多个插件的授权码（多插件订单）
 */
async function allocateMultipleLicenses(plugins, plan, email, stripeSessionId) {
  const results = [];
  for (const pluginId of plugins) {
    const entry = await allocateLicense(pluginId, plan, email, stripeSessionId);
    if (!entry) {
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
async function bindLicense(code, machineCode, email) {
  const entry = await getLicenseByCode(code);
  if (!entry) return { error: '授权码不存在' };

  if (entry.status === 'bound') {
    if (entry.machine_code === machineCode) {
      return { success: true, alreadyBound: true, entry };
    }
    return { error: '授权码已被其他设备绑定，禁止多设备共享', boundMachine: entry.machine_code };
  }
  if (entry.status === 'revoked') return { error: '授权码已被管理员吊销' };
  if (entry.status === 'unused') return { error: '授权码尚未发行，请先完成购买' };

  await updateLicense(code, {
    status: 'bound',
    machine_code: machineCode,
    bound_email: email,
    bound_at: new Date().toISOString()
  });

  const updated = await getLicenseByCode(code);
  return { success: true, entry: updated };
}

/**
 * 在线验证授权码 + 机器码
 */
async function validateLicense(code, machineCode) {
  const entry = await getLicenseByCode(code);
  if (!entry) return { valid: false, reason: '授权码不存在' };
  if (entry.status === 'revoked') return { valid: false, reason: '授权码已被吊销' };
  if (entry.status === 'unused') return { valid: false, reason: '授权码尚未发行' };
  if (entry.status === 'issued') return { valid: false, reason: '授权码尚未绑定设备' };
  if (entry.machine_code !== machineCode) {
    return { valid: false, reason: '机器码不匹配，当前设备未授权（检测到账号共享行为）' };
  }
  return {
    valid: true,
    pluginId: entry.plugin_id,
    plan: entry.plan,
    planName: PLAN_NAMES[entry.plan],
    boundAt: entry.bound_at
  };
}

/**
 * 吊销授权码
 */
async function revokeLicense(code) {
  const entry = await getLicenseByCode(code);
  if (!entry) return { error: '授权码不存在' };
  await updateLicense(code, { status: 'revoked' });
  return { success: true };
}

/**
 * 生成新授权码（管理员补充码池用）
 */
async function generateCodes(pluginId, plan, count) {
  const records = [];
  for (let i = 0; i < count; i++) {
    let code;
    let attempts = 0;
    do {
      const prefix = PREFIXES[pluginId] || 'AP';
      code = `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      attempts++;
    } while (attempts < 10 && (await getLicenseByCode(code)));

    if (attempts >= 10 && await getLicenseByCode(code)) {
      console.warn(`无法生成唯一授权码 (${i + 1}/${count})`);
      continue;
    }

    records.push({
      code,
      plugin_id: pluginId,
      plan,
      status: 'unused',
      machine_code: null,
      bound_email: null,
      bound_at: null,
      created_at: new Date().toISOString(),
      issued_at: null,
      issued_email: null,
      stripe_session_id: null,
      remark: null
    });
  }
  await insertLicenses(records);
  return records.map(r => r.code);
}

// ============================================================
// 兼容层：同步包装（供 stripe.js 等旧代码同步调用）
// 注意：stripe.js callback 是 async 的，bind/validate/generate 本身也是 async
// 实际上 API handler 已经是 async，这里只提供同步版本防止意外
// ============================================================
function readDB() {
  // 同步版仅用于向后兼容，不再真正使用
  console.warn('license-pool: readDB() 已废弃，请使用 async 版函数');
  return { licenses: [], issuedOrders: [] };
}

function writeDB() {
  console.warn('license-pool: writeDB() 已废弃，数据直接写入 Supabase');
}

// ============================================================
// 导出
// ============================================================
module.exports = {
  PLUGINS, PLANS, PREFIXES, PLAN_NAMES, PLUGIN_NAMES_CN,
  ADMIN_EMAIL,
  // 异步核心 API
  allocateLicense, allocateMultipleLicenses,
  bindLicense, validateLicense, revokeLicense,
  generateCodes, getPoolStats, getAllLicenses, findByOrderId,
  // 废弃同步 API（兼容用）
  readDB, writeDB,
  // 内部工具（供 API handler 用）
  getLicenseByCode, ensureMinPoolSize
};
