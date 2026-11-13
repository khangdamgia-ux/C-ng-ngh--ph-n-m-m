# Phiên bản v22 / 30 – Đặc tả OpenAPI cho API công khai

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v21

v22 = v21 + **Đặc tả OpenAPI cho API công khai**.

- Thêm `services/gateway/src/openapi.ts`: đặc tả OpenAPI 3.0 cho nhóm API Hệ thống, Xác thực, Địa điểm, Thuyết minh, Phân tích.
- Thêm `services/gateway/src/docs.ts`: Gateway phát đặc tả tại `GET /api/docs/openapi.json`.
- `services/gateway/src/app.ts`: gắn `docsRouter()` trước rate limit/định tuyến.

## Thử chức năng

Mở http://localhost/api/docs/openapi.json, hoặc dán link đó vào https://editor.swagger.io.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
