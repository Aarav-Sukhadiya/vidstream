const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { AppError } = require('../middleware/errorHandler');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
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

async function refresh(req, res, next) {
  try {
    const rawRefreshToken = req.cookies.refreshToken;
    if (!rawRefreshToken) {
      throw new AppError('Refresh token required', 401, 'UNAUTHENTICATED');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash });

    if (!tokenDoc) {
      res.clearCookie('refreshToken', getClearCookieOptions());
      throw new AppError('Invalid refresh token', 401, 'UNAUTHENTICATED');
    }

    // Reuse detection: if token is already revoked or replaced, invalidate all sessions for user
    if (tokenDoc.revoked || tokenDoc.replacedBy) {
      await RefreshToken.updateMany({ user: tokenDoc.user }, { $set: { revoked: true } });
      res.clearCookie('refreshToken', getClearCookieOptions());
      throw new AppError('Session revoked due to token reuse detection', 401, 'UNAUTHENTICATED');
    }

    // Check expiration
    if (tokenDoc.expiresAt < new Date()) {
      tokenDoc.revoked = true;
      await tokenDoc.save();
      res.clearCookie('refreshToken', getClearCookieOptions());
      throw new AppError('Refresh token expired', 401, 'UNAUTHENTICATED');
    }

    // Generate rotated refresh token
    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Invalidate old token with pointer to replacement
    tokenDoc.revoked = true;
    tokenDoc.replacedBy = newTokenHash;
    await tokenDoc.save();

    // Create new refresh token doc
    await RefreshToken.create({
      user: tokenDoc.user,
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
    });

    const user = await User.findById(tokenDoc.user);
    if (!user) {
      res.clearCookie('refreshToken', getClearCookieOptions());
      throw new AppError('User not found', 401, 'UNAUTHENTICATED');
    }

    const accessToken = generateAccessToken(user);

    // Set rotated cookie
    res.cookie('refreshToken', newRawRefreshToken, getRefreshTokenCookieOptions());

    res.status(200).json({
      user: user.toJSON(),
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.cookies.refreshToken;
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await RefreshToken.updateOne({ tokenHash }, { $set: { revoked: true } });
    }

    res.clearCookie('refreshToken', getClearCookieOptions());

    res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  res.status(200).json({
    user: req.user.toJSON(),
  });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
};
