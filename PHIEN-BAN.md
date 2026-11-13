# Phiên bản v21 / 30 – PWA cache bộ ảnh bản đồ offline

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v20

v21 = v20 + **PWA cache bộ ảnh bản đồ offline**.

- `vite.config.ts`: `/tiles-local` không bị điều hướng về trang SPA; cache `manifest.json` (StaleWhileRevalidate) và ô `/tiles-local/*.png` chung với cache ảnh bản đồ.
- Bản này trùng mã nguồn với bản gốc v27 (bản đồ offline).

## Thử chức năng

Như v20, thêm: mở lại web khi đã tắt mạng, bản đồ offline vẫn nạp được từ cache.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
