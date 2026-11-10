// Chạy migration (db/migrations) và dữ liệu mẫu (db/seed, với --seed) theo thứ tự tên file.
// Mỗi file chỉ chạy một lần – lưu vết trong bảng dbo.SchemaVersions.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const withSeed = process.argv.includes('--seed');
const dbName = process.env.DB_NAME ?? 'HoiAnGuideDb';
if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME không hợp lệ');

const base = {
  server: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 1433),
  user: process.env.DB_USER ?? 'sa',
  password: process.env.DB_PASSWORD,
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: true },
  requestTimeout: 60_000,
};
if (!base.password) throw new Error('Thiếu biến môi trường DB_PASSWORD');

async function connectWithRetry(config, attempts = 30) {
  for (let i = 1; ; i++) {
    try {
      return await new sql.ConnectionPool(config).connect();
    } catch (err) {
      if (i >= attempts) throw err;
      console.log(`Chờ SQL Server sẵn sàng... (${i}/${attempts})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const master = await connectWithRetry({ ...base, database: 'master' });
await master.request().query(`IF DB_ID('${dbName}') IS NULL CREATE DATABASE [${dbName}]`);
await master.close();

const pool = await connectWithRetry({ ...base, database: dbName });
await pool.request().query(`IF OBJECT_ID('dbo.SchemaVersions') IS NULL
  CREATE TABLE dbo.SchemaVersions (script NVARCHAR(200) PRIMARY KEY, applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())`);

async function runDir(dir) {
  const files = readdirSync(join(root, dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const done = await pool.request().input('f', file).query('SELECT 1 AS x FROM dbo.SchemaVersions WHERE script = @f');
    if (done.recordset.length) continue;
    const batches = readFileSync(join(root, dir, file), 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const batch of batches) await new sql.Request(tx).batch(batch);
      await new sql.Request(tx).input('f', file).query('INSERT INTO dbo.SchemaVersions (script) VALUES (@f)');
      await tx.commit();
      console.log(`✔ ${dir}/${file}`);
    } catch (err) {
      await tx.rollback();
      throw new Error(`Lỗi khi chạy ${file}: ${err.message}`);
    }
  }
}

await runDir('db/migrations');
if (withSeed) await runDir('db/seed');
await pool.close();
console.log('Hoàn tất migration.');
