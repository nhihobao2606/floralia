const express = require('express');
const { requireAuth, requireAdmin } = require('../controllers/authController');
const { getAdminRecommendations, saveSegmentRecommendations, getSalesForecast } = require('../controllers/productRecommendationController');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', getAdminRecommendations);
router.get('/forecast', getSalesForecast);
router.put('/:segmentId', saveSegmentRecommendations);
module.exports = router;
