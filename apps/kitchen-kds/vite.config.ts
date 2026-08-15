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
    host: '0.0.0.0',
    port: 3002,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:3001', ws: true, changeOrigin: true },
    },
  },
});
