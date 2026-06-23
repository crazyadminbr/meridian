// ============================================================================
// middleware/validate.js
// Универсальный обработчик результатов валидации express-validator.
// Также служит дополнительным барьером против некорректных/вредоносных данных
// (наряду с параметризованными SQL-запросами это часть защиты от инъекций).
// ============================================================================

const { validationResult } = require('express-validator');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }
  next();
};
