/**
 * POST /api/xunhupay/callback
 * Edge Function：直接读取原始请求 body，处理 form-urlencoded 格式
 * GET  /api/xunhupay/callback  兼容浏览器跳转回来
 */
export const config = { runtime: 'edge' };

const PLAN_LABELS = { test001: '调试测试', trial: '1天试用', annual: '年度授权', permanent: '永久授权' };
const PLUGIN_NAMES = {
  shijuezhongguo: '视觉中国自动提交',
  guangchang: '光厂批量提交助手',
  xinchangchang: '新片场 AIGC 助手',
  dreamstime: 'Dreamstime 自动提交',
  'adobe-stock': 'Adobe Stock 关键词点击器',
  'qingying-image': '清影批量生图助手',
  'qingying-video': '清影批量生视频助手'
};

// 解析 form-urlencoded 字符串
function parseFormData(bodyStr) {
  const params = {};
  if (!bodyStr) return params;
  try {
    const sp = new URLSearchParams(bodyStr);
    for (const [k, v] of sp.entries()) params[k] = v;
  } catch (e) {}
  return params;
}

// MD5 计算（纯 JS 实现，兼容 Edge Runtime）
function md5(str) {
  function rstr(s) {
    const b = [];
    for (let i = 0; i < s.length * 8; i += 8) b[i >> 5] |= (s.charCodeAt(i / 8) & 255) << (i % 32);
    return b;
  }
  function u2h(n) {
    const h = '0123456789abcdef';
    let s = '';
    for (let i = 0; i < n.length * 4; i++) s += h.charAt((n[i >> 2] >> ((i % 4) * 8 + 4)) & 15) + h.charAt((n[i >> 2] >> ((i % 4) * 8)) & 15);
    return s;
  }
  function c_r(x, y) { return (x & y) | (~x & z); }
  function c_n(x, y) { return (x & y) | (y & ~x); }
  function c_x(x, y, z) { return x ^ y ^ z; }
  function c_i(x, y, z) { return y ^ (x | ~z); }
  function ff(a, b, c, d, x, s, t) { return (a + c_r(b, c) + d + x + t) >>> 0; }
  function gg(a, b, c, d, x, s, t) { return (a + c_n(b, c) + d + x + t) >>> 0; }
  function hh(a, b, c, d, x, s, t) { return (a + c_x(b, c, d) + x + t) >>> 0; }
  function ii(a, b, c, d, x, s, t) { return (a + c_i(b, c, d) + x + t) >>> 0; }
  function cy(x, y) { return (x << y) | (x >>> (32 - y)); }
  function md5bl(x, len) {
    x[len >> 5] |= 128 << (len % 32);
    x[((len + 64) >>> 9 << 4) + 14] = len;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const oa = a, ob = b, oc = c, od = d;
      a = (a + ff(b, c, d, x[i], 7, -680876936)) >>> 0; d = (d + ff(a, b, c, x[i+1], 12, -389564586)) >>> 0; c = (c + ff(d, a, b, x[i+2], 17, 606105819)) >>> 0; b = (b + ff(c, d, a, x[i+3], 22, -1044525330)) >>> 0;
      a = (a + ff(b, c, d, x[i+4], 7, -176418897)) >>> 0; d = (d + ff(a, b, c, x[i+5], 12, 1200080426)) >>> 0; c = (c + ff(d, a, b, x[i+6], 17, -1473231341)) >>> 0; b = (b + ff(c, d, a, x[i+7], 22, -45705983)) >>> 0;
      a = (a + ff(b, c, d, x[i+8], 7, 1770035416)) >>> 0; d = (d + ff(a, b, c, x[i+9], 12, -1958414417)) >>> 0; c = (c + ff(d, a, b, x[i+10], 17, -42063)) >>> 0; b = (b + ff(c, d, a, x[i+11], 22, -1990404162)) >>> 0;
      a = (a + ff(b, c, d, x[i+12], 7, 1804603682)) >>> 0; d = (d + ff(a, b, c, x[i+13], 12, -40341101)) >>> 0; c = (c + ff(d, a, b, x[i+14], 17, -1502002290)) >>> 0; b = (b + ff(c, d, a, x[i+15], 22, 1236535329)) >>> 0;
      a = (a + gg(b, c, d, x[i+1], 5, -165796510)) >>> 0; d = (d + gg(a, b, c, x[i+6], 9, -1069501632)) >>> 0; c = (c + gg(d, a, b, x[i+11], 14, 643717713)) >>> 0; b = (b + gg(c, d, a, x[i], 20, -373897302)) >>> 0;
      a = (a + gg(b, c, d, x[i+5], 5, -701558691)) >>> 0; d = (d + gg(a, b, c, x[i+10], 9, 38016083)) >>> 0; c = (c + gg(d, a, b, x[i+15], 14, -660478335)) >>> 0; b = (b + gg(c, d, a, x[i+4], 20, -405537848)) >>> 0;
      a = (a + gg(b, c, d, x[i+9], 5, 568446438)) >>> 0; d = (d + gg(a, b, c, x[i+14], 9, -1019803690)) >>> 0; c = (c + gg(d, a, b, x[i+3], 14, -187363961)) >>> 0; b = (b + gg(c, d, a, x[i+8], 20, 1163531501)) >>> 0;
      a = (a + gg(b, c, d, x[i+13], 5, -1444681467)) >>> 0; d = (d + gg(a, b, c, x[i+2], 9, -51403784)) >>> 0; c = (c + gg(d, a, b, x[i+7], 14, 1735328473)) >>> 0; b = (b + gg(c, d, a, x[i+12], 20, -1926607734)) >>> 0;
      a = (a + hh(b, c, d, x[i+5], 4, -378558)) >>> 0; d = (d + hh(a, b, c, x[i+8], 11, -2022574463)) >>> 0; c = (c + hh(d, a, b, x[i+11], 16, 1839030562)) >>> 0; b = (b + hh(c, d, a, x[i+14], 23, -35309556)) >>> 0;
      a = (a + hh(b, c, d, x[i+1], 4, -1530992060)) >>> 0; d = (d + hh(a, b, c, x[i+4], 11, 1272893353)) >>> 0; c = (c + hh(d, a, b, x[i+7], 16, -155497632)) >>> 0; b = (b + hh(c, d, a, x[i+10], 23, -1094730640)) >>> 0;
      a = (a + hh(b, c, d, x[i+13], 4, 681279174)) >>> 0; d = (d + hh(a, b, c, x[i], 11, -358537222)) >>> 0; c = (c + hh(d, a, b, x[i+3], 16, -722521979)) >>> 0; b = (b + hh(c, d, a, x[i+6], 23, 76029189)) >>> 0;
      a = (a + hh(b, c, d, x[i+9], 4, -640364487)) >>> 0; d = (d + hh(a, b, c, x[i+12], 11, -421815835)) >>> 0; c = (c + hh(d, a, b, x[i+15], 16, 530742520)) >>> 0; b = (b + hh(c, d, a, x[i+2], 23, -995338651)) >>> 0;
      a = (a + ii(b, c, d, x[i], 6, -198630844)) >>> 0; d = (d + ii(a, b, c, x[i+7], 10, 1126891415)) >>> 0; c = (c + ii(d, a, b, x[i+14], 15, -1416354905)) >>> 0; b = (b + ii(c, d, a, x[i+5], 21, -57434055)) >>> 0;
      a = (a + ii(b, c, d, x[i+12], 6, 1700485571)) >>> 0; d = (d + ii(a, b, c, x[i+3], 10, -1894986606)) >>> 0; c = (c + ii(d, a, b, x[i+10], 15, -1051523)) >>> 0; b = (b + ii(c, d, a, x[i+1], 21, -2054922799)) >>> 0;
      a = (a + ii(b, c, d, x[i+8], 6, 1873313359)) >>> 0; d = (d + ii(a, b, c, x[i+15], 10, -30611744)) >>> 0; c = (c + ii(d, a, b, x[i+6], 15, -1560198380)) >>> 0; b = (b + ii(c, d, a, x[i+13], 21, 1309151649)) >>> 0;
      a = (a + ii(b, c, d, x[i+4], 6, -145523070)) >>> 0; d = (d + ii(a, b, c, x[i+11], 10, -1120210379)) >>> 0; c = (c + ii(d, a, b, x[i+2], 15, 718787259)) >>> 0; b = (b + ii(c, d, a, x[i+9], 21, -343485551)) >>> 0;
      a = (a + oa) >>> 0; b = (b + ob) >>> 0; c = (c + oc) >>> 0; d = (d + od) >>> 0;
    }
    return [a, b, c, d];
  }
  return u2h(md5bl(rstr(str), str.length * 8));
}

// 虎皮椒签名验证（同步 MD5）
function verifyXunhuSign(params, secret) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k !== 'hash' && (v === 0 || v === '0' || v))
    .sort(([a], [b]) => a.localeCompare(b));
  const str = entries.map(([k, v]) => `${k}=${v}`).join('&') + secret;
  return md5(str) === params.hash;
}

// 生成授权码
function generateLicenseCode(pluginId, plan) {
  const prefixes = {
    shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC',
    dreamstime: 'DT', 'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
  };
  const prefix = prefixes[pluginId] || 'XX';
  const planChar = plan === 'permanent' ? 'P' : plan === 'annual' ? 'Y' : plan === 'trial' ? 'T' : 'X';
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `AP-${prefix}-${planChar}${rand}-${ts}`;
}

// 发送邮件（调用后端处理）
async function processOrder(params, orderInfo, licenseCodes) {
  try {
    const resp = await fetch('https://www.autophoto.store/api/xunhupay/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trade_order_id: params.trade_order_id,
        total_fee: params.total_fee,
        attach: params.attach,
        hash: params.hash,
        plugins: orderInfo.plugins,
        plan: orderInfo.plan,
        planName: orderInfo.planName,
        email: orderInfo.email,
        name: orderInfo.name,
        wechat: orderInfo.wechat,
        licenseCodes
      })
    });
    const result = await resp.text();
    console.log('后端处理结果:', result);
    return result;
  } catch (e) {
    console.error('转发失败:', e.message);
    return 'error: ' + e.message;
  }
}

export default async function handler(req) {
  const url = new URL(req.url);

  // GET：浏览器跳转回来
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

  // Edge Function：直接读取原始 body（支持 form-urlencoded）
  let bodyStr = '';
  try {
    bodyStr = await req.text();
  } catch (e) {
    console.error('读取 body 失败:', e.message);
  }

  console.log('📡 Edge收到原始body:', bodyStr);

  const params = parseFormData(bodyStr);
  const { trade_order_id, status, total_fee, attach, hash } = params;

  console.log(`📋 订单: ${trade_order_id}, 状态: ${status}, 金额: ¥${total_fee}`);

  if (status !== 'OD') {
    return new Response('success', { status: 200 });
  }

  // 解析订单信息
  let orderInfo = {};
  try {
    if (attach) orderInfo = JSON.parse(attach);
  } catch (e) {}

  const plugins = typeof orderInfo.plugins === 'string'
    ? orderInfo.plugins.split(',').filter(Boolean)
    : (orderInfo.plugins || []);
  const plan = orderInfo.plan || 'annual';
  const planName = PLAN_LABELS[plan] || plan;
  orderInfo.planName = planName;

  // 生成授权码
  const licenseCodes = plugins.map(p => generateLicenseCode(p, plan));
  console.log(`✅ 订单 ${trade_order_id} 支付成功! 授权码: ${licenseCodes.join(', ')}`);
  console.log(`   收件人: ${orderInfo.email}`);

  // 转发给后端处理邮件发送
  await processOrder(params, orderInfo, licenseCodes);

  return new Response('success', { status: 200 });
}
