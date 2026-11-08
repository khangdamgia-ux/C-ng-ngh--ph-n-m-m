import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="empty">
      <p style={{ fontSize: 40 }}>🏮</p>
      <p>{t('common.notFound')}</p>
      <Link className="btn" to="/">{t('nav.home')}</Link>
    </div>
  );
}
