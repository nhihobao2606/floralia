const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/', chatController.handleChatConsultation);
router.get('/messages', chatController.getSessionMessages);
router.post('/clear', chatController.clearSessionMessages);
router.post('/sync-embeddings', chatController.syncProductEmbeddings);

module.exports = router;
