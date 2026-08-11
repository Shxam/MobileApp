import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `ws: true` on `/socket.io` is what makes the realtime feed work in dev.
 * Without it Vite proxies the initial polling handshake but not the upgrade, so
 * the socket connects, fails to upgrade, and silently degrades to long-polling
 * against an origin that never completes it.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3001', ws: true, changeOrigin: true },
    },
  },
});
