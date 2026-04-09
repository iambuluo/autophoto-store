const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = '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';
const OWNER = 'iambuluo';
const REPO = 'autophoto-store';
const BRANCH = 'main';

const ROOT = __dirname;
const IGNORE_FILE = path.join(ROOT, '.gitignore');

function readIgnore() {
  if (!fs.existsSync(IGNORE_FILE)) return [];
  return fs.readFileSync(IGNORE_FILE, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.trim().replace(/\//g, '\\'));
}

function shouldIgnore(relPath, ignorePatterns) {
  const normalized = relPath.replace(/\\/g, '/');
  for (const pattern of ignorePatterns) {
    const p = pattern.replace(/\//g, '\\');
    if (normalized === p || normalized.startsWith(p + '\\') || normalized.endsWith(p)) return true;
    if (p.startsWith('*') && normalized.endsWith(p.slice(1))) return true;
  }
  return false;
}

function getAllFiles(dir, base = '') {
  const ignore = readIgnore();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const rel = base ? base + '\\' + entry.name : entry.name;
    if (shouldIgnore(rel, ignore) || entry.name === '.git') continue;
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(path.join(dir, entry.name), rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

function getFileContent(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath));
}

function apiRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AutoPhoto-Deploy',
        'Content-Type': 'application/json'
      }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    
    const req = https.request(options, (res) => {
      let resBody = '';
      res.on('data', c => resBody += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch {
          resolve({ status: res.statusCode, data: resBody });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getFileSha(filePath) {
  const encodedPath = encodeURIComponent(filePath.replace(/\\/g, '/'));
  const result = await apiRequest('GET', `/repos/${OWNER}/${REPO}/contents/${encodedPath}?ref=${BRANCH}`);
  return result.status === 200 ? result.data.sha : null;
}

async function uploadFile(filePath) {
  const content = getFileContent(filePath);
  const base64 = content.toString('base64');
  const sha = await getFileSha(filePath);
  const encodedPath = encodeURIComponent(filePath.replace(/\\/g, '/'));
  const apiPath = `/repos/${OWNER}/${REPO}/contents/${encodedPath}`;
  
  const payload = {
    message: `Add/update ${filePath}`,
    content: base64,
    branch: BRANCH
  };
  if (sha) payload.sha = sha;
  
  const result = await apiRequest('PUT', apiPath, payload);
  if (result.status === 200 || result.status === 201) {
    console.log(`✅ ${filePath}`);
    return true;
  } else {
    console.log(`❌ ${filePath}: ${result.status} - ${JSON.stringify(result.data).slice(0, 100)}`);
    return false;
  }
}

async function main() {
  console.log('🔄 正在上传 showcase-site 到 GitHub...\n');
  
  const files = getAllFiles(ROOT);
  console.log(`📁 共 ${files.length} 个文件待上传\n`);
  
  let success = 0, failed = 0;
  for (const file of files) {
    const ok = await uploadFile(file);
    if (ok) success++; else failed++;
  }
  
  console.log(`\n🎉 完成！成功 ${success}，失败 ${failed}`);
}

main().catch(console.error);
