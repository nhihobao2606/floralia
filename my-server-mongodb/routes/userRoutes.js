const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../controllers/authController');
const {
    getProfile,
    updateProfile,
    changePassword,
    getAllUsersForAdmin,
    createUserForAdmin,
    updateUserForAdmin,
    toggleUserStatusForAdmin
} = require('../controllers/userController');

router.get('/admin/list', requireAuth, requireAdmin, getAllUsersForAdmin);
router.post('/admin', requireAuth, requireAdmin, createUserForAdmin);
router.patch('/admin/:id', requireAuth, requireAdmin, updateUserForAdmin);
router.patch('/admin/:id/status', requireAuth, requireAdmin, toggleUserStatusForAdmin);

router.use(requireAuth);

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.put('/me/password', changePassword);

module.exports = router;

