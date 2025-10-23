import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const rootDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const includeIntegration = process.env.VITEST_INCLUDE_INTEGRATION === 'true';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/test/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      ...(includeIntegration ? [] : ['tests/integration/**']),
    ],
  },
  resolve: {
    alias: {
      '@domain': path.join(rootDir, 'packages/domain/src'),
    },
  },
});
