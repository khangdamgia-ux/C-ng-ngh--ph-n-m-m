import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi } from './auth';

/** UI12: thống kê theo ngày/tuần/tháng (FR-19). */
export function Stats() {
  // Ngày theo GIỜ VIỆT NAM (toISOString là giờ UTC → từ 0h–7h sáng sẽ bị lùi 1 ngày và mất số liệu “hôm nay”)
  const vnDay = (offset: number) => new Date(Date.now() - offset * 86400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const today = vnDay(0);
  const [from, setFrom] = useState(vnDay(29));
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const q = useQuery({
    queryKey: ['stats', from, to, groupBy],
    queryFn: () => adminApi<{ items: Array<Record<string, number | string>> }>(`/stats/visits?from=${from}T00:00:00%2B07:00&to=${to}T23:59:59%2B07:00&groupBy=${groupBy}`),
  });
  const cols: Array<[string, string]> = [['sessions', 'Phiên'], ['qrScans', 'Quét QR'], ['tourStarts', 'Bật định vị GPS'], ['locationViews', 'Xem địa điểm'], ['audioPlays', 'Nghe'], ['audioCompletes', 'Nghe hết'], ['geofenceTriggers', 'Tự kích hoạt']];
  return (
    <>
      <header className="page-head"><div><h1>Thống kê truy cập</h1><p className="muted">Lọc theo khoảng thời gian và nhóm theo ngày, tuần hoặc tháng.</p></div></header>
      <div className="panel form" style={{ marginTop: 0 }}>
        <label>Từ ngày<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></label>
        <label>Nhóm theo
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}>
            <option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option>
          </select>
        </label>
      </div>
      <div className="panel">
        {q.isError && <div className="notice error">{(q.error as Error).message}</div>}
        <table>
          <thead><tr><th>Kỳ</th>{cols.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
          <tbody>
            {q.data?.items.map((r) => (
              <tr key={String(r.period)}>
                <td>{new Date(String(r.period)).toLocaleDateString('vi-VN', { timeZone: 'UTC' })}</td>
                {cols.map(([k]) => <td key={k}>{r[k]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {q.data && !q.data.items.length && <p className="muted">Không có dữ liệu trong khoảng thời gian này.</p>}
        <p className="muted">Số phiên không đồng nghĩa số người duy nhất.</p>
      </div>
    </>
  );
}
