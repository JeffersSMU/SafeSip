import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static SPA: no base path or rewrites needed on Vercel (navigation is in-app state, not URL routes).
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        abTesting: 'a-b-testing/index.html',
      },
    },
  },
  test: { environment: 'node' },
} as Parameters<typeof defineConfig>[0]);
