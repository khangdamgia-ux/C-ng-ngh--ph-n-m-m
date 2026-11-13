# Phiên bản v23 / 30 – Swagger UI + tài liệu API quản trị

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v22

v23 = v22 + **Swagger UI + tài liệu API quản trị**.

- `openapi.ts`: bổ sung toàn bộ API quản trị (địa điểm, thuyết minh, âm thanh, ngôn ngữ, thống kê, tài khoản) và các schema đi kèm.
- `docs.ts`: thêm trang Swagger UI tại `/api/docs` (tải giao diện từ CDN, hỗ trợ dark mode); đăng nhập xong tự điền token vào nút Authorize.
- `app.ts`: đặt `docsRouter()` trước helmet để trang Swagger nạp được script CDN.

## Thử chức năng

Mở http://localhost/api/docs → gọi `POST /api/v1/auth/login` → thử một API có ổ khóa.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
