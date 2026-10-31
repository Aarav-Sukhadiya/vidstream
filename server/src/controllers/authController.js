const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { AppError } = require('../middleware/errorHandler');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
  REFRESH_TOKEN_TTL_MS,
} = require('../utils/tokens');

// A rotated token presented again within this window is treated as a benign
// concurrent refresh (two tabs, React StrictMode double effects) rather than theft.
const ROTATION_GRACE_MS = 30 * 1000;

/**
 * Create a refresh-token session, set the cookie and send the auth payload.
 */
async function issueSession(res, user, status = 200) {
  const rawRefreshToken = generateRefreshToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(rawRefreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  res.cookie('refreshToken', rawRefreshToken, getRefreshTokenCookieOptions());
  res.status(status).json({
    user: user.toJSON(),
    accessToken: generateAccessToken(user),
  });
}

async function register(req, res, next) {
  try {
    const { email, password, handle, displayName, bio } = req.body;

    const [existingEmail, existingHandle] = await Promise.all([
      User.exists({ email }),
      User.exists({ handle }),
    ]);
    if (existingEmail) {
      throw new AppError('Email is already registered', 409, 'CONFLICT', {
        email: 'Email is already registered',
      });
    }
    if (existingHandle) {
      throw new AppError('Handle is already taken', 409, 'CONFLICT', {
        handle: 'Handle is already taken',
      });
    }

    const user = await User.create({
      email,
      handle,
      displayName,
      bio: bio || '',
      passwordHash: await User.hashPassword(password),
    });

    await issueSession(res, user, 201);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401, 'UNAUTHENTICATED');
    }

    await issueSession(res, user);
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

    const tokenDoc = await RefreshToken.findOne({ tokenHash: hashToken(rawRefreshToken) });
    if (!tokenDoc) {
      res.clearCookie('refreshToken', getClearCookieOptions());
      throw new AppError('Invalid refresh token', 401, 'UNAUTHENTICATED');
    }

    if (tokenDoc.revoked || tokenDoc.replacedBy) {
      const rotatedRecently =
        tokenDoc.replacedBy && Date.now() - tokenDoc.updatedAt.getTime() < ROTATION_GRACE_MS;
      if (rotatedRecently) {
        // Concurrent refresh: the sibling request already received the new cookie.
        // Do not clear the cookie (that would wipe the fresh one) and do not revoke.
        throw new AppError('Refresh already in progress', 401, 'UNAUTHENTICATED');
      }
      // Reuse of an old token: assume theft and invalidate every session for this user
      await RefreshToken.updateMany({ user: tokenDoc.user }, { $set: { revoked: true } });
      res.clearCookie('refreshToken', getClearCookieOptions());
      throw new AppError('Session revoked due to token reuse detection', 401, 'UNAUTHENTICATED');
    }

    if (tokenDoc.expiresAt < new Date()) {
      tokenDoc.revoked = true;
      await tokenDoc.save();
      res.clearCookie('refreshToken', getClearCookieOptions());
      throw new AppError('Refresh token expired', 401, 'UNAUTHENTICATED');
    }

    const user = await User.findById(tokenDoc.user);
    if (!user) {
      res.clearCookie('refreshToken', getClearCookieOptions());
      throw new AppError('User not found', 401, 'UNAUTHENTICATED');
    }

    // Rotate: atomically mark the old token as replaced so two racing requests
    // cannot both rotate the same token.
    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const claimed = await RefreshToken.findOneAndUpdate(
      { _id: tokenDoc._id, revoked: false, replacedBy: null },
      { $set: { revoked: true, replacedBy: newTokenHash } }
    );
    if (!claimed) {
      throw new AppError('Refresh already in progress', 401, 'UNAUTHENTICATED');
    }

    await RefreshToken.create({
      user: user._id,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    res.cookie('refreshToken', newRawRefreshToken, getRefreshTokenCookieOptions());
    res.status(200).json({
      user: user.toJSON(),
      accessToken: generateAccessToken(user),
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.cookies.refreshToken;
    if (rawRefreshToken) {
      await RefreshToken.updateOne(
        { tokenHash: hashToken(rawRefreshToken) },
        { $set: { revoked: true } }
      );
    }

    res.clearCookie('refreshToken', getClearCookieOptions());
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

function getMe(req, res) {
  res.status(200).json({ user: req.user.toJSON() });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
};
