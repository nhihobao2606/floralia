const express = require('express');
const router = express.Router();
const { requireAuth } = require('../controllers/authController');
const { getCart, updateCart } = require('../controllers/cartController');

router.use(requireAuth);

router.get('/', getCart);
router.put('/', updateCart);

module.exports = router;

