# Phiên bản v20 / 30 – Bản đồ dùng ảnh offline đóng gói sẵn

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v19

v20 = v19 + **Bản đồ dùng ảnh offline đóng gói sẵn**.

- `resilientTiles.ts`: thêm `LOCAL_MANIFEST_URL`, `loadLocalSource()` dò `/tiles-local/manifest.json`.
- `MapView.tsx`: có bộ ảnh offline thì đặt nó làm nguồn đầu tiên (offline → server mình → OSM → Esri → OSM-FR).
- `docker/nginx.conf`: thêm `location /tiles-local/` (thiếu file trả 404 thật, cache 30 ngày).
- README: cập nhật thứ tự nguồn bản đồ.

## Thử chức năng

Sau khi chạy `tiles:offline` và build lại: chặn OSM/Esri trong DevTools, bản đồ khu Phố cổ vẫn hiện.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
