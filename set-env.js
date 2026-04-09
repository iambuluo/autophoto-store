/**
 * 通过 Vercel API 设置环境变量（不带换行符）
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const vars = {
  XUNHU_APP_ID: '201906178546',
  XUNHU_APP_SECRET: '6676e76da0cb7cbfe0846bbd71d094d9',
};

for (const [key, value] of Object.entries(vars)) {
  const tmpFile = path.join(__dirname, `.tmp-${key}`);
  fs.writeFileSync(tmpFile, value, { encoding: 'utf8' }); // 无换行符
  try {
    // 先删除再添加
    try { execSync(`npx vercel env rm ${key} --yes`, { stdio: 'pipe' }); } catch(e) {}
    execSync(`npx vercel env add ${key} production < "${tmpFile}"`, { stdio: 'inherit', shell: 'cmd.exe' });
    console.log(`✅ ${key} 设置成功`);
  } catch (e) {
    console.error(`❌ ${key} 设置失败:`, e.message);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}
