import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Activity, Play, Square, Clock, Database, ScrollText, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type SyncLog, type SyncStatus, type CronJob } from '../api/client';
import { useAuth } from '../hooks/useAuth';

type AdminTab = 'sync' | 'data' | 'logs';

export default function AdminPanel() {
  const { user, internalLoading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('sync');

  if (internalLoading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Checking session...</div>;
  }

  if (!user || user.globalRole !== 'PLATFORM_ADMIN') {
    return (
      <div style={{ maxWidth: '560px' }}>
        <div className="glass-card" style={{ display: 'grid', gap: '1rem' }}>
          <Shield size={34} style={{ color: 'var(--accent-loss)' }} />
          <h1 className="header-title">Platform Admin</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
            This section requires a Platform Admin account.
          </p>
          <a className="btn-primary" href="/login" style={{ width: 'fit-content' }}>Login</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h1 className="header-title">Platform Admin</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
            Sync, data controls and audit logs.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.7rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem' }}>
          <Shield size={13} style={{ color: 'var(--accent-teal-bright)' }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{user.name}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--accent-teal-bright)', fontWeight: 700 }}>ADMIN</span>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        {([
          { id: 'sync', label: 'Sync Status', icon: <Activity size={14} /> },
          { id: 'data', label: 'Data Controls', icon: <Database size={14} /> },
          { id: 'logs', label: 'Audit Logs', icon: <ScrollText size={14} /> },
        ] as Array<{ id: AdminTab; label: string; icon: React.ReactNode }>).map(({ id, label, icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: tab === id ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: tab === id ? '2px solid var(--accent-blue)' : '2px solid transparent', transition: 'color 0.15s' }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'sync' && <SyncStatusTab />}
      {tab === 'data' && <DataControlsTab />}
      {tab === 'logs' && <AuditLogsTab />}
    </div>
  );
}

// ── Sync Status Tab ───────────────────────────────────────────────────────────

function SyncStatusTab() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobLoading, setJobLoading] = useState(false);
  const [optimisticRunning, setOptimisticRunning] = useState(false);
  const [cronLoading, setCronLoading] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);

  async function refresh() {
    try {
      const [s, logs] = await Promise.all([
        apiClient.admin.syncStatus(),
        apiClient.admin.syncLogs(10, 'sync:cron').catch(() => ({ logs: [] })),
      ]);
      setStatus(s);
      setSyncHistory(logs.logs);
      if (!s.eventStreamJob.running) setOptimisticRunning(false);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const isRunning = status?.eventStreamJob.running || optimisticRunning;
    const interval = setInterval(() => void refresh(), isRunning ? 2000 : 10000);
    return () => clearInterval(interval);
  }, [status?.eventStreamJob.running, optimisticRunning]);

  async function handleStartStop() {
    if (!status) return;
    const isRunning = status.eventStreamJob.running;
    setJobLoading(true);
    if (!isRunning) setOptimisticRunning(true);
    try {
      if (isRunning) {
        await apiClient.admin.stopEventStreamSync();
        setOptimisticRunning(false);
        toast.success('Sync detenido');
      } else {
        const res = await apiClient.admin.startEventStreamSync();
        if (res.ok) {
          toast.success('Sync iniciado — procesando partidas en background');
        } else {
          setOptimisticRunning(false);
          toast.error(res.message);
        }
      }
      await refresh();
    } catch (err) {
      setOptimisticRunning(false);
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error al iniciar sync';
      if (msg.includes('pred.gg') || msg.includes('PREDGG')) {
        toast.error('Necesitas estar logueado en pred.gg — usa el botón "Connect pred.gg" en Login');
      } else {
        toast.error(msg);
      }
    } finally { setJobLoading(false); }
  }

  async function handleCronToggle() {
    if (!status) return;
    setCronLoading(true);
    try {
      if (status.cronJob.enabled) {
        await apiClient.admin.stopCron();
        toast.success('Cron detenido');
      } else {
        await apiClient.admin.startCron();
        toast.success('Cron activado — sincronizará cada 2h');
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al cambiar estado del cron');
    } finally { setCronLoading(false); }
  }

  async function handleCronRunNow() {
    setCronLoading(true);
    try {
      await apiClient.admin.runCronNow();
      toast.success('Sync manual lanzado');
      setTimeout(() => void refresh(), 3000);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al lanzar sync manual');
    } finally { setCronLoading(false); }
  }

  if (loading && !status) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-card" style={{ height: 120, background: 'rgba(255,255,255,0.02)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
  if (!status) return <div style={{ padding: '1.5rem', color: 'var(--accent-loss)' }}>Error al cargar estado</div>;

  const { players, matches, eventStreamJob: job, cronJob } = status;
  const isRunning = job.running || optimisticRunning;
  const playerSyncPct = players.total > 0 ? Math.round(((players.total - players.stale - players.hidden) / players.total) * 100) : 0;
  const matchCompletePct = matches.total > 0 ? Math.round((matches.complete / matches.total) * 100) : 0;
  const jobPct = job.total > 0 ? Math.round((job.synced / job.total) * 100) : 0;

  let ratePerMin: number | null = null;
  let etaMin: number | null = null;
  if (job.running && job.startedAt && job.synced > 0) {
    const elapsedMin = (Date.now() - new Date(job.startedAt).getTime()) / 60000;
    ratePerMin = Math.round(job.synced / elapsedMin);
    const remaining = job.total - job.synced;
    if (ratePerMin > 0) etaMin = Math.ceil(remaining / ratePerMin);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Players */}
      <div className="glass-card" style={{ padding: 0, overflow: 'clip' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={15} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Players</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{players.total.toLocaleString()} total</span>
        </div>
        <SyncRow label="Fully synced" value={players.synced} total={players.total} color="var(--accent-win)" />
        <SyncRow label="Needs re-sync (>24h)" value={players.stale} total={players.total} color="var(--accent-prime)" warning />
        <SyncRow label="Private / hidden" value={players.hidden} total={players.total} color="var(--text-muted)" />
        <div style={{ padding: '0.65rem 1.25rem', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${playerSyncPct}%`, background: playerSyncPct === 100 ? 'var(--accent-win)' : 'var(--accent-blue)', borderRadius: 999, transition: 'width 0.5s' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: playerSyncPct === 100 ? 'var(--accent-win)' : 'var(--text-muted)', flexShrink: 0 }}>{playerSyncPct}%</span>
        </div>
      </div>

      {/* Matches */}
      <div className="glass-card" style={{ padding: 0, overflow: 'clip' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={15} style={{ color: 'var(--accent-violet)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Matches</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{matches.total.toLocaleString()} total</span>
        </div>
        <SyncRow label="Complete (players + event stream)" value={matches.complete} total={matches.total} color="var(--accent-win)" />
        <SyncRow label="Partial (players, sin event stream)" value={matches.partial} total={matches.total} color="var(--accent-prime)" warning />
        <SyncRow label="Incomplete (sin players)" value={matches.incomplete} total={matches.total} color="var(--accent-loss)" warning />
        <div style={{ padding: '0.65rem 1.25rem', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${matchCompletePct}%`, background: matchCompletePct === 100 ? 'var(--accent-win)' : 'var(--accent-violet)', borderRadius: 999, transition: 'width 0.5s' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: matchCompletePct === 100 ? 'var(--accent-win)' : 'var(--text-muted)', flexShrink: 0 }}>{matchCompletePct}%</span>
        </div>
      </div>

      {/* Event Stream Background Sync */}
      <div className="glass-card" style={{ borderLeft: job.tokenError ? '3px solid var(--accent-loss)' : isRunning ? '3px solid var(--accent-blue)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <RefreshCw size={16} style={{ color: isRunning ? 'var(--accent-blue)' : job.tokenError ? 'var(--accent-loss)' : 'var(--text-muted)', animation: isRunning ? 'spin 1s linear infinite' : 'none', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Event Stream Background Sync</span>
          {isRunning && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-blue)', background: 'rgba(91,156,246,0.15)', border: '1px solid rgba(91,156,246,0.4)', borderRadius: '999px', padding: '0.15rem 0.55rem' }}>EN CURSO</span>
          )}
          {job.tokenError && !isRunning && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-loss)', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '999px', padding: '0.15rem 0.55rem' }}>TOKEN EXPIRADO</span>
          )}
          {isRunning && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>↻ cada 2s</span>}
        </div>

        {job.tokenError && !isRunning && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--accent-loss)', lineHeight: 1.6 }}>
            La sesión de pred.gg expiró durante el sync. {job.synced > 0 && `Se sincronizaron ${job.synced} partidas. `}
            Asegúrate de estar logueado en pred.gg y vuelve a iniciar.
          </div>
        )}

        {isRunning && (
          <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(91,156,246,0.06)', border: '1px solid rgba(91,156,246,0.15)', borderRadius: 8 }}>
            {job.total === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-blue)', fontSize: '0.82rem' }}>
                <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                Iniciando — calculando partidas pendientes...
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {job.synced.toLocaleString()}
                    <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>/ {job.total.toLocaleString()} partidas</span>
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{jobPct}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '0.6rem' }}>
                  <div style={{ height: '100%', width: `${jobPct}%`, background: 'linear-gradient(90deg, var(--accent-blue), #7eb8fb)', borderRadius: 999, transition: 'width 1s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                  <span><span style={{ color: 'var(--accent-win)', fontWeight: 700 }}>{job.synced.toLocaleString()}</span> <span style={{ color: 'var(--text-muted)' }}>OK</span></span>
                  <span><span style={{ color: 'var(--accent-loss)', fontWeight: 700 }}>{job.errors}</span> <span style={{ color: 'var(--text-muted)' }}>errores</span></span>
                  {ratePerMin !== null && <span><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{ratePerMin}</span> <span style={{ color: 'var(--text-muted)' }}>p/min</span></span>}
                  {etaMin !== null && <span style={{ color: 'var(--text-muted)' }}>~{etaMin < 60 ? `${etaMin}min` : `${Math.round(etaMin / 60)}h`} restantes</span>}
                  {job.lastActivity && <span style={{ color: 'var(--text-muted)' }}>última actividad {new Date(job.lastActivity).toLocaleTimeString()}</span>}
                </div>
              </>
            )}
          </div>
        )}

        {!isRunning && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Sincroniza kills, objectives, wards y gold diff de todas las partidas pendientes en background. Requiere sesión activa de pred.gg.
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => void handleStartStop()} disabled={jobLoading} className={isRunning ? 'btn-secondary' : 'btn-primary'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {jobLoading
              ? <><RefreshCw size={13} style={{ animation: 'spin 0.6s linear infinite' }} /> {isRunning ? 'Deteniendo...' : 'Iniciando...'}</>
              : isRunning ? <><Square size={13} /> Detener sync</> : <><Play size={13} /> Iniciar event stream sync</>
            }
          </button>
          {!isRunning && matches.partial > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-prime)' }}>
              {matches.partial.toLocaleString()} partidas pendientes
            </span>
          )}
        </div>
      </div>

      {/* Cron */}
      <CronStatusCard cronJob={cronJob} loading={cronLoading} onToggle={() => void handleCronToggle()} onRunNow={() => void handleCronRunNow()} history={syncHistory} />
    </div>
  );
}

function SyncRow({ label, value, total, color, warning }: { label: string; value: number; total: number; color: string; warning?: boolean }) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px', alignItems: 'center', padding: '0.55rem 1.25rem', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {warning && value > 0 ? <AlertTriangle size={12} style={{ color, flexShrink: 0 }} /> : <CheckCircle size={12} style={{ color, flexShrink: 0 }} />}
        {label}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color, textAlign: 'right' }}>{value.toLocaleString()}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function CronStatusCard({ cronJob, loading, onToggle, onRunNow, history }: { cronJob: CronJob; loading: boolean; onToggle: () => void; onRunNow: () => void; history: SyncLog[] }) {
  const lastResult = cronJob.lastRunResult;
  return (
    <div className="glass-card" style={{ borderLeft: cronJob.enabled ? '3px solid var(--accent-teal-bright)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Clock size={16} style={{ color: cronJob.enabled ? 'var(--accent-teal-bright)' : 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Auto-Sync Global (cron cada 2h)</span>
        {cronJob.enabled && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-teal-bright)', background: 'rgba(56,212,200,0.12)', border: '1px solid rgba(56,212,200,0.35)', borderRadius: '999px', padding: '0.15rem 0.55rem' }}>ACTIVO</span>}
        {cronJob.running && <RefreshCw size={12} style={{ color: 'var(--accent-teal-bright)', animation: 'spin 1s linear infinite' }} />}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
        Busca partidas recientes de todos los jugadores cada 2 horas y las sincroniza automáticamente.
        El token se guarda al iniciar el Event Stream Sync.
      </p>
      {lastResult && (
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', marginBottom: '1rem', padding: '0.65rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
          <span><span style={{ color: 'var(--accent-win)', fontWeight: 700 }}>{lastResult.newMatches}</span> <span style={{ color: 'var(--text-muted)' }}>nuevas</span></span>
          <span><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{lastResult.players}</span> <span style={{ color: 'var(--text-muted)' }}>jugadores</span></span>
          {lastResult.errors > 0 && <span><span style={{ color: 'var(--accent-loss)', fontWeight: 700 }}>{lastResult.errors}</span> <span style={{ color: 'var(--text-muted)' }}>errores</span></span>}
          {cronJob.lastRunAt && <span style={{ color: 'var(--text-muted)' }}>última: {new Date(cronJob.lastRunAt).toLocaleTimeString()}</span>}
          {cronJob.nextRunAt && cronJob.enabled && <span style={{ color: 'var(--text-muted)' }}>próxima: {new Date(cronJob.nextRunAt).toLocaleTimeString()}</span>}
        </div>
      )}
      {!lastResult && cronJob.enabled && cronJob.nextRunAt && (
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
          Primera ejecución: {new Date(cronJob.nextRunAt).toLocaleTimeString()}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: history.length > 0 ? '1.25rem' : undefined }}>
        <button onClick={onToggle} disabled={loading} className={cronJob.enabled ? 'btn-secondary' : 'btn-primary'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loading ? <RefreshCw size={13} style={{ animation: 'spin 0.6s linear infinite' }} /> : cronJob.enabled ? <Square size={13} /> : <Play size={13} />}
          {cronJob.enabled ? 'Desactivar' : 'Activar cron (cada 2h)'}
        </button>
        <button onClick={onRunNow} disabled={loading || cronJob.running} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={13} style={{ animation: cronJob.running ? 'spin 1s linear infinite' : 'none' }} />
          Ejecutar ahora
        </button>
      </div>
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Historial reciente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {history.map((log) => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', padding: '0.35rem 0.7rem', background: 'rgba(255,255,255,0.025)', borderRadius: 6 }}>
                {log.status === 'ok' ? <CheckCircle size={12} style={{ color: 'var(--accent-win)', flexShrink: 0 }} />
                  : log.status === 'partial' ? <AlertTriangle size={12} style={{ color: 'var(--accent-prime)', flexShrink: 0 }} />
                  : <XCircle size={12} style={{ color: 'var(--accent-loss)', flexShrink: 0 }} />}
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', flexShrink: 0 }}>
                  {new Date(log.syncedAt).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ color: log.status === 'ok' ? 'var(--text-secondary)' : log.status === 'partial' ? 'var(--accent-prime)' : 'var(--accent-loss)', flex: 1 }}>
                  {log.status === 'ok' ? 'Completado sin errores' : log.error ?? log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Data Controls Tab ─────────────────────────────────────────────────────────

type OpState = 'idle' | 'running' | 'done' | 'error';

function DataControlsTab() {
  const [ops, setOps] = useState<Record<string, { state: OpState; result?: string }>>({});

  async function runOp(key: string, fn: () => Promise<string>) {
    setOps((p) => ({ ...p, [key]: { state: 'running' } }));
    try {
      const result = await fn();
      setOps((p) => ({ ...p, [key]: { state: 'done', result } }));
      toast.success(result);
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Operation failed';
      setOps((p) => ({ ...p, [key]: { state: 'error', result: msg } }));
      toast.error(msg);
    }
  }

  const controls: Array<{ key: string; label: string; desc: string; fn: () => Promise<string> }> = [
    { key: 'versions', label: 'Sync Versions', desc: 'Fetch all game versions from pred.gg and upsert into DB.',
      fn: async () => { const r = await apiClient.admin.syncVersions(); return `${r.synced} version${r.synced !== 1 ? 's' : ''} synced in ${(r.elapsed / 1000).toFixed(1)}s`; } },
    { key: 'stale', label: 'Sync Stale Players', desc: 'Re-sync players whose data is outdated (batch of 20).',
      fn: async () => { const r = await apiClient.admin.syncStale(); return `${r.synced} synced · ${r.skipped} skipped · ${r.errors} errors`; } },
    { key: 'incomplete', label: 'Sync Incomplete Matches', desc: 'Fetch full 10-player rosters for matches with missing MatchPlayers.',
      fn: async () => { const r = await apiClient.admin.syncIncompleteMatches(); return `${r.synced} matches synced · ${r.errors} errors`; } },
    { key: 'fixids', label: 'Fix HeroKill Player IDs', desc: 'Repair event stream records that reference pred.gg UUIDs instead of internal IDs.',
      fn: async () => { const r = await apiClient.admin.fixHeroKillPlayerIds(); return `Updated ${r.heroKillsUpdated} kills · ${r.objectiveKillsUpdated} objectives · ${r.wardEventsUpdated} wards`; } },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {controls.map(({ key, label, desc, fn }) => {
        const op = ops[key];
        return (
          <div key={key} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{desc}</div>
              {op?.result && (
                <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: op.state === 'done' ? 'var(--accent-win)' : 'var(--accent-loss)' }}>
                  {op.state === 'done' ? <CheckCircle size={11} style={{ display: 'inline', marginRight: 4 }} /> : <XCircle size={11} style={{ display: 'inline', marginRight: 4 }} />}
                  {op.result}
                </div>
              )}
            </div>
            <button onClick={() => void runOp(key, fn)} disabled={op?.state === 'running'} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              <RefreshCw size={13} style={{ animation: op?.state === 'running' ? 'spin 0.8s linear infinite' : 'none' }} />
              {op?.state === 'running' ? 'Running...' : 'Run'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Audit Logs Tab ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  success: 'var(--accent-win)',
  error: 'var(--accent-loss)',
  skipped: 'var(--accent-prime)',
};

function AuditLogsTab() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await apiClient.admin.syncLogs(100, entityFilter || undefined, statusFilter || undefined);
      setLogs(res.logs);
      setTotal(res.total);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void fetchLogs(); }, [entityFilter, statusFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={{ flex: '1 1 160px' }}>
          <option value="">All entities</option>
          {['player', 'match', 'version', 'auth', 'sync:cron', 'sync:on-demand'].map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
          <option value="">All statuses</option>
          {['success', 'error', 'skipped', 'ok', 'partial'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{total} entries</span>
      </div>
      <div className="glass-card" style={{ padding: 0, overflow: 'clip' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 140px 120px 90px 1fr', padding: '0.35rem 1rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', position: 'sticky', top: 0 }}>
          <span>Time</span><span>Entity</span><span>Operation</span><span>Status</span><span>Details</span>
        </div>
        {loading ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No logs found.</div>
        ) : logs.map((log) => (
          <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '110px 140px 120px 90px 1fr', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', alignItems: 'start', fontSize: '0.78rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {new Date(log.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{log.entity}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{log.operation}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {log.status === 'success' || log.status === 'ok' ? <CheckCircle size={11} style={{ color: 'var(--accent-win)', flexShrink: 0 }} /> : log.status === 'error' ? <XCircle size={11} style={{ color: 'var(--accent-loss)', flexShrink: 0 }} /> : <AlertTriangle size={11} style={{ color: 'var(--accent-prime)', flexShrink: 0 }} />}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: STATUS_COLORS[log.status] ?? 'var(--text-muted)' }}>{log.status}</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: log.error ? 'var(--accent-loss)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {log.error ?? log.entityId}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
