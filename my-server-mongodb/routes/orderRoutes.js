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
  updateAdminOrderStatus,
  requestGuestTrackingOtp,
  verifyGuestTrackingOtp
} = require('../controllers/orderController');

router.use(optionalAuth);

router.get('/admin', requireAuth, requireAdmin, getAdminOrders);
router.get('/admin/user/:userId', requireAuth, requireAdmin, getAdminOrdersForUser);
router.post('/guest-tracking/request-otp', requestGuestTrackingOtp);
router.post('/guest-tracking/verify-otp', verifyGuestTrackingOtp);
router.patch('/:id/approve-refund', requireAuth, requireAdmin, approveRefund);
router.patch('/:id/admin-status', requireAuth, requireAdmin, updateAdminOrderStatus);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.patch('/:id', updateOrderStatus);

module.exports = router;
