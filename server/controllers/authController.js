// ============================================================================
// controllers/authController.js
// Регистрация, вход, подтверждение Email, восстановление пароля.
// ============================================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { publicUser, syncOwnerRole } = require('../utils/helpers');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

function signToken(user, rememberMe) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? '30d' : '1d',
  });
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { nickname, email, password } = req.body;

    // Проверка уникальности ника и email (параметризованный запрос — защита от SQL-инъекций)
    const existingEmail = db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingEmail) return res.status(409).json({ error: 'Этот email уже зарегистрирован' });

    const existingNick = db.get('SELECT id FROM users WHERE nickname = ?', [nickname]);
    if (existingNick) return res.status(409).json({ error: 'Этот никнейм уже занят' });

    const passwordHash = await bcrypt.hash(password, 10);
    const verifyToken = uuidv4();

    const { lastInsertRowid } = db.run(
      `INSERT INTO users (nickname, email, password_hash, verify_token) VALUES (?, ?, ?, ?)`,
      [nickname, email.toLowerCase(), passwordHash, verifyToken]
    );

    await sendVerificationEmail(email.toLowerCase(), verifyToken);

    let user = db.get('SELECT * FROM users WHERE id = ?', [lastInsertRowid]);
    user = syncOwnerRole(user);
    res.status(201).json({
      message: 'Регистрация успешна! Проверьте почту для подтверждения email.',
      user: publicUser(user),
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
}

// GET /api/auth/verify/:token
function verifyEmail(req, res) {
  const { token } = req.params;
  const user = db.get('SELECT * FROM users WHERE verify_token = ?', [token]);
  if (!user) return res.status(400).json({ error: 'Неверная или устаревшая ссылка подтверждения' });

  db.run('UPDATE users SET is_verified = 1, verify_token = NULL WHERE id = ?', [user.id]);
  res.json({ message: 'Email успешно подтверждён! Теперь вы можете войти.' });
}

// POST /api/auth/resend-verification
async function resendVerification(req, res) {
  const { email } = req.body;
  const user = db.get('SELECT * FROM users WHERE email = ?', [String(email || '').toLowerCase()]);
  // Не раскрываем, существует ли email в базе — нейтральный ответ в любом случае
  if (user && !user.is_verified) {
    const verifyToken = uuidv4();
    db.run('UPDATE users SET verify_token = ? WHERE id = ?', [verifyToken, user.id]);
    await sendVerificationEmail(user.email, verifyToken);
  }
  res.json({ message: 'Если такой email существует и не подтверждён, письмо отправлено повторно.' });
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { login: loginField, password, rememberMe } = req.body;
    if (!loginField || !password) {
      return res.status(400).json({ error: 'Укажите логин (email или ник) и пароль' });
    }

    const user = db.get(
      'SELECT * FROM users WHERE email = ? OR nickname = ?',
      [String(loginField).toLowerCase(), loginField]
    );
    if (!user) return res.status(401).json({ error: 'Неверные данные для входа' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверные данные для входа' });

    let syncedUser = syncOwnerRole(user);

    if (syncedUser.is_banned) {
      return res.status(403).json({ error: `Аккаунт заблокирован. Причина: ${syncedUser.ban_reason || 'не указана'}` });
    }
    if (!syncedUser.is_verified) {
      return res.status(403).json({ error: 'Подтвердите email перед входом. Проверьте почту.' });
    }

    db.run('UPDATE users SET last_online = datetime(\'now\') WHERE id = ?', [syncedUser.id]);

    const token = signToken(syncedUser, !!rememberMe);
    res.json({ message: 'Вход выполнен успешно', token, user: publicUser(syncedUser) });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
}

// GET /api/auth/me
function me(req, res) {
  const user = syncOwnerRole(req.user);
  res.json({ user: publicUser(user) });
}

// POST /api/auth/logout
// Явный выход — сразу очищает "последний онлайн", чтобы пользователь не выглядел
// онлайн ещё несколько минут после выхода из аккаунта (раньше статус держался до
// истечения 5-минутного окна автоматически, что и выглядело как баг "не в сети, но онлайн").
function logout(req, res) {
  db.run('UPDATE users SET last_online = NULL WHERE id = ?', [req.user.id]);
  res.json({ message: 'Вы вышли из аккаунта' });
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = db.get('SELECT * FROM users WHERE email = ?', [String(email || '').toLowerCase()]);

  if (user) {
    const resetToken = crypto.randomBytes(24).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000; // 1 час
    db.run('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?', [resetToken, expires, user.id]);
    await sendPasswordResetEmail(user.email, resetToken);
  }
  // Одинаковый ответ независимо от того, найден email или нет — защита от перебора email-ов
  res.json({ message: 'Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля.' });
}

// POST /api/auth/reset-password/:token
async function resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;

  const user = db.get('SELECT * FROM users WHERE reset_token = ?', [token]);
  if (!user || !user.reset_expires || user.reset_expires < Date.now()) {
    return res.status(400).json({ error: 'Ссылка для сброса пароля недействительна или устарела' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  db.run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?', [
    passwordHash,
    user.id,
  ]);
  res.json({ message: 'Пароль успешно изменён. Теперь вы можете войти с новым паролем.' });
}

module.exports = { register, verifyEmail, resendVerification, login, me, logout, forgotPassword, resetPassword };
