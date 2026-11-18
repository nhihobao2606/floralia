const express = require('express');
const router = express.Router();
const { getClientProducts, getProductVersion, streamProductEvents } = require('../controllers/clientProductController');
const { getPublicCategories } = require('../controllers/categoryController');
const { optionalAuth } = require('../controllers/authController');
const { getCustomerRecommendations, trackProductView, streamRecommendationEvents } = require('../controllers/productRecommendationController');

router.get('/', optionalAuth, getClientProducts);
router.get('/categories', getPublicCategories);
router.get('/recommendations/events', streamRecommendationEvents);
router.post('/recommendations/views', optionalAuth, trackProductView);
router.get('/recommendations', optionalAuth, getCustomerRecommendations);
router.get('/version', getProductVersion);
router.get('/events', streamProductEvents);
module.exports = router;
