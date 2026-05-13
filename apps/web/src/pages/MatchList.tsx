import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Film } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { LinkPlayerModal } from '../components/LinkPlayerModal';
import type { TeamProfile, TeamMatch } from '../api/client';

export default function MatchList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── All hooks must be declared unconditionally before any returns ──
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);

  const linkedPlayerId = (user as { linkedPlayerId?: string | null })?.linkedPlayerId;
  const hasTeam = (user?.memberships?.length ?? 0) > 0;
  const isStandalonePlayer = user?.globalRole === 'PLAYER' || (!hasTeam && user?.globalRole !== 'PLATFORM_ADMIN');

  useEffect(() => {
    if (isStandalonePlayer) return; // don't fetch team data for standalone players
    apiClient.teams.list()
      .then((r) => {
        const all = r.teams as unknown as TeamProfile[];
        setTeams(all);
        if (all.length > 0) setSelectedTeamId(all[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isStandalonePlayer]);

  useEffect(() => {
    if (!selectedTeamId || isStandalonePlayer) return;
    setMatchLoading(true);
    apiClient.teams.getAnalysis(selectedTeamId)
      .then((a) => setMatches((a as unknown as { teamMatches?: TeamMatch[] }).teamMatches ?? []))
      .catch(() => setMatches([]))
      .finally(() => setMatchLoading(false));
  }, [selectedTeamId, isStandalonePlayer]);

  // ── Conditional renders after all hooks ───────────────────────────

  // Standalone player with linked profile → go directly to their scouting page
  // Redirect to player profile via effect (not render-phase Navigate which can crash)
  const jugadorPlayerId = user?.memberships?.find(m => m.role === 'JUGADOR')?.playerId ?? null;
  const playerProfileId = (isStandalonePlayer && linkedPlayerId) ? linkedPlayerId
    : jugadorPlayerId ?? null;

  useEffect(() => {
    if (playerProfileId) {
      navigate('/analysis/players', {
        state: { autoLoadPlayerId: playerProfileId },
        replace: true,
      });
    }
  }, [playerProfileId, navigate]);

  // Standalone player without linked profile → show link CTA
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
            onLinked={(pid) => { setShowLinkModal(false); navigate(`/analysis/players?id=${pid}`); }}
            onClose={() => setShowLinkModal(false)}
          />
        )}
      </>
    );
  }

  // ── Team match list ────────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Cargando equipos...</div>;
  }

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Matches</h1>
      </header>

      <div className="glass-card" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Film size={16} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
        <select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          style={{ flex: 1, maxWidth: 320, padding: '0.45rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 7, color: 'var(--text-primary)', fontSize: '0.85rem' }}
        >
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {matchLoading && <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Cargando partidas...</div>}

      {!matchLoading && matches.length === 0 && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          No hay partidas registradas para este equipo.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => navigate(`/matches/${m.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)'; }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                {new Date(m.startTime).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                {m.gameMode} · {Math.floor((m.duration ?? 0) / 60)}m{((m.duration ?? 0) % 60).toString().padStart(2, '0')}s
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: (m as unknown as { won?: boolean }).won === true ? 'var(--accent-win)' : (m as unknown as { won?: boolean }).won === false ? 'var(--accent-loss)' : 'var(--text-muted)', background: (m as unknown as { won?: boolean }).won === true ? 'rgba(74,222,128,0.1)' : (m as unknown as { won?: boolean }).won === false ? 'rgba(248,113,113,0.1)' : 'transparent', padding: '0.2rem 0.5rem', borderRadius: 5 }}>
              {(m as unknown as { won?: boolean }).won === true ? 'WIN' : (m as unknown as { won?: boolean }).won === false ? 'LOSS' : '—'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
