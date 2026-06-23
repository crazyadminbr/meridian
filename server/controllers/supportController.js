// ============================================================================
// controllers/supportController.js
// Система обращений в поддержку (тикеты).
//
// Жизненный цикл тикета:
//   open    — новое обращение, никто из персонала ещё не принял
//   claimed — принято кем-то из персонала (он же ведёт переписку с пользователем)
//   closed  — проблема решена, диалог закрыт
//
// Любой персонал (модератор/администратор/Команда Проекта) может:
//   - видеть все открытые тикеты
//   - принять любой открытый тикет (статус → claimed, поле claimed_by = id персонала)
//   - отвечать в принятом им тикете (другие персонал тоже может, чтобы подстраховать)
//   - закрыть тикет (статус → closed)
//
// Пользователь может:
//   - создать обращение (POST /api/support)
//   - видеть свои тикеты и историю переписки (GET /api/support/my)
//   - дописывать в открытый/принятый тикет (POST /api/support/:id/messages)
// ============================================================================

const db = require('../database/db');
const { isStaffRole } = require('../utils/helpers');
const { createNotification, notifyAllStaff } = require('./notificationController');

// ---------------------------------------------------------------------------
// Для пользователей
// ---------------------------------------------------------------------------

// POST /api/support — создать новое обращение
function createTicket(req, res) {
  const { subject, message, email } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Текст обращения не может быть пустым' });
  }
  const subj = (subject || 'Обращение в поддержку').trim().slice(0, 120);

  const userId   = req.user ? req.user.id    : null;
  const guestEmail = req.user ? null : (email || '').trim() || null;

  const { lastInsertRowid: ticketId } = db.run(
    `INSERT INTO support_tickets (user_id, guest_email, subject) VALUES (?, ?, ?)`,
    [userId, guestEmail, subj]
  );

  // Первое сообщение с контактным email гостя прямо в тексте, чтобы персонал
  // видел его в чате, а не только в уведомлении
  const firstMsg = guestEmail
    ? `[Гость, email: ${guestEmail}]\n\n${message.trim()}`
    : message.trim();

  db.run(
    `INSERT INTO support_messages (ticket_id, sender_id, is_staff, content) VALUES (?, ?, 0, ?)`,
    [ticketId, userId, firstMsg]
  );

  const linkForStaff = `/admin.html?tab=support&ticket=${ticketId}`;
  const who = req.user ? req.user.nickname : `Гость (${guestEmail || 'без email'})`;
  notifyAllStaff(`📩 Новое обращение в поддержку от ${who}: «${subj}»`, linkForStaff);

  res.status(201).json({
    message: 'Обращение создано. Персонал получил уведомление и ответит вам в ближайшее время.',
    ticketId,
  });
}

// GET /api/support/my — список своих тикетов
function myTickets(req, res) {
  const tickets = db.all(
    `SELECT t.*,
            (SELECT content FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT COUNT(*) FROM support_messages WHERE ticket_id = t.id AND is_staff = 1 AND created_at > t.updated_at) as unread_staff,
            u2.nickname as claimed_nickname
     FROM support_tickets t
     LEFT JOIN users u2 ON t.claimed_by = u2.id
     WHERE t.user_id = ?
     ORDER BY t.updated_at DESC`,
    [req.user.id]
  );
  res.json({ tickets });
}

// GET /api/support/:id — переписка по тикету (пользователь видит только свой)
function getTicket(req, res) {
  const ticket = db.get(`SELECT t.*, u.nickname as user_nickname, u.avatar as user_avatar,
    u2.nickname as claimed_nickname
    FROM support_tickets t
    LEFT JOIN users u  ON t.user_id = u.id
    LEFT JOIN users u2 ON t.claimed_by = u2.id
    WHERE t.id = ?`, [req.params.id]);

  if (!ticket) return res.status(404).json({ error: 'Обращение не найдено' });

  // Обычный пользователь видит только свой тикет; персонал — любой
  if (!isStaffRole(req.user.role) && ticket.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  const messages = db.all(
    `SELECT sm.*, u.nickname, u.avatar, u.role as sender_role
     FROM support_messages sm
     LEFT JOIN users u ON sm.sender_id = u.id
     WHERE sm.ticket_id = ?
     ORDER BY sm.created_at ASC`,
    [ticket.id]
  );
  res.json({ ticket, messages });
}

// POST /api/support/:id/messages — добавить сообщение в тикет
function addMessage(req, res) {
  const ticket = db.get('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Обращение не найдено' });

  // Пользователь может писать только в свой тикет
  if (!isStaffRole(req.user.role) && ticket.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  if (ticket.status === 'closed') {
    return res.status(400).json({ error: 'Обращение закрыто. Создайте новое, если нужна помощь.' });
  }

  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Сообщение не может быть пустым' });

  const isStaffMsg = isStaffRole(req.user.role) ? 1 : 0;
  db.run(
    `INSERT INTO support_messages (ticket_id, sender_id, is_staff, content) VALUES (?, ?, ?, ?)`,
    [ticket.id, req.user.id, isStaffMsg, content.trim()]
  );
  db.run(`UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?`, [ticket.id]);

  // Уведомляем другую сторону
  if (isStaffMsg) {
    // Персонал ответил — уведомляем пользователя, который создал тикет
    if (ticket.user_id) {
      createNotification(
        ticket.user_id, 'system',
        `${req.user.nickname} ответил(а) на ваше обращение «${ticket.subject}»`,
        `/support.html?ticket=${ticket.id}`
      );
    }
  } else {
    // Пользователь дописал — уведомляем персонал
    const who = req.user.nickname;
    notifyAllStaff(
      `${who} добавил(а) сообщение в обращение #${ticket.id} «${ticket.subject}»`,
      `/admin.html?tab=support&ticket=${ticket.id}`
    );
  }

  const msg = db.get(
    `SELECT sm.*, u.nickname, u.avatar, u.role as sender_role
     FROM support_messages sm LEFT JOIN users u ON sm.sender_id = u.id
     WHERE sm.id = last_insert_rowid()`,
    []
  );
  res.status(201).json({ message: msg });
}

// ---------------------------------------------------------------------------
// Для персонала (модератор/админ/Команда Проекта)
// ---------------------------------------------------------------------------

// GET /api/support/staff/tickets — все тикеты с фильтром по статусу
function listTickets(req, res) {
  const status = req.query.status || 'open'; // open | claimed | closed | all
  const params = [];
  let where = '';
  if (status !== 'all') {
    where = 'WHERE t.status = ?';
    params.push(status);
  }
  const tickets = db.all(
    `SELECT t.*,
            u.nickname  as user_nickname,
            u.avatar    as user_avatar,
            u2.nickname as claimed_nickname,
            (SELECT COUNT(*) FROM support_messages WHERE ticket_id = t.id) as msg_count,
            (SELECT content FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message
     FROM support_tickets t
     LEFT JOIN users u  ON t.user_id    = u.id
     LEFT JOIN users u2 ON t.claimed_by = u2.id
     ${where}
     ORDER BY t.updated_at DESC`,
    params
  );
  res.json({ tickets });
}

// PUT /api/support/staff/tickets/:id/claim — принять тикет
function claimTicket(req, res) {
  const ticket = db.get('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Обращение не найдено' });
  if (ticket.status === 'closed') return res.status(400).json({ error: 'Обращение уже закрыто' });

  db.run(
    `UPDATE support_tickets SET status = 'claimed', claimed_by = ?, updated_at = datetime('now') WHERE id = ?`,
    [req.user.id, ticket.id]
  );

  // Добавляем системное сообщение о принятии
  db.run(
    `INSERT INTO support_messages (ticket_id, sender_id, is_staff, content) VALUES (?, ?, 1, ?)`,
    [ticket.id, req.user.id, `— Обращение принято сотрудником ${req.user.nickname}. Скоро последует ответ.`]
  );
  db.run(`UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?`, [ticket.id]);

  if (ticket.user_id) {
    createNotification(
      ticket.user_id, 'system',
      `Ваше обращение «${ticket.subject}» принято сотрудником ${req.user.nickname}`,
      `/support.html?ticket=${ticket.id}`
    );
  }

  res.json({ message: 'Обращение принято', ticket: db.get('SELECT * FROM support_tickets WHERE id = ?', [ticket.id]) });
}

// PUT /api/support/staff/tickets/:id/close — закрыть тикет
function closeTicket(req, res) {
  const ticket = db.get('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Обращение не найдено' });

  db.run(
    `UPDATE support_tickets SET status = 'closed', updated_at = datetime('now') WHERE id = ?`,
    [ticket.id]
  );
  db.run(
    `INSERT INTO support_messages (ticket_id, sender_id, is_staff, content) VALUES (?, ?, 1, ?)`,
    [ticket.id, req.user.id, `— Обращение закрыто сотрудником ${req.user.nickname}. Если вопрос остался — создайте новое обращение.`]
  );

  if (ticket.user_id) {
    createNotification(
      ticket.user_id, 'system',
      `Ваше обращение «${ticket.subject}» закрыто`,
      `/support.html?ticket=${ticket.id}`
    );
  }

  res.json({ message: 'Обращение закрыто' });
}

module.exports = {
  createTicket,
  myTickets,
  getTicket,
  addMessage,
  listTickets,
  claimTicket,
  closeTicket,
};
