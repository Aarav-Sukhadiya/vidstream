require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const videoRoutes = require('./routes/video');
const webhookRoutes = require('./routes/webhook');
const commentRoutes = require('./routes/comment');
const channelRoutes = require('./routes/channel');
const feedRoutes = require('./routes/feed');
const { mongoSanitize } = require('./middleware/sanitize');
const { apiRateLimiter } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust reverse proxy (e.g. Render, Vercel, AWS ALB) for accurate protocol and client IP
app.set('trust proxy', 1);

// Security and utility middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https:',
          'https://images.unsplash.com',
          'https://res.cloudinary.com',
        ],
        mediaSrc: [
          "'self'",
          'data:',
          'blob:',
          'https:',
          'https://test-streams.mux.dev',
          'https://res.cloudinary.com',
        ],
        connectSrc: [
          "'self'",
          'https:',
          'wss:',
          'ws:',
          'https://test-streams.mux.dev',
          'https://res.cloudinary.com',
          'https://api.cloudinary.com',
        ],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// Health check endpoints (both /health and /api/health) - placed before rate limiters
app.use('/', healthRoutes);
app.use('/api', healthRoutes);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize);
app.use('/api', apiRateLimiter);

// Static media delivery for transcoded HLS streams and thumbnails
app.use('/media', express.static(path.join(__dirname, '../temp')));

// Serve built production frontend assets if present
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Authentication routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

// Current user profile route
app.use('/api/me', meRoutes);
app.use('/me', meRoutes);

// Video management and upload routes
app.use('/api/videos', videoRoutes);
app.use('/videos', videoRoutes);

// Comment routes
app.use('/api/comments', commentRoutes);
app.use('/comments', commentRoutes);

// Webhook routes (Cloudinary notifications)
app.use('/webhooks', webhookRoutes);
app.use('/api/webhooks', webhookRoutes);

// Channel routes (subscription, channel profile)
app.use('/api/channels', channelRoutes);
app.use('/channels', channelRoutes);

// Feed routes (subscriptions feed)
app.use('/api/feed', feedRoutes);
app.use('/feed', feedRoutes);

// SPA client fallback for non-API, non-media routes in production
if (fs.existsSync(publicPath)) {
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/media') ||
      req.path.startsWith('/webhooks') ||
      req.path.startsWith('/channels') ||
      req.path.startsWith('/feed') ||
      req.path === '/health'
    ) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Catch-all 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
