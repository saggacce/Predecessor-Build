import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle, Calendar, Target, Sparkles, X, Maximize2, Minimize2,
  ThumbsUp, ThumbsDown, CheckCircle,
} from 'lucide-react';
import { apiClient, type Insight, type ScrimScheduleItem, type TeamGoal } from '../api/client';
import { useAuth } from '../hooks/useAuth';

type FocusState = 'idle' | 'streaming' | 'done' | 'error';
type FeedbackState = 'none' | 'positive' | 'negative';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--accent-loss)',
  high: 'var(--accent-prime)',
  medium: 'var(--accent-blue)',
  low: 'var(--text-muted)',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'rgba(248,113,113,0.14)',
  high: 'rgba(251,191,36,0.12)',
  medium: 'rgba(91,156,246,0.12)',
  low: 'rgba(255,255,255,0.05)',
};

export default function SessionMode() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const staffTeams = (user?.memberships ?? [])
    .filter((m) => m.role === 'COACH' || m.role === 'MANAGER')
    .map((m) => m.team);
  const isPlatformAdmin = user?.globalRole === 'PLATFORM_ADMIN';

  const [allTeams, setAllTeams] = useState(staffTeams);
  const [teamId, setTeamId] = useState(staffTeams[0]?.id ?? '');

  const [insights, setInsights] = useState<Insight[]>([]);
  const [schedule, setSchedule] = useState<ScrimScheduleItem[]>([]);
  const [goals, setGoals] = useState<TeamGoal[]>([]);
  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [focusState, setFocusState] = useState<FocusState>('idle');
  const [output, setOutput] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const esRef = useRef<EventSource | null>(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const onFsc = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsc);
    return () => document.removeEventListener('fullscreenchange', onFsc);
  }, []);

  // Platform admin: fetch all own teams if no staff memberships
  useEffect(() => {
    if (isPlatformAdmin && staffTeams.length === 0) {
      apiClient.teams.list('OWN')
        .then((r) => {
          setAllTeams(r.teams ?? []);
          if (r.teams?.length) setTeamId(r.teams[0].id);
        })
        .catch(() => null);
    }
  }, [isPlatformAdmin]);

  // Load session data when teamId changes
  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    esRef.current?.close();
    setFocusState('idle');
    setOutput('');
    setFeedback('none');

    Promise.all([
      apiClient.analyst.insights(teamId, 'es').catch(() => ({ insights: [] as Insight[] })),
      apiClient.schedule.list(teamId).catch(() => ({ items: [] as ScrimScheduleItem[] })),
      apiClient.goals.listTeam(teamId).catch(() => ({ goals: [] as TeamGoal[] })),
      apiClient.analyst.llmStatus().catch(() => ({ enabled: false })),
    ]).then(([ins, sched, g, llm]) => {
      setInsights(
        ins.insights
          .filter((i) => i.severity === 'critical' || i.severity === 'high')
          .slice(0, 3),
      );
      setSchedule(sched.items);
      setGoals(g.goals.filter((g) => g.status === 'ACTIVE'));
      setLlmEnabled(llm.enabled);
    }).finally(() => setLoading(false));

    return () => { esRef.current?.close(); };
  }, [teamId]);

  const nextScrim = schedule
    .filter((s) => new Date(s.scheduledAt) >= new Date())
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))[0] ?? null;

  const teamName = allTeams.find((t) => t.id === teamId)?.name ?? '';

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => null);
    } else {
      document.exitFullscreen().catch(() => null);
    }
  }

  function startStream() {
    if (focusState === 'streaming') return;
    setOutput('');
    setFocusState('streaming');
    setFeedback('none');
    esRef.current?.close();

    const url = `${apiClient.analyst.summaryUrl(teamId)}?lang=es`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as { delta?: string; done?: boolean; error?: string };
        if (data.delta) setOutput((p) => p + data.delta);
        if (data.done) { setFocusState('done'); es.close(); }
        if (data.error) { setFocusState('error'); es.close(); }
      } catch { /* ignore */ }
    };
    es.onerror = () => { setFocusState('error'); es.close(); };
  }

  const scrimTypeLabel = (type: string) =>
    type === 'OFFICIAL' ? 'Partido oficial' : type === 'PRACTICE' ? 'Entrenamiento' : 'Scrim';
  const scrimTypeColor = (type: string) =>
    type === 'OFFICIAL' ? 'var(--accent-loss)' : type === 'PRACTICE' ? 'var(--text-muted)' : 'var(--accent-blue)';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-dark)', zIndex: 100,
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.85rem 1.5rem', borderBottom: '1px solid var(--border-color)',
        flexShrink: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
      }}>
        {allTeams.length > 1 ? (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            style={{
              fontSize: '0.95rem', fontWeight: 700, background: 'transparent',
              border: 'none', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
            }}
          >
            {allTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : (
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {teamName}
          </span>
        )}

        <div style={{
          fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em',
          color: 'var(--accent-violet)', background: 'rgba(167,139,250,0.12)',
          border: '1px solid rgba(167,139,250,0.25)', borderRadius: 4, padding: '2px 8px',
        }}>
          MODO SESIÓN
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--text-secondary)', minWidth: 50, textAlign: 'right' }}>
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)', padding: '5px 8px', display: 'flex', alignItems: 'center' }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            onClick={() => { esRef.current?.close(); navigate(-1); }}
            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}
          >
            <X size={13} /> Salir
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Cargando sesión…
        </div>
      ) : !teamId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No hay equipos asignados a tu cuenta.
        </div>
      ) : (
        <div style={{
          flex: 1, padding: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1.25rem',
          maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        }}>

          {/* Row 1 — Próximo partido + Alertas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>

            {/* Próximo partido */}
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-blue)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem' }}>
                <Calendar size={13} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Próximo partido</span>
              </div>

              {nextScrim ? (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.85rem' }}>
                    vs {nextScrim.rivalTeam?.name ?? nextScrim.rivalName ?? 'Rival por confirmar'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {new Date(nextScrim.scheduledAt).toLocaleString(undefined, {
                        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 800,
                      color: scrimTypeColor(nextScrim.type),
                      border: `1px solid ${scrimTypeColor(nextScrim.type)}44`,
                      borderRadius: 3, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {scrimTypeLabel(nextScrim.type)}
                    </span>
                  </div>
                  {nextScrim.notes && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {nextScrim.notes}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No hay partidos programados
                </div>
              )}
            </div>

            {/* Alertas del equipo */}
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-prime)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem' }}>
                <AlertTriangle size={13} style={{ color: 'var(--accent-prime)' }} />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Alertas del equipo</span>
                {insights.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    top {insights.length}
                  </span>
                )}
              </div>

              {insights.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-win)', fontSize: '0.88rem' }}>
                  <CheckCircle size={16} /> Sin alertas críticas — buen momento para practicar
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {insights.map((ins) => (
                    <div key={ins.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <span style={{
                        flexShrink: 0, fontSize: '0.58rem', fontWeight: 800,
                        padding: '3px 7px', borderRadius: 3,
                        background: SEVERITY_BG[ins.severity] ?? 'rgba(255,255,255,0.05)',
                        color: SEVERITY_COLOR[ins.severity] ?? 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2,
                      }}>
                        {ins.severity}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{ins.title}</div>
                        {ins.evidence && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{ins.evidence}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2 — Focus of the Day */}
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-violet)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: output ? '1rem' : 0 }}>
              <Sparkles size={13} style={{ color: 'var(--accent-violet)' }} />
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
                Focus of the Day
              </span>

              {llmEnabled ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {focusState === 'done' && (
                    <>
                      <button
                        onClick={() => setFeedback('positive')}
                        title="Útil"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: feedback === 'positive' ? 'var(--accent-win)' : 'var(--text-muted)', padding: 0 }}
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <button
                        onClick={() => setFeedback('negative')}
                        title="No útil"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: feedback === 'negative' ? 'var(--accent-loss)' : 'var(--text-muted)', padding: 0 }}
                      >
                        <ThumbsDown size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={startStream}
                    disabled={focusState === 'streaming'}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem' }}
                  >
                    {focusState === 'streaming' ? 'Analizando…' : focusState === 'done' ? 'Regenerar' : 'Generar análisis'}
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {llmEnabled === null ? '' : 'No activado — configura en Platform Admin'}
                </span>
              )}
            </div>

            {output && (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                {output}
              </pre>
            )}
            {llmEnabled && focusState === 'idle' && !output && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>
                Genera un análisis táctico prescriptivo basado en los insights actuales del equipo.
              </p>
            )}
            {focusState === 'error' && (
              <p style={{ color: 'var(--accent-loss)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>
                No se pudo generar el análisis. Inténtalo de nuevo.
              </p>
            )}
          </div>

          {/* Row 3 — Objetivos del equipo */}
          {goals.length > 0 && (
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-teal-bright)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem' }}>
                <Target size={13} style={{ color: 'var(--accent-teal-bright)' }} />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Objetivos del equipo
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {goals.length} activo{goals.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {goals.map((g) => {
                  const pct = g.targetValue && g.currentValue != null
                    ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100))
                    : null;
                  const achieved = pct !== null && pct >= 100;

                  return (
                    <div key={g.id} style={{
                      padding: '0.85rem 1rem',
                      background: achieved ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.03)',
                      borderRadius: 6,
                      border: `1px solid ${achieved ? 'rgba(74,222,128,0.25)' : 'var(--border-color)'}`,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: achieved ? 'var(--accent-win)' : 'var(--text-primary)', marginBottom: g.description ? '0.25rem' : 0 }}>
                        {achieved ? '✓ ' : ''}{g.title}
                      </div>
                      {g.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: pct !== null ? '0.5rem' : 0 }}>
                          {g.description}
                        </div>
                      )}
                      {pct !== null && (
                        <>
                          <div style={{ height: 5, background: 'var(--border-color)', borderRadius: 3, marginTop: g.description ? 0 : '0.5rem' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: achieved ? 'var(--accent-win)' : 'var(--accent-teal-bright)', borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                            {g.currentValue?.toFixed(1)} / {g.targetValue} · {pct}%
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
