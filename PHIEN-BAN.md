# Phiên bản v28 / 30 – CI: integration test SQL Server + build Docker image

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v27

v28 = v27 + **CI: integration test SQL Server + build Docker image**.

- `ci.yml`: thêm job `integration` (SQL Server 2022 làm service container, `db:seed` rồi `test:integration`).
- `ci.yml`: thêm job `docker` build image cho 5 service (không đẩy lên registry).
- README: cập nhật mô tả CI.

## Thử chức năng

Tab **Actions**: có thêm 2 job sau job quality.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
