/**
 * 邮件发送测试脚本
 * 用法：
 *   1. 确保 .env 文件中填好了 RESEND_API_KEY 和 ADMIN_EMAIL
 *   2. npm install（安装 resend 依赖）
 *   3. node test-email-resend.js
 */

require('dotenv').config();
const crypto = require('crypto');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TEST_TO_EMAIL  = process.env.ADMIN_EMAIL || 'tourinn@gmail.com';
const EMAIL_FROM     = process.env.EMAIL_FROM   || 'AutoPhoto <onboarding@resend.dev>';

// ---------- 模拟授权码生成 ----------
function calcExpiry(plan) {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  switch (plan) {
    case 'trial':     return now + 1 * DAY;
    case 'annual':    return now + 365 * DAY;
    case 'permanent': return now + 99 * 365 * DAY;
    default:          return now + 365 * DAY;
  }
}

function generateLicenseCode(pluginId, plan) {
  const prefixes = {
    shijuezhongguo: 'VCG', guangchang: 'VJ', xinchangchang: 'XC',
    dreamstime: 'DT', 'adobe-stock': 'AS', 'qingying-image': 'QY', 'qingying-video': 'QV'
  };
  const prefix = prefixes[pluginId] || 'XX';
  const planChar = plan === 'permanent' ? 'P' : plan === 'annual' ? 'Y' : plan === 'trial' ? 'T' : 'X';
  const expiry = calcExpiry(plan);
  const expiryB36 = expiry.toString(36).toUpperCase();
  const rand = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `AP-${prefix}-${planChar}${expiryB36}-${rand}`;
}

function parseExpiryFromCode(code) {
  try {
    const parts = code.split('-');
    const segment = parts[2];
    const expiryB36 = segment.slice(1);
    const expirySec = parseInt(expiryB36, 36);
    return new Date(expirySec * 1000);
  } catch (e) { return null; }
}

// ---------- 测试 ----------
async function main() {
  console.log('\n======= AutoPhoto 邮件+授权码测试 =======\n');

  // 1. 测试授权码生成
  console.log('【1】授权码生成测试：');
  const plans = ['trial', 'annual', 'permanent'];
  plans.forEach(plan => {
    const code = generateLicenseCode('shijuezhongguo', plan);
    const expiry = parseExpiryFromCode(code);
    console.log(`  ${plan.padEnd(10)} → ${code}`);
    console.log(`               到期: ${expiry ? expiry.toLocaleDateString('zh-CN') : '解析失败'}`);
  });

  // 2. 测试 Resend 邮件
  console.log('\n【2】Resend 邮件发送测试：');
  if (RESEND_API_KEY === 're_xxxxxxxxxx') {
    console.log('  ⚠️  请先填入真实的 RESEND_API_KEY（在本文件顶部）');
    return;
  }

  const testCode = generateLicenseCode('shijuezhongguo', 'annual');
  const html = `
<div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0f;color:#f1f5f9;">
  <h2 style="color:#818cf8;">🧪 AutoPhoto 邮件测试</h2>
  <p>这是一封测试邮件，说明邮件系统工作正常！</p>
  <p><b>测试授权码（年付）：</b></p>
  <div style="background:#1a1a2e;padding:10px 16px;border-radius:6px;font-family:monospace;color:#818cf8;font-size:16px;">${testCode}</div>
  <p style="color:#64748b;font-size:12px;margin-top:20px;">发送时间：${new Date().toLocaleString('zh-CN')}</p>
</div>`;

  try {
    const { Resend } = require('resend');
    const resend = new Resend(RESEND_API_KEY);
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: TEST_TO_EMAIL,
      subject: '🧪 AutoPhoto 邮件系统测试',
      html
    });
    if (result.data?.id) {
      console.log(`  ✅ 邮件发送成功！ID: ${result.data.id}`);
      console.log(`  📬 请查收 ${TEST_TO_EMAIL} 的邮件`);
    } else {
      console.log('  ❌ 发送失败:', result.error);
    }
  } catch (err) {
    console.log(`  ❌ 错误: ${err.message}`);
    if (err.message.includes('Cannot find module')) {
      console.log('  💡 请先运行: npm install resend');
    }
  }
}

main().catch(console.error);
