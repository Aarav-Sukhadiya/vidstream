require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { getCorsOptions } = require('./config/cors');
const { getAccessSecret, getRefreshSecret } = require('./utils/tokens');
const { initRealtime } = require('./realtime');
const { startWorkerLoop, stopWorkerLoop } = require('./workers');

const server = http.createServer(app);
const io = new Server(server, { cors: getCorsOptions() });
initRealtime(io);
app.set('io', io);

const PORT = process.env.PORT || 10000;
const runInlineWorker = !process.env.WORKER_MODE || process.env.WORKER_MODE === 'inline';

async function startServer() {
  // Fail fast on missing production secrets instead of on the first login
  getAccessSecret();
  getRefreshSecret();

  // Listen immediately so platform health checks pass while the DB handshake runs
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[VidStream Server] Listening on http://0.0.0.0:${PORT}`);
  });

  try {
    await connectDB();
    if (runInlineWorker) startWorkerLoop();
  } catch (err) {
    console.error('[VidStream Server] Startup error:', err.message);
    process.exit(1);
  }
}

let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[VidStream Server] Received ${signal}. Shutting down...`);

  stopWorkerLoop();
  io.close();

  // Force exit if connections do not drain in time
  setTimeout(() => {
    console.error('[VidStream Server] Could not close connections in time, forcing exit');
    process.exit(1);
  }, 10000).unref();

  server.close(async () => {
    try {
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('[VidStream Server] Error during shutdown:', err);
      process.exit(1);
    }
  });
}

if (require.main === module) {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  startServer();
}

module.exports = { app, server, io };
