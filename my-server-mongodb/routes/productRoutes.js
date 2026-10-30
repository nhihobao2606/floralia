const express = require('express');
const router = express.Router();

const {
    getProducts,
    getProductById,
    getProductImage,
    getProductReviews,
    createProductReview
} = require('../controllers/productController');

router.get('/', getProducts);
router.get('/reviews/:sku', getProductReviews);
router.post('/reviews', createProductReview);
router.get('/image/:id', getProductImage);
router.get('/:id', getProductById);

module.exports = router;