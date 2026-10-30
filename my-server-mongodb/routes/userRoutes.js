const express = require('express');
const router = express.Router();
const { requireAuth } = require('../controllers/authController');
const {
    getProfile,
    updateProfile,
    changePassword
} = require('../controllers/userController');

router.use(requireAuth);

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.put('/me/password', changePassword);

module.exports = router;

