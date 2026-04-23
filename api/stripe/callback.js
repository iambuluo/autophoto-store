/**
 * POST /api/stripe/callback
 * 处理 Stripe Webhook 回调
 *
 * 必须配置 STRIPE_WEBHOOK_SECRET 环境变量
 * Webhook 事件: checkout.session.completed
 */

// ============================================================
// 配置
// ============================================================
const PLAN_LABELS = {
  testpay: '测试支付', trial: '1天试用',
  annual: '年度授权', permanent: '永久授权'
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
  shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC', dreamstime: 'DT',
  'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
};
const PLAN_CHARS = { testpay: 'T', trial: 'T', annual: 'Y', permanent: 'P' };

// ============================================================
// 授权码生成
// ============================================================
function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  const m = { testpay: DAY, trial: DAY, annual: 365 * DAY, permanent: 99 * 365 * DAY };
  return now + (m[plan] || 365 * DAY);
}

function makeLicenseCode(pluginId, plan) {
  const prefix = PLUGIN_PREFIXES[pluginId] || 'XX';
  const pc = PLAN_CHARS[plan] || 'X';
  const expiryB36 = calcExpiry(plan).toString(36).toUpperCase();
  const rand = Array.from({ length: 10 }, () =>
    Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
  return `AP-${prefix}-${pc}${expiryB36}-${rand.slice(0, 6)}`;
}

function getCodeLabel(code) {
  const prefix = (code || '').split('-')[1];
  for (const [pid, pfx] of Object.entries(PLUGIN_PREFIXES)) {
    if (pfx === prefix) return `[${PLUGIN_NAMES[pid] || pid}]`;
  }
  return '[未知插件]';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// Stripe 签名验证（纯 JS，无 stripe 依赖）
// ============================================================
const crypto = require('crypto');

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!secret || !sigHeader) return true; // 未配置时跳过验证（调试用）

  try {
    const parts = sigHeader.split(',');
    let timestamp = '';
    const v1Sigs = [];
    for (const part of parts) {
      if (part.startsWith('t=')) timestamp = part.slice(2);
      if (part.startsWith('v1=')) v1Sigs.push(part.slice(3));
    }
    if (!timestamp || !v1Sigs.length) return false;

    // 防重放：时间戳偏差不超过5分钟
    const timeDiff = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (timeDiff > 300) {
      console.warn('[Stripe] 时间戳偏差过大:', timeDiff, '秒');
      return false;
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    return v1Sigs.some(sig => sig === expected);
  } catch (e) {
    console.error('[Stripe] 签名验证异常:', e.message);
    return false;
  }
}

// ============================================================
// 邮件发送（Resend API）
// ============================================================
async function sendLicenseEmail(toEmail, orderInfo, licenseCodes) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !toEmail) {
    console.error('[邮件] 缺少 Resend Key 或收件人');
    return;
  }

  const name = orderInfo.name || '用户';
  const plugins = orderInfo.plugins || [];
  const planName = PLAN_LABELS[orderInfo.plan] || orderInfo.plan;

  const codeList = licenseCodes.map(c => {
    const label = getCodeLabel(c);
    return `<div style="margin-bottom:12px;">
      <span style="color:#94a3b8;font-size:12px;">${label}</span><br>
      <code style="background:#1a1a2e;padding:10px 18px;border-radius:6px;display:inline-block;margin-top:4px;
        font-family:monospace;color:#818cf8;font-size:15px;letter-spacing:1px;word-break:break-all;">${c}</code>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#0a0a0f;color:#f1f5f9;margin:0;padding:20px;}
.wrap{max-width:600px;margin:0 auto;}.card{background:#13131a;border:1px solid #2a2a3e;border-radius:16px;padding:32px;}
h1{font-size:22px;color:#818cf8;margin:0 0 24px;}h2{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;}
p{color:#94a3b8;line-height:1.8;font-size:14px;margin:0 0 10px;}
.warning{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:12px;color:#f59e0b;font-size:13px;line-height:1.6;}
.footer{text-align:center;color:#475569;font-size:12px;margin-top:28px;padding-top:20px;border-top:1px solid #1e1e2e;}
</style></head><body><div class="wrap"><div class="card">
<h1>🛒 AutoPhoto License Key</h1>
<p>Hi <strong>${escapeHtml(name)}</strong>,</p>
<p>Thank you for your purchase! Here are your license keys:</p>
<h2>📦 Plugins Purchased</h2><p>${plugins.map(p => escapeHtml(PLUGIN_NAMES[p] || p)).join('<br>')}</p>
<h2>📋 License Type</h2><p>${escapeHtml(planName)}</p>
<h2>🔑 License Keys</h2>${codeList}
<div class="warning">⚠️ Keep your license key safe. Each key is bound to one device.</div>
<h2>📖 How to Use</h2>
<p>1. Install the Chrome extension<br>2. Open extension settings<br>3. Enter your license key<br>4. Enjoy!</p>
<h2>💬 Support</h2>
<p>WeChat: auto_photo2025<br>Email: tourinn@gmail.com</p>
<div class="footer">AutoPhoto.store · Tools for Stock Photo Creators</div>
</div></div></body></html>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'AutoPhoto <onboarding@resend.dev>',
        to: toEmail,
        subject: '🔑 Your AutoPhoto License Key',
        html
      })
    });
    const result = await resp.json();
    if (resp.ok) {
      console.log(`[Resend] ✅ 用户邮件已发送至 ${toEmail}`);
    } else {
      console.error('[Resend] ❌ 邮件发送失败:', JSON.stringify(result));
    }
  } catch (e) {
    console.error('[Resend] 异常:', e.message);
  }
}

async function sendAdminEmail(orderInfo, licenseCodes) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail) return;

  const plugins = (orderInfo.plugins || []).map(p => PLUGIN_NAMES[p] || p);
  const codes = licenseCodes.map(c => `${getCodeLabel(c)} ${c}`).join('\n');

  const text = `[AutoPhoto Stripe] 新订单
订单号: ${orderInfo.order_no}
Stripe Session: ${orderInfo.session_id}
插件: ${plugins.join(', ')}
授权类型: ${PLAN_LABELS[orderInfo.plan] || orderInfo.plan}
金额: $${orderInfo.amount_usd}
用户: ${orderInfo.name}
邮箱: ${orderInfo.email}
授权码:
${codes}
时间: ${new Date().toISOString()}`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'AutoPhoto <onboarding@resend.dev>',
        to: adminEmail,
        subject: `[Stripe] 新订单 #${orderInfo.order_no} - ${plugins.join(', ')} - $${orderInfo.amount_usd}`,
        text
      })
    });
    if (resp.ok) {
      console.log(`[Resend] ✅ 管理员邮件已发送至 ${adminEmail}`);
    } else {
      const r = await resp.json();
      console.error('[Resend] ❌ 管理员邮件失败:', JSON.stringify(r));
    }
  } catch (e) {
    console.error('[Resend] 管理员邮件异常:', e.message);
  }
}

// ============================================================
// 主处理函数
// ============================================================
module.exports = async (req, res) => {
  // Stripe webhook 要求原始 body（未被 JSON.parse 的）
  // Vercel 默认会解析，需要关闭
  res.setHeader('Content-Type', 'text/plain');

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  // 获取原始请求体
  let rawBody = '';
  try {
    // Vercel 中 req.body 可能已被解析，需要原始字节
    if (req.rawBody) {
      rawBody = req.rawBody;
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object') {
      rawBody = JSON.stringify(req.body);
    } else {
      // 手动读取流
      await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => { rawBody = data; resolve(); });
        req.on('error', reject);
      });
    }
  } catch (e) {
    console.error('[Stripe Callback] 读取body失败:', e.message);
    return res.status(400).send('body read error');
  }

  console.log('[Stripe Callback] 收到回调，body长度:', rawBody.length);

  // 签名验证
  const sigHeader = req.headers['stripe-signature'] || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (webhookSecret && sigHeader) {
    const valid = verifyStripeSignature(rawBody, sigHeader, webhookSecret);
    if (!valid) {
      console.error('[Stripe Callback] 签名验证失败');
      return res.status(400).send('Invalid signature');
    }
    console.log('[Stripe Callback] 签名验证通过 ✅');
  } else {
    console.warn('[Stripe Callback] ⚠️ 未配置 webhook secret 或无签名头，跳过验证');
  }

  // 解析事件
  let event;
  try {
    event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch (e) {
    console.error('[Stripe Callback] JSON 解析失败:', e.message);
    return res.status(400).send('json parse error');
  }

  console.log(`[Stripe Callback] 事件类型: ${event.type}`);

  // 只处理支付成功事件
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).send('ok');
  }

  const session = event.data?.object;
  if (!session) {
    return res.status(400).send('no session');
  }

  // 提取订单信息（从 metadata）
  const meta = session.metadata || {};
  const orderNo = meta.order_no || session.id;
  const plugins = (meta.plugins || '').split(',').filter(Boolean);
  const plan = meta.plan || 'annual';
  const buyerEmail = meta.buyer_email || session.customer_email || '';
  const buyerName = meta.buyer_name || '用户';
  const amountUsd = ((session.amount_total || 0) / 100).toFixed(2);

  console.log(`[Stripe] 支付成功: ${orderNo} | ${plugins.join('+')} | ${plan} | $${amountUsd} | ${buyerEmail}`);

  if (!plugins.length) {
    console.error('[Stripe] metadata 中无 plugins，无法生成授权码');
    return res.status(200).send('ok');
  }

  // 生成授权码
  const licenseCodes = plugins.map(p => makeLicenseCode(p, plan));
  console.log('[Stripe] 授权码:', licenseCodes.join(' | '));

  // 发邮件
  const orderInfo = {
    order_no: orderNo,
    session_id: session.id,
    plugins,
    plan,
    name: buyerName,
    email: buyerEmail,
    amount_usd: amountUsd
  };

  const emailTasks = [];
  if (buyerEmail) emailTasks.push(sendLicenseEmail(buyerEmail, orderInfo, licenseCodes));
  emailTasks.push(sendAdminEmail(orderInfo, licenseCodes));

  await Promise.race([
    Promise.allSettled(emailTasks),
    new Promise(r => setTimeout(r, 8000))
  ]);

  // Stripe 要求返回 200，否则会重试
  return res.status(200).send('ok');
};
