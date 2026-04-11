/**
 * POST /api/order-test
 * 测试订单API - 零依赖版本，完整授权码格式
 */

// ===== 内联配置（无外部依赖）=====
const PLAN_LABELS = {
  testpay: '¥0.01 测试',
  trial: '1天试用',
  annual: '年度授权',
  permanent: '永久授权'
};

const PLAN_PRICES = {
  testpay: 0.01,
  trial: 9.9,
  annual: 199,
  permanent: 399
};

const PLUGIN_NAMES = {
  'qingying-image': '清影批量生图助手',
  'qingying-video': '清影批量生视频助手',
  'shijuezhongguo': '视觉中国自动提交',
  'guangchang': '光厂批量提交助手',
  'xinchangchang': '新片场 AIGC 助手',
  'dreamstime': 'Dreamstime 自动提交',
  'adobe-stock': 'Adobe Stock 关键词点击器'
};

const PLUGIN_PREFIXES = {
  'qingying-image': 'QY',
  'qingying-video': 'QV',
  'shijuezhongguo': 'VCG',
  'guangchang': 'VJ',
  'xinchangchang': 'XC',
  'dreamstime': 'DT',
  'adobe-stock': 'AS'
};

const PLAN_CHARS = {
  testpay: 'T',
  trial: 'T',
  annual: 'Y',
  permanent: 'P'
};

// ===== 工具函数 =====
function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  switch (plan) {
    case 'testpay':
    case 'trial':     return now + 1 * DAY;
    case 'annual':    return now + 365 * DAY;
    case 'permanent': return now + 99 * 365 * DAY;
    default:          return now + 1 * DAY;
  }
}

function randomHex(bytes) {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

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

// ===== 主处理函数 =====
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST请求' });
  }
  
  try {
    const { plugins, plan, name, email } = req.body || {};
    
    // 验证参数
    if (!plugins || !Array.isArray(plugins) || plugins.length === 0) {
      return res.status(400).json({ success: false, error: '请至少选择一个插件' });
    }
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ success: false, error: '无效的授权类型' });
    }
    
    // 生成授权码
    const codeEntries = plugins.map(p => generateLicenseCode(p, plan));
    const licenseCodes = codeEntries.map(e => e.code);
    const licenseCodesLabeled = codeEntries.map(e => `${e.label} ${e.code}`);
    
    // 模拟订单
    const total = PLAN_PRICES[plan] * plugins.length;
    const orderNo = 'TEST_' + Date.now();
    
    console.log('[order-test] 订单:', orderNo);
    console.log('[order-test] 授权码:', licenseCodesLabeled.join(' | '));
    
    return res.status(200).json({
      success: true,
      mode: 'test',
      message: '测试成功！授权码已生成',
      orderNo,
      total,
      planName: PLAN_LABELS[plan],
      plugins: plugins.map(p => PLUGIN_NAMES[p] || p),
      licenseCodes,
      licenseCodesLabeled
    });
    
  } catch (err) {
    console.error('[order-test] 错误:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
