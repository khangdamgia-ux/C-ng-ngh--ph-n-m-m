# Phiên bản v29 / 30 – CI: chạy test E2E bằng Docker Compose

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v28

v29 = v28 + **CI: chạy test E2E bằng Docker Compose**.

- `ci.yml`: thêm job `e2e` (tạo `.env` cho CI, `docker compose up`, migrate, cài Chromium, `npm run test:e2e`; lỗi thì in log container).
- README: cập nhật mô tả CI.

## Thử chức năng

Tab **Actions**: job E2E chạy sau integration.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
