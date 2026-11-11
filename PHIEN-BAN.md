# Phiên bản v14 / 16 – Hoàn thiện phía khách + Khu Quản trị đầy đủ (địa điểm, thuyết minh, thùng rác, QR, âm thanh, ngôn ngữ)

Dự án **Hội An Audio Guide** được chia thành **16 phiên bản**. v01–v13 giữ nguyên như đã đẩy lên GitHub; v14–v16 là các bản gộp từ 17 bản nhỏ (v14–v30 của bộ 30 bản cũ).

**Bản này = bản gốc v20 của bộ 30 bản** (đã gồm đủ chức năng của v14–v20). Mã nguồn không bị sửa, chỉ đổi số phiên bản.

## Chức năng gộp trong bản này

- (gốc v14) Giữ màn hình sáng (Wake Lock), tự bật lại GPS, rung báo
- (gốc v15) Khu Quản trị: đăng nhập (Auth Service, JWT) + quản lý địa điểm
- (gốc v16) Soạn thuyết minh 6 ngôn ngữ trong Admin
- (gốc v17) Thùng rác & khôi phục địa điểm
- (gốc v18) Mã QR riêng cho từng địa điểm
- (gốc v19) Tải lên file âm thanh MP3/M4A
- (gốc v20) Quản lý ngôn ngữ & bản dịch giao diện trong Admin

## Thay đổi so với v13

v14 = v13 + **Hoàn thiện phía khách + Khu Quản trị đầy đủ (địa điểm, thuyết minh, thùng rác, QR, âm thanh, ngôn ngữ)**.

Các gạch đầu dòng dưới đây lấy từ nhật ký tách bản gốc: chúng mô tả những chỗ đã sửa khi **gỡ** từng chức năng ra khỏi bản lớn, tức là chính phần bản này **có thêm** so với bản trước.

#### (gốc v14) Giữ màn hình sáng, tự bật lại GPS và rung báo

- `tour/TourContext.tsx`: bỏ Screen Wake Lock (`requestWakeLock`, tự xin lại khi quay về tab), bỏ việc nhớ trạng thái GPS (`hoian.gps`) để tự bật lại định vị khi mở lại trang, bỏ rung (`navigator.vibrate`) khi tự phát bài hoặc bị chặn âm thanh.
- `components/TourBar.tsx`: bỏ dòng nhắc “Giữ màn hình sáng…”.
- 6 file ngôn ngữ: bỏ khóa `tour.wakeLockHint`. README: cập nhật mục Khóa màn hình.

#### (gốc v15) Toàn bộ khu Quản trị (đăng nhập, Auth Service, quản lý địa điểm)

- Xóa thư mục `apps/web/src/admin/` (đăng nhập, khung Admin, danh sách & sửa địa điểm, bản đồ chọn tọa độ, thêm loại địa điểm); xóa `public/favicon-admin.svg`. `admin/icons.tsx` chuyển sang `components/icons.tsx` (trang khách vẫn dùng).
- Xóa cả `services/auth/` (đăng nhập JWT, khóa tạm sau 5 lần sai, `/auth/me`, `/internal/auth/verify` + unit test `loginLimiter`).
- `services/location/src/app.ts`: bỏ mọi API `/admin/*` (tạo/sửa/xóa/công khai địa điểm, sửa tọa độ, tạo loại); xóa `adminActions.test.ts`. `services/content/src/app.ts`: bỏ `/admin/narrations/coverage`, `/admin/languages`.
- Gateway: bảng định tuyến không còn cờ `auth`, bỏ xác thực token qua Auth Service và bộ nhớ đệm token.
- `packages/shared/src/http.ts`: bỏ `requireRole`, kiểu `AdminRole`, `req.user`.
- `App.tsx`/`main.tsx`: bỏ route `/admin/*` và `AuthProvider`; `api/client.ts`: bỏ `tokenStore` và tùy chọn `auth`; `usePageTitle.ts`: chỉ còn tiêu đề phía khách; `MapView.tsx`: bỏ chế độ bấm chọn tọa độ.
- CSDL: bỏ bảng `Admins`; `db-migrate.mjs` không tạo Super Admin nữa; bỏ `bcryptjs`.
- `docker-compose.yml`, Dockerfile, `dev.mjs`, `package.json`, `.env.example` (bỏ `JWT_*`, `SEED_ADMIN_*`, `AUTH_SERVICE_URL`), `start.ps1`: bỏ Auth.
- `styles.css`: bỏ toàn bộ CSS khu Admin (~190 dòng); selector nền `body[data-area="user"]` đổi thành `body`.
- Integration test: bỏ đăng nhập và các nhóm test quản trị; TC29 (ngôn ngữ dự phòng) chuyển vào nhóm API công khai; thêm test “không còn API quản trị → 404”.

#### (gốc v16) Soạn thuyết minh trong Admin

- `admin/LocationEdit.tsx`: bỏ khối “Nội dung thuyết minh” (tab 6 ngôn ngữ, tiêu đề/tóm tắt/nội dung, trạng thái DRAFT/PUBLISHED, nghe thử).
- `services/content/src/app.ts`: bỏ `GET /admin/locations/:id/narrations`, `GET/PUT /admin/locations/:id/narrations/:lang` và hàm `assertLocation`. Giữ `GET /admin/narrations/coverage` (bảng độ phủ bản dịch ở trang Địa điểm).
- `services/location/src/app.ts`: bỏ API nội bộ `/internal/locations/by-id/:id/status` (chỉ phần soạn thuyết minh dùng).
- Gateway: bỏ route `/api/v1/admin/locations/:id/narrations`.
- Nội dung thuyết minh giờ chỉ đến từ dữ liệu seed (`db/seed/data/*.json`).
- Integration test: thay TC21+TC29 (ghi bản dịch rồi đọc dự phòng) bằng TC29 đọc dự phòng trên dữ liệu seed (`lang=de` → EN).

#### (gốc v17) Thùng rác & khôi phục địa điểm

- `admin/Locations.tsx`: bỏ tab “Thùng rác”, truy vấn `?deleted=1`, nút “Khôi phục”; thông báo xóa không còn nhắc thùng rác.
- `services/location/src/app.ts`: bỏ tham số `deleted` của `GET /admin/locations` và API `PATCH /admin/locations/:id/restore`.
- Xóa vẫn là xóa mềm (`deleted_at`) nhưng Admin không xem lại/khôi phục được nữa.
- `adminActions.test.ts`: thay 6 test thùng rác/khôi phục bằng 4 test xóa mềm (`GET` chỉ lấy bản chưa xóa, `DELETE` 204/404/401).

#### (gốc v18) Mã QR riêng cho từng địa điểm

- `services/location/src/app.ts`: bỏ `GET /admin/locations/:id/qr` (sinh QR PNG/SVG trỏ tới `/l/<code>?src=qr`); `package.json`: bỏ `qrcode`, `@types/qrcode`.
- `admin/LocationEdit.tsx`: bỏ 2 nút “Tải QR (PNG/SVG)” và hàm `downloadQr`.
- `.env.example`: bỏ `PUBLIC_WEB_URL`. Test: bỏ integration FR-17 và dòng route `/qr` trong `routes.test.ts`.
- Vẫn giữ QR trang chủ khi chạy `start.bat` (`scripts/share-qr.mjs`).

#### (gốc v19) Tải lên file âm thanh (MP3/M4A)

- `services/content/src/app.ts`: bỏ `POST /admin/narrations/:id/audio` (multer, giới hạn 5 MB), bỏ phục vụ file tĩnh `/media` và thư mục `MEDIA_DIR`.
- `services/content/package.json`: bỏ `multer`, `@types/multer`.
- `admin/LocationEdit.tsx`: bỏ ô chọn file âm thanh và đoạn đo thời lượng + upload sau khi lưu. Vẫn giữ `audioUrl` sẵn có (nghe thử nếu có).
- Gateway: bỏ route `/media/*`; `nginx.conf`, `vite.config.ts`: bỏ proxy `/media`.
- `docker-compose.yml`: bỏ volume `media` và `MEDIA_DIR`; `start.ps1`/`backup.ps1`: bỏ sao lưu/khôi phục `media.tgz`; `.env.example`, `dev.mjs`: bỏ `MEDIA_DIR`.
- Integration test: bỏ TC41 (upload MP3 + phát qua /media có Range).
- Người dùng vẫn nghe bằng giọng đọc tự động (TTS) hoặc file MP3 có sẵn đường dẫn http(s).

#### (gốc v20) Quản lý ngôn ngữ & bản dịch giao diện trong Admin

- Xóa `apps/web/src/admin/Languages.tsx` (bật/tắt ngôn ngữ, chọn mặc định, thứ tự dự phòng, thêm ngôn ngữ mới, sửa bản dịch giao diện).
- `App.tsx`/`AdminLayout.tsx`: bỏ route và mục menu “Ngôn ngữ”.
- `services/content/src/app.ts`: bỏ `GET /ui-translations`, `POST /admin/languages`, `PUT /admin/languages/:id`, `GET/PUT /admin/ui-translations/:lang`. Giữ `GET /languages` và `GET /admin/languages` (chỉ đọc).
- `i18n/index.ts`: bỏ `loadUiTranslations()`; `LangSelect.tsx`: không tải bản dịch từ máy chủ nữa – giao diện dùng 6 bộ dịch dựng sẵn.
- `V001__init.sql`: bỏ bảng `UiTranslations`. Gateway: bỏ route `ui-translations`.
- Danh sách ngôn ngữ cố định theo dữ liệu seed (6 ngôn ngữ). `styles.css`: bỏ 20 dòng CSS của trang Ngôn ngữ.

## Đã kiểm tra

- Bản này chính là bản gốc v20 đã được kiểm tra: typecheck, lint, build đạt; **72 test pass** (unit + integration với SQL Server 2022).

## Cách chạy

Như README: `copy .env.example .env` (điền mật khẩu) → `docker compose up -d --build --wait` → `docker compose --profile tools run --rm migrate`. Trên Windows: bấm đúp `CHAY-TAT-CA.bat`. Trước khi chuyển sang bản khác: `docker compose down -v`.
