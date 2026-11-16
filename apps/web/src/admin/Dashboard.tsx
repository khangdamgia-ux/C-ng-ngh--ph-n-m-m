import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Thumb } from '../components/Thumb';
import { adminApi, useAuth } from './auth';
import { Icon, type IconName } from './icons';
import type { AdminLocation } from './Locations';

type Row = { period: string; sessions: number; qrScans: number; tourStarts: number; locationViews: number; audioPlays: number; audioCompletes: number };
interface Visits { items: Row[]; languages: Array<{ lang: string; sessions: number }> }
type Num = Exclude<keyof Row, 'period'>;
interface Coverage { locationId: number; lang: string; status: string; hasAudio: boolean }

const LANG_LABEL: Record<string, string> = { vi: 'Tiếng Việt', en: 'English', ko: '한국어', zh: '中文', ja: '日本語', fr: 'Français' };
const NUMS: Num[] = ['sessions', 'qrScans', 'tourStarts', 'locationViews', 'audioPlays', 'audioCompletes'];
const DAYS = 7;
const TZ = 'Asia/Ho_Chi_Minh';

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fmt = (n: number) => n.toLocaleString('vi-VN');
/** Khóa ngày theo giờ Việt Nam (YYYY-MM-DD) – để gộp dữ liệu API và lấp các ngày không có lượt truy cập. */
const dayKey = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
const isoDay = (offset: number) => dayKey(new Date(Date.now() - offset * 86400_000));

function greeting() {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }));
  return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}

/** Chú thích mỗi bước của phễu: >100% nghĩa là trung bình mỗi phiên thực hiện bước đó nhiều lần. */
const stepNote = (v: number, before: number) =>
  !before ? '–' : v > before ? `≈ ${(v / before).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} lần so với bước trước` : `${pct(v, before)}% so với bước trước`;

type ActiveItem = { id: string; lang: string | null; source: string | null; startedAt: string; lastSeenAt: string };
/** "vừa xong", "3 phút trước"… */
function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 45 ? 'vừa xong' : s < 3600 ? `${Math.round(s / 60)} phút trước` : `${Math.round(s / 3600)} giờ trước`;
}

/* ---------- Thành phần nhỏ ---------- */

function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return <svg className="spark" viewBox="0 0 100 28" aria-hidden />;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${26 - (v / max) * 22}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,28 ${pts} 100,28`} className="spark-fill" />
      <polyline points={pts} className="spark-line" />
    </svg>
  );
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev && !now) return <span className="delta flat">–</span>;
  if (!prev) return <span className="delta up"><Icon name="arrowUp" size={14} />mới</span>;
  const d = Math.round(((now - prev) / prev) * 100);
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
  return (
    <span className={`delta ${cls}`} title={`7 ngày trước đó: ${fmt(prev)}`}>
      {d !== 0 && <Icon name={d > 0 ? 'arrowUp' : 'arrowDown'} size={14} />}
      {d > 0 ? '+' : ''}{d}%
    </span>
  );
}

function Kpi({ label, icon, tone, value, prev, hint, series }: { label: string; icon: IconName; tone: string; value: number; prev: number; hint?: string; series: number[] }) {
  return (
    <div className={`kpi tone-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-ico"><Icon name={icon} size={18} /></span>
        <Delta now={value} prev={prev} />
      </div>
      <div className="kpi-label">{label}</div>
      <div className="v">{fmt(value)}</div>
      <div className="kpi-hint">{hint ?? ' '}</div>
      <Spark data={series} />
    </div>
  );
}

/** Biểu đồ cột phiên truy cập theo ngày, rê chuột để xem chi tiết từng ngày. */
function DailyChart({ days }: { days: Array<{ key: string } & Record<Num, number>> }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.sessions));
  const step = max <= 4 ? 1 : Math.ceil(max / 4);
  const top = step * Math.ceil(max / step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => top - i * step);
  const h = hover !== null ? days[hover] : null;
  const label = (k: string, opt: Intl.DateTimeFormatOptions) => new Date(`${k}T12:00:00+07:00`).toLocaleDateString('vi-VN', { ...opt, timeZone: TZ });

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <div className="y-axis">{ticks.map((t) => <span key={t}>{t}</span>)}</div>
      <div className="plot" style={{ backgroundSize: `100% ${100 / (ticks.length - 1)}%` }}>
        {days.map((d, i) => (
          <div key={d.key} className={`col${hover === i ? ' on' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
            aria-label={`${label(d.key, { weekday: 'long', day: '2-digit', month: '2-digit' })}: ${d.sessions} phiên`}>
            <div className="bar" style={{ height: `${(d.sessions / top) * 100}%` }} />
            <span className="x">{label(d.key, { weekday: 'short' })}<small>{label(d.key, { day: '2-digit', month: '2-digit' })}</small></span>
          </div>
        ))}
        {h && hover !== null && (
          <div className="tip" style={{ left: `${((hover + 0.5) / days.length) * 100}%`, transform: `translateX(${hover === 0 ? -18 : hover === days.length - 1 ? -82 : -50}%)` }} role="tooltip">
            <b>{label(h.key, { weekday: 'long', day: '2-digit', month: '2-digit' })}</b>
            <span><i className="sw s1" />Phiên<em>{fmt(h.sessions)}</em></span>
            <span><i className="sw s2" />Xem địa điểm<em>{fmt(h.locationViews)}</em></span>
            <span><i className="sw s3" />Lượt nghe<em>{fmt(h.audioPlays)}</em></span>
            <span><i className="sw s4" />Quét QR<em>{fmt(h.qrScans)}</em></span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Trang ---------- */

/** UI08: phiên đang hoạt động tự làm mới mỗi 30 giây (FR-18). */
export function Dashboard() {
  const { user } = useAuth();
  const from = isoDay(DAYS * 2 - 1);
  const to = isoDay(0);
  const active = useQuery({ queryKey: ['active'], queryFn: () => adminApi<{ activeSessions: number; timeoutSeconds: number; items?: ActiveItem[] }>('/stats/active-sessions'), refetchInterval: 10_000 });
  const trend = useQuery({
    queryKey: ['visits-14d', from, to],
    queryFn: () => adminApi<Visits>(`/stats/visits?from=${from}T00:00:00%2B07:00&to=${to}T23:59:59%2B07:00&groupBy=day`),
    refetchInterval: 60_000,
  });
  const visits = useQuery({ queryKey: ['visits-7d'], queryFn: () => adminApi<Visits>('/stats/visits?groupBy=day'), refetchInterval: 60_000 });
  const top = useQuery({ queryKey: ['top'], queryFn: () => adminApi<{ items: Array<{ locationId: number; name: string; plays: number; views: number }> }>('/stats/top-locations') });
  const locs = useQuery({ queryKey: ['admin-locations', ''], queryFn: () => adminApi<{ items: AdminLocation[] }>('/locations') });
  const coverage = useQuery({ queryKey: ['coverage'], queryFn: () => adminApi<{ items: Coverage[] }>('/narrations/coverage') });

  // Dựng đủ 14 ngày liên tiếp (ngày không có dữ liệu = 0), chia làm kỳ này / kỳ trước.
  const { cur, prev } = useMemo(() => {
    const byDay = new Map<string, Row>();
    for (const r of trend.data?.items ?? []) byDay.set(dayKey(r.period), r);
    const all = Array.from({ length: DAYS * 2 }, (_, i) => {
      const key = isoDay(DAYS * 2 - 1 - i);
      const r = byDay.get(key);
      return { key, ...Object.fromEntries(NUMS.map((k) => [k, Number(r?.[k] ?? 0)])) } as { key: string } & Record<Num, number>;
    });
    return { cur: all.slice(DAYS), prev: all.slice(0, DAYS) };
  }, [trend.data]);

  const series = (k: Num) => cur.map((d) => d[k]);
  const sum = (k: Num, rows = cur) => rows.reduce((a, d) => a + d[k], 0);
  const sessions = sum('sessions');
  const views = sum('locationViews');
  const plays = sum('audioPlays');
  const done = sum('audioCompletes');

  // Luôn hiện đủ các ngôn ngữ hỗ trợ (kể cả 0 phiên). Phiên không ghi nhận ngôn ngữ thì bỏ qua, không hiển thị.
  const langs = useMemo(() => {
    const m = new Map<string, number>(Object.keys(LANG_LABEL).map((k) => [k, 0]));
    for (const l of visits.data?.languages ?? []) {
      if (!l.lang || l.lang === 'unknown') continue;
      m.set(l.lang, (m.get(l.lang) ?? 0) + l.sessions);
    }
    return [...m].map(([lang, sessions]) => ({ lang, sessions })).sort((a, b) => b.sessions - a.sessions);
  }, [visits.data]);
  const langTotal = langs.reduce((a, l) => a + l.sessions, 0);
  const langUsed = langs.filter((l) => l.sessions > 0).length;
  const codeOf = (id: number) => locs.data?.items.find((l) => l.id === id)?.code ?? String(id);
  const topItems = (top.data?.items ?? []).slice(0, 5);
  const topMax = Math.max(1, ...topItems.map((r) => r.plays));
  const funnel: Array<[string, number, IconName]> = [['Phiên truy cập', sessions, 'session'], ['Xem địa điểm', views, 'eye'], ['Nghe thuyết minh', plays, 'headphones'], ['Nghe hết bài', done, 'check']];

  // Sức khỏe nội dung: số địa điểm, số đang công khai, độ phủ bản dịch & file âm thanh theo ngôn ngữ.
  const locItems = locs.data?.items ?? [];
  const published = locItems.filter((l) => l.isPublished).length;
  const covLangs = useMemo(() => {
    const total = locItems.length;
    const m = new Map<string, { pub: number; audio: number }>();
    for (const c of coverage.data?.items ?? []) {
      const e = m.get(c.lang) ?? { pub: 0, audio: 0 };
      if (c.status === 'PUBLISHED') e.pub += 1;
      if (c.hasAudio) e.audio += 1;
      m.set(c.lang, e);
    }
    return Object.keys(LANG_LABEL).concat([...m.keys()].filter((k) => !LANG_LABEL[k]))
      .filter((k) => m.has(k) || LANG_LABEL[k])
      .map((lang) => ({ lang, total, ...(m.get(lang) ?? { pub: 0, audio: 0 }) }));
  }, [coverage.data, locItems]);

  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
  const rangeLabel = `${new Date(`${cur[0].key}T12:00:00+07:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${new Date(`${cur[DAYS - 1].key}T12:00:00+07:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>{greeting()}, {user?.username} 👋</h1>
          <p className="muted">Tình hình 7 ngày gần nhất ({rangeLabel}) · so sánh với 7 ngày trước đó.</p>
        </div>
        <div className="dash-actions">
          <span className="live-pill"><i />Tự làm mới 10 giây</span>
        </div>
      </header>

      {(trend.isError || active.isError) && <div className="notice error">Không tải được số liệu thống kê. Kiểm tra dịch vụ analytics rồi tải lại trang.</div>}

      <section className="dash-top">
        <div className="live-card">
          <div className="live-head"><span className="live-dot" />Đang mở website ngay bây giờ</div>
          <div className="live-num">{active.data?.activeSessions ?? '–'}</div>
          <div className="live-sub">tab đang mở trang khách (kể cả tab nền) · tab đã đóng và trang Admin không tính</div>
          {!!active.data?.items?.length && (
            <details className="live-more">
              <summary>Xem chi tiết</summary>
              <ul>
                {active.data.items.map((it) => (
                  <li key={it.id}>
                    <span className="lang-code">{(it.lang ?? '?').toUpperCase()}</span>
                    <span>{it.source === 'QR' ? 'Quét QR' : 'Truy cập trực tiếp'}<small>mở {ago(it.startedAt)} · tín hiệu {ago(it.lastSeenAt)}</small></span>
                    <code>#{it.id}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <svg className="live-wave" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden><path d="M0 30 C 20 30, 25 10, 45 10 S 70 34, 95 26 S 130 6, 150 14 S 185 32, 200 22 L 200 40 L 0 40 Z" /></svg>
        </div>
        <div className="kpis">
          <Kpi label="Phiên truy cập" icon="session" tone="red" value={sessions} prev={sum('sessions', prev)} hint="7 ngày gần nhất" series={series('sessions')} />
          <Kpi label="Lượt quét QR" icon="qr" tone="gold" value={sum('qrScans')} prev={sum('qrScans', prev)} hint={`${pct(sum('qrScans'), sessions)}% số phiên`} series={series('qrScans')} />
          <Kpi label="Bật định vị GPS" icon="gps" tone="teal" value={sum('tourStarts')} prev={sum('tourStarts', prev)} hint={`${pct(sum('tourStarts'), sessions)}% số phiên`} series={series('tourStarts')} />
          <Kpi label="Lượt nghe" icon="headphones" tone="ink" value={plays} prev={sum('audioPlays', prev)} hint={`nghe hết ${pct(done, plays)}%`} series={series('audioPlays')} />
        </div>
      </section>

      <section className="dash-grid">
        <div className="panel">
          <div className="panel-head">
            <div><h3>Phiên truy cập theo ngày</h3><p className="muted">Rê chuột lên cột để xem chi tiết</p></div>
            <Link to="/admin/stats" className="link">Xem thống kê đầy đủ →</Link>
          </div>
          {trend.isLoading ? <div className="skeleton chart-sk" /> : sessions === 0 ? <div className="empty-state"><Icon name="stats" size={28} /><p>Chưa có lượt truy cập nào trong 7 ngày qua.</p></div> : <DailyChart days={cur} />}
        </div>
        <div className="panel">
          <div className="panel-head"><div><h3>Ngôn ngữ người dùng</h3><p className="muted">Ngôn ngữ khách chọn khi nghe · 7 ngày gần nhất</p></div></div>
          <div className="lang-sum">
            <div><b>{fmt(langTotal)}</b><span>phiên</span></div>
            <div><b>{langUsed}<small>/{Object.keys(LANG_LABEL).length}</small></b><span>ngôn ngữ được dùng</span></div>
          </div>
          {langTotal > 0 && (
            <div className="lang-stack" aria-hidden>
              {langs.filter((l) => l.sessions > 0).map((l, i) => <i key={l.lang} style={{ flexGrow: l.sessions, opacity: Math.max(0.35, 1 - i * 0.16) }} title={`${LANG_LABEL[l.lang] ?? l.lang}: ${pct(l.sessions, langTotal)}%`} />)}
            </div>
          )}
          <ul className="hbars langs">
            {langs.map((l, i) => (
              <li key={l.lang} className={l.sessions ? '' : 'zero'}>
                <div className="hb-row">
                  <span><span className="lang-code">{l.lang.toUpperCase()}</span>{LANG_LABEL[l.lang] ?? l.lang}</span>
                  <b>{l.sessions ? `${pct(l.sessions, langTotal)}%` : '–'}<small>{fmt(l.sessions)}</small></b>
                </div>
                <div className="hb"><i style={{ width: `${pct(l.sessions, langTotal)}%`, opacity: Math.max(0.45, 1 - i * 0.12) }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="dash-grid three">
        <div className="panel">
          <div className="panel-head"><div><h3>Địa điểm được nghe nhiều nhất</h3><p className="muted">Xếp theo lượt nghe thuyết minh</p></div></div>
          {top.data && topItems.length === 0 && <div className="empty-state"><Icon name="headphones" size={28} /><p>Chưa có lượt nghe nào.</p></div>}
          <ol className="toplist">
            {topItems.map((r, i) => (
              <li key={r.locationId}>
                <span className={`rank r${i + 1}`}>{i + 1}</span>
                <Thumb code={codeOf(r.locationId)} title={r.name} className="thumb sm" />
                <div className="tl-main">
                  <Link to={`/admin/locations/${r.locationId}`}><b>{r.name}</b></Link>
                  <div className="hb"><i style={{ width: `${(r.plays / topMax) * 100}%` }} /></div>
                </div>
                <div className="tl-num"><b>{fmt(r.plays)}</b><span>{fmt(r.views)} xem</span></div>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel">
          <div className="panel-head"><div><h3>Từ truy cập đến nghe hết bài</h3><p className="muted">Tỷ lệ chuyển đổi qua từng bước</p></div></div>
          <ul className="funnel">
            {funnel.map(([label, v, ico], i) => (
              <li key={label}>
                <span className="f-ico"><Icon name={ico} size={16} /></span>
                <div className="f-main">
                  <div className="hb-row"><span>{label}</span><b>{fmt(v)}</b></div>
                  <div className="hb f"><i style={{ width: `${pct(v, funnel[0][1])}%`, opacity: 1 - i * 0.18 }} /></div>
                  <small>{i === 0 ? 'Mốc 100%' : stepNote(v, funnel[i - 1][1])}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div><h3>Tình trạng nội dung</h3><p className="muted">Bản dịch đã xuất bản / tổng địa điểm</p></div>
            <Link to="/admin/locations" className="link">Quản lý →</Link>
          </div>
          <div className="content-stats">
            <div><Icon name="pin" size={18} /><b>{locItems.length}</b><span>địa điểm</span></div>
            <div><Icon name="eye" size={18} /><b>{published}</b><span>đang công khai</span></div>
          </div>
          <ul className="coverage">
            {covLangs.map((c) => {
              const p = pct(c.pub, c.total);
              return (
                <li key={c.lang} title={`${c.pub}/${c.total} bản dịch đã xuất bản · ${c.audio} file âm thanh`}>
                  <span className="lang-code">{c.lang.toUpperCase()}</span>
                  <div className="hb"><i className={p === 100 ? 'full' : ''} style={{ width: `${p}%` }} /></div>
                  <b>{c.pub}/{c.total}</b>
                  <span className={`audio${c.audio ? '' : ' none'}`} title={`${c.audio} file âm thanh thu sẵn`}><Icon name="mic" size={13} />{c.audio}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
