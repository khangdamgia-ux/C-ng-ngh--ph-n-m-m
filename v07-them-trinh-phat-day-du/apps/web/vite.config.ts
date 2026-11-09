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
      // Ảnh bản đồ đi qua dev server (giống nginx khi chạy Docker) để máy khác không phải chỉnh mạng
      '/maptiles': {
        target: 'https://tile.openstreetmap.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/maptiles/, ''),
        headers: { 'User-Agent': 'HoiAnAudioGuide/1.0 (dev tile proxy)' },
      },
    },
  },
  test: { environment: 'node' },
});
