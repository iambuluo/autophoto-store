module.exports = (req, res) => {
  console.log('test API called at', new Date().toISOString());
  res.json({ 
    success: true, 
    message: 'test API works',
    time: new Date().toISOString(),
    env: {
      xunhu_app_id: process.env.XUNHU_APP_ID ? 'set' : 'not set',
      xunhu_secret: process.env.XUNHU_APP_SECRET ? 'set' : 'not set'
    }
  });
};
