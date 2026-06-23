// ============================================================================
// utils/mailer.js
// Отправка писем (подтверждение Email, восстановление пароля).
//
// Если в .env заданы SMTP_HOST/SMTP_USER/SMTP_PASS — письма уходят по-настоящему
// через nodemailer. Если нет — письмо просто красиво печатается в консоль сервера
// со ссылкой внутри, чтобы можно было тестировать проект без реального почтового
// ящика. Замените на свои SMTP-данные (например, Gmail App Password или Mailtrap.io)
// для боевого использования.
// ============================================================================

const nodemailer = require('nodemailer');

const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
if (hasSmtp) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Базовый HTML-шаблон письма в стиле форума
 */
function wrapTemplate({ title, body, buttonText, buttonUrl }) {
  return `
  <div style="background:#0a0e1a;padding:40px 20px;font-family:Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#121933;border-radius:18px;padding:32px;border:1px solid #1f2b52;">
      <h1 style="color:#3ec1ff;font-size:22px;margin:0 0 16px;">Кровавый Меридиан</h1>
      <h2 style="color:#e8ecff;font-size:18px;margin:0 0 12px;">${title}</h2>
      <p style="color:#9aa6c7;font-size:14px;line-height:1.6;">${body}</p>
      ${buttonUrl ? `
      <a href="${buttonUrl}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:linear-gradient(135deg,#2dd4ff,#3a7bff);color:#04101f;font-weight:bold;border-radius:14px;text-decoration:none;">${buttonText}</a>
      <p style="color:#5c6790;font-size:12px;margin-top:18px;word-break:break-all;">Если кнопка не работает, скопируйте ссылку: ${buttonUrl}</p>
      ` : ''}
    </div>
  </div>`;
}

/**
 * Отправить письмо. Если SMTP не настроен — выводит письмо в консоль (режим разработки).
 */
async function sendMail({ to, subject, title, body, buttonText, buttonUrl }) {
  const html = wrapTemplate({ title, body, buttonText, buttonUrl });

  if (!hasSmtp) {
    console.log('\n✉️  ───────── EMAIL (режим разработки, SMTP не настроен) ─────────');
    console.log(`Кому: ${to}`);
    console.log(`Тема: ${subject}`);
    if (buttonUrl) console.log(`Ссылка: ${buttonUrl}`);
    console.log('─────────────────────────────────────────────────────────────\n');
    return { dev: true };
  }

  return transporter.sendMail({
    from: process.env.SMTP_FROM || '"Кровавый Меридиан" <no-reply@meridian.local>',
    to,
    subject,
    html,
  });
}

// Базовый URL для ссылок в письмах.
// В .env должен быть прописан CLIENT_URL=https://forum.ylamanager.ru
// Если не задан (локальная разработка) — используем localhost.
// ВАЖНО: на продакшн-сервере CLIENT_URL обязателен, иначе ссылки в письмах
// будут вести на localhost, что является распространённой ошибкой при деплое.
function getBaseUrl() {
  const url = process.env.CLIENT_URL;
  if (!url || url.includes('localhost')) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  CLIENT_URL не задан или указывает на localhost в production-режиме!');
      console.warn('   Установите CLIENT_URL=https://forum.ylamanager.ru в server/.env');
    }
  }
  return url || 'http://localhost:5000';
}

async function sendVerificationEmail(to, token) {
  const url = `${getBaseUrl()}/verify.html?token=${token}`;
  return sendMail({
    to,
    subject: 'Подтвердите регистрацию — Кровавый Меридиан',
    title: 'Подтверждение Email',
    body: 'Спасибо за регистрацию на форуме «Кровавый Меридиан»! Подтвердите свой email, чтобы активировать аккаунт.',
    buttonText: 'Подтвердить email',
    buttonUrl: url,
  });
}

async function sendPasswordResetEmail(to, token) {
  const url = `${getBaseUrl()}/reset-password.html?token=${token}`;
  return sendMail({
    to,
    subject: 'Восстановление пароля — Кровавый Меридиан',
    title: 'Восстановление пароля',
    body: 'Вы запросили восстановление пароля. Если это были не вы — просто проигнорируйте это письмо. Ссылка действительна 1 час.',
    buttonText: 'Сбросить пароль',
    buttonUrl: url,
  });
}

module.exports = { sendMail, sendVerificationEmail, sendPasswordResetEmail };
