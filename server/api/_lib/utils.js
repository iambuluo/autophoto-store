/**
 * 共享工具函数 - AutoPhoto Vercel Serverless
 */
const crypto = require('crypto');

const PLAN_PRICES = {
  test001: 0.01,
  trial: 9.9,
  annual: 199,
  permanent: 399
};

const PLAN_LABELS = {
  test001: '🔧调试测试',
  trial: '1天试用',
  annual: '年度授权',
  permanent: '永久授权'
};

const DISCOUNTS = {
  1: 1.0, 2: 0.88, 3: 0.80, 4: 0.70, 5: 0.60, 6: 0.60, 7: 0.50
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

// 内存订单存储（Vercel Serverless 无状态，用 Map 存当前实例）
// 注意：冷启动会清空，这里仅作为临时缓存
const pendingOrders = new Map();
const paidOrders = new Map();

function calcPrice(plugins, plan) {
  const count = plugins.length;
  if (plan === 'test001') return 0.01;
  const discount = DISCOUNTS[count] || 1.0;
  const unitPrice = PLAN_PRICES[plan] || 0;
  return parseFloat((unitPrice * count * discount).toFixed(2));
}

function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  switch (plan) {
    case 'trial':     return now + 1 * DAY;
    case 'annual':    return now + 365 * DAY;
    case 'permanent': return now + 99 * 365 * DAY;
    case 'test001':   return now + 3600;
    default:          return now + 365 * DAY;
  }
}

function generateLicenseCode(pluginId, plan) {
  const prefixes = {
    shijuezhongguo: 'VCG',
    guangchang: 'VJ',
    xinchangchang: 'XC',
    dreamstime: 'DT',
    'adobe-stock': 'AS',
    'qingying-image': 'QY',
    'qingying-video': 'QV'
  };
  const prefix = prefixes[pluginId] || 'XX';
  const planChar = plan === 'permanent' ? 'P' : plan === 'annual' ? 'Y' : plan === 'trial' ? 'T' : 'X';
  const expiry = calcExpiry(plan);
  const expiryB36 = expiry.toString(36).toUpperCase();
  const rand = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `AP-${prefix}-${planChar}${expiryB36}-${rand}`;
}

function signXunhu(params, appSecret) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== 'hash' && v !== '' && v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + appSecret;
  return crypto.createHash('md5').update(str).digest('hex');
}

function verifyXunhuSign(params, appSecret) {
  const expectedHash = signXunhu(params, appSecret);
  return params.hash === expectedHash;
}

function buildEmailHtml(name, pluginList, planName, codeList) {
  const codeHtml = codeList.map(c =>
    `<div style="background:#1a1a2e;padding:10px 16px;border-radius:6px;margin:6px 0;font-family:monospace;color:#818cf8;font-size:16px;letter-spacing:1px;">${c}</div>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#0a0a0f;color:#f1f5f9;margin:0;padding:20px;}
.wrap{max-width:600px;margin:0 auto;}
.card{background:#13131a;border:1px solid #2a2a3e;border-radius:16px;padding:32px;}
h1{font-size:22px;color:#818cf8;margin:0 0 24px;}
h2{font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;}
p{color:#94a3b8;line-height:1.8;font-size:14px;margin:0 0 10px;}
.warning{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:12px;color:#f59e0b;font-size:13px;margin:16px 0;}
.footer{text-align:center;color:#475569;font-size:12px;margin-top:28px;padding-top:20px;border-top:1px solid #1e1e2e;}
</style></head><body>
<div class="wrap"><div class="card">
  <h1>🛒 AutoPhoto 授权码通知</h1>
  <p>您好，<strong>${name}</strong>！感谢您的购买，以下是您的授权信息：</p>
  <h2>📦 已购插件</h2><p>${pluginList}</p>
  <h2>📋 授权类型</h2><p>${planName}</p>
  <h2>🔑 授权码</h2>${codeHtml}
  <div class="warning">⚠️ 请妥善保管授权码，切勿泄露。授权码与购买套餐绑定，到期后需续费。</div>
  <h2>📖 使用方法</h2>
  <p>1. 安装对应 Chrome 插件<br>2. 打开插件设置页面<br>3. 输入授权码并激活<br>4. 开始使用！</p>
  <h2>💬 技术支持</h2>
  <p>微信：auto_photo2025 &nbsp;|&nbsp; 邮箱：tourinn@gmail.com</p>
  <div class="footer">AutoPhoto.store · 专注图库创作者效率工具</div>
</div></div></body></html>`;
}

async function sendEmail({ to, subject, html, text }) {
  // 方案A：Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.EMAIL_FROM || 'AutoPhoto <onboarding@resend.dev>';
      const result = await resend.emails.send({ from, to, subject, html });
      console.log(`[Resend] ✅ 邮件已发送至 ${to}`);
      return { success: true, mode: 'resend' };
    } catch (err) {
      console.error(`[Resend] ❌ ${err.message}`);
    }
  }
  // 演示模式
  console.log(`\n========== [演示模式] 邮件 ==========`);
  console.log(`收件人: ${to}\n主题: ${subject}`);
  console.log(`======================================\n`);
  return { success: true, mode: 'demo' };
}

async function sendLicenseEmail(toEmail, orderInfo, licenseCodes) {
  const name = orderInfo.name || '用户';
  const pluginList = orderInfo.plugins.map(p => PLUGIN_NAMES[p] || p).join('<br>');
  const html = buildEmailHtml(name, pluginList, orderInfo.planName, licenseCodes);
  const subject = `🔑 您的 AutoPhoto 授权码 - ${orderInfo.plugins.map(p => PLUGIN_NAMES[p] || p).join('/')}`;
  return sendEmail({ to: toEmail, subject, html });
}

async function sendAdminEmail(orderInfo, licenseCodes) {
  if (!process.env.ADMIN_EMAIL) return;
  const subject = `💰 新订单 #${orderInfo.orderNo} - ${orderInfo.plugins.map(p => PLUGIN_NAMES[p] || p).join('+')} - ¥${orderInfo.total}`;
  const text = `新订单通知！
订单号: ${orderInfo.orderNo}
插件: ${orderInfo.plugins.map(p => PLUGIN_NAMES[p] || p).join(', ')}
授权: ${orderInfo.planName}
金额: ¥${orderInfo.total}
买家: ${orderInfo.name}
邮箱: ${orderInfo.email}
微信: ${orderInfo.wechat || '未填写'}
授权码: ${licenseCodes.join(', ')}
时间: ${orderInfo.paidAt}`;
  return sendEmail({ to: process.env.ADMIN_EMAIL, subject, html: `<pre>${text}</pre>`, text });
}

module.exports = {
  PLAN_PRICES, PLAN_LABELS, PLUGIN_NAMES,
  pendingOrders, paidOrders,
  calcPrice, calcExpiry, generateLicenseCode,
  signXunhu, verifyXunhuSign,
  sendEmail, sendLicenseEmail, sendAdminEmail
};
