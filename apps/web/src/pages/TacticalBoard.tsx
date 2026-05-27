import { useState, useEffect } from 'react';
import TacticalBoardCanvas from '../components/TacticalBoardCanvas';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';

export default function TacticalBoard() {
  const { user, internalLoading } = useAuth();
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamId, setTeamId] = useState<string>('');

  useEffect(() => {
    if (internalLoading || !user) return;
    apiClient.teams.list('OWN')
      .then(r => {
        const list = r.teams ?? [];
        setTeams(list);
        if (list.length > 0) setTeamId(list[0].id);
      })
      .catch(() => {});
  }, [internalLoading, user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Tactical Board
          </h1>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
            Doble clic en un token de rol para asignar jugador y héroe · Ctrl+Z para deshacer · Del para eliminar seleccionado
          </p>
        </div>
        {teams.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Equipo:</span>
            <select
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', borderRadius: 6, padding: '4px 8px',
                fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Canvas — fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, padding: '0.75rem' }}>
        <TacticalBoardCanvas
          teamId={teamId || undefined}
          style={{ height: '100%', borderRadius: 8 }}
        />
      </div>
    </div>
  );
}
