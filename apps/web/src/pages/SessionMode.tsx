import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle, Calendar, Target, Sparkles, X, Maximize2, Minimize2,
  ThumbsUp, ThumbsDown, CheckCircle, LayoutDashboard, PenLine, Users,
  CalendarDays, Menu, Pencil, Minus, ArrowRight, Circle, Square,
  Eraser, Undo2, Trash2,
} from 'lucide-react';
import {
  apiClient, type Insight, type ScrimScheduleItem, type TeamGoal, type TeamProfile,
} from '../api/client';
import { useAuth } from '../hooks/useAuth';

// ── Types ────────────────────────────────────────────────────────────────────

type SessionTab = 'overview' | 'tactical' | 'roster' | 'schedule';
type FocusState = 'idle' | 'streaming' | 'done' | 'error';
type FeedbackState = 'none' | 'positive' | 'negative';
type DrawTool = 'pen' | 'line' | 'arrow' | 'circle' | 'rect' | 'eraser';

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
const DRAW_COLORS = ['#ffffff', '#f87171', '#60a5fa', '#4ade80', '#fbbf24', '#a78bfa', '#fb923c'];
const DRAW_TOOLS: Array<{ id: DrawTool; label: string; Icon: React.FC<{ size?: number }> }> = [
  { id: 'pen',    label: 'Lápiz',       Icon: Pencil },
  { id: 'line',   label: 'Línea',       Icon: Minus },
  { id: 'arrow',  label: 'Flecha',      Icon: ArrowRight },
  { id: 'circle', label: 'Círculo',     Icon: Circle },
  { id: 'rect',   label: 'Rectángulo',  Icon: Square },
  { id: 'eraser', label: 'Borrador',    Icon: Eraser },
];
const STROKE_WIDTHS = [2, 4, 7] as const;
const SESSION_TABS: Array<{ id: SessionTab; label: string; Icon: React.FC<{ size?: number }> }> = [
  { id: 'overview',  label: 'Vista general',   Icon: LayoutDashboard },
  { id: 'tactical',  label: 'Tablero táctico', Icon: PenLine },
  { id: 'roster',    label: 'Roster',          Icon: Users },
  { id: 'schedule',  label: 'Calendario',      Icon: CalendarDays },
];

// ── TacticalBoard ─────────────────────────────────────────────────────────────

function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#080d1a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  const g = 48;
  for (let x = 0; x <= w; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function TacticalBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool]           = useState<DrawTool>('pen');
  const [color, setColor]         = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState<2 | 4 | 7>(3 as 4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canUndo, setCanUndo]     = useState(false);
  const historyRef  = useRef<ImageData[]>([]);
  const startPos    = useRef<{ x: number; y: number } | null>(null);
  const snapRef     = useRef<ImageData | null>(null);

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top)  * (c.height / r.height),
    };
  }

  function initCanvas(w: number, h: number) {
    const c = canvasRef.current!;
    const prev = c.width > 0 && c.height > 0
      ? (() => { const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; t.getContext('2d')!.drawImage(c, 0, 0); return t; })()
      : null;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    drawBg(ctx, w, h);
    if (prev) ctx.drawImage(prev, 0, 0, w, h);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) initCanvas(Math.floor(width), Math.floor(height));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  function saveToHistory() {
    const c = canvasRef.current!;
    const snap = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    historyRef.current = [...historyRef.current.slice(-24), snap];
    setCanUndo(true);
  }

  function undo() {
    if (!historyRef.current.length) return;
    const snap = historyRef.current.at(-1)!;
    historyRef.current = historyRef.current.slice(0, -1);
    canvasRef.current!.getContext('2d')!.putImageData(snap, 0, 0);
    setCanUndo(historyRef.current.length > 0);
  }

  function clearAll() {
    saveToHistory();
    const c = canvasRef.current!;
    drawBg(c.getContext('2d')!, c.width, c.height);
  }

  function applyShape(ctx: CanvasRenderingContext2D, t: DrawTool, s: { x: number; y: number }, e: { x: number; y: number }) {
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (t === 'line') {
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    } else if (t === 'arrow') {
      const dx = e.x - s.x, dy = e.y - s.y;
      const angle = Math.atan2(dy, dx);
      const len = Math.sqrt(dx * dx + dy * dy);
      const h = Math.min(18, len * 0.3);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - h * Math.cos(angle - Math.PI / 6), e.y - h * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - h * Math.cos(angle + Math.PI / 6), e.y - h * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (t === 'circle') {
      const rx = (e.x - s.x) / 2, ry = (e.y - s.y) / 2;
      ctx.beginPath(); ctx.ellipse(s.x + rx, s.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2); ctx.stroke();
    } else if (t === 'rect') {
      ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
    }
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e);
    saveToHistory();
    snapRef.current = canvasRef.current!.getContext('2d')!.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    startPos.current = pos;
    setIsDrawing(true);
    if (tool === 'pen' || tool === 'eraser') {
      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !startPos.current) return;
    const pos = getPos(e);
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    if (tool === 'pen') {
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (tool === 'eraser') {
      ctx.strokeStyle = '#080d1a'; ctx.lineWidth = lineWidth * 5;
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else {
      if (snapRef.current) ctx.putImageData(snapRef.current, 0, 0);
      applyShape(ctx, tool, startPos.current, pos);
    }
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (startPos.current && !['pen', 'eraser'].includes(tool)) {
      const ctx = canvasRef.current!.getContext('2d')!;
      if (snapRef.current) ctx.putImageData(snapRef.current, 0, 0);
      applyShape(ctx, tool, startPos.current, getPos(e));
    }
    startPos.current = null; snapRef.current = null;
  }

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
      {/* Tool palette */}
      <div style={{
        width: 56, display: 'flex', flexDirection: 'column', gap: '0.35rem',
        padding: '0.75rem 0.5rem', borderRight: '1px solid var(--border-color)',
        background: 'rgba(0,0,0,0.2)', flexShrink: 0, overflowY: 'auto',
      }}>
        {DRAW_TOOLS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTool(id)} title={label} style={{
            background: tool === id ? 'rgba(107,170,248,0.18)' : 'transparent',
            border: `1px solid ${tool === id ? 'var(--accent-blue)' : 'transparent'}`,
            borderRadius: 6, cursor: 'pointer',
            color: tool === id ? 'var(--accent-blue)' : 'var(--text-muted)',
            padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={16} />
          </button>
        ))}

        <div style={{ height: 1, background: 'var(--border-color)', margin: '0.2rem 0' }} />

        {STROKE_WIDTHS.map((w) => (
          <button key={w} onClick={() => setLineWidth(w as 2 | 4 | 7)} title={`Grosor ${w}`} style={{
            background: lineWidth === w ? 'rgba(107,170,248,0.18)' : 'transparent',
            border: `1px solid ${lineWidth === w ? 'var(--accent-blue)' : 'transparent'}`,
            borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32,
          }}>
            <div style={{ width: 22, height: w, background: lineWidth === w ? 'var(--accent-blue)' : 'var(--text-muted)', borderRadius: w }} />
          </button>
        ))}

        <div style={{ height: 1, background: 'var(--border-color)', margin: '0.2rem 0' }} />

        {DRAW_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} style={{
            background: c, borderRadius: 5, cursor: 'pointer', height: 26,
            border: color === c ? '2px solid white' : '2px solid transparent',
            outline: color === c ? '1px solid rgba(255,255,255,0.3)' : 'none',
          }} />
        ))}

        <div style={{ height: 1, background: 'var(--border-color)', margin: '0.2rem 0' }} />

        <button onClick={undo} disabled={!canUndo} title="Deshacer" style={{
          background: 'transparent', border: '1px solid transparent', borderRadius: 6,
          cursor: canUndo ? 'pointer' : 'not-allowed', opacity: canUndo ? 1 : 0.35,
          color: 'var(--text-muted)', padding: '0.45rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Undo2 size={15} />
        </button>
        <button onClick={clearAll} title="Limpiar todo" style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 6, cursor: 'pointer', color: 'var(--accent-loss)', padding: '0.45rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trash2 size={15} />
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{
            display: 'block', width: '100%', height: '100%',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
          }}
        />
      </div>
    </div>
  );
}

// ── RosterPanel ───────────────────────────────────────────────────────────────

function RosterPanel({ team }: { team: TeamProfile | null }) {
  if (!team) return null;
  const active = team.roster.filter((m) => !m.activeTo);
  if (active.length === 0) return (
    <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
      No hay jugadores activos en el roster.
    </div>
  );

  const ORDER = ['CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE', 'SUPPORT'];
  const sorted = [...active].sort((a, b) => {
    const ia = ORDER.indexOf((a.role ?? '').toUpperCase());
    const ib = ORDER.indexOf((b.role ?? '').toUpperCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', maxWidth: 1280, margin: '0 auto' }}>
        {sorted.map((m) => {
          const role = (m.role ?? '').toUpperCase();
          const roleColor = ROLE_COLOR[role] ?? 'var(--text-muted)';
          const name = m.customName ?? m.displayName;
          return (
            <div key={m.rosterId} className="glass-card" style={{
              padding: '1.25rem 1.5rem',
              borderLeft: `3px solid ${roleColor}`,
              display: 'flex', flexDirection: 'column', gap: '0.4rem',
            }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 800, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {(ROLE_LABEL[role] ?? role) || 'Sin rol'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {name}
              </div>
              {m.rating?.rankLabel && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {m.rating.rankLabel}
                  {m.rating.ratingPoints != null && ` · ${m.rating.ratingPoints} pts`}
                </div>
              )}
            </div>
          );
        })}
      </div>
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

  const [allTeams, setAllTeams]   = useState<TeamProfile[]>([]);
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

  const currentTeam = allTeams.find((t) => t.id === teamId) ?? null;
  const teamName = currentTeam?.name ?? '';

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
        <TacticalBoard />

      ) : activeTab === 'roster' ? (
        <RosterPanel team={currentTeam} />

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
