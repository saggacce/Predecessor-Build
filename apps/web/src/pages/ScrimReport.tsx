import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronRight, Download, Copy, Check, Target, Maximize, Minimize, AlertTriangle, Lightbulb, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiClient,
  type TeamProfile,
  type ScrimReport as ScrimReportData,
  type TeamAnalysis,
  type RivalScoutingReport,
  ApiErrorResponse,
} from '../api/client';
import { useHeroMeta, normalizeHeroSlug } from '../hooks/useHeroMeta';
import { useAuth } from '../hooks/useAuth';

const ROLE_ORDER = ['carry', 'jungle', 'midlane', 'offlane', 'support'];
const ROLE_LABELS: Record<string, string> = {
  carry: 'Carry', jungle: 'Jungle', midlane: 'Mid',
  offlane: 'Offlane', support: 'Support',
};

export default function ScrimReport() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [ownTeams, setOwnTeams] = useState<TeamProfile[]>([]);
  const [rivalTeams, setRivalTeams] = useState<TeamProfile[]>([]);
  const [ownTeamId, setOwnTeamId] = useState('');
  const [rivalTeamId, setRivalTeamId] = useState('');
  const [report, setReport] = useState<ScrimReportData | null>(null);
  const [rivalAnalysis, setRivalAnalysis] = useState<TeamAnalysis | null>(null);
  const [rivalScouting, setRivalScouting] = useState<RivalScoutingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [syncingMatches, setSyncingMatches] = useState(false);
  const [matchSyncResult, setMatchSyncResult] = useState<{ synced: number; remaining: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const [own, rival] = await Promise.allSettled([
        apiClient.teams.list('OWN'),
        apiClient.teams.list('RIVAL'),
      ]);
      if (own.status === 'fulfilled') setOwnTeams(own.value.teams ?? []);
      if (rival.status === 'fulfilled') {
        setRivalTeams(rival.value.teams ?? []);
        const preselected = searchParams.get('rival');
        if (preselected && rival.value.teams?.some((t: TeamProfile) => t.id === preselected)) {
          setRivalTeamId(preselected);
        }
      }
    })();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!ownTeamId || !rivalTeamId) return;
    setLoading(true);
    setReport(null);
    setRivalAnalysis(null);
    setRivalScouting(null);
    const toastId = toast.loading('Generating scrim report...');
    try {
      const [data, analysis, scouting] = await Promise.allSettled([
        apiClient.reports.scrim(ownTeamId, rivalTeamId),
        apiClient.teams.getAnalysis(rivalTeamId),
        apiClient.teams.getRivalScouting(rivalTeamId),
      ]);
      if (data.status === 'fulfilled') setReport(data.value);
      else throw data.reason;
      if (analysis.status === 'fulfilled') setRivalAnalysis(analysis.value);
      if (scouting.status === 'fulfilled') setRivalScouting(scouting.value);
      toast.success('Report ready', { id: toastId });
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to generate report.', { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (!report) return;
    const html = buildPrintHTML(report, rivalAnalysis);
    const win = window.open('', '_blank');
    if (!win) { toast.error('Allow popups to export PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
  }

  async function handleSyncRivalMatches() {
    if (!rivalTeamId) return;
    setSyncingMatches(true);
    const toastId = toast.loading('Syncing rival match data...');
    try {
      const res = await apiClient.teams.syncMatches(rivalTeamId, 10);
      setMatchSyncResult({ synced: res.synced, remaining: res.remaining });
      const msg = `${res.synced} matches synced${res.remaining > 0 ? ` · ${res.remaining} remaining` : ''}`;
      toast.success('Rival matches synced', { id: toastId, description: msg });
      // Reload rival analysis
      const analysis = await apiClient.teams.getAnalysis(rivalTeamId);
      setRivalAnalysis(analysis);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Sync failed', { id: toastId });
    } finally {
      setSyncingMatches(false);
    }
  }

  function handleCopyText() {
    if (!report) return;
    const text = buildTextReport(report, rivalAnalysis);
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Report copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggleFullScreen() {
    if (!containerRef.current) return;
    if (!isFullScreen) {
      void containerRef.current.requestFullscreen?.();
      setIsFullScreen(true);
    } else {
      void document.exitFullscreen?.();
      setIsFullScreen(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem',
    color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
  };

  // Build ban suggestions from rival analysis hero pool
  const banTargets = (rivalAnalysis?.rivalHeroPool ?? [])
    .filter((h) => h.games >= 3 && h.winRate >= 50)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
    .slice(0, 5);

  const ALL_OBJ_TYPES = ['FANGTOOTH', 'PRIMAL_FANGTOOTH', 'ORB_PRIME', 'MINI_PRIME', 'SHAPER'] as const;
  const majorObjControl = ALL_OBJ_TYPES.map((type) => {
    const found = (rivalAnalysis?.objectiveControl ?? []).find((o) => o.entityType === type);
    return found ?? { entityType: type, controlPct: 0, avgGameTimeSecs: null, count: 0 };
  });

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Scrim Report</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {user?.globalRole === 'PLAYER' || (user?.memberships?.length ?? 0) === 0
            ? 'Aggregated weekly performance summary.'
            : 'Pre-match intelligence report for coaching staff.'
          }
        </p>
      </header>

      {/* Form */}
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
        <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: isFullScreen ? 'var(--bg-dark)' : undefined, padding: isFullScreen ? '2rem 3rem' : undefined, overflowY: isFullScreen ? 'auto' : undefined, maxWidth: isFullScreen ? '1200px' : undefined, margin: isFullScreen ? '0 auto' : undefined, width: isFullScreen ? '100%' : undefined, boxSizing: 'border-box' }}>

          {/* VS header */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* OWN team */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <TeamLogoMini team={ownTeams.find((t) => t.id === ownTeamId)} name={report.ownTeam.name} color="var(--accent-teal-bright)" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.ownTeam.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--accent-teal-bright)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Our Team</div>
                </div>
              </div>
              {/* VS badge */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>VS</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(report.generatedAt).toLocaleDateString()}</div>
              </div>
              {/* RIVAL team */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end', minWidth: 0 }}>
                <div style={{ minWidth: 0, textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.rivalTeam.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--accent-loss)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rival</div>
                </div>
                <TeamLogoMini team={rivalTeams.find((t) => t.id === rivalTeamId)} name={report.rivalTeam.name} color="var(--accent-loss)" />
              </div>
            </div>
            {/* Export buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button onClick={toggleFullScreen} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', transition: 'all 0.15s' }}>
                {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
                {isFullScreen ? 'Exit' : 'Full Screen'}
              </button>
              <button onClick={handleCopyText} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', transition: 'all 0.15s' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy text'}
              </button>
              <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)', transition: 'all 0.15s' }}>
                <Download size={14} /> Save PDF
              </button>
            </div>
          </div>

          {/* Win Conditions */}
          {rivalScouting && (
            <WinConditions scouting={rivalScouting} />
          )}

          {/* Intelligence notes — categorized */}
          {report.matchupNotes.length > 0 && (
            <div className="glass-card">
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>Intelligence Notes</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {report.matchupNotes.map((note, i) => {
                  const cat = classifyNote(note);
                  return (
                    <li key={i} style={{ display: 'flex', gap: '0.65rem', padding: '0.6rem 0.75rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)', border: `1px solid ${cat.borderColor}` }}>
                      <span style={{ flexShrink: 0, color: cat.color, paddingTop: '0.1rem' }}>{cat.icon}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{note}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Ban recommendations (if analysis available) */}
          {banTargets.length > 0 && (
            <div className="glass-card">
              <h3 style={{ color: 'var(--accent-loss)', marginBottom: '1rem', fontSize: '0.95rem' }}>⚔ Ban Targets</h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {banTargets.map((h, i) => (
                  <div key={`${h.playerId}-${h.heroSlug}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: `1px solid ${i === 0 ? '#ef4444' : i <= 1 ? '#f97316' : 'var(--border-color)'}`, borderRadius: '8px', background: i === 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={`/heroes/${normalizeHeroSlug(h.heroSlug)}.webp`} alt={h.heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'capitalize' }}>{h.heroSlug}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{h.winRate}% WR · {h.games} games</div>
                    </div>
                    {i === 0 && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.15)', borderRadius: '4px', padding: '0.1rem 0.35rem' }}>PRIORITY</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Objective tendencies */}
          <div className="glass-card">
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>Rival Objective Control</h3>
            {majorObjControl.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  No event stream data yet for this team.
                  {matchSyncResult && matchSyncResult.remaining > 0 && ` ${matchSyncResult.remaining} matches still pending — click again to continue.`}
                </p>
                <button onClick={() => void handleSyncRivalMatches()} disabled={syncingMatches || !rivalTeamId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 600, padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: syncingMatches ? 'not-allowed' : 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)', opacity: syncingMatches ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Download size={13} style={{ animation: syncingMatches ? 'spin 1s linear infinite' : 'none' }} />
                  {syncingMatches ? 'Syncing...' : 'Sync rival matches (10)'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                {majorObjControl.map((o) => {
                  const label: Record<string, string> = { FANGTOOTH: 'Fangtooth', PRIMAL_FANGTOOTH: 'Primal FT', ORB_PRIME: 'Orb Prime', MINI_PRIME: 'Mini Prime', SHAPER: 'Shaper' };
                  const color: Record<string, string> = { FANGTOOTH: '#ef4444', PRIMAL_FANGTOOTH: '#b91c1c', ORB_PRIME: '#7c3aed', MINI_PRIME: '#a78bfa', SHAPER: '#c084fc' };
                  const c = color[o.entityType] ?? '#64748b';
                  const l = label[o.entityType] ?? o.entityType;
                  const hasData = o.controlPct > 0 || (o as { count?: number }).count > 0;
                  return (
                    <div key={o.entityType} style={{ flex: '1 1 120px', padding: '0.75rem', border: `1px solid ${hasData ? c + '33' : 'var(--border-color)'}`, borderRadius: '8px', background: hasData ? `${c}08` : 'transparent', opacity: hasData ? 1 : 0.45 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: hasData ? c : 'var(--text-muted)', marginBottom: '0.35rem' }}>{l}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: !hasData ? 'var(--text-muted)' : o.controlPct >= 60 ? 'var(--accent-loss)' : o.controlPct <= 40 ? 'var(--accent-win)' : 'var(--accent-prime)' }}>
                        {hasData ? `${o.controlPct}%` : '—'}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {!hasData ? 'sin datos' : o.controlPct >= 60 ? '⚠ Ellos dominan' : o.controlPct <= 40 ? '✓ Ventaja nuestra' : '↔ Disputado'}
                        {o.avgGameTimeSecs ? ` · avg ${Math.floor(o.avgGameTimeSecs / 60)}:${String(o.avgGameTimeSecs % 60).padStart(2, '0')}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rosters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {([
              { label: 'Our Roster', data: report.ownTeam, color: 'var(--accent-blue)', analysis: null },
              { label: 'Rival Roster', data: report.rivalTeam, color: 'var(--accent-loss)', analysis: rivalAnalysis },
            ] as const).map(({ label, data, color, analysis: ta }) => (
              <div key={label} className="glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ width: 3, height: 16, borderRadius: 999, background: color, flexShrink: 0 }} />
                  <h3 style={{ color, margin: 0, fontSize: '0.88rem' }}>{label}: <span style={{ color: 'var(--text-primary)' }}>{data.name}</span></h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {[...data.roster].sort((a, b) => {
                    const ai = ROLE_ORDER.indexOf(a.role ?? '');
                    const bi = ROLE_ORDER.indexOf(b.role ?? '');
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                  }).map((member, i) => {
                    const playerStat = ta?.playerStats.find((p) => (p.customName ?? p.displayName) === member.displayName || p.displayName === member.displayName);
                    const heroPool = ta ? (ta.rivalHeroPool.filter((h) => h.playerId === playerStat?.playerId && h.games >= 2).slice(0, 4)) : [];
                    const topHeroGames = heroPool[0]?.games ?? 0;
                    const isOneTrick = playerStat && topHeroGames >= 5 && (topHeroGames / playerStat.matches) >= 0.5;
                    return (
                      <div key={i} style={{ padding: '0.65rem 0.75rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {member.role && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ROLE_LABELS[member.role] ?? member.role}</span>}
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{member.displayName}</span>
                            {isOneTrick && <Target size={11} aria-label="One-trick" style={{ color: 'var(--accent-loss)', flexShrink: 0 }} />}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {member.rankLabel && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--accent-violet)', fontWeight: 500 }}>{member.rankLabel}</span>}
                            {playerStat && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: playerStat.winRate >= 55 ? 'var(--accent-win)' : playerStat.winRate < 45 ? 'var(--accent-loss)' : 'var(--text-muted)' }}>{playerStat.winRate.toFixed(0)}% WR</span>}
                          </div>
                        </div>
                        {/* Hero pool from match data (or snapshot fallback) */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(heroPool.length > 0 ? heroPool.map((h) => ({ slug: h.heroSlug, label: `${h.games}g ${h.winRate}% WR` })) : member.topHeroes.slice(0, 5).map((h) => ({ slug: h.slug, label: `${h.wins}W/${h.losses}L` }))).map((h) => (
                            <div key={h.slug} title={`${h.slug} · ${h.label}`} style={{ width: 28, height: 28, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-card)', flexShrink: 0 }}>
                              <img src={`/heroes/${normalizeHeroSlug(h.slug)}.webp`} alt={h.slug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Print HTML builder ────────────────────────────────────────────────────────

function buildPrintHTML(report: ScrimReportData, analysis: TeamAnalysis | null): string {
  const banTargets = (analysis?.rivalHeroPool ?? [])
    .filter((h) => h.games >= 3 && h.winRate >= 50)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5);

  const majorObjs = (analysis?.objectiveControl ?? []).filter((o) =>
    ['FANGTOOTH', 'PRIMAL_FANGTOOTH', 'ORB_PRIME', 'MINI_PRIME'].includes(o.entityType)
  );

  const rosterHTML = (team: ScrimReportData['ownTeam'], isRival: boolean, ta: TeamAnalysis | null) => {
    const sorted = [...team.roster].sort((a, b) => {
      const ai = ROLE_ORDER.indexOf(a.role ?? ''); const bi = ROLE_ORDER.indexOf(b.role ?? '');
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return sorted.map((m) => {
      const ps = ta?.playerStats.find((p) => p.displayName === m.displayName);
      const pool = isRival && ta ? ta.rivalHeroPool.filter((h) => h.playerId === ps?.playerId && h.games >= 2).slice(0, 5) : [];
      const heroes = pool.length > 0 ? pool.map((h) => h.heroSlug) : m.topHeroes.slice(0, 5).map((h) => h.slug);
      return `<tr>
        <td><b>${m.role ? ROLE_LABELS[m.role] ?? m.role : '—'}</b></td>
        <td>${m.displayName}</td>
        <td>${m.rankLabel ?? '—'}</td>
        <td>${ps ? `${ps.winRate.toFixed(0)}% WR · ${ps.kda.toFixed(2)} KDA` : '—'}</td>
        <td>${heroes.join(', ')}</td>
      </tr>`;
    }).join('');
  };

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Scrim Report — ${report.ownTeam.name} vs ${report.rivalTeam.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: white; padding: 32px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 22px; color: #0f172a; margin-bottom: 4px; }
  h2 { font-size: 16px; color: #1e3a5f; margin: 20px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 13px; color: #475569; margin-bottom: 6px; }
  .meta { color: #64748b; font-size: 11px; margin-bottom: 24px; }
  .badge { display: inline-block; background: #f1f5f9; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; margin-right: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f8fafc; text-align: left; padding: 6px 10px; font-size: 11px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  .note { background: #f8fafc; border-left: 3px solid #7c3aed; padding: 8px 12px; margin-bottom: 8px; border-radius: 0 6px 6px 0; font-size: 12px; }
  .ban { display: inline-block; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 4px 10px; margin: 3px; font-size: 12px; font-weight: 600; }
  .obj { display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; margin: 3px; font-size: 12px; }
  .obj-pct { font-weight: 700; font-size: 15px; }
  .warning { color: #dc2626; } .ok { color: #16a34a; } .neutral { color: #d97706; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .section { margin-bottom: 20px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  @page { margin: 20mm; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>Scrim Report</h1>
<p class="meta">${report.ownTeam.name} vs ${report.rivalTeam.name} · Generated ${new Date(report.generatedAt).toLocaleString()} · Rift Line</p>

<div class="section">
<h2>Intelligence Notes</h2>
${report.matchupNotes.map((n) => `<div class="note">${n}</div>`).join('')}
</div>

${banTargets.length > 0 ? `<div class="section">
<h2>Ban Targets</h2>
${banTargets.map((h, i) => `<span class="ban">${i === 0 ? '★ ' : ''}${h.heroSlug} — ${h.winRate}% WR (${h.games}g)</span>`).join('')}
</div>` : ''}

${majorObjs.length > 0 ? `<div class="section">
<h2>Rival Objective Control</h2>
${majorObjs.map((o) => {
  const label = { FANGTOOTH: 'Fangtooth', PRIMAL_FANGTOOTH: 'Primal FT', ORB_PRIME: 'Orb Prime', MINI_PRIME: 'Mini Prime' }[o.entityType] ?? o.entityType;
  const cls = o.controlPct >= 60 ? 'warning' : o.controlPct <= 40 ? 'ok' : 'neutral';
  const timing = o.avgGameTimeSecs ? ` · avg ${Math.floor(o.avgGameTimeSecs / 60)}:${String(o.avgGameTimeSecs % 60).padStart(2, '0')}` : '';
  return `<span class="obj"><b>${label}</b><br><span class="obj-pct ${cls}">${o.controlPct}%</span>${timing}</span>`;
}).join('')}
</div>` : ''}

<div class="grid">
<div>
<h2>Our Roster — ${report.ownTeam.name}</h2>
<table><thead><tr><th>Role</th><th>Player</th><th>Rank</th><th>Stats</th><th>Heroes</th></tr></thead>
<tbody>${rosterHTML(report.ownTeam, false, null)}</tbody></table>
</div>
<div>
<h2>Rival Roster — ${report.rivalTeam.name}</h2>
<table><thead><tr><th>Role</th><th>Player</th><th>Rank</th><th>Stats</th><th>Heroes</th></tr></thead>
<tbody>${rosterHTML(report.rivalTeam, true, analysis)}</tbody></table>
</div>
</div>

<div class="footer">Rift Line — Competitive Intel · Staff confidential</div>
</body></html>`;
}

// ── Text export builder ───────────────────────────────────────────────────────

function buildTextReport(report: ScrimReportData, analysis: TeamAnalysis | null): string {
  const banTargets = (analysis?.rivalHeroPool ?? [])
    .filter((h) => h.games >= 3 && h.winRate >= 50)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5);

  const lines: string[] = [
    `SCRIM REPORT — ${report.ownTeam.name} vs ${report.rivalTeam.name}`,
    `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    '='.repeat(60),
    '',
    'INTELLIGENCE NOTES',
    ...report.matchupNotes.map((n, i) => `${i + 1}. ${n}`),
    '',
  ];

  if (banTargets.length > 0) {
    lines.push('BAN TARGETS');
    banTargets.forEach((h, i) => lines.push(`${i + 1}. ${h.heroSlug} — ${h.winRate}% WR (${h.games} games)`));
    lines.push('');
  }

  const objControl = (analysis?.objectiveControl ?? []).filter((o) =>
    ['FANGTOOTH', 'PRIMAL_FANGTOOTH', 'ORB_PRIME', 'MINI_PRIME'].includes(o.entityType)
  );
  if (objControl.length > 0) {
    lines.push('RIVAL OBJECTIVE CONTROL');
    objControl.forEach((o) => {
      const label = { FANGTOOTH: 'Fangtooth', PRIMAL_FANGTOOTH: 'Primal FT', ORB_PRIME: 'Orb Prime', MINI_PRIME: 'Mini Prime' }[o.entityType] ?? o.entityType;
      const timing = o.avgGameTimeSecs ? ` (avg ${Math.floor(o.avgGameTimeSecs / 60)}:${String(o.avgGameTimeSecs % 60).padStart(2, '0')})` : '';
      lines.push(`- ${label}: ${o.controlPct}% control${timing}`);
    });
    lines.push('');
  }

  [
    { label: 'OUR ROSTER', data: report.ownTeam },
    { label: 'RIVAL ROSTER', data: report.rivalTeam },
  ].forEach(({ label, data }) => {
    lines.push(label + ' — ' + data.name);
    [...data.roster].sort((a, b) => (ROLE_ORDER.indexOf(a.role ?? '') + 1 || 99) - (ROLE_ORDER.indexOf(b.role ?? '') + 1 || 99)).forEach((m) => {
      const heroes = m.topHeroes.slice(0, 4).map((h) => h.slug).join(', ');
      lines.push(`  [${m.role ? ROLE_LABELS[m.role] ?? m.role : '?'}] ${m.displayName}${m.rankLabel ? ` (${m.rankLabel})` : ''}${heroes ? ' — ' + heroes : ''}`);
    });
    lines.push('');
  });

  lines.push('— Rift Line Competitive Intel —');
  return lines.join('\n');
}

// ── Helper components ─────────────────────────────────────────────────────────

function TeamLogoMini({ team, name, color }: { team: TeamProfile | undefined; name: string; color: string }) {
  const initials = (team?.abbreviation || name)
    .split(/\s+/).map((w: string) => w[0]).join('').slice(0, 3).toUpperCase();
  return (
    <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', border: `2px solid ${color}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}18` }}>
      {team?.logoUrl ? (
        <img src={team.logoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', color }}>{initials}</span>
      )}
    </div>
  );
}

function classifyNote(note: string): { icon: React.ReactNode; color: string; borderColor: string } {
  const lower = note.toLowerCase();
  if (/ban|priority ban/.test(lower))
    return { icon: <Target size={14} />, color: 'var(--accent-loss)', borderColor: 'rgba(248,113,113,0.2)' };
  if (/weak|struggle|low|poor|vulner|exploit|only \d+%|below/.test(lower))
    return { icon: <Lightbulb size={14} />, color: 'var(--accent-prime)', borderColor: 'rgba(240,180,41,0.2)' };
  return { icon: <AlertTriangle size={14} />, color: 'var(--accent-blue)', borderColor: 'rgba(91,156,246,0.2)' };
}

function WinConditions({ scouting }: { scouting: RivalScoutingReport }) {
  const conditions: string[] = [];

  if (scouting.weakPhase)
    conditions.push(`Force ${scouting.weakPhase} game — they underperform in this phase.`);
  if (scouting.throwRate !== null && scouting.throwRate > 0.2)
    conditions.push(`Play patient — they throw leads at ${(scouting.throwRate * 100).toFixed(0)}% rate.`);
  if (scouting.weakRole)
    conditions.push(`Focus their ${ROLE_LABELS[scouting.weakRole] ?? scouting.weakRole} — statistically their weakest position.`);
  const lowObj = scouting.objectivePriority.find((o) => o.controlPct < 45);
  if (lowObj)
    conditions.push(`Contest ${lowObj.entityType.replace('_', ' ').toLowerCase()} — they only control it ${lowObj.controlPct}% of the time.`);
  if (scouting.identity.includes('Late Game Scaling'))
    conditions.push('Close the game before 25 minutes — they scale hard into late game.');

  if (conditions.length === 0) return null;

  return (
    <div className="glass-card" style={{ borderLeft: '3px solid var(--accent-win)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
        <Trophy size={16} style={{ color: 'var(--accent-win)', flexShrink: 0 }} />
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--accent-win)' }}>Win Conditions</h3>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{scouting.sampleSize} matches</span>
      </div>
      <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {conditions.slice(0, 3).map((c, i) => (
          <li key={i} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.55rem 0.75rem', background: 'rgba(74,222,128,0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.72rem', color: 'var(--accent-win)', flexShrink: 0, paddingTop: '0.1rem' }}>{i + 1}.</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{c}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
