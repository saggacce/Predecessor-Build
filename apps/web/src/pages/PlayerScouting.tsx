import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { HeroAvatarWithTooltip } from '../components/HeroAvatar';
import { RankIcon, getRankColor } from '../components/RankIcon';
import { useHeroMeta, normalizeHeroSlug } from '../hooks/useHeroMeta';
import {
  AlertCircle,
  ArrowLeft,
  Activity,
  Calendar,
  ChevronRight,
  Gamepad2,
  LogIn,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  Star,
  Target,
  Trophy,
  User,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiClient,
  type ScoutingProfile,
  type ScoutingHero,
  type ScoutingFormMatch,
  type PlayerSearchResult,
  type SyncedPlayer,
  ApiErrorResponse,
} from '../api/client';
import { useAuth } from '../hooks/useAuth';

type Phase =
  | { tag: 'idle' }
  | { tag: 'searching' }
  | { tag: 'results'; players: PlayerSearchResult[] }
  | { tag: 'empty'; query: string }
  | { tag: 'syncing'; step: string }
  | { tag: 'synced'; player: SyncedPlayer }
  | { tag: 'not_found'; query: string }
  | { tag: 'error'; message: string };

type ProfilePhase =
  | { tag: 'idle' }
  | { tag: 'loading'; playerId: string }
  | { tag: 'loaded'; profile: ScoutingProfile; playerId: string }
  | { tag: 'error'; message: string };

class ProfileErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-loss)' }}>
          <div style={{ fontWeight: 700, color: 'var(--accent-loss)', marginBottom: '0.5rem' }}>Error al cargar el perfil</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '1rem' }}>
            {this.state.error.message}
          </div>
          <button className="btn-secondary" style={{ fontSize: '0.8rem' }}
            onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>
            Cerrar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PlayerScouting() {
  const { authenticated, internalAuthenticated } = useAuth();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>({ tag: 'idle' });
  const [profilePhase, setProfilePhase] = useState<ProfilePhase>({ tag: 'idle' });
  const [platformFilter, setPlatformFilter] = useState<'all' | 'pc' | 'console'>('all');

  useEffect(() => {
    const state = location.state as { autoLoadPlayerId?: string } | null;
    const id = state?.autoLoadPlayerId;
    if (id) {
      window.history.replaceState({}, '');
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
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error en la búsqueda.';
      setPhase({ tag: 'error', message: msg });
    }
  }

  async function handleSyncFromPredgg(name: string) {
    setPhase({ tag: 'syncing', step: 'Conectando con pred.gg...' });
    await new Promise((r) => setTimeout(r, 400));
    setPhase({ tag: 'syncing', step: `Buscando "${name}" en pred.gg...` });
    try {
      const res = await apiClient.players.sync(name);
      setPhase({ tag: 'syncing', step: 'Guardando en base de datos local...' });
      await new Promise((r) => setTimeout(r, 300));
      setPhase({ tag: 'synced', player: res.player });
      toast.success(`"${res.player.displayName}" sincronizado correctamente`);
      void handleSelectPlayer(res.player.id);
    } catch (err) {
      if (err instanceof ApiErrorResponse && err.status === 404) {
        setPhase({ tag: 'not_found', query: name });
      } else if (err instanceof ApiErrorResponse && err.error.code === 'PREDGG_AUTH_REQUIRED') {
        setPhase({ tag: 'error', message: 'pred.gg requiere autenticación para buscar jugadores. Usa el botón de iniciar sesión en la barra lateral.' });
      } else {
        const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error al sincronizar.';
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
      const profile = await apiClient.players.scout(playerId);
      setProfilePhase({ tag: 'loaded', profile, playerId });
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Could not load player profile.';
      setProfilePhase({ tag: 'error', message: msg });
      toast.error(msg);
    }
  }

  async function handleRefreshProfile(playerId: string, displayName: string) {
    const toastId = toast.loading(`Actualizando "${displayName}"...`);
    setProfilePhase({ tag: 'loading', playerId });
    try {
      // Re-sync basic player record, then reload live scout data
      await apiClient.players.sync(displayName).catch(() => null);
      const profile = await apiClient.players.scout(playerId);
      setProfilePhase({ tag: 'loaded', profile, playerId });
      toast.success('Perfil actualizado', { id: toastId });
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error al sincronizar.';
      toast.error(msg, { id: toastId });
      setProfilePhase({ tag: 'error', message: msg });
    }
  }

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Player Scouting</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Evaluación de jugadores — datos en tiempo real desde pred.gg.
        </p>
      </header>

      {/* Search bar */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search color="var(--text-muted)" size={20}
              style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Nombre del jugador..."
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
          <button type="submit"
            disabled={phase.tag === 'searching' || phase.tag === 'syncing' || !query.trim()}
            className="btn-primary" style={{ padding: '0 2rem' }}>
            {phase.tag === 'searching' ? 'Buscando...' : 'Buscar'}
          </button>
          {phase.tag !== 'idle' && (
            <button type="button" onClick={reset} className="btn-secondary" style={{ padding: '0 1rem' }}>Limpiar</button>
          )}
        </form>
      </div>

      {phase.tag === 'searching' && (
        <StatusCard icon={<Spinner />} title="Buscando en base de datos local..." color="var(--accent-blue)" />
      )}

      {profilePhase.tag !== 'idle' && (
        <div style={{ marginBottom: '2rem' }}>
          {profilePhase.tag === 'loading' && (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <Spinner size={36} color="var(--accent-blue)" />
              <p style={{ color: 'var(--accent-blue)', marginTop: '1rem', fontWeight: 500 }}>
                Preparando informe de scouting...
              </p>
            </div>
          )}
          {profilePhase.tag === 'error' && (
            <StatusCard icon={<AlertCircle color="var(--accent-danger)" size={24} />}
              title={profilePhase.message} color="var(--accent-danger)" />
          )}
          {profilePhase.tag === 'loaded' && (
            <ProfileErrorBoundary onReset={() => setProfilePhase({ tag: 'idle' })}>
              <ScoutingPanel
                profile={profilePhase.profile}
                playerId={profilePhase.playerId}
                onClose={() => setProfilePhase({ tag: 'idle' })}
                onRefresh={internalAuthenticated
                  ? () => void handleRefreshProfile(profilePhase.playerId, profilePhase.profile.name)
                  : undefined}
              />
            </ProfileErrorBoundary>
          )}
        </div>
      )}

      {/* Results */}
      {phase.tag === 'results' && (() => {
        const filtered = phase.players.filter((p) =>
          platformFilter === 'all' ? true : platformFilter === 'console' ? p.isConsole : !p.isConsole
        );
        const opts: Array<{ key: typeof platformFilter; label: string }> = [
          { key: 'all', label: 'Todos' }, { key: 'pc', label: 'PC' }, { key: 'console', label: 'Consola' },
        ];
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                {filtered.length} jugador{filtered.length !== 1 ? 'es' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {opts.map(({ key, label }) => (
                  <button key={key} onClick={() => setPlatformFilter(key)} style={{
                    fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem',
                    borderRadius: '999px', cursor: 'pointer',
                    border: platformFilter === key ? '1px solid var(--accent-violet)' : '1px solid var(--border-color)',
                    background: platformFilter === key ? 'rgba(167,139,250,0.14)' : 'rgba(255,255,255,0.03)',
                    color: platformFilter === key ? 'var(--accent-violet)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}>{label}</button>
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

      {/* Empty — not in local DB */}
      {phase.tag === 'empty' && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ marginBottom: '1rem' }}><Search color="var(--text-muted)" size={40} /></div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            "{phase.query}" no está en la base de datos local
          </h3>
          {authenticated ? (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Busca al jugador directamente en pred.gg y guárdalo localmente.
              </p>
              <button onClick={() => void handleSyncFromPredgg(phase.query)}
                className="btn-primary" style={{ padding: '0.75rem 2rem' }}>
                Buscar en pred.gg
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Inicia sesión con pred.gg para buscar y sincronizar jugadores desde la API.
              </p>
              <a href={apiClient.auth.loginUrl()} className="btn-primary"
                style={{ padding: '0.75rem 2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <LogIn size={16} /> Iniciar sesión con pred.gg
              </a>
            </>
          )}
        </div>
      )}

      {/* Syncing */}
      {phase.tag === 'syncing' && (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem' }}><Spinner size={40} color="var(--accent-purple)" /></div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Sincronizando jugador...</h3>
          <p style={{ color: 'var(--accent-blue)', fontSize: '0.875rem', fontWeight: 500 }}>{phase.step}</p>
          <SyncSteps currentStep={phase.step} />
        </div>
      )}

      {phase.tag === 'synced' && (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <p style={{ color: 'var(--accent-success)', fontWeight: 600, marginBottom: '1rem' }}>
            ✓ Jugador sincronizado — cargando informe de scouting...
          </p>
        </div>
      )}

      {phase.tag === 'not_found' && (
        <StatusCard icon={<AlertCircle color="var(--accent-danger)" size={24} />}
          title={`"${phase.query}" no encontrado en pred.gg`} color="var(--accent-danger)" />
      )}

      {phase.tag === 'error' && (
        <StatusCard icon={<AlertCircle color="var(--accent-danger)" size={24} />}
          title={phase.message} color="var(--accent-danger)" />
      )}
    </div>
  );
}

// ── Player search result card ─────────────────────────────────────────────────

function PlayerCard({ player, onSelect }: { player: PlayerSearchResult; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', textAlign: 'left', padding: '1rem', borderRadius: 'var(--radius)',
        border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)',
        cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)';
        (e.currentTarget as HTMLElement).style.background = 'rgba(91,156,246,0.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: heroGradient(player.displayName),
        display: 'grid', placeItems: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem',
      }}>
        {(player.customName ?? player.displayName).slice(0, 1).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.customName ?? player.displayName}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {player.isConsole ? <><Gamepad2 size={10} /> Consola</> : <><Monitor size={10} /> PC</>}
          {player.inferredRegion && <span>· {player.inferredRegion}</span>}
        </div>
      </div>
      <ChevronRight size={16} color="var(--text-muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
    </button>
  );
}

// ── Scouting Panel — recruiting scorecard ─────────────────────────────────────

function ScoutingPanel({
  profile,
  playerId,
  onClose,
  onRefresh,
}: {
  profile: ScoutingProfile;
  playerId: string;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const navigate = useNavigate();
  const primaryRole = profile.roleDistribution[0]?.role ?? profile.favRole ?? null;
  const topHero = profile.heroPool[0] ?? null;

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'linear-gradient(135deg, rgba(56,212,200,0.09), rgba(91,156,246,0.07) 45%, rgba(167,139,250,0.06))',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <button type="button" onClick={onClose} className="btn-secondary"
            style={{ padding: '0.5rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> Volver
          </button>
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="btn-secondary"
              style={{ padding: '0.5rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={16} /> Actualizar
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <HeroAvatar
            hero={{ slug: topHero?.heroSlug ?? null, name: topHero?.heroName ?? null, imageUrl: topHero?.heroImageUrl ?? null }}
            size={88} rounded={18}
          />
          <div style={{ minWidth: 0, flex: '1 1 18rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '2rem', lineHeight: 1.05 }}>{profile.name}</h2>
              {profile.favRole && <RoleBadge role={profile.favRole} size="large" />}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Current rank */}
              {profile.rating.current && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.8rem', fontWeight: 700,
                  color: getRankColor(profile.rating.current.tierName),
                  background: `${getRankColor(profile.rating.current.tierName)}18`,
                  border: `1px solid ${getRankColor(profile.rating.current.tierName)}44`,
                  borderRadius: '999px', padding: '0.25rem 0.6rem',
                }}>
                  <RankIcon rankLabel={profile.rating.current.tierName} ratingPoints={profile.rating.current.points} size={14} />
                  {profile.rating.current.rankName}
                  {' · '}{Math.round(profile.rating.current.points).toLocaleString()} VP
                </span>
              )}
              {/* Peak rank */}
              {profile.rating.peak && profile.rating.peak.rankName !== profile.rating.current?.rankName && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Trophy size={11} /> Peak: {profile.rating.peak.rankName}
                </span>
              )}
              {/* Percentile */}
              {profile.rating.current?.percentile != null && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  top {(100 - profile.rating.current.percentile * 100).toFixed(1)}%
                </span>
              )}
              {/* Last played */}
              {profile.lastPlayedAt && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={11} /> {new Date(profile.lastPlayedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.75rem' }}>
          <KPI label="Partidas" value={profile.generalStats.matches.toString()} />
          <KPI label="WR%" value={`${profile.generalStats.winRate}%`}
            color={winRateColor(profile.generalStats.winRate)} />
          <KPI label="KDA" value={profile.generalStats.kda.toFixed(2)}
            color={profile.generalStats.kda >= 3 ? 'var(--accent-success)' : profile.generalStats.kda >= 2 ? '#f0b429' : undefined} />
          <KPI label="Daño/P" value={formatCompactNumber(profile.generalStats.heroDamagePerMatch)} />
          <KPI label="Wards/P" value={profile.generalStats.wardsPlacedPerMatch.toFixed(1)} />
          <KPI label="CS/P" value={profile.generalStats.csPerMatch.toString()} />
          {profile.generalStats.avgGameMinutes != null && (
            <KPI label="Min/P" value={`${profile.generalStats.avgGameMinutes}m`} />
          )}
          <KPI label="Penta" value={profile.generalStats.multiKills.penta.toString()}
            color={profile.generalStats.multiKills.penta > 0 ? 'var(--accent-gold)' : undefined} />
        </div>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Hero Pool */}
        <ScoutingHeroPool heroes={profile.heroPool} />

        {/* Role distribution */}
        {profile.roleDistribution.length > 0 && (
          <ScoutingRoleDistribution roles={profile.roleDistribution} />
        )}

        {/* Recent form */}
        {profile.recentForm.length > 0 && (
          <ScoutingFormStrip matches={profile.recentForm} onMatchClick={(predggId) => navigate(`/matches/live/${predggId}`)} />
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.75rem', background: 'rgba(10,12,16,0.4)' }}>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', color: color ?? 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}>{value}</div>
    </div>
  );
}

// ── Hero Pool ─────────────────────────────────────────────────────────────────

function ScoutingHeroPool({ heroes }: { heroes: ScoutingHero[] }) {
  const totalMatches = heroes.reduce((sum, h) => sum + h.matches, 0);
  return (
    <div>
      <SectionTitle icon={<Shield size={16} />} title="Hero Pool" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
        {heroes.slice(0, 12).map((hero) => {
          const isPocketPick = hero.matches < 10 && hero.winRate >= 65;
          const isOneTrick = heroes.length >= 2 && hero.matches >= 20 && hero.matches / totalMatches >= 0.5;
          return (
            <div key={hero.heroSlug} style={{
              display: 'flex', alignItems: 'center', gap: '0.65rem',
              padding: '0.55rem 0.7rem', borderRadius: 'var(--radius-sm)',
              border: isPocketPick ? '1px solid rgba(251,191,36,0.5)' : '1px solid var(--border-color)',
              background: isPocketPick ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.02)',
            }}>
              <HeroAvatar
                hero={{ slug: hero.heroSlug, name: hero.heroName, imageUrl: hero.heroImageUrl }}
                size={36} rounded={8}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.1rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hero.heroName}
                  </span>
                  {isPocketPick && <Star size={10} color="#fbbf24" fill="#fbbf24" aria-label="Pocket pick" />}
                  {isOneTrick && <Zap size={10} color="#a78bfa" fill="#a78bfa" aria-label="One-trick" />}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: winRateColor(hero.winRate), fontWeight: 600 }}>{hero.winRate}% WR</span>
                  <span>{hero.matches}G</span>
                  <span>{hero.kda.toFixed(1)} KDA</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {heroes.length === 0 && <EmptyStatsText />}
    </div>
  );
}

// ── Role Distribution ─────────────────────────────────────────────────────────

function ScoutingRoleDistribution({ roles }: { roles: { role: string; matches: number; winRate: number; kda: number }[] }) {
  const total = roles.reduce((s, r) => s + r.matches, 0);
  return (
    <div>
      <SectionTitle icon={<Target size={16} />} title="Distribución por Rol" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {roles.map((r) => {
          const pct = total > 0 ? Math.round((r.matches / total) * 100) : 0;
          const meta = getRoleMeta(r.role);
          return (
            <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <RoleBadge role={r.role} compact />
              <div style={{ flex: 1 }}>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '3.5rem', textAlign: 'right' }}>
                {pct}% · {r.matches}G
              </span>
              <span style={{ fontSize: '0.72rem', color: winRateColor(r.winRate), fontFamily: 'var(--font-mono)', minWidth: '3.5rem', textAlign: 'right' }}>
                {r.winRate}% WR
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recent Form Strip ─────────────────────────────────────────────────────────

function ScoutingFormStrip({
  matches,
  onMatchClick,
}: {
  matches: ScoutingFormMatch[];
  onMatchClick: (predggMatchId: string) => void;
}) {
  return (
    <div>
      <SectionTitle icon={<Activity size={16} />} title={`Forma Reciente — últimas ${matches.length} partidas`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {matches.map((m) => (
          <button
            key={m.predggMatchId}
            onClick={() => onMatchClick(m.predggMatchId)}
            title="Ver detalle de partida (informe en vivo)"
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.65rem',
              padding: '0.5rem 0.65rem', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${m.result === 'win' ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.2)'}`,
              background: m.result === 'win' ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.04)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = m.result === 'win' ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = m.result === 'win' ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.2)';
            }}
          >
            {/* W/L badge */}
            <span style={{
              fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.4rem',
              borderRadius: '3px', flexShrink: 0,
              background: m.result === 'win' ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
              color: m.result === 'win' ? '#34d399' : '#f87171',
            }}>
              {m.result === 'win' ? 'W' : 'L'}
            </span>
            {/* Hero */}
            <HeroAvatar hero={{ slug: m.heroSlug, name: m.heroName, imageUrl: m.heroImageUrl }} size={28} rounded={6} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.heroName ?? m.heroSlug}
            </span>
            {/* KDA */}
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: '60px' }}>
              {m.kills}/{m.deaths}/{m.assists}
            </span>
            {/* Role */}
            {m.role && <RoleBadge role={m.role} compact />}
            {/* Patch */}
            {m.patch && (
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                v{m.patch}
              </span>
            )}
            {/* Duration */}
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginLeft: m.patch ? '0.5rem' : 'auto' }}>
              {formatDuration(m.duration)}
            </span>
            <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Utility components ────────────────────────────────────────────────────────

function RoleBadge({ role, compact = false, size = 'normal' }: { role: string; compact?: boolean; size?: 'normal' | 'large' }) {
  const meta = getRoleMeta(role);
  const iconSize = size === 'large' ? 16 : 14;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      gap: compact ? '0.25rem' : '0.4rem',
      padding: size === 'large' ? '0.42rem 0.65rem' : '0.3rem 0.5rem',
      borderRadius: '999px',
      border: `1px solid ${meta.color}`,
      color: meta.color,
      background: `${meta.color}1f`,
      fontSize: size === 'large' ? '0.82rem' : '0.74rem',
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      {roleIcon(meta.key, iconSize)}
      {!compact && meta.label}
    </span>
  );
}

function HeroAvatar({ hero, size, rounded }: {
  hero: { slug?: string | null; name?: string | null; imageUrl?: string | null } | null;
  size: number; rounded: number;
}) {
  const [localFailed, setLocalFailed] = useState(false);
  const [cdnFailed, setCdnFailed] = useState(false);
  const heroMeta = useHeroMeta();
  const localSrc = hero?.slug ? `/heroes/${normalizeHeroSlug(hero.slug)}.webp` : null;
  const cdnSrc = heroMeta.get(hero?.slug ?? '')?.imageUrl ?? normalizeHeroAsset(hero?.imageUrl);
  const src = !localFailed && localSrc ? localSrc : (!cdnFailed ? cdnSrc : null);
  const label = hero?.name ?? hero?.slug ?? 'Hero';
  const initials = label.split(/[\s_-]+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{
      width: size, height: size, borderRadius: rounded, overflow: 'hidden', flexShrink: 0,
      border: '1px solid rgba(255,255,255,0.12)', background: heroGradient(hero?.slug ?? label),
      display: 'grid', placeItems: 'center', color: 'white', fontWeight: 900, fontSize: Math.max(12, size * 0.28),
    }} title={label}>
      {src ? (
        <img src={src} alt={label}
          onError={() => { if (!localFailed && src === localSrc) setLocalFailed(true); else setCdnFailed(true); }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (initials || 'H')}
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
  return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No hay estadísticas disponibles.</p>;
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
      border: `3px solid rgba(255,255,255,0.1)`, borderTopColor: color,
      animation: 'spin 0.8s linear infinite', display: 'inline-block',
    }} />
  );
}

const SYNC_STEPS = ['Connecting to pred.gg...', 'Searching for', 'Saving to local database...'];
function SyncSteps({ currentStep }: { currentStep: string }) {
  const currentIdx = SYNC_STEPS.findIndex((s) => currentStep.startsWith(s));
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
      {SYNC_STEPS.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: i < currentIdx ? 'var(--accent-success)' : i === currentIdx ? 'var(--accent-purple)' : 'var(--border-color)',
            transition: 'background 0.3s',
          }} />
          {i < SYNC_STEPS.length - 1 && <div style={{ width: '24px', height: '1px', background: 'var(--border-color)' }} />}
        </div>
      ))}
    </div>
  );
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function winRateColor(wr: number): string {
  if (wr >= 60) return 'var(--accent-success)';
  if (wr >= 50) return '#f0b429';
  return 'var(--accent-loss)';
}

function normalizeRole(role: string): string { return role.replace(/[\s-]/g, '_').toUpperCase(); }

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
  CARRY: 'carry', SUPPORT: 'support', JUNGLE: 'jungle', OFFLANE: 'offlane', MIDLANE: 'midlane', MID_LANE: 'midlane',
};

function roleIcon(roleKey: string, size: number): React.ReactNode {
  const slug = ROLE_ICON_SLUG[roleKey];
  if (slug) return <img src={`/icons/roles/${slug}.png`} alt={roleKey} style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />;
  return <User size={size} />;
}

function formatRoleLabel(role: string): string {
  return role.toLowerCase().replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeHeroAsset(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `https://pred.gg${url}`;
  return url;
}

function heroGradient(seed: string): string {
  const palette = [['#0ea5e9','#7c3aed'],['#ef4444','#f59e0b'],['#10b981','#2563eb'],['#a855f7','#ec4899'],['#14b8a6','#84cc16']];
  const idx = Math.abs(seed.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % palette.length;
  return `linear-gradient(135deg, ${palette[idx][0]}, ${palette[idx][1]})`;
}

function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
