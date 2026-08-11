import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** `ws: true` on `/socket.io` — see the note in the kitchen-kds config. */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3004,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3001', ws: true, changeOrigin: true },
    },
  },
});
