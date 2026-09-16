import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['references/**', '.agents/**', 'node_modules/**'],
  },
});
