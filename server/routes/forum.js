// ============================================================================
// routes/forum.js
// ============================================================================

const router = require('express').Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const forumController = require('../controllers/forumController');

router.get('/categories', forumController.listCategories);
router.get('/categories/:slug/topics', forumController.listTopicsByCategory);
router.post('/categories/:id/topics', requireAuth, forumController.createTopic);

router.get('/search', forumController.search);

router.get('/topics/:id', optionalAuth, forumController.getTopic);
router.put('/topics/:id', requireAuth, forumController.updateTopic);
router.delete('/topics/:id', requireAuth, forumController.deleteTopic);

router.post('/topics/:id/posts', requireAuth, forumController.addPost);
router.put('/posts/:id', requireAuth, forumController.updatePost);
router.delete('/posts/:id', requireAuth, forumController.deletePost);
router.post('/posts/:id/like', requireAuth, forumController.toggleLike);

module.exports = router;
