import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const gateway = process.env.VITE_DEV_GATEWAY ?? 'http://localhost:8081';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': gateway,
    },
  },
  test: { environment: 'node' },
});
