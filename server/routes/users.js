// ============================================================================
// routes/users.js
// ============================================================================

const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const userController = require('../controllers/userController');

router.get('/online', userController.listOnline);
router.get('/', userController.listUsers);
router.get('/:id', userController.getUser);

router.put(
  '/me',
  requireAuth,
  [
    body('nickname')
      .optional()
      .trim()
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Zа-яА-ЯёЁ0-9_-]+$/)
      .withMessage('Никнейм может содержать только буквы, цифры, _ и -'),
    body('status').optional().isLength({ max: 100 }),
    body('about').optional().isLength({ max: 360 }).withMessage('О себе — максимум 360 символов'),
  ],
  validate,
  userController.updateMe
);

router.put('/me/password', requireAuth, userController.changePassword);
router.put('/me/avatar',   requireAuth, uploadAvatar.single('avatar'),  userController.updateAvatar);
router.put('/me/banner',   requireAuth, uploadAvatar.single('banner'),   userController.updateBanner);

// Только owner может ставить/удалять баннер другому пользователю
router.put('/:id/banner',    requireAuth, uploadAvatar.single('banner'), userController.setUserBanner);
router.delete('/:id/banner', requireAuth, userController.removeUserBanner);

module.exports = router;
