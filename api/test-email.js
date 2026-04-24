/**
 * api/test-email.js
 * 测试邮件发送是否正常（仅用于调试，上线后可删）
 * GET/POST /api/test-email?to=xxx@xxx.com
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const to = req.query?.to || req.body?.to || 'tourinn@gmail.com';
  const RESEND_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_KEY) {
    return res.status(500).json({ ok: false, error: 'RESEND_API_KEY not configured' });
  }

  // 生成测试授权码
  const crypto = require('crypto');
  const expireTime = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const expireB36 = expireTime.toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  const testCode = `AP-XC-Y${expireB36}-${random}`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM 
          ? `AutoPhoto Store <${process.env.EMAIL_FROM}>`
          : 'AutoPhoto Store <onboarding@resend.dev>',
        to: process.env.EMAIL_FROM ? [to, 'tourinn@gmail.com'] : ['tourinn@gmail.com'],
        subject: `🧪 [测试] 授权码邮件 - Xinchangchang AIGC Assistant（目标收件人: ${to}）`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#22c55e">✅ 授权码已生成（测试邮件）</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;color:#888">插件</td><td style="padding:8px"><b>Xinchangchang AIGC Assistant</b></td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;color:#888">方案</td><td style="padding:8px">年度授权（365天）</td></tr>
              <tr><td style="padding:8px;color:#888">授权码</td><td style="padding:8px"><code style="font-size:18px;background:#f0fdf4;padding:8px 16px;border-radius:6px;color:#16a34a;letter-spacing:2px">${testCode}</code></td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;color:#888">收件人</td><td style="padding:8px">${to}</td></tr>
            </table>
            <p style="margin-top:20px;color:#666">这是一封测试邮件，验证邮件发送功能是否正常。</p>
            <p style="color:#666">如有问题请联系微信：auto_photo2025</p>
          </div>
        `
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(500).json({ ok: false, error: data, key_prefix: RESEND_KEY.substring(0,8) });
    }
    return res.status(200).json({ ok: true, resend_id: data.id, to, testCode, key_prefix: RESEND_KEY.substring(0,8) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
