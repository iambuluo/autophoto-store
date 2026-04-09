module.exports = (req, res) => {
  res.json({
    status: 'ok',
    version: 'v2-' + new Date().toISOString(),
    xunhu: process.env.XUNHU_APP_ID ? '✅ 已配置' : '⚠️ 未配置',
    email: process.env.SMTP_USER ? '✅ ' + process.env.SMTP_USER : '⚠️ 未配置',
    time: new Date().toISOString()
  });
};
