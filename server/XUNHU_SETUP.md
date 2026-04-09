# AutoPhoto 虎皮椒 + 邮件接入指南

## 一、整体架构

```
客户浏览器
   ↓ 购买页面 buy.html
   ↓ POST /api/create-order
后端服务 (Railway Node.js)
   ↓ 调用虎皮椒 API
虎皮椒（微信/支付宝收款）
   ↓ 支付成功后回调 POST /xunhupay/callback
后端 → 生成授权码 → 发送邮件给客户
   ↓ 跳转 success.html
```

---

## 二、第一步：注册虎皮椒

### 2.1 注册账号

访问：**https://admin.xunhupay.com**

支持**个人身份证**注册，无需营业执照。需要：
- 大陆身份证（实名认证）
- 银行卡（用于收款提现）

### 2.2 创建应用

登录后 → **应用管理** → **创建应用**

```
应用名称：AutoPhoto 图库插件
应用类型：Chrome 插件 / 软件销售
```

### 2.3 获取密钥

进入应用详情页，复制：
- **App ID**：类似 `APP2023xxxxxx`
- **App Secret**：长字符串

这两个要填到 Railway 环境变量里。

### 2.4 开通支付渠道

应用设置 → **支付渠道** → 开通：
- ✅ 微信支付（H5）
- ✅ 支付宝（H5）

---

## 三、第二步：配置 QQ 邮箱 SMTP

授权码不是 QQ 密码，是独立生成的。

### 3.1 开启 SMTP 服务

1. 登录 **mail.qq.com**
2. **设置** → **账户**
3. 找到 **POP3/SMTP服务** → 开启
4. 按提示发短信验证
5. 获取 **16位授权码**（格式如 `abcdefghijklmnop`）

⚠️ 授权码只显示一次，请保存好！

### 3.2 测试邮件

后端部署后，用这个授权码测试能不能发邮件。

---

## 四、第三步：部署后端到 Railway

### 4.1 注册 Railway

访问：**https://railway.app**
推荐用 **GitHub 账号登录**

### 4.2 创建项目

1. Railway Dashboard → **New Project**
2. 选择 **Deploy from GitHub repo**
3. 如果没有现成仓库：
   - 点 **Empty Project**
   - 稍后手动上传代码压缩包

### 4.3 上传代码

**方法一：GitHub 仓库（推荐）**

在 GitHub 新建仓库 `autophoto-backend`，只放 `server/` 目录内容：
```
autophoto-backend/
├── server.js
├── package.json
├── Railway.toml
└── public/
    └── success.html
```

然后 Railway → New Project → Deploy from GitHub → 选择这个仓库

**方法二：直接上传（Railway 支持 zip 上传）**

1. 打包 `server/` 目录为 zip
2. Railway → New Project → Upload ZIP

### 4.4 设置环境变量

Railway 项目 → **Variables** → 添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `XUNHU_APP_ID` | `APP2023xxxxxx` | 虎皮椒 App ID |
| `XUNHU_APP_SECRET` | `你的虎皮椒密钥` | 虎皮椒 App Secret |
| `XUNHU_RETURN_URL` | `https://autophoto.store` | 支付成功后跳转 |
| `SMTP_HOST` | `smtp.qq.com` | QQ 邮箱 SMTP |
| `SMTP_PORT` | `465` | SMTP 端口 |
| `SMTP_USER` | `541163318@qq.com` | 你的 QQ 邮箱 |
| `SMTP_PASS` | `刚刚获取的授权码` | QQ 邮箱授权码 |
| `ADMIN_EMAIL` | `tourinn@gmail.com` | 收到新订单通知 |

### 4.5 设置回调地址（重要！）

Railway 部署完成后，你会得到一个 URL，类似：

```
https://autophoto-api.up.railway.app
```

复制这个 URL，然后去 **虎皮椒后台**：

**应用设置** → **支付设置** → **回调地址**，填入：

```
https://你的railway地址/xunhupay/callback
```

例如：`https://autophoto-api.up.railway.app/xunhupay/callback`

### 4.6 验证后端是否正常

访问：`https://你的railway地址/api/health`

应该返回：
```json
{"status":"ok","time":"2026-..."}
```

---

## 五、第四步：连接前端到后端

### 5.1 更新 buy.html

Railway 部署成功并拿到 URL 后，编辑 `buy.html`，找到这行：

```javascript
const API_BASE = window.API_BASE || '';
```

改为：

```javascript
const API_BASE = 'https://你的railway地址';
```

例如：

```javascript
const API_BASE = 'https://autophoto-api.up.railway.app';
```

### 5.2 重新部署前端

修改后重新执行：

```bash
cd d:\小程序\图库插件聚合网站!!!\showcase-site
npx vercel --prod --yes --force
```

---

## 六、第五步：用 ¥0.01 测试整个流程

现在可以用调试测试套餐跑通全流程：

1. 打开 **https://autophoto.store/buy.html**
2. 选择任意插件
3. 选择 **🔧 调试测试 ¥0.01**
4. 填写邮箱 `541163318@qq.com`
5. 点**前往支付**
6. 扫码支付 ¥0.01
7. 观察：
   - 是否跳转到虎皮椒
   - 虎皮椒回调是否成功
   - 邮箱是否收到授权码

### 测试检查清单

| 检查项 | 预期结果 |
|--------|---------|
| 点击支付后跳转虎皮椒 | ✅ 跳转到微信/支付宝 |
| 支付成功页面跳转回来 | ✅ 回到 success.html |
| 邮箱收到授权码 | ✅ 收到 HTML 格式邮件 |
| 邮件内容正确 | ✅ 有插件名、授权码、使用说明 |
| 管理员邮箱收到通知 | ✅ 你自己的邮箱也收到订单通知 |

---

## 七、完整流程回顾

```
客户购买流程：
1. 访问 autophoto.store → buy.html
2. 选插件 + 套餐 + 填邮箱
3. 点击"前往支付"
4. → Railway API /api/create-order
5. → 虎皮椒下单，返回支付链接
6. ← 跳转到虎皮椒（微信/支付宝）
7. 客户扫码支付
8. 虎皮椒 → POST /xunhupay/callback
9. Railway 生成授权码
10. Railway 发邮件到客户邮箱
11. ← 重定向到 success.html
```

---

## 八、虎皮椒手续费

- **微信支付 H5**：0.6% + ¥0.6/笔
- **支付宝 H5**：0.6% + ¥0.6/笔
- **最低 0.6 元/笔**（所以 ¥0.01 测试支付虎皮椒会收 ¥0.6 手续费，实际到账约 ¥0）

⚠️ **建议**：¥0.01 测试只跑一次验证流程，正式使用从 ¥9.9 试用开始。

---

## 九、常见问题

**Q: 支付成功了但没收到邮件？**
A: 检查 Railway 日志（Railway → Deployments → 查看日志），看回调是否成功、邮件发送是否有错误。也可能进垃圾箱。

**Q: 回调地址填错了？**
A: 随时可以到虎皮椒后台修改回调地址。

**Q: Railway 免费额度够用吗？**
A: 每月 $5 免费额度，个人小规模使用绑绑够。500小时/月运行时间。

**Q: 演示模式是什么？**
A: 如果没有填虎皮椒的 App ID/Secret，后端会直接生成授权码（不走支付），用于本地测试。

**Q: 怎么让虎皮椒通知发到我的网站？**
A: Railway 部署后，在虎皮椒后台设置回调 URL 为 `https://你的railway地址/xunhupay/callback`

---

## 十、一旦配置完成，完整流程自动运行

- ✅ 客户付款 → 自动发邮件（无需手动操作）
- ✅ 新订单通知到你的管理员邮箱
- ✅ 演示/调试模式本地可用
