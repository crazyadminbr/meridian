// ============================================================================
// routes/messages.js
// ============================================================================

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

router.use(requireAuth);

router.get('/conversations', messageController.listConversations);
router.get('/:userId', messageController.getConversation);
router.post('/:userId', messageController.sendMessage);

module.exports = router;
