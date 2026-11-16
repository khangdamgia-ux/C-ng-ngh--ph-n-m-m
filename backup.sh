#!/usr/bin/env bash
# Xuất dữ liệu đang chạy (database + media) ra db/backup/ để đẩy lên GitHub. Tương đương backup.bat trên Windows.
set -euo pipefail
cd "$(dirname "$0")"
DC=(docker compose -p hoian-audio-guide)
DB=HoiAnGuideDb
if [ -f .env ]; then
  v=$(grep -E '^\s*DB_NAME\s*=' .env | head -1 | sed -E 's/^[^=]*=\s*([A-Za-z0-9_]+).*/\1/' || true)
  [ -n "${v:-}" ] && DB=$v
fi
mkdir -p db/backup
echo "==> Bật SQL Server";       "${DC[@]}" up -d --wait sqlserver
echo "==> Sao lưu database $DB"
"${DC[@]}" cp scripts/sql-backup.sh sqlserver:/tmp/sql-backup.sh
"${DC[@]}" exec -T sqlserver bash /tmp/sql-backup.sh "$DB"
"${DC[@]}" cp "sqlserver:/tmp/$DB.bak" "db/backup/$DB.bak"
echo "==> Sao chép media"
if [ -n "$("${DC[@]}" ps -a -q content)" ]; then
  rm -rf db/backup/media
  "${DC[@]}" cp content:/data/media/. db/backup/media
fi
rm -f backup/mssql-data.tgz backup/media.tgz
echo; echo "XONG:"; du -ah db/backup | sort -k2
echo "Tiếp theo: git add db/backup && git commit -m 'Cập nhật dữ liệu' && git push"
