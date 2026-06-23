// ============================================================================
// controllers/notificationController.js
// Уведомления пользователя (ответы, цитаты, лайки, личные сообщения, системные).
// ============================================================================

const db = require('../database/db');

/**
 * Внутренний хелпер — создать уведомление для пользователя.
 */
function createNotification(userId, type, content, link = null) {
  db.run('INSERT INTO notifications (user_id, type, content, link) VALUES (?, ?, ?, ?)', [
    userId, type, content, link,
  ]);
}

/**
 * Разослать уведомление всему персоналу (модераторы, администраторы, Команда Проекта).
 * Используется для оповещения о новых обращениях в поддержку.
 */
function notifyAllStaff(content, link = null) {
  const staff = db.all("SELECT id FROM users WHERE role IN ('moderator','admin','owner') AND is_banned = 0");
  for (const u of staff) {
    db.run('INSERT INTO notifications (user_id, type, content, link) VALUES (?, ?, ?, ?)', [
      u.id, 'system', content, link,
    ]);
  }
}

// GET /api/notifications
function listNotifications(req, res) {
  const notifications = db.all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.user.id]
  );
  const unreadCount = db.get('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0', [
    req.user.id,
  ]).c;
  res.json({ notifications, unreadCount });
}

// PUT /api/notifications/:id/read
function markRead(req, res) {
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'Отмечено как прочитанное' });
}

// PUT /api/notifications/read-all
function markAllRead(req, res) {
  db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'Все уведомления отмечены как прочитанные' });
}

module.exports = { createNotification, notifyAllStaff, listNotifications, markRead, markAllRead };
