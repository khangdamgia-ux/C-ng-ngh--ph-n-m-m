# Phiên bản v15 / 16 – Tài khoản Admin, Analytics, Thống kê, Dashboard, script tiện ích

Dự án **Hội An Audio Guide** được chia thành **16 phiên bản**. v01–v13 giữ nguyên như đã đẩy lên GitHub; v14–v16 là các bản gộp từ 17 bản nhỏ (v14–v30 của bộ 30 bản cũ).

**Bản này = bản gốc v25 của bộ 30 bản** (đã gồm đủ chức năng của v21–v25). Mã nguồn không bị sửa, chỉ đổi số phiên bản.

## Chức năng gộp trong bản này

- (gốc v21) Quản lý tài khoản Admin (Super Admin / Editor)
- (gốc v22) Analytics Service (ghi nhận phiên & sự kiện)
- (gốc v23) Trang Thống kê truy cập (Admin)
- (gốc v24) Trang Dashboard quản trị
- (gốc v25) Script tiện ích phụ (tải ảnh, sinh ảnh SVG, nạp ngôn ngữ)

## Thay đổi so với v14

v15 = v14 + **Tài khoản Admin, Analytics, Thống kê, Dashboard, script tiện ích**.

Các gạch đầu dòng dưới đây lấy từ nhật ký tách bản gốc: chúng mô tả những chỗ đã sửa khi **gỡ** từng chức năng ra khỏi bản lớn, tức là chính phần bản này **có thêm** so với bản trước.

#### (gốc v21) Quản lý tài khoản Admin

- Xóa `apps/web/src/admin/Accounts.tsx` (danh sách, tạo, vô hiệu hóa tài khoản).
- `App.tsx`: bỏ route `/admin/accounts`; `AdminLayout.tsx`: bỏ nhóm menu “Hệ thống” và cơ chế ẩn mục `superOnly`.
- `services/auth/src/app.ts`: bỏ `GET/POST /admin/accounts`, `PUT /admin/accounts/:id`. Chỉ còn 1 tài khoản Super Admin tạo khi `db:seed`.
- Gateway: bỏ route `/api/v1/admin/accounts`.
- Integration test: bỏ TC18 (tạo EDITOR); test chống giả mạo header chuyển sang gọi `/admin/locations`.

#### (gốc v22) Analytics Service (ghi nhận phiên & sự kiện)

- Xóa cả thư mục `services/analytics/` (API phiên, heartbeat, kết thúc phiên, sự kiện + unit test).
- Xóa `apps/web/src/analytics.ts`; bỏ mọi lời gọi `track()` / `trackQrScan()` trong `main.tsx`, `TourContext.tsx`, `pages/Detail.tsx`, `components/LangSelect.tsx`.
- `db/migrations/V001__init.sql`: bỏ bảng `VisitSessions`, `VisitEvents`.
- Gateway: bỏ route `/api/v1/analytics/*`, bỏ hạn mức rate limit riêng cho analytics, `/ready` chỉ còn kiểm tra 3 service.
- `docker-compose.yml`: bỏ container `analytics`; Dockerfile: bỏ dòng copy `services/analytics`; `scripts/dev.mjs`, `package.json` (build), `.env.example`: bỏ analytics.
- Integration test: bỏ nhóm “Thống kê” (2 test).

#### (gốc v23) Trang Thống kê truy cập (Admin)

- Xóa `apps/web/src/admin/Stats.tsx` (bảng thống kê theo ngày/tuần/tháng).
- `App.tsx`: bỏ route `/admin/stats`; `AdminLayout.tsx`: bỏ nhóm menu “Tổng quan”.
- `services/analytics/src/app.ts`: bỏ API `GET /admin/stats/visits`. Analytics chỉ còn **ghi** phiên/sự kiện (xem trực tiếp trong CSDL).
- `services/gateway/src/routes.ts`: bỏ route `/api/v1/admin/stats/*`.
- Test: bỏ unit test “thống kê ngôn ngữ”, bỏ dòng route stats trong `routes.test.ts`, bỏ integration TC24.

#### (gốc v24) Trang Dashboard quản trị

- Xóa `apps/web/src/admin/Dashboard.tsx` (thẻ phiên đang hoạt động, KPI, biểu đồ 7 ngày, top địa điểm, độ phủ bản dịch).
- `App.tsx`: trang `/admin` chuyển thẳng tới `/admin/locations`. `AdminLayout.tsx`: bỏ mục menu “Dashboard”.
- `services/analytics/src/app.ts`: bỏ API `GET /admin/stats/active-sessions` và `GET /admin/stats/top-locations` (chỉ Dashboard dùng); Analytics không còn gọi sang Location.
- `services/location/src/app.ts`: bỏ API nội bộ `GET /internal/locations/names`.
- `styles.css`: bỏ 81 dòng CSS của Dashboard (KPI, biểu đồ, top list, live card…).
- Integration test: TC23 không còn đếm phiên đang hoạt động; TC24 bỏ phần top địa điểm.

#### (gốc v25) Script tiện ích phụ (tải ảnh, sinh ảnh SVG, nạp ngôn ngữ)

- Xóa `tai-anh-dia-diem.bat/.ps1` (tải ảnh .jpg từ Wikimedia – ảnh đã có sẵn trong `apps/web/public/places/`).
- Xóa `scripts/gen-place-art.py` (sinh ảnh minh họa .svg – các file .svg đã có sẵn).
- Xóa `nap-ngon-ngu.bat` + `scripts/nap-ngon-ngu.mjs` (nạp thêm 6 ngôn ngữ vào DB đang chạy – `db:seed` đã nạp đủ).
- `CHAY-TAT-CA.bat`: bỏ bước 1 “tải ảnh”, chỉ còn build + khởi động.
- Giữ `backup.bat/.ps1` và phần khôi phục trong `start.ps1` để không mất dữ liệu.

## Đã kiểm tra

- Bản này chính là bản gốc v25 đã được kiểm tra: typecheck, lint, build đạt; **85 test pass** (unit + integration với SQL Server 2022).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose up -d --build --wait` → `docker compose --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose down -v`.
