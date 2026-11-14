# Phiên bản v26 / 30 – Test E2E: đổi ngôn ngữ khi đang nghe

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v25

v26 = v25 + **Test E2E: đổi ngôn ngữ khi đang nghe**.

- `tests/e2e/handsfree.mjs`: thêm kịch bản đang nghe Chùa Cầu tiếng Việt, đổi sang English → kiểm tra thuyết minh tự chuyển sang `en-US`.
- Bản này trùng mã nguồn với bản gốc v29 (test E2E).

## Thử chức năng

Như v25.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
