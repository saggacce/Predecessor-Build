import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle, Calendar, Target, Sparkles, X, Maximize2, Minimize2,
  ThumbsUp, ThumbsDown, CheckCircle, LayoutDashboard, PenLine, Users,
  CalendarDays, Menu,
} from 'lucide-react';
import {
  apiClient, type Insight, type ScrimScheduleItem, type TeamGoal,
  type TeamProfile, type PlayerAnalysisStat,
} from '../api/client';
import { useAuth } from '../hooks/useAuth';
import TacticalBoardCanvas from '../components/TacticalBoardCanvas';

// ── Types ────────────────────────────────────────────────────────────────────

type SessionTab = 'overview' | 'tactical' | 'roster' | 'schedule';
type FocusState = 'idle' | 'streaming' | 'done' | 'error';
type FeedbackState = 'none' | 'positive' | 'negative';

// ── Constants ─────────────────────────────────────────────────────────────────

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
const ROLE_COLOR: Record<string, string> = {
  CARRY: 'var(--accent-prime)',
  JUNGLE: 'var(--accent-win)',
  MIDLANE: 'var(--accent-blue)',
  OFFLANE: 'var(--accent-loss)',
  SUPPORT: 'var(--accent-violet)',
};
const ROLE_LABEL: Record<string, string> = {
  CARRY: 'Carry', JUNGLE: 'Jungle', MIDLANE: 'Mid', OFFLANE: 'Offlane', SUPPORT: 'Support',
};
const ROLE_ICON: Record<string, string> = {
  CARRY: '/icons/roles/carry.png',
  JUNGLE: '/icons/roles/jungle.png',
  MIDLANE: '/icons/roles/midlane.png',
  OFFLANE: '/icons/roles/offlane.png',
  SUPPORT: '/icons/roles/support.png',
};
const SESSION_TABS: Array<{ id: SessionTab; label: string; Icon: React.FC<{ size?: number }> }> = [
  { id: 'overview',  label: 'Vista general',   Icon: LayoutDashboard },
  { id: 'tactical',  label: 'Tablero táctico', Icon: PenLine },
  { id: 'roster',    label: 'Roster',          Icon: Users },
  { id: 'schedule',  label: 'Calendario',      Icon: CalendarDays },
];

// ── TacticalBoard wrapper for Session Mode ────────────────────────────────────

function TacticalBoard({ teamId }: { teamId: string }) {
  return (
    <TacticalBoardCanvas
      teamId={teamId}
      compact
      style={{ flex: 1, minHeight: 0 }}
    />
  );
}

// ── RosterPanel ───────────────────────────────────────────────────────────────

import type { RosterMember } from '../api/client';

const STATUS_LABEL: Record<string, string> = {
  STARTER: 'Titular', BENCH: 'Suplente', TRIAL: 'A prueba', INACTIVE: 'Inactivo',
};

interface TooltipState {
  member: RosterMember;
  stats: PlayerAnalysisStat | null;
  x: number;
  y: number;
}

function StatRow({ label, value, mono = true, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color ?? 'var(--text-secondary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

function RosterTooltip({ member, stats, x, y }: TooltipState) {
  const role = (member.role ?? '').toUpperCase();
  const roleColor = ROLE_COLOR[role] ?? 'var(--text-muted)';
  const name = member.customName ?? member.displayName;

  const tipW = 260;
  const left = Math.min(x + 16, window.innerWidth - tipW - 12);
  const top  = Math.min(y - 8, window.innerHeight - 320);

  const wrColor = stats
    ? stats.winRate >= 55 ? 'var(--accent-win)' : stats.winRate < 45 ? 'var(--accent-loss)' : 'var(--text-secondary)'
    : undefined;
  const recentTotal = stats ? (stats.recentWins + stats.recentLosses) : 0;

  return (
    <div style={{
      position: 'fixed', left, top, width: tipW, zIndex: 200,
      background: '#0f1623',
      border: `1px solid ${roleColor}44`,
      borderLeft: `3px solid ${roleColor}`,
      borderRadius: 8,
      padding: '0.9rem 1rem',
      boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
      display: 'flex', flexDirection: 'column', gap: '0.4rem',
      pointerEvents: 'none',
    }}>
      {/* Role icon + name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
        {ROLE_ICON[role] && (
          <img src={ROLE_ICON[role]} alt={role} style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.9 }} />
        )}
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {ROLE_LABEL[role] ?? role}
        </span>
      </div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>{name}</div>
      {member.customName && member.customName !== member.displayName && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>IG: {member.displayName}</div>
      )}
      {member.rating?.rankLabel && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {member.rating.rankLabel}{member.rating.ratingPoints != null && ` · ${member.rating.ratingPoints} pts`}
        </div>
      )}

      {stats ? (
        <>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0.25rem 0' }} />
          {/* Core stats */}
          <StatRow label="Partidas" value={String(stats.matches)} />
          <StatRow label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} color={wrColor} />
          <StatRow label="KDA" value={stats.kda.toFixed(2)} color={stats.kda >= 3 ? 'var(--accent-win)' : stats.kda < 2 ? 'var(--accent-loss)' : undefined} />
          {stats.avgGPM != null && <StatRow label="GPM" value={stats.avgGPM.toFixed(0)} />}
          {stats.avgDPM != null && <StatRow label="DPM" value={stats.avgDPM.toFixed(0)} />}

          {/* Recent form */}
          {recentTotal > 0 && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0.15rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Forma reciente</span>
                <span style={{ fontFamily: 'var(--font-mono)', display: 'flex', gap: '0.25rem' }}>
                  <span style={{ color: 'var(--accent-win)', fontWeight: 700 }}>{stats.recentWins}V</span>
                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                  <span style={{ color: 'var(--accent-loss)', fontWeight: 700 }}>{stats.recentLosses}D</span>
                </span>
              </div>
            </>
          )}

          {/* Top hero */}
          {stats.topHeroes.length > 0 && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0.15rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Hero principal</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {stats.topHeroes[0].name}
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
                    {' '}· {stats.topHeroes[0].winRate.toFixed(0)}% WR
                  </span>
                </span>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0.25rem 0' }} />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin estadísticas disponibles</div>
        </>
      )}
    </div>
  );
}

function RosterSection({
  title, members, statsMap, onHover, onLeave,
}: {
  title: string;
  members: RosterMember[];
  statsMap: Map<string, PlayerAnalysisStat>;
  onHover: (m: RosterMember, s: PlayerAnalysisStat | null, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  if (members.length === 0) return null;
  return (
    <div>
      <div style={{
        fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.12em',
        marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        {title}
        <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.6, fontWeight: 400 }}>{members.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {members.map((m) => {
          const role = (m.role ?? '').toUpperCase();
          const roleColor = ROLE_COLOR[role] ?? 'var(--text-muted)';
          const roleIcon = ROLE_ICON[role];
          const name = m.customName ?? m.displayName;
          const stat = statsMap.get(m.playerId) ?? null;
          const wrColor = stat
            ? stat.winRate >= 55 ? 'var(--accent-win)' : stat.winRate < 45 ? 'var(--accent-loss)' : 'var(--text-muted)'
            : 'var(--text-muted)';
          return (
            <div
              key={m.rosterId}
              className="glass-card"
              onMouseEnter={(e) => onHover(m, stat, e)}
              onMouseMove={(e) => onHover(m, stat, e)}
              onMouseLeave={onLeave}
              style={{
                padding: '1rem 1.25rem',
                borderLeft: `3px solid ${roleColor}`,
                display: 'flex', flexDirection: 'column', gap: '0.4rem',
                cursor: 'default',
              }}
            >
              {/* Role + icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {roleIcon && (
                  <img src={roleIcon} alt={role} style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0, opacity: 0.9 }} />
                )}
                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {(ROLE_LABEL[role] ?? role) || 'Sin rol'}
                </span>
              </div>
              {/* Name */}
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Sin nombre</span>}
              </div>
              {/* Quick stats */}
              {stat ? (
                <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
                  <span style={{ color: wrColor }}>{stat.winRate.toFixed(0)}% WR</span>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <span style={{ color: 'var(--text-muted)' }}>{stat.kda.toFixed(1)} KDA</span>
                </div>
              ) : m.rating?.rankLabel ? (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {m.rating.rankLabel}
                </div>
              ) : (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.4, fontStyle: 'italic' }}>Sin datos</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RosterPanel({ teamId }: { teamId: string }) {
  const [profile, setProfile]   = useState<TeamProfile | null>(null);
  const [statsMap, setStatsMap] = useState<Map<string, PlayerAnalysisStat>>(new Map());
  const [loading, setLoading]   = useState(true);
  const [tooltip, setTooltip]   = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    Promise.all([
      apiClient.teams.getProfile(teamId).catch(() => null),
      apiClient.teams.getAnalysis(teamId).catch(() => null),
    ]).then(([prof, analysis]) => {
      setProfile(prof);
      const map = new Map<string, PlayerAnalysisStat>();
      for (const s of analysis?.playerStats ?? []) map.set(s.playerId, s);
      setStatsMap(map);
    }).finally(() => setLoading(false));
  }, [teamId]);

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Cargando roster…
    </div>
  );

  const ORDER = ['CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE', 'SUPPORT'];
  const allActive = (profile?.roster ?? [])
    .filter((m) => !m.activeTo)
    .sort((a, b) => {
      const ia = ORDER.indexOf((a.role ?? '').toUpperCase());
      const ib = ORDER.indexOf((b.role ?? '').toUpperCase());
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  const starters = allActive.filter((m) => (m.rosterStatus ?? '').toUpperCase() === 'STARTER');
  const bench    = allActive.filter((m) => (m.rosterStatus ?? '').toUpperCase() !== 'STARTER');

  if (allActive.length === 0) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
      No hay jugadores activos en el roster.
    </div>
  );

  const handleHover = (m: RosterMember, s: PlayerAnalysisStat | null, e: React.MouseEvent) =>
    setTooltip({ member: m, stats: s, x: e.clientX, y: e.clientY });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 1280, margin: '0 auto' }}>
        <RosterSection title="Titulares" members={starters} statsMap={statsMap} onHover={handleHover} onLeave={() => setTooltip(null)} />
        <RosterSection title="Suplentes" members={bench}    statsMap={statsMap} onHover={handleHover} onLeave={() => setTooltip(null)} />
      </div>
      {tooltip && <RosterTooltip {...tooltip} />}
    </div>
  );
}

// ── SchedulePanel ─────────────────────────────────────────────────────────────

function SchedulePanel({ items }: { items: ScrimScheduleItem[] }) {
  const sorted = [...items].sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const now = new Date();

  if (sorted.length === 0) return (
    <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
      No hay partidos en el calendario.
    </div>
  );

  const typeLabel = (t: string) =>
    t === 'OFFICIAL' ? 'Partido oficial' : t === 'PRACTICE' ? 'Entrenamiento' : 'Scrim';
  const typeColor = (t: string) =>
    t === 'OFFICIAL' ? 'var(--accent-loss)' : t === 'PRACTICE' ? 'var(--text-muted)' : 'var(--accent-blue)';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxWidth: 900, margin: '0 auto' }}>
        {sorted.map((s) => {
          const isPast = new Date(s.scheduledAt) < now;
          return (
            <div key={s.id} className="glass-card" style={{
              padding: '1rem 1.5rem',
              display: 'flex', alignItems: 'center', gap: '1.25rem',
              opacity: isPast ? 0.5 : 1,
              borderLeft: `3px solid ${typeColor(s.type)}`,
            }}>
              <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 52 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800, color: isPast ? 'var(--text-muted)' : 'var(--text-primary)', lineHeight: 1 }}>
                  {new Date(s.scheduledAt).toLocaleString(undefined, { day: 'numeric' })}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {new Date(s.scheduledAt).toLocaleString(undefined, { month: 'short' })}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  vs {s.rivalTeam?.name ?? s.rivalName ?? 'Rival por confirmar'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem', fontFamily: 'var(--font-mono)' }}>
                  {new Date(s.scheduledAt).toLocaleString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                  {s.notes && ` · ${s.notes}`}
                </div>
              </div>
              <span style={{
                fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                color: typeColor(s.type), border: `1px solid ${typeColor(s.type)}44`,
                borderRadius: 3, padding: '2px 7px', flexShrink: 0,
              }}>
                {typeLabel(s.type)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SessionMode (main) ────────────────────────────────────────────────────────

export default function SessionMode() {
  const { user, internalLoading } = useAuth();
  const navigate = useNavigate();

  const [allTeams, setAllTeams]   = useState<Array<{ id: string; name: string }>>([]);
  const [teamId, setTeamId]       = useState('');
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const [insights, setInsights]   = useState<Insight[]>([]);
  const [schedule, setSchedule]   = useState<ScrimScheduleItem[]>([]);
  const [goals, setGoals]         = useState<TeamGoal[]>([]);
  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(null);
  const [loading, setLoading]     = useState(true);

  const [activeTab, setActiveTab] = useState<SessionTab>('overview');
  const [showNav, setShowNav]     = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow]             = useState(new Date());
  const [focusState, setFocusState] = useState<FocusState>('idle');
  const [output, setOutput]       = useState('');
  const [feedback, setFeedback]   = useState<FeedbackState>('none');
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

  // Fetch teams — wait for auth
  useEffect(() => {
    if (internalLoading || !user) return;
    const isAdmin = user.globalRole === 'PLATFORM_ADMIN';
    const staffIds = new Set(
      user.memberships
        .filter((m) => m.role === 'COACH' || m.role === 'MANAGER')
        .map((m) => m.teamId),
    );
    apiClient.teams.list('OWN')
      .then((r) => {
        const teams = r.teams ?? [];
        const filtered = isAdmin ? teams : teams.filter((t) => staffIds.has(t.id));
        setAllTeams(filtered);
        if (filtered.length > 0) {
          setTeamId(filtered[0].id);
        } else {
          setTeamsError(
            teams.length === 0
              ? 'No se encontraron equipos de tipo OWN.'
              : 'Ningún equipo OWN coincide con tus membresías de staff.',
          );
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[SessionMode] teams.list error:', err);
        setTeamsError(`Error al cargar equipos: ${String(err)}`);
        setLoading(false);
      });
  }, [internalLoading]);

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
      setInsights(ins.insights.filter((i) => i.severity === 'critical' || i.severity === 'high').slice(0, 3));
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
    setOutput(''); setFocusState('streaming'); setFeedback('none');
    esRef.current?.close();
    const es = new EventSource(`${apiClient.analyst.summaryUrl(teamId)}?lang=es`, { withCredentials: true });
    esRef.current = es;
    es.onmessage = (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data as string) as { delta?: string; done?: boolean; error?: string };
        if (d.delta) setOutput((p) => p + d.delta);
        if (d.done)  { setFocusState('done');  es.close(); }
        if (d.error) { setFocusState('error'); es.close(); }
      } catch { /* ignore */ }
    };
    es.onerror = () => { setFocusState('error'); es.close(); };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const scrimTypeLabel = (t: string) =>
    t === 'OFFICIAL' ? 'Partido oficial' : t === 'PRACTICE' ? 'Entrenamiento' : 'Scrim';
  const scrimTypeColor = (t: string) =>
    t === 'OFFICIAL' ? 'var(--accent-loss)' : t === 'PRACTICE' ? 'var(--text-muted)' : 'var(--accent-blue)';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-dark)', zIndex: 100,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)',
        flexShrink: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
      }}>
        {/* Nav toggle */}
        <button
          onClick={() => setShowNav((v) => !v)}
          title={showNav ? 'Ocultar navegación' : 'Mostrar navegación'}
          style={{
            background: showNav ? 'rgba(107,170,248,0.12)' : 'transparent',
            border: `1px solid ${showNav ? 'var(--accent-blue)' : 'var(--border-color)'}`,
            borderRadius: 5, cursor: 'pointer',
            color: showNav ? 'var(--accent-blue)' : 'var(--text-muted)',
            padding: '5px 8px', display: 'flex', alignItems: 'center',
          }}
        >
          <Menu size={14} />
        </button>

        {/* Team selector */}
        {allTeams.length > 1 ? (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            style={{
              fontSize: '0.92rem', fontWeight: 700, background: 'transparent',
              border: 'none', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
            }}
          >
            {allTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : (
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
            {teamName}
          </span>
        )}

        <div style={{
          fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em',
          color: 'var(--accent-violet)', background: 'rgba(167,139,250,0.12)',
          border: '1px solid rgba(167,139,250,0.25)', borderRadius: 4, padding: '2px 8px',
        }}>
          MODO SESIÓN
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: 'var(--text-secondary)', minWidth: 48, textAlign: 'right' }}>
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)', padding: '5px 8px', display: 'flex', alignItems: 'center' }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={() => { esRef.current?.close(); navigate(-1); }}
            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}
          >
            <X size={13} /> Salir
          </button>
        </div>
      </div>

      {/* ── Tab bar (collapsible) ─────────────────────────────────────────────── */}
      {showNav && (
        <div style={{
          display: 'flex', gap: '0.25rem', padding: '0.5rem 1.25rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.2)', flexShrink: 0,
        }}>
          {SESSION_TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                  padding: '0.45rem 1rem', borderRadius: 6, cursor: 'pointer',
                  background: active ? 'rgba(107,170,248,0.15)' : 'transparent',
                  border: `1px solid ${active ? 'var(--accent-blue)' : 'transparent'}`,
                  color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
                  fontSize: '0.8rem', fontWeight: active ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Cargando sesión…
        </div>
      ) : !teamId ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', padding: '2rem' }}>
          <span>No hay equipos asignados a tu cuenta.</span>
          {teamsError && (
            <code style={{ fontSize: '0.72rem', color: 'var(--accent-prime)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 4, padding: '0.4rem 0.75rem', maxWidth: 500, textAlign: 'center' }}>
              {teamsError}
            </code>
          )}
        </div>

      ) : activeTab === 'tactical' ? (
        <TacticalBoard teamId={teamId} />

      ) : activeTab === 'roster' ? (
        <RosterPanel teamId={teamId} />

      ) : activeTab === 'schedule' ? (
        <SchedulePanel items={schedule} />

      ) : (
        /* overview */
        <div style={{
          flex: 1, padding: '1.25rem', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '1rem',
          maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        }}>
          {/* Row 1 — Próximo partido + Alertas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {/* Próximo partido */}
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-blue)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Calendar size={13} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Próximo partido</span>
              </div>
              {nextScrim ? (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.75rem' }}>
                    vs {nextScrim.rivalTeam?.name ?? nextScrim.rivalName ?? 'Rival por confirmar'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      {new Date(nextScrim.scheduledAt).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: scrimTypeColor(nextScrim.type), border: `1px solid ${scrimTypeColor(nextScrim.type)}44`, borderRadius: 3, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {scrimTypeLabel(nextScrim.type)}
                    </span>
                  </div>
                  {nextScrim.notes && <div style={{ marginTop: '0.65rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{nextScrim.notes}</div>}
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay partidos programados</div>
              )}
            </div>

            {/* Alertas del equipo */}
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-prime)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <AlertTriangle size={13} style={{ color: 'var(--accent-prime)' }} />
                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Alertas del equipo</span>
                {insights.length > 0 && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>top {insights.length}</span>}
              </div>
              {insights.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-win)', fontSize: '0.88rem' }}>
                  <CheckCircle size={16} /> Sin alertas críticas — buen momento para practicar
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {insights.map((ins) => (
                    <div key={ins.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <span style={{ flexShrink: 0, fontSize: '0.58rem', fontWeight: 800, padding: '3px 7px', borderRadius: 3, background: SEVERITY_BG[ins.severity] ?? 'rgba(255,255,255,0.05)', color: SEVERITY_COLOR[ins.severity] ?? 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                        {ins.severity}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{ins.title}</div>
                        {ins.evidence && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{ins.evidence}</div>}
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
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>Focus of the Day</span>
              {llmEnabled ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {focusState === 'done' && (
                    <>
                      <button onClick={() => setFeedback('positive')} title="Útil" style={{ background: 'none', border: 'none', cursor: 'pointer', color: feedback === 'positive' ? 'var(--accent-win)' : 'var(--text-muted)', padding: 0 }}><ThumbsUp size={14} /></button>
                      <button onClick={() => setFeedback('negative')} title="No útil" style={{ background: 'none', border: 'none', cursor: 'pointer', color: feedback === 'negative' ? 'var(--accent-loss)' : 'var(--text-muted)', padding: 0 }}><ThumbsDown size={14} /></button>
                    </>
                  )}
                  <button onClick={startStream} disabled={focusState === 'streaming'} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem' }}>
                    {focusState === 'streaming' ? 'Analizando…' : focusState === 'done' ? 'Regenerar' : 'Generar análisis'}
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {llmEnabled === null ? '' : 'No activado — configura en Platform Admin'}
                </span>
              )}
            </div>
            {output && <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{output}</pre>}
            {llmEnabled && focusState === 'idle' && !output && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>Genera un análisis táctico prescriptivo basado en los insights actuales del equipo.</p>}
            {focusState === 'error' && <p style={{ color: 'var(--accent-loss)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>No se pudo generar el análisis. Inténtalo de nuevo.</p>}
          </div>

          {/* Row 3 — Objetivos del equipo */}
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-teal-bright)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Target size={13} style={{ color: 'var(--accent-teal-bright)' }} />
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Objetivos del equipo</span>
              {goals.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{goals.length} activo{goals.length !== 1 ? 's' : ''}</span>}
            </div>
            {goals.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No hay objetivos activos para este equipo.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {goals.map((g) => {
                  const pct = g.targetValue && g.currentValue != null ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : null;
                  const achieved = pct !== null && pct >= 100;
                  return (
                    <div key={g.id} style={{ padding: '0.85rem 1rem', background: achieved ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.03)', borderRadius: 6, border: `1px solid ${achieved ? 'rgba(74,222,128,0.25)' : 'var(--border-color)'}` }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: achieved ? 'var(--accent-win)' : 'var(--text-primary)', marginBottom: g.description ? '0.25rem' : 0 }}>
                        {achieved ? '✓ ' : ''}{g.title}
                      </div>
                      {g.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: pct !== null ? '0.5rem' : 0 }}>{g.description}</div>}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
