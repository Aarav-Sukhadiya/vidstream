/**
 * Vitest global setup: guarantees tests run against an isolated database.
 *
 * - If TEST_MONGODB_URI is set (e.g. the mongo service container in CI), it is used.
 * - Otherwise an in-memory MongoDB is started with mongodb-memory-server.
 *
 * MONGODB_URI is always overwritten here so the value from server/.env (which may
 * point at a real cluster) can never leak into the test run.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export async function setup() {
  process.env.NODE_ENV = 'test';

  if (process.env.TEST_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
    return;
  }

  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('vidstream_test');
}

export async function teardown() {
  if (mongod) await mongod.stop();
}
