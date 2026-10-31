const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

function readSecret(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`);
  }
  return devFallback;
}

function getAccessSecret() {
  return readSecret('JWT_ACCESS_SECRET', 'dev_only_access_secret_not_for_production');
}

function getRefreshSecret() {
  return readSecret('JWT_REFRESH_SECRET', 'dev_only_refresh_secret_not_for_production');
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      handle: user.handle,
      email: user.email,
    },
    getAccessSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getClearCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
}

function getRefreshTokenCookieOptions() {
  return { ...getClearCookieOptions(), maxAge: REFRESH_TOKEN_TTL_MS };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
  REFRESH_TOKEN_EXPIRY_DAYS,
  REFRESH_TOKEN_TTL_MS,
  getAccessSecret,
  getRefreshSecret,
};
