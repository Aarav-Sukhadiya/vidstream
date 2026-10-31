import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:4000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      // Locally transcoded HLS output is served by the API under /media
      '/media': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks that rarely change between deploys
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          hls: ['hls.js/light'],
        },
      },
    },
  },
});
