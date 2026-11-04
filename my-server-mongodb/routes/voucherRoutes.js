const express = require('express');
const { validateVoucher } = require('../controllers/voucherController');

const router = express.Router();
router.post('/validate', validateVoucher);

module.exports = router;
