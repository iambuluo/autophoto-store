// AutoPhoto.store — 中英双语切换
(function() {
  const translations = {
    zh: {
      'pageTitle': 'AutoPhoto · 图库插件全家桶 — 自动化上传·省时高效',
      'nav.home': '首页', 'nav.plugins': '插件', 'nav.pricing': '定价',
      'nav.about': '关于', 'nav.buy': '立即购买',
      'hero.badge': '🔥 限时活动 · 全家桶7个插件仅¥1,397（5折）',
      'hero.title': '图库创作者的<br><span class="gradient-text">效率革命工具箱</span>',
      'hero.sub': '7款Chrome插件，覆盖视觉中国、新片场、光厂、Dreamstime、Adobe Stock 等主流图库平台。<br class="hide-mobile">一键自动填写信息 · 一键批量提交 · 让你把时间花在真正重要的事情上',
      'hero.cta1': '🛒 了解价格与套餐', 'hero.cta2': '📦 查看全部插件 →',
      'hero.stat1': '款插件，覆盖7大平台', 'hero.stat2': '活跃用户',
      'hero.stat3': '上传时间节省', 'hero.stat4': '用户平均评分',
      'pain.title': '手动上传的痛苦，你一定懂',
      'pain.sub': '把时间浪费在重复劳动上，还是专注于创作本身？',
      'pain.card1.title': '手动填写 · 信息重复',
      'pain.card1.desc': '图库名称、关键词、描述，每个平台都要填一遍。标签重复度高，纯体力劳动。',
      'pain.card2.title': '效率极低 · 耗时耗力',
      'pain.card2.desc': '上传100张图，手动填写需要数小时。同一张图的信息要复制粘贴 N 次。',
      'pain.card3.title': '多平台管理 · 混乱出错',
      'pain.card3.desc': '7个平台，7套规则，7个账号。登录切换、规则记忆让人崩溃。',
      'pain.arrow': '↓ 用 AutoPhoto 全部解决 ↓',
      'plugins.title': '7款插件 · 覆盖7大主流图库平台',
      'plugins.sub': '每个插件专为对应平台优化，安装即用。支持 Chrome 浏览器（Edge/360均可）。',
      'common.viewDetail': '查看详情 →',
      'plugins.vcg.badge': '🔥 最受欢迎',
      'plugins.vcg.name': '视觉中国自动提交', 'plugins.vcg.name2': '视觉中国自动提交',
      'plugins.vcg.desc': '导入 Excel 批量处理图片信息，按文件名自动匹配，一键填写标题和关键词，随机延迟模拟人工防检测。',
      'plugins.vcg.f1': '✅ Excel 导入批量匹配图片', 'plugins.vcg.f2': '✅ 自动填写标题 + 关键词',
      'plugins.vcg.f3': '✅ 自动点击平台推荐关键词', 'plugins.vcg.f4': '✅ 随机延迟防机器检测',
      'plugins.vcg.priceY': '¥199/年', 'plugins.vcg.priceP': '¥399永久',
      'plugins.vj.badge': '✨ 新上架',
      'plugins.vj.name': '光厂批量提交助手', 'plugins.vj.name2': '光厂批量提交助手',
      'plugins.vj.desc': '专为 VJshi 光厂批量编辑页打造，自动点击 AI 推荐标题、填写创作时间、批量添加最多30个 AI 关键词，支持一键提交。',
      'plugins.vj.f1': '✅ 自动点击 AI 推荐标题', 'plugins.vj.f2': '✅ 自动填写创作时间',
      'plugins.vj.f3': '✅ 批量添加 AI 关键词（最多30个）', 'plugins.vj.f4': '✅ 支持4K/60帧特殊标签追加',
      'plugins.vj.priceY': '¥199/年', 'plugins.vj.priceP': '¥399永久',
      'plugins.xc.name': '新片场 AIGC 助手', 'plugins.xc.name2': '新片场 AIGC 助手',
      'plugins.xc.desc': '读取 Excel 数据，通过 CDP 协议模拟真实键鼠输入，自动填写图片标题和关键词，并自动在提交请求中标记 AI 内容。',
      'plugins.xc.f1': '✅ Excel 导入，按文件名匹配逐图填写', 'plugins.xc.f2': '✅ 模拟真实键盘输入，绕过检测',
      'plugins.xc.f3': '✅ 自动标记 AI 内容（is_ai 字段）', 'plugins.xc.f4': '✅ 实时日志显示处理进度',
      'plugins.xc.priceY': '¥199/年', 'plugins.xc.priceP': '¥399永久',
      'plugins.dt.name': 'Dreamstime 自动提交', 'plugins.dt.name2': 'Dreamstime 自动提交',
      'plugins.dt.desc': '在 Dreamstime 上传编辑页注入悬浮控制面板，检测描述填写完成后自动点击提交按钮，支持 AI 图片分类标记和随机延迟。',
      'plugins.dt.f1': '✅ 页面悬浮面板，一键开始/停止', 'plugins.dt.f2': '✅ 检测描述完成后自动提交',
      'plugins.dt.f3': '✅ AI 图片自动分类标记', 'plugins.dt.f4': '✅ 随机等待延迟，页面刷新后自动恢复',
      'plugins.dt.priceY': '¥199/年', 'plugins.dt.priceP': '¥399永久',
      'plugins.as.badge': '🚀 专业版',
      'plugins.as.name': 'Adobe Stock 关键词点击器', 'plugins.as.name2': 'Adobe Stock 关键词点击器',
      'plugins.as.desc': 'Adobe Stock 上传页专用，自动识别 Keyword Suggestions 区域，穿透 Shadow DOM 逐一点击关键词添加按钮，支持批量遍历多图。',
      'plugins.as.f1': '✅ 自动点击全部推荐关键词（最多50个）', 'plugins.as.f2': '✅ 穿透 Shadow DOM，兼容 Adobe 组件',
      'plugins.as.f3': '✅ 批量遍历多张图片逐一处理', 'plugins.as.f4': '✅ 钉钉 Webhook 实时通知',
      'plugins.as.priceY': '¥199/年', 'plugins.as.priceP': '¥399永久',
      'plugins.qy.name': '清影批量生图助手', 'plugins.qy.name2': '清影批量生图',
      'plugins.qy.desc': '在质谱清言（ChatGLM）批量输入提示词自动生成图片，自动开启去水印开关，依次点击缩略图触发高清下载，支持 VIP 4K 超清。',
      'plugins.qy.f1': '✅ 批量提示词队列（支持Excel/TXT导入）', 'plugins.qy.f2': '✅ 自动开启去水印开关',
      'plugins.qy.f3': '✅ 生成完毕自动下载无水印高清图', 'plugins.qy.f4': '✅ 断点续传，刷新后自动恢复任务',
      'plugins.qy.priceY': '¥199/年', 'plugins.qy.priceP': '¥399永久',
      'plugins.qv.badge': '✨ 新功能',
      'plugins.qv.name': '清影批量生视频助手', 'plugins.qv.name2': '清影批量生视频',
      'plugins.qv.desc': '在清影视频页注入悬浮控制面板，批量提交视频提示词（最多4个并发），监控生成完成后自动下载，任务状态12小时内可恢复。',
      'plugins.qv.f1': '✅ 批量视频任务队列（最多4并发）', 'plugins.qv.f2': '✅ 悬浮面板实时显示进度',
      'plugins.qv.f3': '✅ 生成完毕自动触发下载', 'plugins.qv.f4': '✅ 任务状态持久化，关闭可恢复',
      'plugins.qv.priceY': '¥199/年', 'plugins.qv.priceP': '¥399永久',
      'pricing.title': '简单透明的定价',
      'pricing.sub': '买得越多，省得越多。全家桶7个插件仅¥1,397，相当于每个¥199永久拿下！',
      'pricing.table.col1': '购买数量', 'pricing.table.col2': '折扣',
      'pricing.table.col3': '年付均价/插件', 'pricing.table.col4': '永久均价/插件',
      'pricing.table.row1': '1个插件', 'pricing.table.row2': '2个插件',
      'pricing.table.row3': '3个插件', 'pricing.table.row4': '4个插件',
      'pricing.table.row5': '5-6个插件', 'pricing.table.row7': '7个全家桶',
      'pricing.table.discount0': '原价', 'pricing.table.discount1': '88折',
      'pricing.table.discount2': '8折', 'pricing.table.discount3': '7折',
      'pricing.table.discount4': '6折', 'pricing.table.discount5': '5折',
      'pricing.viewAll': '查看完整定价方案 →',
      'testimonials.title': '真实用户评价',
      'testimonials.c1.text': '"光厂批量提交插件太牛了！以前上传100张图要花2小时，现在10分钟搞定，还能批量填写关键词，省了太多时间！"',
      'testimonials.c1.author': '— 张先生，摄影师，图库兼职创作者',
      'testimonials.c2.text': '"新片场AIGC助手解决了AI生成图片提交图库的大难题。自动提取参数，一键填写，太方便了！"',
      'testimonials.c2.author': '— 李女士，AIGC创作者',
      'testimonials.c3.text': '"视觉中国插件一直很稳定，客服响应也快。永久授权399元买断，非常值。已经推荐给工作室的朋友们了。"',
      'testimonials.c3.author': '— 王先生，专业图库摄影师',
      'faq.title': '常见问题',
      'faq.q1.q': 'Q: 这些插件只能在Chrome上用吗？',
      'faq.q1.a': '支持 Chrome、Edge、360浏览器、百分浏览器等所有 Chromium 内核浏览器。',
      'faq.q2.q': 'Q: 购买后如何使用？有教学吗？',
      'faq.q2.a': '购买后自动发送授权码+安装教程。每个插件页面也有详细使用说明，B站也有视频教程。',
      'faq.q3.q': 'Q: 试用期怎么算？',
      'faq.q3.a': '每个插件支持1天试用（¥9.9），满意后再购买年付或永久授权。',
      'faq.q4.q': 'Q: 支持退款吗？',
      'faq.q4.a': '数字商品一经授权激活不支持退款，未激活可协商退款。质量问题我们100%负责。',
      'faq.q5.q': 'Q: 一个授权码可以多台电脑用吗？',
      'faq.q5.a': '每个授权码绑定一台设备。如需换设备，可联系客服解绑（每年限2次）。',
      'faq.q6.q': 'Q: 支持微信/支付宝付款吗？',
      'faq.q6.a': '支持的！我们接入了虎皮椒支付，支持微信、支付宝、QQ钱包等多种支付方式。',
      'footer.desc': '专注图库创作者效率工具，7款插件累计服务2000+用户。',
      'footer.contact': '📧 tourinn@gmail.com<br>💬 微信：auto_photo2025',
      'footer.products': '插件产品', 'footer.support': '支持',
      'footer.faq': '常见问题',
      'footer.copyright': '© 2026 AutoPhoto.store · 用心做好每一个插件',
      // buy page
      'buy.title': '购买插件授权',
      'buy.subtitle': '选择插件 + 选择方案 → 扫码付款 → 立刻收到授权码',
      'buy.step1': '第一步：选择插件',
      'buy.step2': '第二步：选择方案',
      'buy.plan.trial': '1天试用', 'buy.plan.trial.price': '¥9.9',
      'buy.plan.annual': '年付365天', 'buy.plan.annual.price': '¥199',
      'buy.plan.permanent': '永久买断', 'buy.plan.permanent.price': '¥399',
      'buy.total': '合计',
      'buy.email.label': '邮箱（收授权码用）',
      'buy.email.placeholder': '请输入邮箱',
      'buy.submit': '立即支付',
      'buy.secure': '🔒 安全支付 · 支付后授权码实时发送到邮箱',
      // success page
      'success.title': '支付成功！',
      'success.desc': '授权码已发送到您的邮箱，请注意查收。',
      'success.code.label': '您的授权码',
      'success.back': '返回首页',
      // about page
      'about.title': '关于 AutoPhoto',
      'about.mission': '我们的使命',
    },
    en: {
      'pageTitle': 'AutoPhoto · Stock Photo Plugin Suite — Automate Upload · Save Time',
      'nav.home': 'Home', 'nav.plugins': 'Plugins', 'nav.pricing': 'Pricing',
      'nav.about': 'About', 'nav.buy': 'Buy Now',
      'hero.badge': '🔥 Limited Time · Full Suite of 7 Plugins — Save 50%',
      'hero.title': 'The <span class="gradient-text">Efficiency Toolkit</span><br>for Stock Photo Creators',
      'hero.sub': '7 Chrome extensions covering Visual China, Xinchangchang, Guang Chang, Dreamstime, Adobe Stock and more.<br class="hide-mobile">Auto-fill metadata · Batch submit · Focus on what really matters — creating.',
      'hero.cta1': '🛒 View Pricing & Plans', 'hero.cta2': '📦 Browse All Plugins →',
      'hero.stat1': 'Plugins · 7 Platforms', 'hero.stat2': 'Active Users',
      'hero.stat3': 'Upload Time Saved', 'hero.stat4': 'Avg. User Rating',
      'pain.title': 'You Know the Pain of Manual Uploading',
      'pain.sub': 'Stop wasting hours on repetitive tasks. Focus on creating.',
      'pain.card1.title': 'Manual Entry · Endless Repetition',
      'pain.card1.desc': 'Title, keywords, description — fill them in again and again for every platform. Pure busywork.',
      'pain.card2.title': 'Extremely Slow · Hours Wasted',
      'pain.card2.desc': 'Uploading 100 images by hand takes hours. Copy-paste the same info over and over.',
      'pain.card3.title': 'Multi-Platform Chaos · Constant Errors',
      'pain.card3.desc': '7 platforms, 7 rule sets, 7 accounts. Switching logins and remembering rules drives you crazy.',
      'pain.arrow': '↓ AutoPhoto Solves All of This ↓',
      'plugins.title': '7 Plugins · Covering 7 Major Stock Platforms',
      'plugins.sub': 'Each plugin is optimized for its platform. Install and run. Works in Chrome, Edge, and all Chromium browsers.',
      'common.viewDetail': 'View Details →',
      'plugins.vcg.badge': '🔥 Most Popular',
      'plugins.vcg.name': 'Visual China Auto Submit', 'plugins.vcg.name2': 'Visual China Auto Submit',
      'plugins.vcg.desc': 'Import Excel to batch-process image metadata, auto-match by filename, fill titles & keywords with one click, random delay to avoid bot detection.',
      'plugins.vcg.f1': '✅ Excel import batch matching', 'plugins.vcg.f2': '✅ Auto-fill title + keywords',
      'plugins.vcg.f3': '✅ Auto-click platform keyword suggestions', 'plugins.vcg.f4': '✅ Random delay anti-bot detection',
      'plugins.vcg.priceY': '$29/year', 'plugins.vcg.priceP': '$69 lifetime',
      'plugins.vj.badge': '✨ New',
      'plugins.vj.name': 'Guang Chang Batch Submit', 'plugins.vj.name2': 'Guang Chang Batch Submit',
      'plugins.vj.desc': 'Built for VJshi Guang Chang bulk edit page. Auto-click AI suggested titles, fill creation time, batch-add up to 30 AI keywords, one-click submit.',
      'plugins.vj.f1': '✅ Auto-click AI suggested titles', 'plugins.vj.f2': '✅ Auto-fill creation time',
      'plugins.vj.f3': '✅ Batch add AI keywords (up to 30)', 'plugins.vj.f4': '✅ Support 4K/60fps special tag appending',
      'plugins.vj.priceY': '$29/year', 'plugins.vj.priceP': '$69 lifetime',
      'plugins.xc.name': 'Xinchangchang AIGC Assistant', 'plugins.xc.name2': 'Xinchangchang AIGC Assistant',
      'plugins.xc.desc': 'Reads Excel data, simulates real keyboard/mouse input via CDP protocol, auto-fills image titles and keywords, marks AI-generated content in submissions.',
      'plugins.xc.f1': '✅ Excel import, match by filename', 'plugins.xc.f2': '✅ Simulates real keyboard input, bypasses detection',
      'plugins.xc.f3': '✅ Auto-marks AI content (is_ai field)', 'plugins.xc.f4': '✅ Real-time progress log',
      'plugins.xc.priceY': '$29/year', 'plugins.xc.priceP': '$69 lifetime',
      'plugins.dt.name': 'Dreamstime Auto Submit', 'plugins.dt.name2': 'Dreamstime Auto Submit',
      'plugins.dt.desc': 'Injects a floating control panel into Dreamstime upload pages. Detects when descriptions are complete and auto-clicks submit, with AI image categorization and random delays.',
      'plugins.dt.f1': '✅ Floating panel, one-click start/stop', 'plugins.dt.f2': '✅ Auto-submit when description is complete',
      'plugins.dt.f3': '✅ AI image auto-categorization', 'plugins.dt.f4': '✅ Random delay, auto-resume after page refresh',
      'plugins.dt.priceY': '$29/year', 'plugins.dt.priceP': '$69 lifetime',
      'plugins.as.badge': '🚀 Pro',
      'plugins.as.name': 'Adobe Stock Keyword Clicker', 'plugins.as.name2': 'Adobe Stock Keyword Clicker',
      'plugins.as.desc': 'Purpose-built for Adobe Stock upload pages. Auto-identifies Keyword Suggestions area, pierces Shadow DOM to click keyword add buttons, supports batch processing.',
      'plugins.as.f1': '✅ Auto-click all suggested keywords (up to 50)', 'plugins.as.f2': '✅ Pierces Shadow DOM, fully compatible',
      'plugins.as.f3': '✅ Batch process multiple images', 'plugins.as.f4': '✅ DingTalk Webhook real-time notifications',
      'plugins.as.priceY': '$29/year', 'plugins.as.priceP': '$69 lifetime',
      'plugins.qy.name': 'Qingying Batch Image Generator', 'plugins.qy.name2': 'Qingying Batch Image Gen',
      'plugins.qy.desc': 'Batch-input prompts into Qingying (ChatGLM) to auto-generate images, auto-enable watermark removal, click thumbnails for HD download. Supports VIP 4K ultra-HD.',
      'plugins.qy.f1': '✅ Batch prompt queue (Excel/TXT import)', 'plugins.qy.f2': '✅ Auto-enable watermark removal',
      'plugins.qy.f3': '✅ Auto-download watermark-free HD images', 'plugins.qy.f4': '✅ Resume on page refresh',
      'plugins.qy.priceY': '$29/year', 'plugins.qy.priceP': '$69 lifetime',
      'plugins.qv.badge': '✨ New Feature',
      'plugins.qv.name': 'Qingying Batch Video Generator', 'plugins.qv.name2': 'Qingying Batch Video Gen',
      'plugins.qv.desc': 'Injects a floating panel into Qingying video pages. Batch-submit video prompts (up to 4 concurrent), auto-download when generation completes. State recoverable within 12h.',
      'plugins.qv.f1': '✅ Batch video task queue (4 concurrent)', 'plugins.qv.f2': '✅ Floating panel with real-time progress',
      'plugins.qv.f3': '✅ Auto-trigger download on completion', 'plugins.qv.f4': '✅ Persistent task state, resumable after close',
      'plugins.qv.priceY': '$29/year', 'plugins.qv.priceP': '$69 lifetime',
      'pricing.title': 'Simple, Transparent Pricing',
      'pricing.sub': 'The more you buy, the more you save. Full 7-plugin suite at just $199 — that\'s $29 each for lifetime access!',
      'pricing.table.col1': 'Quantity', 'pricing.table.col2': 'Discount',
      'pricing.table.col3': 'Annual / Plugin', 'pricing.table.col4': 'Lifetime / Plugin',
      'pricing.table.row1': '1 Plugin', 'pricing.table.row2': '2 Plugins',
      'pricing.table.row3': '3 Plugins', 'pricing.table.row4': '4 Plugins',
      'pricing.table.row5': '5–6 Plugins', 'pricing.table.row7': 'Full Suite (7)',
      'pricing.table.discount0': 'Full Price', 'pricing.table.discount1': '12% off',
      'pricing.table.discount2': '20% off', 'pricing.table.discount3': '30% off',
      'pricing.table.discount4': '40% off', 'pricing.table.discount5': '50% off',
      'pricing.viewAll': 'View Full Pricing Plans →',
      'testimonials.title': 'What Our Users Say',
      'testimonials.c1.text': '"The Guang Chang batch plugin is amazing! Uploading 100 images used to take 2 hours — now it\'s done in 10 minutes with all keywords filled. Huge time saver!"',
      'testimonials.c1.author': '— Zhang, Photographer & Stock Creator',
      'testimonials.c2.text': '"The Xinchangchang AIGC assistant solved the hardest part of submitting AI images. Auto-extract params, one-click fill. So convenient!"',
      'testimonials.c2.author': '— Li, AIGC Creator',
      'testimonials.c3.text': '"The Visual China plugin is rock solid and support responds fast. ¥399 lifetime — totally worth it. Already recommended it to everyone in my studio."',
      'testimonials.c3.author': '— Wang, Professional Stock Photographer',
      'faq.title': 'Frequently Asked Questions',
      'faq.q1.q': 'Q: Do these plugins only work in Chrome?',
      'faq.q1.a': 'They work in Chrome, Edge, 360 Browser, and all Chromium-based browsers.',
      'faq.q2.q': 'Q: How do I use them after purchasing? Is there a tutorial?',
      'faq.q2.a': 'After purchase, your license key + installation guide is sent to your email automatically. Detailed docs are on each plugin page.',
      'faq.q3.q': 'Q: How does the trial work?',
      'faq.q3.a': 'Each plugin offers a 1-day trial for ¥9.9 ($1.5). Upgrade to annual or lifetime after you\'re satisfied.',
      'faq.q4.q': 'Q: Can I get a refund?',
      'faq.q4.a': 'Activated license keys are non-refundable. Unactivated keys can be refunded on request. Quality issues are 100% covered.',
      'faq.q5.q': 'Q: Can I use one license on multiple computers?',
      'faq.q5.a': 'Each license is bound to one device. Contact support to transfer (up to 2 transfers per year).',
      'faq.q6.q': 'Q: What payment methods are accepted?',
      'faq.q6.a': 'We accept credit/debit cards, PayPal, and international payment methods via Stripe (coming soon).',
      'footer.desc': 'Efficiency tools for stock photo creators. 7 plugins serving 2,000+ users.',
      'footer.contact': '📧 tourinn@gmail.com<br>💬 WeChat: auto_photo2025',
      'footer.products': 'Plugins', 'footer.support': 'Support',
      'footer.faq': 'FAQ',
      'footer.copyright': '© 2026 AutoPhoto.store · Crafted with care for every plugin',
      // buy page
      'buy.title': 'Purchase Plugin License',
      'buy.subtitle': 'Select Plugin + Choose Plan → Pay → Get License Key Instantly',
      'buy.step1': 'Step 1: Select Plugin(s)',
      'buy.step2': 'Step 2: Choose Plan',
      'buy.plan.trial': '1-Day Trial', 'buy.plan.trial.price': '$1.5',
      'buy.plan.annual': 'Annual (365 days)', 'buy.plan.annual.price': '$29',
      'buy.plan.permanent': 'Lifetime', 'buy.plan.permanent.price': '$69',
      'buy.total': 'Total',
      'buy.email.label': 'Email (for license delivery)',
      'buy.email.placeholder': 'Enter your email',
      'buy.submit': 'Pay Now',
      'buy.secure': '🔒 Secure Payment · License key sent to email instantly after payment',
      // success page
      'success.title': 'Payment Successful!',
      'success.desc': 'Your license key has been sent to your email. Please check your inbox.',
      'success.code.label': 'Your License Key',
      'success.back': 'Back to Home',
      // about page
      'about.title': 'About AutoPhoto',
      'about.mission': 'Our Mission',
    }
  };

  let currentLang = localStorage.getItem('ap_lang') || 'zh';

  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem('ap_lang', lang);
    const t = translations[lang];
    if (!t) return;

    // 更新 html lang 属性
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

    // 更新 page title
    if (t['pageTitle']) document.title = t['pageTitle'];

    // 更新所有 data-i18n 元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key] !== undefined) {
        el.innerHTML = t[key];
      }
    });

    // 更新价格行（特殊处理：英文用 $，中文用 ¥）
    updatePricingTable(lang);

    // 更新语言按钮状态
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  function updatePricingTable(lang) {
    // pricing.html 的价格表动态替换
    const priceMap = {
      zh: { annual: '¥199', lifetime: '¥399', trial: '¥9.9', bundle: '¥1,397' },
      en: { annual: '$29', lifetime: '$69', trial: '$1.5', bundle: '$199' }
    };
    const p = priceMap[lang];

    // 替换所有价格标签中的金额（精确匹配常见格式）
    document.querySelectorAll('.price-tag').forEach(el => {
      const text = el.textContent.trim();
      if (/^[¥$]1[\d,]+/.test(text)) {
        el.innerHTML = lang === 'zh' ? '¥1,397<small>/全家桶</small>' : '$199<small>/full suite</small>';
      } else if (text.includes('¥399') || text.includes('$69')) {
        el.innerHTML = p.lifetime + (lang === 'zh' ? '永久' : ' lifetime');
      } else if (text.includes('¥199') || text.includes('$29')) {
        el.innerHTML = p.annual + (lang === 'zh' ? '/年' : '/year');
      } else if (text.includes('¥9.9') || text.includes('$1.5')) {
        el.innerHTML = p.trial + (lang === 'zh' ? '/天试用' : ' trial');
      }
    });

    // 更新 pmt-row 中的价格列
    document.querySelectorAll('.pmt-row:not(.pmt-head)').forEach(row => {
      const cells = row.querySelectorAll('span');
      // row 结构：数量 | 折扣 | 年付 | 永久
      if (cells.length >= 4) {
        const annualPrices = {
          zh: ['¥199','¥175','¥159','¥139','¥119','¥99/插件'],
          en: ['$29','$25','$23','$20','$17','$14/plugin']
        };
        const lifetimePrices = {
          zh: ['¥399','¥351','¥319','¥279','¥239','¥199/插件'],
          en: ['$69','$61','$55','$48','$41','$29/plugin']
        };
        const rows = document.querySelectorAll('.pmt-row:not(.pmt-head)');
        rows.forEach((r, i) => {
          const c = r.querySelectorAll('span');
          if (c.length >= 4 && annualPrices[lang][i]) {
            c[2].textContent = annualPrices[lang][i];
            c[3].textContent = lifetimePrices[lang][i];
          }
        });
      }
    });
  }

  function initLangSwitch() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyLang(btn.getAttribute('data-lang'));
      });
    });
    // 初始化
    applyLang(currentLang);
  }

  // 扩展 applyLang：也处理 data-i18n-zh / data-i18n-en 属性（buy.html 等页面用）
  const _origApply = applyLang;
  applyLang = function(lang) {
    _origApply(lang);
    // 处理 data-i18n-zh / data-i18n-en
    document.querySelectorAll('[data-i18n-zh],[data-i18n-en]').forEach(el => {
      const val = el.getAttribute('data-i18n-' + lang);
      if (val !== null) el.innerHTML = val;
    });
    // 处理 placeholder
    document.querySelectorAll('[data-i18n-zh-placeholder],[data-i18n-en-placeholder]').forEach(el => {
      const val = el.getAttribute('data-i18n-' + lang + '-placeholder');
      if (val !== null) el.placeholder = val;
    });
    // 分发自定义事件，供 buy.html 等监听
    document.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
  };

  // DOM 就绪后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangSwitch);
  } else {
    initLangSwitch();
  }
})();
