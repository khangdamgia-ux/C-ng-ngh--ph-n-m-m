import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  AppError, asyncHandler, badRequest, conflict, createBaseApp, createLogger, env, finalize, notFound, parse, query,
  requireInternalKey, requireRole, unauthorized, type AdminRole,
} from '@hoian/shared';
import { LoginLimiter } from './loginLimiter.js';

const logger = createLogger('auth');

interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  role: AdminRole;
  status: 'ACTIVE' | 'DISABLED';
  last_login_at: Date | null;
  created_at: Date;
}

const toDto = (a: AdminRow) => ({ id: a.id, username: a.username, role: a.role, status: a.status, lastLoginAt: a.last_login_at, createdAt: a.created_at });

export function createApp() {
  const app = createBaseApp('auth');
  const limiter = new LoginLimiter();
  const secret = () => env('JWT_SECRET');
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '60m';

  // FR-13: đăng nhập Admin
  app.post(
    '/auth/login',
    asyncHandler(async (req, res) => {
      const body = parse(z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(200) }), req.body);
      const ip = req.header('x-forwarded-for')?.split(',')[0].trim() || req.ip || 'unknown';
      if (limiter.isLocked(ip, body.username)) {
        throw new AppError(429, 'RATE_LIMITED', 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút');
      }
      const [admin] = await query<AdminRow>('SELECT * FROM dbo.Admins WHERE username = @u', { u: body.username });
      const ok = admin && admin.status === 'ACTIVE' && (await bcrypt.compare(body.password, admin.password_hash));
      if (!ok) {
        limiter.recordFailure(ip, body.username);
        // Thông báo lỗi chung – không tiết lộ sai tên hay sai mật khẩu
        throw unauthorized('Thông tin đăng nhập không đúng');
      }
      limiter.reset(ip, body.username);
      await query('UPDATE dbo.Admins SET last_login_at = SYSUTCDATETIME() WHERE id = @id', { id: admin.id });
      const token = jwt.sign({ sub: String(admin.id), role: admin.role, username: admin.username }, secret(), {
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
        algorithm: 'HS256',
      });
      res.json({ token, admin: toDto(admin) });
    }),
  );

  app.post('/auth/logout', (_req, res) => res.status(204).end());

  app.get(
    '/auth/me',
    requireInternalKey,
    requireRole(),
    asyncHandler(async (req, res) => {
      const [admin] = await query<AdminRow>('SELECT * FROM dbo.Admins WHERE id = @id', { id: req.user!.id });
      if (!admin) throw notFound();
      res.json(toDto(admin));
    }),
  );

  // Gateway gọi để xác thực JWT (PRD 16.3)
  app.post(
    '/internal/auth/verify',
    requireInternalKey,
    asyncHandler(async (req, res) => {
      const { token } = parse(z.object({ token: z.string().min(1) }), req.body);
      let payload: jwt.JwtPayload;
      try {
        payload = jwt.verify(token, secret(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
      } catch {
        throw unauthorized('Token không hợp lệ hoặc đã hết hạn');
      }
      const [admin] = await query<AdminRow>('SELECT id, role, status FROM dbo.Admins WHERE id = @id', { id: Number(payload.sub) });
      if (!admin || admin.status !== 'ACTIVE') throw unauthorized('Tài khoản không còn hiệu lực');
      res.json({ adminId: admin.id, role: admin.role, exp: payload.exp });
    }),
  );

  // Quản lý tài khoản Admin – chỉ SUPER_ADMIN
  const adminOnly = [requireInternalKey, requireRole('SUPER_ADMIN')];
  app.get(
    '/admin/accounts',
    ...adminOnly,
    asyncHandler(async (_req, res) => {
      const rows = await query<AdminRow>('SELECT * FROM dbo.Admins ORDER BY id');
      res.json({ items: rows.map(toDto) });
    }),
  );

  const accountSchema = z.object({
    username: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/, 'Chỉ dùng chữ, số, . _ -'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(200),
    role: z.enum(['SUPER_ADMIN', 'EDITOR']).default('EDITOR'),
  });
  app.post(
    '/admin/accounts',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const body = parse(accountSchema, req.body);
      const dup = await query('SELECT 1 AS x FROM dbo.Admins WHERE username = @u', { u: body.username });
      if (dup.length) throw conflict('Tên đăng nhập đã tồn tại');
      const hash = await bcrypt.hash(body.password, 12);
      const [row] = await query<AdminRow>(
        'INSERT INTO dbo.Admins (username, password_hash, role) OUTPUT INSERTED.* VALUES (@u, @h, @r)',
        { u: body.username, h: hash, r: body.role },
      );
      res.status(201).json(toDto(row));
    }),
  );

  app.put(
    '/admin/accounts/:id',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const body = parse(
        z.object({ role: z.enum(['SUPER_ADMIN', 'EDITOR']).optional(), status: z.enum(['ACTIVE', 'DISABLED']).optional(), password: z.string().min(8).max(200).optional() }),
        req.body,
      );
      if (id === req.user!.id && (body.status === 'DISABLED' || body.role === 'EDITOR')) throw badRequest('Không thể tự hạ quyền hoặc vô hiệu hóa chính mình');
      const hash = body.password ? await bcrypt.hash(body.password, 12) : null;
      const [row] = await query<AdminRow>(
        `UPDATE dbo.Admins SET role = COALESCE(@r, role), status = COALESCE(@s, status),
           password_hash = COALESCE(@h, password_hash), updated_at = SYSUTCDATETIME()
         OUTPUT INSERTED.* WHERE id = @id`,
        { id, r: body.role ?? null, s: body.status ?? null, h: hash },
      );
      if (!row) throw notFound('Không tìm thấy tài khoản');
      res.json(toDto(row));
    }),
  );

  return finalize(app, logger);
}
