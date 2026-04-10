/**
 * 简化的订单创建API - 用于测试（纯CommonJS格式）
 * 不依赖虎皮椒，直接返回成功
 */
const { PLAN_LABELS, PLAN_PRICES, PLUGIN_NAMES, calcPrice, generateLicenseCode } = require('../_lib/pricing-config');

module.exports = async function handler(req, res) {
  console.log('[simple-order] 调用时间:', new Date().toISOString());
  console.log('[simple-order] 方法:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只支持POST' });
  }

  try {
    const { plugins, plan, name, email } = req.body || {};

    // 验证参数
    if (!plugins || !Array.isArray(plugins) || plugins.length === 0) {
      return res.status(400).json({ success: false, error: '请至少选择一个插件' });
    }
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ success: false, error: '无效的授权类型' });
    }

    const total = calcPrice(plugins, plan);
    const orderNo = 'TEST_' + Date.now();

    // 生成授权码
    const codeEntries = plugins.map(p => generateLicenseCode(p, plan));
    const licenseCodesLabeled = codeEntries.map(e => `${e.label} ${e.code}`);

    console.log('[simple-order] 订单号:', orderNo, '金额:', total);

    // 直接返回成功（测试模式）
    res.json({
      success: true,
      mode: 'test',
      message: '这是简化版API，不需要真实支付',
      orderNo,
      total,
      plugins: plugins.map(p => PLUGIN_NAMES[p] || p),
      planName: PLAN_LABELS[plan],
      licenseCodesLabeled
    });

  } catch (err) {
    console.error('[simple-order] 错误:', err.message);
    res.status(500).json({ success: false, error: '错误: ' + err.message });
  }
};
