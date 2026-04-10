// 简化版订单API - 完全独立，不依赖任何模块
const PLAN_LABELS = {
  testpay: '¥0.01 测试',
  trial: '1天试用',
  annual: '年度授权',
  permanent: '永久授权'
};

const PLAN_PRICES = {
  testpay: 0.01,
  trial: 9.9,
  annual: 199,
  permanent: 399
};

const PLUGIN_NAMES = {
  'qingying-image': '清影批量生图助手',
  'qingying-video': '清影批量生视频助手',
  'shijuezhongguo': '视觉中国自动提交',
  'guangchang': '光厂批量提交助手',
  'xinchangchang': '新片场 AIGC 助手',
  'dreamstime': 'Dreamstime 自动提交',
  'adobe-stock': 'Adobe Stock 关键词点击器'
};

function randomHex(bytes) {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

function generateLicenseCode(pluginId, plan) {
  const prefix = pluginId === 'qingying-image' ? 'QY' : 
                 pluginId === 'qingying-video' ? 'QV' : 'XX';
  const planChar = plan === 'testpay' ? 'T' : 
                   plan === 'annual' ? 'Y' : 
                   plan === 'permanent' ? 'P' : 'T';
  const now = Math.floor(Date.now() / 1000);
  const expiry = (now + 86400).toString(36).toUpperCase();
  const rand = randomHex(6);
  return `AP-${prefix}-${planChar}${expiry}-${rand}`;
}

module.exports = async (req, res) => {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST' });
  }
  
  try {
    const { plugins, plan, name, email } = req.body || {};
    
    if (!plugins || !Array.isArray(plugins) || plugins.length === 0) {
      return res.status(400).json({ success: false, error: '请至少选择一个插件' });
    }
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ success: false, error: '无效的授权类型' });
    }
    
    const total = PLAN_PRICES[plan] * plugins.length;
    const orderNo = 'TEST_' + Date.now();
    const licenseCodesLabeled = plugins.map(p => {
      const code = generateLicenseCode(p, plan);
      return `[${PLUGIN_NAMES[p] || p}] ${code}`;
    });
    
    return res.status(200).json({
      success: true,
      mode: 'test',
      message: '测试成功',
      orderNo,
      total,
      plugins: plugins.map(p => PLUGIN_NAMES[p] || p),
      planName: PLAN_LABELS[plan],
      licenseCodesLabeled
    });
    
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
