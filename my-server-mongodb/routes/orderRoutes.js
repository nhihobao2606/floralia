const express = require('express');
const router = express.Router();
const { optionalAuth, requireAuth, requireAdmin } = require('../controllers/authController');
const {
  getOrders,
  getAdminOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrderItems,
  approveRefund,
  updateAdminOrderStatus
} = require('../controllers/orderController');

router.use(optionalAuth);

router.get('/admin', requireAuth, requireAdmin, getAdminOrders);
router.patch('/:id/approve-refund', requireAuth, requireAdmin, approveRefund);
router.patch('/:id/admin-status', requireAuth, requireAdmin, updateAdminOrderStatus);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.patch('/:id/cancel-items', cancelOrderItems);
router.patch('/:id', updateOrderStatus);

module.exports = router;
