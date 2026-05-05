import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Coins,
  LogIn,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  Swords,
  Target,
  Trophy,
  User,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type PlayerProfile, type PlayerSearchResult, type SyncedPlayer, ApiErrorResponse } from '../api/client';
import { useAuth } from '../hooks/useAuth';

type Phase =
  | { tag: 'idle' }
  | { tag: 'searching' }
  | { tag: 'results'; players: PlayerSearchResult[] }
  | { tag: 'empty'; query: string }          // local DB has nothing
  | { tag: 'syncing'; step: string }         // fetching from pred.gg
  | { tag: 'synced'; player: SyncedPlayer }  // pred.gg found + saved
  | { tag: 'not_found'; query: string }      // pred.gg also has nothing
  | { tag: 'error'; message: string };

type ProfilePhase =
  | { tag: 'idle' }
  | { tag: 'loading'; playerId: string }
  | { tag: 'loaded'; profile: PlayerProfile }
  | { tag: 'error'; message: string };

export default function PlayerScouting() {
  const { authenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>({ tag: 'idle' });
  const [profilePhase, setProfilePhase] = useState<ProfilePhase>({ tag: 'idle' });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setPhase({ tag: 'searching' });
    try {
      const data = await apiClient.players.search(q);
      const players = data.results ?? [];
      setPhase(players.length > 0 ? { tag: 'results', players } : { tag: 'empty', query: q });
      setProfilePhase({ tag: 'idle' });
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Search failed.';
      setPhase({ tag: 'error', message: msg });
    }
  }

  async function handleSyncFromPredgg(name: string) {
    setPhase({ tag: 'syncing', step: 'Connecting to pred.gg...' });

    // Small delay so the user sees the step before the actual request fires
    await new Promise((r) => setTimeout(r, 400));
    setPhase({ tag: 'syncing', step: `Searching for "${name}" on pred.gg...` });

    try {
      const res = await apiClient.players.sync(name);
      setPhase({ tag: 'syncing', step: 'Saving to local database...' });
      await new Promise((r) => setTimeout(r, 300));
      setPhase({ tag: 'synced', player: res.player });
      toast.success(`"${res.player.displayName}" synced successfully`);
      void handleSelectPlayer(res.player.id);
    } catch (err) {
      if (err instanceof ApiErrorResponse && err.status === 404) {
        setPhase({ tag: 'not_found', query: name });
      } else if (err instanceof ApiErrorResponse && err.error.code === 'PREDGG_AUTH_REQUIRED') {
        setPhase({ tag: 'error', message: 'pred.gg requires login to search players. Use the "Login with pred.gg" button in the sidebar.' });
      } else {
        const msg = err instanceof ApiErrorResponse ? err.error.message : 'Sync failed.';
        setPhase({ tag: 'error', message: msg });
        toast.error(msg);
      }
    }
  }

  function reset() {
    setPhase({ tag: 'idle' });
    setProfilePhase({ tag: 'idle' });
    setQuery('');
  }

  async function handleSelectPlayer(playerId: string) {
    setProfilePhase({ tag: 'loading', playerId });
    try {
      const profile = await apiClient.players.getProfile(playerId);
      setProfilePhase({ tag: 'loaded', profile });
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Could not load player profile.';
      setProfilePhase({ tag: 'error', message: msg });
      toast.error(msg);
    }
  }

  // Refresh the currently-viewed player profile in place — does NOT collapse the
  // profile panel. Syncs from pred.gg first then reloads from the local DB.
  async function handleRefreshProfile(displayName: string, playerId: string) {
    const toastId = toast.loading(`Syncing "${displayName}" from pred.gg...`);
    setProfilePhase({ tag: 'loading', playerId });
    try {
      await apiClient.players.sync(displayName);
      const profile = await apiClient.players.getProfile(playerId);
      setProfilePhase({ tag: 'loaded', profile });
      toast.success('Profile updated', { id: toastId });
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Sync failed.';
      toast.error(msg, { id: toastId });
      // Reload what we had before rather than leaving a blank panel
      try {
        const profile = await apiClient.players.getProfile(playerId);
        setProfilePhase({ tag: 'loaded', profile });
      } catch {
        setProfilePhase({ tag: 'error', message: msg });
      }
    }
  }

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Player Scouting</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Search the local database or fetch directly from pred.gg.
        </p>
      </header>

      {/* Search bar */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              color="var(--text-muted)"
              size={20}
              style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Enter player name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={phase.tag === 'searching' || phase.tag === 'syncing'}
              style={{
                width: '100%', background: 'var(--bg-dark)',
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                padding: '1rem 1rem 1rem 3rem', color: 'var(--text-primary)',
                outline: 'none', fontSize: '1rem',
                opacity: (phase.tag === 'searching' || phase.tag === 'syncing') ? 0.6 : 1,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={phase.tag === 'searching' || phase.tag === 'syncing' || !query.trim()}
            className="btn-primary"
            style={{ padding: '0 2rem' }}
          >
            {phase.tag === 'searching' ? 'Searching...' : 'Search'}
          </button>
          {phase.tag !== 'idle' && (
            <button type="button" onClick={reset} className="btn-secondary" style={{ padding: '0 1rem' }}>
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Phase: searching */}
      {phase.tag === 'searching' && (
        <StatusCard icon={<Spinner />} title="Searching local database..." color="var(--accent-blue)" />
      )}

      {profilePhase.tag !== 'idle' && (
        <div style={{ marginBottom: '2rem' }}>
          {profilePhase.tag === 'loading' && (
            <StatusCard icon={<Spinner />} title="Loading player profile..." color="var(--accent-blue)" />
          )}
          {profilePhase.tag === 'error' && (
            <StatusCard
              icon={<AlertCircle color="var(--accent-danger)" size={24} />}
              title={profilePhase.message}
              color="var(--accent-danger)"
            />
          )}
          {profilePhase.tag === 'loaded' && (
            <PlayerProfilePanel
              profile={profilePhase.profile}
              onClose={() => setProfilePhase({ tag: 'idle' })}
              onRefresh={authenticated ? () => void handleRefreshProfile(profilePhase.profile.displayName, profilePhase.profile.id) : undefined}
            />
          )}
        </div>
      )}

      {/* Phase: results */}
      {phase.tag === 'results' && (
        <>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {phase.players.length} player{phase.players.length !== 1 ? 's' : ''} found in local database
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {phase.players.map((p) => (
              <PlayerCard key={p.id} player={p} onSelect={() => void handleSelectPlayer(p.id)} />
            ))}
          </div>
        </>
      )}

      {/* Phase: empty — player not in local DB */}
      {phase.tag === 'empty' && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <Search color="var(--text-muted)" size={40} />
          </div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            "{phase.query}" not in local database
          </h3>
          {authenticated ? (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Fetch the player directly from pred.gg and save them locally.
              </p>
              <button
                onClick={() => void handleSyncFromPredgg(phase.query)}
                className="btn-primary"
                style={{ padding: '0.75rem 2rem' }}
              >
                Fetch from pred.gg
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Login with pred.gg to search and sync players from the API.
              </p>
              <a href={apiClient.auth.loginUrl()} className="btn-primary" style={{ padding: '0.75rem 2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <LogIn size={16} /> Login with pred.gg
              </a>
            </>
          )}
        </div>
      )}

      {/* Phase: syncing — step-by-step progress */}
      {phase.tag === 'syncing' && (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Spinner size={40} color="var(--accent-purple)" />
          </div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Syncing player...</h3>
          <p style={{ color: 'var(--accent-blue)', fontSize: '0.875rem', fontWeight: 500 }}>
            {phase.step}
          </p>
          <SyncSteps currentStep={phase.step} />
        </div>
      )}

      {/* Phase: synced — player found and saved */}
      {phase.tag === 'synced' && (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <CheckCircle color="var(--accent-success)" size={24} />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Player synced successfully</h3>
          </div>
          <PlayerCard
            player={{
              id: phase.player.id,
              displayName: phase.player.displayName,
              isPrivate: phase.player.isPrivate,
              inferredRegion: phase.player.inferredRegion,
              lastSynced: phase.player.lastSynced.toString(),
            }}
            onSelect={() => void handleSelectPlayer(phase.player.id)}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem' }}>
            Player is now saved locally. Search for them anytime without fetching again.
          </p>
        </div>
      )}

      {/* Phase: not found on pred.gg */}
      {phase.tag === 'not_found' && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <XCircle color="var(--accent-danger)" size={40} style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Player not found
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            "{phase.query}" was not found on pred.gg. Check the spelling and try again.
          </p>
        </div>
      )}

      {/* Phase: error */}
      {phase.tag === 'error' && (
        <StatusCard
          icon={<AlertCircle color="var(--accent-danger)" size={24} />}
          title={phase.message}
          color="var(--accent-danger)"
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PlayerCard({
  player,
  onSelect,
}: {
  player: { id: string; displayName: string; isPrivate: boolean; inferredRegion: string | null; lastSynced: string };
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="glass-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        textAlign: 'left',
        color: 'var(--text-primary)',
        cursor: onSelect ? 'pointer' : 'default',
      }}
    >
      <div style={{ background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: '50%', flexShrink: 0 }}>
        <User size={24} color={player.isPrivate ? 'var(--text-muted)' : 'var(--accent-blue)'} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.customName ?? player.displayName}
          {player.isPrivate && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem',
              background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
              private
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
          {player.inferredRegion ?? 'Region unknown'}
          <span style={{ margin: '0 0.4rem' }}>·</span>
          Last synced {new Date(player.lastSynced).toLocaleDateString()}
        </div>
      </div>
    </button>
  );
}

function PlayerProfilePanel({
  profile,
  onClose,
  onRefresh,
}: {
  profile: PlayerProfile;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const primaryRole = getPrimaryRole(profile);
  const topHero = profile.heroStats[0] ?? null;
  const favoriteHero = getFavoriteHero(profile.generalStats);
  const headerHero = topHero?.heroData ?? favoriteHero;
  const heroBySlug = new Map(profile.heroStats.map((hero) => [hero.heroData.slug, hero]));
  const matches = getGeneralNumber(profile.generalStats, 'matches');
  const winRate = getGeneralNumber(profile.generalStats, 'winRate');
  const kda = getGeneralNumber(profile.generalStats, 'kda');
  const heroDamage = getGeneralNumber(profile.generalStats, 'heroDamage');

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          background:
            'linear-gradient(135deg, rgba(56,212,200,0.09), rgba(91,156,246,0.07) 45%, rgba(167,139,250,0.06))',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '0.5rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flex: '0 0 auto' }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="btn-secondary"
              style={{ padding: '0.5rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flex: '0 0 auto' }}
            >
              <RefreshCw size={16} /> Refresh
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <HeroAvatar
            hero={headerHero}
            size={88}
            rounded={18}
          />

          <div style={{ minWidth: 0, flex: '1 1 18rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '2rem', lineHeight: 1.05 }}>{profile.customName ?? profile.displayName}</h2>
              {primaryRole && <RoleBadge role={primaryRole} size="large" />}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={14} /> {profile.inferredRegion ?? 'Region unknown'}
              </span>
              <span>Last synced {new Date(profile.lastSynced).toLocaleString()}</span>
              <span>{profile.isPrivate ? 'Private profile' : 'Public profile'}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right', minWidth: '8.5rem', flex: '0 1 8.5rem' }}>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Rank</div>
            <div style={{ color: 'var(--accent-win)', fontWeight: 700, fontSize: '0.95rem' }}>
              {profile.rating?.rankLabel ?? 'Unranked'}
            </div>
            {profile.rating?.ratingPoints !== null && profile.rating?.ratingPoints !== undefined && (
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>{Math.round(profile.rating.ratingPoints)} VP</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
          <SummaryMetric label="Matches" value={matches !== null ? formatCompactNumber(matches) : '-'} />
          <SummaryMetric label="Win Rate" value={winRate !== null ? `${winRate.toFixed(1)}%` : '-'} />
          <SummaryMetric label="KDA" value={kda !== null ? kda.toFixed(2) : '-'} />
          <SummaryMetric label="Hero Damage" value={heroDamage !== null ? formatCompactNumber(heroDamage) : '-'} />
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>
        <section style={{ marginBottom: '1.5rem' }}>
          <SectionTitle icon={<Swords size={18} />} title="Comfort Heroes" />
          {profile.heroStats.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {profile.heroStats.slice(0, 6).map((hero, index) => (
                <HeroStatCard key={`${hero.heroData.slug}-${index}`} hero={hero} />
              ))}
            </div>
          ) : (
            <EmptyStatsText />
          )}
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <SectionTitle icon={<Shield size={18} />} title="Role Performance" />
          {profile.roleStats.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {profile.roleStats.map((role) => (
                <RoleStatCard key={role.role} role={role} />
              ))}
            </div>
          ) : (
            <EmptyStatsText />
          )}
        </section>

        <section>
          <MatchesSection matches={profile.recentMatches} heroBySlug={heroBySlug} />
        </section>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 0.8rem', background: 'rgba(10,12,16,0.5)' }}>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.67rem', fontWeight: 700, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  );
}

function HeroStatCard({ hero }: { hero: PlayerProfile['heroStats'][number] }) {
  const matches = hero.matches ?? hero.wins + hero.losses;
  const winrate = typeof hero.winRate === 'number' ? hero.winRate : matches > 0 ? Math.round((hero.wins / matches) * 1000) / 10 : 0;
  const deaths = Math.max(hero.deaths, 1);
  const kda = (hero.kills + hero.assists) / deaths;

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.85rem', background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <HeroAvatar hero={hero.heroData} size={54} rounded={12} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hero.heroData.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{matches} games</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
        <MiniMetric label="WR" value={`${winrate.toFixed(1)}%`} />
        <MiniMetric label="W/L" value={`${hero.wins}/${hero.losses}`} />
        <MiniMetric label="KDA" value={kda.toFixed(2)} />
      </div>
    </div>
  );
}

function RoleStatCard({ role }: { role: PlayerProfile['roleStats'][number] }) {
  const winrate = typeof role.winRate === 'number'
    ? role.winRate
    : role.matches > 0
      ? Math.round((role.wins / role.matches) * 1000) / 10
      : 0;
  const kda = typeof role.kills === 'number' && typeof role.assists === 'number' && typeof role.deaths === 'number'
    ? (role.kills + role.assists) / Math.max(role.deaths, 1)
    : null;

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.85rem', background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <RoleBadge role={role.role} />
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{role.matches} games</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
        <MiniMetric label="WR" value={`${winrate.toFixed(1)}%`} />
        <MiniMetric label="W/L" value={`${role.wins}/${role.losses}`} />
        <MiniMetric label="KDA" value={kda !== null ? kda.toFixed(2) : '-'} />
      </div>
    </div>
  );
}

// ── Game mode helpers ────────────────────────────────────────────────────────

const GAME_MODE_LABELS: Record<string, string> = {
  RANKED: 'Ranked', STANDARD: 'Normal', ARAM: 'ARAM',
  CUSTOM: 'Custom', PRACTICE: 'Practice', SOLO: 'Solo',
  ARENA: 'Arena', DAYBREAK: 'Daybreak', RUSH: 'Rush',
  TEAM_VS_AI: 'vs AI', LEGACY: 'Legacy', NONE: 'Unknown',
};

function gameModeLabel(mode: string): string {
  return GAME_MODE_LABELS[mode] ?? mode;
}

function MatchesSection({
  matches,
  heroBySlug,
}: {
  matches: PlayerProfile['recentMatches'];
  heroBySlug: Map<string, { heroData: { name: string; imageUrl?: string | null } }>;
}) {
  const [activeMode, setActiveMode] = React.useState<string>('ALL');

  const modes = ['ALL', ...Array.from(new Set(matches.map((m) => m.gameMode))).sort()];
  const filtered = activeMode === 'ALL' ? matches : matches.filter((m) => m.gameMode === activeMode);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>
          <Calendar size={18} /> Recent Matches
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({filtered.length}{activeMode !== 'ALL' ? ` ${gameModeLabel(activeMode)}` : ''})</span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              style={{
                fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem',
                borderRadius: '999px', cursor: 'pointer',
                border: activeMode === mode ? '1px solid var(--accent-violet)' : '1px solid var(--border-color)',
                background: activeMode === mode ? 'rgba(167,139,250,0.14)' : 'rgba(255,255,255,0.03)',
                color: activeMode === mode ? 'var(--accent-violet)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                transition: 'all 0.15s',
              }}
            >
              {mode === 'ALL' ? 'All' : gameModeLabel(mode)}
            </button>
          ))}
        </div>
      </div>
      {filtered.length > 0 ? (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflowX: 'auto', overflowY: 'hidden' }}>
          {filtered.map((match) => {
            const hero = heroBySlug.get(match.heroSlug);
            return (
              <MatchRow
                key={match.matchId}
                match={match}
                hero={{
                  slug: match.heroSlug,
                  name: match.heroName ?? hero?.heroData.name ?? match.heroSlug,
                  imageUrl: match.heroImageUrl ?? hero?.heroData.imageUrl ?? null,
                }}
              />
            );
          })}
        </div>
      ) : (
        <EmptyStatsText />
      )}
    </>
  );
}

function MatchRow({
  match,
  hero,
}: {
  match: PlayerProfile['recentMatches'][number];
  hero: { slug: string; name: string; imageUrl?: string | null };
}) {
  const minutes = match.duration > 0 ? match.duration / 60 : 0;
  const gpm = minutes > 0 && match.gold !== null ? Math.round(match.gold / minutes) : null;
  const dpm = minutes > 0 && match.heroDamage !== null ? Math.round(match.heroDamage / minutes) : null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(190px, 1.4fr) minmax(94px, 0.7fr) repeat(5, minmax(74px, 0.55fr))',
        gap: '0.75rem',
        alignItems: 'center',
        minWidth: '760px',
        padding: '0.8rem 0.9rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(255,255,255,0.02)',
        fontSize: '0.84rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        <HeroAvatar hero={hero} size={44} rounded={10} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hero.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span>{new Date(match.date).toLocaleDateString()}</span>
            <span style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.05rem 0.35rem', fontSize: '0.62rem', fontWeight: 500 }}>
              {gameModeLabel(match.gameMode)}
            </span>
          </div>
        </div>
      </div>

      <div>{match.role ? <RoleBadge role={match.role} compact /> : <span style={{ color: 'var(--text-muted)' }}>No role</span>}</div>
      <ResultPill result={match.result} />
      <MatchMetric label="KDA" value={`${match.kills}/${match.deaths}/${match.assists}`} />
      <MatchMetric icon={<Coins size={13} />} label="GPM" value={gpm !== null ? String(gpm) : '-'} />
      <MatchMetric icon={<Target size={13} />} label="DPM" value={dpm !== null ? String(dpm) : '-'} />
      <MatchMetric icon={<Clock size={13} />} label="Time" value={formatDuration(match.duration)} />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.45rem', background: 'rgba(10,12,16,0.4)' }}>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.63rem', fontWeight: 700, marginBottom: '0.18rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.82rem' }}>{value}</div>
    </div>
  );
}

function MatchMetric({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-dim)', fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.12rem' }}>
        {icon}
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

function ResultPill({ result }: { result: 'win' | 'loss' | 'unknown' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '4.4rem',
        padding: '0.28rem 0.4rem',
        borderRadius: '999px',
        border: `1px solid ${resultColor(result)}`,
        color: resultColor(result),
        background: resultBackground(result),
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {result}
    </span>
  );
}

function RoleBadge({ role, compact = false, size = 'normal' }: { role: string; compact?: boolean; size?: 'normal' | 'large' }) {
  const meta = getRoleMeta(role);
  const iconSize = size === 'large' ? 16 : 14;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '0.25rem' : '0.4rem',
        width: compact ? 'fit-content' : undefined,
        padding: size === 'large' ? '0.42rem 0.65rem' : '0.3rem 0.5rem',
        borderRadius: '999px',
        border: `1px solid ${meta.color}`,
        color: meta.color,
        background: `${meta.color}1f`,
        fontSize: size === 'large' ? '0.82rem' : '0.74rem',
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {roleIcon(meta.key, iconSize)}
      {!compact && meta.label}
    </span>
  );
}

function HeroAvatar({
  hero,
  size,
  rounded,
}: {
  hero: { slug?: string | null; name?: string | null; imageUrl?: string | null } | null;
  size: number;
  rounded: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = !failed ? normalizeHeroAsset(hero?.imageUrl) : null;
  const label = hero?.name ?? hero?.slug ?? 'Hero';
  const initials = label
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        overflow: 'hidden',
        flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.12)',
        background: heroGradient(hero?.slug ?? label),
        display: 'grid',
        placeItems: 'center',
        color: 'white',
        fontWeight: 900,
        fontSize: Math.max(12, size * 0.28),
      }}
      title={label}
    >
      {src ? (
        <img
          src={src}
          alt={label}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        initials || 'H'
      )}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
      {icon}
      <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h3>
    </div>
  );
}

function EmptyStatsText() {
  return (
    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
      No detailed stats have been captured for this player yet.
    </p>
  );
}

function getGeneralNumber(stats: Record<string, unknown>, key: string): number | null {
  const value = stats[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getFavoriteHero(stats: Record<string, unknown>): { slug?: string | null; name?: string | null; imageUrl?: string | null } | null {
  const favHero = stats.favHero;
  if (favHero === null || typeof favHero !== 'object' || Array.isArray(favHero)) return null;

  const hero = favHero as Record<string, unknown>;
  const slug = typeof hero.slug === 'string' ? hero.slug : null;
  const name = typeof hero.name === 'string' ? hero.name : null;
  const imageUrl = typeof hero.imageUrl === 'string' ? hero.imageUrl : null;

  return slug || name || imageUrl ? { slug, name, imageUrl } : null;
}

function getPrimaryRole(profile: PlayerProfile): string | null {
  const role = [...profile.roleStats].sort((a, b) => b.matches - a.matches)[0]?.role;
  if (role) return role;

  const favRole = profile.generalStats.favRole;
  return typeof favRole === 'string' && favRole ? favRole : null;
}

function normalizeRole(role: string): string {
  return role.replace(/[\s-]/g, '_').toUpperCase();
}

function getRoleMeta(role: string): { key: string; label: string; color: string } {
  const key = normalizeRole(role);
  const map: Record<string, { label: string; color: string }> = {
    CARRY:    { label: 'Carry',    color: '#f0b429' },
    SUPPORT:  { label: 'Support',  color: '#38d4c8' },
    JUNGLE:   { label: 'Jungle',   color: '#7fd66b' },
    OFFLANE:  { label: 'Offlane',  color: '#f87171' },
    MIDLANE:  { label: 'Mid Lane', color: '#a78bfa' },
    MID_LANE: { label: 'Mid Lane', color: '#a78bfa' },
  };

  return { key, ...(map[key] ?? { label: formatRoleLabel(role), color: '#38bdf8' }) };
}

function roleIcon(roleKey: string, size: number): React.ReactNode {
  if (roleKey === 'CARRY') return <Target size={size} />;
  if (roleKey === 'SUPPORT') return <Shield size={size} />;
  if (roleKey === 'JUNGLE') return <Activity size={size} />;
  if (roleKey === 'OFFLANE') return <Swords size={size} />;
  if (roleKey === 'MIDLANE' || roleKey === 'MID_LANE') return <Trophy size={size} />;
  return <User size={size} />;
}

function formatRoleLabel(role: string): string {
  return role
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeHeroAsset(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `https://pred.gg${url}`;
  return url;
}

function heroGradient(seed: string): string {
  const palette = [
    ['#0ea5e9', '#7c3aed'],
    ['#ef4444', '#f59e0b'],
    ['#10b981', '#2563eb'],
    ['#a855f7', '#ec4899'],
    ['#14b8a6', '#84cc16'],
  ];
  const index = Math.abs(seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palette.length;
  const [a, b] = palette[index];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function resultColor(result: 'win' | 'loss' | 'unknown'): string {
  if (result === 'win') return 'var(--accent-success)';
  if (result === 'loss') return 'var(--accent-danger)';
  return 'var(--text-muted)';
}

function resultBackground(result: 'win' | 'loss' | 'unknown'): string {
  if (result === 'win') return 'rgba(74,222,128,0.1)';
  if (result === 'loss') return 'rgba(248,113,113,0.1)';
  return 'rgba(255,255,255,0.03)';
}

function StatusCard({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color }}>
      {icon}
      <span style={{ fontWeight: 500 }}>{title}</span>
    </div>
  );
}

function Spinner({ size = 24, color = 'var(--accent-blue)' }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `3px solid rgba(255,255,255,0.1)`,
      borderTopColor: color,
      animation: 'spin 0.8s linear infinite',
      display: 'inline-block',
    }} />
  );
}

const SYNC_STEPS = [
  'Connecting to pred.gg...',
  'Searching for',
  'Saving to local database...',
];

function SyncSteps({ currentStep }: { currentStep: string }) {
  const currentIdx = SYNC_STEPS.findIndex((s) => currentStep.startsWith(s));
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
      {SYNC_STEPS.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: i < currentIdx ? 'var(--accent-success)'
              : i === currentIdx ? 'var(--accent-purple)'
              : 'var(--border-color)',
            transition: 'background 0.3s',
          }} />
          {i < SYNC_STEPS.length - 1 && (
            <div style={{ width: '24px', height: '1px', background: 'var(--border-color)' }} />
          )}
        </div>
      ))}
    </div>
  );
}
