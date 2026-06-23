// ============================================================================
// routes/auth.js
// Маршруты регистрации/авторизации.
// ============================================================================

const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');

router.post(
  '/register',
  [
    body('nickname')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Никнейм должен быть от 3 до 20 символов')
      .matches(/^[a-zA-Zа-яА-ЯёЁ0-9_-]+$/)
      .withMessage('Никнейм может содержать только буквы, цифры, _ и -'),
    body('email').isEmail().withMessage('Введите корректный email').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Пароль должен быть не короче 6 символов'),
  ],
  validate,
  authController.register
);

router.get('/verify/:token', authController.verifyEmail);
router.post('/resend-verification', [body('email').isEmail()], validate, authController.resendVerification);

router.post(
  '/login',
  [
    body('login').trim().notEmpty().withMessage('Укажите email или никнейм'),
    body('password').notEmpty().withMessage('Введите пароль'),
  ],
  validate,
  authController.login
);

router.get('/me', requireAuth, authController.me);
router.post('/logout', requireAuth, authController.logout);

router.post('/forgot-password', [body('email').isEmail()], validate, authController.forgotPassword);

router.post(
  '/reset-password/:token',
  [body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не короче 6 символов')],
  validate,
  authController.resetPassword
);

module.exports = router;
