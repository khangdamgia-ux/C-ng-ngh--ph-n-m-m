# Phiên bản v9 / 30 – Yêu thích

Dự án **Hội An Audio Guide** được tách thành 30 phiên bản: v30 là bản gốc đầy đủ, mỗi bản nhỏ hơn bỏ bớt **một** chức năng. Đi theo chiều ngược lại (v1 → v30), mỗi bản thêm đúng một chức năng.

## Bản này có

- v1 – Bản tối giản: danh sách 15 di tích, trang chi tiết, nghe thuyết minh (giọng đọc tự động / MP3), chỉ tiếng Việt
- v2 – Đa ngôn ngữ (6 ngôn ngữ, ô chọn ngôn ngữ, ngôn ngữ dự phòng ko → en → vi)
- v3 – Tìm kiếm không dấu & lọc theo loại di tích
- v4 – Bản đồ di tích (Leaflet, ảnh nền tự đổi nguồn)
- v5 – Định vị GPS của người dùng (chấm vị trí, di tích gần nhất, sắp xếp “Gần tôi”)
- v6 – Thuyết minh tự động khi đến gần (bộ máy geofence “rảnh tay”)
- v7 – Trình phát đầy đủ (tua ±10 giây, tốc độ đọc, nghe lại, Media Session)
- v8 – Trang chủ đầy đủ (khối chủ đề, đèn lồng, hướng dẫn 3 bước)
- v9 – Yêu thích

## Chưa có ở bản này (thêm ở các bản sau)

- v10 – Lịch sử tham quan
- v11 – Hàng đợi bài kế tiếp khi đang nghe
- v12 – Tùy chọn phạm vi “điểm ở gần” 50/100/200 m
- v13 – Tự chuyển ngôn ngữ cho bài đang nghe
- v14 – Giữ màn hình sáng (Wake Lock), tự bật lại GPS, rung báo
- v15 – Khu Quản trị: đăng nhập (Auth Service, JWT) + quản lý địa điểm
- v16 – Soạn thuyết minh 6 ngôn ngữ trong Admin
- v17 – Thùng rác & khôi phục địa điểm
- v18 – Mã QR riêng cho từng địa điểm
- v19 – Tải lên file âm thanh MP3/M4A
- v20 – Quản lý ngôn ngữ & bản dịch giao diện trong Admin
- v21 – Quản lý tài khoản Admin (Super Admin / Editor)
- v22 – Analytics Service (ghi nhận phiên & sự kiện)
- v23 – Trang Thống kê truy cập (Admin)
- v24 – Trang Dashboard quản trị
- v25 – Script tiện ích phụ (tải ảnh, sinh ảnh SVG, nạp ngôn ngữ)
- v26 – PWA (cài như ứng dụng, dùng khi mạng yếu)
- v27 – Bản đồ offline đóng gói sẵn (tiles:offline)
- v28 – Tài liệu API Swagger
- v29 – Test E2E trình duyệt (Playwright)
- v30 – CI/CD GitHub Actions – BẢN ĐẦY ĐỦ (gốc)

## Thay đổi so với v8

v9 = v8 + **Yêu thích**.

Cách làm: bắt đầu từ v9, gỡ chức năng này ra để được v8. Những chỗ đã sửa khi gỡ (tức là phần v9 có thêm so với v8):

- Xóa `apps/web/src/pages/Favorites.tsx` và `components/useStorageVersion.ts` (hook vẽ lại khi yêu thích/lịch sử đổi).
- `App.tsx`: bỏ route `/favorites`; `Layout.tsx`: bỏ mục “Yêu thích” trên thanh điều hướng.
- `pages/Detail.tsx`: bỏ nút ♥ “Yêu thích”. `storage.ts`: bỏ `favorites` (chỉ còn hàm đọc/ghi local/session an toàn).
- 6 file ngôn ngữ: bỏ `nav.favorites`, `favorites.title`, `favorites.empty`, `detail.favorite`, `history.note`.

## Đã kiểm tra

- typecheck, lint, build đạt; 41 test pass (unit + integration với SQL Server).
- Integration test chạy 2–4 service + Gateway trong cùng tiến trình với SQL Server 2022 thật, CSDL tạo mới từ migration + seed của chính bản này.

## Cách chạy

Như README: `cp .env.example .env` (điền mật khẩu) → `docker compose up -d --build --wait` → `docker compose --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`.
