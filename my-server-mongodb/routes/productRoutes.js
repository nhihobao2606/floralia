const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../controllers/authController');

const {
    getProducts,
    getProductById,
    getProductBySlug,
    getProductBySku,
    getProductImage,
    getProductReviews,
    createProductReview,
    getInventory,
    updateInventoryStock,
    receiveInventoryStock
} = require('../controllers/productController');
const { getCart, updateCart } = require('../controllers/cartController');
const { getPublicCategories } = require('../controllers/categoryController');

router.get('/', getProducts);
router.get('/categories', getPublicCategories);
router.get('/cart', getCart);
router.put('/cart', updateCart);
router.get('/admin/inventory', requireAuth, requireAdmin, getInventory);
router.patch('/admin/inventory/bulk', requireAuth, requireAdmin, receiveInventoryStock);
router.patch('/admin/inventory/:sku', requireAuth, requireAdmin, updateInventoryStock);
router.get('/reviews/:sku', getProductReviews);
router.post('/reviews', requireAuth, createProductReview);
router.get('/image/:id', getProductImage);
router.get('/slug/:slug', getProductBySlug);
router.get('/sku/:sku', getProductBySku);
router.get('/:id', getProductById);

module.exports = router;
