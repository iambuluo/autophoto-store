/**
 * api/stripe.js - 统一处理 Stripe 所有接口
 * 
 * POST /api/stripe/create-checkout  → 创建 Checkout Session
 * POST /api/stripe/callback         → 处理 Stripe Webhook
 */

const Stripe = require('stripe');
const crypto = require('crypto');

// 懒加载 Stripe（避免模块加载时因 KEY 缺失而崩溃）
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2024-11-20.acacia' });
  }
  return _stripe;
}

// ============================================================
// 共享配置
// ============================================================
const PLAN_LABELS = {
  testpay: 'Test Payment ($0.01)', trial: '1-Day Trial',
  annual: 'Annual License', permanent: 'Lifetime License'
};
const PLUGIN_NAMES = {
  shijuezhongguo: 'VCPhoto Auto Submitter', guangchang: 'VJshi Batch Submitter',
  xinchangchang: 'Xinchangchang AIGC Assistant', dreamstime: 'Dreamstime Auto Submitter',
  'adobe-stock': 'Adobe Stock Keyword Clicker',
  'qingying-image': 'QingYing Image Batch', 'qingying-video': 'QingYing Video Batch'
};
const PLUGIN_PREFIXES = {
  shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC', dreamstime: 'DT',
  'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
};
const PLAN_CHARS = { testpay: 'T', trial: 'T', annual: 'Y', permanent: 'P' };
const PLAN_DURATIONS = { testpay: 1, trial: 1, annual: 365, permanent: 365 * 99 };

// 价格（美分）
const PLAN_PRICES_USD = {
  testpay: 1, trial: 140, annual: 2800, permanent: 5500
};

// ============================================================
// 工具函数
// ============================================================
function generateLicenseCode(prefix, plan, durationHours) {
  const expireTime = Math.floor(Date.now() / 1000) + durationHours * 3600;
  const expireB36 = expireTime.toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `AP-${prefix}-${PLAN_CHARS[plan] || 'X'}${expireB36}-${random}`;
}

async function sendLicenseEmail(email, code, pluginName, planName, adminEmail) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.log('RESEND_API_KEY not set'); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'AutoPhoto Store <onboarding@resend.dev>',
        to: [email, adminEmail],
        subject: `✅ 授权码已生成 - ${pluginName}`,
        html: `<h2>授权码已生成</h2><p>插件：${pluginName}</p><p>方案：${planName}</p><p>授权码：<b style="font-size:18px;font-family:monospace">${code}</b></p><p>请在插件中激活使用。</p>`
      })
    });
  } catch (err) {
    console.error('Email send failed:', err);
  }
}

async function saveLicenseRecord(sessionId, code, plugins, plan, name, email) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  try {
    await supabase.from('licenses').insert({
      code, plugins, plan, name, email,
      stripe_session: sessionId, status: 'active',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('DB save failed:', err);
  }
}

// ============================================================
// 主路由
// ============================================================
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Stripe Webhook 通过 stripe-signature header 识别（/api/stripe 也可接收回调）
  const isWebhook = !!req.headers['stripe-signature'];

  try {
    if (isWebhook) {
      await handleCallback(req, res);
    } else {
      await handleCreateCheckout(req, res);
    }
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};

// ============================================================
// 创建 Checkout Session
// ============================================================
async function handleCreateCheckout(req, res) {
  const { plugins, plan, name, email } = req.body || {};
  if (!plugins?.length || !plan || !email) {
    res.status(400).json({ error: 'Missing required fields' }); return;
  }
  if (!PLAN_PRICES_USD[plan]) {
    res.status(400).json({ error: 'Invalid plan' }); return;
  }

  const prefix = PLUGIN_PREFIXES[plugins[0]] || 'AP';
  const pname = PLUGIN_NAMES[plugins[0]] || plugins[0];
  const label = PLAN_LABELS[plan] || plan;
  const origin = req.headers.origin || 'https://www.autophoto.store';

  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `AutoPhoto - ${pname}`, description: label },
        unit_amount: PLAN_PRICES_USD[plan]
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/buy.html?cancelled=1`,
    metadata: {
      plugins: JSON.stringify(plugins),
      plan, name: name || '', email,
      prefix,
      durationHours: String(PLAN_DURATIONS[plan] || 1)
    },
    customer_email: email,
    locale: 'auto'
  });

  res.status(200).json({ mode: 'stripe', url: session.url, sessionId: session.id });
}

// ============================================================
// 处理 Webhook 回调
// ============================================================
async function handleCallback(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    // Stripe sends JSON body; reconstruct for signature verification
    const rawBody = (typeof req.body === 'string') ? req.body : JSON.stringify(req.body);
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { plugins, plan, name, email, prefix, durationHours } = session.metadata || {};
    const pluginArr = JSON.parse(plugins || '[]');
    const pname = PLUGIN_NAMES[pluginArr[0]] || pluginArr[0] || 'Plugin';
    const label = PLAN_LABELS[plan] || plan;
    const hours = parseInt(durationHours || '1');
    const code = generateLicenseCode(prefix || 'AP', plan || 'trial', hours);

    console.log(`✅ Stripe payment: ${session.id} → code: ${code}`);

    // 并行执行保存和发邮件
    await Promise.all([
      saveLicenseRecord(session.id, code, pluginArr, plan, name, email),
      sendLicenseEmail(email, code, pname, label, 'tourinn@gmail.com')
    ]);
  }

  res.status(200).json({ received: true });
}
