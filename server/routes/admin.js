// ============================================================================
// routes/admin.js
// Большинство маршрутов доступны персоналу: admin, moderator, owner (Команда Проекта).
// Смена ролей и блокировка пользователей — ТОЛЬКО admin и owner (модератору запрещено
// блокировать пользователей, как и было явно запрошено).
// ============================================================================

const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(requireAuth, requireRole('admin', 'moderator', 'owner'));

router.get('/stats', adminController.getStats);

router.get('/users', adminController.listAllUsers);
// Менять роли: admin (но только до moderator, см. контроллер) + owner (без ограничений)
router.put('/users/:id/role', requireRole('admin', 'owner'), adminController.setRole);
// Блокировать: только admin и owner; модератор — нет
router.put('/users/:id/ban',  requireRole('admin', 'owner'), adminController.setBan);

router.get('/topics', adminController.listAllTopics);
router.delete('/topics/:id', adminController.deleteTopic);
router.put('/topics/:id/pin', adminController.togglePin);
router.put('/topics/:id/lock', adminController.toggleLock);

router.post('/news', adminController.createNews);
router.put('/news/:id', adminController.updateNews);
router.delete('/news/:id', adminController.deleteNews);

module.exports = router;
