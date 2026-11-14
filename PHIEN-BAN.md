# Phiên bản v25 / 30 – Test E2E: 1 chạm → tự thuyết minh 8 di tích

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v24

v25 = v24 + **Test E2E: 1 chạm → tự thuyết minh 8 di tích**.

- Thêm devDependency `playwright` và lệnh `npm run test:e2e` (`package.json`, `package-lock.json`).
- Thêm `tests/e2e/handsfree.mjs`: bấm “Bật định vị” một lần, giả lập GPS đứng lần lượt tại 8 di tích, kiểm tra hệ thống tự thuyết minh đủ 8 di tích đúng thứ tự, không có lỗi trang.
- README: thêm dòng `tests/e2e/` và lệnh `npm run test:e2e`.

## Thử chức năng

Hệ thống đang chạy → `npx playwright install chromium` (lần đầu) → `set BASE_URL=http://localhost` → `npm run test:e2e`.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
