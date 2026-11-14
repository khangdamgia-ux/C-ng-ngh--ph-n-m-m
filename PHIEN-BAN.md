# Phiên bản v27 / 30 – CI: lint, type check, unit test, build

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v26

v27 = v26 + **CI: lint, type check, unit test, build**.

- Thêm `.github/workflows/ci.yml` với job `quality`: `npm ci` → lint → typecheck → unit test → build, chạy khi push/PR vào `develop`, `main`.
- README: thêm GitHub Actions vào công nghệ, thêm `ci.yml` vào cây thư mục và đoạn mô tả CI.

## Thử chức năng

Đẩy lên GitHub → tab **Actions** → workflow “CI” chạy job “Lint · Type check · Unit test · Build”.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
