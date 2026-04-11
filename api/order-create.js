module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  
  try {
    const { plugins, plan, name, email } = req.body || {};
    
    if (!plugins?.length) {
      return res.status(400).json({ success: false, error: '请选择插件' });
    }
    
    // 生成授权码
    const licenseCodes = plugins.map(p => {
      const prefix = p === 'qingying-image' ? 'QY' : 
                    p === 'shijuezhongguo' ? 'VCG' : 'XX';
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      const expiryB36 = expiry.toString(36).toUpperCase();
      const random = Math.random().toString(16).substring(2, 14).toUpperCase();
      return `AP-${prefix}-T${expiryB36}-${random}`;
    });
    
    const licenseCodesLabeled = licenseCodes.map((code, i) => {
      const name = plugins[i] === 'qingying-image' ? '[清影批量生图助手]' :
                   plugins[i] === 'shijuezhongguo' ? '[视觉中国自动提交]' : 
                   `[${plugins[i]}]`;
      return `${name} ${code}`;
    });
    
    const orderNo = 'AP' + Date.now();
    
    return res.status(200).json({
      success: true,
      mode: 'demo',
      orderNo,
      total: 0.01,
      planName: '测试授权',
      licenseCodes,
      licenseCodesLabeled
    });
    
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
