require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const videoRoutes = require('./routes/video');
const webhookRoutes = require('./routes/webhook');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security and utility middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static media delivery for transcoded HLS streams and thumbnails
app.use('/media', express.static(path.join(__dirname, '../temp')));

// Health check endpoints (both /health and /api/health)
app.use('/', healthRoutes);
app.use('/api', healthRoutes);

// Authentication routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

// Current user profile route
app.use('/api/me', meRoutes);
app.use('/me', meRoutes);

// Video management and upload routes
app.use('/api/videos', videoRoutes);
app.use('/videos', videoRoutes);

// Webhook routes (Cloudinary notifications)
app.use('/webhooks', webhookRoutes);
app.use('/api/webhooks', webhookRoutes);

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
