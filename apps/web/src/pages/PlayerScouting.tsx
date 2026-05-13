import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router';
import { HeroAvatarWithTooltip } from '../components/HeroAvatar';
import { RankIcon, getRankColor } from '../components/RankIcon';
import { useHeroMeta, normalizeHeroSlug } from '../hooks/useHeroMeta';
import { useConfig } from '../hooks/useConfig';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronRight,
  Gamepad2,
  LogIn,
  MapPin,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Swords,
  Target,
  User,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type PlayerAdvancedMetrics, type PlayerGoal, type PlayerProfile, type PlayerSearchResult, type SyncedPlayer, type TeamProfile, ApiErrorResponse } from '../api/client';
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
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>({ tag: 'idle' });
  const [profilePhase, setProfilePhase] = useState<ProfilePhase>({ tag: 'idle' });
  const [platformFilter, setPlatformFilter] = useState<'all' | 'pc' | 'console'>('all');

  // Auto-open player profile when navigated back from match detail.
  // Depends on location.key (changes on every navigation) so it re-runs
  // even if the component was already mounted at the /players route.
  useEffect(() => {
    const state = location.state as { autoLoadPlayerId?: string } | null;
    const id = state?.autoLoadPlayerId;
    if (id) {
      window.history.replaceState({}, ''); // clear state so refresh doesn't re-trigger
      void handleSelectPlayer(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

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
      {phase.tag === 'results' && (() => {
        const filtered = phase.players.filter((p) =>
          platformFilter === 'all' ? true : platformFilter === 'console' ? p.isConsole : !p.isConsole
        );
        const platformOptions: Array<{ key: typeof platformFilter; label: string }> = [
          { key: 'all', label: 'All' },
          { key: 'pc', label: 'PC' },
          { key: 'console', label: 'Console' },
        ];
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                {filtered.length} player{filtered.length !== 1 ? 's' : ''} found
                {platformFilter !== 'all' && <span style={{ color: 'var(--accent-violet)' }}> · {platformFilter}</span>}
              </p>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {platformOptions.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPlatformFilter(key)}
                    style={{
                      fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem',
                      borderRadius: '999px', cursor: 'pointer',
                      border: platformFilter === key ? '1px solid var(--accent-violet)' : '1px solid var(--border-color)',
                      background: platformFilter === key ? 'rgba(167,139,250,0.14)' : 'rgba(255,255,255,0.03)',
                      color: platformFilter === key ? 'var(--accent-violet)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {filtered.map((p) => (
                <PlayerCard key={p.id} player={p} onSelect={() => void handleSelectPlayer(p.id)} />
              ))}
            </div>
          </>
        );
      })()}

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
                Search in pred.gg
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
              customName: null,
              isPrivate: phase.player.isPrivate,
              isConsole: false,
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
  player: { id: string; displayName: string; customName: string | null; isPrivate: boolean; isConsole: boolean; inferredRegion: string | null; lastSynced: string };
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
          <span style={{ marginLeft: '0.4rem', verticalAlign: 'middle' }} title={player.isConsole ? 'Console player' : 'PC player'}>
            {player.isConsole
              ? <Gamepad2 size={13} color="var(--accent-violet)" />
              : <Monitor size={13} color="var(--text-muted)" style={{ opacity: 0.5 }} />
            }
          </span>
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

const REGION_FLAGS: Record<string, string> = {
  EUROPE: '🇪🇺', NA: '🇺🇸', LATAM: '🌎', OCE: '🇦🇺',
  ASIA: '🌏', BR: '🇧🇷', SEA: '🌏', ME: '🌍',
};

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

  const [seasons, setSeasons] = React.useState<import('../api/client').SeasonRating[]>([]);
  const [favRegion, setFavRegion] = React.useState<string | null>(null);
  const [advancedMetrics, setAdvancedMetrics] = React.useState<PlayerAdvancedMetrics | null>(null);
  const [advancedLoading, setAdvancedLoading] = React.useState(false);

  React.useEffect(() => {
    setAdvancedMetrics(null);
    setAdvancedLoading(true);
    void apiClient.players.seasons(profile.id).then((data) => {
      setSeasons(data.ratings ?? []);
      setFavRegion(data.favRegion ?? null);
    }).catch(() => { /* silent */ });

    void apiClient.players.advancedMetrics(profile.id)
      .then((data) => setAdvancedMetrics(data))
      .catch(() => setAdvancedMetrics(null))
      .finally(() => setAdvancedLoading(false));
  }, [profile.id]);

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
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '2rem', lineHeight: 1.05 }}>{profile.customName ?? profile.displayName}</h2>
              {(favRegion ?? profile.inferredRegion) && (
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }} title={favRegion ?? profile.inferredRegion ?? ''}>
                  {REGION_FLAGS[favRegion ?? profile.inferredRegion ?? ''] ?? '🌐'}
                </span>
              )}
              {primaryRole && <RoleBadge role={primaryRole} size="large" />}
              {profile.isConsole
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-violet)', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '0.15rem 0.5rem' }}><Gamepad2 size={12} /> Console</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.15rem 0.5rem' }}><Monitor size={12} /> PC</span>
              }
            </div>

            {/* Season badges */}
            {seasons.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                {seasons.map((s) => {
                  const color = getRankColor(s.rank.tierName);
                  return (
                    <span key={s.rating.group} title={`${s.rating.name}: ${s.rank.name} — ${s.points} VP`} style={{
                      fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                      color, background: `color-mix(in srgb, ${color} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
                      borderRadius: '4px', padding: '0.15rem 0.45rem', whiteSpace: 'nowrap', cursor: 'default',
                    }}>
                      {s.rating.group} · {s.rank.name}
                    </span>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={13} /> {profile.inferredRegion ?? 'Region unknown'}
              </span>
              <span>Last synced {new Date(profile.lastSynced).toLocaleString()}</span>
              <span>{profile.isPrivate ? 'Private profile' : 'Public profile'}</span>
            </div>
          </div>

          {/* Rank icon — pred.gg style */}
          {profile.rating?.rankLabel && (
            <RankIcon
              rankLabel={profile.rating.rankLabel}
              ratingPoints={profile.rating.ratingPoints !== null ? Math.round(profile.rating.ratingPoints) : null}
              size={90}
            />
          )}
        </div>

        {/* Core stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '0.65rem', marginTop: '1.25rem' }}>
          <SummaryMetric label="Matches" value={matches !== null ? formatCompactNumber(matches) : '-'} />
          <SummaryMetric label="Win Rate" value={winRate !== null ? `${winRate.toFixed(1)}%` : '-'} color={winRate !== null ? winRateColor(winRate) : undefined} />
          <SummaryMetric label="KDA" value={kda !== null ? kda.toFixed(2) : '-'} />
          <SummaryMetric label="Hero Damage" value={heroDamage !== null ? formatCompactNumber(heroDamage) : '-'} />
          {(() => {
            const gs = profile.generalStats as Record<string, unknown>;
            const avgGpm = profile.recentMatches.length > 0
              ? Math.round(profile.recentMatches.reduce((s, m) => s + (m.duration > 0 && m.gold !== null ? m.gold / (m.duration / 60) : 0), 0) / profile.recentMatches.filter((m) => m.gold !== null && m.duration > 0).length)
              : null;
            const csMatches = profile.recentMatches.filter((m) => m.laneMinionsKilled !== null);
            const avgCs = csMatches.length > 0 ? Math.round(csMatches.reduce((s, m) => s + (m.laneMinionsKilled ?? 0), 0) / csMatches.length) : null;
            const dpmMatches = profile.recentMatches.filter((m) => m.heroDamage !== null && m.duration > 0);
            const avgDpm = dpmMatches.length > 0 ? Math.round(dpmMatches.reduce((s, m) => s + m.heroDamage! / (m.duration / 60), 0) / dpmMatches.length) : null;
            return (<>
              {avgGpm !== null && !isNaN(avgGpm) && <SummaryMetric label="Avg GPM" value={String(avgGpm)} highlight />}
              {avgDpm !== null && !isNaN(avgDpm) && <SummaryMetric label="Avg DPM" value={String(avgDpm)} />}
              {avgCs !== null && <SummaryMetric label="Avg CS" value={String(avgCs)} />}
              {typeof gs.doubleKills === 'number' && gs.doubleKills > 0 && <SummaryMetric label="Double Kills" value={String(gs.doubleKills)} />}
              {typeof gs.tripleKills === 'number' && gs.tripleKills > 0 && <SummaryMetric label="Triple Kills" value={String(gs.tripleKills)} highlight />}
              {typeof gs.quadraKills === 'number' && gs.quadraKills > 0 && <SummaryMetric label="Quadra Kills" value={String(gs.quadraKills)} highlight />}
              {typeof gs.pentaKills === 'number' && gs.pentaKills > 0 && <SummaryMetric label="Penta Kills" value={String(gs.pentaKills)} highlight />}
            </>);
          })()}
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>
        <section style={{ marginBottom: '1.5rem' }}>
          <SectionTitle icon={<Activity size={18} />} title="Advanced Metrics" />
          <AdvancedMetricsSection metrics={advancedMetrics} loading={advancedLoading} />
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <SectionTitle icon={<Target size={18} />} title="Player Goals" />
          <PlayerGoalsSection playerId={profile.id} playerName={profile.customName ?? profile.displayName} />
        </section>

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

        {profile.recentMatches.length >= 5 && (
          <section>
            <EvolutionSection matches={profile.recentMatches} />
          </section>
        )}

        <section>
          <MatchesSection
            matches={profile.recentMatches}
            heroBySlug={heroBySlug}
            fromPlayerId={profile.id}
            fromPlayerName={profile.customName ?? profile.displayName}
          />
        </section>
      </div>
    </div>
  );
}

function winRateColor(wr: number): string {
  if (wr >= 55) return 'var(--accent-win)';
  if (wr < 45) return 'var(--accent-loss)';
  return 'var(--text-primary)';
}

function SummaryMetric({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  const valueColor = color ?? (highlight ? 'var(--accent-prime)' : 'var(--text-primary)');
  return (
    <div style={{ border: `1px solid ${highlight ? 'rgba(240,179,41,0.3)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-sm)', padding: '0.75rem 0.8rem', background: highlight ? 'rgba(240,179,41,0.05)' : 'rgba(10,12,16,0.5)' }}>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.67rem', fontWeight: 700, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', color: valueColor, fontWeight: 500, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  );
}

function formatPct(value: number | null, digits = 1) {
  return value === null ? '-' : `${value.toFixed(digits)}%`;
}

function formatSignedPct(value: number | null) {
  if (value === null) return '-';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function AdvancedMetricsSection({ metrics, loading }: { metrics: PlayerAdvancedMetrics | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)' }}>
        Loading advanced metrics...
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)' }}>
        Advanced metrics are not available for this player yet.
      </div>
    );
  }

  const items = [
    {
      label: 'Gold Share',
      value: formatPct(metrics.goldSharePct),
      description: 'Share of team gold generated by this player.',
      tone: 'var(--accent-prime)',
    },
    {
      label: 'Damage Share',
      value: formatPct(metrics.damageSharePct),
      description: 'Share of team hero damage dealt.',
      tone: 'var(--accent-blue)',
    },
    {
      label: 'Kill Participation',
      value: formatPct(metrics.killSharePct),
      description: 'Kills plus assists over team kills.',
      tone: 'var(--accent-teal-bright)',
    },
    {
      label: 'Efficiency Gap',
      value: formatSignedPct(metrics.efficiencyGap),
      description: 'Damage share minus death share.',
      tone: metrics.efficiencyGap !== null && metrics.efficiencyGap < 0 ? 'var(--accent-loss)' : 'var(--accent-win)',
    },
    {
      label: 'First Death Rate',
      value: formatPct(metrics.firstDeathRate),
      description: 'Matches where this player died first.',
      tone: metrics.firstDeathRate !== null && metrics.firstDeathRate > 25 ? 'var(--accent-loss)' : 'var(--text-primary)',
    },
    {
      label: 'Early Death Rate',
      value: formatPct(metrics.earlyDeathRate),
      description: 'Deaths occurring before 10 minutes.',
      tone: metrics.earlyDeathRate !== null && metrics.earlyDeathRate > 30 ? 'var(--accent-loss)' : 'var(--text-primary)',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {metrics.sampleSize < 5 && (
        <div style={{ border: '1px solid rgba(240,179,41,0.32)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.8rem', background: 'rgba(240,179,41,0.06)', color: 'var(--accent-prime)', fontSize: '0.78rem', fontWeight: 600 }}>
          Low sample size: {metrics.sampleSize} match{metrics.sampleSize === 1 ? '' : 'es'}. Treat these rates as directional.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '0.75rem' }}>
        {items.map((item) => (
          <div key={item.label} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.85rem', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.64rem', fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {item.label}
            </div>
            <div className="mono" style={{ color: item.tone, fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
              {item.value}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.35, marginTop: '0.45rem' }}>
              {item.description}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
        <span className="mono">Sample: {metrics.sampleSize}</span>
        <span className="mono">Event stream: {metrics.eventStreamSampleSize}</span>
      </div>
    </div>
  );
}

const PLAYER_GOAL_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-muted)',
  ACTIVE: 'var(--accent-blue)',
  ACHIEVED: 'var(--accent-win)',
  FAILED: 'var(--accent-loss)',
  PAUSED: '#f0b429',
  ARCHIVED: 'var(--text-muted)',
};

const PLAYER_GOAL_METRICS = [
  'KDA',
  'First Death Rate',
  'Early Death Rate',
  'Damage Share',
  'Gold Share',
  'Kill Participation',
  'Vision Score',
];

function goalProgress(goal: PlayerGoal): number | null {
  if (goal.baselineValue === null || goal.targetValue === null || goal.currentValue === null) return null;
  const range = goal.targetValue - goal.baselineValue;
  if (range === 0) return goal.currentValue >= goal.targetValue ? 1 : 0;
  return Math.min(Math.max((goal.currentValue - goal.baselineValue) / range, 0), 1);
}

function PlayerGoalsSection({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [teams, setTeams] = React.useState<TeamProfile[]>([]);
  const [selectedTeamId, setSelectedTeamId] = React.useState('');
  const [goals, setGoals] = React.useState<PlayerGoal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [metricId, setMetricId] = React.useState('First Death Rate');
  const [targetValue, setTargetValue] = React.useState('');
  const [coachNote, setCoachNote] = React.useState('');
  const [editTitle, setEditTitle] = React.useState('');
  const [editCurrent, setEditCurrent] = React.useState('');
  const [editTarget, setEditTarget] = React.useState('');
  const [editStatus, setEditStatus] = React.useState('ACTIVE');
  const [editNote, setEditNote] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    setGoals([]);
    setSelectedTeamId('');
    apiClient.teams.list('OWN')
      .then(({ teams: ownTeams }) => {
        setTeams(ownTeams);
        setSelectedTeamId(ownTeams[0]?.id ?? '');
      })
      .catch(() => toast.error('Failed to load player goal context.'))
      .finally(() => setLoading(false));
  }, [playerId]);

  React.useEffect(() => {
    if (!selectedTeamId) return;
    setLoading(true);
    apiClient.goals.listPlayer(selectedTeamId, playerId)
      .then(({ goals: playerGoals }) => setGoals(playerGoals))
      .catch(() => toast.error('Failed to load player goals.'))
      .finally(() => setLoading(false));
  }, [playerId, selectedTeamId]);

  function resetCreateForm() {
    setTitle('');
    setMetricId('First Death Rate');
    setTargetValue('');
    setCoachNote('');
  }

  function startEditing(goal: PlayerGoal) {
    setEditingId(goal.id);
    setEditTitle(goal.title);
    setEditCurrent(goal.currentValue?.toString() ?? '');
    setEditTarget(goal.targetValue?.toString() ?? '');
    setEditStatus(goal.status);
    setEditNote(goal.coachNote ?? '');
  }

  async function handleCreateGoal() {
    if (!selectedTeamId || !title.trim()) return;
    setSaving(true);
    try {
      const goal = await apiClient.goals.createPlayer({
        teamId: selectedTeamId,
        playerId,
        title: title.trim(),
        metricId: metricId.trim() || undefined,
        targetValue: targetValue.trim() ? Number(targetValue) : undefined,
        coachNote: coachNote.trim() || undefined,
        visibility: 'staff',
      });
      setGoals((current) => [goal, ...current]);
      resetCreateForm();
      setShowCreate(false);
      toast.success('Player goal created.');
    } catch {
      toast.error('Failed to create player goal.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateGoal(goalId: string, patch?: Partial<PlayerGoal>) {
    setSaving(true);
    try {
      const payload = patch ?? {
        title: editTitle.trim(),
        currentValue: editCurrent.trim() ? Number(editCurrent) : null,
        targetValue: editTarget.trim() ? Number(editTarget) : null,
        status: editStatus,
        coachNote: editNote.trim() || null,
      };
      const updated = await apiClient.goals.updatePlayer(goalId, payload);
      setGoals((current) => current.map((goal) => (goal.id === goalId ? updated : goal)));
      setEditingId(null);
      toast.success('Player goal updated.');
    } catch {
      toast.error('Failed to update player goal.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGoal(goalId: string) {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await apiClient.goals.deletePlayer(goalId);
      setGoals((current) => current.filter((g) => g.id !== goalId));
      toast.success('Goal deleted.');
    } catch {
      toast.error('Failed to delete goal.');
    }
  }

  if (loading && !selectedTeamId) {
    return (
      <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)' }}>
        Loading player goals...
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)' }}>
        No own teams found. Create a team first to assign player goals.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} style={{ width: 'auto', minWidth: 190, fontSize: '0.78rem' }}>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <button type="button" className="btn-primary" onClick={() => setShowCreate((value) => !value)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}>
          <Plus size={14} /> New Goal
        </button>
        <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{goals.length} goals</span>
      </div>

      {showCreate && (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.9rem', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal title" />
            <select className="input" value={metricId} onChange={(e) => setMetricId(e.target.value)}>
              {PLAYER_GOAL_METRICS.map((metric) => <option key={metric} value={metric}>{metric}</option>)}
            </select>
            <input className="input" type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="Target value" />
          </div>
          <textarea className="input" rows={2} value={coachNote} onChange={(e) => setCoachNote(e.target.value)} placeholder="Coach note" style={{ width: '100%', resize: 'vertical', marginBottom: '0.75rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={() => { setShowCreate(false); resetCreateForm(); }} style={{ fontSize: '0.78rem' }}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleCreateGoal} disabled={saving || !title.trim()} style={{ fontSize: '0.78rem' }}>Create</button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)' }}>
          No individual goals for this player yet.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
          {goals.map((goal, index) => {
            const statusColor = PLAYER_GOAL_STATUS_COLOR[goal.status] ?? 'var(--text-muted)';
            const progress = goalProgress(goal);
            const isEditing = editingId === goal.id;
            return (
              <div key={goal.id} style={{ padding: '0.9rem', borderBottom: index === goals.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
                      <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      <input className="input" type="number" value={editCurrent} onChange={(e) => setEditCurrent(e.target.value)} placeholder="Current" />
                      <input className="input" type="number" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} placeholder="Target" />
                      <select className="input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                        {['DRAFT', 'ACTIVE', 'ACHIEVED', 'FAILED', 'PAUSED', 'ARCHIVED'].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                    <textarea className="input" rows={2} value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-secondary" onClick={() => setEditingId(null)} style={{ fontSize: '0.72rem' }}>Cancel</button>
                      <button type="button" className="btn-primary" onClick={() => handleUpdateGoal(goal.id)} disabled={saving || !editTitle.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}><Save size={12} /> Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>{goal.title}</span>
                        {goal.metricId && <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>{goal.metricId}</span>}
                        <span className="mono" style={{ fontSize: '0.6rem', fontWeight: 700, color: statusColor, background: `${statusColor}18`, padding: '0.1rem 0.45rem', borderRadius: 999 }}>{goal.status}</span>
                      </div>
                      {goal.coachNote && <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem', lineHeight: 1.35 }}>{goal.coachNote}</div>}
                      {progress !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.45rem' }}>
                          <div style={{ flex: 1, maxWidth: 260, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: progress >= 1 ? 'var(--accent-win)' : 'var(--accent-blue)' }} />
                          </div>
                          <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{Math.round(progress * 100)}%</span>
                        </div>
                      )}
                    </div>
                    <button type="button" className="btn-secondary" onClick={() => startEditing(goal)} style={{ fontSize: '0.72rem' }}>Edit</button>
                    {goal.status !== 'ACHIEVED' && (
                      <button type="button" className="btn-secondary" onClick={() => handleUpdateGoal(goal.id, { status: 'ACHIEVED' })} style={{ fontSize: '0.72rem', color: 'var(--accent-win)' }}>Close</button>
                    )}
                    <button type="button" className="btn-secondary" onClick={() => void handleDeleteGoal(goal.id)} style={{ fontSize: '0.72rem', color: 'var(--accent-loss)' }}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Evolution Section ─────────────────────────────────────────────────────────

type RecentMatch = PlayerProfile['recentMatches'][number];

function calcKda(m: RecentMatch) {
  return m.deaths > 0 ? (m.kills + m.assists) / m.deaths : m.kills + m.assists > 0 ? (m.kills + m.assists) : 0;
}
function calcGpm(m: RecentMatch) {
  return m.duration > 0 && m.gold !== null ? m.gold / (m.duration / 60) : null;
}
function calcDpm(m: RecentMatch) {
  return m.duration > 0 && m.heroDamage !== null ? m.heroDamage / (m.duration / 60) : null;
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function TrendChart({ values, color, label, format }: {
  values: number[]; color: string; label: string; format: (v: number) => string;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const W = 320; const H = 72; const PAD = { t: 8, b: 16, l: 8, r: 8 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const n = values.length;
  if (n < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xS = (i: number) => PAD.l + (i / (n - 1)) * iW;
  const yS = (v: number) => PAD.t + iH - ((v - min) / range) * iH;
  const pts = values.map((v, i) => `${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ');
  const area = `${xS(0)},${PAD.t + iH} ` + values.map((v, i) => `${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ') + ` ${xS(n - 1)},${PAD.t + iH}`;
  // Moving average (window 5)
  const ma = values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - 2), i + 3);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
  const maPts = ma.map((v, i) => `${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ');

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>{label}</div>
      <svg width={W} height={H} style={{ display: 'block', width: '100%', height: H }}>
        <polygon points={area} fill={`${color}18`} />
        <polyline points={pts} fill="none" stroke={`${color}55`} strokeWidth={1} />
        <polyline points={maPts} fill="none" stroke={color} strokeWidth={2} />
        {values.map((v, i) => (
          <circle key={i} cx={xS(i)} cy={yS(v)} r={4} fill={color} opacity={0}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, label: format(v) })}
            onMouseLeave={() => setTip(null)}
          />
        ))}
        {/* Invisible wider hit area */}
        {values.map((v, i) => (
          <circle key={`h${i}`} cx={xS(i)} cy={yS(v)} r={8} fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, label: `${label}: ${format(v)}` })}
            onMouseLeave={() => setTip(null)}
          />
        ))}
        {/* Min/max labels */}
        <text x={PAD.l} y={H - 2} fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="monospace">{format(min)}</text>
        <text x={W - PAD.r} y={H - 2} fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="monospace" textAnchor="end">{format(max)}</text>
      </svg>
      {tip && createPortal(
        <div style={{ position: 'fixed', left: tip.x, top: tip.y - 10, transform: 'translate(-50%, -100%)', zIndex: 9999, background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.7)', pointerEvents: 'none' }}>
          {tip.label}
        </div>,
        document.body
      )}
    </div>
  );
}

function DeltaBadge({ current, previous, format, label }: { current: number; previous: number; format: (v: number) => string; label: string }) {
  const delta = current - previous;
  const pct = previous > 0 ? ((delta / previous) * 100).toFixed(1) : null;
  const positive = delta > 0;
  const color = positive ? 'var(--accent-win)' : delta < 0 ? 'var(--accent-loss)' : 'var(--text-muted)';
  return (
    <div style={{ flex: '1 1 100px', padding: '0.6rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color }}>{format(current)}</div>
      {delta !== 0 && (
        <div style={{ fontSize: '0.62rem', color, marginTop: '0.15rem' }}>
          {positive ? '▲' : '▼'} {format(Math.abs(delta))}{pct ? ` (${pct}%)` : ''}
        </div>
      )}
      {delta === 0 && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>→ stable</div>}
    </div>
  );
}

function EvolutionSection({ matches }: { matches: RecentMatch[] }) {
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const modes = ['ALL', ...Array.from(new Set(matches.map((m) => m.gameMode))).sort()];
  const filtered = modeFilter === 'ALL' ? matches : matches.filter((m) => m.gameMode === modeFilter);
  const last20 = filtered.slice(0, 20).reverse(); // oldest first for charts
  const last10 = filtered.slice(0, 10);
  const prev10 = filtered.slice(10, 20);

  if (last20.length < 3) return null;

  // Chart data (oldest → newest)
  const kdaValues = last20.map(calcKda);
  const gpmValues = last20.map(calcGpm).filter((v): v is number => v !== null);
  const dpmValues = last20.map(calcDpm).filter((v): v is number => v !== null);

  // Delta metrics: last 10 vs prev 10
  const avgKdaLast = avg(last10.map(calcKda));
  const avgKdaPrev = avg(prev10.map(calcKda));
  const avgGpmLast = avg(last10.map(calcGpm).filter((v): v is number => v !== null));
  const avgGpmPrev = avg(prev10.map(calcGpm).filter((v): v is number => v !== null));
  const wrLast = last10.filter((m) => m.result === 'win').length / Math.max(last10.length, 1) * 100;
  const wrPrev = prev10.filter((m) => m.result === 'win').length / Math.max(prev10.length, 1) * 100;

  // Hero frequency (last 20)
  const heroCount = new Map<string, { slug: string; name: string | null; imageUrl: string | null; games: number; wins: number }>();
  for (const m of filtered.slice(0, 20)) {
    const e = heroCount.get(m.heroSlug) ?? { slug: m.heroSlug, name: m.heroName, imageUrl: m.heroImageUrl, games: 0, wins: 0 };
    e.games++;
    if (m.result === 'win') e.wins++;
    heroCount.set(m.heroSlug, e);
  }
  const recentHeroes = Array.from(heroCount.values()).sort((a, b) => b.games - a.games).slice(0, 8);

  // Streak
  let streak = 0;
  const streakType = filtered[0]?.result;
  for (const m of filtered) {
    if (m.result === streakType && m.result !== 'unknown') streak++;
    else break;
  }

  return (
    <>
      <SectionTitle icon={<Activity size={18} />} title="Performance Evolution" />

      {/* Mode filter + streak */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {modes.map((mode) => (
          <button key={mode} onClick={() => setModeFilter(mode)} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', cursor: 'pointer', border: `1px solid ${modeFilter === mode ? 'var(--accent-violet)' : 'var(--border-color)'}`, background: modeFilter === mode ? 'rgba(167,139,250,0.12)' : 'transparent', color: modeFilter === mode ? 'var(--accent-violet)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', transition: 'all 0.15s' }}>
            {mode === 'ALL' ? 'All' : gameModeLabel(mode)}
          </button>
        ))}
        {streak >= 3 && (
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: streakType === 'win' ? 'var(--accent-win)' : 'var(--accent-loss)', background: streakType === 'win' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${streakType === 'win' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: '4px', padding: '0.15rem 0.5rem' }}>
            {streak} {streakType === 'win' ? 'W' : 'L'} streak
          </span>
        )}
      </div>

      {/* W/L form strip */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {filtered.slice(0, 20).map((m, i) => {
          const isWin = m.result === 'win';
          const isLoss = m.result === 'loss';
          return (
            <div key={i} title={`${m.heroName ?? m.heroSlug} · ${isWin ? 'WIN' : isLoss ? 'LOSS' : '?'}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div style={{ width: 26, height: 26, borderRadius: 5, overflow: 'hidden', border: `2px solid ${isWin ? 'var(--accent-win)' : isLoss ? 'var(--accent-loss)' : 'var(--border-color)'}`, background: 'var(--bg-dark)', opacity: i === 0 ? 1 : 1 - i * 0.02 }}>
                <img src={`/heroes/${normalizeHeroSlug(m.heroSlug)}.webp`} alt={m.heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isWin ? 'var(--accent-win)' : isLoss ? 'var(--accent-loss)' : 'var(--border-color)' }} />
            </div>
          );
        })}
      </div>

      {/* Trend charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
          <TrendChart values={kdaValues} color="var(--accent-teal-bright)" label="KDA" format={(v) => v.toFixed(2)} />
        </div>
        {gpmValues.length >= 3 && (
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <TrendChart values={gpmValues} color="var(--accent-prime)" label="GPM" format={(v) => Math.round(v).toString()} />
          </div>
        )}
        {dpmValues.length >= 3 && (
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <TrendChart values={dpmValues} color="var(--accent-blue)" label="DPM" format={(v) => Math.round(v).toString()} />
          </div>
        )}
      </div>

      {/* Last 10 vs Prev 10 */}
      {prev10.length >= 5 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Last 10 vs Previous 10</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <DeltaBadge label="Win Rate" current={wrLast} previous={wrPrev} format={(v) => `${v.toFixed(0)}%`} />
            <DeltaBadge label="KDA" current={avgKdaLast} previous={avgKdaPrev} format={(v) => v.toFixed(2)} />
            {avgGpmPrev > 0 && <DeltaBadge label="GPM" current={avgGpmLast} previous={avgGpmPrev} format={(v) => Math.round(v).toString()} />}
          </div>
        </div>
      )}

      {/* Recent hero pool */}
      {recentHeroes.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Recent Hero Pool (last 20)</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {recentHeroes.map((h) => {
              const wr = h.games > 0 ? Math.round((h.wins / h.games) * 100) : 0;
              const wrColor = wr >= 55 ? 'var(--accent-win)' : wr < 45 ? 'var(--accent-loss)' : 'var(--text-muted)';
              return (
                <div key={h.slug} title={`${h.name ?? h.slug} — ${h.games} games, ${wr}% WR`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 7, overflow: 'hidden', border: `2px solid ${wrColor}55`, background: 'var(--bg-dark)', position: 'relative' }}>
                    <img src={`/heroes/${normalizeHeroSlug(h.slug)}.webp`} alt={h.name ?? h.slug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.75)', fontSize: '0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: wrColor, padding: '0 2px', lineHeight: 1.4 }}>{h.games}</div>
                  </div>
                  <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: wrColor, fontWeight: 700 }}>{wr}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function HeroStatCard({ hero }: { hero: PlayerProfile['heroStats'][number] }) {
  const heroMeta = useHeroMeta();
  const config = useConfig();
  const meta = heroMeta.get(hero.heroData.slug ?? '') ?? null;
  const matches = hero.matches ?? hero.wins + hero.losses;
  const winrate = typeof hero.winRate === 'number' ? hero.winRate : matches > 0 ? Math.round((hero.wins / matches) * 1000) / 10 : 0;
  const pocketPickWr = config.get('display_pocket_pick_wr') ?? 60;
  const pocketPickMinGames = config.get('display_pocket_pick_max_games') ?? 20;
  const deaths = Math.max(hero.deaths, 1);
  const kda = (hero.kills + hero.assists) / deaths;
  const isPocketPick = matches >= pocketPickMinGames && winrate >= pocketPickWr;

  return (
    <div style={{ border: isPocketPick ? '1px solid rgba(240,179,41,0.55)' : '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.85rem', background: isPocketPick ? 'rgba(240,179,41,0.04)' : 'rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <HeroAvatarWithTooltip slug={hero.heroData.slug} name={hero.heroData.name} imageUrl={hero.heroData.imageUrl} meta={meta} size={54} rounded={12} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta?.displayName ?? hero.heroData.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{matches} games</span>
            {isPocketPick && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-prime)', background: 'rgba(240,179,41,0.15)', border: '1px solid rgba(240,179,41,0.4)', borderRadius: '999px', padding: '0.1rem 0.45rem', letterSpacing: '0.04em' }}>POCKET</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
        <MiniMetric label="WR" value={`${winrate.toFixed(1)}%`} color={winRateColor(winrate)} />
        <MiniMetric label="W/L" value={`${hero.wins}/${hero.losses}`} />
        <MiniMetric label="KDA" value={kda.toFixed(2)} />
        {matches > 0 && typeof hero.heroDamage === 'number' && (
          <MiniMetric label="DMG/game" value={formatCompactNumber(Math.round(hero.heroDamage / matches))} />
        )}
        {matches > 0 && typeof hero.gold === 'number' && hero.gold > 0 && (
          <MiniMetric label="Gold/game" value={formatCompactNumber(Math.round(hero.gold / matches))} />
        )}
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

  const meta = getRoleMeta(role.role);

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem 0.85rem 0.85rem', background: 'rgba(255,255,255,0.03)' }}>
      {/* Row 1: icon + role name centered */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', marginBottom: '1rem' }}>
        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {roleIcon(meta.key, 36)}
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: meta.color, letterSpacing: '0.02em' }}>
          {meta.label}
        </span>
      </div>

      {/* Row 2: Games · WR · W/L · KDA · DMG/game · Gold/game */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
        {[
          { label: 'Games', value: String(role.matches) },
          { label: 'WR', value: `${winrate.toFixed(1)}%` },
          { label: 'W/L', value: `${role.wins}/${role.losses}` },
          { label: 'KDA', value: kda !== null ? kda.toFixed(2) : '—' },
          ...(role.matches > 0 && typeof role.heroDamage === 'number' ? [{ label: 'DMG/g', value: formatCompactNumber(Math.round(role.heroDamage / role.matches)) }] : []),
          ...(role.matches > 0 && typeof role.gold === 'number' && role.gold > 0 ? [{ label: 'Gold/g', value: formatCompactNumber(Math.round(role.gold / role.matches)) }] : []),
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>
              {label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {value}
            </div>
          </div>
        ))}
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
  fromPlayerId,
  fromPlayerName,
}: {
  matches: PlayerProfile['recentMatches'];
  heroBySlug: Map<string, { heroData: { name: string; imageUrl?: string | null } }>;
  fromPlayerId: string;
  fromPlayerName: string;
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
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.9fr 1.4fr 0.9fr 1.1fr 2.3fr 1fr 1fr 1fr 1fr 40px',
            width: '100%', padding: '0.45rem 0',
            fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.015)',
          }}>
            <span style={{ paddingLeft: '0.75rem' }}>Hero</span>
            {['Date','Type','Role','Result','K / D / A','GPM','DPM','CS','Wards /m','Time'].map((h) => (
              <span key={h} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{h}</span>
            ))}
            <span />
          </div>
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
                fromPlayerId={fromPlayerId}
                fromPlayerName={fromPlayerName}
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

const MODE_COLOR: Record<string, string> = {
  RANKED: 'var(--accent-violet)',
  ARAM: 'var(--accent-prime)',
  BRAWL: 'var(--accent-prime)',
};

function MatchRow({
  match,
  hero,
  fromPlayerId,
  fromPlayerName,
}: {
  match: PlayerProfile['recentMatches'][number];
  hero: { slug: string; name: string; imageUrl?: string | null };
  fromPlayerId: string;
  fromPlayerName: string;
}) {
  const navigate = useNavigate();
  const heroMetaMap = useHeroMeta();
  const rowHeroMeta = heroMetaMap.get(hero.slug) ?? null;
  const minutes = match.duration > 0 ? match.duration / 60 : 0;
  const gpm = minutes > 0 && match.gold !== null ? Math.round(match.gold / minutes) : null;
  const dpm = minutes > 0 && match.heroDamage !== null ? Math.round(match.heroDamage / minutes) : null;
  const matchDate = new Date(match.date);
  const isWin = match.result === 'win';
  const isLoss = match.result === 'loss';
  const borderColor = isWin ? 'var(--accent-win)' : isLoss ? 'var(--accent-loss)' : 'var(--border-color)';
  const bgColor = isWin ? 'rgba(74,222,128,0.03)' : isLoss ? 'rgba(248,113,113,0.03)' : 'rgba(255,255,255,0.01)';
  const modeColor = MODE_COLOR[match.gameMode] ?? 'var(--accent-blue)';
  const roleMeta = match.role ? getRoleMeta(match.role) : null;
  const kda = match.deaths > 0
    ? ((match.kills + match.assists) / match.deaths).toFixed(2)
    : match.kills + match.assists > 0 ? 'Perfect' : '—';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1.9fr 1.4fr 0.9fr 1.1fr 2.3fr 1fr 1fr 1fr 1fr 40px',
      alignItems: 'center',
      width: '100%',
      borderBottom: '1px solid var(--border-color)',
      background: bgColor,
      borderLeft: `3px solid ${borderColor}`,
    }}>
      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, padding: '0.7rem 0 0.7rem 0.75rem' }}>
        <HeroAvatarWithTooltip slug={hero.slug} name={hero.name} imageUrl={hero.imageUrl} meta={rowHeroMeta} size={52} rounded={10} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rowHeroMeta?.displayName ?? hero.name}
          </div>
          {rowHeroMeta?.classes && rowHeroMeta.classes.length > 0 && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rowHeroMeta.classes.map((c) => c.charAt(0) + c.slice(1).toLowerCase()).join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* Date */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <div>{matchDate.toLocaleDateString()}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>{matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      {/* Game type badge */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: modeColor, background: `color-mix(in srgb, ${modeColor} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${modeColor} 35%, transparent)`,
          borderRadius: '5px', padding: '0.25rem 0.55rem', whiteSpace: 'nowrap',
        }}>
          {gameModeLabel(match.gameMode)}
        </span>
      </div>

      {/* Role icon */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {roleMeta
          ? <div title={roleMeta.label}>{roleIcon(roleMeta.key, 30)}</div>
          : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>
        }
      </div>

      {/* Result */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: isWin ? 'var(--accent-win)' : isLoss ? 'var(--accent-loss)' : 'var(--text-muted)',
          background: isWin ? 'rgba(74,222,128,0.1)' : isLoss ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isWin ? 'rgba(74,222,128,0.3)' : isLoss ? 'rgba(248,113,113,0.3)' : 'var(--border-color)'}`,
          borderRadius: '5px', padding: '0.25rem 0.55rem',
        }}>
          {isWin ? 'WIN' : isLoss ? 'LOSS' : '—'}
        </span>
      </div>

      {/* K/D/A */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'var(--font-mono)' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
          <span style={{ color: 'var(--accent-win)' }}>{match.kills}</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / </span>
          <span style={{ color: 'var(--accent-loss)' }}>{match.deaths}</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / </span>
          <span>{match.assists}</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.12rem' }}>{kda}{kda !== 'Perfect' && kda !== '—' ? ' KDA' : ''}</div>
      </div>

      {/* GPM */}
      <div style={{ display: 'flex', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--accent-prime)' }}>
        {gpm ?? '—'}
      </div>

      {/* DPM */}
      <div style={{ display: 'flex', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
        {dpm ?? '—'}
      </div>

      {/* CS */}
      <div style={{ display: 'flex', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        {match.laneMinionsKilled ?? '—'}
      </div>

      {/* Wards /m */}
      <div style={{ display: 'flex', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', gap: '0.15rem' }}>
        {match.wardsPlaced !== null && minutes > 0 ? (
          <>
            <span style={{ color: 'var(--accent-blue)' }}>{(match.wardsPlaced / minutes).toFixed(1)}</span>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: 'var(--accent-loss)', opacity: 0.8 }}>{match.wardsDestroyed !== null ? (match.wardsDestroyed / minutes).toFixed(1) : '—'}</span>
          </>
        ) : '—'}
      </div>

      {/* Duration */}
      <div style={{ display: 'flex', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
        {formatDuration(match.duration)}
      </div>

      {/* View button */}
      <div style={{ padding: '0 0.5rem 0 0' }}>
        <button
          onClick={() => navigate(`/matches/${match.matchId}`, { state: { fromPlayerId, fromPlayerName } })}
          title="View match detail"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '0.3rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.45rem', background: 'rgba(10,12,16,0.4)' }}>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.63rem', fontWeight: 700, marginBottom: '0.18rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', color: color ?? 'var(--text-primary)', fontWeight: 500, fontSize: '0.82rem' }}>{value}</div>
    </div>
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
  const [localFailed, setLocalFailed] = useState(false);
  const [cdnFailed, setCdnFailed] = useState(false);
  const heroMeta = useHeroMeta();
  const localSrc = hero?.slug ? `/heroes/${normalizeHeroSlug(hero.slug)}.webp` : null;
  const cdnSrc = heroMeta.get(hero?.slug ?? '')?.imageUrl ?? normalizeHeroAsset(hero?.imageUrl);
  const src = !localFailed && localSrc ? localSrc : (!cdnFailed ? cdnSrc : null);
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
          onError={() => { if (!localFailed && src === localSrc) setLocalFailed(true); else setCdnFailed(true); }}
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

const ROLE_ICON_SLUG: Record<string, string> = {
  CARRY: 'carry', SUPPORT: 'support', JUNGLE: 'jungle',
  OFFLANE: 'offlane', MIDLANE: 'midlane', MID_LANE: 'midlane',
};

function roleIcon(roleKey: string, size: number): React.ReactNode {
  const slug = ROLE_ICON_SLUG[roleKey];
  if (slug) return <img src={`/icons/roles/${slug}.png`} alt={roleKey} style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />;
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
