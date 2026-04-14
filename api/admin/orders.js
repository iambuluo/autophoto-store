/**
 * GET /api/admin/orders
 * 获取所有订单 - 零依赖版本
 */

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: '只支持GET' });
  
  try {
    const GIST_ID = process.env.GIST_ID;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    if (!GIST_ID || !GITHUB_TOKEN) {
      return res.status(200).json({
        success: true,
        orders: [],
        message: '未配置订单存储（请设置 GIST_ID 和 GITHUB_TOKEN 环境变量）'
      });
    }
    
    // 获取 Gist
    const gistResp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!gistResp.ok) {
      throw new Error('无法访问 Gist: ' + gistResp.status);
    }
    
    const gist = await gistResp.json();
    const filename = Object.keys(gist.files)[0];
    const orders = JSON.parse(gist.files[filename].content || '[]');
    
    return res.status(200).json({
      success: true,
      total: orders.length,
      orders
    });
    
  } catch (e) {
    console.error('[admin/orders]', e.message);
    return res.status(200).json({
      success: false,
      error: e.message,
      orders: []
    });
  }
};
