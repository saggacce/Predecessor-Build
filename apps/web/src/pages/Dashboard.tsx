import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Server, Zap, RefreshCw, CheckCircle, XCircle, ArrowRight, Users, Sparkles, ThumbsUp, ThumbsDown, Send, Download, Target, BookOpen, Shield, Star, TrendingUp, BarChart2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiErrorResponse, type TeamProfile, type TeamAnalysis, type PlayerProfile } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useViewAs } from '../hooks/useViewAs';
import { LinkPlayerModal } from '../components/LinkPlayerModal';
import type { VersionRecord } from '@predecessor/data-model';

type SyncState =
  | { tag: 'idle' }
  | { tag: 'running'; op: string }
  | { tag: 'done'; op: string; result: string }
  | { tag: 'failed'; op: string; message: string };

type FocusState = 'idle' | 'streaming' | 'done' | 'error';
type FeedbackState = 'none' | 'positive' | 'negative';

// ── Shared quick-link card ────────────────────────────────────────────────────
function QuickLink({ to, state, icon, label, description, color = 'var(--accent-blue)' }: {
  to: string; state?: Record<string, unknown>; icon: React.ReactNode; label: string; description: string; color?: string;
}) {
  return (
    <Link to={to} state={state} style={{ textDecoration: 'none' }}>
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.1rem', cursor: 'pointer', borderLeft: `3px solid ${color}`, transition: 'opacity 0.15s' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.82'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}>
        <span style={{ color, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{label}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{description}</div>
        </div>
        <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
    </Link>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value, color = 'var(--text-primary)' }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.15rem' }}>{label}</div>
    </div>
  );
}

// ── Team form strip ───────────────────────────────────────────────────────────
function TeamFormStrip({ analysis }: { analysis: TeamAnalysis | null }) {
  const totalMatches = analysis ? analysis.teamWins + analysis.teamLosses : 0;
  const wr = totalMatches > 0 ? Math.round((analysis!.teamWins / totalMatches) * 100) : null;
  const last5 = analysis
    ? analysis.recentMatches.slice(0, 5).map((m) => m.won)
    : [];
  const recentWins = last5.filter(Boolean).length;
  const onFire = last5.length >= 3 && last5.slice(0, 3).every(Boolean);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      {wr !== null && (
        <StatChip label="Win Rate" value={`${wr}%`} color={wr >= 55 ? 'var(--accent-win)' : wr < 45 ? 'var(--accent-loss)' : 'var(--accent-prime)'} />
      )}
      {totalMatches > 0 && <StatChip label="Partidas" value={totalMatches} />}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {last5.map((w, i) => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: w ? 'var(--accent-win)' : 'var(--accent-loss)', opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.52rem', fontWeight: 800, color: '#000' }}>{w ? 'W' : 'L'}</span>
          </div>
        ))}
        {last5.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin partidas recientes</span>}
      </div>
      {onFire && <span style={{ fontSize: '0.7rem', color: 'var(--accent-prime)', fontWeight: 700 }}>🔥 On fire</span>}
      {last5.length >= 3 && !onFire && recentWins === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--accent-loss)' }}>📉 Racha negativa</span>}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, internalAuthenticated } = useAuth();
  const { viewAs } = useViewAs();
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [latestPatch, setLatestPatch] = useState<VersionRecord | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ tag: 'idle' });
  const [ownTeam, setOwnTeam] = useState<TeamProfile | null>(null);
  const [ownAnalysis, setOwnAnalysis] = useState<TeamAnalysis | null>(null);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [feedbackCount, setFeedbackCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);

  // Determine role
  // If admin is previewing as a role, use the simulated role
  const isPlatformAdmin = !viewAs && user?.globalRole === 'PLATFORM_ADMIN';
  const ownMembership = ownTeam ? user?.memberships?.find((m) => m.teamId === ownTeam.id) : null;
  const effectiveTeamRole = viewAs && ['MANAGER','COACH','ANALISTA','JUGADOR'].includes(viewAs)
    ? viewAs as 'MANAGER' | 'COACH' | 'ANALISTA' | 'JUGADOR'
    : (ownMembership?.role ?? null);
  const teamRole = effectiveTeamRole;
  const isManager = teamRole === 'MANAGER';
  const isCoach = teamRole === 'COACH';
  const isAnalista = teamRole === 'ANALISTA';
  const isJugador = teamRole === 'JUGADOR';

  useEffect(() => {
    if (!internalAuthenticated) return;

    // Fetch health + patch for everyone; team data only if user has team memberships
    const hasTeamMemberships = (user?.memberships?.length ?? 0) > 0;
    void (async () => {
      const [health, patch] = await Promise.allSettled([
        apiClient.admin.apiStatus(),
        apiClient.patches.latest(),
      ]);
      if (health.status === 'fulfilled') setHealthStatus('ok');
      else setHealthStatus('error');
      if (patch.status === 'fulfilled') {
        setLatestPatch(patch.value as unknown as VersionRecord);
      }

      // Only fetch team data for users who actually belong to a team
      if (hasTeamMemberships) {
        const [teamRes] = await Promise.allSettled([apiClient.teams.list('OWN')]);
        if (teamRes.status === 'fulfilled') {
          // Only use teams the user is actually a member of
          const userTeamIds = new Set(user?.memberships?.map((m) => m.teamId) ?? []);
          const team = (teamRes.value.teams ?? []).find((t) => userTeamIds.has(t.id)) ?? null;
          setOwnTeam(team);
          if (team) {
            const [analysis] = await Promise.allSettled([apiClient.teams.getAnalysis(team.id)]);
            if (analysis.status === 'fulfilled') setOwnAnalysis(analysis.value);
          }
        }
      }
    })();

    // Role-specific fetches
    if (isPlatformAdmin) {
      void apiClient.feedback.unreadCount().then(({ count }) => setFeedbackCount(count)).catch(() => null);
      void (apiClient as any).admin.users().then((r: { users: unknown[] }) => setUserCount(r.users.length)).catch(() => null);
    }
  }, [internalAuthenticated, user?.globalRole]);

  // Fetch player profile for JUGADOR role
  useEffect(() => {
    const pid = ownMembership?.playerId;
    if (!isJugador || !pid) return;
    apiClient.players.getProfile(pid).then(setPlayerProfile).catch(() => null);
  }, [isJugador, ownMembership?.playerId]);

  // Fetch review queue count for MANAGER / COACH
  useEffect(() => {
    if (!isManager && !isCoach) return;
    if (ownTeam) {
      apiClient.review.list(ownTeam.id, { status: 'PENDING' }).then((r) => setReviewCount(r.items?.length ?? 0)).catch(() => null);
    }
  }, [isManager, isCoach]);

  const isSyncing = syncState.tag === 'running';
  const statusColor = healthStatus === 'ok' ? 'var(--accent-win)' : healthStatus === 'error' ? 'var(--accent-loss)' : 'var(--accent-violet)';

  async function handleSyncVersions() {
    setSyncState({ tag: 'running', op: 'versions' });
    try {
      const res = await apiClient.admin.syncVersions();
      setSyncState({ tag: 'done', op: 'versions', result: `${res.synced} version${res.synced !== 1 ? 's' : ''} synced` });
    } catch (err) {
      setSyncState({ tag: 'failed', op: 'versions', message: err instanceof ApiErrorResponse ? err.error.message : 'Sync failed' });
    }
  }

  async function handleSyncStale() {
    setSyncState({ tag: 'running', op: 'players' });
    try {
      const res = await apiClient.admin.syncStale();
      setSyncState({ tag: 'done', op: 'players', result: `${res.synced} synced · ${res.skipped} skipped` });
    } catch (err) {
      setSyncState({ tag: 'failed', op: 'players', message: err instanceof ApiErrorResponse ? err.error.message : 'Sync failed' });
    }
  }

  if (!internalAuthenticated) {
    return (
      <div>
        <header className="header">
          <h1 className="header-title">Dashboard</h1>
        </header>
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Shield size={36} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <p>Inicia sesión para acceder al dashboard.</p>
          <Link to="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>Iniciar sesión</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header className="header" style={{ marginBottom: 0 }}>
        <h1 className="header-title">
          Hola, {user?.name?.split(' ')[0] ?? 'Usuario'}
          {teamRole && <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>· {teamRole}</span>}
          {isPlatformAdmin && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-teal-bright)', marginLeft: '0.5rem' }}>· PLATFORM ADMIN</span>}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          {ownTeam ? ownTeam.name : 'Sin equipo asignado'}
          {latestPatch && <span style={{ color: 'var(--text-muted)', marginLeft: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>v{latestPatch.name}</span>}
        </p>
      </header>

      {/* ── PLATFORM ADMIN VIEW ─────────────────────────────────────────── */}
      {isPlatformAdmin && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* System health */}
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div className={healthStatus === 'ok' ? 'led-pulse' : undefined}
                style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, flexShrink: 0, ['--pulse-color' as string]: 'var(--accent-win)' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: healthStatus === 'ok' ? 'var(--text-primary)' : statusColor }}>
                  {healthStatus === 'ok' ? 'API Online' : healthStatus === 'error' ? 'API Error' : 'Comprobando…'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>pred.gg pipeline</div>
              </div>
            </div>

            {/* Feedback unread */}
            <Link to="/admin/feedback" style={{ textDecoration: 'none' }}>
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer' }}>
                <MessageSquare size={20} style={{ color: feedbackCount ? 'var(--accent-loss)' : 'var(--text-muted)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: feedbackCount ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
                    {feedbackCount ?? '—'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Feedbacks nuevos</div>
                </div>
              </div>
            </Link>

            {/* Users */}
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <Users size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{userCount ?? '—'}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Usuarios registrados</div>
              </div>
            </div>

            {/* Patch */}
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <Zap size={20} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{latestPatch ? `v${latestPatch.name}` : '—'}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Parche activo</div>
              </div>
            </div>
          </div>

          {/* Data controls */}
          <div className="glass-card" style={{ padding: '1.1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <RefreshCw size={14} style={{ color: 'var(--text-muted)', animation: isSyncing ? 'spin 0.8s linear infinite' : 'none' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data Controls</span>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button onClick={() => void handleSyncVersions()} disabled={isSyncing} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Sync Versions</button>
              <button onClick={() => void handleSyncStale()} disabled={isSyncing} className="btn-primary" style={{ fontSize: '0.8rem' }}>Sync Players</button>
            </div>
            {syncState.tag === 'done' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--accent-win)', marginTop: '0.6rem' }}>
                <CheckCircle size={12} /> {syncState.result}
              </div>
            )}
            {syncState.tag === 'failed' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--accent-loss)', marginTop: '0.6rem' }}>
                <XCircle size={12} /> {syncState.message}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <QuickLink to="/admin/feedback" icon={<MessageSquare size={16} />} label="Feedback" description="Ver reportes de usuarios" color="var(--accent-loss)" />
            <QuickLink to="/admin/users" icon={<Users size={16} />} label="Usuarios" description="Gestionar cuentas y roles" color="var(--accent-blue)" />
            <QuickLink to="/admin/data-quality" icon={<Server size={16} />} label="Data Quality" description="Sync y estado del sistema" color="var(--accent-teal-bright)" />
            <QuickLink to="/admin/config" icon={<Zap size={16} />} label="Configuración" description="Umbrales y reglas de display" color="var(--accent-violet)" />
          </div>
        </>
      )}

      {/* ── TEAM VIEW (non-admin) ─────────────────────────────────────────── */}
      {!isPlatformAdmin && ownTeam && (
        <>
          {/* Team form */}
          <div className="glass-card" style={{ padding: '1.1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <TrendingUp size={14} style={{ color: 'var(--accent-teal-bright)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {ownTeam.name} — Forma reciente
              </span>
            </div>
            <TeamFormStrip analysis={ownAnalysis} />
          </div>

          {/* ── MANAGER view ── */}
          {isManager && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: ownAnalysis ? (ownAnalysis.teamWins / (ownAnalysis.teamWins + ownAnalysis.teamLosses) >= 0.5 ? 'var(--accent-win)' : 'var(--accent-loss)') : 'var(--text-muted)' }}>
                    {ownAnalysis ? `${Math.round((ownAnalysis.teamWins / (ownAnalysis.teamWins + ownAnalysis.teamLosses || 1)) * 100)}%` : '—'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win Rate</div>
                </div>
                {reviewCount !== null && (
                  <Link to="/tools/review" style={{ textDecoration: 'none' }}>
                    <div className="glass-card" style={{ textAlign: 'center', padding: '1rem', cursor: 'pointer' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: reviewCount > 0 ? 'var(--accent-prime)' : 'var(--text-muted)' }}>{reviewCount}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revisiones pendientes</div>
                    </div>
                  </Link>
                )}
                <div className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {ownAnalysis ? ownAnalysis.teamWins + ownAnalysis.teamLosses : '—'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Partidas jugadas</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <QuickLink to={`/analysis/teams?team=${ownTeam.id}`} icon={<BarChart2 size={16} />} label="Team Analysis" description="Rendimiento, visión y objetivos" color="var(--accent-teal-bright)" />
                <QuickLink to="/reports/scrim" icon={<Target size={16} />} label="Scrim Report" description="Inteligencia pre-partido" color="var(--accent-loss)" />
                <QuickLink to="/tools/review" icon={<BookOpen size={16} />} label="Review Queue" description="Revisión de partidas pendientes" color="var(--accent-prime)" />
                <QuickLink to="/management/staff" icon={<Users size={16} />} label="Staff" description="Gestión de equipo e invitaciones" color="var(--accent-blue)" />
              </div>
            </>
          )}

          {/* ── COACH view ── */}
          {isCoach && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {reviewCount !== null && (
                  <Link to="/tools/review" style={{ textDecoration: 'none' }}>
                    <div className="glass-card" style={{ textAlign: 'center', padding: '1rem', cursor: 'pointer', borderLeft: `3px solid ${reviewCount > 0 ? 'var(--accent-prime)' : 'var(--border-color)'}` }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: reviewCount > 0 ? 'var(--accent-prime)' : 'var(--text-muted)' }}>{reviewCount}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revisiones pendientes</div>
                    </div>
                  </Link>
                )}
                <div className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: ownAnalysis ? (ownAnalysis.teamWins / (ownAnalysis.teamWins + ownAnalysis.teamLosses || 1) >= 0.5 ? 'var(--accent-win)' : 'var(--accent-loss)') : 'var(--text-muted)' }}>
                    {ownAnalysis ? `${Math.round((ownAnalysis.teamWins / (ownAnalysis.teamWins + ownAnalysis.teamLosses || 1)) * 100)}%` : '—'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win Rate equipo</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <QuickLink to="/tools/review" icon={<BookOpen size={16} />} label="Review Queue" description={reviewCount ? `${reviewCount} items pendientes` : 'Gestión de revisiones'} color="var(--accent-prime)" />
                <QuickLink to={`/analysis/teams?team=${ownTeam.id}&tab=draft`} icon={<BarChart2 size={16} />} label="Team Analysis" description="Análisis de rendimiento y draft" color="var(--accent-teal-bright)" />
                <QuickLink to="/reports/scrim" icon={<Target size={16} />} label="Scrim Report" description="Preparación pre-partido" color="var(--accent-loss)" />
                <QuickLink to="/analysis/players" icon={<Users size={16} />} label="Player Scouting" description="Análisis individual de jugadores" color="var(--accent-blue)" />
              </div>
            </>
          )}

          {/* ── ANALISTA view ── */}
          {isAnalista && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <QuickLink to={`/analysis/teams?team=${ownTeam.id}`} icon={<BarChart2 size={16} />} label="Team Analysis" description="Phase, visión, objetivos, draft" color="var(--accent-teal-bright)" />
                <QuickLink to="/analysis/rival" icon={<Shield size={16} />} label="Rival Scouting" description="Identidad y amenazas del rival" color="var(--accent-loss)" />
                <QuickLink to="/reports/scrim" icon={<Target size={16} />} label="Scrim Report" description="Inteligencia competitiva" color="var(--accent-prime)" />
                <QuickLink to="/analysis/players" icon={<Users size={16} />} label="Player Scouting" description="Perfil individual de jugadores" color="var(--accent-blue)" />
                <QuickLink to="/matches" icon={<BookOpen size={16} />} label="Matches" description="Historial de partidas" color="var(--accent-violet)" />
              </div>
              {/* Data status */}
              <div className="glass-card" style={{ padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Server size={14} style={{ color: healthStatus === 'ok' ? 'var(--accent-win)' : 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {healthStatus === 'ok' ? 'API pred.gg activa' : 'API no disponible'}{latestPatch ? ` · Parche v${latestPatch.name}` : ''}
                </span>
              </div>
            </>
          )}

          {/* ── JUGADOR view ── */}
          {isJugador && (
            <>
              {playerProfile ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                    {[
                      { label: 'KDA', value: playerProfile.generalStats?.kda?.toFixed(2) ?? '—', color: 'var(--accent-teal-bright)' },
                      { label: 'Partidas', value: playerProfile.recentMatches.length, color: 'var(--text-primary)' },
                      { label: 'Win Rate', value: playerProfile.generalStats?.winRate ? `${Math.round(playerProfile.generalStats.winRate as number)}%` : '—', color: 'var(--accent-prime)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color }}>{String(value)}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.15rem' }}>{label}</div>
                      </div>
                    ))}
                    {/* Top hero */}
                    {playerProfile.heroStats.length > 0 && (
                      <div className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'capitalize' }}>
                          {playerProfile.heroStats[0].heroData?.name ?? playerProfile.heroStats[0].heroData?.slug ?? '—'}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.15rem' }}>Main Hero</div>
                      </div>
                    )}
                  </div>

                  {/* Recent matches strip */}
                  <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Últimas 5 partidas</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {playerProfile.recentMatches.slice(0, 5).map((m, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: m.result === 'win' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${m.result === 'win' ? 'var(--accent-win)' : 'var(--accent-loss)'}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: m.result === 'win' ? 'var(--accent-win)' : 'var(--accent-loss)', fontFamily: 'var(--font-mono)' }}>{m.result === 'win' ? 'W' : 'L'}</span>
                          </div>
                          <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {m.kills}/{m.deaths}/{m.assists}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="glass-card" style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No hay datos de jugador vinculados a tu cuenta. Contacta al manager del equipo.
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {ownMembership?.playerId && (
                  <QuickLink to="/analysis/players" state={{ autoLoadPlayerId: ownMembership.playerId }} icon={<Users size={16} />} label="Mi perfil en el juego" description="Stats, héroes, evolución de forma" color="var(--accent-teal-bright)" />
                )}
                <QuickLink to="/tools/review" icon={<Star size={16} />} label="Mis objetivos" description="Player Goals del equipo" color="var(--accent-prime)" />
                {ownMembership?.playerId && (
                  <QuickLink to="/analysis/players" state={{ autoLoadPlayerId: ownMembership.playerId }} icon={<BookOpen size={16} />} label="Mis partidas" description="Historial completo de partidas" color="var(--accent-violet)" />
                )}
              </div>
            </>
          )}

          {/* ── VIEWER / no team role ── */}
          {!isManager && !isCoach && !isAnalista && !isJugador && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <QuickLink to={`/analysis/teams?team=${ownTeam.id}`} icon={<BarChart2 size={16} />} label="Team Analysis" description="Rendimiento del equipo" color="var(--accent-teal-bright)" />
              <QuickLink to="/analysis/players" icon={<Users size={16} />} label="Player Scouting" description="Análisis de jugadores" color="var(--accent-blue)" />
            </div>
          )}

          {/* Focus of the Day — stub for all team roles */}
          <FocusOfTheDay teamId={ownTeam.id} />
        </>
      )}

      {/* ── Standalone PLAYER (no team) ──────────────────────────────────── */}
      {!isPlatformAdmin && (!ownTeam || viewAs === 'PLAYER') && (
        <PlayerStandaloneView />
      )}
    </div>
  );
}

// ── Focus of the Day (stub — Próximamente) ────────────────────────────────────
function FocusOfTheDay({ teamId: _teamId }: { teamId: string }) {
  const { internalAuthenticated } = useAuth();
  if (!internalAuthenticated) return null;

  return (
    <div className="glass-card" style={{ borderLeft: '3px solid var(--accent-violet)', padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Sparkles size={15} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Focus of the Day</span>
        <div style={{ marginLeft: 'auto', position: 'relative' }} title="Esta funcionalidad estará disponible próximamente">
          <button disabled className="btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.65rem', opacity: 0.45, cursor: 'not-allowed' }}>
            Analizar
          </button>
          <span style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, whiteSpace: 'nowrap', fontSize: '0.62rem', fontWeight: 600, color: 'var(--accent-prime)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 6px', pointerEvents: 'none' }}>
            Próximamente
          </span>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
        Análisis prescriptivo generado por IA a partir de los indicadores del equipo.
      </p>
    </div>
  );
}

// ── PlayerSyncWidget (kept for compatibility) ─────────────────────────────────
function PlayerSyncWidget() {
  return null;
}
export { PlayerSyncWidget };

// ── Standalone Player view (PLAYER globalRole, no team) ───────────────────────
function PlayerStandaloneView() {
  const { user, refreshInternalSession } = useAuth();
  const linkedId = (user as { linkedPlayerId?: string | null })?.linkedPlayerId;

  // All hooks before any conditional returns
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkedIdState, setLinkedIdState] = useState(linkedId);

  // Sync linkedIdState when auth state updates (e.g. after refreshInternalSession)
  useEffect(() => {
    if (linkedId && !linkedIdState) {
      setLinkedIdState(linkedId);
    }
  }, [linkedId, linkedIdState]);

  useEffect(() => {
    if (!linkedId) return;
    setLoading(true);
    apiClient.players.getProfile(linkedId)
      .then(setProfile)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [linkedId]);

  if (!linkedIdState) {
    return (
      <>
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <Users size={36} style={{ margin: '0 auto 0.85rem', opacity: 0.3, color: 'var(--accent-teal-bright)' }} />
          <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            Vincula tu perfil de jugador
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Para ver tus estadísticas de Predecessor, busca tu nombre de jugador y vincúlalo a tu cuenta.
          </p>
          <button
            onClick={() => setShowLinkModal(true)}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', padding: '0.55rem 1.25rem' }}
          >
            Buscar mi perfil en Predecessor
          </button>
        </div>
        {showLinkModal && (
          <LinkPlayerModal
            onLinked={(pid) => { setLinkedIdState(pid); setShowLinkModal(false); void refreshInternalSession(); }}
            onClose={() => setShowLinkModal(false)}
          />
        )}
      </>
    );
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>Cargando tu perfil…</div>;

  if (!profile) return null;

  const wr = profile.generalStats?.winRate ? Math.round(profile.generalStats.winRate as number) : null;
  const kda = profile.generalStats?.kda ? (profile.generalStats.kda as number).toFixed(2) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'KDA', value: kda ?? '—', color: 'var(--accent-teal-bright)' },
          { label: 'Win Rate', value: wr ? `${wr}%` : '—', color: wr && wr >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)' },
          { label: 'Partidas', value: profile.recentMatches.length, color: 'var(--text-primary)' },
          ...(profile.heroStats[0] ? [{ label: 'Main Hero', value: profile.heroStats[0].heroData?.name ?? profile.heroStats[0].heroData?.slug ?? '—', color: 'var(--accent-blue)' }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: label === 'Main Hero' ? '0.85rem' : '1.4rem', fontWeight: 700, color }}>{String(value)}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.15rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Last 5 matches */}
      {profile.recentMatches.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Últimas partidas</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {profile.recentMatches.slice(0, 8).map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: m.result === 'win' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${m.result === 'win' ? 'var(--accent-win)' : 'var(--accent-loss)'}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: m.result === 'win' ? 'var(--accent-win)' : 'var(--accent-loss)', fontFamily: 'var(--font-mono)' }}>{m.result === 'win' ? 'W' : 'L'}</span>
                </div>
                <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{m.kills}/{m.deaths}/{m.assists}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <Link to="/analysis/players" state={{ autoLoadPlayerId: linkedId }} style={{ textDecoration: 'none' }}>
          <div className="glass-card landing-feature-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.1rem', cursor: 'pointer', borderLeft: '3px solid var(--accent-teal-bright)' }}>
            <Users size={18} style={{ color: 'var(--accent-teal-bright)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Mi perfil completo</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Stats, héroes, evolución</div>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
          </div>
        </Link>
        <Link to="/analysis/players" state={{ autoLoadPlayerId: linkedId }} style={{ textDecoration: 'none' }}>
          <div className="glass-card landing-feature-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.1rem', cursor: 'pointer', borderLeft: '3px solid var(--accent-violet)' }}>
            <BookOpen size={18} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Mis partidas</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Historial completo</div>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
          </div>
        </Link>
      </div>
    </div>
  );
}
