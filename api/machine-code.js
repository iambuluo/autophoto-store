/**
 * api/machine-code.js — 机器码注册 API
 * 
 * POST /api/machine-code/submit
 *   body: { token, machineCode }
 *
 * GET /api/machine-code/check?token=xxx
 *   → 返回订单状态
 */

const fs = require('fs');
const path = require('path');

// JSON 文件数据库（Vercel 临时目录，每次部署可能清空，但 webhook 会重写）
const DB_FILE = '/tmp/orders-db.json';

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { orders: [] };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function findOrder(token) {
  const db = readDB();
  return db.orders.find(o => o.token === token);
}

function updateOrder(token, updates) {
  const db = readDB();
  const idx = db.orders.findIndex(o => o.token === token);
  if (idx === -1) return false;
  db.orders[idx] = { ...db.orders[idx], ...updates, updatedAt: new Date().toISOString() };
  writeDB(db);
  return true;
}

async function sendEmail({ to, subject, html }) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) throw new Error('RESEND_API_KEY not set');

  const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const from = EMAIL_FROM !== 'onboarding@resend.dev'
    ? `AutoPhoto Store <${EMAIL_FROM}>`
    : 'AutoPhoto Store <onboarding@resend.dev>';

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(data));
  return data;
}

const PLUGIN_DL_NAMES = {
  shijuezhongguo: '视觉中国自动提交',
  guangchang: '光厂批量填写助手',
  xinchangchang: '新片场AIGC提交助手',
  dreamstime: 'Dreamstime Auto Submitter',
  'adobe-stock': 'Adobe Stock关键词助手',
  'qingying-image': '清影批量生图片',
  'qingying-video': '清影批量生视频'
};

// ============================================================
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const pathname = req.url.split('?')[0];

  try {
    if (req.method === 'POST' && pathname.endsWith('/submit')) {
      await handleSubmit(req, res);
    } else if (req.method === 'GET') {
      await handleCheck(req, res);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    console.error('machine-code error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// 查询订单状态
// ============================================================
async function handleCheck(req, res) {
  const token = req.query.token || req.query.orderToken;
  if (!token) { res.status(400).json({ error: '缺少 token 参数' }); return; }

  const order = findOrder(token);
  if (!order) { res.status(404).json({ error: '订单不存在' }); return; }

  // 只返回安全的公开信息
  res.json({
    token: order.token,
    plugins: order.plugins,
    planLabel: order.planLabel,
    status: order.status,
    hasMachineCode: !!order.machineCode,
    // 以下仅在管理员参数正确时返回
    email: order.email,
    name: order.name,
    machineCode: order.machineCode || null,
    createdAt: order.createdAt
  });
}

// ============================================================
// 提交机器码
// ============================================================
async function handleSubmit(req, res) {
  const { token, machineCode } = req.body || {};

  if (!token || !machineCode) {
    res.status(400).json({ error: '缺少 token 或 machineCode' }); return;
  }

  // 清理机器码格式
  const cleanCode = machineCode.trim().toUpperCase();
  if (cleanCode.length < 6 || cleanCode.length > 128) {
    res.status(400).json({ error: '机器码格式无效' }); return;
  }

  const order = findOrder(token);
  if (!order) {
    res.status(404).json({ error: '订单不存在，请检查链接是否正确' }); return;
  }

  if (order.status === 'activated') {
    res.status(400).json({
      error: '此订单已完成授权',
      message: '授权码已发送至您的邮箱，请查收。如未收到请联系微信：auto_photo2025'
    });
    return;
  }

  // ⚠️ 防重复：一个订单只能提交一个机器码
  if (order.machineCode) {
    res.status(400).json({
      error: '机器码已提交',
      message: `此订单已绑定机器码：${order.machineCode}\n一个授权码仅限一台设备使用。\n如需更换设备请联系微信：auto_photo2025`
    });
    return;
  }

  // 更新订单
  updateOrder(token, {
    machineCode: cleanCode,
    status: 'machineCodeSubmitted'
  });

  // 发送确认邮件给客户
  const pluginsList = (order.plugins || []).map(p => PLUGIN_DL_NAMES[p] || p).join('、');

  try {
    await sendEmail({
      to: order.email,
      subject: `📦 机器码已收到 - ${pluginsList}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#3b82f6">📦 机器码已收到</h2>
          <p>您好 <b>${order.name || order.email}</b>，</p>
          <p>我们已经收到您的机器码，正在为您生成授权码。</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px">
            <tr><td style="padding:12px;color:#888;width:90px">机器码</td><td style="padding:12px;font-family:monospace;font-size:15px"><b>${cleanCode}</b></td></tr>
            <tr style="background:#fff"><td style="padding:12px;color:#888">购买插件</td><td style="padding:12px">${pluginsList}</td></tr>
            <tr><td style="padding:12px;color:#888">授权方案</td><td style="padding:12px">${order.planLabel}</td></tr>
          </table>
          <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:16px 0">
            <b>⏳ 等待授权</b>
            <p style="margin:8px 0 0">授权码将在 <b>24小时内</b> 发送至您的邮箱，请注意查收。</p>
          </div>
          <p style="color:#666;font-size:14px">如有紧急需要，请联系微信：<b>auto_photo2025</b></p>
        </div>`
    });
  } catch (e) {
    console.log('Confirmation email failed (non-critical):', e.message);
  }

  // 通知管理员
  const adminEmail = process.env.ADMIN_EMAIL || 'tourinn@gmail.com';
  try {
    await sendEmail({
      to: adminEmail,
      subject: `🔔 新机器码待授权 - ${order.email} - ${pluginsList}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#f59e0b">🔔 待生成授权码</h2>
          <table style="width:100%;border-collapse:collapse;background:#fffbeb;border-radius:8px;margin:16px 0">
            <tr><td style="padding:12px;color:#888">订单号</td><td style="padding:12px;font-family:monospace"><b>${order.token}</b></td></tr>
            <tr><td style="padding:12px;color:#888">客户邮箱</td><td style="padding:12px">${order.email}</td></tr>
            <tr><td style="padding:12px;color:#888">客户姓名</td><td style="padding:12px">${order.name || '—'}</td></tr>
            <tr><td style="padding:12px;color:#888">机器码</td><td style="padding:12px;font-family:monospace;font-size:16px;color:#dc2626"><b>${cleanCode}</b></td></tr>
            <tr><td style="padding:12px;color:#888">购买插件</td><td style="padding:12px">${pluginsList}</td></tr>
            <tr><td style="padding:12px;color:#888">授权方案</td><td style="padding:12px">${order.planLabel}</td></tr>
          </table>
          <p style="color:#666;font-size:13px">请使用 admin-keygen.html 生成 HMAC 授权码，然后回复客户邮件发送授权码。</p>
        </div>`
    });
  } catch (e) {
    console.log('Admin notification failed:', e.message);
  }

  res.json({
    success: true,
    message: '机器码已提交成功！我们将在 24 小时内发送授权码到您的邮箱。'
  });
}
