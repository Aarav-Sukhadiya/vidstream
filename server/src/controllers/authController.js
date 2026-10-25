const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { AppError } = require('../middleware/errorHandler');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenCookieOptions,
  REFRESH_TOKEN_EXPIRY_DAYS,
} = require('../utils/tokens');

async function register(req, res, next) {
  try {
    const { email, password, handle, displayName, bio } = req.body;

    // Check for duplicate email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new AppError('Email is already registered', 409, 'CONFLICT', {
        email: 'Email is already registered',
      });
    }

    // Check for duplicate handle
    const existingHandle = await User.findOne({ handle });
    if (existingHandle) {
      throw new AppError('Handle is already taken', 409, 'CONFLICT', {
        handle: 'Handle is already taken',
      });
    }

    // Hash password with bcrypt cost 12
    const passwordHash = await User.hashPassword(password);

    // Create user record
    const user = await User.create({
      email,
      handle,
      displayName,
      bio: bio || '',
      passwordHash,
    });

    // Create refresh token session
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
      user: user._id,
      tokenHash,
      expiresAt,
    });

    const accessToken = generateAccessToken(user);

    res.cookie('refreshToken', rawRefreshToken, getRefreshTokenCookieOptions());

    res.status(201).json({
      user: user.toJSON(),
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'UNAUTHENTICATED');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'UNAUTHENTICATED');
    }

    // Create refresh token session
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
      user: user._id,
      tokenHash,
      expiresAt,
    });

    const accessToken = generateAccessToken(user);

    res.cookie('refreshToken', rawRefreshToken, getRefreshTokenCookieOptions());

    res.status(200).json({
      user: user.toJSON(),
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
};
