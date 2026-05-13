import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Server, Zap, RefreshCw, CheckCircle, XCircle, ArrowRight, Users, Sparkles, ThumbsUp, ThumbsDown, Send, Download } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiErrorResponse, type TeamProfile, type TeamAnalysis } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { VersionRecord } from '@predecessor/data-model';

type SyncState =
  | { tag: 'idle' }
  | { tag: 'running'; op: string }
  | { tag: 'done'; op: string; result: string }
  | { tag: 'failed'; op: string; message: string };

export default function Dashboard() {
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [latestPatch, setLatestPatch] = useState<VersionRecord | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ tag: 'idle' });
  const [ownTeam, setOwnTeam] = useState<TeamProfile | null>(null);
  const [ownAnalysis, setOwnAnalysis] = useState<TeamAnalysis | null>(null);

  useEffect(() => { void fetchDashboardData(); }, []);

  useEffect(() => {
    apiClient.teams.list('OWN').then((res) => {
      const team = res.teams?.[0] ?? null;
      setOwnTeam(team);
      if (team) {
        apiClient.teams.getAnalysis(team.id)
          .then((a) => setOwnAnalysis(a))
          .catch(() => null);
      }
    }).catch(() => null);
  }, []);

  async function fetchDashboardData() {
    const [health, patch] = await Promise.allSettled([
      apiClient.health(),
      apiClient.patches.latest(),
    ]);
    setHealthStatus(health.status === 'fulfilled' ? 'ok' : 'error');
    if (patch.status === 'fulfilled') setLatestPatch(patch.value);
  }

  async function handleSyncVersions() {
    setSyncState({ tag: 'running', op: 'Versions' });
    try {
      const res = await apiClient.admin.syncVersions();
      const label = `${res.synced} version${res.synced !== 1 ? 's' : ''} synced in ${(res.elapsed / 1000).toFixed(1)}s`;
      setSyncState({ tag: 'done', op: 'Versions', result: label });
      toast.success('Versions synced', { description: label });
      void fetchDashboardData();
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Sync failed';
      setSyncState({ tag: 'failed', op: 'Versions', message: msg });
      toast.error('Versions sync failed', { description: msg });
    }
  }

  async function handleSyncStale() {
    setSyncState({ tag: 'running', op: 'Players' });
    try {
      const res = await apiClient.admin.syncStale();
      const remaining = (res as { total?: number }).total ?? 0;
      const label = `${res.synced} synced · ${res.skipped} skipped · ${res.errors} errors${remaining > res.synced ? ` · ${remaining - res.synced} remaining` : ''}`;
      setSyncState({ tag: 'done', op: 'Players', result: label });
      if (res.errors > 0) {
        toast.warning('Players sync completed with errors', { description: label });
      } else if (remaining > res.synced) {
        toast.success(`Batch synced (${res.synced} players)`, { description: `${remaining - res.synced} more stale — click again to continue` });
      } else {
        toast.success('All players synced', { description: label });
      }
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Sync failed';
      setSyncState({ tag: 'failed', op: 'Players', message: msg });
      toast.error('Players sync failed', { description: msg });
    }
  }

  const isSyncing = syncState.tag === 'running';
  const statusColor = healthStatus === 'ok' ? 'var(--accent-win)' : healthStatus === 'error' ? 'var(--accent-loss)' : 'var(--accent-violet)';

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.875rem' }}>
          System status and data controls.
        </p>
      </header>

      {/* Team widget */}
      {ownTeam && (
        <TeamFormWidget team={ownTeam} analysis={ownAnalysis} />
      )}

      {/* LLM Focus of the Day */}
      {ownTeam && (
        <FocusOfTheDay teamId={ownTeam.id} />
      )}

      {/* Player sync button — only visible if user has a linked player */}
      <PlayerSyncWidget />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
            <Server color="var(--accent-blue)" size={18} />
            <h3 style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>System Health</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              className={healthStatus === 'ok' ? 'led-pulse' : undefined}
              style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: statusColor,
                ['--pulse-color' as string]: 'var(--accent-win)',
                transition: 'background 0.3s',
              }}
            />
            <span style={{ color: healthStatus === 'ok' ? 'var(--text-primary)' : statusColor, fontWeight: 600, fontSize: '0.9rem' }}>
              {healthStatus === 'ok' ? 'API Online' : healthStatus === 'error' ? 'API Disconnected' : 'Checking…'}
            </span>
          </div>
          {healthStatus === 'ok' && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '0.35rem' }}>pred.gg pipeline active</p>
          )}
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
            <Zap color="var(--accent-violet)" size={18} />
            <h3 style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Patch</h3>
          </div>
          {latestPatch ? (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.65rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                v{latestPatch.name}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.45rem', fontFamily: 'var(--font-mono)' }}>
                {new Date(latestPatch.releaseDate).toLocaleDateString()} · {latestPatch.patchType}
              </p>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No patch data. Run "Sync Versions" below.
            </p>
          )}
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.1rem' }}>
            <RefreshCw
              color="var(--text-muted)"
              size={18}
              style={{ animation: isSyncing ? 'spin 0.8s linear infinite' : 'none' }}
            />
            <h3 style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Data Controls</h3>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <button
              onClick={() => void handleSyncVersions()}
              disabled={isSyncing || healthStatus !== 'ok'}
              className="btn-secondary"
              style={{ flex: 1 }}
            >
              Sync Versions
            </button>
            <button
              onClick={() => void handleSyncStale()}
              disabled={isSyncing || healthStatus !== 'ok'}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              Sync Players
            </button>
          </div>

          {syncState.tag === 'running' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
              Syncing {syncState.op}…
            </div>
          )}
          {syncState.tag === 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--accent-win)', fontFamily: 'var(--font-mono)' }}>
              <CheckCircle size={14} />
              {syncState.result}
            </div>
          )}
          {syncState.tag === 'failed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--accent-loss)', fontFamily: 'var(--font-mono)' }}>
              <XCircle size={14} />
              {syncState.op} failed: {syncState.message}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function TeamFormWidget({ team, analysis }: { team: TeamProfile; analysis: TeamAnalysis | null }) {
  const totalMatches = analysis ? analysis.teamWins + analysis.teamLosses : 0;
  const wr = totalMatches > 0 ? Math.round((analysis!.teamWins / totalMatches) * 100) : null;
  const last5 = analysis
    ? [...analysis.teamMatches]
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 5)
    : [];
  const recentWins = last5.filter((m) => m.won).length;
  const trend = last5.length >= 3
    ? recentWins >= last5.length * 0.6 ? 'hot' : recentWins <= last5.length * 0.3 ? 'cold' : 'neutral'
    : 'neutral';

  return (
    <div className="glass-card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--accent-teal-bright)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
        <Users size={16} style={{ color: 'var(--accent-teal-bright)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-teal-bright)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.1rem' }}>Our Team</div>
        </div>
        {wr !== null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 700, color: wr >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{wr}%</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{totalMatches}g WR</div>
          </div>
        )}
        {!analysis && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading...</div>}
      </div>

      {last5.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {last5.map((m, i) => (
              <div key={i} style={{ width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.won ? 'var(--accent-win)' : m.won === false ? 'var(--accent-loss)' : 'var(--bg-dark)', opacity: m.won !== null ? 0.85 : 0.4 }}>
                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#000', fontFamily: 'var(--font-mono)' }}>{m.won ? 'W' : m.won === false ? 'L' : '?'}</span>
              </div>
            ))}
          </div>
          {trend !== 'neutral' && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: trend === 'hot' ? 'var(--accent-win)' : 'var(--accent-loss)', background: trend === 'hot' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${trend === 'hot' ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`, borderRadius: '999px', padding: '0.1rem 0.45rem' }}>
              {trend === 'hot' ? '🔥 On fire' : '❄ Cold streak'}
            </span>
          )}
        </div>
      )}

      <Link
        to={`/analysis/teams?team=${team.id}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-teal-bright)', textDecoration: 'none' }}
      >
        View full analysis <ArrowRight size={12} />
      </Link>
    </div>
  );
}

// ── Focus of the Day ──────────────────────────────────────────────────────────

type FocusState = 'idle' | 'streaming' | 'done' | 'error';
type FeedbackState = 'none' | 'positive' | 'negative';

function FocusOfTheDay({ teamId }: { teamId: string }) {
  const { internalAuthenticated } = useAuth();
  const [state, setState] = useState<FocusState>('idle');
  const [text, setText] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const [correction, setCorrection] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    if (!internalAuthenticated) return;
    setState('streaming');
    setText('');
    setAnalysisId(null);
    setFeedback('none');
    setCorrection('');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(apiClient.analyst.summaryUrl(teamId), {
        credentials: 'include',
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        setState('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let savedId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as { delta?: string; done?: boolean; id?: string; error?: string };
            if (payload.error) { setState('error'); return; }
            if (payload.delta) setText((t) => t + payload.delta);
            if (payload.id) savedId = payload.id;
            if (payload.done) { setAnalysisId(savedId); setState('done'); }
          } catch { /* ignore parse errors */ }
        }
      }
      setState('done');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setState('error');
    }
  }

  async function handleFeedback(value: 'positive' | 'negative') {
    if (!analysisId || feedback !== 'none') return;
    if (value === 'positive') {
      setFeedback('positive');
      await apiClient.analyst.saveFeedback(analysisId, 'positive').catch(() => null);
      toast.success('Feedback guardado — gracias');
    } else {
      setFeedback('negative');
    }
  }

  async function handleSendCorrection() {
    if (!analysisId || !correction.trim()) return;
    setSendingFeedback(true);
    await apiClient.analyst.saveFeedback(analysisId, 'negative', correction.trim()).catch(() => null);
    setSendingFeedback(false);
    setFeedback('positive');
    toast.success('Corrección guardada — nos ayudas a mejorar');
  }

  if (!internalAuthenticated) return null;

  return (
    <div className="glass-card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--accent-violet)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <Sparkles size={15} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Focus of the Day</span>
        {state === 'idle' && (
          <button onClick={() => void generate()} className="btn-secondary" style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '0.25rem 0.65rem', flex: 'unset' }}>
            Analizar
          </button>
        )}
        {state === 'streaming' && (
          <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> Generando...
          </span>
        )}
        {state === 'done' && (
          <button onClick={() => void generate()} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '0.2rem' }}>
            <RefreshCw size={13} />
          </button>
        )}
      </div>

      {state === 'idle' && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
          Análisis prescriptivo generado por IA a partir de los indicadores del equipo.
        </p>
      )}

      {(state === 'streaming' || state === 'done') && text && (
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {text}
          {state === 'streaming' && <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--accent-violet)', marginLeft: 2, animation: 'ledPulse 0.8s ease-in-out infinite', verticalAlign: 'text-bottom', borderRadius: 2 }} />}
        </div>
      )}

      {state === 'error' && (
        <p style={{ color: 'var(--accent-loss)', fontSize: '0.8rem', margin: 0 }}>
          Análisis no disponible. Verifica la configuración del LLM o inténtalo de nuevo.
        </p>
      )}

      {state === 'done' && feedback === 'none' && analysisId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>¿Te ha sido útil?</span>
          <button onClick={() => void handleFeedback('positive')} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            <ThumbsUp size={12} /> Sí
          </button>
          <button onClick={() => void handleFeedback('negative')} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            <ThumbsDown size={12} /> Mejorable
          </button>
        </div>
      )}

      {state === 'done' && feedback === 'negative' && (
        <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>¿Cómo debería haber respondido? (opcional — mejora el modelo)</span>
          <textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="Escribe la respuesta correcta..."
            rows={3}
            style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.8rem', padding: '0.5rem 0.75rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => void handleSendCorrection()} disabled={sendingFeedback || !correction.trim()} className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 'unset' }}>
              <Send size={12} /> {sendingFeedback ? 'Enviando...' : 'Enviar corrección'}
            </button>
            <button onClick={() => setFeedback('positive')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
              Omitir
            </button>
          </div>
        </div>
      )}

      {feedback === 'positive' && state === 'done' && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)', fontSize: '0.68rem', color: 'var(--accent-win)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <CheckCircle size={11} /> Feedback guardado
        </div>
      )}
    </div>
  );
}

// ── Player Sync Widget ────────────────────────────────────────────────────────

function PlayerSyncWidget() {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const hasLinkedPlayer = user?.memberships.some((m) => m.playerId !== null) ?? false;
  if (!hasLinkedPlayer) return null;

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  async function handleSync() {
    setState('syncing');
    try {
      const res = await apiClient.sync.myMatches();
      setMessage(res.message);
      setState('done');
      setTimeout(() => setState('idle'), 4000);
    } catch (err) {
      if (err instanceof ApiErrorResponse && err.status === 429) {
        const seconds = (err.error as { retryAfterSeconds?: number }).retryAfterSeconds ?? 300;
        setCooldownSeconds(seconds);
        setState('idle');
        toast.error(`Demasiadas peticiones — espera ${Math.ceil(seconds / 60)} min`);
      } else {
        const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error al sincronizar';
        setMessage(msg);
        setState('error');
        setTimeout(() => setState('idle'), 4000);
      }
    }
  }

  const isDisabled = state === 'syncing' || cooldownSeconds > 0;

  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
      <Download size={16} style={{ color: 'var(--accent-teal-bright)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Mis partidas</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
          {state === 'done' && <span style={{ color: 'var(--accent-win)' }}>{message}</span>}
          {state === 'error' && <span style={{ color: 'var(--accent-loss)' }}>{message}</span>}
          {cooldownSeconds > 0 && <span>Disponible en {cooldownSeconds}s</span>}
          {state === 'idle' && cooldownSeconds === 0 && 'Sincroniza tus últimas partidas desde pred.gg'}
        </div>
      </div>
      <button
        onClick={() => void handleSync()}
        disabled={isDisabled}
        className="btn-primary"
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.9rem', flex: 'unset', opacity: isDisabled ? 0.6 : 1 }}
      >
        <RefreshCw size={13} style={{ animation: state === 'syncing' ? 'spin 0.8s linear infinite' : 'none' }} />
        {state === 'syncing' ? 'Sincronizando...' : 'Actualizar'}
      </button>
    </div>
  );
}
