import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Activity, Play, Square, Clock, Database, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type SyncLog, type SyncStatus, type CronJob } from '../api/client';
import { useAuth } from '../hooks/useAuth';

type DQTab = 'sync' | 'controls';

export default function DataQualityPage() {
  const { user, internalLoading } = useAuth();
  const [tab, setTab] = useState<DQTab>('sync');

  if (internalLoading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Checking session...</div>;

  if (!user || user.globalRole !== 'PLATFORM_ADMIN') {
    return (
      <div style={{ maxWidth: '480px' }}>
        <div className="glass-card" style={{ display: 'grid', gap: '1rem' }}>
          <Shield size={34} style={{ color: 'var(--accent-loss)' }} />
          <h1 className="header-title">Data Quality</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Requiere cuenta Platform Admin.</p>
          <a className="btn-primary" href="/login" style={{ width: 'fit-content' }}>Login</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Data Quality</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
          Estado de sincronización de jugadores, partidas y controles manuales.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        {([
          { id: 'sync', label: 'Sync Status', icon: <Activity size={14} /> },
          { id: 'controls', label: 'Data Controls', icon: <Database size={14} /> },
        ] as Array<{ id: DQTab; label: string; icon: React.ReactNode }>).map(({ id, label, icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: tab === id ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: tab === id ? '2px solid var(--accent-blue)' : '2px solid transparent', transition: 'color 0.15s' }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'sync' && <SyncStatusTab />}
      {tab === 'controls' && <DataControlsTab />}
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
      const s = await apiClient.admin.syncStatus();
      setStatus(s);
      if (!s.eventStreamJob.running) setOptimisticRunning(false);
      // Load cron history separately — don't block on failure
      apiClient.admin.syncLogs(10, 'sync:cron')
        .then((res) => setSyncHistory(res.logs))
        .catch(() => null);
    } catch (err) {
      console.error('sync status failed:', err);
    } finally {
      setLoading(false);
    }
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
        if (res.ok) toast.success('Sync iniciado en background');
        else { setOptimisticRunning(false); toast.error(res.message); }
      }
      await refresh();
    } catch (err) {
      setOptimisticRunning(false);
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error';
      toast.error(msg.includes('pred.gg') || msg.includes('PREDGG')
        ? 'Necesitas estar logueado en pred.gg'
        : msg);
    } finally { setJobLoading(false); }
  }

  async function handleCronToggle() {
    if (!status) return;
    setCronLoading(true);
    try {
      if (status.cronJob.enabled) { await apiClient.admin.stopCron(); toast.success('Cron desactivado'); }
      else { await apiClient.admin.startCron(); toast.success('Cron activado — cada 2h'); }
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error');
    } finally { setCronLoading(false); }
  }

  async function handleCronRunNow() {
    setCronLoading(true);
    try {
      await apiClient.admin.runCronNow();
      toast.success('Sync manual lanzado');
      setTimeout(() => void refresh(), 3000);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error');
    } finally { setCronLoading(false); }
  }

  if (loading && !status) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[1, 2, 3].map((i) => <div key={i} className="glass-card" style={{ height: 110, background: 'rgba(255,255,255,0.02)' }} />)}
    </div>
  );
  if (!status) return <div style={{ padding: '1.5rem', color: 'var(--accent-loss)' }}>Error al cargar</div>;

  const { players, matches, eventStreamJob: job, cronJob } = status;
  const isRunning = job.running || optimisticRunning;
  const playerPct = players.total > 0 ? Math.round(((players.total - players.stale - players.hidden) / players.total) * 100) : 0;
  const matchPct = matches.total > 0 ? Math.round((matches.complete / matches.total) * 100) : 0;
  const jobPct = job.total > 0 ? Math.round((job.synced / job.total) * 100) : 0;
  let ratePerMin: number | null = null;
  let etaMin: number | null = null;
  if (job.running && job.startedAt && job.synced > 0) {
    const elapsedMin = (Date.now() - new Date(job.startedAt).getTime()) / 60000;
    ratePerMin = Math.round(job.synced / elapsedMin);
    if (ratePerMin > 0) etaMin = Math.ceil((job.total - job.synced) / ratePerMin);
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
        <ProgressBar pct={playerPct} color={playerPct === 100 ? 'var(--accent-win)' : 'var(--accent-blue)'} />
      </div>

      {/* Matches */}
      <div className="glass-card" style={{ padding: 0, overflow: 'clip' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={15} style={{ color: 'var(--accent-violet)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Matches</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{matches.total.toLocaleString()} total</span>
        </div>
        <SyncRow label="Complete (players + event stream)" value={matches.complete} total={matches.total} color="var(--accent-win)" />
        <SyncRow label="Pending (sin event stream)" value={matches.partial} total={matches.total} color="var(--accent-prime)" warning />
        <SyncRow label="No disponible en pred.gg" value={(matches as any).failed ?? 0} total={matches.total} color="var(--text-muted)" />
        <SyncRow label="Incomplete (sin players)" value={matches.incomplete} total={matches.total} color="var(--accent-loss)" warning />
        <ProgressBar pct={matchPct} color={matchPct === 100 ? 'var(--accent-win)' : 'var(--accent-violet)'} />
      </div>

      {/* Event Stream Sync */}
      <div className="glass-card" style={{ borderLeft: job.tokenError ? '3px solid var(--accent-loss)' : isRunning ? '3px solid var(--accent-blue)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <RefreshCw size={16} style={{ color: isRunning ? 'var(--accent-blue)' : job.tokenError ? 'var(--accent-loss)' : 'var(--text-muted)', animation: isRunning ? 'spin 1s linear infinite' : 'none', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Event Stream Background Sync</span>
          {isRunning && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-blue)', background: 'rgba(91,156,246,0.15)', border: '1px solid rgba(91,156,246,0.4)', borderRadius: 999, padding: '0.15rem 0.55rem' }}>EN CURSO</span>}
          {job.tokenError && !isRunning && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-loss)', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 999, padding: '0.15rem 0.55rem' }}>TOKEN EXPIRADO</span>}
          {isRunning && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>↻ 2s</span>}
        </div>
        {job.tokenError && !isRunning && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--accent-loss)', lineHeight: 1.6 }}>
            Sesión de pred.gg expirada. {job.synced > 0 && `${job.synced} partidas sincronizadas antes. `}Asegúrate de estar logueado y reinicia.
          </div>
        )}
        {isRunning && job.total > 0 && (
          <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(91,156,246,0.06)', border: '1px solid rgba(91,156,246,0.15)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700 }}>{job.synced.toLocaleString()} <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ {job.total.toLocaleString()}</span></span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>{jobPct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div style={{ height: '100%', width: `${jobPct}%`, background: 'linear-gradient(90deg, var(--accent-blue), #7eb8fb)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--accent-win)' }}>{job.synced.toLocaleString()} OK</span>
              <span style={{ color: 'var(--accent-loss)' }}>{job.errors} errores</span>
              <span style={{ color: 'var(--accent-prime)' }}>{job.skipped} omitidos</span>
              {ratePerMin !== null && <span style={{ color: 'var(--text-muted)' }}>{ratePerMin} p/min</span>}
              {etaMin !== null && <span style={{ color: 'var(--text-muted)' }}>~{etaMin < 60 ? `${etaMin}min` : `${Math.round(etaMin / 60)}h`} restantes</span>}
            </div>
          </div>
        )}
        {!isRunning && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>Sincroniza kills, objetivos, wards y gold diff de todas las partidas pendientes. Requiere sesión de pred.gg.</p>}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => void handleStartStop()} disabled={jobLoading} className={isRunning ? 'btn-secondary' : 'btn-primary'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {jobLoading ? <RefreshCw size={13} style={{ animation: 'spin 0.6s linear infinite' }} /> : isRunning ? <Square size={13} /> : <Play size={13} />}
            {jobLoading ? (isRunning ? 'Deteniendo...' : 'Iniciando...') : isRunning ? 'Detener' : 'Iniciar Event Stream Sync'}
          </button>
          {!isRunning && matches.partial > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--accent-prime)', alignSelf: 'center' }}>{matches.partial.toLocaleString()} partidas pendientes{(matches as any).failed > 0 ? ` · ${(matches as any).failed.toLocaleString()} no disponibles en pred.gg` : ''}</span>}
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

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ padding: '0.65rem 1.25rem', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: pct === 100 ? 'var(--accent-win)' : 'var(--text-muted)', flexShrink: 0 }}>{pct}%</span>
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
        {cronJob.enabled && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-teal-bright)', background: 'rgba(56,212,200,0.12)', border: '1px solid rgba(56,212,200,0.35)', borderRadius: 999, padding: '0.15rem 0.55rem' }}>ACTIVO</span>}
        {cronJob.running && <RefreshCw size={12} style={{ color: 'var(--accent-teal-bright)', animation: 'spin 1s linear infinite' }} />}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
        Fetchea partidas nuevas de todos los jugadores cada 2h e incluye el event stream. Se guarda al iniciar el Event Stream Sync.
      </p>
      {lastResult && (
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', marginBottom: '1rem', padding: '0.65rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, flexWrap: 'wrap' }}>
          <span><span style={{ color: 'var(--accent-win)', fontWeight: 700 }}>{lastResult.newMatches}</span> <span style={{ color: 'var(--text-muted)' }}>nuevas</span></span>
          {lastResult.eventStreamSynced > 0 && <span><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{lastResult.eventStreamSynced}</span> <span style={{ color: 'var(--text-muted)' }}>event stream</span></span>}
          <span><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{lastResult.players}</span> <span style={{ color: 'var(--text-muted)' }}>jugadores</span></span>
          {lastResult.errors > 0 && <span><span style={{ color: 'var(--accent-loss)', fontWeight: 700 }}>{lastResult.errors}</span> <span style={{ color: 'var(--text-muted)' }}>errores</span></span>}
          {cronJob.lastRunAt && <span style={{ color: 'var(--text-muted)' }}>última: {new Date(cronJob.lastRunAt).toLocaleTimeString()}</span>}
          {cronJob.nextRunAt && cronJob.enabled && <span style={{ color: 'var(--text-muted)' }}>próxima: {new Date(cronJob.nextRunAt).toLocaleTimeString()}</span>}
        </div>
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

  const controls = [
    { key: 'versions', label: 'Sync Versions', desc: 'Fetch all game versions from pred.gg and upsert into DB.',
      fn: async () => { const r = await apiClient.admin.syncVersions(); return `${r.synced} version${r.synced !== 1 ? 's' : ''} synced in ${(r.elapsed / 1000).toFixed(1)}s`; } },
    { key: 'stale', label: 'Sync Stale Players', desc: 'Re-sync players whose data is outdated (batch of 20).',
      fn: async () => { const r = await apiClient.admin.syncStale(); return `${r.synced} synced · ${r.skipped} skipped · ${r.errors} errors`; } },
    { key: 'incomplete', label: 'Sync Incomplete Matches', desc: 'Fetch full 10-player rosters for matches with missing players.',
      fn: async () => { const r = await apiClient.admin.syncIncompleteMatches(); return `${r.synced} matches synced · ${r.errors} errors`; } },
    { key: 'fixids', label: 'Fix HeroKill Player IDs', desc: 'Repair event stream records referencing pred.gg UUIDs instead of internal IDs.',
      fn: async () => { const r = await apiClient.admin.fixHeroKillPlayerIds(); return `Updated ${r.heroKillsUpdated} kills · ${r.objectiveKillsUpdated} objectives · ${r.wardEventsUpdated} wards`; } },
    { key: 'heroes', label: 'Sync Hero Metadata', desc: 'Fetch all heroes from omeda.city and upsert classes, roles and image URLs into DB.',
      fn: async () => { const r = await apiClient.admin.syncHeroes(); return `${r.synced} heroes synced · ${r.errors} errors`; } },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {controls.map(({ key, label, desc, fn }) => {
        const op = ops[key];
        return (
          <div key={key} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</div>
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
