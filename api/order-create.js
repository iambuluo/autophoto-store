/**
 * POST /api/order-create
 * 创建虎皮椒支付订单
 *
 * 使用 Express 风格（与 health.js / test-post.js 相同）
 */
const crypto = require('crypto');

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

function makeLicenseCode(pluginId, plan) {
  const prefix = PLUGIN_PREFIXES[pluginId] || 'XX';
  const pc = PLAN_CHARS[plan] || 'X';
  const now = Math.floor(Date.now() / 1000);
  const expMap = { trial: 86400, annual: 365 * 86400, permanent: 99 * 365 * 86400, testpay: 3600 };
  const exp = now + (expMap[plan] || 365 * 86400);
  const rand = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `AP-${prefix}-${pc}${exp.toString(36).toUpperCase()}-${rand}`;
}

function signXunhu(params, secret) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== 'hash' && v !== '' && v != null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + secret;
  return crypto.createHash('md5').update(str).digest('hex');
}

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { plugins, plan, name, email, wechat } = req.body || {};

  if (!plugins?.length) {
    return res.status(400).json({ success: false, error: '请至少选择一个插件' });
  }
  if (!PLAN_PRICES[plan]) {
    return res.status(400).json({ success: false, error: '无效的授权类型' });
  }
  if (!email || !name) {
    return res.status(400).json({ success: false, error: '姓名和邮箱必填' });
  }

  const pluginList = Array.isArray(plugins) ? plugins : [plugins];
  const discount = DISCOUNTS[pluginList.length] || 1.0;
  const total = parseFloat(((PLAN_PRICES[plan] || 0) * pluginList.length * discount).toFixed(2));
  const orderNo = `AP${Date.now()}${crypto.randomInt(1000, 9999)}`;

  console.log(`订单: ${orderNo} | ${pluginList.join('+')} | ${PLAN_LABELS[plan]} | ¥${total}`);

  const appId = process.env.XUNHU_APP_ID;
  const appSecret = process.env.XUNHU_APP_SECRET;

  // 演示模式
  if (!appId || !appSecret || !appId.trim() || !appSecret.trim()) {
    const codes = pluginList.map(p => makeLicenseCode(p, plan));
    console.log(`演示模式: ${codes.join(', ')}`);
    return res.status(200).json({
      success: true, mode: 'demo', orderNo, total, demoLicenseCodes: codes
    });
  }

  // 正式模式
  const baseUrl = (process.env.XUNHU_RETURN_URL || '').trim() || 'https://www.autophoto.store';
  const vercelUrl = (process.env.VERCEL_URL || '').trim();
  const notifyBase = vercelUrl ? `https://${vercelUrl}` : 'https://www.autophoto.store';

  const nowSec = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');

  const postData = {
    version: '1.1', appid: appId, trade_order_id: orderNo,
    total_fee: total.toFixed(2),
    title: `AutoPhoto - ${pluginList.map(p => PLUGIN_NAMES[p] || p).join('+')} (${PLAN_LABELS[plan]})`,
    time: String(nowSec), nonce_str: nonce,
    return_url: `${baseUrl}/success.html?order=${orderNo}`,
    notify_url: `${notifyBase}/api/xunhupay/callback`,
    attach: JSON.stringify({ plugins: pluginList.join(','), plan, name, email, wechat }),
    buyer: email
  };
  postData.hash = signXunhu(postData, appSecret);

  // 调用虎皮椒
  const formBody = Object.entries(postData)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  fetch('https://api.xunhupay.com/payment/do.html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': String(formBody.length) },
    body: formBody
  }).then(r => r.json()).then(result => {
    console.log('虎皮椒:', JSON.stringify(result));
    if (result.errcode === 0 && result.url) {
      res.status(200).json({ success: true, mode: 'xunhu', paymentUrl: result.url, orderNo });
    } else {
      res.status(200).json({ success: false, error: result.errmsg || '支付创建失败', debug: { errcode: result.errcode } });
    }
  }).catch(e => {
    console.error('虎皮椒请求失败:', e.message);
    res.status(200).json({ success: false, error: '支付网关请求失败' });
  });
};
