import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Shield, TrendingUp, TrendingDown, Minus, AlertTriangle, Target } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiErrorResponse, type TeamProfile, type RivalScoutingReport } from '../api/client';

const ROLE_COLORS: Record<string, string> = {
  carry: '#f0b429', jungle: '#7fd66b', midlane: '#a78bfa',
  offlane: '#f87171', support: '#38d4c8',
};
const ROLE_LABELS: Record<string, string> = {
  carry: 'Carry', jungle: 'Jungle', midlane: 'Mid', offlane: 'Offlane', support: 'Support',
};
const OBJ_LABELS: Record<string, string> = {
  FANGTOOTH: 'Fangtooth', PRIMAL_FANGTOOTH: 'Primal FT',
  ORB_PRIME: 'Orb Prime', MINI_PRIME: 'Mini Prime', SHAPER: 'Shaper',
};
const OBJ_COLORS: Record<string, string> = {
  FANGTOOTH: '#ef4444', PRIMAL_FANGTOOTH: '#b91c1c',
  ORB_PRIME: '#7c3aed', MINI_PRIME: '#a78bfa', SHAPER: '#c084fc',
};
const PHASE_COLORS = { early: '#ef4444', mid: '#f0b429', late: '#3b82f6' };
const IDENTITY_COLORS: Record<string, string> = {
  'Early Aggressor': '#ef4444',
  'Objective Focused': '#f0b429',
  'Vision Heavy': '#38d4c8',
  'Team Fight Oriented': '#a78bfa',
  'Late Game Scaling': '#3b82f6',
  'Comeback Specialist': '#4ade80',
  'Passive Farmer': '#94a3b8',
};

export default function RivalScouting() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('rival') ?? '');
  const [report, setReport] = useState<RivalScoutingReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient.teams.list('RIVAL')
      .then((res) => setTeams(res.teams ?? []))
      .catch(() => toast.error('Failed to load rival teams'));
  }, []);

  useEffect(() => {
    if (!selectedId) { setReport(null); return; }
    setLoading(true);
    setReport(null);
    apiClient.teams.getRivalScouting(selectedId)
      .then((data) => setReport(data))
      .catch((err) => {
        const msg = err instanceof ApiErrorResponse ? err.error.message : 'Failed to load scouting report';
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setSearchParams(id ? { rival: id } : {});
  }

  const selectedTeam = teams.find((t) => t.id === selectedId);

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Rival Scouting</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.875rem' }}>
          Identity, threat players and objective patterns for rival teams.
        </p>
      </header>

      {/* Team selector */}
      <div className="glass-card" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <Shield size={16} style={{ color: 'var(--accent-loss)', flexShrink: 0 }} />
        <select
          className="input"
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          style={{ flex: '1 1 240px', maxWidth: 340 }}
        >
          <option value="">Select a rival team…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {selectedTeam?.region && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedTeam.region}</span>
        )}
      </div>

      {/* Empty state */}
      {!selectedId && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Shield size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Select a rival team to generate their scouting report.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Loading scouting data…
        </div>
      )}

      {/* Report */}
      {report && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Row 1 — Identity + Form + Phase summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

            {/* Identity */}
            <div className="glass-card">
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
                Team Identity
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.6rem', fontFamily: 'var(--font-mono)' }}>
                {report.sampleSize} matches analyzed
              </div>
              {report.identity.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {report.identity.map((label) => {
                    const color = IDENTITY_COLORS[label] ?? 'var(--accent-blue)';
                    return (
                      <span key={label} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px', background: `${color}18`, border: `1px solid ${color}44`, color }}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Not enough data to determine identity.</p>
              )}
            </div>

            {/* Recent Form */}
            <div className="glass-card">
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
                Recent Form
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                {report.recentForm.last10.map((r, i) => (
                  <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: r === 'W' ? 'var(--accent-win)' : 'var(--accent-loss)', opacity: r === 'W' ? 0.9 : 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#000', fontFamily: 'var(--font-mono)' }}>{r}</span>
                  </div>
                ))}
                {report.recentForm.last10.length === 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No recent matches</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--accent-win)', fontWeight: 700 }}>{report.recentForm.wins}W</span>
                  <span style={{ color: 'var(--text-muted)', margin: '0 0.2rem' }}>·</span>
                  <span style={{ color: 'var(--accent-loss)', fontWeight: 700 }}>{report.recentForm.losses}L</span>
                </span>
                <TrendBadge trend={report.recentForm.trend} />
              </div>
            </div>

            {/* Phase & Weaknesses */}
            <div className="glass-card">
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
                Phase Profile
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {report.strongPhase && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 3, height: 14, borderRadius: 999, background: PHASE_COLORS[report.strongPhase] }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Strong in</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: PHASE_COLORS[report.strongPhase], textTransform: 'capitalize' }}>{report.strongPhase} game</span>
                  </div>
                )}
                {report.weakPhase && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 3, height: 14, borderRadius: 999, background: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Weak in</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{report.weakPhase} game</span>
                  </div>
                )}
                {report.throwRate !== null && report.throwRate > 0.15 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <AlertTriangle size={13} style={{ color: 'var(--accent-prime)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Throw rate</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-prime)' }}>
                      {(report.throwRate * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {report.weakRole && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Target size={13} style={{ color: 'var(--accent-loss)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Weak role</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: ROLE_COLORS[report.weakRole] ?? 'var(--accent-loss)' }}>
                      {ROLE_LABELS[report.weakRole] ?? report.weakRole}
                    </span>
                  </div>
                )}
                {!report.strongPhase && !report.weakPhase && !report.weakRole && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Not enough data.</p>
                )}
              </div>
            </div>
          </div>

          {/* Threat Players */}
          {report.threatPlayers.length > 0 && (
            <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
                Threat Players
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {report.threatPlayers.map((p, i) => {
                  const roleColor = ROLE_COLORS[p.role ?? ''] ?? 'var(--text-muted)';
                  const threatPct = Math.min((p.threatScore / (report.threatPlayers[0]?.threatScore || 1)) * 100, 100);
                  return (
                    <div key={p.playerId} style={{ display: 'grid', gridTemplateColumns: '24px 160px 1fr 100px 80px 80px', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: i === 0 ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: i === 0 ? '1px solid rgba(248,113,113,0.2)' : '1px solid var(--border-color)' }}>
                      {/* Rank */}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: i === 0 ? 'var(--accent-loss)' : 'var(--text-muted)', fontWeight: 700 }}>#{i + 1}</span>
                      {/* Name + role */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.customName ?? p.displayName}
                        </div>
                        {p.role && (
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: roleColor }}>{ROLE_LABELS[p.role] ?? p.role}</span>
                        )}
                      </div>
                      {/* Threat bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${threatPct}%`, background: i === 0 ? 'var(--accent-loss)' : 'var(--accent-blue)', borderRadius: 999 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0 }}>{p.threatScore.toFixed(1)}</span>
                      </div>
                      {/* Stats */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: p.winRate >= 55 ? 'var(--accent-win)' : p.winRate < 45 ? 'var(--accent-loss)' : 'var(--text-secondary)', fontWeight: 700 }}>{p.winRate.toFixed(0)}%</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{p.games}g WR</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: p.kda >= 3 ? 'var(--accent-win)' : 'var(--text-secondary)' }}>{p.kda.toFixed(2)}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>KDA</div>
                      </div>
                      {/* Hero pool */}
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        {p.topHeroes.slice(0, 4).map((h) => (
                          <div key={h.heroSlug} title={`${h.heroSlug} · ${h.games}g · ${h.winRate}% WR`} style={{ width: 26, height: 26, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                            <img src={`/heroes/${h.heroSlug}.webp`} alt={h.heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Objective Priority */}
          {report.objectivePriority.length > 0 && (
            <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
                Objective Priority
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {report.objectivePriority.map((o) => {
                  const color = OBJ_COLORS[o.entityType] ?? '#64748b';
                  const label = OBJ_LABELS[o.entityType] ?? o.entityType;
                  const avgMin = o.avgGameTimeSecs ? Math.floor(o.avgGameTimeSecs / 60) : null;
                  return (
                    <div key={o.entityType} style={{ flex: '1 1 150px', padding: '0.75rem 1rem', border: `1px solid ${color}33`, borderRadius: '8px', background: `${color}08` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color }}>{label}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '0.4rem' }}>
                        <div style={{ height: '100%', width: `${o.controlPct}%`, background: color, borderRadius: 999 }} />
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color }}>{o.controlPct}% control</div>
                      {avgMin !== null && (
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>avg at {avgMin}m</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function TrendBadge({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
  if (trend === 'improving') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-win)', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '999px', padding: '0.1rem 0.45rem' }}>
      <TrendingUp size={10} /> Improving
    </span>
  );
  if (trend === 'declining') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-loss)', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '999px', padding: '0.1rem 0.45rem' }}>
      <TrendingDown size={10} /> Declining
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.1rem 0.45rem' }}>
      <Minus size={10} /> Stable
    </span>
  );
}
