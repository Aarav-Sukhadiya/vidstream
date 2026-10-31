const mongoose = require('mongoose');

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'];

/**
 * Refuse to run the test suite against anything that is not a local database.
 * Test suites wipe whole collections, so pointing them at a shared/remote cluster
 * (e.g. the MONGODB_URI loaded from server/.env) would destroy real data.
 */
function assertSafeTestUri(uri) {
  if (process.env.NODE_ENV !== 'test') return;
  let host = '';
  try {
    host = new URL(uri).hostname;
  } catch {
    // fall through to the error below
  }
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(
      `[MongoDB] Refusing to connect to non-local database "${host || uri}" while NODE_ENV=test. ` +
        'Tests delete data; use a local or in-memory MongoDB.'
    );
  }
}

async function connectDB(uri) {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/vidstream';
  assertSafeTestUri(mongoUri);

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      autoIndex: process.env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 30000,
    });

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
    }
    return conn.connection;
  } catch (err) {
    console.error(`[MongoDB] Connection error: ${err.message}`);
    throw err;
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

if (process.env.NODE_ENV !== 'test') {
  mongoose.connection.on('disconnected', () => console.warn('[MongoDB] Connection lost'));
  mongoose.connection.on('reconnected', () => console.log('[MongoDB] Connection re-established'));
}

module.exports = { connectDB, disconnectDB, assertSafeTestUri };
