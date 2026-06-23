// ============================================================================
// controllers/userController.js
// Профиль пользователя, список пользователей, поиск, онлайн.
// ============================================================================

const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { publicUser, parsePagination } = require('../utils/helpers');

// GET /api/users — список пользователей с поиском и пагинацией
function listUsers(req, res) {
  const { search } = req.query;
  const { page, limit, offset } = parsePagination(req, 24, 60);

  let where = '';
  const params = [];
  if (search) {
    where = 'WHERE nickname LIKE ?';
    params.push(`%${search}%`);
  }

  const total = db.get(`SELECT COUNT(*) as c FROM users ${where}`, params).c;
  const rows = db.all(
    `SELECT * FROM users ${where} ORDER BY last_online DESC NULLS LAST, created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    users: rows.map(publicUser),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}

// GET /api/users/online — список тех, кто онлайн прямо сейчас
function listOnline(req, res) {
  const rows = db.all(
    `SELECT * FROM users WHERE last_online IS NOT NULL AND last_online >= datetime('now', '-5 minutes') ORDER BY last_online DESC`
  );
  res.json({ users: rows.map(publicUser), count: rows.length });
}

// GET /api/users/:id — публичный профиль
function getUser(req, res) {
  const user = db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const topicsCount = db.get('SELECT COUNT(*) as c FROM topics WHERE user_id = ?', [user.id]).c;
  const postsCount = db.get('SELECT COUNT(*) as c FROM posts WHERE user_id = ? AND is_deleted = 0', [user.id]).c;

  res.json({ user: { ...publicUser(user), topicsCount, postsCount } });
}

// PUT /api/users/me — обновление своего профиля (ник, статус, о себе)
function updateMe(req, res) {
  const { nickname, status, about } = req.body;
  const updates = [];
  const params = [];

  if (nickname && nickname !== req.user.nickname) {
    const taken = db.get('SELECT id FROM users WHERE nickname = ? AND id != ?', [nickname, req.user.id]);
    if (taken) return res.status(409).json({ error: 'Этот никнейм уже занят' });
    updates.push('nickname = ?');
    params.push(nickname);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(String(status).slice(0, 100));
  }
  if (about !== undefined) {
    updates.push('about = ?');
    params.push(String(about).slice(0, 360));  // максимум 360 символов
  }

  if (updates.length === 0) return res.json({ user: publicUser(req.user) });

  params.push(req.user.id);
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  const updated = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ message: 'Профиль обновлён', user: publicUser(updated) });
}

// PUT /api/users/me/password — смена пароля
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Новый пароль должен быть не короче 6 символов' });
  }

  const ok = await bcrypt.compare(currentPassword || '', req.user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Текущий пароль указан неверно' });

  const newHash = await bcrypt.hash(newPassword, 10);
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
  res.json({ message: 'Пароль успешно изменён' });
}

// PUT /api/users/me/avatar — загрузка аватара (файл обрабатывается middleware multer)
function updateAvatar(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Файл не был загружен' });
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id]);
  res.json({ message: 'Аватар обновлён', avatar: avatarUrl });
}

// PUT /api/users/me/banner — загрузка своего баннера (только owner)
function updateBanner(req, res) {
  if (!['owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Устанавливать баннер профиля может только Команда Проекта' });
  }
  if (!req.file) return res.status(400).json({ error: 'Файл не был загружен' });
  const bannerUrl = `/uploads/avatars/${req.file.filename}`;
  db.run('UPDATE users SET banner = ? WHERE id = ?', [bannerUrl, req.user.id]);
  res.json({ message: 'Баннер обновлён', banner: bannerUrl });
}

// PUT /api/users/:id/banner — установить баннер другому пользователю (только owner)
function setUserBanner(req, res) {
  if (!['owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Устанавливать баннеры другим пользователям может только Команда Проекта' });
  }
  const target = db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  if (!req.file) return res.status(400).json({ error: 'Файл не был загружен' });
  const bannerUrl = `/uploads/avatars/${req.file.filename}`;
  db.run('UPDATE users SET banner = ? WHERE id = ?', [bannerUrl, target.id]);
  res.json({ message: 'Баннер пользователя обновлён', banner: bannerUrl });
}

// DELETE /api/users/:id/banner — удалить баннер (только owner)
function removeUserBanner(req, res) {
  if (!['owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Только Команда Проекта может удалять баннеры' });
  }
  db.run('UPDATE users SET banner = NULL WHERE id = ?', [req.params.id]);
  res.json({ message: 'Баннер удалён' });
}

module.exports = { listUsers, listOnline, getUser, updateMe, changePassword, updateAvatar, updateBanner, setUserBanner, removeUserBanner };
