import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/unit/**/*.test.ts', '__tests__/unit/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', '.next'],
    // Node 26 can crash in the default thread pool after tests have passed.
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
