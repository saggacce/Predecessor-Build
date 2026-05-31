import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronRight, Link as LinkIcon } from 'lucide-react';
import { apiClient, ApiErrorResponse, type PlayerProfile, type RecentMatch } from '../api/client';
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

  const linkedPlayerId = user?.linkedPlayerId;

  useEffect(() => {
    if (!linkedPlayerId) { setLoading(false); return; }
    apiClient.players.getProfile(linkedPlayerId)
      .then(setProfile)
      .catch((err) => toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al cargar partidas.'))
      .finally(() => setLoading(false));
  }, [linkedPlayerId]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="header">
        <h1 className="header-title">Mis partidas</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
          {profile ? `${profile.displayName} · ${matches.length} partidas recientes` : ''}
        </p>
      </header>

      {matches.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          No se encontraron partidas recientes.
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 80px 90px 100px 100px 80px 80px 36px', gap: '0.75rem', padding: '0.45rem 1.25rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-color)' }}>
            <span>Héroe</span>
            <span>Resultado</span>
            <span>KDA</span>
            <span>Daño</span>
            <span>Oro</span>
            <span>Duración</span>
            <span>Fecha</span>
            <span />
          </div>

          {matches.map((match) => {
            const isWin = match.result === 'win';
            const kdaVal = parseFloat(kda(match));
            const kdaColor = kdaVal >= 3 ? 'var(--accent-win)' : kdaVal >= 1.5 ? 'var(--text-primary)' : 'var(--accent-loss)';

            return (
              <div
                key={match.matchId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '200px 80px 90px 100px 100px 80px 80px 36px',
                  gap: '0.75rem',
                  alignItems: 'center',
                  padding: '0.6rem 1.25rem',
                  borderBottom: '1px solid var(--border-color)',
                  borderLeft: `3px solid ${isWin ? 'var(--accent-win)' : 'var(--accent-loss)'}`,
                  background: isWin ? 'rgba(52,211,153,0.03)' : 'rgba(248,113,113,0.03)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => navigate(`/matches/live/${match.matchUuid}`)}
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

                {/* Damage */}
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {match.heroDamage != null ? Math.round(match.heroDamage).toLocaleString() : '—'}
                </span>

                {/* Gold */}
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {match.gold != null ? Math.round(match.gold).toLocaleString() : '—'}
                </span>

                {/* Duration */}
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {duration(match.duration)}
                </span>

                {/* Date */}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>

                {/* Arrow */}
                <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
