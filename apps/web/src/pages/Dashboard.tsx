import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Server, Zap, RefreshCw, CheckCircle, XCircle, ArrowRight, Users, Sparkles, ThumbsUp, ThumbsDown, Send, Download, Target, BookOpen, Shield, Star, TrendingUp, BarChart2, MessageSquare, PlusCircle, Calendar, Bell, Search, ChevronRight, Trophy, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { apiClient, ApiErrorResponse, type TeamProfile, type TeamAnalysis, type PlayerProfile, type Insight, type HeroStat, type ScrimScheduleItem, type TeamCommItem, type WeeklyGoalItem, type PlayerAnalysisStat } from '../api/client';
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
  const { t } = useTranslation();
  const totalMatches = analysis ? analysis.teamWins + analysis.teamLosses : 0;
  const wr = totalMatches > 0 ? Math.round((analysis!.teamWins / totalMatches) * 100) : null;
  const last5 = analysis
    ? analysis.teamMatches.slice(0, 5).map((m) => m.won)
    : [];
  const recentWins = last5.filter(Boolean).length;
  const onFire = last5.length >= 3 && last5.slice(0, 3).every(Boolean);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      {wr !== null && (
        <StatChip label={t('dashboard.winRate')} value={`${wr}%`} color={wr >= 55 ? 'var(--accent-win)' : wr < 45 ? 'var(--accent-loss)' : 'var(--accent-prime)'} />
      )}
      {totalMatches > 0 && <StatChip label={t('dashboard.matches')} value={totalMatches} />}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {last5.map((w, i) => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: w ? 'var(--accent-win)' : 'var(--accent-loss)', opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.52rem', fontWeight: 800, color: '#000' }}>{w ? 'W' : 'L'}</span>
          </div>
        ))}
        {last5.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('dashboard.noRecentGames')}</span>}
      </div>
      {onFire && <span style={{ fontSize: '0.7rem', color: 'var(--accent-prime)', fontWeight: 700 }}>{t('dashboard.onFire')}</span>}
      {last5.length >= 3 && !onFire && recentWins === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--accent-loss)' }}>{t('dashboard.negativeStreak')}</span>}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t, i18n } = useTranslation();
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
  const [coachInsights, setCoachInsights] = useState<Insight[]>([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [scrimSchedule, setScrimSchedule] = useState<ScrimScheduleItem[]>([]);
  const [pendingComms, setPendingComms] = useState<TeamCommItem[]>([]);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoalItem[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerAnalysisStat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Manager who has registered but not yet created/joined a team
  const isManagerWithNoTeam = !isPlatformAdmin && teamsLoaded && !ownTeam && (
    user?.globalRole === 'MANAGER' ||
    (user?.memberships?.some((m) => m.role === 'MANAGER') ?? false)
  );

  useEffect(() => {
    if (!internalAuthenticated) return;

    const hasTeamMemberships = (user?.memberships?.length ?? 0) > 0;
    const isPreviewingTeamRole = !!viewAs && ['MANAGER', 'COACH', 'ANALISTA', 'JUGADOR'].includes(viewAs);

    // Reset team state on role change so stale data doesn't flash
    setOwnTeam(null);
    setOwnAnalysis(null);
    setTeamsLoaded(false);

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

      if (hasTeamMemberships) {
        // Normal user with team memberships
        const [teamRes] = await Promise.allSettled([apiClient.teams.list('OWN')]);
        if (teamRes.status === 'fulfilled') {
          const userTeamIds = new Set(user?.memberships?.map((m) => m.teamId) ?? []);
          const team = (teamRes.value.teams ?? []).find((t) => userTeamIds.has(t.id)) ?? null;
          setOwnTeam(team);
          if (team) {
            const [analysis] = await Promise.allSettled([apiClient.teams.getAnalysis(team.id)]);
            if (analysis.status === 'fulfilled') setOwnAnalysis(analysis.value);
          }
        }
      } else if (isPreviewingTeamRole) {
        // Platform Admin previewing a team role — load first available OWN team
        const [teamRes] = await Promise.allSettled([apiClient.teams.list('OWN')]);
        if (teamRes.status === 'fulfilled') {
          const team = teamRes.value.teams?.[0] ?? null;
          setOwnTeam(team);
          if (team) {
            const [analysis] = await Promise.allSettled([apiClient.teams.getAnalysis(team.id)]);
            if (analysis.status === 'fulfilled') setOwnAnalysis(analysis.value);
          }
        }
      }
      setTeamsLoaded(true);
    })();

    // Role-specific fetches
    if (!viewAs && user?.globalRole === 'PLATFORM_ADMIN') {
      void apiClient.feedback.unreadCount().then(({ count }) => setFeedbackCount(count)).catch(() => null);
      void (apiClient as any).admin.users().then((r: { users: unknown[] }) => setUserCount(r.users.length)).catch(() => null);
    }
  }, [internalAuthenticated, user?.globalRole, viewAs]);

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
  }, [isManager, isCoach, ownTeam?.id]);

  // Fetch critical/high insights for COACH
  useEffect(() => {
    if (!isCoach || !ownTeam) return;
    apiClient.analyst.insights(ownTeam.id, i18n.language)
      .then((r) => setCoachInsights(r.insights.filter((i) => i.severity === 'critical' || i.severity === 'high')))
      .catch(() => null);
  }, [isCoach, ownTeam?.id]);

  // Fetch scrim schedule + comms for COACH / MANAGER
  useEffect(() => {
    if (!ownTeam || (!isCoach && !isManager)) return;
    apiClient.schedule.list(ownTeam.id).then((r) => setScrimSchedule(r.items)).catch(() => null);
    apiClient.comms.list(ownTeam.id)
      .then((r) => setPendingComms(r.items.filter((c) => c.status === 'OPEN' || c.status === 'IN_PROGRESS')))
      .catch(() => null);
  }, [isCoach, isManager, ownTeam?.id]);

  // Fetch scrim schedule for JUGADOR (read-only, upcoming scrims only)
  useEffect(() => {
    if (!ownTeam || !isJugador) return;
    apiClient.schedule.list(ownTeam.id).then((r) => setScrimSchedule(r.items)).catch(() => null);
  }, [isJugador, ownTeam?.id]);

  // Fetch player stats for roster form (COACH / MANAGER)
  useEffect(() => {
    if (!ownTeam || (!isCoach && !isManager)) return;
    apiClient.teams.getAnalysis(ownTeam.id).then((r) => setPlayerStats(r.playerStats ?? [])).catch(() => null);
  }, [isCoach, isManager, ownTeam?.id]);

  // Fetch comms for ANALISTA (coach requests addressed to them)
  useEffect(() => {
    if (!isAnalista || !ownTeam) return;
    apiClient.comms.list(ownTeam.id)
      .then((r) => setPendingComms(r.items.filter((c) => (c.toRole === 'ANALISTA' || c.toUserId === user?.id) && (c.status === 'OPEN' || c.status === 'IN_PROGRESS'))))
      .catch(() => null);
  }, [isAnalista, ownTeam?.id, user?.id]);

  // Fetch comms for JUGADOR (messages from coach addressed to their role or directly to them)
  useEffect(() => {
    if (!isJugador || !ownTeam) return;
    apiClient.comms.list(ownTeam.id)
      .then((r) => setPendingComms(r.items.filter((c) => c.toRole === 'JUGADOR' || c.toUserId === user?.id || c.toRole === null)))
      .catch(() => null);
  }, [isJugador, ownTeam?.id, user?.id]);

  // Fetch weekly goals for standalone PLAYER
  useEffect(() => {
    const isStandalone = !isPlatformAdmin && !ownTeam && user?.globalRole === 'PLAYER';
    if (!isStandalone) return;
    apiClient.weeklyGoals.mine().then((r) => setWeeklyGoals(r.goals)).catch(() => null);
  }, [isPlatformAdmin, ownTeam?.id, user?.globalRole]);

  const isSyncing = syncState.tag === 'running';
  const statusColor = healthStatus === 'ok' ? 'var(--accent-win)' : healthStatus === 'error' ? 'var(--accent-loss)' : 'var(--accent-violet)';

  async function handleSyncVersions() {
    setSyncState({ tag: 'running', op: 'versions' });
    try {
      const res = await apiClient.admin.syncVersions();
      setSyncState({ tag: 'done', op: 'versions', result: `${res.synced} version${res.synced !== 1 ? 's' : ''} synced` });
      const patch = await apiClient.patches.latest();
      setLatestPatch(patch as unknown as VersionRecord);
      window.dispatchEvent(new CustomEvent('versions-synced'));
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
          <h1 className="header-title">{t('dashboard.title')}</h1>
        </header>
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Shield size={36} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <p>{t('dashboard.noTeamDesc')}</p>
          <Link to="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>{t('common.login')}</Link>
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
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {ownTeam ? ownTeam.name : t('dashboard.noTeam')}
          {latestPatch && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(107,170,248,0.12)', border: '1px solid rgba(107,170,248,0.25)', borderRadius: 4, padding: '1px 7px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
              Patch {latestPatch.name}
            </span>
          )}
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
                  {healthStatus === 'ok' ? t('apiStatus.connected') : healthStatus === 'error' ? t('apiStatus.disconnected') : t('dashboard.checkingSession')}
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
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Feedback pendiente</div>
                </div>
              </div>
            </Link>

            {/* Users */}
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <Users size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{userCount ?? '—'}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t('users.title')}</div>
              </div>
            </div>

            {/* Patch */}
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <Zap size={20} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{latestPatch ? `v${latestPatch.name}` : '—'}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t('dataQuality.syncStatus')}</div>
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
            <QuickLink to="/admin/feedback" icon={<MessageSquare size={16} />} label={t('nav.feedback')} description={t('dashboard.reviewMatchesDesc')} color="var(--accent-loss)" />
            <QuickLink to="/admin/users" icon={<Users size={16} />} label={t('nav.users')} description={t('users.description')} color="var(--accent-blue)" />
            <QuickLink to="/admin/data-quality" icon={<Server size={16} />} label={t('nav.dataQuality')} description={t('dataQuality.syncStatus')} color="var(--accent-teal-bright)" />
            <QuickLink to="/admin/config" icon={<Zap size={16} />} label={t('nav.config')} description={t('config.thresholds')} color="var(--accent-violet)" />
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
                {ownTeam.name} — {t('dashboard.teamForm')}
              </span>
            </div>
            <TeamFormStrip analysis={ownAnalysis} />
          </div>

          {/* ── MANAGER view ── */}
          {isManager && (
            <>
              {/* Macro KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                <div className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: ownAnalysis ? (ownAnalysis.teamWins / (ownAnalysis.teamWins + ownAnalysis.teamLosses || 1) >= 0.5 ? 'var(--accent-win)' : 'var(--accent-loss)') : 'var(--text-muted)' }}>
                    {ownAnalysis ? `${Math.round((ownAnalysis.teamWins / (ownAnalysis.teamWins + ownAnalysis.teamLosses || 1)) * 100)}%` : '—'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('dashboard.winRate')}</div>
                </div>
                <div className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {ownAnalysis ? ownAnalysis.teamWins + ownAnalysis.teamLosses : '—'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('dashboard.matches')}</div>
                </div>
                {ownAnalysis && <SideWRChips matches={ownAnalysis.teamMatches} />}
                {reviewCount !== null && (
                  <Link to="/tools/review" style={{ textDecoration: 'none' }}>
                    <div className="glass-card" style={{ textAlign: 'center', padding: '1rem', cursor: 'pointer', borderLeft: `3px solid ${reviewCount > 0 ? 'var(--accent-prime)' : 'var(--border-color)'}` }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: reviewCount > 0 ? 'var(--accent-prime)' : 'var(--text-muted)' }}>{reviewCount}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('reviewQueue.pendingReview')}</div>
                    </div>
                  </Link>
                )}
              </div>

              {/* Roster status */}
              {playerStats.length > 0 && <RosterFormPanel players={playerStats} />}

              {/* Scrim calendar */}
              <ScrimCalendarPanel items={scrimSchedule} teamId={ownTeam.id} role="MANAGER" />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <QuickLink to={`/analysis/teams?team=${ownTeam.id}`} icon={<BarChart2 size={16} />} label={t('teamAnalysis.title')} description={t('dashboard.teamAnalysisDesc')} color="var(--accent-teal-bright)" />
                <QuickLink to="/reports/scrim" icon={<Target size={16} />} label={t('scrimReport.title')} description={t('dashboard.rivalScoutingDesc')} color="var(--accent-loss)" />
                <QuickLink to="/tools/review" icon={<BookOpen size={16} />} label={t('reviewQueue.title')} description={t('dashboard.reviewMatchesDesc')} color="var(--accent-prime)" />
                <QuickLink to="/management/staff" icon={<Users size={16} />} label={t('nav.staffInvitations')} description={t('staffManagement.description')} color="var(--accent-blue)" />
              </div>
            </>
          )}

          {/* ── COACH view ── */}
          {isCoach && (
            <>
              {/* KPI strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                <div className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: ownAnalysis ? (ownAnalysis.teamWins / (ownAnalysis.teamWins + ownAnalysis.teamLosses || 1) >= 0.5 ? 'var(--accent-win)' : 'var(--accent-loss)') : 'var(--text-muted)' }}>
                    {ownAnalysis ? `${Math.round((ownAnalysis.teamWins / (ownAnalysis.teamWins + ownAnalysis.teamLosses || 1)) * 100)}%` : '—'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('dashboard.winRate')}</div>
                </div>
                {ownAnalysis && <SideWRChips matches={ownAnalysis.teamMatches} />}
                {reviewCount !== null && (
                  <Link to="/tools/review" style={{ textDecoration: 'none' }}>
                    <div className="glass-card" style={{ textAlign: 'center', padding: '1rem', cursor: 'pointer', borderLeft: `3px solid ${reviewCount > 0 ? 'var(--accent-prime)' : 'var(--border-color)'}` }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: reviewCount > 0 ? 'var(--accent-prime)' : 'var(--text-muted)' }}>{reviewCount}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('reviewQueue.pendingReview')}</div>
                    </div>
                  </Link>
                )}
                {pendingComms.length > 0 && (
                  <div className="glass-card" style={{ textAlign: 'center', padding: '1rem', borderLeft: '3px solid var(--accent-violet)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-violet)' }}>{pendingComms.length}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mensajes</div>
                  </div>
                )}
              </div>

              {/* Roster form */}
              {playerStats.length > 0 && <RosterFormPanel players={playerStats} />}

              {/* Alerts: insights */}
              {coachInsights.length > 0 && (
                <div className="glass-card" style={{ padding: '0.9rem 1.1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <AlertTriangle size={13} style={{ color: 'var(--accent-prime)' }} />
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alertas del equipo</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {coachInsights.slice(0, 3).map((ins) => (
                      <div key={ins.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ flexShrink: 0, fontWeight: 800, fontSize: '0.65rem', padding: '2px 6px', borderRadius: 3, background: ins.severity === 'critical' ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.12)', color: ins.severity === 'critical' ? 'var(--accent-loss)' : 'var(--accent-prime)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '1px' }}>
                          {ins.severity}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{ins.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scrim calendar + comms side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <ScrimCalendarPanel items={scrimSchedule} teamId={ownTeam.id} role="COACH" onScrimAdded={(item) => setScrimSchedule((p) => [...p, item].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()))} />
                <CoachCommsPanel
                  teamId={ownTeam.id}
                  roster={ownTeam.roster}
                  items={pendingComms}
                  onCreated={(item) => setPendingComms((prev) => [item, ...prev])}
                  onUpdate={(id, status) => {
                    apiClient.comms.update(id, { status }).then(() =>
                      setPendingComms((prev) => prev.filter((c) => c.id !== id || (status !== 'DONE' && status !== 'DISMISSED')))
                    ).catch(() => toast.error('Error al actualizar'));
                  }}
                />
              </div>

              {/* Quick links */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <QuickLink to="/tools/review" icon={<BookOpen size={16} />} label={t('reviewQueue.title')} description={reviewCount ? `${reviewCount} ${t('reviewQueue.pendingReview')}` : t('dashboard.reviewMatchesDesc')} color="var(--accent-prime)" />
                <QuickLink to={`/analysis/teams?team=${ownTeam.id}&tab=draft`} icon={<BarChart2 size={16} />} label={t('teamAnalysis.title')} description={t('dashboard.teamAnalysisDesc')} color="var(--accent-teal-bright)" />
                <QuickLink to="/reports/scrim" icon={<Target size={16} />} label={t('scrimReport.title')} description={t('dashboard.rivalScoutingDesc')} color="var(--accent-loss)" />
                <QuickLink to="/analysis/players" icon={<Users size={16} />} label={t('playerScouting.title')} description={t('dashboard.scoutPlayerDesc')} color="var(--accent-blue)" />
              </div>
            </>
          )}

          {/* ── ANALISTA view ── */}
          {isAnalista && (
            <>
              {/* Pipeline status */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: healthStatus === 'ok' ? 'var(--accent-win)' : 'var(--accent-loss)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{healthStatus === 'ok' ? 'Pipeline OK' : 'Pipeline Error'}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>pred.gg sync</div>
                  </div>
                </div>
                {latestPatch && (
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <Zap size={16} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Patch {latestPatch.name}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Parche activo</div>
                    </div>
                  </div>
                )}
                {pendingComms.length > 0 && (
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '3px solid var(--accent-prime)' }}>
                    <Bell size={16} style={{ color: 'var(--accent-prime)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-prime)' }}>{pendingComms.length}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Peticiones del coach</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Coach requests */}
              {pendingComms.length > 0 && (
                <PlayerCommsPanel items={pendingComms} />
              )}

              {/* Quick search */}
              <div className="glass-card" style={{ padding: '0.85rem 1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        window.location.href = `/analysis/players?q=${encodeURIComponent(searchQuery.trim())}`;
                      }
                    }}
                    placeholder="Buscar jugador, héroe o equipo…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                  />
                  {searchQuery && (
                    <Link to={`/analysis/players?q=${encodeURIComponent(searchQuery)}`} style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', whiteSpace: 'nowrap' }}>
                      Buscar →
                    </Link>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <QuickLink to={`/analysis/teams?team=${ownTeam.id}`} icon={<BarChart2 size={16} />} label={t('teamAnalysis.title')} description={t('dashboard.teamAnalysisDesc')} color="var(--accent-teal-bright)" />
                <QuickLink to="/analysis/rival" icon={<Shield size={16} />} label={t('rivalScouting.title')} description={t('dashboard.rivalScoutingDesc')} color="var(--accent-loss)" />
                <QuickLink to="/reports/scrim" icon={<Target size={16} />} label={t('scrimReport.title')} description={t('dashboard.rivalScoutingDesc')} color="var(--accent-prime)" />
                <QuickLink to="/analysis/players" icon={<Users size={16} />} label={t('playerScouting.title')} description={t('dashboard.scoutPlayerDesc')} color="var(--accent-blue)" />
                <QuickLink to="/matches" icon={<BookOpen size={16} />} label={t('nav.matches')} description={t('dashboard.recentMatches')} color="var(--accent-violet)" />
              </div>
            </>
          )}

          {/* ── JUGADOR view ── */}
          {isJugador && (
            <JugadorDashboard
              playerProfile={playerProfile}
              ownMembership={ownMembership}
              ownTeam={ownTeam}
              scrimSchedule={scrimSchedule}
              comms={pendingComms}
            />
          )}

          {/* ── VIEWER / no team role ── */}
          {!isManager && !isCoach && !isAnalista && !isJugador && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <QuickLink to={`/analysis/teams?team=${ownTeam.id}`} icon={<BarChart2 size={16} />} label={t('teamAnalysis.title')} description={t('dashboard.teamAnalysisDesc')} color="var(--accent-teal-bright)" />
              <QuickLink to="/analysis/players" icon={<Users size={16} />} label={t('playerScouting.title')} description={t('dashboard.scoutPlayerDesc')} color="var(--accent-blue)" />
            </div>
          )}

          {/* Focus of the Day — stub for all team roles */}
          <FocusOfTheDay teamId={ownTeam.id} />
        </>
      )}

      {/* ── Manager with no team yet ─────────────────────────────────────── */}
      {isManagerWithNoTeam && <ManagerNoTeamPrompt />}

      {/* ── Standalone PLAYER (no team) ──────────────────────────────────── */}
      {!isManagerWithNoTeam && !isPlatformAdmin && (!ownTeam || viewAs === 'PLAYER') && (
        <PlayerStandaloneView />
      )}
    </div>
  );
}

// ── Side WR chips (DUSK / DAWN) ──────────────────────────────────────────────
function SideWRChips({ matches }: { matches: { teamSide: string; won: boolean | null }[] }) {
  const { t } = useTranslation();
  const dusk = matches.filter((m) => m.teamSide === 'DUSK');
  const dawn = matches.filter((m) => m.teamSide === 'DAWN');
  const duskWR = dusk.length > 0 ? Math.round((dusk.filter((m) => m.won).length / dusk.length) * 100) : null;
  const dawnWR = dawn.length > 0 ? Math.round((dawn.filter((m) => m.won).length / dawn.length) * 100) : null;
  if (duskWR === null && dawnWR === null) return null;
  return (
    <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'center' }}>
      {duskWR !== null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-teal-bright)', fontFamily: 'var(--font-mono)' }}>DUSK</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: duskWR >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{duskWR}%</span>
        </div>
      )}
      {dawnWR !== null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f87171', fontFamily: 'var(--font-mono)' }}>DAWN</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: dawnWR >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{dawnWR}%</span>
        </div>
      )}
      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{t('dashboard.winRate')}</div>
    </div>
  );
}

// ── Player stat summary (JUGADOR dashboard) ──────────────────────────────────
function PlayerStatSummary({ profile }: { profile: PlayerProfile }) {
  const { t } = useTranslation();
  const matches = profile.recentMatches.filter((m) => m.duration > 0);
  const avg = (vals: number[]) => vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;

  const csPerMin = avg(matches.filter((m) => m.laneMinionsKilled != null).map((m) => (m.laneMinionsKilled!) / (m.duration / 60)));
  const gpm = avg(matches.filter((m) => m.gold != null).map((m) => (m.gold!) / (m.duration / 60)));
  const dpm = avg(matches.filter((m) => m.heroDamage != null).map((m) => (m.heroDamage!) / (m.duration / 60)));

  const wr = profile.generalStats?.winRate as number | undefined;
  const kda = profile.generalStats?.kda as number | undefined;

  const chips = [
    { label: t('dashboard.winRate'), value: wr != null ? `${Math.round(wr)}%` : '—', color: wr != null && wr >= 50 ? 'var(--accent-win)' : wr != null ? 'var(--accent-loss)' : 'var(--text-muted)' },
    { label: t('playerScouting.kda'), value: kda != null ? kda.toFixed(2) : '—', color: 'var(--accent-teal-bright)' },
    { label: t('playerScouting.cs'), value: csPerMin != null ? csPerMin.toFixed(1) : '—', color: 'var(--text-primary)' },
    { label: 'GPM', value: gpm != null ? Math.round(gpm).toString() : '—', color: 'var(--text-primary)' },
    { label: 'DPM', value: dpm != null ? Math.round(dpm).toString() : '—', color: 'var(--accent-blue)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
      {chips.map(({ label, value, color }) => (
        <div key={label} className="glass-card" style={{ textAlign: 'center', padding: '0.9rem 0.75rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color }}>{value}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.15rem' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Player hero pool top 3 (JUGADOR dashboard) ────────────────────────────────
function PlayerHeroPool({ heroStats }: { heroStats: HeroStat[] }) {
  const { t } = useTranslation();
  const top3 = [...heroStats]
    .filter((h) => (h.matches ?? h.wins + h.losses) >= 3)
    .sort((a, b) => (b.matches ?? b.wins + b.losses) - (a.matches ?? a.wins + a.losses))
    .slice(0, 3);
  if (top3.length === 0) return null;
  return (
    <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>{t('playerScouting.heroPool')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {top3.map((h) => {
          const games = h.matches ?? h.wins + h.losses;
          const wr = h.winRate ?? (games > 0 ? Math.round((h.wins / games) * 100) : null);
          return (
            <div key={h.heroData.slug} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', minWidth: 90, textTransform: 'capitalize' }}>{h.heroData.name ?? h.heroData.slug}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{games}g</span>
              {wr != null && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: wr >= 55 ? 'var(--accent-win)' : wr < 45 ? 'var(--accent-loss)' : 'var(--text-primary)', marginLeft: 'auto' }}>{wr}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Focus of the Day ──────────────────────────────────────────────────────────
function FocusOfTheDay({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { internalAuthenticated } = useAuth();
  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(null);
  const [focusState, setFocusState] = useState<FocusState>('idle');
  const [output, setOutput] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    apiClient.analyst.llmStatus().then((r) => setLlmEnabled(r.enabled)).catch(() => setLlmEnabled(false));
    return () => { esRef.current?.close(); };
  }, []);

  if (!internalAuthenticated || llmEnabled === null) return null;

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
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => { setFocusState('error'); es.close(); };
  }

  if (!llmEnabled) {
    return (
      <div className="glass-card" style={{ borderLeft: '3px solid var(--accent-violet)', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Sparkles size={15} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Focus of the Day</span>
          <Link to="/admin/config" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--accent-blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            Activar en configuración <ArrowRight size={11} />
          </Link>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
          {t('comingSoon.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ borderLeft: '3px solid var(--accent-violet)', padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: output ? '0.75rem' : 0 }}>
        <Sparkles size={15} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Focus of the Day</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {focusState === 'done' && (
            <>
              <button onClick={() => { setFeedback('positive'); }} title="Útil" style={{ background: 'none', border: 'none', cursor: 'pointer', color: feedback === 'positive' ? 'var(--accent-win)' : 'var(--text-muted)', padding: 0 }}><ThumbsUp size={14} /></button>
              <button onClick={() => { setFeedback('negative'); }} title="No útil" style={{ background: 'none', border: 'none', cursor: 'pointer', color: feedback === 'negative' ? 'var(--accent-loss)' : 'var(--text-muted)', padding: 0 }}><ThumbsDown size={14} /></button>
            </>
          )}
          <button onClick={startStream} disabled={focusState === 'streaming'} className="btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.65rem' }}>
            {focusState === 'streaming' ? 'Analizando…' : focusState === 'done' ? 'Regenerar' : 'Generar análisis'}
          </button>
        </div>
      </div>
      {output && (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {output}
        </pre>
      )}
      {focusState === 'idle' && !output && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
          Genera un análisis táctico diario basado en los insights del equipo.
        </p>
      )}
      {focusState === 'error' && (
        <p style={{ color: 'var(--accent-loss)', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
          No se pudo generar el análisis. Inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}

// ── Roster form panel (Coach / Manager) ──────────────────────────────────────
function RosterFormPanel({ players }: { players: PlayerAnalysisStat[] }) {
  if (players.length === 0) return null;
  return (
    <div className="glass-card" style={{ padding: '0.9rem 1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <TrendingUp size={13} style={{ color: 'var(--accent-teal-bright)' }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Forma del roster</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {players.map((p) => {
          const wr = p.winRate ?? 0;
          const recentTotal = p.recentWins + p.recentLosses;
          const recentWR = recentTotal > 0 ? Math.round((p.recentWins / recentTotal) * 100) : null;
          const trend = recentWR !== null && wr > 0 ? (recentWR > wr + 5 ? '↑' : recentWR < wr - 5 ? '↓' : '→') : null;
          const trendColor = trend === '↑' ? 'var(--accent-win)' : trend === '↓' ? 'var(--accent-loss)' : 'var(--text-muted)';
          return (
            <div key={p.playerId} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 60, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.role ?? '—'}</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customName ?? p.displayName}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: wr >= 55 ? 'var(--accent-win)' : wr < 45 ? 'var(--accent-loss)' : 'var(--text-secondary)' }}>{Math.round(wr)}%</span>
              {trend && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.88rem', color: trendColor }}>{trend}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Scrim calendar panel ──────────────────────────────────────────────────────
function ScrimCalendarPanel({ items, teamId, role, onScrimAdded }: { items: ScrimScheduleItem[]; teamId: string; role: string; onScrimAdded?: (item: ScrimScheduleItem) => void }) {
  const upcoming = items.filter((i) => new Date(i.scheduledAt) >= new Date()).slice(0, 4);
  const canEdit = role === 'COACH' && !!onScrimAdded;
  return (
    <div className="glass-card" style={{ padding: '0.9rem 1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Calendar size={13} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>Calendario</span>
        {canEdit && onScrimAdded && <AddScrimButton teamId={teamId} onCreated={onScrimAdded} />}
      </div>
      {upcoming.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>No hay scrims programados</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {upcoming.map((item) => {
            const date = new Date(item.scheduledAt);
            const rival = item.rivalTeam?.name ?? item.rivalName ?? 'Rival por definir';
            const typeColor = item.type === 'OFFICIAL' ? 'var(--accent-loss)' : item.type === 'PRACTICE' ? 'var(--text-muted)' : 'var(--accent-blue)';
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ textAlign: 'center', minWidth: 36, flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{date.getDate()}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{date.toLocaleString(undefined, { month: 'short' })}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {rival}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{date.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: typeColor, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 5px', border: `1px solid ${typeColor}33`, borderRadius: 3 }}>
                  {item.type}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <Link to="/tools/scrims" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.75rem', fontSize: '0.68rem', color: 'var(--accent-blue)', textDecoration: 'none', justifyContent: 'flex-end' }}>
        Ver todos <ChevronRight size={11} />
      </Link>
    </div>
  );
}

// ── Add scrim button (inline form) ────────────────────────────────────────────
function AddScrimButton({ teamId, onCreated }: { teamId: string; onCreated: (item: ScrimScheduleItem) => void }) {
  const [open, setOpen] = useState(false);
  const [dt, setDt] = useState('');
  const [rival, setRival] = useState('');
  const [type, setType] = useState<'SCRIM' | 'OFFICIAL' | 'PRACTICE'>('SCRIM');
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}>
        <PlusCircle size={12} /> Añadir
      </button>
    );
  }

  const handleSave = async () => {
    if (!dt) return;
    setSaving(true);
    try {
      const r = await apiClient.schedule.create({ teamId, scheduledAt: new Date(dt).toISOString(), type, rivalName: rival || undefined });
      toast.success('Scrim añadido');
      setOpen(false); setDt(''); setRival(''); setType('SCRIM');
      onCreated(r.item);
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} style={{ fontSize: '0.72rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-primary)' }} />
      <input placeholder="Rival" value={rival} onChange={(e) => setRival(e.target.value)} style={{ fontSize: '0.72rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-primary)', width: 90 }} />
      <select value={type} onChange={(e) => setType(e.target.value as typeof type)} style={{ fontSize: '0.72rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 4px', color: 'var(--text-primary)' }}>
        <option value="SCRIM">Scrim</option>
        <option value="OFFICIAL">Oficial</option>
        <option value="PRACTICE">Practice</option>
      </select>
      <button onClick={() => void handleSave()} disabled={saving || !dt} className="btn-primary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Guardar</button>
      <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.7rem' }}>✕</button>
    </div>
  );
}

// ── Coach comms panel (compose + manage) ─────────────────────────────────────
function CoachCommsPanel({ teamId, roster: _roster, items, onCreated, onUpdate }: {
  teamId: string;
  roster: Array<{ playerId: string; displayName: string; customName: string | null; role: string | null }>;
  items: TeamCommItem[];
  onCreated: (item: TeamCommItem) => void;
  onUpdate: (id: string, status: TeamCommItem['status']) => void;
}) {
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  // 'team' = broadcast, 'JUGADOR' = all players, 'ANALISTA' = analyst
  const [toTarget, setToTarget] = useState<'team' | 'JUGADOR' | 'ANALISTA'>('team');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [saving, setSaving] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const payload: Parameters<typeof apiClient.comms.create>[0] = {
        teamId,
        type: toTarget === 'team' ? 'ANNOUNCEMENT' : 'REQUEST',
        subject: subject.trim(),
        body: body.trim(),
        priority,
        ...(toTarget !== 'team' ? { toRole: toTarget } : {}),
      };
      const r = await apiClient.comms.create(payload);
      onCreated(r.item);
      toast.success('Mensaje enviado');
      setComposing(false); setSubject(''); setBody(''); setToTarget('team'); setPriority('normal');
    } catch { toast.error('Error al enviar'); }
    finally { setSaving(false); }
  };

  return (
    <div className="glass-card" style={{ padding: '0.9rem 1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: composing ? '0.85rem' : items.length ? '0.75rem' : 0 }}>
        <MessageSquare size={13} style={{ color: 'var(--accent-violet)' }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>Mensajes</span>
        {!composing && (
          <button onClick={() => setComposing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}>
            <PlusCircle size={12} /> Nuevo
          </button>
        )}
      </div>

      {composing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.85rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
          {/* To selector */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>Para:</span>
            <select value={toTarget} onChange={(e) => setToTarget(e.target.value as typeof toTarget)}
              style={{ fontSize: '0.78rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '3px 7px', color: 'var(--text-primary)', flex: 1 }}>
              <option value="team">Todo el equipo</option>
              <option value="JUGADOR">Jugadores</option>
              <option value="ANALISTA">Analista</option>
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
              style={{ fontSize: '0.72rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '3px 6px', color: priority === 'urgent' ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <input placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)}
            style={{ fontSize: '0.82rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '5px 8px', color: 'var(--text-primary)' }} />
          <textarea placeholder="Mensaje…" value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            style={{ fontSize: '0.8rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '5px 8px', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button onClick={() => { setComposing(false); setSubject(''); setBody(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem' }}>Cancelar</button>
            <button onClick={() => void handleSend()} disabled={saving || !subject.trim() || !body.trim()} className="btn-primary" style={{ fontSize: '0.78rem', padding: '4px 12px' }}>Enviar</button>
          </div>
        </div>
      )}

      {items.length === 0 && !composing && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Sin mensajes abiertos</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {items.slice(0, 5).map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                {item.priority === 'urgent' && <AlertTriangle size={11} style={{ color: 'var(--accent-loss)', flexShrink: 0 }} />}
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subject}</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {item.fromUser.name} → {item.toUser?.name ?? item.toRole ?? 'equipo'} · <span style={{ color: item.status === 'IN_PROGRESS' ? 'var(--accent-blue)' : 'var(--text-muted)' }}>{item.status}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.body}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flexShrink: 0 }}>
              {item.status === 'OPEN' && (
                <button onClick={() => onUpdate(item.id, 'IN_PROGRESS')} style={{ fontSize: '0.62rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', color: 'var(--accent-blue)', whiteSpace: 'nowrap' }}>En proceso</button>
              )}
              <button onClick={() => onUpdate(item.id, 'DONE')} style={{ fontSize: '0.62rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', color: 'var(--accent-win)', whiteSpace: 'nowrap' }}>Hecho</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Player comms panel (read-only — messages FROM coach) ──────────────────────
function PlayerCommsPanel({ items }: { items: TeamCommItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="glass-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '3px solid var(--accent-violet)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Bell size={13} style={{ color: 'var(--accent-violet)' }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mensajes del coach</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {items.slice(0, 5).map((item) => (
          <div key={item.id} style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              {item.priority === 'urgent' && <AlertTriangle size={11} style={{ color: 'var(--accent-loss)', flexShrink: 0 }} />}
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.subject}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{item.fromUser.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── JUGADOR dashboard (team roster player) ────────────────────────────────────
function JugadorDashboard({ playerProfile, ownMembership, ownTeam, scrimSchedule, comms }: {
  playerProfile: PlayerProfile | null;
  ownMembership: { role: string; playerId: string | null } | null | undefined;
  ownTeam: TeamProfile | null;
  scrimSchedule: ScrimScheduleItem[];
  comms: TeamCommItem[];
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'team' | 'soloq'>('team');

  const nextScrim = scrimSchedule.filter((s) => new Date(s.scheduledAt) >= new Date())[0] ?? null;

  return (
    <>
      {/* Próximo scrim */}
      {nextScrim && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Clock size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Próximo {nextScrim.type}</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>vs {nextScrim.rivalTeam?.name ?? nextScrim.rivalName ?? 'Rival por confirmar'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {new Date(nextScrim.scheduledAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['team', 'soloq'] as const).map((t_key) => (
          <button key={t_key} onClick={() => setTab(t_key)} style={{ padding: '0.35rem 0.9rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: tab === t_key ? 'var(--accent-blue)' : 'var(--bg-card)', color: tab === t_key ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>
            {t_key === 'team' ? 'Equipo' : 'SoloQ'}
          </button>
        ))}
      </div>

      {tab === 'team' && (
        <>
          {/* Messages from coach */}
          {comms.length > 0 && <PlayerCommsPanel items={comms} />}

          {/* Coach tasks — player goals */}
          <PlayerGoalsWidget playerId={ownMembership?.playerId ?? null} teamId={ownTeam?.id ?? ''} />

          {/* Own recent perf */}
          {playerProfile && (
            <>
              <PlayerStatSummary profile={playerProfile} />
              <PlayerHeroPool heroStats={playerProfile.heroStats} />
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {ownMembership?.playerId && (
              <QuickLink to="/analysis/players" state={{ autoLoadPlayerId: ownMembership.playerId }} icon={<Users size={16} />} label={t('playerScouting.title')} description={t('dashboard.scoutPlayerDesc')} color="var(--accent-teal-bright)" />
            )}
            <QuickLink to="/tools/review" icon={<Star size={16} />} label={t('reviewQueue.title')} description={t('dashboard.reviewMatchesDesc')} color="var(--accent-prime)" />
          </div>
        </>
      )}

      {tab === 'soloq' && playerProfile && (
        <>
          <PlayerStatSummary profile={playerProfile} />
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>{t('dashboard.recentMatches')}</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {playerProfile.recentMatches.slice(0, 8).map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: m.result === 'win' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${m.result === 'win' ? 'var(--accent-win)' : 'var(--accent-loss)'}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: m.result === 'win' ? 'var(--accent-win)' : 'var(--accent-loss)', fontFamily: 'var(--font-mono)' }}>{m.result === 'win' ? 'W' : 'L'}</span>
                  </div>
                  <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{m.kills}/{m.deaths}/{m.assists}</span>
                </div>
              ))}
            </div>
          </div>
          <PlayerHeroPool heroStats={playerProfile.heroStats} />
        </>
      )}
    </>
  );
}

// ── Player goals widget (for JUGADOR — tasks assigned by coach) ───────────────
function PlayerGoalsWidget({ playerId, teamId }: { playerId: string | null; teamId: string }) {
  const [goals, setGoals] = useState<Array<{ id: string; title: string; targetValue: number | null; currentValue: number | null; status: string }>>([]);
  useEffect(() => {
    if (!playerId || !teamId) return;
    apiClient.goals.listPlayer(teamId, playerId).then((r) => setGoals(r.goals.filter((g) => g.status === 'ACTIVE'))).catch(() => null);
  }, [playerId, teamId]);
  if (goals.length === 0) return null;
  return (
    <div className="glass-card" style={{ padding: '0.9rem 1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
        <Target size={13} style={{ color: 'var(--accent-prime)' }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Objetivos del coach</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {goals.map((g) => {
          const pct = g.targetValue && g.currentValue != null ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : null;
          return (
            <div key={g.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{g.title}</span>
                {pct !== null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{pct}%</span>}
              </div>
              {pct !== null && (
                <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--accent-win)' : 'var(--accent-blue)', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PlayerSyncWidget (kept for compatibility) ─────────────────────────────────
function PlayerSyncWidget() {
  return null;
}
export { PlayerSyncWidget };

// ── Manager no-team prompt ────────────────────────────────────────────────────
function ManagerNoTeamPrompt() {
  const { t } = useTranslation();
  return (
    <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem', borderLeft: '3px solid var(--accent-teal-bright)' }}>
      <PlusCircle size={36} style={{ margin: '0 auto 0.85rem', color: 'var(--accent-teal-bright)', opacity: 0.8 }} />
      <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
        {t('dashboard.managerNoTeam')}
      </p>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 1.5rem' }}>
        {t('dashboard.managerNoTeamDesc')}
      </p>
      <Link to="/analysis/teams" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', padding: '0.55rem 1.25rem' }}>
        <PlusCircle size={15} /> {t('dashboard.createTeam')}
      </Link>
    </div>
  );
}

// ── Weekly goal widget (Standalone Player) ────────────────────────────────────
function WeeklyGoalWidget({ goals, onGoalsChange }: { goals: WeeklyGoalItem[]; onGoalsChange: (g: WeeklyGoalItem[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const r = await apiClient.weeklyGoals.create({ title: newTitle.trim(), targetValue: newTarget ? parseFloat(newTarget) : undefined });
      onGoalsChange([...goals, r.goal]);
      setAdding(false); setNewTitle(''); setNewTarget('');
    } catch { toast.error('Error al crear objetivo'); }
    finally { setSaving(false); }
  };

  const handleProgress = async (goal: WeeklyGoalItem, delta: number) => {
    const next = Math.max(0, goal.currentValue + delta);
    try {
      const r = await apiClient.weeklyGoals.update(goal.id, { currentValue: next, status: goal.targetValue && next >= goal.targetValue ? 'ACHIEVED' : 'ACTIVE' });
      onGoalsChange(goals.map((g) => g.id === goal.id ? r.goal : g));
    } catch { toast.error('Error'); }
  };

  return (
    <div className="glass-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '3px solid var(--accent-prime)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Trophy size={13} style={{ color: 'var(--accent-prime)' }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>Objetivo semanal</span>
        {!adding && (
          <button onClick={() => goals.length < 3 && setAdding(true)} disabled={goals.length >= 3} title={goals.length >= 3 ? 'Máximo 3 objetivos semanales' : undefined} style={{ background: 'none', border: 'none', cursor: goals.length >= 3 ? 'not-allowed' : 'pointer', color: goals.length >= 3 ? 'var(--text-muted)' : 'var(--accent-blue)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0, opacity: goals.length >= 3 ? 0.45 : 1 }}>
            <PlusCircle size={12} /> Añadir
          </button>
        )}
      </div>

      {goals.length === 0 && !adding && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>No hay objetivos esta semana. ¡Añade uno!</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {goals.map((g) => {
          const pct = g.targetValue ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : null;
          const achieved = g.status === 'ACHIEVED';
          return (
            <div key={g.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: achieved ? 'var(--accent-win)' : 'var(--text-primary)' }}>
                  {achieved ? '✓ ' : ''}{g.title}
                </span>
                {g.targetValue && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {g.currentValue.toFixed(1)} / {g.targetValue}
                  </span>
                )}
                {!achieved && (
                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                    <button onClick={() => handleProgress(g, -1)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 3, width: 20, height: 20, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>−</button>
                    <button onClick={() => handleProgress(g, 1)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 3, width: 20, height: 20, cursor: 'pointer', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>+</button>
                  </div>
                )}
              </div>
              {pct !== null && (
                <div style={{ height: 5, background: 'var(--border-color)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: achieved ? 'var(--accent-win)' : 'var(--accent-prime)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.65rem', flexWrap: 'wrap' }}>
          <input autoFocus placeholder="¿Qué quieres mejorar esta semana?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ flex: 1, minWidth: 160, fontSize: '0.78rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '4px 8px', color: 'var(--text-primary)' }} />
          <input placeholder="Meta (ej: 7.5)" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} type="number" style={{ width: 80, fontSize: '0.78rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '4px 8px', color: 'var(--text-primary)' }} />
          <button onClick={() => void handleAdd()} disabled={saving || !newTitle.trim()} className="btn-primary" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>Guardar</button>
          <button onClick={() => { setAdding(false); setNewTitle(''); setNewTarget(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem' }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── Standalone Player view (PLAYER globalRole, no team) ───────────────────────
function PlayerStandaloneView() {
  const { t } = useTranslation();
  const { user, refreshInternalSession } = useAuth();
  const linkedId = (user as { linkedPlayerId?: string | null })?.linkedPlayerId;

  // All hooks before any conditional returns
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkedIdState, setLinkedIdState] = useState(linkedId);
  const [myGoals, setMyGoals] = useState<WeeklyGoalItem[]>([]);

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

  useEffect(() => {
    apiClient.weeklyGoals.mine().then((r) => setMyGoals(r.goals)).catch(() => null);
  }, []);

  if (!linkedIdState) {
    return (
      <>
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <Users size={36} style={{ margin: '0 auto 0.85rem', opacity: 0.3, color: 'var(--accent-teal-bright)' }} />
          <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            {t('linkPlayerModal.title')}
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            {t('linkPlayerModal.description')}
          </p>
          <button
            onClick={() => setShowLinkModal(true)}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', padding: '0.55rem 1.25rem' }}
          >
            {t('matchList.searchProfile')}
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

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>{t('common.loading')}</div>;

  if (!profile) return null;

  const wr = profile.generalStats?.winRate ? Math.round(profile.generalStats.winRate as number) : null;
  const kda = profile.generalStats?.kda ? (profile.generalStats.kda as number).toFixed(2) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        {[
          { label: t('playerScouting.kda'), value: kda ?? '—', color: 'var(--accent-teal-bright)' },
          { label: t('dashboard.winRate'), value: wr ? `${wr}%` : '—', color: wr && wr >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)' },
          { label: t('dashboard.matches'), value: profile.recentMatches.length, color: 'var(--text-primary)' },
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
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>{t('dashboard.recentMatches')}</div>
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

      {/* Weekly goal */}
      <WeeklyGoalWidget goals={myGoals} onGoalsChange={setMyGoals} />

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <Link to="/analysis/players" state={{ autoLoadPlayerId: linkedId }} style={{ textDecoration: 'none' }}>
          <div className="glass-card landing-feature-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.1rem', cursor: 'pointer', borderLeft: '3px solid var(--accent-teal-bright)' }}>
            <Users size={18} style={{ color: 'var(--accent-teal-bright)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{t('playerScouting.title')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{t('dashboard.scoutPlayerDesc')}</div>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
          </div>
        </Link>
        <Link to="/matches" style={{ textDecoration: 'none' }}>
          <div className="glass-card landing-feature-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.1rem', cursor: 'pointer', borderLeft: '3px solid var(--accent-violet)' }}>
            <BookOpen size={18} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{t('nav.matches')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{t('dashboard.recentMatches')}</div>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
          </div>
        </Link>
      </div>
    </div>
  );
}
