# Phiên bản v18 / 30 – PWA: cache ảnh địa điểm, âm thanh, ảnh bản đồ

Dự án **Hội An Audio Guide**: v01–v15 đã đăng lên GitHub. Bản v16 (đầy đủ) cũ được tách thành **15 bản nhỏ v16–v30**; mỗi bản là chương trình hoàn chỉnh, chạy riêng được, và v30 trùng 100% mã nguồn với v16 cũ.

## Thay đổi so với v17

v18 = v17 + **PWA: cache ảnh địa điểm, âm thanh, ảnh bản đồ**.

- `vite.config.ts`: cache ảnh `/places/*.jpg` (StaleWhileRevalidate), file âm thanh `/media/` (CacheFirst, hỗ trợ tua), ảnh bản đồ mọi nguồn (chỉ lưu ô 200 + đúng là ảnh).
- `main.tsx`: dọn cache ảnh bản đồ của phiên bản cũ.
- `resilientTiles.ts`: cập nhật chú thích.
- Bản này trùng mã nguồn với bản gốc v26 (PWA) của bộ 30 bản.

## Thử chức năng

Nghe một bài có âm thanh, mở bản đồ → tắt mạng: ảnh, âm thanh và vùng bản đồ đã xem vẫn dùng được.

## Đã kiểm tra

Lint, typecheck, unit test (53 test) và build đều đạt. Integration test (cần SQL Server) và E2E (cần hệ thống đang chạy) không chạy lại ở bước tách; các bản trùng bản gốc đã qua kiểm tra đầy đủ từ trước (85 test).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose -p hoian-audio-guide up -d --build --wait` → `docker compose -p hoian-audio-guide --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose -p hoian-audio-guide down -v`.
