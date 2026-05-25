import { Link } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Unauthorized() {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: '520px', margin: '2rem auto' }}>
      <div className="glass-card" style={{ textAlign: 'center', display: 'grid', gap: '1rem' }}>
        <ShieldAlert size={38} style={{ color: 'var(--accent-loss)', margin: '0 auto' }} />
        <div>
          <h1 className="header-title">{t('unauthorized.title')}</h1>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {t('unauthorized.message')}
          </p>
        </div>
        <Link className="btn-secondary" to="/">
          {t('unauthorized.backButton')}
        </Link>
      </div>
    </div>
  );
}
