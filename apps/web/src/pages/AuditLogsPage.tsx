import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type SyncLog } from '../api/client';
import { useAuth } from '../hooks/useAuth';

const STATUS_COLORS: Record<string, string> = {
  success: 'var(--accent-win)', ok: 'var(--accent-win)',
  error: 'var(--accent-loss)',
  skipped: 'var(--accent-prime)', partial: 'var(--accent-prime)',
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  'event-stream': { label: 'Event Stream', color: 'var(--accent-blue)' },
  'cron':         { label: 'Cron',         color: 'var(--accent-teal-bright)' },
  'user':         { label: 'Usuario',      color: 'var(--accent-violet)' },
  'admin':        { label: 'Admin',        color: 'var(--accent-prime)' },
};

export default function AuditLogsPage() {
  const { user, internalLoading } = useAuth();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  if (internalLoading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Checking session...</div>;

  if (!user || user.globalRole !== 'PLATFORM_ADMIN') {
    return (
      <div style={{ maxWidth: '480px' }}>
        <div className="glass-card" style={{ display: 'grid', gap: '1rem' }}>
          <Shield size={34} style={{ color: 'var(--accent-loss)' }} />
          <h1 className="header-title">Audit Logs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Requiere cuenta Platform Admin.</p>
          <a className="btn-primary" href="/login" style={{ width: 'fit-content' }}>Login</a>
        </div>
      </div>
    );
  }

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await apiClient.admin.syncLogs(300, entityFilter || undefined, statusFilter || undefined);
      const filtered = sourceFilter ? res.logs.filter((l) => l.source === sourceFilter) : res.logs;
      setLogs(filtered);
      setTotal(res.total);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchLogs(); }, [entityFilter, statusFilter, sourceFilter]);

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Audit Logs</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
          Historial de operaciones de sincronización con módulo, usuario y error detallado.
        </p>
      </header>

      {/* Filters */}
      <div className="glass-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <select className="input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
          <option value="">Todos los módulos</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
          <option value="">Todas las entidades</option>
          {['player', 'match', 'version', 'auth', 'sync:cron', 'sync:on-demand', 'Invitation'].map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '1 1 120px' }}>
          <option value="">Todos los estados</option>
          {['ok', 'success', 'error', 'partial', 'skipped'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => void fetchLogs()} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>Actualizar</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {total} total · {logs.length} mostrados
        </span>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'clip' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 120px 1fr 80px 120px', padding: '0.4rem 1rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', position: 'sticky', top: 0 }}>
          <span>Fecha y hora</span>
          <span>Módulo</span>
          <span>Detalle / Error</span>
          <span>Estado</span>
          <span>Usuario</span>
        </div>
        {loading ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>Cargando...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>No se encontraron registros.</div>
        ) : logs.map((log) => {
          const src = log.source ? SOURCE_LABELS[log.source] : null;
          const isError = log.status === 'error';
          return (
            <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '150px 120px 1fr 80px 120px', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', alignItems: 'start', fontSize: '0.76rem', background: isError ? 'rgba(248,113,113,0.03)' : undefined }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                {new Date(log.syncedAt).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span>
                {src
                  ? <span style={{ fontSize: '0.65rem', fontWeight: 700, color: src.color, background: `${src.color}18`, border: `1px solid ${src.color}40`, borderRadius: 999, padding: '0.1rem 0.45rem' }}>{src.label}</span>
                  : <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{log.entity} · {log.operation}</span>
                }
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: isError ? 'var(--accent-loss)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.error ?? log.entityId}>
                {log.error ?? `${log.entity} · ${log.operation} · ${log.entityId.slice(0, 24)}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {isError ? <XCircle size={11} style={{ color: 'var(--accent-loss)', flexShrink: 0 }} />
                  : log.status === 'partial' || log.status === 'skipped' ? <AlertTriangle size={11} style={{ color: 'var(--accent-prime)', flexShrink: 0 }} />
                  : <CheckCircle size={11} style={{ color: 'var(--accent-win)', flexShrink: 0 }} />}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', color: STATUS_COLORS[log.status] ?? 'var(--text-muted)' }}>{log.status}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.userName ?? '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
