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

router.get('/', getProducts);
router.get('/reviews/:sku', getProductReviews);
router.post('/reviews', requireAuth, createProductReview);
router.get('/image/:id', getProductImage);
router.get('/:id', getProductById);

module.exports = router;