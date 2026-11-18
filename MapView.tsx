import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { LocationItem } from '../api/types';
import { formatDistance, haversine, type LatLng } from '../tour/geo';
import { OLD_TOWN_CENTER } from '../tour/routes';
import { useTour } from '../tour/TourContext';
import { GpsIcon } from './GpsCard';
import { ATTRIBUTION, BASE_SOURCES, loadLocalSource, ResilientTileLayer, type TileSource, type TileStatus } from './resilientTiles';

// Ảnh offline đóng gói sẵn (nếu có) chỉ cần dò một lần cho cả trang
let localSourcePromise: Promise<TileSource | null> | null = null;
const getLocalSource = () => (localSourcePromise ??= loadLocalSource());

/** Ảnh nền: mỗi ô tự đổi nguồn + tự thử lại (xem resilientTiles.ts). Không bao giờ để nền xám trơ trọi. */
function BaseTiles({ onStatus, retryRef }: { onStatus: (s: TileStatus) => void; retryRef: React.MutableRefObject<(() => void) | null> }) {
  const map = useMap();
  useEffect(() => {
    const layer = new ResilientTileLayer(BASE_SOURCES, { maxZoom: 19, attribution: ATTRIBUTION, keepBuffer: 3, updateWhenIdle: false });
    layer.onStatus = onStatus;
    layer.addTo(map);
    retryRef.current = () => layer.retryAll();
    let alive = true;
    void getLocalSource().then((src) => {
      if (alive && src) layer.setSources([src, ...BASE_SOURCES]);
    });
    return () => {
      alive = false;
      retryRef.current = null;
      layer.remove();
    };
  }, [map, onStatus, retryRef]);
  return null;
}

/** Đổi kích thước khung (xoay máy, thanh địa chỉ co giãn, bàn phím, tab ẩn → hiện) → Leaflet phải tính lại, không thì còn vệt xám. */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const fix = () => map.invalidateSize({ pan: false });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fix) : null;
    ro?.observe(el);
    window.addEventListener('resize', fix);
    window.addEventListener('orientationchange', fix);
    document.addEventListener('visibilitychange', fix);
    const t = window.setTimeout(fix, 250); // sau khi bố cục/CSS ổn định
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fix);
      window.removeEventListener('orientationchange', fix);
      document.removeEventListener('visibilitychange', fix);
      window.clearTimeout(t);
    };
  }, [map]);
  return null;
}

/** Chấm vị trí của người dùng: chấm xanh có vòng nhấp nháy, thêm mũi hướng đi nếu thiết bị báo hướng. */
function userIcon(heading: number | null) {
  const cone = heading === null ? '' : `<div class="user-heading" style="transform:rotate(${Math.round(heading)}deg)"></div>`;
  return L.divIcon({ className: 'user-marker', html: `${cone}<div class="user-pulse"></div><div class="user-dot"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
}

function ClickHandler({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Follow({ to }: { to: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (to && !map.getBounds().pad(-0.2).contains([to.lat, to.lng])) map.panTo([to.lat, to.lng]);
  }, [to, map]);
  return null;
}

/** Điểm đo khoảng cách: có title nếu là địa điểm du lịch, không có nếu là điểm bấm tùy ý trên bản đồ. */
type MeasurePoint = LatLng & { title?: string };

export function MapView(props: {
  places: LocationItem[];
  user?: (LatLng & { accuracy?: number; heading?: number | null }) | null;
  activeCode?: string | null;
  center?: LatLng;
  zoom?: number;
  small?: boolean;
  /** Admin: bấm bản đồ để chọn tọa độ */
  onMapClick?: (p: LatLng) => void;
  showRadius?: boolean;
  /** Hiện nút định vị GPS “về vị trí của tôi” trên bản đồ */
  locate?: boolean;
  /** Tự kéo bản đồ theo người dùng khi đi ra mép (mặc định bật) */
  follow?: boolean;
  measure?: boolean;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { status: gps, startGps } = useTour();
  const mapRef = useRef<L.Map | null>(null);
  const [pendingFly, setPendingFly] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [points, setPoints] = useState<MeasurePoint[]>([]);
  const addPoint = (p: MeasurePoint) => setPoints((prev: MeasurePoint[]) => (prev.length >= 2 ? [p] : [...prev, p]));
  const pointName = (i: number) => points[i]?.title ?? `Điểm ${i + 1}`;
  const centeredOnce = useRef(false);
  const heading = props.user?.heading ?? null;
  const icon = useMemo(() => userIcon(heading === null ? null : Math.round(heading / 10) * 10), [heading]);

  // Lần đầu có vị trí (hoặc vừa bấm nút định vị) → bay tới vị trí người dùng
  useEffect(() => {
    const map = mapRef.current;
    const u = props.user;
    if (!map || !u || !props.locate) return;
    if (pendingFly || !centeredOnce.current) {
      centeredOnce.current = true;
      setPendingFly(false);
      map.flyTo([u.lat, u.lng], Math.max(map.getZoom(), 18), { duration: 0.8 });
    }
  }, [props.user, props.locate, pendingFly]);

  const onLocate = () => {
    if (gps === 'idle' || gps === 'error') {
      setPendingFly(true);
      void startGps();
    } else if (props.user && mapRef.current) {
      mapRef.current.flyTo([props.user.lat, props.user.lng], Math.max(mapRef.current.getZoom(), 18), { duration: 0.8 });
    } else {
      setPendingFly(true);
    }
  };
  const center = props.center ?? OLD_TOWN_CENTER;
  const [status, setStatus] = useState<TileStatus>('loading');
  const retryRef = useRef<(() => void) | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <div className={`map ${props.small ? 'small' : ''}`}>
      <MapContainer ref={mapRef} center={[center.lat, center.lng]} zoom={props.zoom ?? 17} maxZoom={19} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <BaseTiles onStatus={setStatus} retryRef={retryRef} />
        <AutoResize />
        {props.places.filter((p) => p.latitude !== null && p.longitude !== null).map((p) => {
          const active = p.code === props.activeCode;
          return (
            <div key={p.code}>
              {props.showRadius !== false && (
                <Circle center={[p.latitude!, p.longitude!]} radius={p.triggerRadiusM} pathOptions={{ color: active ? '#f07b2e' : '#c9531a', weight: 1, dashArray: '4 3', fillOpacity: active ? 0.2 : 0.06 }} />
              )}
              <CircleMarker
                center={[p.latitude!, p.longitude!]}
                radius={active ? 10 : 7}
                pathOptions={{ color: '#fff', weight: 2, fillColor: active ? '#f07b2e' : '#c9531a', fillOpacity: 1 }}
                eventHandlers={{
                  click: (e: L.LeafletMouseEvent) => {
                    if (measuring) {
                      // Đang đo: lấy đúng tọa độ địa điểm, chặn sự kiện lan xuống bản đồ để không bị thêm điểm lần 2
                      L.DomEvent.stopPropagation(e);
                      addPoint({ lat: p.latitude!, lng: p.longitude!, title: p.title });
                      return;
                    }
                    if (!props.onMapClick) navigate(`/l/${p.code}`);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>{p.title}</Tooltip>
              </CircleMarker>
            </div>
          );
        })}
        {props.user && (
          <>
            {props.user.accuracy && props.user.accuracy > 8 && <Circle center={[props.user.lat, props.user.lng]} radius={props.user.accuracy} pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#2563eb', fillOpacity: 0.1 }} interactive={false} />}
            <Marker position={[props.user.lat, props.user.lng]} icon={icon} interactive={false} zIndexOffset={1000} />
          </>
        )}
        {measuring && points.map((p, i) => <CircleMarker key={i} center={[p.lat, p.lng]} radius={8} pathOptions={{ color: '#fff', fillColor: '#2563eb', fillOpacity: 1 }} interactive={false} />)}
        {points.length === 2 && <Polyline positions={points.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#2563eb', dashArray: '6 6' }} interactive={false} />}
        {props.follow !== false && <Follow to={props.user ?? null} />}
        <ClickHandler onClick={measuring ? addPoint : props.onMapClick} />
      </MapContainer>
      {props.measure && (
        <div style={{ position: 'absolute', left: 12, bottom: 16, zIndex: 1000, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => { setMeasuring(!measuring); setPoints([]); }} style={{ padding: '10px 16px', borderRadius: 999, border: 0, fontWeight: 700, background: measuring ? '#2563eb' : '#fff', color: measuring ? '#fff' : '#333' }}>
            {measuring ? 'Tắt đo' : 'Đo khoảng cách'}
          </button>
          {measuring && (
            <span style={{ background: '#fff', padding: '8px 12px', borderRadius: 12 }}>
              {points.length === 2
                ? `${pointName(0)} → ${pointName(1)}: ${formatDistance(haversine(points[0], points[1]))}`
                : points.length === 1
                  ? `Đã chọn ${pointName(0)} – bấm địa điểm thứ 2`
                  : 'Bấm địa điểm thứ 1 trên bản đồ'}
            </span>
          )}
        </div>
      )}
      {props.locate && (
        <button type="button" className={`locate-btn ${gps}`} onClick={onLocate} title={t('gps.center')} aria-label={t('gps.center')}>
          <GpsIcon size={22} />
        </button>
      )}
      {status !== 'ok' && (
        <div className="map-note" role="status">
          <span>{!online ? 'Đang offline – các điểm vẫn hiển thị, ảnh nền sẽ tự tải khi có mạng.' : status === 'loading' ? 'Đang tải bản đồ…' : 'Chưa tải được ảnh nền – đang tự thử lại. Các điểm tham quan vẫn dùng bình thường.'}</span>
          {status === 'degraded' && (
            <button type="button" onClick={() => retryRef.current?.()}>Thử lại</button>
          )}
        </div>
      )}
    </div>
  );
}
