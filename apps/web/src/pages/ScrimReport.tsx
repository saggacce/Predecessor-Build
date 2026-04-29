import { useEffect, useState } from 'react';
import { Shield, FileText, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type TeamProfile, type ScrimReport as ScrimReportData, ApiErrorResponse } from '../api/client';

export default function ScrimReport() {
  const [ownTeams, setOwnTeams] = useState<TeamProfile[]>([]);
  const [rivalTeams, setRivalTeams] = useState<TeamProfile[]>([]);
  const [ownTeamId, setOwnTeamId] = useState('');
  const [rivalTeamId, setRivalTeamId] = useState('');
  const [report, setReport] = useState<ScrimReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const [own, rival] = await Promise.allSettled([
        apiClient.teams.list('OWN'),
        apiClient.teams.list('RIVAL'),
      ]);
      if (own.status === 'fulfilled') setOwnTeams(own.value.teams ?? []);
      else toast.error('Failed to load own teams.');
      if (rival.status === 'fulfilled') setRivalTeams(rival.value.teams ?? []);
      else toast.error('Failed to load rival teams.');
    })();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!ownTeamId || !rivalTeamId) return;
    setLoading(true);
    setReport(null);
    const toastId = toast.loading('Generating scrim report...');
    try {
      const data = await apiClient.reports.scrim(ownTeamId, rivalTeamId);
      setReport(data);
      toast.success('Report generated', { id: toastId });
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Failed to generate report.';
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem',
    color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
  };

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Scrim Reports</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Generate pre-match intelligence reports.</p>
      </header>

      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleGenerate} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Our Team</label>
            <select value={ownTeamId} onChange={(e) => setOwnTeamId(e.target.value)} style={selectStyle}>
              <option value="">Select your team...</option>
              {ownTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '0.5rem' }}>
            <ChevronRight color="var(--text-muted)" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rival Team</label>
            <select value={rivalTeamId} onChange={(e) => setRivalTeamId(e.target.value)} style={selectStyle}>
              <option value="">Select rival team...</option>
              {rivalTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading || !ownTeamId || !rivalTeamId} className="btn-primary" style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap' }}>
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </form>
      </div>

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <FileText color="var(--accent-purple)" size={28} />
            <div>
              <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
                {report.ownTeam.name} <span style={{ color: 'var(--text-muted)' }}>vs</span> {report.rivalTeam.name}
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Generated {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {report.matchupNotes.length > 0 && (
            <div className="glass-card">
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Intelligence Notes</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {report.matchupNotes.map((note, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--accent-purple)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {[{ label: 'Our Roster', data: report.ownTeam, color: 'var(--accent-blue)' },
              { label: 'Rival Roster', data: report.rivalTeam, color: 'var(--accent-danger)' }].map(({ label, data, color }) => (
              <div key={label} className="glass-card">
                <h3 style={{ color, marginBottom: '1rem' }}>{label}: {data.name}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {data.roster.map((member, i) => (
                    <div key={i} style={{ padding: '0.75rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 600 }}>{member.displayName}</span>
                        {member.rankLabel && <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)' }}>{member.rankLabel}</span>}
                      </div>
                      {member.topHeroes.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {member.topHeroes.map((h) => (
                            <span key={h.slug} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(157,78,221,0.15)', borderRadius: '999px', color: 'var(--accent-purple)' }}>
                              {h.slug} {h.wins}W/{h.losses}L
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
