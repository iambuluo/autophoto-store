/**
 * POST /api/create-order
 * 创建虎皮椒支付订单
 *
 * 定价/折扣/插件配置 → pricing-config.js（全站唯一数据源）
 */
const { PLAN_LABELS, PLAN_PRICES, PLUGIN_NAMES, calcPrice, generateLicenseCode } = require('../_lib/pricing-config');

// 强制使用 Node.js Runtime（Vercel 默认是 Edge Runtime，不支持 require）
export const config = { runtime: 'nodejs' };

function signXunhu(params, secret) {
  const crypto = require('crypto');
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== 'hash' && v !== '' && v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + secret;
  console.log('[sign string]:', str);
  return crypto.createHash('md5').update(str).digest('hex');
}

// 保存授权码到临时数据库（/tmp，Vercel Serverless 临时存储）
async function saveLicenseRecord(order) {
  const fs = require('fs');
  const DB_PATH = '/tmp/autophoto-licenses.json';
  try {
    let db = { orders: [] };
    if (fs.existsSync(DB_PATH)) {
      try { db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); } catch (e) {}
    }
    const existing = db.orders.findIndex(o => o.orderNo === order.orderNo);
    if (existing >= 0) { db.orders[existing] = order; }
    else { db.orders.push(order); }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    console.log(`[DB] 保存: ${order.orderNo}, ${order.licenseCodes.length}个码`);
    return true;
  } catch (e) {
    console.error('[DB] 保存失败:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  console.log('[create-order] 调用');
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { plugins, plan, name, email, wechat } = req.body || {};
    console.log('[create-order] body:', JSON.stringify(req.body));

    // 验证参数
    if (!plugins || !Array.isArray(plugins) || plugins.length === 0) {
      return res.status(400).json({ success: false, error: '请至少选择一个插件' });
    }
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ success: false, error: '无效的授权类型' });
    }
    if (!email || !name) {
      return res.status(400).json({ success: false, error: '姓名和邮箱必填' });
    }

    const total = calcPrice(plugins, plan);
    const orderNo = 'AP' + Date.now() + Math.floor(Math.random() * 9000 + 1000);

    // 生成授权码（带插件标注）
    const codeEntries = plugins.map(p => generateLicenseCode(p, plan));
    const licenseCodes = codeEntries.map(e => e.code);  // 纯码数组
    const licenseCodesLabeled = codeEntries.map(e => `${e.label} ${e.code}`); // 带标注
    const codesBase64 = Buffer.from(JSON.stringify(licenseCodes)).toString('base64');

    console.log('[授权码]', licenseCodesLabeled.join(' | '));

    // 检查虎皮椒配置
    const xunhuConfigured = !!(process.env.XUNHU_APP_ID && process.env.XUNHU_APP_SECRET);
    console.log('[虎皮椒配置] APP_ID:', !!process.env.XUNHU_APP_ID, 'APP_SECRET:', !!process.env.XUNHU_APP_SECRET);

    if (!xunhuConfigured) {
      // demo模式（虎皮椒未配置）
      await saveLicenseRecord({ orderNo, plugins, plan, planName: PLAN_LABELS[plan], email, name, wechat, total, licenseCodes, createdAt: new Date().toISOString() });
      return res.json({ success: true, mode: 'demo', orderNo, total, licenseCodesLabeled });
    }

    // 正式模式：调用虎皮椒 API
    const https = require('https');
    const postData = {
      version: '1.1',
      appid: process.env.XUNHU_APP_ID,
      trade_order_id: orderNo,
      total_fee: total.toFixed(2),
      title: `AutoPhoto - ${plugins.map(p => PLUGIN_NAMES[p] || p).join('+')} (${PLAN_LABELS[plan]})`,
      time: Math.floor(Date.now() / 1000).toString(),
      nonce_str: require('crypto').randomBytes(16).toString('hex'),
      return_url: `https://autophoto-store.vercel.app/success.html?order=${orderNo}&codes=${encodeURIComponent(codesBase64)}`,
      notify_url: `https://autophoto-store.vercel.app/api/xunhupay/callback`,
      attach: JSON.stringify({ plugins: plugins.join(','), plan, name, email, wechat })
    };
    postData.hash = signXunhu(postData, process.env.XUNHU_APP_SECRET);

    const formData = Object.entries(postData)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    console.log('[调用虎皮椒 API...]');

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.xunhupay.com', port: 443, path: '/payment/do.html', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(formData) }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('[虎皮椒响应]:', data);
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve({ raw: data }); }
        });
      });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('虎皮椒API超时')); });
      req.write(formData);
      req.end();
    });

    if (result.errcode === 0 && result.url) {
      await saveLicenseRecord({ orderNo, plugins, plan, planName: PLAN_LABELS[plan], email, name, wechat, total, licenseCodes, createdAt: new Date().toISOString() });
      return res.json({ success: true, mode: 'xunhu', paymentUrl: result.url, orderNo, total, licenseCodes, licenseCodesLabeled });
    } else if (result.errcode === 500) {
      // 降级demo模式
      await saveLicenseRecord({ orderNo, plugins, plan, planName: PLAN_LABELS[plan], email, name, wechat, total, licenseCodes, createdAt: new Date().toISOString() });
      return res.json({ success: true, mode: 'demo', orderNo, total, licenseCodesLabeled, fallback: true, message: '支付通道临时维护' });
    } else {
      return res.status(500).json({ success: false, error: result.errmsg || '支付创建失败' });
    }
  } catch (err) {
    console.error('[create-order] 错误:', err.message);
    return res.status(500).json({ success: false, error: 'API-ERROR: ' + err.message });
  }
};
