/**
 * E2E – định vị GPS + tự thuyết minh (FR-05): bấm “Bật định vị của tôi” MỘT lần, giả lập GPS của trình duyệt
 * lần lượt đứng tại 8 di tích → hệ thống phải tự thuyết minh đủ 8 di tích, đúng thứ tự.
 * Kiểm tra thêm: đang nghe tiếng Việt mà đổi sang English thì thuyết minh tự chuyển sang tiếng Anh.
 *
 * Chạy: npx playwright install chromium   (lần đầu)
 *       BASE_URL=http://localhost:5173 npm run test:e2e
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const ROUTE = [
  ['Nhà cổ Phùng Hưng', 'nha-co-phung-hung'], ['Chùa Cầu – Lai Viễn Kiều', 'chua-cau'], ['Bảo tàng Văn hóa Sa Huỳnh', 'bao-tang-sa-huynh'],
  ['Hội quán Quảng Đông', 'hoi-quan-quang-dong'], ['Nhà cổ Quân Thắng', 'nha-co-quan-thang'], ['Bảo tàng Gốm sứ Mậu dịch', 'bao-tang-gom-su'],
  ['Hội quán Phúc Kiến', 'hoi-quan-phuc-kien'], ['Quan Công Miếu', 'quan-cong-mieu'],
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'vi-VN', permissions: ['geolocation'], geolocation: { latitude: 15.877, longitude: 108.3252, accuracy: 5 } });
// Giọng đọc giả: ghi lại câu đã đọc, mỗi câu “đọc” trong 30 ms
await ctx.addInitScript(() => {
  localStorage.setItem('hoian.nearbyRadius', '50');
  window.__spoken = [];
  Object.defineProperty(window, 'speechSynthesis', {
    value: { getVoices: () => [], cancel() {}, pause() {}, resume() {}, speak(u) { window.__spoken.push({ lang: u.lang, text: u.text }); setTimeout(() => u.onend?.(), 30); } },
  });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/tile\.openstreetmap\.org|arcgisonline/, (r) => r.abort());
await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
await page.click('.gps-start'); // thao tác duy nhất

const places = await page.evaluate(async () => (await (await fetch('/api/v1/locations?lang=vi&pageSize=100')).json()).items);
for (const [, code] of ROUTE) {
  const p = places.find((x) => x.code === code);
  // Đứng tại di tích > 3 s (dwell), mỗi giây một mẫu GPS hơi lệch như GPS thật
  for (let i = 0; i < 5; i++) {
    await ctx.setGeolocation({ latitude: p.latitude + (i % 2) * 0.000005, longitude: p.longitude, accuracy: 6 });
    await page.waitForTimeout(1000);
  }
}
await page.waitForTimeout(2000);
const visited = await page.evaluate(() => JSON.parse(localStorage.getItem('hoian.history') || '[]').reverse().map((h) => h.title));
console.log('Đã tự thuyết minh:', visited);
const expected = ROUTE.map(([t]) => t);
let ok = JSON.stringify(visited) === JSON.stringify(expected);

// Đổi ngôn ngữ khi đang nghe
await page.goto(`${BASE}/l/chua-cau`);
await page.evaluate(() => {
  window.speechSynthesis.speak = (u) => window.__spoken.push({ lang: u.lang, text: u.text }); // câu “dài”, không tự kết thúc
});
await page.click('.player .main');
await page.waitForTimeout(500);
const n = await page.evaluate(() => window.__spoken.length);
await page.selectOption('.lang-select', 'en');
await page.waitForTimeout(1500);
const switched = await page.evaluate((from) => window.__spoken.slice(from).some((s) => s.lang === 'en-US'), n);
console.log('Tự chuyển thuyết minh sang tiếng Anh:', switched);
ok = ok && switched && errors.length === 0;
await browser.close();
if (!ok) {
  console.error('✗ THẤT BẠI. Mong đợi:', expected, 'Lỗi trang:', errors);
  process.exit(1);
}
console.log('✓ ĐẠT');
