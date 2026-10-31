const express = require('express');
const { register, login, refresh, logout } = require('../controllers/authController');
const { validateBody } = require('../middleware/validate');
const { authRateLimiter } = require('../middleware/rateLimit');
const { registerSchema, loginSchema } = require('../schemas/auth');

const router = express.Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), register);
router.post('/login', authRateLimiter, validateBody(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
