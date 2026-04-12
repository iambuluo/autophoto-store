/**
 * POST /api/order-create
 * 创建虎皮椒支付订单（或演示模式直接返回授权码）
 */
const crypto = require('crypto');
const {
  PLAN_PRICES, PLAN_LABELS, PLUGIN_NAMES,
  pendingOrders, paidOrders,
  calcPrice, generateLicenseCode, signXunhu
} = require('./_lib/utils');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });

  try {
    const { plugins, plan, name, email, wechat, notes } = req.body || {};

    // 参数验证
    if (!plugins?.length) {
      return res.status(400).json({ success: false, error: '请至少选择一个插件' });
    }
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ success: false, error: '无效的授权类型' });
    }
    if (!email || !name) {
      return res.status(400).json({ success: false, error: '姓名和邮箱必填' });
    }

    const count = plugins.length;
    const total = calcPrice(plugins, plan);
    const orderNo = `AP${Date.now()}${crypto.randomInt(1000, 9999)}`;

    const orderInfo = {
      orderNo,
      plugins,
      plan,
      planName: PLAN_LABELS[plan] || plan,
      count,
      total,
      name,
      email,
      wechat: wechat || '',
      notes: notes || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    pendingOrders.set(orderNo, orderInfo);
    console.log(`📋 新订单: ${orderNo} | ${plugins.join('+')} | ${PLAN_LABELS[plan]} | ¥${total}`);

    // 演示模式
    const appId = process.env.XUNHU_APP_ID;
    const appSecret = process.env.XUNHU_APP_SECRET;
    if (!appId || !appSecret || appId.trim() === '' || appSecret.trim() === '') {
      const demoCodes = plugins.map(p => generateLicenseCode(p, plan));
      console.log(`⚠️ 虎皮椒未配置(appId=${!!appId}, appSecret=${!!appSecret})，进入演示模式`);
      return res.status(200).json({
        success: true,
        mode: 'demo',
        orderNo,
        total,
        message: '演示模式：授权码直接生成',
        demoLicenseCodes: demoCodes
      });
    }

    // 正式模式：调用虎皮椒
    const baseUrl = (process.env.XUNHU_RETURN_URL || '').trim() || 'https://www.autophoto.store';
    const vercelUrl = (process.env.VERCEL_URL || process.env.API_URL || '').trim();
    const notifyBase = vercelUrl ? `https://${vercelUrl}` : 'https://www.autophoto.store';

    const postData = {
      version: '1.1',
      appid: appId,
      trade_order_id: orderNo,
      total_fee: total.toFixed(2),
      title: `AutoPhoto - ${plugins.map(p => PLUGIN_NAMES[p] || p).join('+')} (${PLAN_LABELS[plan]})`,
      time: Math.floor(Date.now() / 1000).toString(),
      nonce_str: crypto.randomBytes(16).toString('hex'),
      return_url: `${baseUrl}/success.html?order=${orderNo}`,
      notify_url: `${notifyBase}/api/xunhupay/callback`,
      attach: JSON.stringify({ plugins: plugins.join(','), plan, name, email, wechat }),
      buyer: email
    };

    // 签名
    postData.hash = signXunhu(postData, appSecret);

    const response = await fetch('https://api.xunhupay.com/payment/do.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(postData).toString()
    });

    const result = await response.json();
    console.log('虎皮椒返回:', JSON.stringify(result));
    console.log('签名参数:', signXunhu(postData, process.env.XUNHU_APP_SECRET));

    if (result.errcode === 0 && result.url) {
      return res.status(200).json({ success: true, mode: 'xunhu', paymentUrl: result.url, orderNo });
    } else {
      // 返回详细错误信息给前端调试
      console.error('虎皮椒创建订单失败:', result);
      return res.status(200).json({ 
        success: false, 
        error: result.errmsg || '支付创建失败',
        debug: {
          errcode: result.errcode,
          appid: appId ? '✅ 已配置' : '❌ 未配置',
          title: postData.title
        }
      });
    }

  } catch (err) {
    console.error('创建订单异常:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
