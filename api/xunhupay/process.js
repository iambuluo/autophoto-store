/**
 * POST /api/xunhupay/process
 * 接收 Edge Function 转发的订单处理请求，发送邮件
 * 这个是内部 API，只允许来自同域的调用
 */
const { PLAN_LABELS, PLUGIN_NAMES, getCodeLabel } = require('../_lib/pricing-config');

// 强制使用 Node.js Runtime（process.js 使用 CommonJS require）
export const config = { runtime: 'nodejs' };

async function sendLicenseEmail(toEmail, orderInfo, licenseCodes) {
  console.log('[sendLicenseEmail] 开始发送邮件到:', toEmail);
  if (!toEmail) { console.log('⚠️ 无收件人邮箱'); return; }

  // 方案A：Resend（推荐，Vercel 兼容）
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.EMAIL_FROM || 'AutoPhoto <onboarding@resend.dev>';
      const name = orderInfo.name || '用户';
      const plugins = orderInfo.plugins || [];

      // 从码中还原插件名标注
      const codeList = licenseCodes.map(c => {
        const label = getCodeLabel(c, plugins);
        return `<div style="margin-bottom:8px;"><span style="color:#94a3b8;font-size:13px;">${label}</span><br><code style="background:#1a1a2e;padding:8px 16px;border-radius:6px;display:inline-block;margin-top:4px;font-family:monospace;color:#818cf8;font-size:16px;letter-spacing:1px;">${c}</code></div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#0a0a0f;color:#f1f5f9;margin:0;padding:20px;}
.wrap{max-width:600px;margin:0 auto;}.card{background:#13131a;border:1px solid #2a2a3e;border-radius:16px;padding:32px;}
.h1{font-size:22px;color:#818cf8;margin:0 0 24px;}h2{font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;}
p{color:#94a3b8;line-height:1.8;font-size:14px;margin:0 0 10px;}.warning{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:12px;color:#f59e0b;font-size:13px;}
.footer{text-align:center;color:#475569;font-size:12px;margin-top:28px;padding-top:20px;border-top:1px solid #1e1e2e;}
</style></head><body><div class="wrap"><div class="card">
<h1>🛒 AutoPhoto 授权码通知</h1>
<p>您好，<strong>${name}</strong>！</p>
<p>感谢您的购买！以下是您的授权码信息：</p>
<h2>📦 已购插件</h2><p>${plugins.map(p => PLUGIN_NAMES[p] || p).join('<br>')}</p>
<h2>📋 授权类型</h2><p>${orderInfo.planName}</p>
<h2>🔑 授权码</h2>${codeList}
<div class="warning">⚠️ 请妥善保管授权码，切勿泄露。每个授权码绑定一台设备。</div>
<h2>📖 使用方法</h2>
<p>1. 安装对应 Chrome 插件<br>2. 打开插件设置页面<br>3. 输入授权码并激活<br>4. 开始使用！</p>
<h2>💬 技术支持</h2>
<p>微信：auto_photo2025<br>邮箱：tourinn@gmail.com</p>
<div class="footer">AutoPhoto.store · 专注图库创作者效率工具</div>
</div></div></body></html>`;

      await resend.emails.send({ from, to: toEmail, subject: `🔑 您的 AutoPhoto 授权码已发放`, html });
      console.log(`✅ [Resend] 邮件已发送至 ${toEmail}`);
      return;
    } catch (err) {
      console.error(`❌ [Resend] 发送失败: ${err.message}，尝试备用方案...`);
    }
  }

  // 方案B：nodemailer/SMTP（备用）
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch (e) { console.log('⚠️ nodemailer 未安装:', e.message); return; }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('⚠️ SMTP 未配置 - SMTP_USER:', !!process.env.SMTP_USER, 'SMTP_PASS:', !!process.env.SMTP_PASS);
    return;
  }

  const name = orderInfo.name || '用户';
  const plugins = orderInfo.plugins || [];
  const codeList = licenseCodes.map(c => `${getCodeLabel(c, plugins)} ${c}`).join('\n');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#0a0a0f;color:#f1f5f9;margin:0;padding:20px;}
.wrap{max-width:600px;margin:0 auto;}.card{background:#13131a;border:1px solid #2a2a3e;border-radius:16px;padding:32px;}
h1{font-size:22px;color:#818cf8;margin:0 0 24px;}h2{font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;}
p{color:#94a3b8;line-height:1.8;font-size:14px;margin:0 0 10px;}.warning{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:12px;color:#f59e0b;font-size:13px;}
.footer{text-align:center;color:#475569;font-size:12px;margin-top:28px;padding-top:20px;border-top:1px solid #1e1e2e;}
</style></head><body><div class="wrap"><div class="card">
<h1>🛒 AutoPhoto 授权码通知</h1>
<p>您好，<strong>${name}</strong>！</p>
<p>感谢您的购买！以下是您的授权码信息：</p>
<h2>📦 已购插件</h2><p>${plugins.map(p => PLUGIN_NAMES[p] || p).join('<br>')}</p>
<h2>📋 授权类型</h2><p>${orderInfo.planName}</p>
<h2>🔑 授权码</h2><pre style="background:#1a1a2e;padding:16px;border-radius:8px;color:#818cf8;font-size:14px;">${codeList}</pre>
<div class="warning">⚠️ 请妥善保管授权码，切勿泄露。每个授权码绑定一台设备。</div>
<h2>📖 使用方法</h2>
<p>1. 安装对应 Chrome 插件<br>2. 打开插件设置页面<br>3. 输入授权码并激活<br>4. 开始使用！</p>
<h2>💬 技术支持</h2>
<p>微信：auto_photo2025<br>邮箱：tourinn@gmail.com</p>
<div class="footer">AutoPhoto.store · 专注图库创作者效率工具</div>
</div></div></body></html>`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.qq.com', port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({ from: `"AutoPhoto" <${process.env.SMTP_USER}>`, to: toEmail, subject: `🔑 您的 AutoPhoto 授权码已发放`, html });
  console.log(`✅ 邮件已发送至 ${toEmail}`);
}

async function sendAdminEmail(orderInfo, licenseCodes) {
  if (!process.env.ADMIN_EMAIL) { console.log('admin mail: ADMIN_EMAIL not set'); return; }

  const plugins = (orderInfo.plugins || []).map(p => PLUGIN_NAMES[p] || p);
  const codeList = licenseCodes.map(c => `${getCodeLabel(c, orderInfo.plugins || [])} ${c}`).join('\n');

  const subject = `[AutoPhoto] New Order #${orderInfo.orderNo} - ${plugins.join(', ')} - CNY${orderInfo.total}`;
  const text = `AutoPhoto New Order Notification

Order ID: ${orderInfo.orderNo}
Plugin(s): ${plugins.join(', ')}
License Type: ${orderInfo.planName}
Amount: CNY ${orderInfo.total}
Buyer: ${orderInfo.name}
Email: ${orderInfo.email}
WeChat: ${orderInfo.wechat || 'N/A'}
License Code(s):
${codeList}
Time: ${orderInfo.paidAt}`;

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.EMAIL_FROM || 'AutoPhoto <onboarding@resend.dev>';
      await resend.emails.send({ from, to: process.env.ADMIN_EMAIL, subject, html: `<pre>${text}</pre>` });
      console.log(`✅ [Resend] 管理员邮件已发送至 ${process.env.ADMIN_EMAIL}`);
      return;
    } catch (err) {
      console.error(`❌ [Resend] 管理员邮件失败: ${err.message}`);
    }
  }

  // SMTP 备用
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch (e) { return; }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { return; }
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.qq.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await transporter.sendMail({ from: `"AutoPhoto Order" <${process.env.SMTP_USER}>`, to: process.env.ADMIN_EMAIL, subject, text });
  console.log(`✅ SMTP: 管理员邮件已发送至 ${process.env.ADMIN_EMAIL}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const body = req.body || {};
  console.log('📬 process收到请求:', JSON.stringify(body).substring(0, 300));

  const { trade_order_id, total_fee, plugins, plan, planName, email, name, wechat, licenseCodes } = body;

  if (!licenseCodes || !Array.isArray(licenseCodes) || licenseCodes.length === 0) {
    console.error('❌ 无授权码，跳过');
    return res.json({ success: false, error: 'no license codes' });
  }

  const orderInfo = {
    orderNo: trade_order_id,
    plugins: plugins || [],
    planName: planName || PLAN_LABELS[plan] || plan,
    total: total_fee || '0',
    name: name || '用户',
    email: email,
    wechat: wechat || '',
    paidAt: new Date().toISOString(),
    plan: plan
  };

  console.log(`📧 开始发送邮件...`);

  try {
    if (email) await sendLicenseEmail(email, orderInfo, licenseCodes);
    await sendAdminEmail(orderInfo, licenseCodes);
    console.log(`✅ 完成！授权码: ${licenseCodes.join(', ')}`);
    return res.json({ success: true, codes: licenseCodes });
  } catch (err) {
    console.error('❌ 邮件发送失败:', err.message);
    return res.json({ success: false, error: err.message });
  }
};
