const express = require('express');
const {
    getAvailableVouchers,
    getPublicVouchers,
    validateVoucher,
    getAdminVouchers,
    getAdminVoucher,
    createAdminVoucher,
    updateAdminVoucher,
    setAdminVoucherStatus,
    deleteAdminVoucher,
} = require('../controllers/voucherController');
const { optionalAuth, requireAuth, requireAdmin } = require('../controllers/authController');

const router = express.Router();
router.get('/public', getPublicVouchers);
router.post('/available', optionalAuth, getAvailableVouchers);
router.post('/validate', optionalAuth, validateVoucher);
router.get('/admin', requireAuth, requireAdmin, getAdminVouchers);
router.post('/admin', requireAuth, requireAdmin, createAdminVoucher);
router.get('/admin/:id', requireAuth, requireAdmin, getAdminVoucher);
router.put('/admin/:id', requireAuth, requireAdmin, updateAdminVoucher);
router.patch('/admin/:id/status', requireAuth, requireAdmin, setAdminVoucherStatus);
router.delete('/admin/:id', requireAuth, requireAdmin, deleteAdminVoucher);

module.exports = router;
