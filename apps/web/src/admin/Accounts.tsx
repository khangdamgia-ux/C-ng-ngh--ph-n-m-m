import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi } from './auth';

interface Account { id: number; username: string; role: string; status: string; lastLoginAt: string | null }

/** Quản lý tài khoản Admin – chỉ SUPER_ADMIN (NFR-04). */
export function Accounts() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['accounts'], queryFn: () => adminApi<{ items: Account[] }>('/accounts') });
  const [f, setF] = useState({ username: '', password: '', role: 'EDITOR' });
  const create = useMutation({
    mutationFn: () => adminApi('/accounts', { method: 'POST', body: f }),
    onSuccess: () => {
      setF({ username: '', password: '', role: 'EDITOR' });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => adminApi(`/accounts/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
  return (
    <>
      <header className="page-head"><div><h1>Tài khoản quản trị</h1><p className="muted">Tạo tài khoản biên tập viên và bật/tắt quyền truy cập.</p></div></header>
      <div className="panel">
        <table>
          <thead><tr><th>Tên đăng nhập</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th></th></tr></thead>
          <tbody>
            {list.data?.items.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td><td>{a.role}</td><td>{a.status}</td>
                <td>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('vi-VN') : '–'}</td>
                <td><button className="btn small" onClick={() => update.mutate({ id: a.id, body: { status: a.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } })}>{a.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {update.isError && <div className="notice error">{(update.error as Error).message}</div>}
      </div>
      <form className="panel form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <label>Tên đăng nhập<input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></label>
        <label>Mật khẩu (≥ 8 ký tự)<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} /></label>
        <label>Vai trò<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="EDITOR">EDITOR</option><option value="SUPER_ADMIN">SUPER_ADMIN</option></select></label>
        <div><button className="btn red">+ Tạo tài khoản</button>{create.isError && <div className="notice error">{(create.error as Error).message}</div>}</div>
      </form>
    </>
  );
}
