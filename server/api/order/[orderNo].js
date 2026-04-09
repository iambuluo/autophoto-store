/**
 * GET /api/order/[orderNo]
 * 查询订单状态
 */
const { pendingOrders, paidOrders } = require('../../_lib/utils');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { orderNo } = req.query || req.params || {};
  if (!orderNo) {
    return res.status(400).json({ success: false, error: '缺少订单号' });
  }

  const order = paidOrders.get(orderNo) || pendingOrders.get(orderNo);
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  return res.status(200).json({ success: true, order });
};
