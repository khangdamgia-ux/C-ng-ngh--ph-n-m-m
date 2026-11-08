# 🏮 Hội An Audio Guide

**Hệ thống thuyết minh đa ngôn ngữ cho Phố cổ Hội An.**

Khách mở website (quét QR), chọn di tích và bấm **Phát** để nghe thuyết minh bằng 6 ngôn ngữ (Tiếng Việt, English, 한국어, 中文, 日本語, Français).

Code hiện thực theo tài liệu `PRD_HoiAn_AudioGuide_v2.3` (Node.js + TypeScript, React + Vite, SQL Server, Microservices, Docker).

---

## 0. Chạy nhanh nhất trên Windows

Giải nén → bấm đúp **`CHAY-TAT-CA.bat`**. File này tự: mở Docker Desktop nếu chưa chạy, rồi build + khởi động toàn bộ hệ thống và mở tunnel HTTPS (`start.bat`). Giữ cửa sổ mở trong lúc dùng.

## 1. Kiến trúc

```
Trình duyệt (React)     ──HTTPS /api/v1──► API Gateway :8080
   │                                          (định tuyến,          Location :4002 ◄─┐ REST nội bộ
   │                                          rate limit, 503)      Content :4003 ──┘ X-Internal-Key
   └─► OpenStreetMap
                                                                        │
                                                         SQL Server 2022
```

| Thành phần | Thư mục | Trách nhiệm | Bảng sở hữu |
|---|---|---|---|
| Frontend | `apps/web` | Giao diện khách, trình phát thuyết minh | – |
| API Gateway | `services/gateway` | Điểm vào duy nhất, bảng định tuyến (PRD 8.3.2), rate limit, trả 503 khi service lỗi | – |
| Location Service | `services/location` | Địa điểm, tìm kiếm/lọc, tọa độ | Locations, LocationCategories |
| Content Service | `services/content` | Thuyết minh, ngôn ngữ dự phòng, âm thanh | Languages, Narrations |
| Shared | `packages/shared` | Lỗi chuẩn, middleware, gọi service nội bộ (timeout + retry), kết nối DB | – |

**Giao tiếp giữa các service** (FR-20): Content → Location (kiểm tra địa điểm), Location → Content (tiêu đề theo ngôn ngữ, tìm kiếm). Mọi lời gọi nội bộ có `X-Internal-Key`, `X-Request-Id`, timeout 2 s, retry GET 1 lần; service phụ lỗi thì hệ thống **suy giảm có kiểm soát** (vd. danh sách vẫn hiện khi Content lỗi).

## 2. Cấu trúc thư mục

```
apps/web/src/
  tour/narrator.ts      ← trình phát: file MP3 hoặc giọng đọc tự động của thiết bị (Web Speech API)
  tour/TourContext.tsx  ← trình phát dùng chung cho mọi trang
  pages/, components/   ← giao diện khách (UI01–UI06)
services/*/src/app.ts   ← mỗi service một file app, dễ đọc và test
db/migrations/V001__init.sql   ← lược đồ CSDL (PRD Phần XII)
db/seed/data/*.json            ← 15 di tích + 90 bài thuyết minh (6 ngôn ngữ, PRD Phụ lục A, C)
tests/integration/             ← test API với SQL Server thật
docker/, docker-compose.yml
```

## 3. Chạy nhanh bằng Docker (khuyên dùng)

Yêu cầu: Docker Desktop.

```bash
cp .env.example .env          # rồi sửa DB_PASSWORD, INTERNAL_API_KEY
docker compose up -d --build --wait
docker compose --profile tools run --rm migrate   # tạo bảng + nạp 15 di tích × 6 ngôn ngữ
```

- Website: <http://localhost>

> `DB_PASSWORD` phải đủ mạnh theo yêu cầu SQL Server (≥ 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt).

## 4. Chạy ở chế độ phát triển

Yêu cầu: Node.js 22 LTS, npm 10, SQL Server (hoặc container: `docker run -d -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='...' -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest`).

```bash
npm install
cp .env.example .env     # DB_HOST=localhost, điền mật khẩu
npm run db:seed          # migration + dữ liệu mẫu (chạy lại nhiều lần không bị trùng)
npm run dev              # chạy 3 service + Gateway + Vite → http://localhost:5173
```

## 6. Kiểm thử

| Lệnh | Nội dung |
|---|---|
| `npm run lint` | ESLint toàn bộ dự án |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm test` | Unit test: ngôn ngữ dự phòng, bảng định tuyến Gateway, tách câu giọng đọc |
| `npm run test:integration` | test API qua Gateway với SQL Server thật (cần `npm run db:seed` trước) |


## 7. Đối chiếu PRD → code

| Yêu cầu | Nơi hiện thực |
|---|---|
| FR-02/03 Ngôn ngữ + dự phòng ko → en → vi | `i18n/`, `content/src/fallback.ts` |
| FR-04 Trình phát (phát/tạm dừng) | `tour/narrator.ts`, `components/Player.tsx` |
| FR-06–10 Danh sách, tìm kiếm không dấu, lọc, chi tiết | `location/app.ts`, `pages/Places.tsx`, `pages/Detail.tsx` |
| FR-11 Bản đồ + chỉ đường | `components/MapView.tsx` (Leaflet/OSM), link Google Maps đi bộ |
| FR-20 Giao tiếp service | `shared/src/client.ts`, `gateway/src/routes.ts`, `gateway/src/app.ts` |
| NFR-04 Bảo mật | helmet, CORS, rate limit, Zod, truy vấn tham số hóa, chặn header nội bộ giả mạo |
| NFR-09 Quyền riêng tư | không thu thập vị trí; không lưu IP |
| NFR-10 Phục hồi | 503 có `requestId`, suy giảm có kiểm soát, Error Boundary |

## 8. Lưu ý và giới hạn đã biết

- **Âm thanh:** dữ liệu mẫu chưa có file MP3, nên website dùng **giọng đọc tự động của thiết bị** (Web Speech API). Chất lượng và việc có giọng cho từng ngôn ngữ phụ thuộc thiết bị và trình duyệt: Android và iOS thường có đủ, Windows có thể thiếu giọng tiếng Việt. Bài nào có `audio_url` (đường dẫn http/https tới file MP3) thì website phát file đó.
- **Tọa độ 15 di tích là tham khảo**, cần đo lại tại thực địa. **Giá vé** để trống (cột `ticket_price` trong CSDL). Nội dung lịch sử cần đối chiếu nguồn chính thống (xem PRD Phụ lục C).
- `npm audit` báo lỗ hổng của `braces`/`micromatch` (phụ thuộc của `http-proxy-middleware`). Lỗ hổng chỉ khai thác được khi glob do người dùng nhập, mà Gateway định tuyến bằng hàm, không dùng glob.
- **Bản đồ không còn nền xám:** mỗi ô ảnh nền tự thử lần lượt nhiều nguồn độc lập (server của mình → OSM → Esri → OSM-FR; không dùng CARTO vì nó đóng dấu "API KEY REQUIRED"), có timeout, tự thử lại khi mạng chập chờn/có mạng lại/quay lại tab, và từ chối ô "bị chặn". Nếu tất cả nguồn đều không tới được, nền là giấy be + lưới, kèm thông báo và nút "Thử lại"; các điểm tham quan vẫn dùng bình thường (`apps/web/src/components/resilientTiles.ts`).
- Khi triển khai lượng truy cập lớn nên dùng nhà cung cấp tile riêng theo chính sách sử dụng của OSM.

---



## 👥 Nhóm Thực Hiện: 09

| Nguyễn Đạt Mạnh | 3124411162 |

| Đàm Gia Khang   | 3124411121 |

| Phạm Quốc Trung | 3124411329 |

---
