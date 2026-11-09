import sql from 'mssql';
import { env, envInt } from './env.js';

let pool: sql.ConnectionPool | undefined;
let connecting: Promise<sql.ConnectionPool> | undefined;

export function dbConfig(): sql.config {
  return {
    server: env('DB_HOST', 'localhost'),
    port: envInt('DB_PORT', 1433),
    database: env('DB_NAME', 'HoiAnGuideDb'),
    user: env('DB_USER', 'sa'),
    password: env('DB_PASSWORD'),
    options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: true },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 5_000,
    requestTimeout: 10_000,
  };
}

/** Pool kết nối dùng chung trong một service (lazy). */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  if (!connecting) {
    connecting = new sql.ConnectionPool(dbConfig())
      .connect()
      .then((p) => {
        pool = p;
        return p;
      })
      .finally(() => {
        connecting = undefined;
      });
  }
  return connecting;
}

export async function closePool() {
  await pool?.close();
  pool = undefined;
}

/** Tạo request đã gắn tham số (truy vấn tham số hóa – chống SQL Injection). */
export async function query<T>(text: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const request = (await getPool()).request();
  for (const [key, value] of Object.entries(params)) request.input(key, value as never);
  const result = await request.query<T>(text);
  return result.recordset ?? [];
}

export { sql };
