# AutoPhoto 网站部署指南

## 目录结构

```
showcase-site/
├── index.html          # 首页
├── pricing.html        # 定价页
├── buy.html            # 购买页（前端）
├── about.html          # 关于页
├── success.html        # 支付成功页
├── css/
│   └── style.css       # 样式表
├── js/
│   └── main.js         # 前端JS
├── plugins/            # 7个插件详情页
│   ├── shijuezhongguo.html
│   ├── guangchang.html
│   └── ...（其余6个）
├── server/             # 后端（虎皮椒支付 + 邮件发码）
│   ├── server.js
│   ├── package.json
│   ├── Railway.toml     # Railway 部署配置
│   ├── .env.example     # 环境变量模板
│   └── public/          # 静态文件（成功页等）
```

---

## 方案一：纯静态部署（仅展示，无支付）

### Vercel（推荐，永久免费）

**不需要 GitHub！** 直接用 Vercel CLI 上传：

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 进入网站目录
cd d:\小程序\图库插件聚合网站!!!\showcase-site

# 3. 登录（如已登录可跳过）
vercel login

# 4. 部署（按提示操作）
vercel

# 5. 生产环境部署
vercel --prod
```

Vercel 会给你一个免费域名，例如：`your-project.vercel.app`

**域名绑定：** 在 Vercel Dashboard → 项目 → Settings → Domains 添加你的域名（如 `autophoto.site`）。

---

### Cloudflare Pages（完全免费，CDN全球加速）

```bash
# 安装 Wrangler CLI
npm install -g wrangler

cd showcase-site
wrangler pages deploy .
```

Cloudflare Pages 完全免费，支持自定义域名，无流量限制。

---

## 方案二：前端静态 + 后端 Node.js（支持虎皮椒支付）

### 步骤1：前端部署到 Vercel

同上，用 Vercel CLI 部署 `showcase-site/` 目录。

### 步骤2：后端部署到 Railway 或 Render

推荐 **Railway**（有免费额度，操作最简单）：

1. 注册 [railway.app](https://railway.app)
2. New Project → Deploy from GitHub（或直接上传）
3. 上传 `server/` 目录
4. 设置环境变量（.env 内容）
5. 获得后端 URL，例如：`https://autophoto-server.up.railway.app`

### 步骤3：修改前端 API 地址

在后端部署好后，修改前端的 API 地址：

编辑 `buy.html`，找到：
```javascript
fetch('/api/create-order', {
```

改为：
```javascript
fetch('https://your-backend.railway.app/api/create-order', {
```

同样修改 `pricing.html` 和 `about.html` 中的 API 调用。

### 步骤4：配置虎皮椒

在虎皮椒后台设置回调地址：
```
https://your-backend.railway.app/xunhupay/callback
```

---

## 方案三：Vercel 前端 + Railway 后端（推荐生产方案）

| 层级 | 工具 | 费用 | 说明 |
|-----|------|------|------|
| 前端 | Vercel | 免费 | 静态网站，全球CDN |
| 后端 | Railway | 免费额度 | Node.js支付处理 |
| 邮件 | QQ邮箱SMTP | 免费 | 发授权码 |
| 域名 | 腾讯云 | ¥29/年 | .cn域名 |
| 图床/CDN | B站/Cloudflare | 免费 | 视频/图片托管 |

---

## 虎皮椒注册与配置

### 1. 注册虎皮椒

访问：**https://admin.xunhupay.com**

支持个人注册，无需营业执照！只需：
- 身份证实名认证
- 银行卡收款

### 2. 创建应用

登录后 → 应用管理 → 创建应用：
- 应用名称：AutoPhoto
- 应用类型：Chrome插件 / 软件销售

### 3. 获取密钥

应用详情页：
- **App ID**（应用ID）
- **App Secret**（应用密钥）

### 4. 配置支付通道

开通支付方式：
- ✅ 微信支付
- ✅ 支付宝
- ✅ QQ钱包

### 5. 设置回调地址

支付设置 → 回调地址：
```
https://your-backend.railway.app/xunhupay/callback
```

### 6. 前端对接

用户点击"购买" → 前端调用 `/api/create-order` → 获得虎皮椒支付链接 → 跳转支付 → 回调处理 → 邮件发码

---

## 域名推荐

| 域名 | 价格 | 状态 | 推荐度 |
|------|------|------|-------|
| autophoto.site | ~¥29/年 | ✅ 可注册 | ⭐⭐⭐⭐⭐ |
| picsubmit.site | ~¥29/年 | ✅ 可注册 | ⭐⭐⭐⭐ |
| stocktools.site | ~¥29/年 | ✅ 可注册 | ⭐⭐⭐ |
| autophoto.shop | ~¥35/年 | ✅ 可注册 | ⭐⭐⭐⭐ |

> ⚠️ 注意：`.tools` 和 `.cn` 在国内注册商不一定都有，优先选择 `.site` 或 `.shop`，便宜且好记。

注册地址：[腾讯云域名注册](https://buy.cloud.tencent.com/domain)

---

## 本地测试

```bash
cd showcase-site/server
npm install

# 复制配置
copy .env.example .env
# 编辑 .env 填入实际值

# 启动服务
node server.js
```

访问 `http://localhost:3000` 即可看到网站。

---

## 常见问题

**Q: 支付成功了但没收到授权码？**
A: 检查邮件发送是否正常，控制台会打印授权码。先联系微信 `auto_photo2025` 手动发码。

**Q: 虎皮椒手续费多少？**
A: 微信/支付宝 ~0.6% 手续费（最低0.6元/笔），用户承担。QQ钱包更低。

**Q: 可以不用后端吗？**
A: 展示网站完全可以纯静态，但支付回调必须走后端，否则无法自动发码。
