/**
 * 共享工具函数 - AutoPhoto Vercel Serverless
 * 注意：只导出 order-create.js 和其他 API 需要的函数
 * 邮件发送功能在 process.js 中单独处理
 */
const crypto = require('crypto');

const PLAN_PRICES = {
  testpay: 0.01,
  trial: 9.9,
  annual: 199,
  permanent: 399
};

const PLAN_LABELS = {
  testpay: '¥0.01 测试',
  trial: '1天试用',
  annual: '年度授权',
  permanent: '永久授权'
};

const PLAN_CHARS = {
  testpay: 'T',
  trial: 'T',
  annual: 'Y',
  permanent: 'P'
};

const DISCOUNTS = {
  1: 1.0, 2: 0.88, 3: 0.80, 4: 0.70, 5: 0.60, 6: 0.60, 7: 0.50
};

const PLUGIN_NAMES = {
  shijuezhongguo: '视觉中国自动提交',
  guangchang: '光厂批量提交助手',
  xinchangchang: '新片场 AIGC 助手',
  dreamstime: 'Dreamstime 自动提交',
  'adobe-stock': 'Adobe Stock 关键词点击器',
  'qingying-image': '清影批量生图助手',
  'qingying-video': '清影批量生视频助手'
};

const PLUGIN_PREFIXES = {
  shijuezhongguo: 'VCG',
  guangchang: 'VJ',
  xinchangchang: 'XC',
  dreamstime: 'DT',
  'adobe-stock': 'AS',
  'qingying-image': 'QY',
  'qingying-video': 'QV'
};

// 内存订单存储（Vercel Serverless 无状态，用 Map 存当前实例）
const pendingOrders = new Map();
const paidOrders = new Map();

function calcPrice(plugins, plan) {
  const count = plugins.length;
  const discount = DISCOUNTS[count] || 1.0;
  const unitPrice = PLAN_PRICES[plan] || 0;
  return parseFloat((unitPrice * count * discount).toFixed(2));
}

function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  switch (plan) {
    case 'trial':     return now + 1 * DAY;
    case 'annual':    return now + 365 * DAY;
    case 'permanent': return now + 99 * 365 * DAY;
    case 'testpay':   return now + 3600;
    default:          return now + 365 * DAY;
  }
}

function generateLicenseCode(pluginId, plan) {
  const prefix = PLUGIN_PREFIXES[pluginId] || 'XX';
  const planChar = PLAN_CHARS[plan] || 'X';
  const expiry = calcExpiry(plan);
  const expiryB36 = expiry.toString(36).toUpperCase();
  const rand = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `AP-${prefix}-${planChar}${expiryB36}-${rand}`;
}

function signXunhu(params, appSecret) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== 'hash' && v !== '' && v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + appSecret;
  return crypto.createHash('md5').update(str).digest('hex');
}

function verifyXunhuSign(params, appSecret) {
  const expectedHash = signXunhu(params, appSecret);
  return params.hash === expectedHash;
}

module.exports = {
  PLAN_PRICES, PLAN_LABELS, PLAN_CHARS, PLUGIN_NAMES, PLUGIN_PREFIXES,
  DISCOUNTS,
  pendingOrders, paidOrders,
  calcPrice, calcExpiry, generateLicenseCode,
  signXunhu, verifyXunhuSign
};
