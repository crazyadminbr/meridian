// ============================================================================
// routes/news.js
// ============================================================================

const router = require('express').Router();
const newsController = require('../controllers/newsController');

router.get('/', newsController.listNews);
router.get('/:id', newsController.getNews);

module.exports = router;
