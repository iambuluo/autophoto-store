/**
 * POST /api/order-create
 * 创建虎皮椒支付订单
 *
 * 使用 Vercel Serverless Functions Web API 格式
 */
module.exports = async (req) => {
  // 只接受 POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 解析 body
  let body = {};
  try {
    const raw = await req.text();
    if (raw) {
      if (req.headers.get('content-type')?.includes('application/json')) {
        body = JSON.parse(raw);
      } else {
        for (const [k, v] of new URLSearchParams(raw)) body[k] = v;
      }
    }
  } catch (e) {
    body = {};
  }

  const { plugins, plan, name, email, wechat } = body;

  if (!plugins?.length) {
    return jsonResp({ success: false, error: '请至少选择一个插件' });
  }

  const PLAN_PRICES = { testpay: 0.01, trial: 9.9, annual: 199, permanent: 399 };
  const PLAN_LABELS = { testpay: '¥0.01 测试', trial: '1天试用', annual: '年度授权', permanent: '永久授权' };
  const PLAN_CHARS = { testpay: 'T', trial: 'T', annual: 'Y', permanent: 'P' };
  const PLUGIN_NAMES = {
    shijuezhongguo: '视觉中国自动提交', guangchang: '光厂批量提交助手',
    xinchangchang: '新片场 AIGC 助手', dreamstime: 'Dreamstime 自动提交',
    'adobe-stock': 'Adobe Stock 关键词点击器',
    'qingying-image': '清影批量生图助手', 'qingying-video': '清影批量生视频助手'
  };
  const PLUGIN_PREFIXES = {
    shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC', dreamstime: 'DT',
    'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
  };
  const DISCOUNTS = { 1: 1.0, 2: 0.88, 3: 0.80, 4: 0.70, 5: 0.60, 6: 0.60, 7: 0.50 };

  if (!PLAN_PRICES[plan]) {
    return jsonResp({ success: false, error: '无效的授权类型' });
  }
  if (!email || !name) {
    return jsonResp({ success: false, error: '姓名和邮箱必填' });
  }

  const pluginList = Array.isArray(plugins) ? plugins : [plugins];
  const discount = DISCOUNTS[pluginList.length] || 1.0;
  const total = parseFloat(((PLAN_PRICES[plan] || 0) * pluginList.length * discount).toFixed(2));

  function makeCode(pluginId, planId) {
    const prefix = PLUGIN_PREFIXES[pluginId] || 'XX';
    const pc = PLAN_CHARS[planId] || 'X';
    const now = Math.floor(Date.now() / 1000);
    const expMap = { trial: 86400, annual: 365 * 86400, permanent: 99 * 365 * 86400, testpay: 3600 };
    const exp = now + (expMap[planId] || 365 * 86400);
    const r = Math.random().toString(16).slice(2, 12).padEnd(10, '0').toUpperCase();
    return `AP-${prefix}-${pc}${exp.toString(36).toUpperCase()}-${r}`;
  }

  const orderNo = `AP${Date.now()}${String(Math.floor(Math.random() * 9000) + 1000)}`;
  console.log(`订单: ${orderNo} | ${pluginList.join('+')} | ${PLAN_LABELS[plan]} | ¥${total}`);

  const appId = process.env.XUNHU_APP_ID;
  const appSecret = process.env.XUNHU_APP_SECRET;

  // 演示模式
  if (!appId || !appSecret || !appId.trim() || !appSecret.trim()) {
    const codes = pluginList.map(p => makeCode(p, plan));
    console.log(`演示模式: ${codes.join(', ')}`);
    return jsonResp({ success: true, mode: 'demo', orderNo, total, demoLicenseCodes: codes });
  }

  // 正式模式
  const baseUrl = (process.env.XUNHU_RETURN_URL || '').trim() || 'https://www.autophoto.store';
  const vercelUrl = (process.env.VERCEL_URL || '').trim();
  const notifyBase = vercelUrl ? `https://${vercelUrl}` : 'https://www.autophoto.store';

  const nowSec = Math.floor(Date.now() / 1000);
  const nonce = Math.random().toString(16).slice(2);

  // MD5 签名
  const sigParams = {
    version: '1.1', appid: appId, trade_order_id: orderNo,
    total_fee: total.toFixed(2),
    title: `AutoPhoto - ${pluginList.map(p => PLUGIN_NAMES[p] || p).join('+')} (${PLAN_LABELS[plan]})`,
    time: String(nowSec), nonce_str: nonce,
    return_url: `${baseUrl}/success.html?order=${orderNo}`,
    notify_url: `${notifyBase}/api/xunhupay/callback`,
    attach: JSON.stringify({ plugins: pluginList.join(','), plan, name, email, wechat }),
    buyer: email
  };
  const sorted = Object.keys(sigParams).sort();
  const signStr = sorted.map(k => `${k}=${sigParams[k]}`).join('&') + appSecret;
  const hash = md5(signStr);

  const formData = new URLSearchParams({ ...sigParams, hash }).toString();

  let xunhuResult;
  try {
    const resp = await fetch('https://api.xunhupay.com/payment/do.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });
    xunhuResult = await resp.json();
  } catch (e) {
    console.error('虎皮椒请求失败:', e.message);
    return jsonResp({ success: false, error: '支付网关请求失败' });
  }

  console.log('虎皮椒:', JSON.stringify(xunhuResult));

  if (xunhuResult.errcode === 0 && xunhuResult.url) {
    return jsonResp({ success: true, mode: 'xunhu', paymentUrl: xunhuResult.url, orderNo });
  } else {
    return jsonResp({ success: false, error: xunhuResult.errmsg || '支付创建失败', debug: { errcode: xunhuResult.errcode } });
  }
};

function jsonResp(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

// 内联 MD5（纯 JS，无依赖）
function md5(str) {
  function rstr(b) {
    const o = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i);
    return o;
  }
  function u2h(b) {
    const h = '0123456789abcdef';
    let r = '';
    for (let i = 0; i < b.length * 4; i++)
      r += h[(b[i >> 2] >> ((i % 4) * 8 + 4)) & 15] + h[(b[i >> 2] >> ((i % 4) * 8)) & 15];
    return r;
  }
  function ff(a, b, c, d, x, s, t) { return (a + ((b & c) | (~b & d)) + x + t) >>> 0; }
  function gg(a, b, c, d, x, s, t) { return (a + ((b & d) | (c & ~d)) + x + t) >>> 0; }
  function hh(a, b, c, d, x, s, t) { return (a + (b ^ c ^ d) + x + t) >>> 0; }
  function ii(a, b, c, d, x, s, t) { return (a + (c ^ (b | ~d)) + x + t) >>> 0; }

  const buf = rstr(str);
  buf[str.length >> 5] |= 0x80 << ((str.length % 4) * 8);
  buf[(((str.length + 64) >>> 9) << 4) + 14] = str.length * 8;

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  for (let i = 0; i < buf.length; i += 16) {
    const [oa, ob, oc, od] = [a, b, c, d];
    a = ff(a,b,c,d,buf[i],7,0xd76aa478); d = ff(d,a,b,c,buf[i+1],12,0xe8c7b756);
    c = ff(c,d,a,b,buf[i+2],17,0x242070db); b = ff(b,c,d,a,buf[i+3],22,0xf57c0faf);
    a = ff(a,b,c,d,buf[i+4],7,0x4787c62a); d = ff(d,a,b,c,buf[i+5],12,0xa8304613);
    c = ff(c,d,a,b,buf[i+6],17,0xfd469501); b = ff(b,c,d,a,buf[i+7],22,0x698098d8);
    a = ff(a,b,c,d,buf[i+8],7,0x8b44f7af); d = ff(d,a,b,c,buf[i+9],12,0xffff5bb1);
    c = ff(c,d,a,b,buf[i+10],17,0x895cd7be); b = ff(b,c,d,a,buf[i+11],22,0x6b901122);
    a = ff(a,b,c,d,buf[i+12],7,0xfd987193); d = ff(d,a,b,c,buf[i+13],12,0xa679438e);
    c = ff(c,d,a,b,buf[i+14],17,0x49b40821); b = ff(b,c,d,a,buf[i+15],22,0xf61e2562);
    a = gg(a,b,c,d,buf[i+1],5,0xc040b340); d = gg(d,a,b,c,buf[i+6],9,0x265e5a51);
    c = gg(c,d,a,b,buf[i+11],14,0xe9b6c7aa); b = gg(b,c,d,a,buf[i],20,0xd62f105d);
    a = gg(a,b,c,d,buf[i+5],5,0x2441453); d = gg(d,a,b,c,buf[i+10],9,0xd8a1e681);
    c = gg(c,d,a,b,buf[i+15],14,0xe7d3fbc8); b = gg(b,c,d,a,buf[i+4],20,0x21e1cde6);
    a = gg(a,b,c,d,buf[i+9],5,0xc33707d6); d = gg(d,a,b,c,buf[i+14],9,0xf4d50d87);
    c = gg(c,d,a,b,buf[i+3],14,0x455a14ed); b = gg(b,c,d,a,buf[i+8],20,0xa9e3e905);
    a = gg(a,b,c,d,buf[i+13],5,0xfcefa3f8); d = gg(d,a,b,c,buf[i+2],9,0x676f02d9);
    c = gg(c,d,a,b,buf[i+7],14,0x8d2a4c8a); b = gg(b,c,d,a,buf[i+12],20,0xfffa3942);
    a = hh(a,b,c,d,buf[i+5],4,0x8771f681); d = hh(d,a,b,c,buf[i+8],11,0x6d9d6122);
    c = hh(c,d,a,b,buf[i+11],16,0xfde5380c); b = hh(b,c,d,a,buf[i+14],23,0xa4beea44);
    a = hh(a,b,c,d,buf[i+1],4,0x4bdecfa9); d = hh(d,a,b,c,buf[i+4],11,0xf6bb4b60);
    c = hh(c,d,a,b,buf[i+7],16,0xbebfbc70); b = hh(b,c,d,a,buf[i+10],23,0x289b7ec6);
    a = hh(a,b,c,d,buf[i+13],4,0xeaa127fa); d = hh(d,a,b,c,buf[i],11,0xd4ef3085);
    c = hh(c,d,a,b,buf[i+3],16,0x4881d05); b = hh(b,c,d,a,buf[i+6],23,0xd9d4d039);
    a = hh(a,b,c,d,buf[i+9],4,0xe6db99e5); d = hh(d,a,b,c,buf[i+15],11,0x1fa27cf8);
    c = hh(c,d,a,b,buf[i+2],16,0xc4ac5665); b = hh(b,c,d,a,buf[i+5],23,0xf4292244);
    a = ii(a,b,c,d,buf[i],6,0x432aff97); d = ii(d,a,b,c,buf[i+7],10,0xab9423a7);
    c = ii(c,d,a,b,buf[i+14],15,0xfc93a039); b = ii(b,c,d,a,buf[i+5],21,0x655b59c3);
    a = ii(a,b,c,d,buf[i+12],6,0x8f0ccc92); d = ii(d,a,b,c,buf[i+3],10,0xffeff47d);
    c = ii(c,d,a,b,buf[i+10],15,0x85845dd1); b = ii(b,c,d,a,buf[i+1],21,0x6fa87e4f);
    a = ii(a,b,c,d,buf[i+8],6,0xfe2ce6e0); d = ii(d,a,b,c,buf[i+15],10,0xa3014314);
    c = ii(c,d,a,b,buf[i+6],15,0x4e0811a1); b = ii(b,c,d,a,buf[i+13],21,0xf7537e82);
    a = ii(a,b,c,d,buf[i+4],6,0xbd3af235); d = ii(d,a,b,c,buf[i+11],10,0x2ad7d2bb);
    c = ii(c,d,a,b,buf[i+2],15,0xeb86d391); b = ii(b,c,d,a,buf[i+9],21,0x289b7ec6);
    a = (a + oa) >>> 0; b = (b + ob) >>> 0; c = (c + oc) >>> 0; d = (d + od) >>> 0;
  }
  return u2h([a, b, c, d]);
}
