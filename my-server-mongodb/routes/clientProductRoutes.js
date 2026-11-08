const express = require('express');
const router = express.Router();
const { getClientProducts, getProductVersion, streamProductEvents } = require('../controllers/clientProductController');
const { getCart, updateCart } = require('../controllers/cartController');
const { getPublicCategories } = require('../controllers/categoryController');

router.get('/', getClientProducts);
router.get('/categories', getPublicCategories);
router.get('/version', getProductVersion);
router.get('/events', streamProductEvents);
router.get('/cart', getCart);
router.put('/cart', updateCart);

module.exports = router;
