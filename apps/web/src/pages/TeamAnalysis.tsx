import { useEffect, useState } from 'react';
import { Users, Shield, AlertCircle } from 'lucide-react';
import { apiClient, type TeamProfile } from '../api/client';

export default function TeamAnalysis() {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [selected, setSelected] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiClient.teams.list();
        setTeams(data.teams ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load teams.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSelectTeam(id: string) {
    setError(null);
    try {
      const profile = await apiClient.teams.getProfile(id);
      setSelected(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team profile.');
    }
  }

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Team Analysis</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Roster tracking and aggregate team stats.</p>
      </header>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-danger)', marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '0.875rem' }}>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '280px 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Team list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading teams...</p>}

          {!loading && teams.length === 0 && (
            <div className="glass-card">
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No teams added yet.</p>
            </div>
          )}

          {['OWN', 'RIVAL'].map((type) => {
            const group = teams.filter((t) => t.type === type);
            if (!group.length) return null;
            return (
              <div key={type}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                  {type === 'OWN' ? 'Our Teams' : 'Rival Teams'}
                </p>
                {group.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => void handleSelectTeam(team.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      width: '100%', padding: '0.75rem 1rem', marginBottom: '0.5rem',
                      background: selected?.id === team.id ? 'rgba(157, 78, 221, 0.15)' : 'var(--bg-card)',
                      border: selected?.id === team.id ? '1px solid var(--border-highlight)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-primary)',
                      textAlign: 'left',
                    }}
                  >
                    <Users size={16} color={type === 'OWN' ? 'var(--accent-blue)' : 'var(--accent-danger)'} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{team.name}</div>
                      {team.abbreviation && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{team.abbreviation}</div>}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Team detail */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <Shield size={28} color={selected.type === 'OWN' ? 'var(--accent-blue)' : 'var(--accent-danger)'} />
                <div>
                  <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>{selected.name}</h2>
                  {selected.region && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>{selected.region}</p>}
                </div>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700,
                  padding: '0.25rem 0.75rem', borderRadius: '999px',
                  background: selected.type === 'OWN' ? 'rgba(0,245,212,0.15)' : 'rgba(239,35,60,0.15)',
                  color: selected.type === 'OWN' ? 'var(--accent-blue)' : 'var(--accent-danger)',
                }}>
                  {selected.type}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Matches</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{selected.aggregateStats.totalMatches}</div>
                </div>
                <div style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Avg KDA</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{selected.aggregateStats.averageKDA.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="glass-card">
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Active Roster</h3>
              {selected.roster.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No active players in roster.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selected.roster.map((member) => (
                    <div key={member.playerId} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.75rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)',
                    }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{member.displayName}</span>
                        {member.role && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{member.role}</span>}
                      </div>
                      {member.rating?.rankLabel && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600 }}>
                          {member.rating.rankLabel}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
