const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorHandler');
const { getAccessSecret } = require('../utils/tokens');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, getAccessSecret());
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Access token expired', 401, 'UNAUTHENTICATED');
      }
      throw new AppError('Invalid access token', 401, 'UNAUTHENTICATED');
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError('User no longer exists', 401, 'UNAUTHENTICATED');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, getAccessSecret());
    } catch {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.id);
    req.user = user || null;
    next();
  } catch {
    req.user = null;
    next();
  }
}

module.exports = {
  requireAuth,
  optionalAuth,
};
