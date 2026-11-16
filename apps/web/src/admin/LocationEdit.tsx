import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, tokenStore } from '../api/client';
import { useCategories } from '../api/hooks';
import type { LocationItem } from '../api/types';
import { MapView } from '../components/MapView';
import { LANG_NAMES } from '../i18n';
import { useAdminLanguages } from './useAdminLanguages';
import { adminApi } from './auth';
import { publicUrl } from './Locations';

interface Form {
  code: string;
  name: string;
  categoryId: number | '' | 'new';
  address: string;
  latitude: string;
  longitude: string;
  triggerRadiusM: string;
  priority: string;
  openingHours: string;
  ticketPrice: string;
  imageUrl: string;
  description: string;
  isPublished: boolean;
}

const empty: Form = {
  code: '',
  name: '',
  categoryId: '',
  address: '',
  latitude: '',
  longitude: '',
  triggerRadiusM: '25',
  priority: '0',
  openingHours: '',
  ticketPrice: '',
  imageUrl: '',
  description: '',
  isPublished: false,
};

function errorsOf(err: unknown): Record<string, string> {
  if (err instanceof ApiError && err.details) {
    return Object.fromEntries(err.details.map((d) => [d.field, d.issue]));
  }
  return {};
}

/** UI09/UI10: thêm/sửa địa điểm (FR-14, FR-17) + thuyết minh từng ngôn ngữ (FR-15, FR-16). */
export function LocationEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cats = useCategories();

  const [form, setForm] = useState<Form>(empty);
  const [newCategoryName, setNewCategoryName] = useState('');

  const loc = useQuery({
    queryKey: ['admin-location', id],
    queryFn: () =>
      adminApi<LocationItem & { isPublished: boolean; description: string | null }>(
        `/locations/${id}`,
      ),
    enabled: !isNew,
  });

  useEffect(() => {
    const l = loc.data;
    if (!l) return;

    setForm({
      code: l.code,
      name: l.name,
      categoryId: l.category.id,
      address: l.address ?? '',
      latitude: l.latitude?.toString() ?? '',
      longitude: l.longitude?.toString() ?? '',
      triggerRadiusM: String(l.triggerRadiusM),
      priority: String(l.priority),
      openingHours: l.openingHours ?? '',
      ticketPrice: l.ticketPrice?.toString() ?? '',
      imageUrl: l.imageUrl ?? '',
      description: l.description ?? '',
      isPublished: l.isPublished,
    });
  }, [loc.data]);

  const save = useMutation({
    mutationFn: async () => {
      let categoryId: number;

      if (form.categoryId === 'new') {
        const name = newCategoryName.trim();

        if (!name) {
          throw new Error('Vui lòng nhập tên loại địa điểm');
        }

        const category = await adminApi<{ id: number }>('/categories', {
          method: 'POST',
          body: { name },
        });

        categoryId = category.id;
      } else {
        if (form.categoryId === '') {
          throw new Error('Vui lòng chọn loại địa điểm');
        }

        categoryId = form.categoryId;
      }

      const num = (value: string) =>
        value.trim() === '' ? null : Number(value);

      const body = {
        name: form.name,
        categoryId,
        address: form.address || null,
        latitude: num(form.latitude),
        longitude: num(form.longitude),
        triggerRadiusM: Number(form.triggerRadiusM),
        priority: Number(form.priority),
        openingHours: form.openingHours || null,
        ticketPrice: num(form.ticketPrice),
        imageUrl: form.imageUrl || null,
        description: form.description || null,
        isPublished: form.isPublished,
      };

      return isNew
        ? adminApi<{ id: number }>('/locations', {
            method: 'POST',
            body: { ...body, code: form.code },
          })
        : adminApi<{ id: number }>(`/locations/${id}`, {
            method: 'PUT',
            body,
          });
    },

    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['admin-locations'] });
      void qc.invalidateQueries({ queryKey: ['locations'] });
      void qc.invalidateQueries({ queryKey: ['categories'] });

      if (isNew) {
        navigate(`/admin/locations/${result.id}`, { replace: true });
      } else {
        void loc.refetch();
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => adminApi(`/locations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-locations'] });
      void qc.invalidateQueries({ queryKey: ['admin-locations-trash'] });
      void qc.invalidateQueries({ queryKey: ['locations'] });
      navigate('/admin/locations');
    },
  });

  const downloadQr = async (format: 'png' | 'svg') => {
    const response = await fetch(
      `/api/v1/admin/locations/${id}/qr?format=${format}`,
      {
        headers: {
          Authorization: `Bearer ${tokenStore.get()}`,
        },
      },
    );

    if (!response.ok) {
      alert('Không tải được mã QR');
      return;
    }

    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qr-${form.code}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const fe = errorsOf(save.error);

  const set =
    (key: keyof Form) =>
    (event: { target: { value: string } }) => {
      setForm({ ...form, [key]: event.target.value });
    };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  const lat = Number(form.latitude);
  const lng = Number(form.longitude);
  const hasGeo =
    form.latitude !== '' &&
    form.longitude !== '' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  return (
    <>
      <header className="page-head">
        <div>
          <Link to="/admin/locations" className="back-link">← Danh sách địa điểm</Link>
          <h1>{isNew ? 'Thêm địa điểm' : `Sửa: ${loc.data?.name ?? ''}`}</h1>
          {!isNew && loc.data && (
            <p className="muted">
              {loc.data.isPublished ? <span className="status pub"><i />Công khai</span> : <span className="status hid"><i />Đang ẩn – khách không thấy</span>}
            </p>
          )}
        </div>
        {!isNew && loc.data?.isPublished && (
          <a className="btn small" href={publicUrl(loc.data.code)} target="_blank" rel="noreferrer">↗ Xem trên website</a>
        )}
      </header>

      <form className="panel" onSubmit={submit}>
        <div className="form">
          <label>
            Mã (code – dùng trong URL & QR)
            <input
              value={form.code}
              onChange={set('code')}
              disabled={!isNew}
              placeholder="vd. hoi-quan-phuc-kien"
              required
            />
            {!isNew && (
              <span className="muted">
                Không đổi được sau khi tạo vì đã in trên mã QR
              </span>
            )}
            {fe.code && <span className="field-error">{fe.code}</span>}
          </label>

          <label>
            Tên địa điểm *
            <input value={form.name} onChange={set('name')} required />
            {fe.name && <span className="field-error">{fe.name}</span>}
          </label>

          <label>
  Loại *

  <input
    list="location-category-options"
    value={newCategoryName}
    onChange={(event) => {
      const value = event.target.value;

      setNewCategoryName(value);

      const existingCategory = cats.data?.items.find(
        (category) =>
          category.name.trim().toLowerCase() ===
          value.trim().toLowerCase()
      );

      setForm((prev) => ({
        ...prev,
        categoryId: existingCategory ? existingCategory.id : 'new',
      }));
    }}
    placeholder="Nhập loại địa điểm..."
    maxLength={150}
    required
  />

  <datalist id="location-category-options">
    {cats.data?.items.map((category) => (
      <option key={category.id} value={category.name} />
    ))}
  </datalist>
</label>

          <label>
            Địa chỉ
            <input value={form.address} onChange={set('address')} />
          </label>

          <label>
            Vĩ độ
            <input
              value={form.latitude}
              onChange={set('latitude')}
              inputMode="decimal"
            />
            {fe.latitude && (
              <span className="field-error">{fe.latitude}</span>
            )}
          </label>

          <label>
            Kinh độ
            <input
              value={form.longitude}
              onChange={set('longitude')}
              inputMode="decimal"
            />
            {fe.longitude && (
              <span className="field-error">{fe.longitude}</span>
            )}
          </label>

          <label>
            Bán kính kích hoạt (m, 5–200; phố cổ nên 15–40)
            <input
              type="number"
              min={5}
              max={200}
              value={form.triggerRadiusM}
              onChange={set('triggerRadiusM')}
            />
            {fe.triggerRadiusM && (
              <span className="field-error">{fe.triggerRadiusM}</span>
            )}
          </label>

          <label>
            Độ ưu tiên khi vùng chồng lấn (0–100)
            <input
              type="number"
              min={0}
              max={100}
              value={form.priority}
              onChange={set('priority')}
            />
          </label>

          <label>
            Giờ mở cửa
            <input value={form.openingHours} onChange={set('openingHours')} />
          </label>

          <label>
            Giá vé (VND, để trống nếu chưa có)
            <input
              value={form.ticketPrice}
              onChange={set('ticketPrice')}
              inputMode="numeric"
            />
          </label>

          <label className="full">
            URL ảnh đại diện
            <input
              value={form.imageUrl}
              onChange={set('imageUrl')}
              placeholder="https://…"
            />
            {fe.imageUrl && (
              <span className="field-error">{fe.imageUrl}</span>
            )}
          </label>

          <label className="full">
            Ghi chú nội bộ
            <textarea
              style={{ minHeight: 70 }}
              value={form.description}
              onChange={set('description')}
            />
          </label>

          <label
            style={{
              flexDirection: 'row',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(event) =>
                setForm({ ...form, isPublished: event.target.checked })
              }
            />
            Công khai (hiển thị cho khách)
          </label>
        </div>

        <p className="muted">
          Bấm lên bản đồ để chọn tọa độ. Vòng tròn là vùng kích hoạt thuyết minh
          tự động.
        </p>

        <MapView
          small
          places={
            hasGeo
              ? [
                  {
                    ...(loc.data ?? ({} as LocationItem)),
                    code: form.code || 'new',
                    title: form.name || 'Địa điểm mới',
                    latitude: lat,
                    longitude: lng,
                    triggerRadiusM: Number(form.triggerRadiusM) || 25,
                  },
                ]
              : []
          }
          center={hasGeo ? { lat, lng } : undefined}
          zoom={18}
          onMapClick={(point) =>
            setForm({
              ...form,
              latitude: point.lat.toFixed(6),
              longitude: point.lng.toFixed(6),
            })
          }
        />

        {save.isError && !Object.keys(fe).length && (
          <div className="notice error">
            {(save.error as Error).message}
          </div>
        )}
        {save.isError && Object.keys(fe).length > 0 && (
          <div className="notice error">
            Dữ liệu không hợp lệ – xem các ô được đánh dấu.
          </div>
        )}
        {save.isSuccess && <div className="notice">✅ Đã lưu</div>}

        <div className="btns">
          <button className="btn red" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : '💾 Lưu'}
          </button>

          {!isNew && (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => void downloadQr('png')}
              >
                🔳 Tải QR (PNG)
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void downloadQr('svg')}
              >
                🔳 Tải QR (SVG)
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  confirm(
                    'Chuyển địa điểm này vào Thùng rác? Địa điểm sẽ biến mất khỏi website; có thể khôi phục trong Admin › Địa điểm › Thùng rác.',
                  ) && remove.mutate()
                }
              >
                🗑 Xóa
              </button>
            </>
          )}
        </div>
      </form>

      {!isNew && loc.data && <Narrations locationId={loc.data.id} />}
    </>
  );
}

interface AdminNarration {
  id: number;
  language: string;
  title: string;
  summary: string | null;
  content: string;
  audio: { url: string; durationSeconds: number | null } | null;
  status: 'DRAFT' | 'PUBLISHED';
}

function Narrations({ locationId }: { locationId: number }) {
  const qc = useQueryClient();
  const [lang, setLang] = useState('vi');
  const { codes: SUPPORTED } = useAdminLanguages();

  const list = useQuery({
    queryKey: ['admin-narrations', locationId],
    queryFn: () =>
      adminApi<{ items: AdminNarration[] }>(
        `/locations/${locationId}/narrations`,
      ),
  });

  const current = list.data?.items.find((narration) => narration.language === lang);

  const [f, setF] = useState({
    title: '',
    summary: '',
    content: '',
    audioUrl: '',
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setF({
      title: current?.title ?? '',
      summary: current?.summary ?? '',
      content: current?.content ?? '',
      audioUrl: current?.audio?.url ?? '',
      status: current?.status ?? 'DRAFT',
    });
    setFile(null);
  }, [current, lang]);

  const save = useMutation({
    mutationFn: async () => {
      const saved = await adminApi<AdminNarration>(
        `/locations/${locationId}/narrations/${lang}`,
        {
          method: 'PUT',
          body: {
            title: f.title,
            summary: f.summary || null,
            content: f.content,
            audioUrl: f.audioUrl || null,
            status: f.status,
          },
        },
      );

      if (file) {
        const objectUrl = URL.createObjectURL(file);

        const duration = await new Promise<number | null>((resolve) => {
          const audio = new Audio(objectUrl);

          audio.onloadedmetadata = () => {
            resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
            URL.revokeObjectURL(objectUrl);
          };

          audio.onerror = () => {
            resolve(null);
            URL.revokeObjectURL(objectUrl);
          };
        });

        const formData = new FormData();
        formData.append('audio', file);

        if (duration !== null) {
          formData.append('durationSeconds', String(duration));
        }

        await adminApi(`/narrations/${saved.id}/audio`, {
          method: 'POST',
          body: formData,
        });
      }
    },

    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['admin-narrations', locationId],
      });
      void qc.invalidateQueries({ queryKey: ['coverage'] });
      void qc.invalidateQueries({ queryKey: ['narration'] });
    },
  });

  const words = f.content.trim()
    ? f.content.trim().split(/\s+/).length
    : 0;

  return (
    <div className="panel">
      <h2>Nội dung thuyết minh</h2>

      <div className="tabs">
        {SUPPORTED.map((language) => {
          const narration = list.data?.items.find(
            (item) => item.language === language,
          );

          return (
            <button
              key={language}
              className={language === lang ? 'on' : ''}
              onClick={() => setLang(language)}
            >
              <span
                className={`dot ${
                  narration
                    ? narration.status === 'PUBLISHED'
                      ? 'pub'
                      : 'draft'
                    : 'none'
                }`}
              />
              {LANG_NAMES[language]}
            </button>
          );
        })}
      </div>

      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="full">
          Tiêu đề *
          <input
            value={f.title}
            onChange={(event) => setF({ ...f, title: event.target.value })}
            required
          />
        </label>

        <label className="full">
          Mô tả ngắn (hiển thị ở danh sách)
          <input
            value={f.summary}
            onChange={(event) => setF({ ...f, summary: event.target.value })}
            maxLength={500}
          />
        </label>

        <label className="full">
          Nội dung thuyết minh *{' '}
          <span className="muted">
            ({words} từ · {f.content.length} ký tự)
          </span>
          <textarea
            value={f.content}
            onChange={(event) => setF({ ...f, content: event.target.value })}
            required
            lang={lang}
          />
        </label>

        <label>
          File âm thanh (MP3/M4A ≤ 5 MB)
          <input
            type="file"
            accept=".mp3,.m4a,audio/mpeg,audio/mp4"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <span className="muted">
            Không có file → website dùng giọng đọc tự động của thiết bị
          </span>
        </label>

        <label>
          Trạng thái
          <select
            value={f.status}
            onChange={(event) =>
              setF({
                ...f,
                status: event.target.value as 'DRAFT' | 'PUBLISHED',
              })
            }
          >
            <option value="DRAFT">Bản nháp (DRAFT)</option>
            <option value="PUBLISHED">Xuất bản (PUBLISHED)</option>
          </select>
        </label>

        {f.audioUrl && (
          <div className="full">
            <span className="muted">Nghe thử: </span>
            <audio controls src={f.audioUrl} preload="none" />
          </div>
        )}

        <div className="full">
          {save.isError && (
            <div className="notice error">
              {(save.error as Error).message}
            </div>
          )}
          {save.isSuccess && (
            <div className="notice">
              ✅ Đã lưu bản {LANG_NAMES[lang]}
            </div>
          )}
          <button className="btn red" disabled={save.isPending}>
            {save.isPending
              ? 'Đang lưu…'
              : `💾 Lưu bản ${LANG_NAMES[lang]}`}
          </button>
        </div>
      </form>
    </div>
  );
}
