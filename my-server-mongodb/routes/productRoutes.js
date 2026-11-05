const express = require('express');
const router = express.Router();
const { requireAuth } = require('../controllers/authController');

const {
    getProducts,
    getProductById,
    getProductBySlug,
    getProductBySku,
    getProductImage,
    getProductReviews,
    createProductReview
} = require('../controllers/productController');

router.get('/', getProducts);
router.get('/reviews/:sku', getProductReviews);
router.post('/reviews', requireAuth, createProductReview);
router.get('/image/:id', getProductImage);
router.get('/slug/:slug', getProductBySlug);
router.get('/sku/:sku', getProductBySku);
router.get('/:id', getProductById);

module.exports = router;