import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@giulio-leone/lib-core': path.resolve(__dirname, '__mocks__/@giulio-leone/lib-core.ts'),
      '@giulio-leone/core/repositories': path.resolve(__dirname, '__mocks__/@giulio-leone/core/repositories.ts'),
      '@giulio-leone/core': path.resolve(__dirname, '__mocks__/@giulio-leone/core/index.ts'),
    },
  },
});
