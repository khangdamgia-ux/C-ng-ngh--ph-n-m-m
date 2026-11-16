// Nap du 6 ngon ngu (vi, en, fr, ko, zh, ja) cho 15 dia diem vao database dang chay.
// AN TOAN: chi THEM cai con thieu (ngon ngu, dia diem, ban thuyet minh). KHONG ghi de noi dung da sua trong admin.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'db/seed/data');
const read = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
const base = read('locations.json');
const LANGS = ['vi', 'en', 'fr', 'ko', 'zh', 'ja'];

const dbName = process.env.DB_NAME ?? 'HoiAnGuideDb';
if (!process.env.DB_PASSWORD) throw new Error('Thieu bien moi truong DB_PASSWORD');
const pool = await new sql.ConnectionPool({
  server: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 1433),
  user: process.env.DB_USER ?? 'sa',
  password: process.env.DB_PASSWORD,
  database: dbName,
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: true },
  requestTimeout: 60_000,
}).connect();

const q = (text, params = {}) => {
  const r = pool.request();
  for (const [k, [type, v]] of Object.entries(params)) r.input(k, type, v);
  return r.query(text);
};
const NV = sql.NVarChar, V = sql.VarChar, I = sql.Int, MAX = sql.NVarChar(sql.MAX);

const stat = { lang: 0, langEnabled: 0, loc: 0, narr: 0, narrSkipped: 0 };

// 1) Danh muc + ngon ngu
for (const c of base.categories) {
  await q(`IF NOT EXISTS (SELECT 1 FROM dbo.LocationCategories WHERE code = @c)
    INSERT INTO dbo.LocationCategories (code, name, sort_order) VALUES (@c, @n, @s)`,
    { c: [V, c.code], n: [NV(200), c.name], s: [I, c.sortOrder] });
}
const hasDefault = (await q('SELECT 1 x FROM dbo.Languages WHERE is_default = 1')).recordset.length > 0;
for (const l of base.languages) {
  const ex = await q('SELECT id, is_enabled FROM dbo.Languages WHERE code = @c', { c: [V, l.code] });
  if (!ex.recordset.length) {
    await q(`INSERT INTO dbo.Languages (code, name, is_default, is_enabled, fallback_order) VALUES (@c, @n, @d, 1, @f)`,
      { c: [V, l.code], n: [NV(100), l.name], d: [sql.Bit, l.isDefault && !hasDefault ? 1 : 0], f: [I, l.fallbackOrder ?? null] });
    stat.lang++;
  } else if (!ex.recordset[0].is_enabled) {
    await q('UPDATE dbo.Languages SET is_enabled = 1 WHERE code = @c', { c: [V, l.code] });
    stat.langEnabled++;
  }
}

// 2) Dia diem con thieu
for (const l of base.locations) {
  const r = await q(`IF NOT EXISTS (SELECT 1 FROM dbo.Locations WHERE code = @code)
    INSERT INTO dbo.Locations (code, name, address, latitude, longitude, category_id, trigger_radius_m, priority, opening_hours, is_published)
    VALUES (@code, @name, @addr, @lat, @lng, (SELECT id FROM dbo.LocationCategories WHERE code = @cat), @rad, @pri, @oh, 1)`,
    { code: [V, l.code], name: [NV(250), l.name], addr: [NV(500), l.address ?? null], lat: [sql.Decimal(9, 6), l.lat], lng: [sql.Decimal(9, 6), l.lng],
      cat: [V, l.category], rad: [I, l.radius], pri: [I, l.priority], oh: [NV(500), l.openingHours ?? null] });
  stat.loc += r.rowsAffected?.[0] ?? 0;
}

// 3) Ban thuyet minh con thieu cho tung ngon ngu
for (const lang of LANGS) {
  for (const n of read(`${lang}.json`)) {
    const r = await q(`IF NOT EXISTS (SELECT 1 FROM dbo.Narrations n JOIN dbo.Locations l ON l.id = n.location_id JOIN dbo.Languages g ON g.id = n.language_id WHERE l.code = @code AND g.code = @lang)
      INSERT INTO dbo.Narrations (location_id, language_id, title, summary, content, status)
      VALUES ((SELECT id FROM dbo.Locations WHERE code = @code), (SELECT id FROM dbo.Languages WHERE code = @lang), @title, @summary, @content, 'PUBLISHED')`,
      { code: [V, n.code], lang: [V, lang], title: [NV(250), n.title], summary: [NV(500), n.summary ?? null], content: [MAX, n.content] });
    if (r.rowsAffected?.[0]) stat.narr++; else stat.narrSkipped++;
  }
}

const cov = await q(`SELECT g.code lang, COUNT(*) n FROM dbo.Narrations x JOIN dbo.Languages g ON g.id = x.language_id GROUP BY g.code ORDER BY g.code`);
await pool.close();
console.log(`Them moi: ${stat.lang} ngon ngu, ${stat.langEnabled} ngon ngu duoc bat lai, ${stat.loc} dia diem, ${stat.narr} ban thuyet minh. Da co san (giu nguyen): ${stat.narrSkipped}.`);
console.log('So ban thuyet minh hien co theo ngon ngu:', cov.recordset.map((r) => `${r.lang}=${r.n}`).join('  '));
