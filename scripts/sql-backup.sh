#!/bin/bash
# Chạy BÊN TRONG container sqlserver (backup.ps1 / backup.sh tự gọi). Tạo /tmp/<DB>.bak từ database đang chạy.
set -e
DBN="${1:-HoiAnGuideDb}"
SQLCMD=/opt/mssql-tools18/bin/sqlcmd
[ -x "$SQLCMD" ] || SQLCMD=/opt/mssql-tools/bin/sqlcmd
export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"
rm -f "/tmp/$DBN.bak"
"$SQLCMD" -C -b -S localhost -U sa -Q "BACKUP DATABASE [$DBN] TO DISK = N'/tmp/$DBN.bak' WITH INIT, FORMAT, COPY_ONLY, CHECKSUM"
