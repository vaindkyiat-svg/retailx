import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'src/lib/auth/**/*.test.ts',
      'src/lib/auth/**/*.test.tsx',
      'src/lib/provisioning/**/*.test.ts',
      'src/lib/infrastructure/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/auth/**/*.ts', 'src/lib/auth/**/*.tsx'],
      exclude: [
        'src/lib/auth/**/*.test.ts',
        'src/lib/auth/**/*.test.tsx',
        'src/lib/auth/index.ts',
        'src/lib/auth/types.ts',
        'src/lib/auth/identity/types.ts',
      ],
    },
  },
});
