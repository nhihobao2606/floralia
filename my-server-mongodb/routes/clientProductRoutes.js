const express = require('express');
const router = express.Router();
const { getClientProducts, getProductVersion, streamProductEvents } = require('../controllers/clientProductController');
const { getPublicCategories } = require('../controllers/categoryController');

router.get('/', getClientProducts);
router.get('/categories', getPublicCategories);
router.get('/version', getProductVersion);
router.get('/events', streamProductEvents);
module.exports = router;
