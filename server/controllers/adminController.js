// ============================================================================
// controllers/adminController.js
// Админ-панель: управление пользователями, темами и новостями.
// Маршруты защищены middleware requireRole(...) — см. routes/admin.js. Большинство действий
// доступны 'admin' + 'moderator' + 'owner' (Команда Проекта); смена ролей и блокировка
// пользователей — только 'admin' + 'owner'.
// ============================================================================

const db = require('../database/db');
const { publicUser, parsePagination } = require('../utils/helpers');
const { createNotification } = require('./notificationController');

// ---------------------------------------------------------------------------
// Пользователи
// ---------------------------------------------------------------------------

// GET /api/admin/users
function listAllUsers(req, res) {
  const users = db.all('SELECT * FROM users ORDER BY created_at DESC');
  res.json({ users: users.map(publicUser) });
}

// PUT /api/admin/users/:id/role
// Иерархия ролей для назначения:
//   owner         → может назначить: user / moderator / admin (роль owner — только через .env)
//   admin         → может назначить: user / moderator  (не может ставить admin и снимать admin/owner)
//   moderator     → не может менять роли вообще (заблокировано на уровне маршрутов)
function setRole(req, res) {
  const { role } = req.body;
  if (!['user', 'moderator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Недопустимая роль. Роль «Команда Проекта» выдаётся только через OWNER_EMAILS в .env' });
  }

  const target = db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Нельзя менять собственную роль' });

  if (target.role === 'owner') {
    return res.status(403).json({ error: 'Роль «Команда Проекта» управляется только через .env' });
  }
  if (target.role === 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Снять роль администратора может только Команда Проекта' });
  }
  if (role === 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Назначить роль администратора может только Команда Проекта. Администратор может повысить максимум до модератора.' });
  }

  const ROLE_NAMES = { user: 'Пользователь', moderator: 'Модератор', admin: 'Администратор' };
  db.run('UPDATE users SET role = ? WHERE id = ?', [role, target.id]);
  createNotification(target.id, 'system', `Ваша роль на форуме изменена на «${ROLE_NAMES[role]}»`, '/profile.html');
  res.json({ message: 'Роль обновлена', user: publicUser(db.get('SELECT * FROM users WHERE id = ?', [target.id])) });
}

// PUT /api/admin/users/:id/ban — блокировать может администратор и Команда Проекта (модератору запрещено,
// см. routes/admin.js). Администратор не может заблокировать другого администратора или Команду Проекта —
// это может сделать только сама Команда Проекта.
function setBan(req, res) {
  const { banned, reason } = req.body;
  const target = db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  if (target.role === 'owner') {
    return res.status(403).json({ error: 'Нельзя заблокировать участника Команды Проекта' });
  }
  if (target.role === 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Заблокировать администратора может только Команда Проекта' });
  }

  db.run('UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ?', [
    banned ? 1 : 0,
    banned ? reason || 'Нарушение правил форума' : null,
    target.id,
  ]);

  res.json({
    message: banned ? 'Пользователь заблокирован' : 'Пользователь разблокирован',
    user: publicUser(db.get('SELECT * FROM users WHERE id = ?', [target.id])),
  });
}

// GET /api/admin/topics — список всех тем форума (для модерации)
function listAllTopics(req, res) {
  const { page, limit, offset } = parsePagination(req, 20, 100);
  const total = db.get('SELECT COUNT(*) as c FROM topics').c;
  const topics = db.all(
    `SELECT t.*, u.nickname as author_nickname, c.name as category_name, c.slug as category_slug
     FROM topics t JOIN users u ON t.user_id = u.id JOIN categories c ON t.category_id = c.id
     ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json({ topics, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
}

// ---------------------------------------------------------------------------
// Темы (модерация)
// ---------------------------------------------------------------------------

// DELETE /api/admin/topics/:id
function deleteTopic(req, res) {
  const topic = db.get('SELECT * FROM topics WHERE id = ?', [req.params.id]);
  if (!topic) return res.status(404).json({ error: 'Тема не найдена' });
  db.run('DELETE FROM topics WHERE id = ?', [topic.id]);
  res.json({ message: 'Тема удалена администрацией' });
}

// PUT /api/admin/topics/:id/pin — закрепить/открепить тему
function togglePin(req, res) {
  const topic = db.get('SELECT * FROM topics WHERE id = ?', [req.params.id]);
  if (!topic) return res.status(404).json({ error: 'Тема не найдена' });
  const newVal = topic.is_pinned ? 0 : 1;
  db.run('UPDATE topics SET is_pinned = ? WHERE id = ?', [newVal, topic.id]);
  res.json({ message: newVal ? 'Тема закреплена' : 'Тема откреплена', is_pinned: !!newVal });
}

// PUT /api/admin/topics/:id/lock — закрыть/открыть тему для ответов
function toggleLock(req, res) {
  const topic = db.get('SELECT * FROM topics WHERE id = ?', [req.params.id]);
  if (!topic) return res.status(404).json({ error: 'Тема не найдена' });
  const newVal = topic.is_locked ? 0 : 1;
  db.run('UPDATE topics SET is_locked = ? WHERE id = ?', [newVal, topic.id]);
  res.json({ message: newVal ? 'Тема закрыта' : 'Тема открыта', is_locked: !!newVal });
}

// ---------------------------------------------------------------------------
// Новости
// ---------------------------------------------------------------------------

// POST /api/admin/news
function createNews(req, res) {
  const { title, content, cover_image } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Заполните заголовок и текст новости' });

  const { lastInsertRowid } = db.run(
    'INSERT INTO news (title, content, cover_image, author_id) VALUES (?, ?, ?, ?)',
    [title.trim(), content, cover_image || null, req.user.id]
  );
  res.status(201).json({ message: 'Новость опубликована', news: db.get('SELECT * FROM news WHERE id = ?', [lastInsertRowid]) });
}

// PUT /api/admin/news/:id
function updateNews(req, res) {
  const news = db.get('SELECT * FROM news WHERE id = ?', [req.params.id]);
  if (!news) return res.status(404).json({ error: 'Новость не найдена' });

  const { title, content, cover_image } = req.body;
  db.run('UPDATE news SET title = ?, content = ?, cover_image = ?, updated_at = datetime(\'now\') WHERE id = ?', [
    title || news.title,
    content || news.content,
    cover_image !== undefined ? cover_image : news.cover_image,
    news.id,
  ]);
  res.json({ message: 'Новость обновлена', news: db.get('SELECT * FROM news WHERE id = ?', [news.id]) });
}

// DELETE /api/admin/news/:id
function deleteNews(req, res) {
  db.run('DELETE FROM news WHERE id = ?', [req.params.id]);
  res.json({ message: 'Новость удалена' });
}

// GET /api/admin/stats — сводная статистика для дашборда админ-панели
function getStats(req, res) {
  const usersCount = db.get('SELECT COUNT(*) as c FROM users').c;
  const topicsCount = db.get('SELECT COUNT(*) as c FROM topics').c;
  const postsCount = db.get('SELECT COUNT(*) as c FROM posts WHERE is_deleted = 0').c;
  const bannedCount = db.get('SELECT COUNT(*) as c FROM users WHERE is_banned = 1').c;
  const onlineCount = db.get(
    `SELECT COUNT(*) as c FROM users WHERE last_online >= datetime('now', '-5 minutes')`
  ).c;
  res.json({ usersCount, topicsCount, postsCount, bannedCount, onlineCount });
}

module.exports = {
  listAllUsers,
  setRole,
  setBan,
  listAllTopics,
  deleteTopic,
  togglePin,
  toggleLock,
  createNews,
  updateNews,
  deleteNews,
  getStats,
};
