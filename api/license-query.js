/**
 * POST /api/license-query
 * 用户查询自己的授权码（通过邮箱）
 * 
 * 存储策略：写入 /tmp 目录（Vercel Serverless 临时存储）
 * 注意：Serverless 环境下的 /tmp 在冷启动后会清空
 * 生产环境建议使用 Upstash Redis 或类似服务
 */
// 内存存储（替代文件系统，兼容 Edge Runtime）
const memoryDB = { orders: [] };

// 读取数据库
function readDB() {
  return memoryDB;
}

// 写入数据库
function writeDB(db) {
  // 内存存储不需要写入操作
  return true;
}

// 保存订单授权码（内部调用）
function saveLicenseCode(order) {
  const existing = memoryDB.orders.findIndex(o => o.orderNo === order.orderNo);
  if (existing >= 0) {
    memoryDB.orders[existing] = order;
  } else {
    memoryDB.orders.push(order);
  }
  console.log(`✅ 授权码已保存到内存数据库: ${order.orderNo}`);
  console.log(`内存数据库订单数: ${memoryDB.orders.length}`);
  return true;
}

// 生成授权码（与 callback.js 保持一致）
function generateLicenseCode(pluginId, plan) {
  const prefixes = {
    shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC',
    dreamstime: 'DT', 'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
  };
  const prefix = prefixes[pluginId] || 'XX';
  const planChar = plan === 'permanent' ? 'P' : plan === 'annual' ? 'Y' : plan === 'trial' ? 'T' : 'X';
  const rand = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('').toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `AP-${prefix}-${planChar}${rand}-${ts}`;
}

// 主处理函数
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { email, orderNo } = req.body || {};

  if (!email && !orderNo) {
    return res.status(400).json({ success: false, error: '请提供邮箱或订单号' });
  }

  const db = readDB();
  let orders = [];

  if (orderNo) {
    // 通过订单号查询
    const order = db.orders.find(o => o.orderNo === orderNo);
    if (order) {
      orders = [order];
    }
  } else {
    // 通过邮箱查询
    orders = db.orders.filter(o => o.email && o.email.toLowerCase() === email.toLowerCase());
  }

  if (orders.length === 0) {
    if (orderNo) {
      console.log(`[license-query] 未找到订单号 ${orderNo} 的订单`);
      return res.json({ success: true, codes: [], order: null });
    } else {
      console.log(`[license-query] 未找到邮箱 ${email} 的订单`);
      return res.json({ success: true, codes: [] });
    }
  }

  // 合并所有授权码
  const allCodes = [];
  const PLUGIN_NAMES = {
    shijuezhongguo: '视觉中国自动提交', guangchang: '光厂批量提交助手',
    xinchangchang: '新片场 AIGC 助手', dreamstime: 'Dreamstime 自动提交',
    'adobe-stock': 'Adobe Stock 关键词点击器', 'qingying-image': '清影批量生图助手',
    'qingying-video': '清影批量生视频助手'
  };

  for (const order of orders) {
    for (const code of (order.licenseCodes || [])) {
      allCodes.push(code);
    }
  }

  console.log(`[license-query] 找到 ${allCodes.length} 个授权码`);

  if (orderNo && orders.length > 0) {
    return res.json({
      success: true,
      codes: allCodes,
      order: orders[0]
    });
  } else {
    return res.json({
      success: true,
      codes: allCodes,
      count: allCodes.length,
      orders: orders.map(o => ({
        orderNo: o.orderNo,
        plugins: (o.plugins || []).map(p => PLUGIN_NAMES[p] || p),
        plan: o.plan,
        total: o.total
      }))
    });
  }
}
