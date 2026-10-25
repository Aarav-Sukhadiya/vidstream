require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { startWorkerLoop, stopWorkerLoop } = require('./workers');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
});

app.set('io', io);

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 10000;

async function startServer() {
  try {
    await connectDB();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[VidStream Server] Listening on http://0.0.0.0:${PORT}`);
      if (process.env.WORKER_MODE === 'inline' || !process.env.WORKER_MODE) {
        startWorkerLoop(io);
      }
    });
  } catch (err) {
    console.error('[VidStream Server] Startup error:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function gracefulShutdown(signal) {
  console.log(`\n[VidStream Server] Received ${signal}. Starting graceful shutdown...`);
  stopWorkerLoop();
  server.close(async () => {
    console.log('[VidStream Server] HTTP server closed');
    try {
      await disconnectDB();
      console.log('[VidStream Server] Shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('[VidStream Server] Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force close if graceful shutdown takes too long
  setTimeout(() => {
    console.error('[VidStream Server] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
