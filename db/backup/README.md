# Dữ liệu đi kèm repo

- `HoiAnGuideDb.bak` – tạo bằng `backup.bat` / `./backup.sh` từ SQL Server đang chạy.
- `media/` – file đã tải lên (volume `media`).

`docker compose up` lần đầu trên máy mới: service `migrate` thấy database chưa tồn tại → `RESTORE DATABASE` từ file `.bak` này, chép `media/` vào volume, rồi chạy các migration mới hơn (nếu có).
