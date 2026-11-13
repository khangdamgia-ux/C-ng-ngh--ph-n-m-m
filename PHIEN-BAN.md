# Phiên bản v17 / 30 – PWA: cache dữ liệu API khi mạng yếu

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v16

v17 = v16 + **PWA: cache dữ liệu API khi mạng yếu**.

- `vite.config.ts`: thêm `runtimeCaching` NetworkFirst cho `/api/v1/locations|categories|languages|ui-translations` (timeout 4 s, lưu 7 ngày).
- Lỗi 5xx từ máy chủ cũng rơi về dữ liệu đã lưu (plugin `fetchDidSucceed`).
- README: NFR-10 thêm “PWA cache”.

## Thử chức năng

Xem vài địa điểm → tắt mạng (DevTools → Network → Offline) → tải lại: danh sách địa điểm vẫn hiện.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
