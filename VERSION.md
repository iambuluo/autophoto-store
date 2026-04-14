# AutoPhoto Store - Version welldone v1.0

**版本号：** welldone v1.0  
**发布日期：** 2026-04-11  
**状态：** ✅ 测试通过

---

## 功能特性

### 购买流程
- ✅ 插件选择（7个插件）
- ✅ 授权类型选择（测试/试用/年度/永久）
- ✅ 用户信息表单（姓名、邮箱）
- ✅ API 订单创建
- ✅ 授权码生成

### 授权码格式
```
AP-{插件前缀}-{方案字符}{到期时间B36}-{随机hex}
```
示例：`AP-QY-TTDD95E-C2BF6252C91E`

### 支持的插件
| 插件ID | 前缀 | 名称 |
|--------|------|------|
| qingying-image | QY | 清影批量生图助手 |
| qingying-video | QV | 清影批量生视频助手 |
| shijuezhongguo | VCG | 视觉中国自动提交 |
| guangchang | VJ | 光厂批量提交助手 |
| xinchangchang | XC | 新片场 AIGC 助手 |
| dreamstime | DT | Dreamstime 自动提交 |
| adobe-stock | AS | Adobe Stock 关键词点击器 |

---

## 测试页面

- 购买流程测试：https://autophoto-store.vercel.app/test-buy-flow.html
- API 测试：https://autophoto-store.vercel.app/api/order-test

---

## 技术栈

- 前端：HTML + CSS + JavaScript
- 后端：Vercel Serverless Functions (Node.js)
- 部署：Vercel + GitHub

---

## 注意事项

1. 当前为测试模式，订单号以 `TEST_` 开头
2. 授权码有效期：测试/试用 = 1天，年度 = 365天，永久 = 99年
3. 零依赖设计，所有配置内联在 API 文件中

---

## 后续计划

- [ ] 集成虎皮椒真实支付
- [ ] 添加邮件发送功能（Resend）
- [ ] 订单状态查询
- [ ] 授权码验证 API
