@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   HOI AN AUDIO GUIDE - BAT HE THONG + XUAT DU LIEU + DAY LEN GITHUB
echo ============================================================
set "HOIAN_SELF=%~f0"
set "HOIAN_ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText($env:HOIAN_SELF); $m='#__PS'+'_START__#'; & ([ScriptBlock]::Create($s.Substring($s.IndexOf($m)+$m.Length)))"
echo.
pause
exit /b

#__PS_START__#
$ErrorActionPreference = 'Continue'
$root = $env:HOIAN_ROOT.TrimEnd('\')
Set-Location -LiteralPath $root
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Fail($m) { Write-Host "`nLOI: $m" -ForegroundColor Red; exit 1 }

if (-not (Test-Path docker-compose.yml)) { Fail 'Hay dat file nay vao thu muc hoian-audio-guide (cung cho voi docker-compose.yml) roi chay lai.' }
foreach ($f in 'backup.ps1', 'scripts\sql-backup.sh') {
  if (-not (Test-Path $f)) { Fail "Thieu $f. Hay dung ban hoian-audio-guide-ui-v22." }
}
$P = 'hoian-audio-guide'
$dc = @('compose', '-p', $P)

Step '1/5 Cap nhat scripts\db-migrate.mjs (ban da sua loi migrate)'
$b64 = @'
Ly8gQ2jhuqF5IG1pZ3JhdGlvbiAoZGIvbWlncmF0aW9ucykgdsOgIGThu68gbGnhu4d1IG3huqt1IChkYi9zZWVkLCB24bubaSAt
LXNlZWQpIHRoZW8gdGjhu6kgdOG7sSB0w6puIGZpbGUuCi8vIE3hu5dpIGZpbGUgY2jhu4kgY2jhuqF5IG3hu5l0IGzhuqduIOKA
kyBsxrB1IHbhur90IHRyb25nIGLhuqNuZyBkYm8uU2NoZW1hVmVyc2lvbnMuCi8vIE7hur91IGRhdGFiYXNlIENIxq9BIHThu5Nu
IHThuqFpIHbDoCBjw7MgZmlsZSA8UkVTVE9SRV9ESVI+LzxEQl9OQU1FPi5iYWsgdGjDrCBraMO0aSBwaOG7pWMgdOG7qyBmaWxl
IMSRw7MgdHLGsOG7m2MKLy8gKGThu68gbGnhu4d1IHRo4bqtdCDEkWkga8OobSByZXBvKSwgcuG7k2kgY2jDqXAgdGjGsCBt4bul
YyA8UkVTVE9SRV9ESVI+L21lZGlhIHbDoG8gTUVESUFfRElSIG7hur91IE1FRElBX0RJUiDEkWFuZyB0cuG7kW5nLgppbXBvcnQg
eyBjcFN5bmMsIGV4aXN0c1N5bmMsIG1rZGlyU3luYywgcmVhZGRpclN5bmMsIHJlYWRGaWxlU3luYyB9IGZyb20gJ25vZGU6ZnMn
OwppbXBvcnQgeyBkaXJuYW1lLCBqb2luIH0gZnJvbSAnbm9kZTpwYXRoJzsKaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20g
J25vZGU6dXJsJzsKaW1wb3J0IHNxbCBmcm9tICdtc3NxbCc7CmltcG9ydCBiY3J5cHQgZnJvbSAnYmNyeXB0anMnOwoKY29uc3Qg
cm9vdCA9IGpvaW4oZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpLCAnLi4nKTsKY29uc3Qgd2l0aFNlZWQg
PSBwcm9jZXNzLmFyZ3YuaW5jbHVkZXMoJy0tc2VlZCcpOwpjb25zdCBkYk5hbWUgPSBwcm9jZXNzLmVudi5EQl9OQU1FID8/ICdI
b2lBbkd1aWRlRGInOwppZiAoIS9eW0EtWmEtejAtOV9dKyQvLnRlc3QoZGJOYW1lKSkgdGhyb3cgbmV3IEVycm9yKCdEQl9OQU1F
IGtow7RuZyBo4bujcCBs4buHJyk7Cgpjb25zdCBiYXNlID0gewogIHNlcnZlcjogcHJvY2Vzcy5lbnYuREJfSE9TVCA/PyAnbG9j
YWxob3N0JywKICBwb3J0OiBOdW1iZXIocHJvY2Vzcy5lbnYuREJfUE9SVCA/PyAxNDMzKSwKICB1c2VyOiBwcm9jZXNzLmVudi5E
Ql9VU0VSID8/ICdzYScsCiAgcGFzc3dvcmQ6IHByb2Nlc3MuZW52LkRCX1BBU1NXT1JELAogIG9wdGlvbnM6IHsgZW5jcnlwdDog
cHJvY2Vzcy5lbnYuREJfRU5DUllQVCA9PT0gJ3RydWUnLCB0cnVzdFNlcnZlckNlcnRpZmljYXRlOiB0cnVlIH0sCiAgcmVxdWVz
dFRpbWVvdXQ6IDYwXzAwMCwKfTsKaWYgKCFiYXNlLnBhc3N3b3JkKSB0aHJvdyBuZXcgRXJyb3IoJ1RoaeG6v3UgYmnhur9uIG3D
tGkgdHLGsOG7nW5nIERCX1BBU1NXT1JEJyk7Cgphc3luYyBmdW5jdGlvbiBjb25uZWN0V2l0aFJldHJ5KGNvbmZpZywgYXR0ZW1w
dHMgPSAzMCkgewogIGZvciAobGV0IGkgPSAxOyA7IGkrKykgewogICAgdHJ5IHsKICAgICAgcmV0dXJuIGF3YWl0IG5ldyBzcWwu
Q29ubmVjdGlvblBvb2woY29uZmlnKS5jb25uZWN0KCk7CiAgICB9IGNhdGNoIChlcnIpIHsKICAgICAgaWYgKGkgPj0gYXR0ZW1w
dHMpIHRocm93IGVycjsKICAgICAgY29uc29sZS5sb2coYENo4budIFNRTCBTZXJ2ZXIgc+G6tW4gc8OgbmcuLi4gKCR7aX0vJHth
dHRlbXB0c30pYCk7CiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIDIwMDApKTsKICAgIH0KICB9
Cn0KCmNvbnN0IG1hc3RlciA9IGF3YWl0IGNvbm5lY3RXaXRoUmV0cnkoeyAuLi5iYXNlLCBkYXRhYmFzZTogJ21hc3RlcicsIHJl
cXVlc3RUaW1lb3V0OiA2MDBfMDAwIH0pOwpjb25zdCBsaXQgPSAodikgPT4gYE4nJHtTdHJpbmcodikucmVwbGFjZSgvJy9nLCAi
JyciKX0nYDsKY29uc3QgZGJFeGlzdHMgPSAoYXdhaXQgbWFzdGVyLnJlcXVlc3QoKS5xdWVyeShgU0VMRUNUIERCX0lEKCR7bGl0
KGRiTmFtZSl9KSBBUyBpZGApKS5yZWNvcmRzZXRbMF0uaWQgIT09IG51bGw7CmNvbnN0IHJlc3RvcmVEaXIgPSBwcm9jZXNzLmVu
di5SRVNUT1JFX0RJUjsKY29uc3QgYmFrRmlsZSA9IGAke2RiTmFtZX0uYmFrYDsKaWYgKCFkYkV4aXN0cyAmJiByZXN0b3JlRGly
ICYmIGV4aXN0c1N5bmMoam9pbihyZXN0b3JlRGlyLCBiYWtGaWxlKSkpIHsKICBjb25zdCBkaXNrID0gYCR7cHJvY2Vzcy5lbnYu
UkVTVE9SRV9ESVJfU1FMID8/IHJlc3RvcmVEaXJ9LyR7YmFrRmlsZX1gOwogIGNvbnNvbGUubG9nKGBLaMO0aSBwaOG7pWMgZGF0
YWJhc2UgdOG7qyAke2Jha0ZpbGV9IC4uLmApOwogIGNvbnN0IGZpbGVzID0gKGF3YWl0IG1hc3Rlci5yZXF1ZXN0KCkucXVlcnko
YFJFU1RPUkUgRklMRUxJU1RPTkxZIEZST00gRElTSyA9ICR7bGl0KGRpc2spfWApKS5yZWNvcmRzZXQ7CiAgY29uc3QgZGF0YURp
ciA9IChhd2FpdCBtYXN0ZXIucmVxdWVzdCgpLnF1ZXJ5KGBTRUxFQ1QgQ0FTVChTRVJWRVJQUk9QRVJUWSgnSW5zdGFuY2VEZWZh
dWx0RGF0YVBhdGgnKSBBUyBOVkFSQ0hBUig0MDApKSBBUyBwYCkpCiAgICAucmVjb3Jkc2V0WzBdLnAgPz8gJy92YXIvb3B0L21z
c3FsL2RhdGEvJzsKICBjb25zdCBsb2dEaXIgPSAoYXdhaXQgbWFzdGVyLnJlcXVlc3QoKS5xdWVyeShgU0VMRUNUIENBU1QoU0VS
VkVSUFJPUEVSVFkoJ0luc3RhbmNlRGVmYXVsdExvZ1BhdGgnKSBBUyBOVkFSQ0hBUig0MDApKSBBUyBwYCkpCiAgICAucmVjb3Jk
c2V0WzBdLnAgPz8gZGF0YURpcjsKICBjb25zdCB3aXRoU2xhc2ggPSAoZCkgPT4gKGQuZW5kc1dpdGgoJy8nKSB8fCBkLmVuZHNX
aXRoKCdcXCcpID8gZCA6IGAke2R9L2ApOwogIGNvbnN0IFtkRGlyLCBsRGlyXSA9IFt3aXRoU2xhc2goZGF0YURpciksIHdpdGhT
bGFzaChsb2dEaXIpXTsKICBjb25zdCBtb3ZlcyA9IGZpbGVzLm1hcCgoZiwgaSkgPT4gewogICAgY29uc3QgdGFyZ2V0ID0gZi5U
eXBlID09PSAnTCcgPyBgJHtsRGlyfSR7ZGJOYW1lfV9sb2cke2kgPyBgXyR7aX1gIDogJyd9LmxkZmAgOiBgJHtkRGlyfSR7ZGJO
YW1lfSR7aSA/IGBfJHtpfS5uZGZgIDogJy5tZGYnfWA7CiAgICByZXR1cm4gYE1PVkUgJHtsaXQoZi5Mb2dpY2FsTmFtZSl9IFRP
ICR7bGl0KHRhcmdldCl9YDsKICB9KTsKICBhd2FpdCBtYXN0ZXIucmVxdWVzdCgpLnF1ZXJ5KGBSRVNUT1JFIERBVEFCQVNFIFsk
e2RiTmFtZX1dIEZST00gRElTSyA9ICR7bGl0KGRpc2spfSBXSVRIICR7bW92ZXMuam9pbignLCAnKX0sIFJFUExBQ0UsIFJFQ09W
RVJZYCk7CiAgY29uc29sZS5sb2coYOKclCDEkMOjIGtow7RpIHBo4bulYyBkYXRhYmFzZSAke2RiTmFtZX0gdOG7qyAke2Jha0Zp
bGV9YCk7Cn0gZWxzZSBpZiAoZGJFeGlzdHMpIHsKICBjb25zb2xlLmxvZyhgRGF0YWJhc2UgJHtkYk5hbWV9IMSRw6MgY8OzIOKA
kyBnaeG7ryBuZ3V5w6puIGThu68gbGnhu4d1LmApOwp9CmF3YWl0IG1hc3Rlci5yZXF1ZXN0KCkucXVlcnkoYElGIERCX0lEKCR7
bGl0KGRiTmFtZSl9KSBJUyBOVUxMIENSRUFURSBEQVRBQkFTRSBbJHtkYk5hbWV9XWApOwphd2FpdCBtYXN0ZXIuY2xvc2UoKTsK
Ci8vIEZpbGUgw6JtIHRoYW5oL+G6o25oIMSRw6MgdOG6o2kgbMOqbiAodm9sdW1lIG1lZGlhKTogY2jhu4kgY2jDqXAga2hpIHZv
bHVtZSBjw7JuIHRy4buRbmcsIGtow7RuZyBnaGkgxJHDqApjb25zdCBtZWRpYVNyYyA9IHJlc3RvcmVEaXIgPyBqb2luKHJlc3Rv
cmVEaXIsICdtZWRpYScpIDogbnVsbDsKY29uc3QgbWVkaWFEc3QgPSBwcm9jZXNzLmVudi5NRURJQV9ESVI7CmlmIChtZWRpYVNy
YyAmJiBtZWRpYURzdCAmJiBleGlzdHNTeW5jKG1lZGlhU3JjKSkgewogIG1rZGlyU3luYyhtZWRpYURzdCwgeyByZWN1cnNpdmU6
IHRydWUgfSk7CiAgaWYgKHJlYWRkaXJTeW5jKG1lZGlhRHN0KS5sZW5ndGggPT09IDApIHsKICAgIGNwU3luYyhtZWRpYVNyYywg
bWVkaWFEc3QsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOwogICAgY29uc29sZS5sb2coJ+KclCDEkMOjIGNow6lwIGZpbGUgbWVkaWEg
dOG7qyBiYWNrdXAnKTsKICB9Cn0KCmNvbnN0IHBvb2wgPSBhd2FpdCBjb25uZWN0V2l0aFJldHJ5KHsgLi4uYmFzZSwgZGF0YWJh
c2U6IGRiTmFtZSB9KTsKYXdhaXQgcG9vbC5yZXF1ZXN0KCkucXVlcnkoYElGIE9CSkVDVF9JRCgnZGJvLlNjaGVtYVZlcnNpb25z
JykgSVMgTlVMTAogIENSRUFURSBUQUJMRSBkYm8uU2NoZW1hVmVyc2lvbnMgKHNjcmlwdCBOVkFSQ0hBUigyMDApIFBSSU1BUlkg
S0VZLCBhcHBsaWVkX2F0IERBVEVUSU1FMiBOT1QgTlVMTCBERUZBVUxUIFNZU1VUQ0RBVEVUSU1FKCkpYCk7Cgphc3luYyBmdW5j
dGlvbiBydW5EaXIoZGlyKSB7CiAgY29uc3QgZmlsZXMgPSByZWFkZGlyU3luYyhqb2luKHJvb3QsIGRpcikpLmZpbHRlcigoZikg
PT4gZi5lbmRzV2l0aCgnLnNxbCcpKS5zb3J0KCk7CiAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7CiAgICBjb25zdCBkb25l
ID0gYXdhaXQgcG9vbC5yZXF1ZXN0KCkuaW5wdXQoJ2YnLCBmaWxlKS5xdWVyeSgnU0VMRUNUIDEgQVMgeCBGUk9NIGRiby5TY2hl
bWFWZXJzaW9ucyBXSEVSRSBzY3JpcHQgPSBAZicpOwogICAgaWYgKGRvbmUucmVjb3Jkc2V0Lmxlbmd0aCkgY29udGludWU7CiAg
ICBjb25zdCBiYXRjaGVzID0gcmVhZEZpbGVTeW5jKGpvaW4ocm9vdCwgZGlyLCBmaWxlKSwgJ3V0ZjgnKS5zcGxpdCgvXlxzKkdP
XHMqJC9pbSkubWFwKChiKSA9PiBiLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pOwogICAgY29uc3QgdHggPSBuZXcgc3FsLlRyYW5z
YWN0aW9uKHBvb2wpOwogICAgYXdhaXQgdHguYmVnaW4oKTsKICAgIHRyeSB7CiAgICAgIGZvciAoY29uc3QgYmF0Y2ggb2YgYmF0
Y2hlcykgYXdhaXQgbmV3IHNxbC5SZXF1ZXN0KHR4KS5iYXRjaChiYXRjaCk7CiAgICAgIGF3YWl0IG5ldyBzcWwuUmVxdWVzdCh0
eCkuaW5wdXQoJ2YnLCBmaWxlKS5xdWVyeSgnSU5TRVJUIElOVE8gZGJvLlNjaGVtYVZlcnNpb25zIChzY3JpcHQpIFZBTFVFUyAo
QGYpJyk7CiAgICAgIGF3YWl0IHR4LmNvbW1pdCgpOwogICAgICBjb25zb2xlLmxvZyhg4pyUICR7ZGlyfS8ke2ZpbGV9YCk7CiAg
ICB9IGNhdGNoIChlcnIpIHsKICAgICAgdHJ5IHsgYXdhaXQgdHgucm9sbGJhY2soKTsgfSBjYXRjaCB7IC8qIFNRTCBTZXJ2ZXIg
xJHDoyB04buxIGjhu6d5IHRyYW5zYWN0aW9uIOKAkyBnaeG7ryBs4buXaSBn4buRYyBiw6puIGTGsOG7m2kgKi8gfQogICAgICB0
aHJvdyBuZXcgRXJyb3IoYEzhu5dpIGtoaSBjaOG6oXkgJHtmaWxlfTogJHtlcnIubWVzc2FnZX1gKTsKICAgIH0KICB9Cn0KCi8v
IERhdGFiYXNlIGPDsyBz4bq1biBi4bqjbmcgbmjGsG5nIGNoxrBhIHThu6tuZyBnaGkgduG6v3QgKHThuqFvIGLhurFuZyBjw6Fj
aCBraMOhYywgaG/hurdjIGtow7RpIHBo4bulYyB04burIGLhuqNuIGPFqSk6Ci8vIMSRw6FuaCBk4bqldSBt4buNaSBmaWxlIG1p
Z3JhdGlvbi9zZWVkIGhp4buHbiBjw7MgbMOgICLEkcOjIGNo4bqheSIgdGhheSB2w6wgY2jhuqF5IGzhuqFpICh0csOhbmggbOG7
l2kgYuG6o25nIMSRw6MgdOG7k24gdOG6oWksIGThu68gbGnhu4d1IHRyw7luZykuCmNvbnN0IHRyYWNrZWQgPSAoYXdhaXQgcG9v
bC5yZXF1ZXN0KCkucXVlcnkoJ1NFTEVDVCBDT1VOVCgqKSBBUyBuIEZST00gZGJvLlNjaGVtYVZlcnNpb25zJykpLnJlY29yZHNl
dFswXS5uOwpjb25zdCBoYXNUYWJsZXMgPSAoYXdhaXQgcG9vbC5yZXF1ZXN0KCkucXVlcnkoIlNFTEVDVCBPQkpFQ1RfSUQoJ2Ri
by5BZG1pbnMnKSBBUyBpZCIpKS5yZWNvcmRzZXRbMF0uaWQgIT09IG51bGw7CmlmICh0cmFja2VkID09PSAwICYmIGhhc1RhYmxl
cykgewogIGZvciAoY29uc3QgZGlyIG9mIFsnZGIvbWlncmF0aW9ucycsICdkYi9zZWVkJ10pIHsKICAgIGZvciAoY29uc3QgZmls
ZSBvZiByZWFkZGlyU3luYyhqb2luKHJvb3QsIGRpcikpLmZpbHRlcigoZikgPT4gZi5lbmRzV2l0aCgnLnNxbCcpKS5zb3J0KCkp
IHsKICAgICAgYXdhaXQgcG9vbC5yZXF1ZXN0KCkuaW5wdXQoJ2YnLCBmaWxlKS5xdWVyeSgnSU5TRVJUIElOVE8gZGJvLlNjaGVt
YVZlcnNpb25zIChzY3JpcHQpIFZBTFVFUyAoQGYpJyk7CiAgICAgIGNvbnNvbGUubG9nKGDihrcgxJDDoW5oIGThuqV1IMSRw6Mg
Y8OzIHPhurVuOiAke2Rpcn0vJHtmaWxlfWApOwogICAgfQogIH0KfQoKYXdhaXQgcnVuRGlyKCdkYi9taWdyYXRpb25zJyk7Cmlm
ICh3aXRoU2VlZCkgewogIGF3YWl0IHJ1bkRpcignZGIvc2VlZCcpOwogIGNvbnN0IHVzZXJuYW1lID0gcHJvY2Vzcy5lbnYuU0VF
RF9BRE1JTl9VU0VSTkFNRSA/PyAnYWRtaW4nOwogIGNvbnN0IHBhc3N3b3JkID0gcHJvY2Vzcy5lbnYuU0VFRF9BRE1JTl9QQVNT
V09SRDsKICBjb25zdCBleGlzdHMgPSBhd2FpdCBwb29sLnJlcXVlc3QoKS5xdWVyeSgnU0VMRUNUIFRPUCAxIGlkIEZST00gZGJv
LkFkbWlucycpOwogIGlmICghZXhpc3RzLnJlY29yZHNldC5sZW5ndGgpIHsKICAgIGlmICghcGFzc3dvcmQpIHRocm93IG5ldyBF
cnJvcignVGhp4bq/dSBTRUVEX0FETUlOX1BBU1NXT1JEIMSR4buDIHThuqFvIHTDoGkga2hv4bqjbiBTdXBlciBBZG1pbiDEkeG6
p3UgdGnDqm4nKTsKICAgIGNvbnN0IGhhc2ggPSBhd2FpdCBiY3J5cHQuaGFzaChwYXNzd29yZCwgMTIpOwogICAgYXdhaXQgcG9v
bC5yZXF1ZXN0KCkuaW5wdXQoJ3UnLCB1c2VybmFtZSkuaW5wdXQoJ2gnLCBoYXNoKQogICAgICAucXVlcnkoYElOU0VSVCBJTlRP
IGRiby5BZG1pbnMgKHVzZXJuYW1lLCBwYXNzd29yZF9oYXNoLCByb2xlKSBWQUxVRVMgKEB1LCBAaCwgJ1NVUEVSX0FETUlOJylg
KTsKICAgIGNvbnNvbGUubG9nKGDinJQgxJDDoyB04bqhbyBTdXBlciBBZG1pbiAiJHt1c2VybmFtZX0iYCk7CiAgfQp9CmF3YWl0
IHBvb2wuY2xvc2UoKTsKY29uc29sZS5sb2coJ0hvw6BuIHThuqV0IG1pZ3JhdGlvbi4nKTsK
'@
[IO.File]::WriteAllBytes((Join-Path $root 'scripts\db-migrate.mjs'), [Convert]::FromBase64String(($b64 -replace '\s', '')))
Write-Host 'Da cap nhat.'

Step '2/5 Kiem tra Docker'
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Docker Desktop chua chay, dang mo...' -ForegroundColor Yellow
  Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
  for ($i = 0; $i -lt 36; $i++) { Start-Sleep 5; docker info *> $null; if ($LASTEXITCODE -eq 0) { break } }
  if ($LASTEXITCODE -ne 0) { Fail 'Docker van chua san sang. Mo Docker Desktop bang tay, cho bao running roi chay lai.' }
}
Write-Host 'Docker OK.'

Step '3/5 Build + bat he thong (lan dau co the mat vai phut)'
docker @dc up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Host "`n--- Log migrate ---" -ForegroundColor Yellow
  docker @dc logs migrate --tail 60
  Fail 'Khong bat duoc he thong. Chup/gui doan log migrate o tren.'
}
$ok = $false
for ($i = 0; $i -lt 90 -and -not $ok; $i++) {
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://localhost:8080/health | Out-Null; $ok = $true } catch { Start-Sleep 2 }
}
if (-not $ok) { Fail 'API Gateway chua san sang. Xem: docker compose -p hoian-audio-guide logs --tail 50' }
Write-Host 'He thong dang chay: http://localhost  (Admin: http://localhost/admin)' -ForegroundColor Green

Step '4/5 Xuat du lieu ra db\backup\'
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'backup.ps1')
if ($LASTEXITCODE -ne 0) { Fail 'Xuat du lieu loi (xem thong bao o tren).' }
$bak = Get-ChildItem db\backup\*.bak -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $bak) { Fail 'Khong thay file .bak trong db\backup\.' }
if ($bak.Length -gt 95MB) { Fail "File $($bak.Name) qua lon cho GitHub (>95 MB)." }

Step '5/5 Day len GitHub'
git --version *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Chua cai Git. Cai bang lenh: winget install Git.Git  (roi mo lai cua so va chay lai file nay).' }
if (-not (Test-Path .git)) {
  git init | Out-Null
  git checkout -B main | Out-Null
}
if (-not (git config user.email)) {
  git config user.email (Read-Host 'Nhap email GitHub cua ban')
  git config user.name (Read-Host 'Nhap ten hien thi (vd: Trung)')
}
$remote = git remote get-url origin 2>$null
if (-not $remote) {
  Write-Host 'Tao repo TRONG tren github.com (khong tick README/.gitignore) roi dan link vao day.' -ForegroundColor Yellow
  $url = Read-Host 'Link repo (vd https://github.com/ten-ban/hoian-audio-guide.git)'
  if (-not $url) { Fail 'Chua nhap link repo.' }
  git remote add origin $url.Trim()
}
if (git ls-files .env) { git rm --cached -q .env }   # khong bao gio day mat khau len GitHub
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -q -m "Hoi An Audio Guide + du lieu $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  if ($LASTEXITCODE -ne 0) { Fail 'git commit loi.' }
} else { Write-Host 'Khong co thay doi moi de commit.' }
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
git push -u origin $branch
if ($LASTEXITCODE -ne 0) {
  Fail 'git push loi. Thuong do: chua dang nhap GitHub (cua so dang nhap se hien ra, dang nhap roi chay lai), hoac repo tren GitHub khong trong.'
}
Write-Host "`nXONG! Code + du lieu da len GitHub: $(git remote get-url origin)" -ForegroundColor Green
Write-Host 'Nguoi khac chi can: git clone <link>  ->  cd vao thu muc  ->  docker compose up -d --build'
Write-Host 'Lan sau sua du lieu: chay lai file nay de cap nhat len GitHub.'
