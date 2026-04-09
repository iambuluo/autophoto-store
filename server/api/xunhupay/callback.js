/**
 * POST /xunhupay/callback
 * 虎皮椒支付回调通知
 *
 * 重要：虎皮椒要求收到通知后返回纯文本 "success"
 */
const {
  pendingOrders, paidOrders,
  generateLicenseCode,
  sendLicenseEmail, sendAdminEmail,
  verifyXunhuSign
} = require('../../_lib/utils');

module.exports = async (req, res) => {
  try {
    const params = req.body || req.query || {};
    console.log('📡 收到虎皮椒回调:', JSON.stringify(params));

    // 验证签名
    if (!process.env.XUNHU_APP_SECRET) {
      console.error('❌ XUNHU_APP_SECRET 未配置');
      return res.status(200).send('fail');
    }

    if (!verifyXunhuSign(params, process.env.XUNHU_APP_SECRET)) {
      console.error('❌ 签名验证失败');
      return res.status(200).send('fail');
    }

    const { trade_order_id, status, total_fee } = params;

    // 状态：OD = 已支付完成
    if (status !== 'OD') {
      console.log(`订单 ${trade_order_id} 状态: ${status}，忽略`);
      return res.status(200).send('success');
    }

    // 查找订单
    let orderInfo = pendingOrders.get(trade_order_id);
    if (!orderInfo) {
      orderInfo = paidOrders.get(trade_order_id);
      if (orderInfo) {
        console.log(`订单 ${trade_order_id} 已处理，直接返回成功`);
        return res.status(200).send('success');
      }
      console.error(`❌ 订单不存在: ${trade_order_id}`);
      return res.status(200).send('fail');
    }

    // 标记已支付
    orderInfo.status = 'paid';
    orderInfo.paidAt = new Date().toISOString();
    orderInfo.paidAmount = total_fee;
    paidOrders.set(trade_order_id, orderInfo);
    pendingOrders.delete(trade_order_id);

    console.log(`✅ 订单 ${trade_order_id} 支付成功！金额: ¥${total_fee}`);

    // 生成授权码
    const licenseCodes = orderInfo.plugins.map(p => generateLicenseCode(p, orderInfo.plan));

    // 发送邮件
    await sendLicenseEmail(orderInfo.email, orderInfo, licenseCodes);
    await sendAdminEmail(orderInfo, licenseCodes);

    console.log(`📧 授权码已发送: ${licenseCodes.join(', ')}`);

    // 虎皮椒要求：返回纯文本 "success"
    return res.status(200).send('success');

  } catch (err) {
    console.error('回调处理异常:', err);
    return res.status(200).send('fail');
  }
};
