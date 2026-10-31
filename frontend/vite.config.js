import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const targetBackend = process.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
    hmr: {
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: targetBackend,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
