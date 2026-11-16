import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from './i18n';
import { initAnalytics, setAnalyticsLang, trackQrScan } from './analytics';
import { App } from './App';
import { AuthProvider } from './admin/auth';
import { TourProvider } from './tour/TourContext';
import './styles.css';

const params = new URLSearchParams(location.search);
if (!location.pathname.startsWith('/admin')) {
  // FR-01: ghi nhận phiên và nguồn truy cập (QR / trực tiếp)
  initAnalytics({
    lang: i18n.language,
    source: params.get('src') === 'qr' ? 'QR' : 'DIRECT',
  });
  i18n.on('languageChanged', setAnalyticsLang);
  // QR chung đưa khách về trang chủ (không có địa điểm) → ghi lượt quét ngay. QR riêng của di tích (/l/...) do trang Detail ghi kèm địa điểm.
  if (params.get('src') === 'qr' && !location.pathname.startsWith('/l/')) trackQrScan(null);
}

// Dọn cache ảnh bản đồ của các phiên bản cũ (có thể còn ô lỗi/ô đóng dấu "API KEY REQUIRED")
if ('caches' in window) {
  void caches.keys().then((keys) => keys.filter((k) => /^(osm-tiles|map-tiles-v[1-4]$)/.test(k)).forEach((k) => void caches.delete(k))).catch(() => undefined);
}

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TourProvider>
            <App />
          </TourProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
