// ============================================================================
// routes/support.js
// ============================================================================

const router = require('express').Router();
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const sc = require('../controllers/supportController');

// --- Пользовательские маршруты ---
router.post('/',          optionalAuth,  sc.createTicket);   // создать обращение (и гость, и авторизованный)
router.get('/my',         requireAuth,   sc.myTickets);      // свои тикеты
router.get('/:id',        requireAuth,   sc.getTicket);      // переписка по тикету
router.post('/:id/messages', requireAuth, sc.addMessage);    // ответить в тикет

// --- Маршруты персонала (модератор / администратор / Команда Проекта) ---
const staff = requireRole('moderator', 'admin', 'owner');
router.get('/staff/tickets',              requireAuth, staff, sc.listTickets);
router.put('/staff/tickets/:id/claim',    requireAuth, staff, sc.claimTicket);
router.put('/staff/tickets/:id/close',    requireAuth, staff, sc.closeTicket);
// Ответить в тикет может и персонал — через тот же общий маршрут POST /:id/messages

module.exports = router;
