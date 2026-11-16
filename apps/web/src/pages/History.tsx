import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStorageVersion } from '../components/useStorageVersion';
import { history } from '../storage';

export function HistoryPage() {
  const { t, i18n } = useTranslation();
  useStorageVersion();
  const items = history.list();
  return (
    <>
      <div className="row page-intro">
        <h1 className="page-h1">{t('history.title')}</h1>
        {items.length > 0 && <button className="btn small" onClick={() => history.clear()}>{t('history.clear')}</button>}
      </div>
      <p className="muted page-note">{t('history.note')}</p>
      {items.length === 0 ? (
        <div className="empty">{t('history.empty')}</div>
      ) : (
        <div className="grid">
          {items.map((h) => (
            <Link key={h.code} to={`/l/${h.code}`} className="card" style={{ minHeight: 0 }}>
              <div>
                <h3>{h.title}</h3>
                <p>{new Date(h.at).toLocaleString(i18n.language)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
