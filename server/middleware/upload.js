// ============================================================================
// middleware/upload.js
// Загрузка файлов аватаров через multer, с проверкой типа и размера файла.
// ============================================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const unique = `${req.user.id}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error('Разрешены только изображения PNG, JPEG, WEBP или GIF'));
  }
  cb(null, true);
}

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 МБ максимум
});

module.exports = { uploadAvatar };
