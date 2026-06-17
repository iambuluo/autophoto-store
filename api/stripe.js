/**
 * api/stripe.js - Stripe 支付 + 授权码池发货
 *
 * POST /api/stripe/create-checkout  → 创建 Checkout Session
 * POST /api/stripe/callback         → 付款完成 → 从码池取码 → 发邮件
 */

const Stripe = require('stripe');
const crypto = require('crypto');
const pool = require('./lib/license-pool');

// ============================================================
// 懒加载 Stripe
// ============================================================
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
// 配置
// ============================================================
const PLAN_LABELS = {
  testpay: 'Test Payment ($0.01)', trial: '1-Day Trial',
  annual: 'Annual License (Yearly)', permanent: 'Lifetime License (Permanent)'
};
const PLUGIN_NAMES = {
  shijuezhongguo: 'VCPhoto Auto Submitter',
  guangchang: 'VJshi Batch Submitter',
  xinchangchang: 'Xinchangchang AIGC Assistant',
  dreamstime: 'Dreamstime Auto Submitter',
  'adobe-stock': 'Adobe Stock Keyword Clicker',
  'qingying-image': 'QingYing Image Batch',
  'qingying-video': 'QingYing Video Batch'
};
const PLAN_PRICES_USD = { testpay: 1, trial: 150, annual: 2900, permanent: 6900 };
const DISCOUNTS = { 1: 1.0, 2: 0.88, 3: 0.80, 4: 0.70, 5: 0.60, 6: 0.60, 7: 0.50 };

// ============================================================
// 邮件发送
// ============================================================
async function sendEmail({ to, subject, html }) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.log('RESEND_API_KEY not set'); return null; }
  const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const from = EMAIL_FROM !== 'onboarding@resend.dev'
    ? 'AutoPhoto Store <' + EMAIL_FROM + '>'
    : 'AutoPhoto Store <onboarding@resend.dev>';

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html })
    });
    const data = await resp.json();
    if (!resp.ok) console.error('Email failed:', JSON.stringify(data));
    else console.log('Email sent:', data.id, '->', to);
    return data;
  } catch (err) {
    console.error('Email error:', err);
    return null;
  }
}

async function sendLicenseEmail(allocations, email, customerName, planLabel, amount) {
  const downloadBase = 'https://www.autophoto.store/downloads';
  const successCodes = allocations.filter(a => a.code);
  const failPlugins = allocations.filter(a => !a.code).map(a => pool.PLAN_NAMES[a.plan] || a.plan);

  const codeCards = successCodes.map(a => {
    const name = pool.PLAN_NAMES[a.plan] || a.plan;
    const pluginName = pool.PLUGIN_NAMES_CN[a.pluginId] || a.pluginId;
    return '<div style="background:#f0fdf4;border:1px solid #22c55e;border-radius:10px;padding:16px;margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<div><div style="font-size:13px;color:#64748b">' + pluginName + ' · ' + name + '</div></div>' +
      '<code style="font-size:18px;color:#16a34a;font-weight:bold;letter-spacing:2px">' + a.code + '</code>' +
      '</div></div>';
  }).join('');

  const dlLinks = [...new Set(successCodes.map(a => a.pluginId))].map(pid => {
    const name = pool.PLUGIN_NAMES_CN[pid] || pid;
    return '<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1e293b">' + name +
      '</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">' +
      '<a href="' + downloadBase + '/' + pid + '.zip" style="background:#6366f1;color:#fff;padding:6px 14px;border-radius:5px;text-decoration:none;font-size:12px;font-weight:600">下载插件</a></td></tr>';
  }).join('');

  const warningBlock = failPlugins.length > 0
    ? '<div style="background:#fef2f2;border:1px solid #ef4444;border-radius:8px;padding:14px;margin-bottom:20px;font-size:14px;color:#991b1b">' +
      '<b>⚠️ 部分授权码延迟发放</b><br>以下插件授权码暂时缺货，我们将在24小时内补码后补发：' + failPlugins.join('、') + '</div>'
    : '';

  await sendEmail({
    to: email,
    subject: '🎉 支付成功！您的 AutoPhoto 插件授权码及安装步骤',
    html: '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1e293b">' +
      '<div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);border-radius:16px 16px 0 0;padding:32px 28px;color:#fff">' +
      '<h1 style="font-size:24px;margin-bottom:8px">🎉 支付成功！</h1>' +
      '<p style="opacity:0.9;font-size:15px;margin-bottom:4px">感谢您的购买！以下是您的授权码和安装激活指南。</p>' +
      '<p style="opacity:0.9;font-size:14px">实付金额：<b>$' + amount + '</b></p></div>' +
      '<div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:28px;border-radius:0 0 16px 16px">' +
      warningBlock +
      '<h3 style="font-size:15px;margin-bottom:12px;color:#334155">🔑 您的授权码</h3>' +
      '<div style="margin-bottom:20px">' + codeCards + '</div>' +
      '<h3 style="font-size:15px;margin-bottom:12px;color:#334155">📦 下载插件</h3>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;background:#f8fafc;border-radius:8px;overflow:hidden">' + dlLinks + '</table>' +
      // ---- 安装步骤 ----
      '<div style="background:#eff6ff;border:1px solid #3b82f6;border-radius:10px;padding:20px;margin-bottom:16px">' +
      '<h3 style="font-size:14px;margin-bottom:10px;color:#1e40af">📥 安装插件（4步）</h3>' +
      '<ol style="padding-left:18px;font-size:13px;line-height:2.2;color:#1e3a8a;margin:0">' +
      '<li>点击下载链接，下载 ZIP 文件</li>' +
      '<li>解压 ZIP 文件到任意文件夹</li>' +
      '<li>打开 Chrome 浏览器，地址栏输入 <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">chrome://extensions/</code> → 开启"开发者模式" → 点击"加载已解压的扩展程序" → 选择解压文件夹</li>' +
      '<li>插件安装完成，工具栏会出现 AutoPhoto 图标 🎉</li></ol></div>' +
      // ---- 激活步骤 ----
      '<div style="background:#f0fdf4;border:1px solid #22c55e;border-radius:10px;padding:20px;margin-bottom:16px">' +
      '<h3 style="font-size:14px;margin-bottom:10px;color:#166534">🔐 激活授权（关键步骤）</h3>' +
      '<ol style="padding-left:18px;font-size:13px;line-height:2.2;color:#14532d;margin:0">' +
      '<li>安装完成后，点击浏览器工具栏的 <b>AutoPhoto 图标</b></li>' +
      '<li>在弹窗中看到"输入授权码"界面</li>' +
      '<li>粘贴邮件中的授权码（如 <code style="background:#f0fdf4;padding:2px 6px;border-radius:4px">VCG-A1B2C3D4</code>）</li>' +
      '<li>点击 <b>"激活"</b> 按钮</li>' +
      '<li>系统自动采集机器码并绑定 → 提示"激活成功" ✅</li>' +
      '<li>插件即可正常使用，无需联网验证</li></ol></div>' +
      // ---- 换设备须知 ----
      '<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;padding:16px;margin-bottom:16px;font-size:13px;line-height:1.7">' +
      '<b>📱 换设备 / 重装系统怎么办？</b><br>' +
      '1. 用新电脑重新安装插件 → 粘贴<strong>同一个授权码</strong> → 提示"已绑定其他设备"<br>' +
      '2. 联系微信 <b>auto_photo2025</b>，说明情况（提供购买邮箱）<br>' +
      '3. 客服帮您解除旧设备绑定 → 新设备重新激活 → <b>剩余时间不变！</b><br>' +
      '<b style="color:#92400e">💡 授权码是您永久拥有的，不会因为换设备而失效。</b></div>' +
      // ---- 注意事项 ----
      '<div style="background:#fef2f2;border:1px solid #ef4444;border-radius:8px;padding:14px;font-size:13px;color:#991b1b;line-height:1.7">' +
      '<b>⚠️ 注意事项</b><br>' +
      '• 每个授权码仅限一台设备同时使用，请勿共享<br>' +
      '• 如需卸载插件，可到管理后台解除绑定<br>' +
      '• 授权码请勿泄露给他人</div>' +
      // ---- Footer ----
      '<div style="margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:13px;color:#64748b">' +
      '<p>如有任何问题，请联系：</p>' +
      '<p>微信：<b style="color:#334155">auto_photo2025</b> ｜ 邮箱：<b style="color:#334155">contact@autophoto.store</b></p>' +
      '<p style="margin-top:12px;font-size:11px;color:#94a3b8">Autophoto.store © 2026 · 专业图库自动化平台</p></div></div></div>'
  });
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

  const pathname = req.url.split('?')[0];
  try {
    if (pathname.endsWith('/callback')) {
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

  const count = plugins.length;
  const discount = DISCOUNTS[count] || (count >= 7 ? 0.50 : 1.0);
  const totalCents = Math.round(PLAN_PRICES_USD[plan] * count * discount);
  const pnames = plugins.map(p => PLUGIN_NAMES[p] || p);
  const productName = count === 1 ? 'AutoPhoto - ' + pnames[0] : 'AutoPhoto - ' + count + ' Plugins Bundle';
  const productDesc = count === 1
    ? (PLAN_LABELS[plan] || plan)
    : pnames.join(', ') + ' | ' + (PLAN_LABELS[plan] || plan) + (discount < 1 ? ' (' + Math.round((1 - discount) * 100) + '% off)' : '');

  const origin = req.headers.origin || 'https://www.autophoto.store';
  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: productName, description: productDesc },
        unit_amount: totalCents
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: origin + '/success.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/buy.html?cancelled=1',
    metadata: { plugins: JSON.stringify(plugins), plan, name: name || '', email },
    customer_email: email,
    locale: 'auto'
  });

  res.status(200).json({
    success: true, mode: 'stripe', url: session.url,
    sessionId: session.id, totalUsd: (totalCents / 100).toFixed(2)
  });
}

// ============================================================
// 处理 Webhook 回调
// ============================================================
async function handleCallback(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    res.status(400).send('Webhook Error: ' + err.message);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { plugins, plan, name, email } = session.metadata || {};
    const pluginArr = JSON.parse(plugins || '[]');
    const label = PLAN_LABELS[plan] || plan;
    const amount = session.amount_total ? (session.amount_total / 100).toFixed(2) : '-';

    console.log('✅ Payment complete: ' + session.id + ' -> ' + pluginArr.join(',') + '/' + plan);

    // 从码池分配授权码（异步）
    const allocations = await pool.allocateMultipleLicenses(pluginArr, plan, email, session.id);
    const successCount = allocations.filter(a => a.code).length;
    const failCount = allocations.filter(a => !a.code).length;

    console.log('📦 Allocated: ' + successCount + ' success' + (failCount > 0 ? ', ' + failCount + ' FAILED' : ''));
    for (const a of allocations) {
      if (!a.code) {
        console.warn('  ⚠️ ' + a.pluginId + '/' + a.plan + ' 码池耗尽!');
      } else {
        console.log('  ✅ ' + a.code + ' -> ' + a.pluginId + '/' + a.plan);
      }
    }

    // 发邮件
    await sendLicenseEmail(allocations, email, name, label, amount);

    // 告警邮件
    if (failCount > 0) {
      const failPlugins = allocations.filter(a => !a.code).map(a => a.pluginId + '/' + a.plan).join(', ');
      await sendEmail({
        to: pool.ADMIN_EMAIL,
        subject: '🚨 码池耗尽告警 - ' + session.id,
        html: '<div style="font-family:Arial;padding:20px"><h2 style="color:#ef4444">🚨 授权码池耗尽</h2>' +
          '<p>订单: <b>' + session.id + '</b></p><p>客户: <b>' + email + '</b></p>' +
          '<p>耗尽插件: <b>' + failPlugins + '</b></p><p>请立即补充码池！</p></div>'
      });
    }
  }

  res.status(200).json({ received: true });
}
