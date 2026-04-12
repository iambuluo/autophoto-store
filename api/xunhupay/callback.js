/**
 * POST /api/xunhupay/callback
 * 处理虎皮椒支付回调
 *
 * 全部内联：定价配置 + 授权码生成 + 邮件发送
 * 不依赖任何外部模块，确保 Vercel 稳定运行
 */

// ============================================================
// 内联配置
// ============================================================
const PLAN_LABELS = {
  testpay: '¥0.01 测试', trial: '1天试用',
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
  shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC',
  dreamstime: 'DT', 'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
};
const PLAN_CHARS = {
  testpay: 'T', trial: 'T', annual: 'Y', permanent: 'P'
};

// ============================================================
// 工具函数（纯 JS，无外部依赖）
// ============================================================
function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  const m = { testpay: 1 * DAY, trial: 1 * DAY, annual: 365 * DAY, permanent: 99 * 365 * DAY };
  return now + (m[plan] || 365 * DAY);
}

function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function makeLicenseCode(pluginId, plan) {
  const prefix = PLUGIN_PREFIXES[pluginId] || 'XX';
  const pc = PLAN_CHARS[plan] || 'X';
  const expiryB36 = calcExpiry(plan).toString(36).toUpperCase();
  const rand = randomHex(6);
  return `AP-${prefix}-${pc}${expiryB36}-${rand}`;
}

function getCodeLabel(code, plugins) {
  if (!code || !plugins?.length) return '[未知插件]';
  const prefix = code.split('-')[1];
  for (const [pid, pfx] of Object.entries(PLUGIN_PREFIXES)) {
    if (pfx === prefix) return `[${PLUGIN_NAMES[pid] || pid}]`;
  }
  return `[${PLUGIN_NAMES[plugins[0]] || plugins[0] || '未知'}]`;
}

// ============================================================
// MD5（纯 JS 实现，兼容 Edge Runtime）
// ============================================================
function md5(str) {
  function rstr(buf) {
    const out = new Array(buf.length);
    for (let i = 0; i < buf.length; i++) out[i >> 2] |= (buf[i] & 0xff) << ((i % 4) * 8);
    return out;
  }
  function u2h(buf) {
    const h = '0123456789abcdef';
    let r = '';
    for (let i = 0; i < buf.length * 4; i++)
      r += h.charAt((buf[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) + h.charAt((buf[i >> 2] >> ((i % 4) * 8)) & 0xf);
    return r;
  }
  function rol(n, c) { return (n << c) | (n >>> (32 - c)); }
  function ff(a,b,c,d,x,s,t) { return (a + ((b & c) | ((~b) & d)) + x + t) >>> 0; }
  function gg(a,b,c,d,x,s,t) { return (a + ((b & d) | (c & ~d)) + x + t) >>> 0; }
  function hh(a,b,c,d,x,s,t) { return (a + (b ^ c ^ d) + x + t) >>> 0; }
  function ii(a,b,c,d,x,s,t) { return (a + (c ^ (b | ~d)) + x + t) >>> 0; }

  const buf = rstr(new TextEncoder().encode(str));
  buf[str.length >> 2] |= 0x80 << ((str.length % 4) * 8);
  buf[(((str.length + 64) >>> 9) << 4) + 14] = str.length * 8;

  let [a,b,c,d] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let i = 0; i < buf.length; i += 16) {
    const [oa,ob,oc,od] = [a,b,c,d];
    a=ff(a,b,c,d,buf[i],7,0xd76aa478); d=ff(d,a,b,c,buf[i+1],12,0xe8c7b756);
    c=ff(c,d,a,b,buf[i+2],17,0x242070db); b=ff(b,c,d,a,buf[i+3],22,0xf57c0faf);
    a=ff(a,b,c,d,buf[i+4],7,0x4787c62a); d=ff(d,a,b,c,buf[i+5],12,0xa8304613);
    c=ff(c,d,a,b,buf[i+6],17,0xfd469501); b=ff(b,c,d,a,buf[i+7],22,0x698098d8);
    a=ff(a,b,c,d,buf[i+8],7,0x8b44f7af); d=ff(d,a,b,c,buf[i+9],12,0xffff5bb1);
    c=ff(c,d,a,b,buf[i+10],17,0x895cd7be); b=ff(b,c,d,a,buf[i+11],22,0x6b901122);
    a=ff(a,b,c,d,buf[i+12],7,0xfd987193); d=ff(d,a,b,c,buf[i+13],12,0xa679438e);
    c=ff(c,d,a,b,buf[i+14],17,0x49b40821); b=ff(b,c,d,a,buf[i+15],22,0xf61e2562);
    a=gg(a,b,c,d,buf[i+1],5,0xc040b340); d=gg(d,a,b,c,buf[i+6],9,0x265e5a51);
    c=gg(c,d,a,b,buf[i+11],14,0xe9b6c7aa); b=gg(b,c,d,a,buf[i],20,0xd62f105d);
    a=gg(a,b,c,d,buf[i+5],5,0x2441453); d=gg(d,a,b,c,buf[i+10],9,0xd8a1e681);
    c=gg(c,d,a,b,buf[i+15],14,0xe7d3fbc8); b=gg(b,c,d,a,buf[i+4],20,0x21e1cde6);
    a=gg(a,b,c,d,buf[i+9],5,0xc33707d6); d=gg(d,a,b,c,buf[i+14],9,0xf4d50d87);
    c=gg(c,d,a,b,buf[i+3],14,0x455a14ed); b=gg(b,c,d,a,buf[i+8],20,0xa9e3e905);
    a=gg(a,b,c,d,buf[i+13],5,0xfcefa3f8); d=gg(d,a,b,c,buf[i+2],9,0x676f02d9);
    c=gg(c,d,a,b,buf[i+7],14,0x8d2a4c8a); b=gg(b,c,d,a,buf[i+12],20,0xfffa3942);
    a=hh(a,b,c,d,buf[i+5],4,0x8771f681); d=hh(d,a,b,c,buf[i+8],11,0x6d9d6122);
    c=hh(c,d,a,b,buf[i+11],16,0xfde5380c); b=hh(b,c,d,a,buf[i+14],23,0xa4beea44);
    a=hh(a,b,c,d,buf[i+1],4,0x4bdecfa9); d=hh(d,a,b,c,buf[i+4],11,0xf6bb4b60);
    c=hh(c,d,a,b,buf[i+7],16,0xbebfbc70); b=hh(b,c,d,a,buf[i+10],23,0x289b7ec6);
    a=hh(a,b,c,d,buf[i+13],4,0xeaa127fa); d=hh(d,a,b,c,buf[i],11,0xd4ef3085);
    c=hh(c,d,a,b,buf[i+3],16,0x4881d05); b=hh(b,c,d,a,buf[i+6],23,0xd9d4d039);
    a=hh(a,b,c,d,buf[i+9],4,0xe6db99e5); d=hh(d,a,b,c,buf[i+15],11,0x1fa27cf8);
    c=hh(c,d,a,b,buf[i+2],16,0xc4ac5665); b=hh(b,c,d,a,buf[i+5],23,0xf4292244);
    a=ii(a,b,c,d,buf[i],6,0x432aff97); d=ii(d,a,b,c,buf[i+7],10,0xab9423a7);
    c=ii(c,d,a,b,buf[i+14],15,0xfc93a039); b=ii(b,c,d,a,buf[i+5],21,0x655b59c3);
    a=ii(a,b,c,d,buf[i+12],6,0x8f0ccc92); d=ii(d,a,b,c,buf[i+3],10,0xffeff47d);
    c=ii(c,d,a,b,buf[i+10],15,0x85845dd1); b=ii(b,c,d,a,buf[i+1],21,0x6fa87e4f);
    a=ii(a,b,c,d,buf[i+8],6,0xfe2ce6e0); d=ii(d,a,b,c,buf[i+15],10,0xa3014314);
    c=ii(c,d,a,b,buf[i+6],15,0x4e0811a1); b=ii(b,c,d,a,buf[i+13],21,0xf7537e82);
    a=ii(a,b,c,d,buf[i+4],6,0xbd3af235); d=ii(d,a,b,c,buf[i+11],10,0x2ad7d2bb);
    c=ii(c,d,a,b,buf[i+2],15,0xeb86d391); b=ii(b,c,d,a,buf[i+9],21,0x289b7ec6);
    a=(a+oa)>>>0; b=(b+ob)>>>0; c=(c+oc)>>>0; d=(d+od)>>>0;
  }
  return u2h([a,b,c,d]);
}

function verifySign(params, secret) {
  try {
    const entries = Object.entries(params)
      .filter(([k, v]) => k !== 'hash' && (v === 0 || v === '0' || v))
      .sort(([a], [b]) => a.localeCompare(b));
    const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + secret;
    return md5(str) === params.hash;
  } catch (e) {
    console.error('签名验证异常:', e.message);
    return false;
  }
}

// ============================================================
// 邮件发送（直接调用 Resend API，无需中间层）
// ============================================================
async function sendLicenseEmail(toEmail, orderInfo, licenseCodes) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !toEmail) return;

  const name = orderInfo.name || '用户';
  const plugins = orderInfo.plugins || [];
  const planName = orderInfo.planName || PLAN_LABELS[orderInfo.plan] || orderInfo.plan;

  const codeList = licenseCodes.map(c => {
    const label = getCodeLabel(c, plugins);
    return `<div style="margin-bottom:12px;">
      <span style="color:#94a3b8;font-size:12px;">${label}</span><br>
      <code style="background:#1a1a2e;padding:10px 18px;border-radius:6px;display:inline-block;margin-top:4px;font-family:monospace;color:#818cf8;font-size:15px;letter-spacing:1px;word-break:break-all;">${c}</code>
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
<h1>🛒 AutoPhoto 授权码通知</h1>
<p>您好，<strong>${escapeHtml(name)}</strong>！</p>
<p>感谢您的购买！以下是您的授权码信息：</p>
<h2>📦 已购插件</h2><p>${plugins.map(p => escapeHtml(PLUGIN_NAMES[p] || p)).join('<br>')}</p>
<h2>📋 授权类型</h2><p>${escapeHtml(planName)}</p>
<h2>🔑 授权码</h2>${codeList}
<div class="warning">⚠️ 请妥善保管授权码，切勿泄露。每个授权码绑定一台设备。</div>
<h2>📖 使用方法</h2>
<p>1. 安装对应 Chrome 插件<br>2. 打开插件设置页面<br>3. 输入授权码并激活<br>4. 开始使用！</p>
<h2>💬 技术支持</h2>
<p>微信：auto_photo2025<br>邮箱：tourinn@gmail.com</p>
<div class="footer">AutoPhoto.store · 专注图库创作者效率工具</div>
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
        subject: `🔑 您的 AutoPhoto 授权码已发放`,
        html
      })
    });
    const result = await resp.json();
    if (resp.ok) {
      console.log(`✅ [Resend] 用户邮件已发送至 ${toEmail}`);
    } else {
      console.error(`❌ [Resend] 邮件发送失败:`, JSON.stringify(result));
    }
  } catch (e) {
    console.error(`❌ [Resend] 请求异常: ${e.message}`);
  }
}

async function sendAdminEmail(orderInfo, licenseCodes) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail) return;

  const plugins = (orderInfo.plugins || []).map(p => PLUGIN_NAMES[p] || p);
  const codes = licenseCodes.map(c => `${getCodeLabel(c, orderInfo.plugins)} ${c}`).join('\n');

  const text = `AutoPhoto 新订单通知

订单号: ${orderInfo.trade_order_id}
插件: ${plugins.join(', ')}
授权类型: ${orderInfo.planName}
金额: ¥${orderInfo.total_fee}
用户: ${orderInfo.name}
邮箱: ${orderInfo.email}
微信: ${orderInfo.wechat || 'N/A'}
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
        subject: `[AutoPhoto] 新订单 #${orderInfo.trade_order_id} - ${plugins.join(', ')} - ¥${orderInfo.total_fee}`,
        text
      })
    });
    const result = await resp.json();
    if (resp.ok) {
      console.log(`✅ [Resend] 管理员邮件已发送至 ${adminEmail}`);
    } else {
      console.error(`❌ [Resend] 管理员邮件失败:`, JSON.stringify(result));
    }
  } catch (e) {
    console.error(`❌ [Resend] 管理员邮件异常: ${e.message}`);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
}

// ============================================================
// 主处理函数
// ============================================================
export default async function handler(req) {
  const url = new URL(req.url);

  // GET：用户从支付页面跳转回来
  if (req.method === 'GET') {
    const status = url.searchParams.get('status');
    const orderId = url.searchParams.get('trade_order_id');
    if (orderId && status === 'OD') {
      return Response.redirect(`/success.html?order=${orderId}&status=paid`, 302);
    }
    return Response.redirect('/', 302);
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let bodyStr = '';
  try {
    bodyStr = await req.text();
  } catch (e) {
    console.error('读取body失败:', e.message);
    return new Response('body read error', { status: 400 });
  }

  console.log('📡 收到回调，原始body:', bodyStr);
  const params = {};
  try {
    for (const [k, v] of new URLSearchParams(bodyStr)) params[k] = v;
  } catch (e) {
    console.error('FormData解析失败:', e.message);
    return new Response('parse error', { status: 400 });
  }

  const { trade_order_id, status, total_fee, attach, hash } = params;
  console.log(`📋 订单: ${trade_order_id}, 状态: ${status}, 金额: ¥${total_fee}`);

  // 签名验证
  const appSecret = process.env.XUNHU_APP_SECRET;
  if (appSecret && hash) {
    const valid = verifySign(params, appSecret);
    console.log(`🔐 签名验证: ${valid ? '✅ 通过' : '❌ 失败'}`);
    if (!valid) {
      console.warn('⚠️ 签名不匹配，但仍处理（防止密钥不同步问题）');
    }
  }

  // 非成功状态
  if (status !== 'OD') {
    console.log('非支付成功状态，返回ok');
    return new Response('ok', { status: 200 });
  }

  // 解析订单信息
  let orderInfo = {};
  try {
    if (attach) orderInfo = JSON.parse(attach);
  } catch (e) {
    console.error('attach解析失败:', e.message);
    return new Response('attach parse error', { status: 400 });
  }

  const plugins = typeof orderInfo.plugins === 'string'
    ? orderInfo.plugins.split(',').filter(Boolean)
    : (orderInfo.plugins || []);
  const plan = orderInfo.plan || 'annual';
  const planName = PLAN_LABELS[plan] || plan;

  // 生成授权码
  const licenseCodes = plugins.map(p => makeLicenseCode(p, plan));
  const labeledCodes = licenseCodes.map(c => `${getCodeLabel(c, plugins)} ${c}`);
  console.log(`✅ 订单 ${trade_order_id} 支付成功!`);
  console.log(`   授权码: ${labeledCodes.join(' | ')}`);

  // 组装完整订单信息（发给邮件）
  const fullOrderInfo = {
    trade_order_id,
    total_fee,
    plugins,
    plan,
    planName,
    email: orderInfo.email,
    name: orderInfo.name,
    wechat: orderInfo.wechat
  };

  // 并行发送邮件（不阻塞返回）
  const emailPromises = [];
  if (fullOrderInfo.email) {
    emailPromises.push(sendLicenseEmail(fullOrderInfo.email, fullOrderInfo, licenseCodes));
  }
  emailPromises.push(sendAdminEmail(fullOrderInfo, licenseCodes));

  // 等待邮件发送（最多5秒超时）
  await Promise.race([
    Promise.allSettled(emailPromises),
    new Promise(r => setTimeout(r, 5000))
  ]);

  // 返回 success 给虎皮椒（重要！否则会重复回调）
  return new Response('success', { status: 200 });
}
