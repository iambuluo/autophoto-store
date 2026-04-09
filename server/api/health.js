/**
 * GET /api/health
 * 健康检查
 */
module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'AutoPhoto API',
    time: new Date().toISOString(),
    version: '1.0.0'
  });
};
