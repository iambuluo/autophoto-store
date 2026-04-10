/**
 * ============================================================
 * 定价配置表 — 全站唯一数据源
 * ============================================================
 * 修改价格/折扣/插件时，只需改这里
 *
 * PLAN_LABELS:   显示名称
 * PLAN_PRICES:   单个插件单价（元）
 * PLAN_EXPIRY:   授权到期时长（天），99年=永久
 * DISCOUNTS:     多插件折扣（按选择数量）
 *
 * 注意：Edge Runtime（callback.js）使用 crypto.getRandomValues
 *       Node.js（order-create.js / process.js）使用 require('crypto')
 *       两者的随机数生成方式不同，但不影响授权码格式
 */

const PLAN_LABELS = {
  testpay: '¥0.01 测试',
  trial: '1天试用',
  annual: '年度授权',
  permanent: '永久授权'
};

const PLAN_PRICES = {
  testpay: 0.01,   // 真实支付测试
  trial: 9.9,      // 1天试用
  annual: 199,     // 年度
  permanent: 399  // 永久
};

// 多插件折扣（按同时购买的数量）
const DISCOUNTS = {
  1: 1.0,   // 无折扣
  2: 0.88,  // 88折
  3: 0.80,  // 8折
  4: 0.70,  // 7折
  5: 0.60,  // 6折
  6: 0.60,  // 6折
  7: 0.50   // 5折
};

// 插件清单
const PLUGIN_NAMES = {
  shijuezhongguo: '视觉中国自动提交',
  guangchang: '光厂批量提交助手',
  xinchangchang: '新片场 AIGC 助手',
  dreamstime: 'Dreamstime 自动提交',
  'adobe-stock': 'Adobe Stock 关键词点击器',
  'qingying-image': '清影批量生图助手',
  'qingying-video': '清影批量生视频助手'
};

// 授权码前缀
const PLUGIN_PREFIXES = {
  shijuezhongguo: 'VCG',
  guangchang: 'VJ',
  xinchangchang: 'XC',
  dreamstime: 'DT',
  'adobe-stock': 'AS',
  'qingying-image': 'QY',
  'qingying-video': 'QV'
};

// 授权码方案字符
const PLAN_CHARS = {
  testpay: 'T',    // 测试
  trial: 'T',      // 1天试用
  annual: 'Y',     // 年付
  permanent: 'P'   // 永久
};

// 计算最终价格
function calcPrice(plugins, plan) {
  const count = plugins.length;
  const discount = DISCOUNTS[count] || 1.0;
  return parseFloat((PLAN_PRICES[plan] * count * discount).toFixed(2));
}

// 计算到期时间戳（Unix秒）
function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  switch (plan) {
    case 'testpay':
    case 'trial':     return now + 1 * DAY;       // 1天
    case 'annual':    return now + 365 * DAY;     // 365天
    case 'permanent': return now + 99 * 365 * DAY;// 99年
    default:          return now + 1 * DAY;
  }
}

// 生成随机hex（兼容 Edge Runtime 和 Node.js）
function randomHex(bytes) {
  // Edge Runtime: crypto.getRandomValues (浏览器Web Crypto API)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
      .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  // Node.js
  try {
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomBytes(bytes).toString('hex').toUpperCase();
  } catch (e) {
    // fallback: Math.random (不推荐用于生产)
    return Array.from({ length: bytes * 2 }, () =>
      Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
  }
}

// 生成授权码（带插件名标注）
// 格式：AP-VCG-视觉中国-T1KZQMN4-A3F2B
//       AP-{前缀}-{插件名}-{方案字符}{到期时间B36}-{随机hex}
function generateLicenseCode(pluginId, plan) {
  const prefix = PLUGIN_PREFIXES[pluginId] || 'XX';
  const planChar = PLAN_CHARS[plan] || 'X';
  const expiry = calcExpiry(plan);
  const expiryB36 = expiry.toString(36).toUpperCase();
  const rand = randomHex(6);
  const pluginLabel = PLUGIN_NAMES[pluginId] || pluginId;
  return {
    label: `[${pluginLabel}]`,
    code: `AP-${prefix}-${planChar}${expiryB36}-${rand}`
  };
}

// 从纯授权码还原插件名（用于邮件标注）
// 格式: AP-VCG-T1KZQMN4-A3F2B -> [视觉中国自动提交]
function getCodeLabel(code, plugins) {
  if (!code || !plugins || plugins.length === 0) return '[未知插件]';
  // 从码前缀匹配插件
  const codePrefix = code.split('-')[1]; // e.g. "VCG"
  for (const [pid, prefix] of Object.entries(PLUGIN_PREFIXES)) {
    if (prefix === codePrefix) return `[${PLUGIN_NAMES[pid] || pid}]`;
  }
  // 按顺序匹配（不够时循环）
  const idx = plugins.length > 1 ? (code ? code.charCodeAt(code.length - 1) % plugins.length : 0) : 0;
  return `[${PLUGIN_NAMES[plugins[idx]] || plugins[idx]}]`;
}

module.exports = {
  PLAN_LABELS, PLAN_PRICES, PLAN_CHARS,
  DISCOUNTS, PLUGIN_NAMES, PLUGIN_PREFIXES,
  calcPrice, calcExpiry, generateLicenseCode, getCodeLabel, randomHex
};
