// 直接测试 QQ 邮件发送
const nodemailer = require('nodemailer');

async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: '541163318@qq.com',
      pass: 'lwqjkjblneqebbcg'
    }
  });

  console.log('正在连接 QQ 邮件服务...');
  
  try {
    await transporter.verify();
    console.log('✅ SMTP 连接成功！');
    
    const info = await transporter.sendMail({
      from: '"AutoPhoto" <541163318@qq.com>',
      to: '541163318@qq.com',
      subject: '测试邮件 - AutoPhoto 授权码系统',
      html: `
        <h2>测试邮件</h2>
        <p>如果你收到这封邮件，说明邮件发送系统正常工作！</p>
        <p>测试授权码：AP-VCG-X1A2B3C4D5-TEST</p>
        <p>时间：${new Date().toISOString()}</p>
      `
    });
    
    console.log('✅ 邮件发送成功！');
    console.log('Message ID:', info.messageId);
  } catch (err) {
    console.error('❌ 错误：', err.message);
    if (err.code === 'EAUTH') {
      console.error('认证失败！检查密码/授权码是否正确');
    }
  }
}

testEmail();
