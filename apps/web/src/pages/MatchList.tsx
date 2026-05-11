import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiClient } from '../api/client';
import type { TeamProfile } from '../api/client';

export default function MatchList() {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.teams.list('OWN')
      .then((r) => setTeams(r.teams as unknown as TeamProfile[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '1.5rem' }}>
      <div className="header">
        <h1 className="header-title">Matches</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Browse match history by team or player
        </p>
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading teams…</p>}

      {!loading && teams.length === 0 && (
        <div className="glass-card" style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>
          No teams found. Create a team in Team Analysis to get started.
        </div>
      )}

      {!loading && teams.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '640px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Select a team to view its match history:
          </p>
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/analysis/teams?team=${team.id}`}
              className="glass-card"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.15s',
              }}
            >
              {team.logoUrl && (
                <img src={team.logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{team.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {team.roster.length} players
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
