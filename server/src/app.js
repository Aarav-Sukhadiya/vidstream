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
const { getCorsOptions } = require('./config/cors');
const { mongoSanitize } = require('./middleware/sanitize');
const { apiRateLimiter } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errorHandler');
const { TEMP_BASE } = require('./workers/paths');

const app = express();
const publicPath = path.join(__dirname, '../public');
const hasClientBuild = fs.existsSync(path.join(publicPath, 'index.html'));

// Trust the first reverse proxy (Render, Vercel) for correct protocol and client IP
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Concise access log (skips health probes to keep logs readable)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    if (/^\/(api\/)?(health|healthz|ping)$/.test(req.path)) return next();
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });
    next();
  });
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

app.use(cors(getCorsOptions()));

// Health checks: registered before rate limiting and body parsing
app.use('/api', healthRoutes);
app.use('/', healthRoutes);
if (!hasClientBuild) {
  // API-only deployments: let platform probes hit the root URL too
  app.all('/', healthRoutes.handleHealth);
}

app.use(cookieParser());
app.use(
  express.json({
    limit: '100kb',
    // Keep the exact bytes for webhook signature verification
    verify: (req, _res, buf) => {
      if (req.originalUrl.includes('/webhooks/')) req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(mongoSanitize);

// Transcoded HLS output. Only the hls/ folder is public (raw sources stay private).
// Segments never change once written; playlists may be regenerated on retry.
app.use(
  '/media',
  (req, res, next) => (/^\/[a-f0-9]{24}\/hls\//.test(req.path) ? next() : res.status(404).end()),
  express.static(TEMP_BASE, {
    fallthrough: false,
    setHeaders(res, filePath) {
      res.setHeader(
        'Cache-Control',
        filePath.endsWith('.m3u8') ? 'public, max-age=60' : 'public, max-age=31536000, immutable'
      );
    },
  })
);

// Cloudinary notifications (kept outside /api so existing webhook URLs keep working)
app.use('/webhooks', webhookRoutes);

const api = express.Router();
api.use(apiRateLimiter);
api.use('/auth', authRoutes);
api.use('/me', meRoutes);
api.use('/videos', videoRoutes);
api.use('/comments', commentRoutes);
api.use('/channels', channelRoutes);
api.use('/feed', feedRoutes);
api.use('/webhooks', webhookRoutes);
app.use('/api', api);

// Single-container deployments: serve the built client and fall back to index.html
if (hasClientBuild) {
  app.use(
    express.static(publicPath, {
      index: false,
      setHeaders(res, filePath) {
        // Vite emits content-hashed filenames under /assets
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.get(/^\/(?!api\/|api$|media\/|webhooks\/|socket\.io\/).*/, (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.path}` },
  });
});

app.use(errorHandler);

module.exports = app;
