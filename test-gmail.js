const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com', port: 465, secure: true,
  auth: { user: '541163318@qq.com', pass: 'lwqjkjblneqebbcg' }
});
transporter.sendMail({
  from: '"AutoPhoto" <541163318@qq.com>',
  to: 'tourinn@gmail.com',
  subject: 'AutoPhoto 管理员通知测试',
  text: '测试邮件 - 新订单通知测试\n订单号: TEST001\n金额: 0.01元'
}).then(r => console.log('成功:', r.messageId)).catch(e => console.log('失败:', e.message, '代码:', e.code));
