import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from './auth';
import { usePageTitle } from '../components/usePageTitle';

export function Login() {
  const { user, login } = useAuth();
  usePageTitle('Đăng nhập', 'admin');
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/admin';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đăng nhập được');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-art" aria-hidden><img src="/hero-hoian.png" alt="" /></div>
      <form onSubmit={submit} className="login-form">
        <div className="login-brand">🏮 HoiAn Guide</div>
        <h1>Đăng nhập quản trị</h1>
        <p className="muted">Quản lý địa điểm, thuyết minh và theo dõi lượt nghe.</p>
        <label>Tên đăng nhập<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <div className="notice error" role="alert">{error}</div>}
        <button className="btn red" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </div>
  );
}
