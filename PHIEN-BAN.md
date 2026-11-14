# Phiên bản v30 / 30 – CD: đẩy image lên GHCR + triển khai SSH – BẢN ĐẦY ĐỦ (gốc)

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v29

v30 = v29 + **CD: đẩy image lên GHCR + triển khai SSH – BẢN ĐẦY ĐỦ (gốc)**.

- Thêm `.github/workflows/cd.yml`: push vào `main` → build và đẩy 7 image lên GHCR; job deploy qua SSH có health check và tự rollback (chỉ chạy khi biến `DEPLOY_ENABLED=true`).
- README: mô tả đầy đủ CI/CD.
- Bản này trùng 100% mã nguồn với v16 (bản đầy đủ) trước khi tách, tức bản gốc v30 của bộ 30 bản.

## Thử chức năng

Tab **Actions**: workflow “CD” chạy khi push vào `main`; job deploy bị bỏ qua cho tới khi cấu hình `DEPLOY_ENABLED` và secrets.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
