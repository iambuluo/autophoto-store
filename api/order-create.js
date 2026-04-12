/**
 * POST /api/order-create
 * 创建虎皮椒支付订单（或演示模式直接返回授权码）
 */
const crypto = require('crypto');

// 定价配置（内联，避免模块依赖问题）
const PLAN_PRICES = { testpay: 0.01, trial: 9.9, annual: 199, permanent: 399 };
const PLAN_LABELS = { testpay: '¥0.01 测试', trial: '1天试用', annual: '年度授权', permanent: '永久授权' };
const PLAN_CHARS = { testpay: 'T', trial: 'T', annual: 'Y', permanent: 'P' };
const PLUGIN_NAMES = {
  shijuezhongguo: '视觉中国自动提交', guangchang: '光厂批量提交助手',
  xinchangchang: '新片场 AIGC 助手', dreamstime: 'Dreamstime 自动提交',
  'adobe-stock': 'Adobe Stock 关键词点击器',
  'qingying-image': '清影批量生图助手', 'qingying-video': '清影批量生视频助手'
};
const PLUGIN_PREFIXES = {
  shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC', dreamstime: 'DT',
  'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
};
const DISCOUNTS = { 1: 1.0, 2: 0.88, 3: 0.80, 4: 0.70, 5: 0.60, 6: 0.60, 7: 0.50 };

// 内存存储（当前实例）
const pendingOrders = new Map();

// 工具函数
function calcPrice(plugins, plan) {
  const count = plugins.length;
  const discount = DISCOUNTS[count] || 1.0;
  return parseFloat(((PLAN_PRICES[plan] || 0) * count * discount).toFixed(2));
}

function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  const map = { trial: 1 * DAY, annual: 365 * DAY, permanent: 99 * 365 * DAY, testpay: 3600 };
  return now + (map[plan] || 365 * DAY);
}

function generateLicenseCode(pluginId, plan) {
  const prefix = PLUGIN_PREFIXES[pluginId] || 'XX';
  const planChar = PLAN_CHARS[plan] || 'X';
  const expiry = calcExpiry(plan);
  const rand = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `AP-${prefix}-${planChar}${expiry.toString(36).toUpperCase()}-${rand}`;
}

function signXunhu(params, appSecret) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== 'hash' && v !== '' && v != null)
    .sort(([a], [b]) => a.localeCompare(b));
  const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + appSecret;
  return crypto.createHash('md5').update(str).digest('hex');
}

function randomInt(min, max) {
  const range = max - min + 1;
  const bytes = Math.ceil(Math.log2(range) / 8);
  const maxVal = Math.pow(256, bytes);
  let val;
  do { val = parseInt(crypto.randomBytes(bytes).toString('hex'), 16); } while (val >= maxVal - (maxVal % range));
  return min + (val % range);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });

  try {
    const { plugins, plan, name, email, wechat } = req.body || {};

    if (!plugins?.length) return res.status(400).json({ success: false, error: '请至少选择一个插件' });
    if (!PLAN_PRICES[plan]) return res.status(400).json({ success: false, error: '无效的授权类型' });
    if (!email || !name) return res.status(400).json({ success: false, error: '姓名和邮箱必填' });

    const total = calcPrice(plugins, plan);
    const orderNo = `AP${Date.now()}${randomInt(1000, 9999)}`;

    const orderInfo = { orderNo, plugins, plan, planName: PLAN_LABELS[plan] || plan, total, name, email, wechat: wechat || '' };
    pendingOrders.set(orderNo, orderInfo);
    console.log(`新订单: ${orderNo} | ${plugins.join('+')} | ${PLAN_LABELS[plan]} | ¥${total}`);

    const appId = process.env.XUNHU_APP_ID;
    const appSecret = process.env.XUNHU_APP_SECRET;
    if (!appId || !appSecret || !appId.trim() || !appSecret.trim()) {
      const demoCodes = plugins.map(p => generateLicenseCode(p, plan));
      console.log(`演示模式: 授权码 = ${demoCodes.join(', ')}`);
      return res.status(200).json({ success: true, mode: 'demo', orderNo, total, demoLicenseCodes: demoCodes });
    }

    const baseUrl = (process.env.XUNHU_RETURN_URL || '').trim() || 'https://www.autophoto.store';
    const vercelUrl = (process.env.VERCEL_URL || '').trim();
    const notifyBase = vercelUrl ? `https://${vercelUrl}` : 'https://www.autophoto.store';

    const postData = {
      version: '1.1', appid: appId, trade_order_id: orderNo,
      total_fee: total.toFixed(2),
      title: `AutoPhoto - ${plugins.map(p => PLUGIN_NAMES[p] || p).join('+')} (${PLAN_LABELS[plan]})`,
      time: Math.floor(Date.now() / 1000).toString(),
      nonce_str: crypto.randomBytes(16).toString('hex'),
      return_url: `${baseUrl}/success.html?order=${orderNo}`,
      notify_url: `${notifyBase}/api/xunhupay/callback`,
      attach: JSON.stringify({ plugins: plugins.join(','), plan, name, email, wechat }),
      buyer: email
    };
    postData.hash = signXunhu(postData, appSecret);

    const response = await fetch('https://api.xunhupay.com/payment/do.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(postData).toString()
    });
    const result = await response.json();

    if (result.errcode === 0 && result.url) {
      return res.status(200).json({ success: true, mode: 'xunhu', paymentUrl: result.url, orderNo });
    } else {
      console.error('虎皮椒错误:', result);
      return res.status(200).json({ success: false, error: result.errmsg || '支付创建失败', debug: { errcode: result.errcode } });
    }
  } catch (err) {
    console.error('订单异常:', err.message, err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
};
