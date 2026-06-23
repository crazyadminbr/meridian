// ============================================================================
// database/db.js
// Слой работы с базой данных SQLite.
//
// Используется встроенный в Node.js (v22.5+) модуль "node:sqlite" — он не требует
// нативной компиляции (в отличие от better-sqlite3 / sqlite3), поэтому проект
// запускается "из коробки" одной командой `npm install && npm start`.
//
// Если вы хотите использовать MySQL вместо SQLite — замените этот файл на
// обёртку над пакетом "mysql2", сохранив тот же набор экспортируемых функций
// (get, all, run), и поправьте SQL-синтаксис (AUTOINCREMENT -> AUTO_INCREMENT и т.д.)
// ============================================================================

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'forum.db');
const dbExists = fs.existsSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);

// Включаем поддержку внешних ключей (по умолчанию в SQLite она выключена)
db.exec('PRAGMA foreign_keys = ON;');

// ----------------------------------------------------------------------------
// СХЕМА БАЗЫ ДАННЫХ
// ----------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname        TEXT NOT NULL UNIQUE,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    avatar          TEXT DEFAULT '/uploads/avatars/default.svg',
    status          TEXT DEFAULT 'Новичок форума',
    about           TEXT DEFAULT '',
    banner          TEXT DEFAULT NULL,          -- URL баннера профиля (ставит только owner/admin)
    role            TEXT NOT NULL DEFAULT 'user',     -- user | moderator | admin | owner (owner выдаётся только через .env, см. OWNER_EMAILS)
    reputation      INTEGER NOT NULL DEFAULT 0,
    is_verified     INTEGER NOT NULL DEFAULT 0,
    verify_token    TEXT,
    reset_token     TEXT,
    reset_expires   INTEGER,
    is_banned       INTEGER NOT NULL DEFAULT 0,
    ban_reason      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    last_online     TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    icon        TEXT DEFAULT '/icons/categories/chat.png',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    staff_only  INTEGER NOT NULL DEFAULT 0   -- 1 = создавать темы и отвечать могут только модераторы/админы/команда проекта
  );

  CREATE TABLE IF NOT EXISTS topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    is_pinned   INTEGER NOT NULL DEFAULT 0,
    is_locked   INTEGER NOT NULL DEFAULT 0,
    views       INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id      INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    quote_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    is_deleted    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS likes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS news (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    cover_image TEXT,
    author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS private_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,             -- reply | quote | like | pm | system
    content    TEXT NOT NULL,
    link       TEXT,
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- NULL если гость
    guest_email  TEXT,                                               -- email если гость
    subject      TEXT NOT NULL DEFAULT 'Обращение в поддержку',
    status       TEXT NOT NULL DEFAULT 'open',    -- open | claimed | closed
    claimed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- кто принял тикет
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id  INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL для гостевых (редко)
    is_staff   INTEGER NOT NULL DEFAULT 0,                       -- 1 = сообщение от персонала
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_user   ON support_tickets(user_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
  CREATE INDEX IF NOT EXISTS idx_smsg_ticket    ON support_messages(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_pm_pair ON private_messages(sender_id, receiver_id);
`);

// ----------------------------------------------------------------------------
// МИГРАЦИЯ: добавляем новые колонки в уже существующие базы данных (если их ещё нет)
// ----------------------------------------------------------------------------
const categoryColumns = db.prepare('PRAGMA table_info(categories)').all().map((c) => c.name);
if (!categoryColumns.includes('staff_only')) {
  db.exec('ALTER TABLE categories ADD COLUMN staff_only INTEGER NOT NULL DEFAULT 0');
}

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumns.includes('banner')) {
  db.exec('ALTER TABLE users ADD COLUMN banner TEXT DEFAULT NULL');
}

// Создание таблиц поддержки если их ещё нет (безопасно для существующих баз)
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
if (!tables.includes('support_tickets')) {
  db.exec(`
    CREATE TABLE support_tickets (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      guest_email  TEXT,
      subject      TEXT NOT NULL DEFAULT 'Обращение в поддержку',
      status       TEXT NOT NULL DEFAULT 'open',
      claimed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE support_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id  INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_staff   INTEGER NOT NULL DEFAULT 0,
      content    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_tickets_user   ON support_tickets(user_id);
    CREATE INDEX idx_tickets_status ON support_tickets(status);
    CREATE INDEX idx_smsg_ticket    ON support_messages(ticket_id);
  `);
}

// ----------------------------------------------------------------------------
// СИНХРОНИЗАЦИЯ КАТЕГОРИЙ
// Выполняется при КАЖДОМ запуске сервера (не только при первом создании БД), чтобы
// порядок закрепления, иконки и ограничения на создание тем гарантированно
// применялись даже на уже существующей базе данных.
//   sort_order: 1-3 — закреплены первыми («Новости проекта», «Помощь игрокам», «Гайды»)
//   staff_only: 1   — создавать темы и отвечать могут только модератор/админ/Команда Проекта
// ----------------------------------------------------------------------------
const CATEGORY_CONFIG = [
  { slug: 'news', name: 'Новости проекта', description: 'Официальные новости и анонсы команды форума', icon: '/icons/categories/news.png', sort_order: 1, staff_only: 1 },
  { slug: 'help', name: 'Помощь игрокам', description: 'Официальная помощь и разъяснения от администрации и модераторов', icon: '/icons/categories/help.png', sort_order: 2, staff_only: 1 },
  { slug: 'guides', name: 'Гайды', description: 'Гайды, билды и обучающие материалы от команды проекта', icon: '/icons/categories/guide.png', sort_order: 3, staff_only: 1 },
  { slug: 'obshenie', name: 'Общение', description: 'Свободное общение на любые темы, знакомства, флуд', icon: '/icons/categories/chat.png', sort_order: 4, staff_only: 0 },
  { slug: 'bugs', name: 'Баги и ошибки', description: 'Сообщения об ошибках и багах', icon: '/icons/categories/bug.png', sort_order: 5, staff_only: 0 },
  { slug: 'suggestions', name: 'Предложения', description: 'Идеи и предложения по развитию проекта', icon: '/icons/categories/suggestion.png', sort_order: 6, staff_only: 0 },
];

const findCategory = db.prepare('SELECT id FROM categories WHERE slug = ?');
const updateCategory = db.prepare(
  'UPDATE categories SET name = ?, description = ?, icon = ?, sort_order = ?, staff_only = ? WHERE slug = ?'
);
const insertCategory = db.prepare(
  'INSERT INTO categories (name, slug, description, icon, sort_order, staff_only) VALUES (?, ?, ?, ?, ?, ?)'
);

for (const c of CATEGORY_CONFIG) {
  const existing = findCategory.get(c.slug);
  if (existing) {
    updateCategory.run(c.name, c.description, c.icon, c.sort_order, c.staff_only, c.slug);
  } else {
    insertCategory.run(c.name, c.slug, c.description, c.icon, c.sort_order, c.staff_only);
  }
}

// ----------------------------------------------------------------------------
// НАЧАЛЬНОЕ ЗАПОЛНЕНИЕ ДАННЫМИ (выполняется один раз, при первом создании файла БД)
// ----------------------------------------------------------------------------
if (!dbExists) {
  console.log('📦 Создаю новую базу данных и заполняю её начальными данными...');

  // Администратор по умолчанию — для входа в админ-панель сразу после установки.
  // ОБЯЗАТЕЛЬНО смените пароль после первого входа в реальном проекте!
  const adminHash = bcrypt.hashSync('Admin12345!', 10);
  db.prepare(
    `INSERT INTO users (nickname, email, password_hash, role, is_verified, status, about, reputation)
     VALUES (?, ?, ?, 'admin', 1, ?, ?, ?)`
  ).run(
    'Admin',
    'admin@meridian.local',
    adminHash,
    'Хранитель Меридиана',
    'Главный администратор форума «Кровавый Меридиан».',
    100
  );

  console.log('✅ База данных создана.');
  console.log('   Учётная запись администратора по умолчанию:');
  console.log('   email: admin@meridian.local | ник: Admin | пароль: Admin12345!');
  console.log('   Подсказка: роль «Команда Проекта» выдаётся только через переменную');
  console.log('   окружения OWNER_EMAILS в server/.env — см. .env.example');
}

// ----------------------------------------------------------------------------
// Вспомогательные обёртки, чтобы остальной код не зависел от конкретного API node:sqlite
// ----------------------------------------------------------------------------
module.exports = {
  raw: db,
  /** Получить одну строку */
  get(sql, params = []) {
    return db.prepare(sql).get(...params);
  },
  /** Получить массив строк */
  all(sql, params = []) {
    return db.prepare(sql).all(...params);
  },
  /** Выполнить INSERT/UPDATE/DELETE, вернуть { lastInsertRowid, changes } */
  run(sql, params = []) {
    const info = db.prepare(sql).run(...params);
    return { lastInsertRowid: Number(info.lastInsertRowid), changes: Number(info.changes) };
  },
};
