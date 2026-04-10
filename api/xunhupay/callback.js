/**
 * POST /api/xunhupay/callback
 * Edge Function：处理虎皮椒支付回调
 *
 * 定价/插件配置 → ../_lib/pricing-config.js
 */
import { PLAN_LABELS, PLUGIN_NAMES, PLUGIN_PREFIXES, PLAN_CHARS, calcExpiry, getCodeLabel } from '../_lib/pricing-config.js';

// 覆盖 randomHex 使用 Edge Runtime 的 crypto（Web Crypto API）
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

// 解析 form-urlencoded
function parseFormData(bodyStr) {
  const params = {};
  if (!bodyStr) return params;
  try {
    for (const [k, v] of new URLSearchParams(bodyStr)) params[k] = v;
  } catch (e) {}
  return params;
}

// MD5（Edge Runtime 纯 JS 实现）
function md5(str) {
  function rstr(s) {
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function u2h(n) {
    const h = '0123456789abcdef';
    let s = '';
    for (let i = 0; i < n.length * 4; i++)
      s += h.charAt((n[i >> 2] >> ((i % 4) * 8 + 4)) & 15) + h.charAt((n[i >> 2] >> ((i % 4) * 8)) & 15);
    return s;
  }
  function cy(x, y) { return (x << y) | (x >>> (32 - y)); }
  function ff(a, b, c, d, x, s, t) { return (a + ((b & c) | ((~b) & d)) + d + x + t) >>> 0; }
  function gg(a, b, c, d, x, s, t) { return (a + ((b & d) | (c & (~d))) + d + x + t) >>> 0; }
  function hh(a, b, c, d, x, s, t) { return (a + (b ^ c ^ d) + d + x + t) >>> 0; }
  function ii(a, b, c, d, x, s, t) { return (a + (c ^ (b | (~d))) + d + x + t) >>> 0; }
  function md5bl(x, len) {
    x[len >> 5] |= 128 << (len % 32);
    x[((len + 64) >>> 9 << 4) + 14] = len;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const [oa, ob, oc, od] = [a, b, c, d];
      a = ff(a,b,c,d,x[i],7,-680876936); d = ff(d,a,b,c,x[i+1],12,-389564586);
      c = ff(c,d,a,b,x[i+2],17,606105819); b = ff(b,c,d,a,x[i+3],22,-1044525330);
      a = ff(a,b,c,d,x[i+4],7,-176418897); d = ff(d,a,b,c,x[i+5],12,1200080426);
      c = ff(c,d,a,b,x[i+6],17,-1473231341); b = ff(b,c,d,a,x[i+7],22,-45705983);
      a = ff(a,b,c,d,x[i+8],7,1770035416); d = ff(d,a,b,c,x[i+9],12,-1958414417);
      c = ff(c,d,a,b,x[i+10],17,-42063); b = ff(b,c,d,a,x[i+11],22,-1990404162);
      a = ff(a,b,c,d,x[i+12],7,1804603682); d = ff(d,a,b,c,x[i+13],12,-40341101);
      c = ff(c,d,a,b,x[i+14],17,-1502002290); b = ff(b,c,d,a,x[i+15],22,1236535329);
      a = gg(a,b,c,d,x[i+1],5,-165796510); d = gg(d,a,b,c,x[i+6],9,-1069501632);
      c = gg(c,d,a,b,x[i+11],14,643717713); b = gg(b,c,d,a,x[i],20,-373897302);
      a = gg(a,b,c,d,x[i+5],5,-701558691); d = gg(d,a,b,c,x[i+10],9,38016083);
      c = gg(c,d,a,b,x[i+15],14,-660478335); b = gg(b,c,d,a,x[i+4],20,-405537848);
      a = gg(a,b,c,d,x[i+9],5,568446438); d = gg(d,a,b,c,x[i+14],9,-1019803690);
      c = gg(c,d,a,b,x[i+3],14,-187363961); b = gg(b,c,d,a,x[i+8],20,1163531501);
      a = gg(a,b,c,d,x[i+13],5,-1444681467); d = gg(d,a,b,c,x[i+2],9,-51403784);
      c = gg(c,d,a,b,x[i+7],14,1735328473); b = gg(b,c,d,a,x[i+12],20,-1926607734);
      a = hh(a,b,c,d,x[i+5],4,-378558); d = hh(d,a,b,c,x[i+8],11,-2022574463);
      c = hh(c,d,a,b,x[i+11],16,1839030562); b = hh(b,c,d,a,x[i+14],23,-35309556);
      a = hh(a,b,c,d,x[i+1],4,-1530992060); d = hh(d,a,b,c,x[i+4],11,1272893353);
      c = hh(c,d,a,b,x[i+7],16,-155497632); b = hh(b,c,d,a,x[i+10],23,-1094730640);
      a = hh(a,b,c,d,x[i+13],4,681279174); d = hh(d,a,b,c,x[i],11,-358537222);
      c = hh(c,d,a,b,x[i+3],16,-722521979); b = hh(b,c,d,a,x[i+6],23,76029189);
      a = hh(a,b,c,d,x[i+9],4,-640364487); d = hh(d,a,b,c,x[i+12],11,-421815835);
      c = hh(c,d,a,b,x[i+15],16,530742520); b = hh(b,c,d,a,x[i+2],23,-995338651);
      a = ii(a,b,c,d,x[i],6,-198630844); d = ii(d,a,b,c,x[i+7],10,1126891415);
      c = ii(c,d,a,b,x[i+14],15,-1416354905); b = ii(b,c,d,a,x[i+5],21,-57434055);
      a = ii(a,b,c,d,x[i+12],6,1700485571); d = ii(d,a,b,c,x[i+3],10,-1894986606);
      c = ii(c,d,a,b,x[i+10],15,-1051523); b = ii(b,c,d,a,x[i+1],21,-2054922799);
      a = ii(a,b,c,d,x[i+8],6,1873313359); d = ii(d,a,b,c,x[i+15],10,-30611744);
      c = ii(c,d,a,b,x[i+6],15,-1560198380); b = ii(b,c,d,a,x[i+13],21,1309151649);
      a = ii(a,b,c,d,x[i+4],6,-145523070); d = ii(d,a,b,c,x[i+11],10,-1120210379);
      c = ii(c,d,a,b,x[i+2],15,718787259); b = ii(b,c,d,a,x[i+9],21,-343485551);
      a = (a + oa) >>> 0; b = (b + ob) >>> 0; c = (c + oc) >>> 0; d = (d + od) >>> 0;
    }
    return [a, b, c, d];
  }
  const bytes = rstr(str);
  return u2h(md5bl(bytes, str.length * 8));
}

// 签名验证
function verifyXunhuSign(params, secret) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== 'hash' && (v === 0 || v === '0' || v))
    .sort(([a], [b]) => a.localeCompare(b));
  const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + secret;
  return md5(str) === params.hash;
}

// 发送邮件（调用 Node.js Serverless /process 接口）
async function sendEmails(orderInfo, licenseCodes) {
  try {
    const resp = await fetch('https://autophoto-store.vercel.app/api/xunhupay/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...orderInfo, licenseCodes })
    });
    const result = await resp.json();
    console.log('📧 邮件发送结果:', JSON.stringify(result));
    return result;
  } catch (e) {
    console.error('❌ 转发失败:', e.message);
    return { success: false, error: e.message };
  }
}

export default async function handler(req) {
  const url = new URL(req.url);

  // GET：浏览器跳转回来（用户取消支付）
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
  try { bodyStr = await req.text(); } catch (e) {
    console.error('读取 body 失败:', e.message);
  }

  console.log('📡 Edge收到原始body:', bodyStr);
  const params = parseFormData(bodyStr);
  const { trade_order_id, status, total_fee, attach } = params;

  console.log(`📋 订单: ${trade_order_id}, 状态: ${status}, 金额: ¥${total_fee}`);

  // 非成功状态直接返回
  if (status !== 'OD') {
    return new Response('success', { status: 200 });
  }

  // 解析订单信息
  let orderInfo = {};
  try {
    if (attach) orderInfo = JSON.parse(attach);
  } catch (e) {
    console.error('❌ attach 解析失败:', e.message);
  }

  const plugins = typeof orderInfo.plugins === 'string'
    ? orderInfo.plugins.split(',').filter(Boolean)
    : (orderInfo.plugins || []);
  const plan = orderInfo.plan || 'annual';
  const planName = PLAN_LABELS[plan] || plan;

  // 生成授权码（带插件标注）
  const rawCodes = plugins.map(p => makeLicenseCode(p, plan));
  const labeledCodes = rawCodes.map(c => `${getCodeLabel(c, plugins)} ${c}`);
  console.log(`✅ 订单 ${trade_order_id} 支付成功!`);
  console.log(`   授权码: ${labeledCodes.join(' | ')}`);

  // 构造传给 process.js 的完整信息
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

  // 触发邮件发送
  await sendEmails(fullOrderInfo, rawCodes);

  return new Response('success', { status: 200 });
}
