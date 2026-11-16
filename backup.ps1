# Xuat du lieu dang chay (database + file media) ra db\backup\ de day len GitHub.
# Nguoi khac clone ve chi can: docker compose up -d --build  -> tu khoi phuc dung du lieu nay.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$P = 'hoian-audio-guide'
$dc = @('compose', '-p', $P)
function Fail($m) { Write-Host "`nLOI: $m" -ForegroundColor Red; exit 1 }

$db = 'HoiAnGuideDb'
if (Test-Path .env) {
  $m = Select-String -Path .env -Pattern '^\s*DB_NAME\s*=\s*([A-Za-z0-9_]+)' | Select-Object -First 1
  if ($m) { $db = $m.Matches[0].Groups[1].Value }
}

docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Docker Desktop chua chay.' }
New-Item -ItemType Directory -Force db\backup | Out-Null

Write-Host "==> Bat SQL Server (neu dang tat)" -ForegroundColor Cyan
docker @dc up -d --wait sqlserver
if ($LASTEXITCODE -ne 0) { Fail 'Khong bat duoc sqlserver.' }

Write-Host "==> Sao luu database $db" -ForegroundColor Cyan
docker @dc cp scripts/sql-backup.sh sqlserver:/tmp/sql-backup.sh
if ($LASTEXITCODE -ne 0) { Fail 'Khong chep duoc script vao container.' }
docker @dc exec -T sqlserver bash /tmp/sql-backup.sh $db
if ($LASTEXITCODE -ne 0) { Fail 'BACKUP DATABASE loi (kiem tra DB_PASSWORD trong .env dung voi mat khau SQL Server).' }
docker @dc cp "sqlserver:/tmp/$db.bak" "db/backup/$db.bak"
if ($LASTEXITCODE -ne 0) { Fail 'Khong chep duoc file .bak ra ngoai.' }

Write-Host "==> Sao chep file media (am thanh da tai len)" -ForegroundColor Cyan
$content = docker @dc ps -a -q content
if ($content) {
  if (Test-Path db\backup\media) { Remove-Item -Recurse -Force db\backup\media }
  docker @dc cp content:/data/media/. db/backup/media
} else {
  Write-Host 'Chua co container content -> bo qua media.' -ForegroundColor Yellow
}

# Ban sao cu dang tar tho (khong dung nua, se gay sai mat khau o may khac)
foreach ($old in 'backup\mssql-data.tgz', 'backup\media.tgz') { if (Test-Path $old) { Remove-Item $old } }

Write-Host "`nXONG. Cac file can commit:" -ForegroundColor Green
Get-ChildItem db\backup -Recurse -File | Select-Object @{n='File';e={$_.FullName.Substring($root.Length + 1)}}, @{n='MB';e={[math]::Round($_.Length/1MB,2)}}
Write-Host "`nTiep theo: git add db/backup && git commit -m `"Cap nhat du lieu`" && git push"
