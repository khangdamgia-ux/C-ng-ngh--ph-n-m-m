# Phiên bản v19 / 30 – Script tải sẵn ảnh bản đồ Phố cổ

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v18

v19 = v18 + **Script tải sẵn ảnh bản đồ Phố cổ**.

- Thêm `scripts/tiles-offline.mjs`: tải ảnh bản đồ khu Phố cổ (zoom 14–18) vào `apps/web/public/tiles-local/` kèm `manifest.json`.
- `package.json`: thêm lệnh `npm run tiles:offline`.
- README: thêm mục “Chống mất mạng hoàn toàn”.
- Web chưa dùng bộ ảnh này (bản sau mới nối vào bản đồ).

## Thử chức năng

Chạy `npm run tiles:offline` (cần Internet) → kiểm tra thư mục `apps/web/public/tiles-local/`.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
