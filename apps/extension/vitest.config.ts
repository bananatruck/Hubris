import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { aliases } from './vite.config.ts';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: aliases },
  test: {
    projects: [
      { extends: true, test: { name: 'platform', environment: 'node', include: ['src/**/*.test.ts'] } },
      { extends: true, test: { name: 'react', environment: 'jsdom', include: ['src/**/*.test.tsx'] } },
    ],
    setupFiles: ['./src/test/setup.ts'],
    maxWorkers: 1,
  },
});
