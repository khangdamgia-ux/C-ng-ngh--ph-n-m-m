import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Thumb } from '../components/Thumb';
import { adminApi } from './auth';
import { Icon } from './icons';
import { useAdminLanguages } from './useAdminLanguages';

export interface AdminLocation {
  id: number;
  code: string;
  name: string;
  category: { id: number; code: string; name: string };
  latitude: number | null;
  longitude: number | null;
  triggerRadiusM: number;
  isPublished: boolean;
  updatedAt: string;
}

type Filter = 'all' | 'public' | 'hidden' | 'trash';
type Confirm = { kind: 'delete' | 'hide'; loc: AdminLocation } | null;

/** Đường dẫn trang chi tiết của địa điểm trên web người dùng. */
export const publicUrl = (code: string) => `/l/${encodeURIComponent(code)}`;

/** UI09: danh sách địa điểm (kể cả đang ẩn) + ma trận độ phủ bản dịch (FR-15) + ẩn/công khai/xóa/khôi phục. */
export function Locations() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [toast, setToast] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['admin-locations', q], queryFn: () => adminApi<{ items: AdminLocation[] }>(`/locations${q ? `?q=${encodeURIComponent(q)}` : ''}`) });
  const trash = useQuery({ queryKey: ['admin-locations-trash', q], queryFn: () => adminApi<{ items: AdminLocation[] }>(`/locations?deleted=1${q ? `&q=${encodeURIComponent(q)}` : ''}`) });
  const coverage = useQuery({ queryKey: ['coverage'], queryFn: () => adminApi<{ items: Array<{ locationId: number; lang: string; status: string; hasAudio: boolean }> }>('/narrations/coverage') });
  const { codes: SUPPORTED, items: langInfo } = useAdminLanguages();
  const langOff = (code: string) => langInfo.some((l) => l.code === code && !l.is_enabled);
  const cell = (id: number, lang: string) => coverage.data?.items.find((c) => c.locationId === id && c.lang === lang);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Sau mỗi thao tác: làm mới danh sách admin + dữ liệu web người dùng (cùng trình duyệt) để hai bên luôn khớp nhau.
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-locations'] });
    void qc.invalidateQueries({ queryKey: ['admin-locations-trash'] });
    void qc.invalidateQueries({ queryKey: ['locations'] });
    void qc.invalidateQueries({ queryKey: ['location'] });
  };

  const publish = useMutation({
    mutationFn: ({ loc, value }: { loc: AdminLocation; value: boolean }) => adminApi(`/locations/${loc.id}/publish`, { method: 'PATCH', body: { isPublished: value } }),
    onSuccess: (_d, { loc, value }) => { refresh(); setToast(value ? `Đã công khai “${loc.name}” – khách đã thấy trên website.` : `Đã ẩn “${loc.name}” khỏi website.`); },
  });
  const remove = useMutation({
    mutationFn: (loc: AdminLocation) => adminApi(`/locations/${loc.id}`, { method: 'DELETE' }),
    onSuccess: (_d, loc) => { refresh(); setToast(`Đã chuyển “${loc.name}” vào thùng rác.`); },
  });
  const restore = useMutation({
    mutationFn: (loc: AdminLocation) => adminApi(`/locations/${loc.id}/restore`, { method: 'PATCH' }),
    onSuccess: (_d, loc) => { refresh(); setToast(`Đã khôi phục “${loc.name}” (đang ẩn – bấm Công khai để hiện lại).`); },
  });
  const busy = publish.isPending || remove.isPending || restore.isPending;
  const err = (publish.error ?? remove.error ?? restore.error) as Error | null;

  const all = list.data?.items ?? [];
  const deleted = trash.data?.items ?? [];
  const counts = { all: all.length, public: all.filter((l) => l.isPublished).length, hidden: all.filter((l) => !l.isPublished).length, trash: deleted.length };
  const rows = filter === 'trash' ? deleted : all.filter((l) => filter === 'all' || (filter === 'public') === l.isPublished);
  const TABS: Array<[Filter, string]> = [['all', 'Tất cả'], ['public', 'Đang công khai'], ['hidden', 'Đang ẩn'], ['trash', 'Thùng rác']];

  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'delete') remove.mutate(confirm.loc);
    else publish.mutate({ loc: confirm.loc, value: false });
    setConfirm(null);
  };

  return (
    <>
      <header className="page-head">
        <div><h1>Địa điểm & thuyết minh</h1><p className="muted">Ẩn, công khai, xóa địa điểm – thay đổi áp dụng ngay cho website người dùng.</p></div>
        <Link className="btn red small" to="/admin/locations/new"><Icon name="plus" size={16} />Thêm địa điểm</Link>
      </header>

      <div className="loc-toolbar">
        <div className="seg" role="tablist" aria-label="Lọc theo trạng thái">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
              {label}<span className="count">{counts[k]}</span>
            </button>
          ))}
        </div>
        <input className="search" placeholder="Tìm theo tên hoặc mã…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {err && <div className="notice error">{err.message}</div>}

      <div className="panel">
        {filter === 'trash'
          ? <p className="muted">Địa điểm trong thùng rác không hiện trên website. Thuyết minh và số liệu thống kê vẫn được giữ lại; khôi phục sẽ đưa địa điểm về trạng thái <b>ẩn</b>.</p>
          : <p className="muted legend"><span><span className="dot pub" /> Đã xuất bản</span><span><span className="dot draft" /> Bản nháp</span><span><span className="dot none" /> Chưa có</span><span><Icon name="mic" size={13} /> có file âm thanh</span></p>}
        <div className="table-wrap">
          <table className="loc-table">
            <thead>
              <tr>
                <th>#</th><th>Địa điểm</th><th>Tọa độ / R</th><th>Trạng thái</th>
                {filter !== 'trash' && SUPPORTED.map((l) => <th key={l} className={`c${langOff(l) ? ' off' : ''}`} title={langOff(l) ? 'Ngôn ngữ đang tắt trên website' : undefined}>{l.toUpperCase()}</th>)}
                <th className="r">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className={!l.isPublished ? 'is-hidden' : ''}>
                  <td className="muted">{l.id}</td>
                  <td>
                    <div className="loc-cell">
                      <Thumb code={l.code} title={l.name} className="thumb sm" />
                      <div>
                        {filter === 'trash' ? <b>{l.name}</b> : <Link to={`/admin/locations/${l.id}`}><b>{l.name}</b></Link>}
                        <div className="muted">{l.code} · {l.category.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{l.latitude?.toFixed(5)}, {l.longitude?.toFixed(5)}<br />R = {l.triggerRadiusM} m</td>
                  <td>
                    {filter === 'trash' ? <span className="status trash">Đã xóa</span>
                      : l.isPublished ? <span className="status pub"><i />Công khai</span>
                      : <span className="status hid"><i />Đang ẩn</span>}
                  </td>
                  {filter !== 'trash' && SUPPORTED.map((lang) => {
                    const c = cell(l.id, lang);
                    return <td key={lang} className="c" title={c?.status ?? 'Chưa có'}><span className={`dot ${c ? (c.status === 'PUBLISHED' ? 'pub' : 'draft') : 'none'}`} />{c?.hasAudio && <Icon name="mic" size={12} className="mic" />}</td>;
                  })}
                  <td className="r">
                    <div className="row-actions">
                      {filter === 'trash' ? (
                        <button className="act" disabled={busy} onClick={() => restore.mutate(l)}><Icon name="undo" size={15} />Khôi phục</button>
                      ) : (
                        <>
                          {l.isPublished
                            ? <a className="act icon" href={publicUrl(l.code)} target="_blank" rel="noreferrer" title="Xem trên website người dùng" aria-label={`Xem ${l.name} trên website`}><Icon name="external" size={15} /></a>
                            : <span className="act icon off" title="Đang ẩn – khách không xem được"><Icon name="external" size={15} /></span>}
                          {l.isPublished
                            ? <button className="act" disabled={busy} onClick={() => setConfirm({ kind: 'hide', loc: l })}><Icon name="eyeOff" size={15} />Ẩn</button>
                            : <button className="act go" disabled={busy} onClick={() => publish.mutate({ loc: l, value: true })}><Icon name="eye" size={15} />Công khai</button>}
                          <Link className="act icon" to={`/admin/locations/${l.id}`} title="Sửa" aria-label={`Sửa ${l.name}`}><Icon name="edit" size={15} /></Link>
                          <button className="act icon danger" disabled={busy} onClick={() => setConfirm({ kind: 'delete', loc: l })} title="Xóa" aria-label={`Xóa ${l.name}`}><Icon name="trash" size={15} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.isSuccess && rows.length === 0 && <div className="empty-state"><Icon name={filter === 'trash' ? 'trash' : 'pin'} size={28} /><p>{filter === 'trash' ? 'Thùng rác trống.' : 'Không có địa điểm nào.'}</p></div>}
        {list.isError && <div className="notice error">Không tải được danh sách.</div>}
      </div>

      {confirm && (
        <div className="modal-bg" onClick={() => setConfirm(null)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cf-title" onClick={(e) => e.stopPropagation()}>
            <span className={`modal-ico ${confirm.kind === 'delete' ? 'danger' : ''}`}><Icon name={confirm.kind === 'delete' ? 'trash' : 'eyeOff'} size={22} /></span>
            <h3 id="cf-title">{confirm.kind === 'delete' ? 'Xóa địa điểm này?' : 'Ẩn địa điểm khỏi website?'}</h3>
            <p><b>{confirm.loc.name}</b> {confirm.kind === 'delete'
              ? 'sẽ được chuyển vào Thùng rác và biến mất khỏi website, bản đồ và tính năng tự thuyết minh. Có thể khôi phục lại trong tab “Thùng rác”.'
              : 'sẽ không còn hiện trên website, bản đồ và không tự thuyết minh nữa. Có thể công khai lại bất cứ lúc nào.'}</p>
            <div className="modal-actions">
              <button className="btn small" onClick={() => setConfirm(null)} autoFocus>Hủy</button>
              <button className={`btn small ${confirm.kind === 'delete' ? 'red' : 'primary'}`} onClick={doConfirm}>{confirm.kind === 'delete' ? 'Xóa' : 'Ẩn địa điểm'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status"><Icon name="check" size={16} />{toast}</div>}
    </>
  );
}
