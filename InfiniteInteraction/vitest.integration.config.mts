import path from 'node:path';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { environment: 'node', env:{MODEL_CONFIGURATION_ENABLED:'true'}, include: ['__tests__/integration/**/*.test.ts'], pool: 'forks', poolOptions: { forks: { singleFork: true } }, testTimeout: 15000, hookTimeout: 30000 },
});
