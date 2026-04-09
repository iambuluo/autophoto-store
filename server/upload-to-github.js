/**
 * 上传 Vercel 格式文件到 GitHub
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = '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';
const OWNER = 'iambuluo';
const REPO = 'autophoto-server';

const files = [
  'package.json',
  'vercel.json',
  'api/_lib/utils.js',
  'api/create-order.js',
  'api/health.js',
  'api/order/[orderNo].js',
  'api/xunhupay/callback.js'
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
      message: `Add ${filePath}`,
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
          // 文件已存在，需要先获取 SHA 再更新
          console.log(`📝 ${filePath} 已存在，获取 SHA...`);
          getFileSha(filePath).then(sha => {
            updateFile(filePath, content, sha).then(() => resolve()).catch(e => reject(e));
          }).catch(e => reject(e));
        } else {
          console.log(`❌ ${filePath}: ${result.message}`);
          reject(new Error(result.message));
        }
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
      message: `Update ${filePath}`,
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
    try {
      await uploadFile(file);
    } catch (e) {
      console.error(`上传失败: ${file}`, e.message);
    }
  }
  console.log('\n✅ 完成！');
}

main().catch(console.error);
