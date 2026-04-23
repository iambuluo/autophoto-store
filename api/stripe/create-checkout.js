/**
 * POST /api/stripe/create-checkout
 * 创建 Stripe Checkout Session
 *
 * 接收参数：{ plugins, plan, name, email }
 * 返回：{ url } → 跳转到 Stripe 支付页
 */
const crypto = require('crypto');

// ============================================================
// 定价配置（与虎皮椒保持一致，转换为美分）
// 汇率: 1 USD ≈ 7.25 CNY（香港 Stripe，实际汇率以 Stripe 为准）
// ============================================================
const PLAN_PRICES_CNY = { testpay: 0.01, trial: 9.9, annual: 199, permanent: 399 };
const PLAN_PRICES_USD = {
  testpay: 1,       // $0.01
  trial: 140,       // ~$1.40
  annual: 2800,     // ~$28.00
  permanent: 5500   // ~$55.00
};
const PLAN_LABELS = {
  testpay: 'Test Payment ($0.01)',
  trial: '1-Day Trial',
  annual: 'Annual License',
  permanent: 'Lifetime License'
};
const PLAN_CHARS = { testpay: 'T', trial: 'T', annual: 'Y', permanent: 'P' };
const PLUGIN_NAMES = {
  shijuezhongguo: 'VCPhoto Auto Submitter',
  guangchang: 'VJshi Batch Submitter',
  xinchangchang: 'Xinpianchang AIGC Assistant',
  dreamstime: 'Dreamstime Auto Submitter',
  'adobe-stock': 'Adobe Stock Keyword Clicker',
  'qingying-image': 'Qingying Batch Image Generator',
  'qingying-video': 'Qingying Batch Video Generator'
};
const PLUGIN_PREFIXES = {
  shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC', dreamstime: 'DT',
  'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
};
const DISCOUNTS = { 1: 1.0, 2: 0.88, 3: 0.80, 4: 0.70, 5: 0.60, 6: 0.60, 7: 0.50 };

function calcTotalCents(pluginList, plan) {
  const count = pluginList.length;
  const discount = DISCOUNTS[count] || 1.0;
  const unitPrice = PLAN_PRICES_USD[plan] || 2800;
  return Math.round(unitPrice * count * discount);
}

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ success: false, error: 'Stripe not configured' });
  }

  const { plugins, plan, name, email } = req.body || {};

  if (!plugins?.length) return res.status(400).json({ success: false, error: 'Select at least one plugin' });
  if (!PLAN_PRICES_USD[plan]) return res.status(400).json({ success: false, error: 'Invalid plan' });
  if (!email || !name) return res.status(400).json({ success: false, error: 'Name and email are required' });

  const pluginList = Array.isArray(plugins) ? plugins : [plugins];
  const totalCents = calcTotalCents(pluginList, plan);
  const orderNo = `AP${Date.now()}${crypto.randomInt(1000, 9999)}`;

  const baseUrl = 'https://www.autophoto.store';

  // 构建产品描述
  const pluginLabels = pluginList.map(p => PLUGIN_NAMES[p] || p).join(' + ');
  const description = `AutoPhoto: ${pluginLabels} - ${PLAN_LABELS[plan]}`;

  // metadata 传递订单信息（callback 用）
  const metadata = {
    order_no: orderNo,
    plugins: pluginList.join(','),
    plan,
    buyer_name: name,
    buyer_email: email
  };

  // Stripe API 请求体（form-urlencoded）
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('line_items[0][price_data][currency]', 'usd');
  params.append('line_items[0][price_data][unit_amount]', String(totalCents));
  params.append('line_items[0][price_data][product_data][name]', description);
  params.append('line_items[0][quantity]', '1');
  params.append('customer_email', email);
  params.append('success_url', `${baseUrl}/success.html?order=${orderNo}&session={CHECKOUT_SESSION_ID}&gateway=stripe`);
  params.append('cancel_url', `${baseUrl}/buy.html?cancelled=1`);
  // metadata
  Object.entries(metadata).forEach(([k, v]) => {
    params.append(`metadata[${k}]`, v);
  });

  console.log(`[Stripe] 创建订单: ${orderNo} | ${pluginLabels} | ${PLAN_LABELS[plan]} | $${(totalCents/100).toFixed(2)}`);

  fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })
    .then(r => r.json())
    .then(session => {
      console.log('[Stripe] Session:', session.id, 'Status:', session.status);
      if (session.url) {
        res.status(200).json({
          success: true,
          mode: 'stripe',
          url: session.url,
          sessionId: session.id,
          orderNo,
          totalUsd: (totalCents / 100).toFixed(2)
        });
      } else {
        console.error('[Stripe] 创建失败:', JSON.stringify(session));
        res.status(200).json({
          success: false,
          error: session.error?.message || 'Failed to create checkout session'
        });
      }
    })
    .catch(e => {
      console.error('[Stripe] 请求异常:', e.message);
      res.status(200).json({ success: false, error: 'Stripe request failed: ' + e.message });
    });
};
