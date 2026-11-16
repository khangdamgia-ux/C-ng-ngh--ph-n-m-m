# Khoi dong toan bo Hoi An Audio Guide + tunnel HTTPS + ma QR.
# May moi: docker compose tu khoi phuc du lieu tu db\backup\HoiAnGuideDb.bak (xem backup.bat).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$P = 'hoian-audio-guide'                       # co dinh ten project => ten volume luon giong nhau o moi may
$dc = @('compose', '-p', $P)

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Fail($m) { Write-Host "`nLOI: $m" -ForegroundColor Red; Read-Host 'Nhan Enter de dong'; exit 1 }

Step 'Kiem tra Docker'
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Docker Desktop chua chay. Hay mo Docker Desktop, cho bao running roi chay lai.' }

Step 'Kiem tra file .env'
if (-not (Test-Path .env)) {
  Write-Host 'Khong co .env -> dung gia tri mac dinh trong docker-compose.yml (du de chay thu).' -ForegroundColor Yellow
}

Step 'Bat he thong (lan dau build + khoi phuc du lieu tu db\backup\ co the mat vai phut)'
# Service "migrate" tu khoi phuc db\backup\<DB>.bak neu may nay chua co database, roi moi bat cac service khac.
docker @dc up -d --build
if ($LASTEXITCODE -ne 0) { Fail 'Khong bat duoc he thong. Xem: docker compose -p hoian-audio-guide logs migrate sqlserver --tail 80' }
docker @dc logs migrate --tail 20

Step 'Cho API Gateway san sang'
$ok = $false
for ($i = 0; $i -lt 90 -and -not $ok; $i++) {
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://localhost:8080/health | Out-Null; $ok = $true } catch { Start-Sleep 2 }
}
if (-not $ok) { Fail 'Gateway chua san sang. Xem: docker compose -p hoian-audio-guide logs --tail 50' }

Step 'Mo tunnel HTTPS (cloudflared)'
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) { $cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
if (-not (Test-Path $cf)) { Fail 'Khong tim thay cloudflared. Cai: winget install Cloudflare.cloudflared (roi mo lai PowerShell).' }
$log = Join-Path $env:TEMP 'cloudflared-hoian.log'
Remove-Item $log, "$log.out" -ErrorAction SilentlyContinue
$tun = Start-Process $cf -ArgumentList 'tunnel', '--url', 'http://localhost:80' -PassThru -WindowStyle Hidden -RedirectStandardError $log -RedirectStandardOutput "$log.out"

try {
  $url = $null
  for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep 1
    if (Test-Path $log) {
      $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value }
    }
  }
  if (-not $url) { Fail "Khong lay duoc link tunnel. Xem log: $log" }

  Step 'Tao ma QR'
  if (-not (Test-Path node_modules\qrcode\index.js)) { npm install --no-save --no-audit --no-fund qrcode }
  node scripts/share-qr.mjs --url $url
  if (Test-Path qr-trang-chu.png) { Start-Process (Resolve-Path qr-trang-chu.png) }

  Write-Host "`nDANG CHAY. Link: $url" -ForegroundColor Green
  Write-Host "Admin: $url/admin"
  Write-Host 'Giu cua so nay mo. Nhan Ctrl+C hoac dong cua so de dung tunnel.' -ForegroundColor Yellow
  Wait-Process -Id $tun.Id
} finally {
  if ($tun -and -not $tun.HasExited) { Stop-Process -Id $tun.Id -Force }
}