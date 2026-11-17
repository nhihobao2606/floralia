const express = require('express');
const router = express.Router();
const { requireAuth } = require('../controllers/authController');
const {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  updateAdminSecurity
} = require('../controllers/adminProfileController');

router.use(requireAuth);

router.get('/', getAdminProfile);
router.put('/', updateAdminProfile);
router.put('/password', changeAdminPassword);
router.put('/security', updateAdminSecurity);

module.exports = router;
