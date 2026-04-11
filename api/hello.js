// 最简单的测试 API - CommonJS 格式
module.exports = (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'Hello from API!',
    timestamp: new Date().toISOString()
  });
};
