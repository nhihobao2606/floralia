const express = require('express');
const router = express.Router();
const { requireAuth } = require('../controllers/authController');

const {
    getProducts,
    getProductById,
    getProductImage,
    getProductReviews,
    createProductReview
} = require('../controllers/productController');
const { getCart, updateCart } = require('../controllers/cartController');
const { getPublicCategories } = require('../controllers/categoryController');

router.get('/', getProducts);
router.get('/categories', getPublicCategories);
router.get('/cart', getCart);
router.put('/cart', updateCart);
router.get('/reviews/:sku', getProductReviews);
router.post('/reviews', requireAuth, createProductReview);
router.get('/image/:id', getProductImage);
router.get('/:id', getProductById);

module.exports = router;