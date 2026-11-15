# Quy trình đóng góp

Tài liệu này mô tả cách nhóm làm việc với Git trên dự án **Hội An Audio Guide**.

## 1. Không commit thẳng vào `main`

Mọi thay đổi đi qua branch riêng và Pull Request (PR). `main` luôn phải build và chạy được.

## 2. Đặt tên branch

`<loai>/<mo-ta-ngan-khong-dau>`

| Loại | Dùng khi | Ví dụ |
|---|---|---|
| `feat/` | Thêm chức năng | `feat/hang-doi-thuyet-minh` |
| `fix/` | Sửa lỗi | `fix/go-env-khoi-git` |
| `test/` | Thêm/sửa test | `test/middleware-http` |
| `perf/` | Cải thiện hiệu năng | `perf/tach-bundle-admin` |
| `ci/` | GitHub Actions, Docker build | `ci/github-actions` |
| `docs/` | Tài liệu | `docs/quy-trinh-dong-gop` |
| `chore/` | Dọn dẹp, cấu hình | `chore/cap-nhat-thu-vien` |

## 3. Viết commit

- Mỗi commit làm **một việc** và vẫn build được.
- Dòng đầu ≤ 72 ký tự, bắt đầu bằng động từ: *Thêm…*, *Sửa…*, *Gỡ…*, *Tách…*.
- Nếu cần giải thích **vì sao**, để một dòng trống rồi viết thêm phần thân.
- Không commit: `.env`, `node_modules/`, `dist/`, file zip, bản sao lưu CSDL.

## 4. Trước khi mở PR

Chạy đủ 4 bước giống CI:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Nếu sửa API hoặc CSDL, chạy thêm integration test (cần SQL Server, xem README):

```bash
npm run test:integration
```

## 5. Pull Request

1. Đẩy branch: `git push -u origin <ten-branch>`.
2. Mở PR vào `main`, điền mẫu PR.
3. Ít nhất **1 thành viên khác** review và duyệt.
4. CI xanh rồi mới merge.
5. Merge xong thì xoá branch.

## 6. Bí mật và cấu hình

- Mật khẩu, khoá JWT, API key chỉ để trong `.env` trên máy mỗi người, tạo từ `.env.example`.
- Thêm biến mới → cập nhật `.env.example` (giá trị mẫu, không phải giá trị thật).
- Lỡ commit bí mật → báo nhóm và **đổi ngay** giá trị đó; xoá file khỏi Git không xoá được lịch sử.
