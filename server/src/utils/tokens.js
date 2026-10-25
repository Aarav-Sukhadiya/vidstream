const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function getAccessSecret() {
  return process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_for_tests_32chars';
}

function getRefreshSecret() {
  return process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_for_tests_32chars';
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

function getRefreshTokenCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
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

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
  REFRESH_TOKEN_EXPIRY_DAYS,
  getAccessSecret,
  getRefreshSecret,
};
