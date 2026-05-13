import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router';
import { Film } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { LinkPlayerModal } from '../components/LinkPlayerModal';
import { useNavigate as useNav } from 'react-router';
import type { TeamProfile, TeamMatch } from '../api/client';

export default function MatchList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // PLAYER (standalone, no team) — redirect to their own player scouting profile
  const linkedPlayerId = (user as { linkedPlayerId?: string | null })?.linkedPlayerId;
  const hasTeam = (user?.memberships?.length ?? 0) > 0;
  const isStandalonePlayer = user?.globalRole === 'PLAYER' || (!hasTeam && user?.globalRole !== 'PLATFORM_ADMIN');

  if (isStandalonePlayer && linkedPlayerId) {
    return <Navigate to={`/analysis/players?id=${linkedPlayerId}`} replace />;
  }

  const [showLinkModal, setShowLinkModal] = useState(false);

  if (isStandalonePlayer && !linkedPlayerId) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem', maxWidth: 420 }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.85rem' }}>🎮</div>
            <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              Vincula tu perfil de jugador
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Para ver tus partidas, busca tu nombre en Predecessor y vincúlalo a tu cuenta.
            </p>
            <button
              onClick={() => setShowLinkModal(true)}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', padding: '0.55rem 1.25rem' }}
            >
              Buscar mi perfil en Predecessor
            </button>
          </div>
        </div>
        {showLinkModal && (
          <LinkPlayerModal
            onLinked={(pid) => { setShowLinkModal(false); navigate(\`/analysis/players?id=\${pid}\`); }}
            onClose={() => setShowLinkModal(false)}
          />
        )}
      </>
    );
  }
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    apiClient.teams.list()
      .then((r) => {
        const all = r.teams as unknown as TeamProfile[];
        setTeams(all);
        if (all.length > 0) setSelectedTeamId(all[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTeamId) return;
    setMatchLoading(true);
    apiClient.teams.getAnalysis(selectedTeamId)
      .then((a) => setMatches(a.teamMatches ?? []))
      .catch(() => setMatches([]))
      .finally(() => setMatchLoading(false));
  }, [selectedTeamId]);

  function fmtDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Match History</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Historial de partidas por equipo.
        </p>
      </header>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>Cargando equipos...</div>
      ) : teams.length === 0 ? (
        <div className="glass-card" style={{ color: 'var(--text-muted)' }}>
          No hay equipos. Crea uno en Team Analysis primero.
        </div>
      ) : (
        <>
          {/* Team selector */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={selectedTeamId === t.id ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.82rem' }}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Match list */}
          {matchLoading ? (
            <div style={{ color: 'var(--text-muted)' }}>Cargando partidas...</div>
          ) : matches.length === 0 ? (
            <div className="glass-card" style={{ color: 'var(--text-muted)' }}>
              No hay partidas registradas para este equipo.
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'clip' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 80px 70px 80px 1fr', padding: '0.4rem 1rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                <span>Fecha</span><span>Modo</span><span>Duración</span><span>Resultado</span><span>Parche</span>
              </div>
              {matches.slice(0, 50).map((m) => {
                const won = m.won;
                const resultColor = won === true ? 'var(--accent-win)' : won === false ? 'var(--accent-loss)' : 'var(--text-muted)';
                return (
                  <div
                    key={m.matchId}
                    onClick={() => navigate(`/matches/${m.matchId}`)}
                    style={{ display: 'grid', gridTemplateColumns: '140px 80px 70px 80px 1fr', padding: '0.55rem 1rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', alignItems: 'center', fontSize: '0.8rem', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(m.startTime).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{m.gameMode}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmtDuration(m.duration)}</span>
                    <span style={{ fontWeight: 700, color: resultColor, fontSize: '0.75rem' }}>
                      {won === true ? 'Victoria' : won === false ? 'Derrota' : '—'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.version ?? '—'}</span>
                      <Film size={11} style={{ color: 'var(--accent-blue)', marginLeft: 'auto' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
