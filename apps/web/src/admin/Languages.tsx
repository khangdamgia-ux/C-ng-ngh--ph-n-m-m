import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import vi from '../i18n/locales/vi';
import en from '../i18n/locales/en';
import { SUPPORTED } from '../i18n';
import { adminApi, useAuth } from './auth';
import { Icon } from './icons';
import { useAdminLanguages, type AdminLanguage } from './useAdminLanguages';

/** Mã hay bị nhập nhầm → mã đúng theo chuẩn BCP 47 / ISO 639-1. */
const COMMON_MISTAKES: Record<string, string> = { gr: 'de (Đức) hoặc el (Hy Lạp)', ge: 'de (Đức)', jp: 'ja (Nhật)', kr: 'ko (Hàn)', cn: 'zh (Trung)', vn: 'vi (Việt)', sp: 'es (Tây Ban Nha)', dk: 'da (Đan Mạch)', se: 'sv (Thụy Điển)', cz: 'cs (Séc)', ua: 'uk (Ukraina)' };
const SUGGEST: Array<[string, string]> = [['de', 'Deutsch'], ['es', 'Español'], ['it', 'Italiano'], ['ru', 'Русский'], ['th', 'ไทย'], ['el', 'Ελληνικά'], ['nl', 'Nederlands'], ['pt', 'Português'], ['id', 'Bahasa Indonesia'], ['ms', 'Bahasa Melayu'], ['hi', 'हिन्दी'], ['ar', 'العربية']];
const BUILT_IN = new Set<string>(SUPPORTED);
const UI_KEYS = Object.keys(vi) as Array<keyof typeof vi>;

/** UI11: quản lý ngôn ngữ (UC12) – mọi thay đổi áp dụng ngay cho ô chọn ngôn ngữ của website người dùng. */
export function Languages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const langs = useAdminLanguages();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminLanguage | null>(null);
  const [newLang, setNewLang] = useState({ code: '', name: '' });

  const coverage = useQuery({ queryKey: ['coverage'], queryFn: () => adminApi<{ items: Array<{ locationId: number; lang: string; status: string }> }>('/narrations/coverage') });
  const locs = useQuery({ queryKey: ['admin-locations', ''], queryFn: () => adminApi<{ items: Array<{ id: number }> }>('/locations') });
  const total = locs.data?.items.length ?? 0;
  const published = (code: string) => (coverage.data?.items ?? []).filter((c) => c.lang === code && c.status === 'PUBLISHED').length;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-languages'] });
    void qc.invalidateQueries({ queryKey: ['languages'] }); // ô chọn ngôn ngữ của website (cùng trình duyệt)
  };
  const update = useMutation({
    mutationFn: ({ l, body }: { l: AdminLanguage; body: object; msg: string }) => adminApi(`/languages/${l.id}`, { method: 'PUT', body }),
    onSuccess: (_d, v) => { refresh(); setToast(v.msg); },
  });
  const create = useMutation({
    mutationFn: () => adminApi('/languages', { method: 'POST', body: { code: newLang.code.trim().toLowerCase(), name: newLang.name.trim() } }),
    onSuccess: () => {
      refresh();
      setToast(`Đã thêm “${newLang.name}” – đang hiện trên website. Nhớ dịch giao diện và thuyết minh cho ngôn ngữ này.`);
      setNewLang({ code: '', name: '' });
    },
  });

  const code = newLang.code.trim().toLowerCase();
  const codeWarn = COMMON_MISTAKES[code];
  const codeBad = code !== '' && !/^[a-z]{2}(-[a-z]{2,4})?$/i.test(code);
  const items = langs.items;
  const enabledCount = items.filter((l) => l.is_enabled).length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Ngôn ngữ</h1>
          <p className="muted">Bật/tắt, đổi mặc định – ô chọn ngôn ngữ trên website cập nhật ngay. Đang hiện <b>{enabledCount}</b>/{items.length} ngôn ngữ cho khách.</p>
        </div>
        <a className="btn small" href="/" target="_blank" rel="noreferrer"><Icon name="external" size={15} />Xem website</a>
      </header>

      {update.isError && <div className="notice error">{(update.error as Error).message}</div>}

      <div className="panel">
        <div className="table-wrap">
          <table className="lang-table">
            <thead>
              <tr><th>Ngôn ngữ</th><th>Trên website</th><th>Mặc định</th><th>Thuyết minh</th><th>Giao diện</th><th>Dự phòng</th><th className="r">Thao tác</th></tr>
            </thead>
            <tbody>
              {items.map((l) => {
                const pub = published(l.code);
                return (
                  <tr key={l.id} className={l.is_enabled ? '' : 'is-hidden'}>
                    <td><div className="lang-cell"><span className="lang-code">{l.code.toUpperCase()}</span><b>{l.name}</b></div></td>
                    <td>
                      <label className={`switch sm${!isSuper || l.is_default ? ' locked' : ''}`} title={l.is_default ? 'Ngôn ngữ mặc định luôn bật' : !isSuper ? 'Chỉ Super Admin được bật/tắt' : undefined}>
                        <input type="checkbox" checked={l.is_enabled} disabled={!isSuper || l.is_default || update.isPending}
                          onChange={(e) => update.mutate({ l, body: { isEnabled: e.target.checked }, msg: e.target.checked ? `Đã hiện “${l.name}” trong ô chọn ngôn ngữ của website.` : `Đã ẩn “${l.name}” – khách đang dùng sẽ tự chuyển về ngôn ngữ mặc định.` })} />
                        <span className="track" aria-hidden />
                        <span className={`status ${l.is_enabled ? 'pub' : 'hid'}`}><i />{l.is_enabled ? 'Đang hiện' : 'Đang ẩn'}</span>
                      </label>
                    </td>
                    <td>
                      {l.is_default ? <span className="status gold"><Icon name="check" size={13} />Mặc định</span>
                        : isSuper && <button className="act" disabled={update.isPending} onClick={() => update.mutate({ l, body: { isDefault: true }, msg: `“${l.name}” là ngôn ngữ mặc định cho khách mới.` })}>Đặt mặc định</button>}
                    </td>
                    <td>
                      <div className="mini-cov" title={`${pub}/${total} địa điểm có thuyết minh đã xuất bản`}>
                        <div className="hb"><i className={pub === total && total ? 'full' : ''} style={{ width: `${total ? (pub / total) * 100 : 0}%` }} /></div>
                        <span>{pub}/{total}</span>
                      </div>
                    </td>
                    <td>
                      <button className="act" onClick={() => setEditing(l)}>
                        <Icon name="edit" size={14} />{BUILT_IN.has(l.code) ? 'Có sẵn · sửa' : 'Dịch giao diện'}
                      </button>
                    </td>
                    <td>
                      <input className="num" type="number" min={1} max={20} defaultValue={l.fallback_order ?? ''} placeholder="–" disabled={!isSuper}
                        title="Thứ tự ngôn ngữ dùng thay khi thiếu bản dịch (1 = ưu tiên nhất)"
                        onBlur={(e) => {
                          const v = e.target.value === '' ? null : Number(e.target.value);
                          if (v !== l.fallback_order) update.mutate({ l, body: { fallbackOrder: v }, msg: `Đã lưu thứ tự dự phòng của “${l.name}”.` });
                        }} />
                    </td>
                    <td className="r">
                      {l.is_enabled
                        ? <a className="act" href={`/?lang=${encodeURIComponent(l.code)}`} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Xem web</a>
                        : <span className="act off" title="Đang ẩn – bật lên để khách chọn được"><Icon name="external" size={14} />Xem web</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted note">Khách chọn ngôn ngữ chưa có thuyết minh sẽ nghe bản theo <b>thứ tự dự phòng</b>; chữ giao diện chưa dịch hiển thị bằng tiếng Anh.</p>
      </div>

      {isSuper ? (
        <form className="panel" onSubmit={(e) => { e.preventDefault(); if (!codeBad) create.mutate(); }}>
          <h3>Thêm ngôn ngữ</h3>
          <div className="form">
            <label>Mã ngôn ngữ (ISO 639-1 / BCP 47)
              <input list="lang-suggest" value={newLang.code} required placeholder="vd. de"
                onChange={(e) => {
                  const c = e.target.value;
                  const hit = SUGGEST.find(([k]) => k === c.trim().toLowerCase());
                  setNewLang({ code: c, name: hit && !newLang.name ? hit[1] : newLang.name });
                }} />
              <datalist id="lang-suggest">{SUGGEST.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</datalist>
              {codeBad && <span className="field-error">Mã gồm 2 chữ cái thường, vd. de, es, it (có thể thêm vùng: pt-BR).</span>}
              {!codeBad && codeWarn && <span className="field-warn">“{code}” không phải mã ngôn ngữ chuẩn – có phải bạn muốn {codeWarn}?</span>}
            </label>
            <label>Tên hiển thị (khách sẽ thấy tên này)
              <input value={newLang.name} onChange={(e) => setNewLang({ ...newLang, name: e.target.value })} placeholder="vd. Deutsch" required />
            </label>
            <div className="form-actions"><button className="btn red" disabled={create.isPending || codeBad}><Icon name="plus" size={16} />Thêm ngôn ngữ</button></div>
          </div>
          {create.isError && <div className="notice error">{(create.error as Error).message}</div>}
        </form>
      ) : <p className="muted">Chỉ Super Admin được thêm/bật/tắt ngôn ngữ.</p>}

      {editing && <UiEditor lang={editing} onClose={() => setEditing(null)} onSaved={(n) => { setEditing(null); setToast(`Đã lưu ${n} câu giao diện cho “${editing.name}”. Khách thấy sau khi tải lại trang.`); }} />}
      {toast && <div className="toast" role="status"><Icon name="check" size={16} />{toast}</div>}
    </>
  );
}

/** Dịch chữ giao diện website cho một ngôn ngữ (lưu vào bảng UiTranslations, ghi đè lên bản dựng sẵn). */
function UiEditor({ lang, onClose, onSaved }: { lang: AdminLanguage; onClose: () => void; onSaved: (n: number) => void }) {
  const saved = useQuery({ queryKey: ['ui-tr', lang.code], queryFn: () => adminApi<{ items: Record<string, string> }>(`/ui-translations/${lang.code}`) });
  const [values, setValues] = useState<Record<string, string>>({});
  const [onlyMissing, setOnlyMissing] = useState(false);
  useEffect(() => { if (saved.data) setValues(saved.data.items); }, [saved.data]);
  const builtIn = BUILT_IN.has(lang.code);
  const done = UI_KEYS.filter((k) => values[k]?.trim()).length;
  const keys = useMemo(() => (onlyMissing ? UI_KEYS.filter((k) => !values[k]?.trim()) : UI_KEYS), [onlyMissing, values]);
  const save = useMutation({
    mutationFn: () => {
      const items = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
      return adminApi(`/ui-translations/${lang.code}`, { method: 'PUT', body: { items } }).then(() => Object.keys(items).length);
    },
    onSuccess: onSaved,
  });

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="ui-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3 id="ui-title">Giao diện website · {lang.name} ({lang.code})</h3>
            <p>{builtIn
              ? 'Ngôn ngữ này đã có bản dịch dựng sẵn. Chỉ nhập câu muốn sửa – ô để trống giữ nguyên bản dựng sẵn.'
              : `Đã dịch ${done}/${UI_KEYS.length} câu. Câu chưa dịch sẽ hiển thị bằng tiếng Anh.`}</p>
          </div>
          <label className="switch sm"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /><span className="track" aria-hidden />Chỉ câu chưa dịch</label>
        </div>
        <div className="ui-list">
          {saved.isLoading && <div className="skeleton" style={{ height: 200 }} />}
          {keys.map((k) => (
            <label key={k} className="ui-row">
              <span className="ui-ref"><b>{vi[k]}</b><small>{en[k]}</small></span>
              <input value={values[k] ?? ''} placeholder={builtIn ? '(giữ bản dựng sẵn)' : en[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        {save.isError && <div className="notice error">{(save.error as Error).message}</div>}
        <div className="modal-actions">
          <button className="btn small" onClick={onClose}>Đóng</button>
          <button className="btn small red" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu bản dịch'}</button>
        </div>
      </div>
    </div>
  );
}
