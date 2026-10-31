const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorHandler');
const { getAccessSecret } = require('../utils/tokens');

function readBearerToken(req) {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function loadUser(token) {
  const decoded = jwt.verify(token, getAccessSecret());
  return User.findById(decoded.id).select('-passwordHash');
}

async function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));

  try {
    const user = await loadUser(token);
    if (!user) throw new AppError('User no longer exists', 401, 'UNAUTHENTICATED');
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Access token expired', 401, 'UNAUTHENTICATED'));
    }
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
      return next(new AppError('Invalid access token', 401, 'UNAUTHENTICATED'));
    }
    next(err);
  }
}

/** Attach req.user when a valid token is present; never rejects the request. */
async function optionalAuth(req, res, next) {
  req.user = null;
  const token = readBearerToken(req);
  if (!token) return next();

  try {
    req.user = (await loadUser(token)) || null;
  } catch {
    req.user = null;
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
};
