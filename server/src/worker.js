/**
 * Standalone transcode worker, for running with WORKER_MODE=separate.
 * Realtime status events are only delivered by the API process's inline worker;
 * clients fall back to polling the Studio list when the worker runs separately.
 */
require('dotenv').config();
const { connectDB, disconnectDB } = require('./config/db');
const { startWorkerLoop, stopWorkerLoop } = require('./workers');

async function main() {
  await connectDB();
  startWorkerLoop();

  const shutdown = async () => {
    stopWorkerLoop();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Worker] Startup error:', err.message);
  process.exit(1);
});
