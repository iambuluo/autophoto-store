/**
 * GET /api/health
 * 健康检查 + 环境变量配置状态
 */
module.exports = (req, res) => {
  // 强制设置 header（防止响应格式错误）
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 基础健康状态
  const health = {
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime ? process.uptime().toFixed(1) + 's' : 'unknown'
  };

  // 虎皮椒配置状态（不暴露具体值）
  if (process.env.XUNHU_APP_ID) {
    health.xunhu = '✅ 已配置 (APP_ID: ' + process.env.XUNHU_APP_ID.slice(0, 6) + '***)';
  } else {
    health.xunhu = '⚠️ 未配置 - 使用演示模式';
  }

  // 邮件配置状态
  if (process.env.SMTP_USER) {
    health.email = '✅ ' + process.env.SMTP_USER;
  } else {
    health.email = '⚠️ 未配置';
  }

  // Vercel 环境信息
  health.vercel = {
    region: process.env.VERCEL_REGION || 'unknown',
    url: process.env.VERCEL_URL || 'unknown'
  };

  res.status(200).json(health);
};
