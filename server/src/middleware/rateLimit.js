const rateLimit = require('express-rate-limit');

const isTest = () => process.env.NODE_ENV === 'test';
const userOrIp = (req) => req.user?._id?.toString() || req.ip || 'unknown';

function createLimiter({ windowMs, max, message, keyGenerator, skip = isTest }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMIT_EXCEEDED', message } });
    },
  });
}

/** General API limiter: 300 requests / 15 min per IP */
const apiRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests from this IP. Please try again later.',
});

/** Login / register limiter: 30 attempts / 15 min per IP */
const authRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

/** Comments: 10 per minute per user (enforced in tests too) */
const commentRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: userOrIp,
  skip: () => false,
  message: 'Rate limit exceeded: You can only post up to 10 comments per minute.',
});

/** Reactions: 60 per minute per user */
const reactionRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userOrIp,
  skip: () => false,
  message: 'Too many reactions submitted. Please slow down.',
});

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  commentRateLimiter,
  reactionRateLimiter,
};
