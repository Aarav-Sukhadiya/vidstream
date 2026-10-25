const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, refresh, logout } = require('../controllers/authController');
const { validateBody } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../schemas/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
});

router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
