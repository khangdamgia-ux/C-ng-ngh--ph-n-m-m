import { describe, expect, it } from 'vitest';
import { AppError, badRequest, conflict, errorBody, forbidden, notFound, unauthorized, upstreamUnavailable } from './errors.js';

describe('AppError và các hàm tạo lỗi', () => {
  it('giữ đúng mã HTTP, mã lỗi và thông điệp', () => {
    const e = new AppError(418, 'INTERNAL_ERROR', 'ấm trà');
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(418);
    expect(e.code).toBe('INTERNAL_ERROR');
    expect(e.message).toBe('ấm trà');
    expect(e.details).toBeUndefined();
  });

  it.each([
    [badRequest('sai dữ liệu'), 400, 'VALIDATION_ERROR'],
    [unauthorized(), 401, 'UNAUTHORIZED'],
    [forbidden(), 403, 'FORBIDDEN'],
    [notFound(), 404, 'NOT_FOUND'],
    [conflict('trùng mã'), 409, 'CONFLICT'],
    [upstreamUnavailable('content'), 503, 'UPSTREAM_UNAVAILABLE'],
  ])('%#: trả về đúng mã HTTP %i và mã lỗi %s', (err, status, code) => {
    expect(err.status).toBe(status);
    expect(err.code).toBe(code);
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('badRequest mang theo danh sách lỗi theo trường', () => {
    const details = [{ field: 'code', issue: 'bắt buộc' }];
    expect(badRequest('sai dữ liệu', details).details).toEqual(details);
  });

  it('upstreamUnavailable nêu tên dịch vụ trong thông điệp', () => {
    expect(upstreamUnavailable('analytics').message).toContain('analytics');
  });

  it('cho phép ghi đè thông điệp mặc định', () => {
    expect(notFound('Không có địa điểm').message).toBe('Không có địa điểm');
  });
});

describe('errorBody', () => {
  it('chỉ có code và message khi không có requestId/details', () => {
    expect(errorBody('NOT_FOUND', 'x')).toEqual({ error: { code: 'NOT_FOUND', message: 'x' } });
  });

  it('thêm requestId và details khi có', () => {
    const details = [{ field: 'lat', issue: 'ngoài phạm vi' }];
    expect(errorBody('VALIDATION_ERROR', 'y', 'req-1', details)).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'y', details, requestId: 'req-1' },
    });
  });
});
