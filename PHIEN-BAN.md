# Phiên bản v16 / 30 – PWA: cài website như ứng dụng

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v15

v16 = v15 + **PWA: cài website như ứng dụng**.

- Thêm gói `vite-plugin-pwa` (`apps/web/package.json`, `package-lock.json`) và type `vite-plugin-pwa/client` (`apps/web/tsconfig.json`).
- `apps/web/vite.config.ts`: bật plugin `VitePWA` với manifest (tên, màu, biểu tượng, `display: standalone`) và service worker tự cập nhật; chưa cache dữ liệu động.
- `docker/nginx.conf`: thêm `location = /sw.js` (no-cache) để service worker mới được nhận ngay.
- README: ghi Frontend là PWA.

## Thử chức năng

Mở web trên điện thoại → menu trình duyệt có “Cài đặt ứng dụng / Thêm vào màn hình chính”.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
