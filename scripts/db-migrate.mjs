// Chạy migration (db/migrations) và dữ liệu mẫu (db/seed, với --seed) theo thứ tự tên file.
// Mỗi file chỉ chạy một lần – lưu vết trong bảng dbo.SchemaVersions.
// Nếu database CHƯA tồn tại và có file <RESTORE_DIR>/<DB_NAME>.bak thì khôi phục từ file đó trước
// (dữ liệu thật đi kèm repo), rồi chép thư mục <RESTORE_DIR>/media vào MEDIA_DIR nếu MEDIA_DIR đang trống.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import bcrypt from 'bcryptjs';

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

const master = await connectWithRetry({ ...base, database: 'master', requestTimeout: 600_000 });
const lit = (v) => `N'${String(v).replace(/'/g, "''")}'`;
const dbExists = (await master.request().query(`SELECT DB_ID(${lit(dbName)}) AS id`)).recordset[0].id !== null;
const restoreDir = process.env.RESTORE_DIR;
const bakFile = `${dbName}.bak`;
if (!dbExists && restoreDir && existsSync(join(restoreDir, bakFile))) {
  const disk = `${process.env.RESTORE_DIR_SQL ?? restoreDir}/${bakFile}`;
  console.log(`Khôi phục database từ ${bakFile} ...`);
  const files = (await master.request().query(`RESTORE FILELISTONLY FROM DISK = ${lit(disk)}`)).recordset;
  const dataDir = (await master.request().query(`SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(400)) AS p`))
    .recordset[0].p ?? '/var/opt/mssql/data/';
  const logDir = (await master.request().query(`SELECT CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS NVARCHAR(400)) AS p`))
    .recordset[0].p ?? dataDir;
  const withSlash = (d) => (d.endsWith('/') || d.endsWith('\\') ? d : `${d}/`);
  const [dDir, lDir] = [withSlash(dataDir), withSlash(logDir)];
  const moves = files.map((f, i) => {
    const target = f.Type === 'L' ? `${lDir}${dbName}_log${i ? `_${i}` : ''}.ldf` : `${dDir}${dbName}${i ? `_${i}.ndf` : '.mdf'}`;
    return `MOVE ${lit(f.LogicalName)} TO ${lit(target)}`;
  });
  await master.request().query(`RESTORE DATABASE [${dbName}] FROM DISK = ${lit(disk)} WITH ${moves.join(', ')}, REPLACE, RECOVERY`);
  console.log(`✔ Đã khôi phục database ${dbName} từ ${bakFile}`);
} else if (dbExists) {
  console.log(`Database ${dbName} đã có – giữ nguyên dữ liệu.`);
}
await master.request().query(`IF DB_ID(${lit(dbName)}) IS NULL CREATE DATABASE [${dbName}]`);
await master.close();

// File âm thanh/ảnh đã tải lên (volume media): chỉ chép khi volume còn trống, không ghi đè
const mediaSrc = restoreDir ? join(restoreDir, 'media') : null;
const mediaDst = process.env.MEDIA_DIR;
if (mediaSrc && mediaDst && existsSync(mediaSrc)) {
  mkdirSync(mediaDst, { recursive: true });
  if (readdirSync(mediaDst).length === 0) {
    cpSync(mediaSrc, mediaDst, { recursive: true });
    console.log('✔ Đã chép file media từ backup');
  }
}

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
      try { await tx.rollback(); } catch { /* SQL Server đã tự hủy transaction – giữ lỗi gốc bên dưới */ }
      throw new Error(`Lỗi khi chạy ${file}: ${err.message}`);
    }
  }
}

// Database có sẵn bảng nhưng chưa từng ghi vết (tạo bằng cách khác, hoặc khôi phục từ bản cũ):
// đánh dấu mọi file migration/seed hiện có là "đã chạy" thay vì chạy lại (tránh lỗi bảng đã tồn tại, dữ liệu trùng).
const tracked = (await pool.request().query('SELECT COUNT(*) AS n FROM dbo.SchemaVersions')).recordset[0].n;
const hasTables = (await pool.request().query("SELECT OBJECT_ID('dbo.Admins') AS id")).recordset[0].id !== null;
if (tracked === 0 && hasTables) {
  for (const dir of ['db/migrations', 'db/seed']) {
    for (const file of readdirSync(join(root, dir)).filter((f) => f.endsWith('.sql')).sort()) {
      await pool.request().input('f', file).query('INSERT INTO dbo.SchemaVersions (script) VALUES (@f)');
      console.log(`↷ Đánh dấu đã có sẵn: ${dir}/${file}`);
    }
  }
}

await runDir('db/migrations');
if (withSeed) {
  await runDir('db/seed');
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD;
  const exists = await pool.request().query('SELECT TOP 1 id FROM dbo.Admins');
  if (!exists.recordset.length) {
    if (!password) throw new Error('Thiếu SEED_ADMIN_PASSWORD để tạo tài khoản Super Admin đầu tiên');
    const hash = await bcrypt.hash(password, 12);
    await pool.request().input('u', username).input('h', hash)
      .query(`INSERT INTO dbo.Admins (username, password_hash, role) VALUES (@u, @h, 'SUPER_ADMIN')`);
    console.log(`✔ Đã tạo Super Admin "${username}"`);
  }
}
await pool.close();
console.log('Hoàn tất migration.');
