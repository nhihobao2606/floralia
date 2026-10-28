const express = require('express');
const router = express.Router();

const {
    getProducts,
    getProductById,
    getProductImage
} = require('../controllers/productController');

router.get('/', getProducts);
router.get('/image/:id', getProductImage);
router.get('/:id', getProductById);

module.exports = router;