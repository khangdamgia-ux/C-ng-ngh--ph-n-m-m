// Tải sẵn ảnh bản đồ khu Phố cổ Hội An (zoom 14–18) vào apps/web/public/tiles-local/ để ĐÓNG GÓI CÙNG WEBSITE.
// Có bộ ảnh này thì bản đồ hiện ngay trên mọi thiết bị, mọi mạng (kể cả mạng chặn OSM hay mất mạng giữa đường).
//
// Chạy MỘT LẦN trên máy có Internet:   npm run tiles:offline
// Rồi build lại web (start.bat tự build). Chạy lại không tải lại ô đã có.
//
// Tuân thủ chính sách OSM: số lượng nhỏ (~vài trăm ô), tải tuần tự có nghỉ, có User-Agent + Referer định danh.
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'apps/web/public/tiles-local');
const MIN_Z = 14, MAX_Z = 18, PAD_M = 350, DELAY_MS = 300;

const seed = JSON.parse(await readFile(join(root, 'db/seed/data/locations.json'), 'utf8'));
const pts = seed.locations.filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number');
if (!pts.length) throw new Error('Không có tọa độ trong db/seed/data/locations.json');
const dLat = PAD_M / 111_320;
const lat0 = Math.min(...pts.map((p) => p.lat)), lat1 = Math.max(...pts.map((p) => p.lat));
const dLng = PAD_M / (111_320 * Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180));
const bounds = [lat0 - dLat, Math.min(...pts.map((p) => p.lng)) - dLng, lat1 + dLat, Math.max(...pts.map((p) => p.lng)) + dLng]; // nam, tây, bắc, đông

const tx = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
const ty = (lat, z) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z); };

const jobs = [];
for (let z = MIN_Z; z <= MAX_Z; z++) {
  for (let x = tx(bounds[1], z); x <= tx(bounds[3], z); x++) for (let y = ty(bounds[2], z); y <= ty(bounds[0], z); y++) jobs.push({ z, x, y });
}
console.log(`Vùng: ${bounds.map((n) => n.toFixed(4)).join(', ')} · ${jobs.length} ô (zoom ${MIN_Z}–${MAX_Z})`);

const exists = (f) => stat(f).then((s) => s.size > 60, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let done = 0, fail = 0;
for (const { z, x, y } of jobs) {
  const file = join(out, String(z), String(x), `${y}.png`);
  if (await exists(file)) { done++; continue; }
  let ok = false;
  // Thử lần lượt nhiều nguồn: nhà mạng có thể chặn một nguồn (vd. OSM) nhưng không chặn nguồn khác
  const urls = [
    `https:///${x}/${y}.png`,
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
  ];
  for (const url of urls) {
    if (ok) break;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(10_000),
          headers: { 'User-Agent': 'HoiAnAudioGuide/1.0 (one-time offline tile bundle for a small tourist audio guide)', Referer: 'https://www.openstreetmap.org/' },
        });
        if (res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('image/')) {
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, Buffer.from(await res.arrayBuffer()));
          ok = true;
        } else if (res.status === 429) { console.log('  Bị giới hạn tốc độ, nghỉ 20 giây…'); await sleep(20_000); }
        else break; // 403/404/...: đổi nguồn khác
      } catch { await sleep(500); }
    }
  }
      if (ok) done++;
     else fail++;
  if ((done + fail) % 25 === 0) console.log(`  ${done + fail}/${jobs.length}`);
  await sleep(DELAY_MS);
}
await mkdir(out, { recursive: true });
await writeFile(join(out, 'manifest.json'), JSON.stringify({ minZoom: MIN_Z, maxZoom: MAX_Z, bounds, tiles: done, createdAt: new Date().toISOString() }));
console.log(fail ? `Xong, còn ${fail} ô lỗi (chạy lại lệnh để tải nốt).` : `Xong: ${done} ô → apps/web/public/tiles-local/. Hãy build lại web.`);
