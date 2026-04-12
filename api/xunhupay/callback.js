/**
 * POST /api/xunhupay/callback
 * Edge Function：处理虎皮椒支付回调
 *
 * 所有逻辑内联，不依赖外部模块（避免 Edge Runtime + CommonJS 兼容性问题）
 * 定价配置 → ../_lib/pricing-config.js
 */

// ============================================================
// 内联配置（与 pricing-config.js 保持同步）
// ============================================================
const PLAN_LABELS = {
  testpay: '¥0.01 测试',
  trial: '1天试用',
  annual: '年度授权',
  permanent: '永久授权'
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
  shijuezhongguo: 'VCG',
  guangchang: 'VJ',
  xinchangchang: 'XC',
  dreamstime: 'DT',
  'adobe-stock': 'AS',
  'qingying-image': 'QY',
  'qingying-video': 'QV'
};

const PLAN_CHARS = {
  testpay: 'T',
  trial: 'T',
  annual: 'Y',
  permanent: 'P'
};

// 计算到期时间戳（Unix秒）
function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  switch (plan) {
    case 'testpay':
    case 'trial':     return now + 1 * DAY;
    case 'annual':    return now + 365 * DAY;
    case 'permanent': return now + 99 * 365 * DAY;
    default:          return now + 1 * DAY;
  }
}

// 从授权码还原插件名标注
function getCodeLabel(code, plugins) {
  if (!code || !plugins || plugins.length === 0) return '[未知插件]';
  const codePrefix = code.split('-')[1];
  for (const [pid, prefix] of Object.entries(PLUGIN_PREFIXES)) {
    if (prefix === codePrefix) return `[${PLUGIN_NAMES[pid] || pid}]`;
  }
  return `[${plugins[0] ? (PLUGIN_NAMES[plugins[0]] || plugins[0]) : '未知'}]`;
}

// Edge Runtime 随机hex（Web Crypto API）
function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// 生成授权码
function makeLicenseCode(pluginId, plan) {
  const prefix = PLUGIN_PREFIXES[pluginId] || 'XX';
  const planChar = PLAN_CHARS[plan] || 'X';
  const expiryB36 = calcExpiry(plan).toString(36).toUpperCase();
  const rand = randomHex(6);
  return `AP-${prefix}-${planChar}${expiryB36}-${rand}`;
}

// ============================================================
// MD5（纯 JS 实现，兼容 Edge Runtime）
// ============================================================
function md5(str) {
  function rstr(buffer) {
    const output = [];
    for (let i = 0; i < buffer.length; i++) {
      output[i >> 2] |= (buffer[i] & 0xff) << ((i % 4) * 8);
    }
    return output;
  }
  function u2h(buffer) {
    const hexTab = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < buffer.length * 4; i++) {
      result += hexTab.charAt((buffer[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) +
                hexTab.charAt((buffer[i >> 2] >> ((i % 4) * 8)) & 0xf);
    }
    return result;
  }
  function rol(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function ff(a, b, c, d, x, s, t) { return (a + ((b & c) | ((~b) & d)) + x + t) >>> 0; }
  function gg(a, b, c, d, x, s, t) { return (a + ((b & d) | (c & (~d))) + x + t) >>> 0; }
  function hh(a, b, c, d, x, s, t) { return (a + (b ^ c ^ d) + x + t) >>> 0; }
  function ii(a, b, c, d, x, s, t) { return (a + (c ^ (b | (~d))) + x + t) >>> 0; }

  const buffer = rstr(new TextEncoder().encode(str));
  buffer[str.length >> 5] |= 0x80 << ((str.length % 4) * 8);
  buffer[(((str.length + 64) >>> 9) << 4) + 14] = str.length * 8;

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  for (let i = 0; i < buffer.length; i += 16) {
    const [oa, ob, oc, od] = [a, b, c, d];
    a = ff(a,b,c,d,buffer[i],7,0xd76aa478); d = ff(d,a,b,c,buffer[i+1],12,0xe8c7b756);
    c = ff(c,d,a,b,buffer[i+2],17,0x242070db); b = ff(b,c,d,a,buffer[i+3],22,0xf57c0faf);
    a = ff(a,b,c,d,buffer[i+4],7,0x4787c62a); d = ff(d,a,b,c,buffer[i+5],12,0xa8304613);
    c = ff(c,d,a,b,buffer[i+6],17,0xfd469501); b = ff(b,c,d,a,buffer[i+7],22,0x698098d8);
    a = ff(a,b,c,d,buffer[i+8],7,0x8b44f7af); d = ff(d,a,b,c,buffer[i+9],12,0xffff5bb1);
    c = ff(c,d,a,b,buffer[i+10],17,0x895cd7be); b = ff(b,c,d,a,buffer[i+11],22,0x6b901122);
    a = ff(a,b,c,d,buffer[i+12],7,0xfd987193); d = ff(d,a,b,c,buffer[i+13],12,0xa679438e);
    c = ff(c,d,a,b,buffer[i+14],17,0x49b40821); b = ff(b,c,d,a,buffer[i+15],22,0xf61e2562);
    a = gg(a,b,c,d,buffer[i+1],5,0xc040b340); d = gg(d,a,b,c,buffer[i+6],9,0x265e5a51);
    c = gg(c,d,a,b,buffer[i+11],14,0xe9b6c7aa); b = gg(b,c,d,a,buffer[i],20,0xd62f105d);
    a = gg(a,b,c,d,buffer[i+5],5,0x2441453); d = gg(d,a,b,c,buffer[i+10],9,0xd8a1e681);
    c = gg(c,d,a,b,buffer[i+15],14,0xe7d3fbc8); b = gg(b,c,d,a,buffer[i+4],20,0x21e1cde6);
    a = gg(a,b,c,d,buffer[i+9],5,0xc33707d6); d = gg(d,a,b,c,buffer[i+14],9,0xf4d50d87);
    c = gg(c,d,a,b,buffer[i+3],14,0x455a14ed); b = gg(b,c,d,a,buffer[i+8],20,0xa9e3e905);
    a = gg(a,b,c,d,buffer[i+13],5,0xfcefa3f8); d = gg(d,a,b,c,buffer[i+2],9,0x676f02d9);
    c = gg(c,d,a,b,buffer[i+7],14,0x8d2a4c8a); b = gg(b,c,d,a,buffer[i+12],20,0xfffa3942);
    a = hh(a,b,c,d,buffer[i+5],4,0x8771f681); d = hh(d,a,b,c,buffer[i+8],11,0x6d9d6122);
    c = hh(c,d,a,b,buffer[i+11],16,0xfde5380c); b = hh(b,c,d,a,buffer[i+14],23,0xa4beea44);
    a = hh(a,b,c,d,buffer[i+1],4,0x4bdecfa9); d = hh(d,a,b,c,buffer[i+4],11,0xf6bb4b60);
    c = hh(c,d,a,b,buffer[i+7],16,0xbebfbc70); b = hh(b,c,d,a,buffer[i+10],23,0x289b7ec6);
    a = hh(a,b,c,d,buffer[i+13],4,0xeaa127fa); d = hh(d,a,b,c,buffer[i],11,0xd4ef3085);
    c = hh(c,d,a,b,buffer[i+3],16,0x4881d05); b = hh(b,c,d,a,buffer[i+6],23,0xd9d4d039);
    a = hh(a,b,c,d,buffer[i+9],4,0xe6db99e5); d = hh(d,a,b,c,buffer[i+15],11,0x1fa27cf8);
    c = hh(c,d,a,b,buffer[i+2],16,0xc4ac5665); b = hh(b,c,d,a,buffer[i+5],23,0xf4292244);
    a = ii(a,b,c,d,buffer[i],6,0x432aff97); d = ii(d,a,b,c,buffer[i+7],10,0xab9423a7);
    c = ii(c,d,a,b,buffer[i+14],15,0xfc93a039); b = ii(b,c,d,a,buffer[i+5],21,0x655b59c3);
    a = ii(a,b,c,d,buffer[i+12],6,0x8f0ccc92); d = ii(d,a,b,c,buffer[i+3],10,0xffeff47d);
    c = ii(c,d,a,b,buffer[i+10],15,0x85845dd1); b = ii(b,c,d,a,buffer[i+1],21,0x6fa87e4f);
    a = ii(a,b,c,d,buffer[i+8],6,0xfe2ce6e0); d = ii(d,a,b,c,buffer[i+15],10,0xa3014314);
    c = ii(c,d,a,b,buffer[i+6],15,0x4e0811a1); b = ii(b,c,d,a,buffer[i+13],21,0xf7537e82);
    a = ii(a,b,c,d,buffer[i+4],6,0xbd3af235); d = ii(d,a,b,c,buffer[i+11],10,0x2ad7d2bb);
    c = ii(c,d,a,b,buffer[i+2],15,0xeb86d391); b = ii(b,c,d,a,buffer[i+9],21,0x289b7ec6);
    a = (a + oa) >>> 0; b = (b + ob) >>> 0;
    c = (c + oc) >>> 0; d = (d + od) >>> 0;
  }
  return u2h([a, b, c, d]);
}

// 签名验证
function verifyXunhuSign(params, secret) {
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

// 解析 form-urlencoded
function parseFormData(bodyStr) {
  const params = {};
  if (!bodyStr) return params;
  try {
    for (const [k, v] of new URLSearchParams(bodyStr)) params[k] = v;
  } catch (e) {
    console.error('FormData解析异常:', e.message);
  }
  return params;
}

// 发送邮件（调用 Node.js Serverless /process 接口）
async function sendEmails(orderInfo, licenseCodes) {
  try {
    const resp = await fetch('https://autophoto-store.vercel.app/api/xunhupay/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orderInfo, licenseCodes })
    });
    if (!resp.ok) {
      console.error('邮件接口HTTP错误:', resp.status);
      return false;
    }
    const result = await resp.json();
    console.log('📧 邮件发送结果:', JSON.stringify(result));
    return true;
  } catch (e) {
    console.error('❌ 转发失败:', e.message);
    return false;
  }
}

// ============================================================
// 主处理函数
// ============================================================
export default async function handler(req) {
  const url = new URL(req.url);

  // GET：浏览器跳转回来（用户取消或支付完成）
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

  console.log('📡 Edge收到原始body:', bodyStr);
  const params = parseFormData(bodyStr);
  const { trade_order_id, status, total_fee, attach, hash } = params;

  console.log(`📋 订单: ${trade_order_id}, 状态: ${status}, 金额: ¥${total_fee}`);

  // 签名验证（如果配置了密钥）
  const appSecret = process.env.XUNHU_APP_SECRET;
  if (appSecret && hash) {
    const valid = verifyXunhuSign(params, appSecret);
    console.log(`🔐 签名验证: ${valid ? '✅ 通过' : '❌ 失败'}`);
    if (!valid) {
      console.warn('签名不匹配，参数:', params);
    }
  }

  // 非成功状态直接返回
  if (status !== 'OD') {
    console.log('非支付成功状态，跳过处理');
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
  const rawCodes = plugins.map(p => makeLicenseCode(p, plan));
  const labeledCodes = rawCodes.map(c => `${getCodeLabel(c, plugins)} ${c}`);
  console.log(`✅ 订单 ${trade_order_id} 支付成功!`);
  console.log(`   授权码: ${labeledCodes.join(' | ')}`);

  // 构造完整信息
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

  // 触发邮件发送（非阻塞）
  await sendEmails(fullOrderInfo, rawCodes);

  // 返回 success 给虎皮椒（重要！否则会重复回调）
  return new Response('success', { status: 200 });
}
