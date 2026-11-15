import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const gateway = process.env.VITE_DEV_GATEWAY ?? 'http://localhost:8081';

export default defineConfig({
  plugins: [
    react(),
    // PWA: cache dữ liệu đã xem để dùng khi mạng yếu (NFR-10, US-15)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'hero-hoian.png', 'places/*.svg'],
      manifest: {
        name: 'Hội An Audio Guide',
        short_name: 'Hội An Guide',
        description: 'Thuyết minh đa ngôn ngữ rảnh tay – Phố cổ Hội An',
        theme_color: '#7A1F1F',
        background_color: '#FBF6EC',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/media/, /^\/maptiles/, /^\/tiles-local/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /^\/api\/v1\/(locations|categories|languages|ui-translations)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-content',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 86400 },
              // NetworkFirst mặc định chỉ dùng cache khi mất mạng hẳn; phản hồi 502/503 vẫn bị coi là "thành công".
              // Ném lỗi ở đây để lỗi 5xx cũng rơi về dữ liệu đã lưu (NFR-10). Hàm phải tự chứa, không dùng biến ngoài.
              plugins: [
                {
                  fetchDidSucceed: async ({ response }: { response: Response }) => {
                    if (response.status >= 500) throw new Error('HTTP ' + response.status);
                    return response;
                  },
                },
              ],
            },
          },
          {
            // Ảnh địa điểm (/places/*.jpg): lần sau mở trên điện thoại là có ngay. Chỉ lưu ảnh thật (200 + image/*),
            // không lưu trang HTML mà máy chủ trả về khi thiếu file.
            urlPattern: ({ url }) => url.pathname.startsWith('/places/') && url.pathname.endsWith('.jpg'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'place-photos-v1',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 86400 },
              plugins: [
                {
                  cacheWillUpdate: async ({ response }: { response: Response }) =>
                    response && response.status === 200 && (response.headers.get('content-type') || '').indexOf('image/') === 0 ? response : null,
                },
              ],
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
            handler: 'CacheFirst',
            options: { cacheName: 'media', rangeRequests: true, expiration: { maxEntries: 60, maxAgeSeconds: 30 * 86400 } },
          },
          {
            // Danh mục ảnh offline: lấy bản mới khi có mạng, mất mạng vẫn dùng được bản cũ
            urlPattern: ({ url }) => url.pathname === '/tiles-local/manifest.json',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tiles-manifest-v1' },
          },
          {
            // Ảnh bản đồ (mọi nguồn). Chỉ lưu phản hồi 200 và đúng là ảnh: không bao giờ cache ô lỗi/ô "bị chặn" rồi hiện nền xám mãi.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/maptiles/') ||
              (url.pathname.startsWith('/tiles-local/') && url.pathname.endsWith('.png')) ||
              url.hostname.endsWith('tile.openstreetmap.org') ||
              url.hostname.endsWith('tile.openstreetmap.fr') ||
              url.hostname.endsWith('arcgisonline.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-v5',
              expiration: { maxEntries: 600, maxAgeSeconds: 14 * 86400 },
              plugins: [
                {
                  // Hàm phải tự chứa (được nhúng vào service worker)
                  cacheWillUpdate: async ({ response }: { response: Response }) =>
                    response && response.status === 200 && (response.headers.get('content-type') || '').indexOf('image/') === 0 ? response : null,
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': gateway,
      '/media': gateway,
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
  build: {
    rollupOptions: {
      output: {
        // Tách thư viện ít thay đổi ra chunk riêng: sửa mã của nhóm thì trình duyệt/PWA
        // chỉ phải tải lại phần mã đó, không tải lại React, Leaflet, i18next.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          leaflet: ['leaflet', 'react-leaflet'],
          i18n: ['i18next', 'react-i18next'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: { environment: 'node' },
});
