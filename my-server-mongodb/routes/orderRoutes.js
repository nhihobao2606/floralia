const express = require('express');
const router = express.Router();
const { optionalAuth, requireAuth, requireAdmin } = require('../controllers/authController');
const {
  getOrders,
  getAdminOrders,
  getAdminOrdersForUser,
  getOrderById,
  createOrder,
  updateOrderStatus,
  approveRefund,
  updateAdminOrderStatus
} = require('../controllers/orderController');

router.use(optionalAuth);

router.get('/admin', requireAuth, requireAdmin, getAdminOrders);
router.get('/admin/user/:userId', requireAuth, requireAdmin, getAdminOrdersForUser);
router.patch('/:id/approve-refund', requireAuth, requireAdmin, approveRefund);
router.patch('/:id/admin-status', requireAuth, requireAdmin, updateAdminOrderStatus);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.patch('/:id', updateOrderStatus);

module.exports = router;
