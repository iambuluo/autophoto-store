/**
 * AutoPhoto 后端服务 - 虎皮椒支付 + 自动发授权码 + 邮件通知
 *
 * 部署：Railway.app（Node.js 原生部署，免费额度充足）
 * 文档：https://docs.railway.app
 *
 * ============ 环境变量（在 Railway 控制台设置）============
 *
 * 【支付】
 *   XUNHU_APP_ID        虎皮椒应用ID
 *   XUNHU_APP_SECRET    虎皮椒应用密钥
 *   XUNHU_RETURN_URL    支付成功后跳转地址（前端成功页，如 https://autophoto.store）
 *
 * 【邮件 - 方案A：Resend（强烈推荐，Railway兼容）】
 *   RESEND_API_KEY      Resend API Key（从 resend.com 获取，免费100封/天）
 *   EMAIL_FROM          发件人地址（如 noreply@autophoto.store 或 onboarding@resend.dev）
 *
 * 【邮件 - 方案B：Gmail SMTP（备用，需开启两步验证+应用专用密码）】
 *   SMTP_PROVIDER       设置为 "gmail" 则走 Gmail
 *   SMTP_USER           你的 Gmail 地址（如 tourinn@gmail.com）
 *   SMTP_PASS           Gmail 应用专用密码（16位，从 Google 账户→安全性→应用专用密码 生成）
 *
 * 【管理】
 *   ADMIN_EMAIL         管理员邮箱（收新订单通知，建议填 tourinn@gmail.com）
 *   PLUGIN_BASE_URL     插件下载页面根地址（可选）
 *
 * ⚠️ 注意：QQ SMTP 被 Railway 美国IP封锁，请勿使用 QQ SMTP！
 *    优先使用 Resend，注册地址：https://resend.com
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('nodemailer 未安装，邮件功能不可用');
}

// Resend SDK（可选，若未安装则回退到 nodemailer）
let ResendClient = null;
try {
  const { Resend } = require('resend');
  ResendClient = Resend;
} catch (e) {
  // resend 包未安装，忽略
}

const app = express();
const PORT = process.env.PORT || 3000;

// ============ 中间件 ============
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true }));

// 静态文件（前端页面）
app.use(express.static('./public'));

// ============ 定价配置（与前端同步） ============
const PLAN_PRICES = {
  test001: 0.01,   // 调试测试
  trial: 9.9,       // 1天试用
  annual: 199,      // 年度
  permanent: 399    // 永久
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

// ============ 工具函数 ============

/**
 * 计算订单价格
 */
function calcPrice(plugins, plan) {
  const count = plugins.length;
  if (plan === 'test001') return 0.01;
  const discount = DISCOUNTS[count] || 1.0;
  const unitPrice = PLAN_PRICES[plan] || 0;
  return parseFloat((unitPrice * count * discount).toFixed(2));
}

/**
 * 根据套餐计算到期时间戳（Unix 秒）
 * trial    = 1天
 * annual   = 365天
 * permanent = 99年（即永久）
 * test001  = 1小时（测试用）
 */
function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  switch (plan) {
    case 'trial':     return now + 1 * DAY;
    case 'annual':    return now + 365 * DAY;
    case 'permanent': return now + 99 * 365 * DAY;   // ~99年
    case 'test001':   return now + 3600;              // 1小时
    default:          return now + 365 * DAY;
  }
}

/**
 * 生成授权码
 * 格式：AP-{插件前缀}-{方案字符}{到期时间戳Base36}-{随机5位hex}
 *
 * 解码示例（在插件端）：
 *   const parts = code.split('-');
 *   const planChar = parts[2][0];       // 'T' / 'Y' / 'P' / 'X'
 *   const expiryB36 = parts[2].slice(1);
 *   const expiry = parseInt(expiryB36, 36) * 1000;  // ms
 *   const isExpired = Date.now() > expiry;
 */
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
  const expiryB36 = expiry.toString(36).toUpperCase();   // Base36 压缩时间戳
  const rand = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `AP-${prefix}-${planChar}${expiryB36}-${rand}`;
}

/**
 * 从授权码中解析到期日（供后端校验时使用）
 * 返回 Date 对象，解析失败返回 null
 */
function parseExpiryFromCode(code) {
  try {
    const parts = code.split('-');
    // AP - 前缀 - 方案+到期 - 随机
    const segment = parts[2]; // e.g. "Y1KZQMN4"
    const expiryB36 = segment.slice(1);
    const expirySec = parseInt(expiryB36, 36);
    return new Date(expirySec * 1000);
  } catch (e) {
    return null;
  }
}

/**
 * 虎皮椒 MD5 签名
 * 规则：排除 hash 本身和空值，按 ASCII 排序，key=value&... + secret，MD5
 */
function signXunhu(params, appSecret) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== 'hash' && v !== '' && v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + appSecret;
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * 验证虎皮椒回调签名
 */
function verifyXunhuSign(params, appSecret) {
  // 虎皮椒回调使用 hash 字段
  const expectedHash = signXunhu(params, appSecret);
  return params.hash === expectedHash;
}

// 内存订单存储（Railway 有持久磁盘，简单场景够用）
// 注意：Railway 无服务器时间限制，重启后会清空
// 生产环境建议接入 Redis 或 Supabase
const pendingOrders = new Map();
const paidOrders = new Map();

/**
 * 构建授权码邮件 HTML
 */
function buildEmailHtml(name, pluginList, planName, codeList) {
  const codeHtml = codeList.map(c =>
    `<div style="background:#1a1a2e;padding:10px 16px;border-radius:6px;margin:6px 0;font-family:monospace;color:#818cf8;font-size:16px;letter-spacing:1px;">${c}</div>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#0a0a0f;color:#f1f5f9;margin:0;padding:20px;}
.wrap{max-width:600px;margin:0 auto;}
.card{background:#13131a;border:1px solid #2a2a3e;border-radius:16px;padding:32px;}
h1{font-size:22px;color:#818cf8;margin:0 0 24px;}
h2{font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;}
p{color:#94a3b8;line-height:1.8;font-size:14px;margin:0 0 10px;}
.warning{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:12px;color:#f59e0b;font-size:13px;margin:16px 0;}
.footer{text-align:center;color:#475569;font-size:12px;margin-top:28px;padding-top:20px;border-top:1px solid #1e1e2e;}
</style>
</head>
<body>
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
</div></div>
</body></html>`;
}

/**
 * 发送邮件（Resend 优先，Gmail 备用，均不可用则控制台输出）
 */
async function sendEmail({ to, subject, html, text }) {
  // ---- 方案A：Resend（推荐，Railway 兼容，免费100封/天）----
  if (process.env.RESEND_API_KEY && ResendClient) {
    try {
      const resend = new ResendClient(process.env.RESEND_API_KEY);
      const from = process.env.EMAIL_FROM || 'AutoPhoto <onboarding@resend.dev>';
      const result = await resend.emails.send({ from, to, subject, html });
      console.log(`✅ [Resend] 邮件已发送至 ${to}，ID: ${result.data?.id}`);
      return { success: true, mode: 'resend' };
    } catch (err) {
      console.error(`❌ [Resend] 发送失败: ${err.message}`);
      // 失败后尝试备用方案
    }
  }

  // ---- 方案B：Gmail SMTP（备用）----
  if (process.env.SMTP_USER && process.env.SMTP_PASS && nodemailer) {
    try {
      const isGmail = !process.env.SMTP_PROVIDER || process.env.SMTP_PROVIDER === 'gmail';
      const transporter = nodemailer.createTransport(
        isGmail
          ? { service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
          : {
              host: process.env.SMTP_HOST || 'smtp.qq.com',
              port: parseInt(process.env.SMTP_PORT) || 465,
              secure: true,
              auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            }
      );
      await transporter.sendMail({
        from: `"AutoPhoto" <${process.env.SMTP_USER}>`,
        to, subject, html
      });
      console.log(`✅ [Gmail SMTP] 邮件已发送至 ${to}`);
      return { success: true, mode: 'gmail' };
    } catch (err) {
      console.error(`❌ [Gmail SMTP] 发送失败: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ---- 演示模式：控制台输出 ----
  console.log(`\n========== [演示模式] 邮件 ==========`);
  console.log(`收件人: ${to}\n主题: ${subject}`);
  if (text) console.log(text);
  console.log(`======================================\n`);
  return { success: true, mode: 'demo' };
}

/**
 * 发送授权码邮件给买家
 */
async function sendLicenseEmail(toEmail, orderInfo, licenseCodes) {
  const name = orderInfo.name || '用户';
  const pluginList = orderInfo.plugins.map(p => PLUGIN_NAMES[p] || p).join('<br>');
  const html = buildEmailHtml(name, pluginList, orderInfo.planName, licenseCodes);
  const subject = `🔑 您的 AutoPhoto 授权码 - ${orderInfo.plugins.map(p => PLUGIN_NAMES[p] || p).join('/')}`;
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * 发邮件通知管理员有新订单
 */
async function sendAdminEmail(orderInfo, licenseCodes) {
  if (!process.env.ADMIN_EMAIL) return;
  const subject = `💰 新订单 #${orderInfo.orderNo} - ${orderInfo.plugins.map(p => PLUGIN_NAMES[p] || p).join('+')} - ¥${orderInfo.total}`;
  const text = `
新订单通知！
订单号: ${orderInfo.orderNo}
插件: ${orderInfo.plugins.map(p => PLUGIN_NAMES[p] || p).join(', ')}
授权: ${orderInfo.planName}
金额: ¥${orderInfo.total}
买家: ${orderInfo.name}
邮箱: ${orderInfo.email}
微信: ${orderInfo.wechat || '未填写'}
授权码: ${licenseCodes.join(', ')}
时间: ${orderInfo.paidAt}
  `.trim();
  return sendEmail({ to: process.env.ADMIN_EMAIL, subject, html: `<pre>${text}</pre>`, text });
}

// ============ API 接口 ============

/**
 * POST /api/create-order
 * 创建虎皮椒支付订单（或演示模式直接返回授权码）
 */
app.post('/api/create-order', async (req, res) => {
  try {
    const { plugins, plan, name, email, wechat, notes } = req.body;

    // 参数验证
    if (!plugins || plugins.length === 0) {
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

    // 演示模式：虎皮椒未配置时，直接生成授权码
    if (!process.env.XUNHU_APP_ID || !process.env.XUNHU_APP_SECRET) {
      const demoCodes = plugins.map(p => generateLicenseCode(p, plan));
      console.log(`⚠️ 虎皮椒未配置，进入演示模式`);
      return res.json({
        success: true,
        mode: 'demo',
        orderNo,
        total,
        message: '演示模式：授权码直接生成',
        demoLicenseCodes: demoCodes
      });
    }

    // 正式模式：调用虎皮椒 API
    const baseUrl = process.env.XUNHU_RETURN_URL || 'https://autophoto.store';
    const postData = {
      version: '1.1',
      appid: process.env.XUNHU_APP_ID,
      trade_order_id: orderNo,
      total_fee: total.toFixed(2),        // 虎皮椒以元为单位，字符串
      title: `AutoPhoto - ${plugins.map(p=>PLUGIN_NAMES[p]||p).join('+')} (${PLAN_LABELS[plan]})`,
      time: Math.floor(Date.now() / 1000).toString(),
      nonce_str: crypto.randomBytes(16).toString('hex'),
      return_url: `${baseUrl}/success.html?order=${orderNo}`,
      notify_url: `https://${process.env.RAILWAY_STATIC_URL || 'your-app.railway.app'}/xunhupay/callback`,
      attach: JSON.stringify({ plugins: plugins.join(','), plan, name, email, wechat }),
      buyer: email
    };

    // 生成签名（hash 字段）
    postData.hash = signXunhu(postData, process.env.XUNHU_APP_SECRET);

    const response = await fetch('https://api.xunhupay.com/payment/do.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(postData).toString()
    });

    const result = await response.json();

    if (result.errcode === 0 && result.url) {
      res.json({ success: true, mode: 'xunhu', paymentUrl: result.url, orderNo });
    } else {
      console.error('虎皮椒创建订单失败:', result);
      res.status(500).json({ success: false, error: result.errmsg || '支付创建失败' });
    }

  } catch (err) {
    console.error('创建订单异常:', err);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

/**
 * POST /xunhupay/callback
 * 虎皮椒支付回调通知（支付成功后，虎皮椒服务器会调用此接口）
 *
 * 重要：虎皮椒要求收到通知后返回纯文本 "success"
 * 否则会重试最多 6 次
 */
app.post('/xunhupay/callback', async (req, res) => {
  try {
    const params = req.body;
    console.log('📡 收到虎皮椒回调:', JSON.stringify(params));

    // 验证签名
    if (!verifyXunhuSign(params, process.env.XUNHU_APP_SECRET)) {
      console.error('❌ 签名验证失败');
      return res.status(200).send('fail');
    }

    const { trade_order_id, status, total_fee } = params;

    // 状态：OD = 已支付完成
    if (status !== 'OD') {
      console.log(`订单 ${trade_order_id} 状态: ${status}，忽略`);
      return res.status(200).send('success');
    }

    // 查找订单
    let orderInfo = pendingOrders.get(trade_order_id);
    if (!orderInfo) {
      // 尝试从已支付中查找（防止重复回调）
      orderInfo = paidOrders.get(trade_order_id);
      if (orderInfo) {
        console.log(`订单 ${trade_order_id} 已处理，直接返回成功`);
        return res.status(200).send('success');
      }
      console.error(`❌ 订单不存在: ${trade_order_id}`);
      return res.status(200).send('fail');
    }

    // 标记已支付
    orderInfo.status = 'paid';
    orderInfo.paidAt = new Date().toISOString();
    orderInfo.paidAmount = total_fee;
    paidOrders.set(trade_order_id, orderInfo);
    pendingOrders.delete(trade_order_id);

    console.log(`✅ 订单 ${trade_order_id} 支付成功！金额: ¥${total_fee}`);

    // 生成授权码
    const licenseCodes = orderInfo.plugins.map(p => generateLicenseCode(p, orderInfo.plan));

    // 发送邮件
    await sendLicenseEmail(orderInfo.email, orderInfo, licenseCodes);
    await sendAdminEmail(orderInfo, licenseCodes);

    console.log(`📧 授权码已发送: ${licenseCodes.join(', ')}`);

    // 虎皮椒要求：返回纯文本 "success"
    res.status(200).send('success');

  } catch (err) {
    console.error('回调处理异常:', err);
    res.status(200).send('fail');
  }
});

/**
 * GET /xunhupay/callback
 * 兼容 GET 方式的同步回调（用户支付后从浏览器跳转回来）
 */
app.get('/xunhupay/callback', (req, res) => {
  const { trade_order_id } = req.query;
  if (trade_order_id) {
    const order = paidOrders.get(trade_order_id) || pendingOrders.get(trade_order_id);
    if (order && order.status === 'paid') {
      return res.redirect('/success.html?order=' + trade_order_id);
    }
  }
  res.redirect('/');
});

/**
 * GET /api/order/:orderNo
 * 查询订单状态（供前端轮询）
 */
app.get('/api/order/:orderNo', (req, res) => {
  const { orderNo } = req.params;
  const order = paidOrders.get(orderNo) || pendingOrders.get(orderNo);
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  res.json({ success: true, order });
});

/**
 * GET /api/health
 * 健康检查（Railway 部署需要）
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ============ 启动 ============
const server = app.listen(PORT, () => {
  const emailMode = process.env.RESEND_API_KEY
    ? '✅ Resend（推荐）'
    : (process.env.SMTP_USER ? '✅ Gmail SMTP（备用）' : '⚠️  未配置（控制台输出）');
  console.log(`
╔══════════════════════════════════════════════════╗
║   AutoPhoto 后端服务已启动                        ║
║   http://localhost:${PORT}                            ║
╠══════════════════════════════════════════════════╣
║   虎皮椒: ${process.env.XUNHU_APP_ID ? '✅ 已配置' : '⚠️  未配置（演示模式）'}
║   邮件:  ${emailMode}
║   管理通知: ${process.env.ADMIN_EMAIL ? '✅ ' + process.env.ADMIN_EMAIL : '⚠️  未配置'}
╚══════════════════════════════════════════════════╝
  `);
});

// Railway 优雅关闭
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
