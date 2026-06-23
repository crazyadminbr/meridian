// ============================================================================
// controllers/messageController.js
// Личные сообщения между пользователями.
//
// Логика построения списка диалогов/переписки вынесена во внутренние функции
// buildConversations(selfId) / buildThread(selfId, partnerId), потому что они же
// переиспользуются в adminController для общего ящика "Поддержка" (см. ниже) —
// там "self" это не req.user.id, а технический аккаунт поддержки, к которому имеет
// доступ весь персонал (модератор/админ/Команда Проекта), а не только его "владелец".
// ============================================================================

const db = require('../database/db');
const { publicUser } = require('../utils/helpers');
const { createNotification, notifyAllStaff } = require('./notificationController');

/** Список диалогов пользователя с id = selfId (последнее сообщение + счётчик непрочитанных) */
function buildConversations(selfId) {
  const partners = db.all(
    `SELECT DISTINCT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as partner_id
     FROM private_messages WHERE sender_id = ? OR receiver_id = ?`,
    [selfId, selfId, selfId]
  );

  const conversations = partners.map(({ partner_id }) => {
    const partner = db.get('SELECT * FROM users WHERE id = ?', [partner_id]);
    const lastMessage = db.get(
      `SELECT * FROM private_messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at DESC LIMIT 1`,
      [selfId, partner_id, partner_id, selfId]
    );
    const unreadCount = db.get(
      `SELECT COUNT(*) as c FROM private_messages WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
      [partner_id, selfId]
    ).c;
    return { partner: publicUser(partner), lastMessage, unreadCount };
  });

  conversations.sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));
  return conversations;
}

/** Полная переписка между selfId и partnerId. markRead — отмечать ли входящие как прочитанные. */
function buildThread(selfId, partnerId, markRead = true) {
  const messages = db.all(
    `SELECT * FROM private_messages
     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
     ORDER BY created_at ASC`,
    [selfId, partnerId, partnerId, selfId]
  );
  if (markRead) {
    db.run('UPDATE private_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0', [
      partnerId,
      selfId,
    ]);
  }
  return messages;
}

// GET /api/messages/conversations — список диалогов с последним сообщением
function listConversations(req, res) {
  res.json({ conversations: buildConversations(req.user.id) });
}

// GET /api/messages/:userId — переписка с конкретным пользователем
function getConversation(req, res) {
  const userId = req.user.id;
  const partnerId = Number(req.params.userId);

  const partner = db.get('SELECT * FROM users WHERE id = ?', [partnerId]);
  if (!partner) return res.status(404).json({ error: 'Пользователь не найден' });

  const messages = buildThread(userId, partnerId);
  res.json({ partner: publicUser(partner), messages });
}

// POST /api/messages/:userId — отправить сообщение
function sendMessage(req, res) {
  const userId = req.user.id;
  const partnerId = Number(req.params.userId);
  const { content } = req.body;

  if (partnerId === userId) return res.status(400).json({ error: 'Нельзя написать самому себе' });
  if (!content || !content.trim()) return res.status(400).json({ error: 'Сообщение не может быть пустым' });

  const partner = db.get('SELECT * FROM users WHERE id = ?', [partnerId]);
  if (!partner) return res.status(404).json({ error: 'Пользователь не найден' });

  const { lastInsertRowid } = db.run(
    'INSERT INTO private_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
    [userId, partnerId, content.trim()]
  );

  if (partner.is_support) {
    // Сообщения в адрес общего аккаунта "Поддержка" никто индивидуально не читает —
    // оповещаем сразу весь персонал (модератор/админ/Команда Проекта), чтобы ответить
    // мог любой из них, а не только тот, кому повезёт быть владельцем аккаунта.
    notifyAllStaff(`${req.user.nickname} написал(а) в поддержку`, `/admin.html?tab=support&with=${userId}`);
  } else {
    createNotification(partnerId, 'pm', `${req.user.nickname} отправил(а) вам личное сообщение`, `/messages.html?with=${userId}`);
  }

  const message = db.get('SELECT * FROM private_messages WHERE id = ?', [lastInsertRowid]);
  res.status(201).json({ message });
}

module.exports = { listConversations, getConversation, sendMessage, buildConversations, buildThread };
