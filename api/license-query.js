/**
 * POST /api/license-query
 * 用户查询自己的授权码（通过邮箱）
 * 
 * 存储策略：写入 /tmp 目录（Vercel Serverless 临时存储）
 * 注意：Serverless 环境下的 /tmp 在冷启动后会清空
 * 生产环境建议使用 Upstash Redis 或类似服务
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = '/tmp/autophoto-licenses.json';

// 读取数据库
function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {}
  return { orders: [] };
}

// 写入数据库
function writeDB(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    return true;
  } catch (e) {
    console.error('写入DB失败:', e.message);
    return false;
  }
}

// 保存订单授权码（内部调用）
export function saveLicenseCode(order) {
  const db = readDB();
  // 按邮箱索引
  const existing = db.orders.findIndex(o => o.orderNo === order.orderNo);
  if (existing >= 0) {
    db.orders[existing] = order;
  } else {
    db.orders.push(order);
  }
  return writeDB(db);
}

// 生成授权码（与 callback.js 保持一致）
export function generateLicenseCode(pluginId, plan) {
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

  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ success: false, error: '请提供邮箱' });
  }

  const db = readDB();
  const orders = db.orders.filter(o => o.email && o.email.toLowerCase() === email.toLowerCase());

  if (orders.length === 0) {
    console.log(`[license-query] 未找到邮箱 ${email} 的订单`);
    return res.json({ success: true, codes: [] });
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

  console.log(`[license-query] 邮箱 ${email} 找到 ${allCodes.length} 个授权码`);

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
