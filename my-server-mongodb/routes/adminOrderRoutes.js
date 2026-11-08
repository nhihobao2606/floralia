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

// Xử lý xác thực: nếu có token thì kiểm tra quyền admin, nếu không có token (ví dụ dev local) cho phép truy cập
router.use((req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token === 'null' || token === 'undefined') {
    return next();
  }
  return requireAuth(req, res, (err) => {
    if (err) return next(err);
    return requireAdmin(req, res, next);
  });
});

router.get('/', getAdminOrders);
router.get('/:id', getAdminOrderById);
router.post('/', createAdminOrder);
router.patch('/:id/status', updateAdminOrderStatus);
router.patch('/:id', updateAdminOrder);
router.post('/:id/notes', addAdminOrderNote);
router.delete('/:id', deleteAdminOrder);
router.post('/bulk-delete', bulkDeleteAdminOrders);

module.exports = router;
