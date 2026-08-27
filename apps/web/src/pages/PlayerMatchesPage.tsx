import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronRight, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { apiClient, ApiErrorResponse, type PlayerProfile, type RecentMatch } from '../api/client';
import { MatchEnrichmentCard } from '../components/MatchEnrichmentCard';
import { useAuth } from '../hooks/useAuth';

function kda(m: RecentMatch) {
  return ((m.kills + m.assists) / Math.max(m.deaths, 1)).toFixed(2);
}

function duration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PlayerMatchesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [coverageRefresh, setCoverageRefresh] = useState(0);
  const [heroFilter, setHeroFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const linkedPlayerId = user?.linkedPlayerId;

  const loadProfile = useCallback(async () => {
    if (!linkedPlayerId) return;
    try {
      setProfile(await apiClient.players.getProfile(linkedPlayerId));
    } catch (error) {
      toast.error(error instanceof ApiErrorResponse ? error.error.message : 'Error al cargar partidas.');
    }
  }, [linkedPlayerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!linkedPlayerId) { setLoading(false); return; }
      void loadProfile().finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [linkedPlayerId, loadProfile]);

  async function syncMatches() {
    try {
      setSyncing(true);
      const result = await apiClient.sync.myMatches();
      await loadProfile();
      setCoverageRefresh((current) => current + 1);
      toast.success(result.newMatches > 0
        ? `${result.newMatches} partidas nuevas · ${result.syncedMatches} revisadas.`
        : `Historial actualizado: ${result.syncedMatches} partidas revisadas.`);
    } catch (error) {
      toast.error(error instanceof ApiErrorResponse ? error.error.message : 'No se pudo actualizar el historial.');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('common.loading')}</div>;

  if (!linkedPlayerId) {
    return (
      <div>
        <header className="header">
          <h1 className="header-title">Mis partidas</h1>
        </header>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2.5rem', textAlign: 'center' }}>
          <LinkIcon size={32} style={{ color: 'var(--text-muted)' }} />
          <p style={{ fontWeight: 600 }}>Vincula tu cuenta de pred.gg para ver tus partidas</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Ve a tu perfil y conecta tu cuenta de pred.gg.</p>
          <button className="btn-primary" onClick={() => navigate('/profile')} style={{ flex: 'unset' }}>Ir al perfil</button>
        </div>
      </div>
    );
  }

  const matches = profile?.recentMatches ?? [];
  const heroOptions = [...new Set(matches.map((match) => match.heroSlug))].sort();
  const roleOptions = [...new Set(matches.flatMap((match) => match.role ? [match.role] : []))].sort();
  const modeOptions = [...new Set(matches.map((match) => match.gameMode))].sort();
  const filteredMatches = matches.filter((match) =>
    (heroFilter === 'ALL' || match.heroSlug === heroFilter)
    && (roleFilter === 'ALL' || match.role === roleFilter)
    && (resultFilter === 'ALL' || match.result === resultFilter)
    && (modeFilter === 'ALL' || match.gameMode === modeFilter));
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filteredMatches.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleMatches = filteredMatches.slice((safePage - 1) * pageSize, safePage * pageSize);
  const updateFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="header">
        <div>
          <h1 className="header-title">Mis partidas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
            {profile ? `${profile.displayName} · ${matches.length} partidas disponibles` : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={syncing}
          onClick={() => void syncMatches()}
          title="Importa de Pred.gg todas las partidas disponibles dentro de la ventana de análisis"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flex: 'unset', whiteSpace: 'nowrap' }}
        >
          <RefreshCw size={15} className={syncing ? 'spin' : undefined} />
          {syncing ? 'Actualizando historial…' : 'Actualizar historial'}
        </button>
      </header>

      <MatchEnrichmentCard
        enabled={Boolean(linkedPlayerId)}
        refreshToken={coverageRefresh}
        onCompleted={loadProfile}
      />

      {matches.length > 0 && (
        <section className="glass-card" aria-label="Filtros de partidas" style={{ padding: '0.8rem 1rem', display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'end' }}>
          {[
            { label: 'Héroe', value: heroFilter, set: setHeroFilter, options: heroOptions },
            { label: 'Rol', value: roleFilter, set: setRoleFilter, options: roleOptions },
            { label: 'Modo', value: modeFilter, set: setModeFilter, options: modeOptions },
          ].map((filter) => (
            <label key={filter.label} style={{ display: 'grid', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.64rem' }}>
              {filter.label}
              <select value={filter.value} onChange={(event) => updateFilter(filter.set, event.target.value)} style={{ minWidth: 130, padding: '0.4rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
                <option value="ALL">Todos</option>
                {filter.options.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
          ))}
          <label style={{ display: 'grid', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.64rem' }}>
            Resultado
            <select value={resultFilter} onChange={(event) => updateFilter(setResultFilter, event.target.value)} style={{ minWidth: 130, padding: '0.4rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
              <option value="ALL">Todos</option>
              <option value="win">Victorias</option>
              <option value="loss">Derrotas</option>
            </select>
          </label>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{filteredMatches.length} partidas</span>
        </section>
      )}

      {matches.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          No se encontraron partidas recientes.
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 80px 90px 80px 80px 80px 90px 70px 36px', gap: '0.75rem', padding: '0.45rem 1.25rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-color)' }}>
            <span>Héroe</span>
            <span>Resultado</span>
            <span>KDA</span>
            <span>DPM</span>
            <span>GPM</span>
            <span>Duración</span>
            <span>Fecha</span>
            <span>Parche</span>
            <span />
          </div>

          {visibleMatches.map((match) => {
            const isWin = match.result === 'win';
            const kdaVal = parseFloat(kda(match));
            const kdaColor = kdaVal >= 3 ? 'var(--accent-win)' : kdaVal >= 1.5 ? 'var(--text-primary)' : 'var(--accent-loss)';

            return (
              <div
                key={match.matchId}
                role="link"
                tabIndex={0}
                aria-label={`Abrir ${match.heroName ?? match.heroSlug}, ${isWin ? 'victoria' : 'derrota'}, ${new Date(match.date).toLocaleDateString()}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '200px 80px 90px 80px 80px 80px 90px 70px 36px',
                  gap: '0.75rem',
                  alignItems: 'center',
                  padding: '0.6rem 1.25rem',
                  borderBottom: '1px solid var(--border-color)',
                  borderLeft: `3px solid ${isWin ? 'var(--accent-win)' : 'var(--accent-loss)'}`,
                  background: isWin ? 'rgba(52,211,153,0.03)' : 'rgba(248,113,113,0.03)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => navigate(`/matches/${match.matchId}`)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate(`/matches/${match.matchId}`); }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isWin ? 'rgba(52,211,153,0.07)' : 'rgba(248,113,113,0.07)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = isWin ? 'rgba(52,211,153,0.03)' : 'rgba(248,113,113,0.03)')}
              >
                {/* Hero */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  {match.heroImageUrl ? (
                    <img
                      src={match.heroImageUrl}
                      alt={match.heroName ?? match.heroSlug}
                      style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: 'var(--bg-dark)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-dark)', flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.heroName ?? match.heroSlug}
                    </p>
                    {match.role && (
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{match.role}</p>
                    )}
                  </div>
                </div>

                {/* Result */}
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isWin ? 'var(--accent-win)' : 'var(--accent-loss)', background: isWin ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${isWin ? 'var(--accent-win)' : 'var(--accent-loss)'}`, borderRadius: '999px', padding: '0.15rem 0.6rem', whiteSpace: 'nowrap', width: 'fit-content' }}>
                  {isWin ? 'Victoria' : 'Derrota'}
                </span>

                {/* KDA */}
                <div>
                  <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: kdaColor }}>{kda(match)}</p>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>{match.kills}/{match.deaths}/{match.assists}</p>
                </div>

                {/* DPM */}
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {match.heroDamage != null && match.duration > 0 ? Math.round(match.heroDamage / (match.duration / 60)).toLocaleString() : '—'}
                </span>

                {/* GPM */}
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {match.gold != null && match.duration > 0 ? Math.round(match.gold / (match.duration / 60)).toLocaleString() : '—'}
                </span>

                {/* Duration */}
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {duration(match.duration)}
                </span>

                {/* Date */}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {new Date(match.date).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' })}
                </span>

                <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{match.version ?? '—'}</span>

                {/* Arrow */}
                <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
              </div>
            );
          })}
        </div>
      )}

      {filteredMatches.length > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.7rem' }}>
          <button className="btn-secondary" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} style={{ flex: 'unset' }}>Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Página {safePage} de {pageCount}</span>
          <button className="btn-secondary" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} style={{ flex: 'unset' }}>Siguiente</button>
        </div>
      )}
    </div>
  );
}
