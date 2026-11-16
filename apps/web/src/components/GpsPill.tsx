import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTour } from '../tour/TourContext';
import { GpsIcon } from './GpsCard';

/** Nút GPS nhỏ trên thanh trên cùng – thấy trạng thái định vị ở mọi trang. */
export function GpsPill() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, position, startGps } = useTour();
  const on = status === 'tracking' || status === 'locating';
  return (
    <button
      className={`gps-pill ${status}`}
      onClick={() => (on ? navigate('/map') : void startGps())}
      title={on ? t('gps.center') : t('gps.enable')}
      aria-label={on ? t('gps.center') : t('gps.enable')}
    >
      <GpsIcon size={18} />
      <span className="txt">{status === 'tracking' && position ? `±${Math.round(position.accuracy)} m` : status === 'locating' ? '…' : 'GPS'}</span>
    </button>
  );
}
