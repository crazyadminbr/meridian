// ============================================================================
// middleware/auth.js
// Middleware для JWT-авторизации и проверки ролей.
// ============================================================================

const jwt = require('jsonwebtoken');
const db = require('../database/db');

/**
 * Извлекает токен из заголовка Authorization: Bearer <token>
 */
function getToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Обязательная авторизация — без валидного токена доступ запрещён (401).
 * Также проверяет, не забанен ли пользователь.
 */
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.get('SELECT * FROM users WHERE id = ?', [payload.id]);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    if (user.is_banned) return res.status(403).json({ error: 'Ваш аккаунт заблокирован администрацией' });

    // Обновляем "последний онлайн" — используется для списка онлайн-пользователей
    db.run('UPDATE users SET last_online = datetime(\'now\') WHERE id = ?', [user.id]);

    req.user = user; // полный объект пользователя из БД (включая password_hash — не отдавать наружу!)
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Неверный или истёкший токен' });
  }
}

/**
 * Необязательная авторизация — если токен есть и валиден, req.user заполняется,
 * но при отсутствии токена запрос всё равно пропускается дальше (для публичных страниц,
 * которым полезно знать, авторизован ли пользователь).
 */
function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.get('SELECT * FROM users WHERE id = ?', [payload.id]);
    if (user && !user.is_banned) {
      db.run('UPDATE users SET last_online = datetime(\'now\') WHERE id = ?', [user.id]);
      req.user = user;
    }
  } catch (err) {
    /* игнорируем невалидный токен в необязательной авторизации */
  }
  next();
}

/**
 * Фабрика middleware для проверки роли. Использование: requireRole('admin'), requireRole('admin','moderator')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав для этого действия' });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
