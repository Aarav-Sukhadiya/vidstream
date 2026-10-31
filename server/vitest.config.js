import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/globalSetup.js'],
    env: { NODE_ENV: 'test' },
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
