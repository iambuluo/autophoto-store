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

      const name = orderInfo.name || '用户';
      const plugins = orderInfo.plugins || [];

      // 从码中还原插件名标注
      const codeList = licenseCodes.map(c => {
        const label = getCodeLabel(c, plugins);
        return `<div style="margin-bottom:12px;">
          <div style="color:#64748b;font-size:13px;margin-bottom:4px;">${label}</div>
          <code style="background:#f0fdf4;padding:10px 18px;border-radius:6px;display:inline-block;margin-top:4px;font-family:monospace;color:#16a34a;font-size:15px;letter-spacing:1px;word-break:break-all;">${c}</code>
        </div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;background:#f8fafc;color:#1e293b;margin:0;padding:20px;}
.wrap{max-width:680px;margin:0 auto;}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;}
.header{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 28px;color:#fff;}
.header h1{font-size:22px;margin:0 0 8px;}.header p{font-size:14px;opacity:0.9;margin:0;}
.body{padding:28px;}
.section{margin-bottom:20px;}.section-title{font-size:14px;font-weight:700;color:#1e40af;margin-bottom:10px;}
.code-card{background:#f0fdf4;border:1px solid #22c55e;border-radius:8px;padding:14px;margin-bottom:10px;}
.step-box{background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:16px;margin:16px 0;}
.success-box{background:#f0fdf4;border:1px solid #22c55e;border-radius:8px;padding:16px;margin:16px 0;}
.warning-box{background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:14px;font-size:13px;line-height:1.7;margin:16px 0;}
.alert-box{background:#fef2f2;border:1px solid #ef4444;border-radius:8px;padding:14px;font-size:13px;line-height:1.7;margin:16px 0;color:#991b1b;}
.footer{padding:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;text-align:center;}
</style></head><body><div class="wrap"><div class="card">
<div class="header"><h1>🛒 支付成功！</h1><p>感谢您的购买！以下是您的授权码和安装激活指南。</p></div>
<div class="body">
<p>您好，<b>${escapeHtml(name)}</b>！</p>

<div class="section">
<div class="section-title">📦 已购插件</div>
<p>${plugins.map(p => escapeHtml(PLUGIN_NAMES[p] || p)).join('<br>')}</p>
</div>

<div class="section">
<div class="section-title">📋 授权类型</div>
<p>${escapeHtml(orderInfo.planName)}</p>
</div>

<div class="section">
<div class="section-title">🔑 授权码</div>
${codeList}
</div>

<div class="step-box">
<b style="color:#1e40af">📥 安装插件（4步）</b><br><br>
<ol style="padding-left:18px;margin:0;line-height:2.2;font-size:13px;color:#1e3a8a;">
<li>点击下载链接，下载 ZIP 文件</li>
<li>解压 ZIP 文件到任意文件夹</li>
<li>打开 Chrome 浏览器，地址栏输入 <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px">chrome://extensions/</code> → 开启"开发者模式" → 点击"加载已解压的扩展程序" → 选择解压文件夹</li>
<li>插件安装完成，工具栏会出现 AutoPhoto 图标 🎉</li></ol>
</div>

<div class="success-box">
<b style="color:#166534">🔐 激活授权（关键步骤）</b><br><br>
<ol style="padding-left:18px;margin:0;line-height:2.2;font-size:13px;color:#14532d;">
<li>安装完成后，点击浏览器工具栏的 <b>AutoPhoto 图标</b></li>
<li>在弹窗中看到"输入授权码"界面</li>
<li>粘贴邮件中的授权码（如 <code style="background:#f0fdf4;padding:2px 6px;border-radius:4px;font-size:12px">VCG-A1B2C3D4</code>）</li>
<li>点击 <b>"激活"</b> 按钮</li>
<li>系统自动采集机器码并绑定 → 提示"激活成功" ✅</li>
<li>插件即可正常使用，无需联网验证</li></ol>
</div>

<div class="warning-box">
<b>📱 换设备 / 重装系统怎么办？</b><br>
1. 用新电脑重新安装插件 → 粘贴<strong>同一个授权码</strong> → 提示"已绑定其他设备"<br>
2. 联系微信 <b>auto_photo2025</b>，说明情况（提供购买邮箱）<br>
3. 客服帮您解除旧设备绑定 → 新设备重新激活 → <b>剩余时间不变！</b><br>
<b style="color:#92400e">💡 授权码是您永久拥有的，不会因为换设备而失效。</b>
</div>

<div class="alert-box">
<b>⚠️ 注意事项</b><br>
• 每个授权码仅限一台设备同时使用，请勿共享<br>
• 如需卸载插件，可到管理后台解除绑定<br>
• 授权码请勿泄露给他人
</div>

<div class="footer" style="background:#f8fafc;margin-top:20px;padding:20px;border-top:1px solid #e5e7eb;font-size:13px">
<p>如有任何问题，请联系：</p>
<p>微信：<b style="color:#334155">auto_photo2025</b> ｜ 邮箱：<b style="color:#334155">contact@autophoto.store</b></p>
<p style="margin-top:12px;font-size:11px;color:#94a3b8">AutoPhoto.store © 2026 · 专注图库创作者效率工具</p>
</div>
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
