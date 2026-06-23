// ============================================================================
// utils/helpers.js
// Общие вспомогательные функции, переиспользуемые в нескольких контроллерах.
// ============================================================================

const db = require('../database/db');

/**
 * Убирает приватные поля (хэш пароля, токены) из объекта пользователя перед
 * отправкой клиенту. Используем это ВСЕГДА, когда отдаём пользователя наружу.
 */
function publicUser(user) {
  if (!user) return null;
  const { password_hash, verify_token, reset_token, reset_expires, ...safe } = user;
  return {
    ...safe,
    is_online: isOnline(user.last_online),
  };
}

/**
 * Пользователь считается "онлайн", если он проявлял активность за последние 5 минут.
 */
function isOnline(lastOnlineStr) {
  if (!lastOnlineStr) return false;
  const last = new Date(lastOnlineStr.replace(' ', 'T') + 'Z').getTime();
  return Date.now() - last < 5 * 60 * 1000;
}

/**
 * Простая пагинация из query-параметров запроса.
 */
function parsePagination(req, defaultLimit = 20, maxLimit = 100) {
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, offset: (page - 1) * limit };
}

// ----------------------------------------------------------------------------
// РОЛИ
// Иерархия: owner (Команда Проекта) > admin (Администратор) > moderator (Модератор) > user
// ----------------------------------------------------------------------------
const ROLE_RANK = { user: 0, moderator: 1, admin: 2, owner: 3 };

/** true, если роль относится к персоналу форума (может модерировать контент) */
function isStaffRole(role) {
  return ['moderator', 'admin', 'owner'].includes(role);
}

/** Числовой ранг роли — выше число, больше прав. Используется для сравнения иерархии. */
function roleRank(role) {
  return ROLE_RANK[role] ?? 0;
}

/**
 * Проверяет, входит ли email в список OWNER_EMAILS из .env (роль "Команда Проекта").
 * Эта роль НЕЛЬЗЯ выдать через интерфейс администратора — только редактированием .env,
 * как и было запрошено: "выдавать другим только меняя сам код, добавляя в .env список почты".
 */
function isOwnerEmail(email) {
  const list = String(process.env.OWNER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(email || '').toLowerCase());
}

/**
 * Синхронизирует роль пользователя с .env: если его email есть в OWNER_EMAILS, а в базе
 * данных у него ещё не выставлена роль "owner" — обновляет роль. Вызывается при
 * регистрации, входе и проверке текущей сессии (/auth/me), чтобы изменения в .env
 * подхватывались автоматически без ручных правок в базе данных.
 */
function syncOwnerRole(user) {
  if (!user) return user;
  if (isOwnerEmail(user.email) && user.role !== 'owner') {
    db.run("UPDATE users SET role = 'owner' WHERE id = ?", [user.id]);
    return { ...user, role: 'owner' };
  }
  return user;
}

module.exports = { publicUser, isOnline, parsePagination, isStaffRole, roleRank, isOwnerEmail, syncOwnerRole };
