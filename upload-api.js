/**
 * 上传 API 更新到 GitHub（tourinns-projects/autophoto-store）
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = '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';
const OWNER = 'tourinns-projects';
const REPO = 'autophoto-store';

const files = [
  'package.json',
  'api/xunhupay/process.js'
];

function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ 文件不存在: ${filePath}`);
      resolve();
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const encoded = Buffer.from(content).toString('base64');

    const data = JSON.stringify({
      message: `Add Resend email support - ${filePath}`,
      content: encoded
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/contents/${filePath}`,
      method: 'PUT',
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AutoPhoto-Deploy',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ ${filePath}`);
        } else if (res.statusCode === 422) {
          // 文件已存在，获取 SHA
          console.log(`📝 ${filePath} 已存在，获取 SHA...`);
          getFileSha(filePath).then(sha => {
            updateFile(filePath, content, sha).then(() => resolve()).catch(e => reject(e));
          }).catch(e => reject(e));
        } else {
          console.log(`❌ ${filePath}: ${result.message}`);
        }
        resolve();
      });
    });
    req.on('error', e => reject(e));
    req.write(data);
    req.end();
  });
}

function getFileSha(filePath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/contents/${filePath}`,
      method: 'GET',
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AutoPhoto-Deploy'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        resolve(result.sha);
      });
    });
    req.on('error', e => reject(e));
    req.end();
  });
}

function updateFile(filePath, content, sha) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(content).toString('base64');
    const data = JSON.stringify({
      message: `Update Resend email support - ${filePath}`,
      content: encoded,
      sha
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/contents/${filePath}`,
      method: 'PUT',
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AutoPhoto-Deploy',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (res.statusCode === 200) {
          console.log(`✅ ${filePath} (已更新)`);
        } else {
          console.log(`❌ ${filePath}: ${result.message}`);
        }
        resolve();
      });
    });
    req.on('error', e => reject(e));
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🚀 开始上传到 GitHub...\n');
  for (const file of files) {
    await uploadFile(file);
  }
  console.log('\n✅ 完成！');
}

main().catch(console.error);
