// Sinh db/seed/V100__seed_hoian.sql từ dữ liệu JSON (15 địa điểm × 6 ngôn ngữ – PRD Phụ lục A, C).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'db/seed/data');
const base = JSON.parse(readFileSync(join(dataDir, 'locations.json'), 'utf8'));
const s = (v) => (v === null || v === undefined ? 'NULL' : `N'${String(v).replaceAll("'", "''")}'`);

const out = ['-- File sinh tự động bởi scripts/generate-seed.mjs – KHÔNG sửa tay.', 'SET NOCOUNT ON;', ''];

for (const c of base.categories) {
  out.push(`IF NOT EXISTS (SELECT 1 FROM dbo.LocationCategories WHERE code = ${s(c.code)})
  INSERT INTO dbo.LocationCategories (code, name, sort_order) VALUES (${s(c.code)}, ${s(c.name)}, ${c.sortOrder});`);
}
for (const l of base.languages) {
  out.push(`IF NOT EXISTS (SELECT 1 FROM dbo.Languages WHERE code = ${s(l.code)})
  INSERT INTO dbo.Languages (code, name, is_default, is_enabled, fallback_order) VALUES (${s(l.code)}, ${s(l.name)}, ${l.isDefault ? 1 : 0}, 1, ${l.fallbackOrder ?? 'NULL'});`);
}
for (const l of base.locations) {
  out.push(`IF NOT EXISTS (SELECT 1 FROM dbo.Locations WHERE code = ${s(l.code)})
  INSERT INTO dbo.Locations (code, name, address, latitude, longitude, category_id, trigger_radius_m, priority, opening_hours, is_published)
  VALUES (${s(l.code)}, ${s(l.name)}, ${s(l.address)}, ${l.lat}, ${l.lng}, (SELECT id FROM dbo.LocationCategories WHERE code = ${s(l.category)}), ${l.radius}, ${l.priority}, ${s(l.openingHours)}, 1);`);
}
out.push('GO');

for (const lang of ['vi', 'en', 'fr', 'ko', 'zh', 'ja']) {
  const items = JSON.parse(readFileSync(join(dataDir, `${lang}.json`), 'utf8'));
  for (const n of items) {
    out.push(`IF NOT EXISTS (SELECT 1 FROM dbo.Narrations n JOIN dbo.Locations l ON l.id = n.location_id JOIN dbo.Languages g ON g.id = n.language_id WHERE l.code = ${s(n.code)} AND g.code = ${s(lang)})
  INSERT INTO dbo.Narrations (location_id, language_id, title, summary, content, status)
  VALUES ((SELECT id FROM dbo.Locations WHERE code = ${s(n.code)}), (SELECT id FROM dbo.Languages WHERE code = ${s(lang)}), ${s(n.title)}, ${s(n.summary)}, ${s(n.content)}, 'PUBLISHED');`);
  }
  out.push('GO');
}

writeFileSync(join(root, 'db/seed/V100__seed_hoian.sql'), out.join('\n') + '\n');
console.log('Đã sinh db/seed/V100__seed_hoian.sql');
