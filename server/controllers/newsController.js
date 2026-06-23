// ============================================================================
// controllers/newsController.js
// Публичный просмотр новостей (создание/редактирование — через adminController).
// ============================================================================

const db = require('../database/db');
const { parsePagination } = require('../utils/helpers');

// GET /api/news
function listNews(req, res) {
  const { page, limit, offset } = parsePagination(req, 9, 30);
  const total = db.get('SELECT COUNT(*) as c FROM news').c;
  const news = db.all(
    `SELECT n.*, u.nickname as author_nickname, u.avatar as author_avatar
     FROM news n LEFT JOIN users u ON n.author_id = u.id
     ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json({ news, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
}

// GET /api/news/:id
function getNews(req, res) {
  const item = db.get(
    `SELECT n.*, u.nickname as author_nickname, u.avatar as author_avatar
     FROM news n LEFT JOIN users u ON n.author_id = u.id WHERE n.id = ?`,
    [req.params.id]
  );
  if (!item) return res.status(404).json({ error: 'Новость не найдена' });
  res.json({ news: item });
}

module.exports = { listNews, getNews };
