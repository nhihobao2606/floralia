const express = require('express');
const router = express.Router();

const { requireAuth, requireAdmin } = require('../controllers/authController');
const {
  getAdminOrders,
  getAdminOrderById,
  createAdminOrder,
  updateAdminOrderStatus,
  updateAdminOrder,
  addAdminOrderNote,
  deleteAdminOrder,
  bulkDeleteAdminOrders
} = require('../controllers/adminOrderController');

router.use(requireAuth, requireAdmin);

router.get('/', getAdminOrders);
router.get('/:id', getAdminOrderById);
router.post('/', createAdminOrder);
router.patch('/:id/status', updateAdminOrderStatus);
router.patch('/:id', updateAdminOrder);
router.post('/:id/notes', addAdminOrderNote);
router.delete('/:id', deleteAdminOrder);
router.post('/bulk-delete', bulkDeleteAdminOrders);

module.exports = router;
