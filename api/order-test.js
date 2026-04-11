// 简化版订单API - 零依赖
const PLAN_PRICES = { testpay: 0.01, trial: 9.9, annual: 199, permanent: 399 };
const PLAN_LABELS = { testpay: '¥0.01 测试', trial: '1天试用', annual: '年度授权', permanent: '永久授权' };
const PLUGIN_NAMES = { 'qingying-image': '清影批量生图', 'qingying-video': '清影批量生视频', 'shijuezhongguo': '视觉中国' };

function genCode() {
  return 'AP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  
  try {
    const { plugins, plan } = req.body || {};
    if (!plugins?.length) return res.status(400).json({ success: false, error: '请选择插件' });
    if (!PLAN_PRICES[plan]) return res.status(400).json({ success: false, error: '无效方案' });
    
    res.status(200).json({
      success: true,
      mode: 'test',
      orderNo: 'TEST_' + Date.now(),
      total: PLAN_PRICES[plan] * plugins.length,
      planName: PLAN_LABELS[plan],
      licenseCodes: plugins.map(p => genCode())
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
