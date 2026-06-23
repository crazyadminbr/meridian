// ============================================================================
// server.js
// Главная точка входа сервера форума «Кровавый Меридиан».
//
// Запуск:
//   cd server
//   npm install
//   npm start
//
// Сервер раздаёт и API (/api/...), и статичные файлы клиента (папка /client),
// поэтому весь сайт доступен по одному адресу: http://localhost:5000
// ============================================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Базовые middleware безопасности и парсинга
// ---------------------------------------------------------------------------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' })); // парсинг JSON-тела запросов
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Простая защита от перебора запросов (без сторонних зависимостей):
// ограничиваем число запросов с одного IP в окне времени.
const rateBuckets = new Map();
app.use('/api/', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 240;

  const bucket = rateBuckets.get(ip) || { count: 0, start: now };
  if (now - bucket.start > windowMs) {
    bucket.count = 0;
    bucket.start = now;
  }
  bucket.count += 1;
  rateBuckets.set(ip, bucket);

  if (bucket.count > maxRequests) {
    return res.status(429).json({ error: 'Слишком много запросов. Попробуйте позже.' });
  }
  next();
});

// ---------------------------------------------------------------------------
// Статика: загруженные файлы (аватары) и клиентское приложение
// На продакшне (за Nginx) Nginx раздаёт статику сам и сюда запросы не доходят.
// При локальной разработке Node.js раздаёт с кэш-заголовками.
// ---------------------------------------------------------------------------
const staticOptions = {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    // Аватары и иконки — 30 дней
    if (/\/(uploads|icons)\//.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
    // CSS/JS — 7 дней (версионируются через query-string при изменениях)
    else if (/\.(css|js)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
    // HTML — не кэшировать
    else if (/\.html$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
};

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));
app.use('/icons',   express.static(path.join(__dirname, '..', 'client', 'icons'), staticOptions));
app.use(express.static(path.join(__dirname, '..', 'client'), staticOptions));

// ---------------------------------------------------------------------------
// API-маршруты
// ---------------------------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/forum', require('./routes/forum'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/news', require('./routes/news'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/support', require('./routes/support'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', name: 'Кровавый Меридиан API' }));

// ---------------------------------------------------------------------------
// Fallback на index.html для прямых переходов по адресу (не трогаем /api и /uploads)
// ---------------------------------------------------------------------------
app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ---------------------------------------------------------------------------
// Централизованный обработчик ошибок (включая ошибки multer — размер/тип файла)
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Необработанная ошибка:', err.message);
  if (err.message && err.message.includes('Разрешены только изображения')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Файл слишком большой (максимум 3 МБ)' });
  }
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log('');
  console.log('🩸  ============================================ 🩸');
  console.log('   Форум «Кровавый Меридиан» запущен!');
  console.log(`   http://localhost:${PORT}`);
  console.log('🩸  ============================================ 🩸');
  console.log('');
});
