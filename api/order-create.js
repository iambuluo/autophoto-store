/**
 * POST /api/create-order
 * 创建虎皮椒支付订单
 */
const PLAN_PRICES = { test001: 0.01, trial: 9.9, annual: 199, permanent: 399 };
const PLAN_LABELS = { test001: '调试测试', trial: '1天试用', annual: '年度授权', permanent: '永久授权' };
const DISCOUNTS = { 1: 1.0, 2: 0.88, 3: 0.80, 4: 0.70, 5: 0.60, 6: 0.60, 7: 0.50 };
const PLUGIN_NAMES = {
  shijuezhongguo: '视觉中国自动提交',
  guangchang: '光厂批量提交助手',
  xinchangchang: '新片场 AIGC 助手',
  dreamstime: 'Dreamstime 自动提交',
  'adobe-stock': 'Adobe Stock 关键词点击器',
  'qingying-image': '清影批量生图助手',
  'qingying-video': '清影批量生视频助手'
};

function calcPrice(plugins, plan) {
  if (plan === 'test001') return 0.01;
  const discount = DISCOUNTS[plugins.length] || 1.0;
  return parseFloat((PLAN_PRICES[plan] * plugins.length * discount).toFixed(2));
}

function signXunhu(params, secret) {
  const crypto = require('crypto');
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== 'hash' && v !== '' && v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + secret;
  console.log('[DEBUG] sign string:', str);
  return crypto.createHash('md5').update(str).digest('hex');
}

function generateLicenseCode(pluginId, plan) {
  const crypto = require('crypto');
  const prefixes = {
    shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC',
    dreamstime: 'DT', 'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
  };
  const prefix = prefixes[pluginId] || 'XX';
  const planChar = plan === 'permanent' ? 'P' : plan === 'annual' ? 'Y' : plan === 'trial' ? 'T' : 'X';
  const rand = crypto.randomBytes(6).toString('hex').toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `AP-${prefix}-${planChar}${rand}-${ts}`;
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
    if (existing >= 0) {
      db.orders[existing] = order;
    } else {
      db.orders.push(order);
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    console.log(`[DB] 保存授权码: ${order.orderNo}, ${order.licenseCodes.length}个码`);
    return true;
  } catch (e) {
    console.error('[DB] 保存失败:', e.message);
    return false;
  }
}

module.exports = async function handler(req, res) {
  console.log('[DEBUG] create-order called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { plugins, plan, name, email, wechat } = req.body || {};
    console.log('[DEBUG] body:', JSON.stringify(req.body));
    
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

    // 演示模式：虎皮椒未配置时，直接返回授权码
    if (!process.env.XUNHU_APP_ID || !process.env.XUNHU_APP_SECRET) {
      console.log('[DEBUG] Demo mode - no Xunhu credentials');
      const demoCodes = plugins.map(p => generateLicenseCode(p, plan));
      // 同时保存到数据库
      await saveLicenseRecord({
        orderNo, plugins, plan, planName: PLAN_LABELS[plan],
        email, name, wechat, total,
        licenseCodes: demoCodes, createdAt: new Date().toISOString()
      });
      return res.json({
        success: true, mode: 'demo', orderNo, total,
        demoLicenseCodes: demoCodes
      });
    }

    // 正式模式：调用虎皮椒 API
    // 注意：虎皮椒API要求参数名为小写
    const postData = {
      version: '1.1',
      appid: process.env.XUNHU_APP_ID,
      trade_order_id: orderNo,
      total_fee: total.toFixed(2),
      title: `AutoPhoto - ${plugins.map(p => PLUGIN_NAMES[p] || p).join('+')} (${PLAN_LABELS[plan]})`,
      time: Math.floor(Date.now() / 1000).toString(),
      nonce_str: require('crypto').randomBytes(16).toString('hex'),
      return_url: `https://autophoto-store.vercel.app/success.html?order=${orderNo}`,
      notify_url: `https://autophoto-store.vercel.app/api/xunhupay/callback`,
      attach: JSON.stringify({ plugins: plugins.join(','), plan, name, email, wechat })
    };
    
    postData.hash = signXunhu(postData, process.env.XUNHU_APP_SECRET);

    // 使用原生 https 调用
    const https = require('https');
    const formData = Object.entries(postData)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    console.log('[DEBUG] Calling Xunhu API...');
    
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.xunhupay.com',
        port: 443,
        path: '/payment/do.html',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('[DEBUG] Xunhu response status:', res.statusCode);
          console.log('[DEBUG] Xunhu response data:', data);
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve({ raw: data }); }
        });
      });
      req.on('error', (e) => {
        console.error('[DEBUG] Xunhu request error:', e.message);
        reject(e);
      });
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      req.write(formData);
      req.end();
    });

    console.log('[DEBUG] Xunhu result:', JSON.stringify(result));

    if (result.errcode === 0 && result.url) {
      // 虎皮椒下单成功：预先生成授权码并保存，这样即使回调失败，用户也能查询
      const licenseCodes = plugins.map(p => generateLicenseCode(p, plan));
      await saveLicenseRecord({
        orderNo, plugins, plan, planName: PLAN_LABELS[plan],
        email, name, wechat, total,
        licenseCodes, createdAt: new Date().toISOString()
      });
      return res.json({ success: true, mode: 'xunhu', paymentUrl: result.url, orderNo, total });
    } else if (result.errcode === 500) {
      // 虎皮椒系统错误，降级到演示模式
      console.log('[DEBUG] Xunhu API error, falling back to demo mode');
      const demoCodes = plugins.map(p => generateLicenseCode(p, plan));
      await saveLicenseRecord({
        orderNo, plugins, plan, planName: PLAN_LABELS[plan],
        email, name, wechat, total,
        licenseCodes: demoCodes, createdAt: new Date().toISOString()
      });
      return res.json({
        success: true, mode: 'demo', orderNo, total, fallback: true,
        message: '支付通道临时维护中，已为您生成试用授权码',
        demoLicenseCodes: demoCodes
      });
    } else {
      return res.status(500).json({ success: false, error: result.errmsg || '支付创建失败: ' + JSON.stringify(result) });
    }
  } catch (err) {
    console.error('[DEBUG] create-order error:', err.message);
    return res.status(500).json({ success: false, error: 'API-ERROR: ' + err.message });
  }
};
