import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Radio, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface ApiStatusData {
  predgg: {
    status: 'ok' | 'error'; responseMs: number | null; error: string | null; endpoint: string;
    oauth: {
      requestedScopes: string[];
      grantedScopes: string[];
      missingScopes: string[];
      capabilities: Record<string, boolean>;
      checkedAt: string | null;
      error: string | null;
    };
  };
  syncErrors: { total: number; last24h: number; bySource: Array<{ source: string | null; _count: { id: number } }> };
  lastSuccessfulSync: { syncedAt: string; entity: string; source: string | null } | null;
}

const SOURCE_LABELS: Record<string, string> = {
  'event-stream': 'Event Stream', 'cron': 'Cron', 'user': 'User', 'admin': 'Admin',
};

export default function ApiStatusPage() {
  const { t } = useTranslation();
  const { user, internalLoading } = useAuth();
  const [data, setData] = useState<ApiStatusData | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = !internalLoading && !!user && user.globalRole === 'PLATFORM_ADMIN';

  // All hooks before any early returns
  const doRefresh = useCallback(() => {
    if (!isAdmin) return;
    setLoading(true);
    (apiClient as any).admin.apiStatus()
      .then((res: ApiStatusData) => setData(res))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    doRefresh();
  }, [doRefresh]);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(doRefresh, 30000);
    return () => clearInterval(t);
  }, [isAdmin, doRefresh]);

  if (internalLoading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Checking session...</div>;

  if (!user || user.globalRole !== 'PLATFORM_ADMIN') {
    return (
      <div style={{ maxWidth: '480px' }}>
        <div className="glass-card" style={{ display: 'grid', gap: '1rem' }}>
          <Shield size={34} style={{ color: 'var(--accent-loss)' }} />
          <h1 className="header-title">API Status</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{t('apiStatus.requiresAdmin')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="header-title">API Status</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
            Estado de conexión con pred.gg y resumen de errores de sincronización.
          </p>
        </div>
        <button onClick={doRefresh} disabled={loading} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          Actualizar
        </button>
      </header>

      {loading && !data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2].map((i) => <div key={i} className="glass-card" style={{ height: 100, background: 'rgba(255,255,255,0.02)' }} />)}
        </div>
      ) : !data ? (
        <div style={{ padding: '1.5rem', color: 'var(--accent-loss)' }}>
          {t('apiStatus.loadError')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="glass-card" style={{ borderLeft: `3px solid ${data.predgg.status === 'ok' ? 'var(--accent-win)' : 'var(--accent-loss)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Radio size={18} style={{ color: data.predgg.status === 'ok' ? 'var(--accent-win)' : 'var(--accent-loss)', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>pred.gg API</span>
              {data.predgg.status === 'ok'
                ? <><CheckCircle size={14} style={{ color: 'var(--accent-win)' }} /><span style={{ color: 'var(--accent-win)', fontWeight: 700 }}>{t('apiStatus.connected')}</span></>
                : <><XCircle size={14} style={{ color: 'var(--accent-loss)' }} /><span style={{ color: 'var(--accent-loss)', fontWeight: 700 }}>{t('apiStatus.disconnected')}</span></>
              }
              {data.predgg.responseMs !== null && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {data.predgg.responseMs}ms
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{data.predgg.endpoint}</div>
            {data.predgg.error && (
              <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--accent-loss)' }}>
                {data.predgg.error}
              </div>
            )}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Permisos OAuth de pred.gg</span>
                <span style={{ fontSize: '0.7rem', color: data.predgg.oauth.missingScopes.length === 0 ? 'var(--accent-win)' : 'var(--accent-prime)', fontWeight: 700 }}>
                  {data.predgg.oauth.missingScopes.length === 0 ? 'Completos' : `${data.predgg.oauth.missingScopes.length} pendientes`}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {data.predgg.oauth.requestedScopes.map((scope) => {
                  const granted = data.predgg.oauth.grantedScopes.includes(scope);
                  return (
                    <span key={scope} title={granted ? 'Permiso concedido' : 'Requiere volver a conectar pred.gg'} style={{
                      padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: '0.67rem', fontFamily: 'var(--font-mono)',
                      color: granted ? 'var(--accent-win)' : 'var(--accent-prime)',
                      background: granted ? 'rgba(74,222,128,0.07)' : 'rgba(251,191,36,0.07)',
                      border: `1px solid ${granted ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.25)'}`,
                    }}>
                      {granted ? '✓' : '!'} {scope}
                    </span>
                  );
                })}
              </div>
              {data.predgg.oauth.missingScopes.length > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-prime)' }}>
                  Vuelve a conectar pred.gg para solicitar las funciones avanzadas. Renovar el token no añade permisos nuevos.
                </div>
              )}
              {data.predgg.oauth.error && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{data.predgg.oauth.error}</div>
              )}
            </div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <AlertTriangle size={18} style={{ color: data.syncErrors.last24h > 0 ? 'var(--accent-prime)' : 'var(--text-muted)' }} />
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{t('apiStatus.syncErrors')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: data.syncErrors.last24h > 0 ? 'var(--accent-loss)' : 'var(--text-primary)', lineHeight: 1 }}>
                  {data.syncErrors.last24h.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('apiStatus.last24h')}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1 }}>
                  {data.syncErrors.total.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('apiStatus.historicalTotal')}</div>
              </div>
            </div>
            {data.syncErrors.bySource.length > 0 && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{t('apiStatus.per24hModule')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {data.syncErrors.bySource.map((s) => (
                    <div key={s.source ?? 'null'} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.72rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{SOURCE_LABELS[s.source ?? ''] ?? s.source ?? 'Sistema'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-loss)' }}>{s._count.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {data.lastSuccessfulSync && (
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle size={16} style={{ color: 'var(--accent-win)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{t('apiStatus.lastSuccessfulSync')}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem', fontFamily: 'var(--font-mono)' }}>
                  {new Date(data.lastSuccessfulSync.syncedAt).toLocaleString(undefined)} · {SOURCE_LABELS[data.lastSuccessfulSync.source ?? ''] ?? data.lastSuccessfulSync.entity}
                </div>
              </div>
            </div>
          )}

          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>↻ actualización automática cada 30s</p>
        </div>
      )}
    </div>
  );
}
