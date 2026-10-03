import { defineConfig } from 'vitest/config';
import { ALIAS } from './alias.ts';

export default defineConfig({
  resolve: { alias: ALIAS },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
