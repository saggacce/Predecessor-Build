import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode, type KeyboardEvent } from 'react';
import { RankIcon } from '../components/RankIcon';
import {
  Users,
  Shield,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  UserPlus,
  UserMinus,
  Target,
  Activity,
  Swords,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type TeamProfile, type TeamRole, type PlayerSearchResult, type TeamAnalysis, type TeamObjectiveControl, ApiErrorResponse } from '../api/client';

const ROLES: TeamRole[] = ['carry', 'jungle', 'midlane', 'offlane', 'support'];

const roleLabel: Record<TeamRole, string> = {
  carry: 'Carry',
  jungle: 'Jungle',
  midlane: 'Mid',
  offlane: 'Offlane',
  support: 'Support',
};

const RANK_ICON_IDS: Record<string, string> = {
  bronze: '26389cf81c492cde',
  silver: 'fc69387012302b46',
  gold: 'bd3235ed2d814c4d',
  platinum: '82f82fede2ff80be',
  diamond: 'ecb7e9ae11b82dbc',
  paragon: '228ce78233215776',
};

interface TeamFormData {
  name: string;
  abbreviation: string;
  logoUrl: string;
  type: 'OWN' | 'RIVAL';
  region: string;
  notes: string;
}

const emptyForm = (): TeamFormData => ({ name: '', abbreviation: '', logoUrl: '', type: 'RIVAL', region: '', notes: '' });

export default function TeamAnalysis() {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [selected, setSelected] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [detailTab, setDetailTab] = useState<'roster' | 'performance'>('roster');
  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<TeamFormData>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [rosterQuery, setRosterQuery] = useState('');
  const [rosterResults, setRosterResults] = useState<PlayerSearchResult[]>([]);
  const [rosterSearching, setRosterSearching] = useState(false);
  const [addingRole, setAddingRole] = useState<TeamRole | undefined>(undefined);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadTeams() {
    try {
      const data = await apiClient.teams.list();
      setTeams(data.teams ?? []);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTeams(); }, []);

  async function loadAnalysis(teamId: string) {
    setLoadingAnalysis(true);
    setAnalysis(null);
    try {
      const data = await apiClient.teams.getAnalysis(teamId);
      setAnalysis(data);
    } catch {
      // silent — show empty state
    } finally {
      setLoadingAnalysis(false);
    }
  }

  function handleTabChange(tab: 'roster' | 'performance') {
    setDetailTab(tab);
    if (tab === 'performance' && selected && !analysis) {
      void loadAnalysis(selected.id);
    }
  }

  async function handleSelectTeam(id: string) {
    setDetailTab('roster');
    setAnalysis(null);
    try {
      const profile = await apiClient.teams.getProfile(id);
      setSelected(profile);
      setFormMode(null);
      setRosterQuery('');
      setRosterResults([]);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to load team.');
    }
  }

  async function refreshSelected() {
    if (!selected) return;
    const profile = await apiClient.teams.getProfile(selected.id);
    setSelected(profile);
    setTeams((prev) => prev.map((t) => t.id === profile.id ? { ...t, ...profile } : t));
  }

  function openCreate() {
    setForm(emptyForm());
    setFormMode('create');
    setSelected(null);
  }

  function openEdit(team: TeamProfile) {
    setForm({
      name: team.name,
      abbreviation: team.abbreviation ?? '',
      logoUrl: team.logoUrl ?? '',
      type: team.type as 'OWN' | 'RIVAL',
      region: team.region ?? '',
      notes: team.notes ?? '',
    });
    setFormMode('edit');
  }

  async function handleSaveTeam() {
    if (!form.name.trim()) { toast.error('Team name is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        abbreviation: form.abbreviation.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        type: form.type,
        region: form.region.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (formMode === 'create') {
        const created = await apiClient.teams.create(payload);
        toast.success(`Team "${created.name}" created.`);
        await loadTeams();
        await handleSelectTeam(created.id);
      } else if (formMode === 'edit' && selected) {
        await apiClient.teams.update(selected.id, {
          name: payload.name,
          abbreviation: payload.abbreviation ?? null,
          logoUrl: payload.logoUrl ?? null,
          region: payload.region ?? null,
          notes: payload.notes ?? null,
        });
        toast.success('Team updated.');
        await refreshSelected();
        setFormMode(null);
      }
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to save team.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTeam(team: TeamProfile) {
    if (!confirm(`Delete "${team.name}"? This will remove all roster entries.`)) return;
    try {
      await apiClient.teams.delete(team.id);
      toast.success(`"${team.name}" deleted.`);
      setTeams((prev) => prev.filter((t) => t.id !== team.id));
      if (selected?.id === team.id) { setSelected(null); setFormMode(null); }
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to delete team.');
    }
  }

  function handleRosterSearch(q: string) {
    setRosterQuery(q);
    setRosterResults([]);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) return;
    searchTimeout.current = setTimeout(async () => {
      setRosterSearching(true);
      try {
        const data = await apiClient.players.search(q.trim(), 10);
        setRosterResults(data.results ?? []);
      } catch {
        // silent — user sees no results
      } finally {
        setRosterSearching(false);
      }
    }, 300);
  }

  async function handleAddPlayer(player: PlayerSearchResult) {
    if (!selected) return;
    try {
      await apiClient.teams.addPlayer(selected.id, player.id, addingRole);
      toast.success(`${player.displayName} added to roster.`);
      setRosterQuery('');
      setRosterResults([]);
      setAddingRole(undefined);
      await refreshSelected();
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to add player.');
    }
  }

  async function handleChangeRole(rosterId: string, role: TeamRole | null) {
    if (!selected) return;
    try {
      await apiClient.teams.updateRoster(selected.id, rosterId, role);
      await refreshSelected();
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to update role.');
    }
  }

  async function handleRemovePlayer(rosterId: string, displayName: string) {
    if (!selected) return;
    try {
      await apiClient.teams.removePlayer(selected.id, rosterId);
      toast.success(`${displayName} removed from roster.`);
      await refreshSelected();
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to remove player.');
    }
  }

  function startEditName(rosterId: string, currentName: string) {
    setEditingNameId(rosterId);
    setEditingNameValue(currentName);
  }

  async function handleSaveCustomName(playerId: string) {
    try {
      await apiClient.players.setCustomName(playerId, editingNameValue.trim() || null);
      setEditingNameId(null);
      await refreshSelected();
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to save name.');
    }
  }

  const showDetail = selected && formMode !== 'create';

  return (
    <div>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="header-title">Team Analysis</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Manage rosters and review team stats.</p>
          </div>
          <button className="btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 'unset' }}>
            <Plus size={16} /> New Team
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: showDetail ? '280px 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {formMode === 'create' && (
            <TeamForm
              form={form}
              onChange={setForm}
              onSave={() => void handleSaveTeam()}
              onCancel={() => setFormMode(null)}
              saving={saving}
              title="New Team"
            />
          )}

          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading teams…</p>}

          {!loading && teams.length === 0 && formMode !== 'create' && (
            <div className="glass-card" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>No teams yet.</p>
              <button className="btn-primary" onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flex: 'unset' }}>
                <Plus size={14} /> Create your first team
              </button>
            </div>
          )}

          {(['OWN', 'RIVAL'] as const).map((type) => {
            const group = teams.filter((t) => t.type === type);
            if (!group.length) return null;
            return (
              <div key={type}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                  {type === 'OWN' ? 'Our Teams' : 'Rival Teams'}
                </p>
                {group.map((team) => (
                  <div
                    key={team.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      marginBottom: '0.5rem',
                      background: selected?.id === team.id ? 'rgba(157,78,221,0.12)' : 'var(--bg-card)',
                      border: selected?.id === team.id ? '1px solid var(--border-highlight)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => void handleSelectTeam(team.id)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}
                    >
                      <TeamLogo team={team} size={28} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{team.name}</div>
                        {team.abbreviation && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{team.abbreviation}</div>}
                      </div>
                    </button>
                    <div style={{ display: 'flex', gap: '0.25rem', paddingRight: '0.5rem' }}>
                      <IconBtn icon={<Pencil size={13} />} onClick={() => { void handleSelectTeam(team.id).then(() => openEdit(team)); }} title="Edit" />
                      <IconBtn icon={<Trash2 size={13} />} onClick={() => void handleDeleteTeam(team)} title="Delete" danger />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {showDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {formMode === 'edit' ? (
              <TeamForm
                form={form}
                onChange={setForm}
                onSave={() => void handleSaveTeam()}
                onCancel={() => setFormMode(null)}
                saving={saving}
                title={`Edit ${selected.name}`}
                hideType
              />
            ) : (
              <div className="glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <TeamLogo team={selected} size={54} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.25rem' }}>{selected.name}</h2>
                    {selected.region && <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{selected.region}</p>}
                    {selected.notes && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{selected.notes}</p>}
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '999px',
                    background: selected.type === 'OWN' ? 'rgba(56,212,200,0.1)' : 'rgba(248,113,113,0.1)',
                    color: selected.type === 'OWN' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)',
                  }}>
                    {selected.type}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-secondary" onClick={() => openEdit(selected)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', flex: 'unset' }}>
                      <Pencil size={13} /> Edit
                    </button>
                    <button className="btn-secondary" onClick={() => void handleDeleteTeam(selected)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)', flex: 'unset' }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <StatBox label="Total Matches" value={selected.aggregateStats.totalMatches} />
                  <StatBox label="Avg KDA" value={selected.aggregateStats.averageKDA.toFixed(2)} />
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', marginTop: '1.5rem' }}>
                  {(['roster', 'performance'] as const).map((t) => (
                    <button key={t} onClick={() => handleTabChange(t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: detailTab === t ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: detailTab === t ? '2px solid var(--accent-blue)' : '2px solid transparent', transition: 'color 0.15s', textTransform: 'capitalize' }}>
                      {t === 'roster' ? 'Roster' : 'Performance'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Tab */}
            {detailTab === 'performance' && selected && (
              <PerformanceTab
                teamId={selected.id}
                analysis={analysis}
                loading={loadingAnalysis}
                onRefresh={() => void loadAnalysis(selected.id)}
              />
            )}

            <div className="glass-card" style={{ display: detailTab === 'roster' ? undefined : 'none' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Active Roster</h3>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Search player to add…"
                    value={rosterQuery}
                    onChange={(e) => handleRosterSearch(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <select
                    className="input"
                    value={addingRole ?? ''}
                    onChange={(e) => setAddingRole((e.target.value as TeamRole) || undefined)}
                    style={{ width: '130px' }}
                  >
                    <option value="">No role</option>
                    {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </select>
                </div>

                {rosterSearching && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Searching…</p>}

                {rosterResults.length > 0 && (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginTop: '0.25rem' }}>
                    {rosterResults.map((p) => {
                      const alreadyIn = selected.roster.some((m) => m.playerId === p.id);
                      return (
                        <div
                          key={p.id}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-dark)', borderBottom: '1px solid var(--border-color)' }}
                        >
                          <span style={{ fontSize: '0.875rem', color: alreadyIn ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                            {p.customName ?? p.displayName}
                            {alreadyIn && <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: 'var(--text-muted)' }}>(already in roster)</span>}
                          </span>
                          {!alreadyIn && (
                            <button
                              className="btn-primary"
                              onClick={() => void handleAddPlayer(p)}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 'unset' }}
                            >
                              <UserPlus size={12} /> Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selected.roster.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No active players. Search above to add.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selected.roster.map((member) => {
                    const displayedName = member.customName ?? member.displayName;
                    const isEditing = editingNameId === member.rosterId;
                    return (
                      <div
                        key={member.rosterId}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)' }}
                      >
                        <RoleIcon role={member.role} />
                        {isEditing ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input
                              autoFocus
                              className="input"
                              value={editingNameValue}
                              onChange={(e) => setEditingNameValue(e.target.value)}
                              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter') void handleSaveCustomName(member.playerId);
                                if (e.key === 'Escape') setEditingNameId(null);
                              }}
                              placeholder={member.displayName}
                              style={{ fontSize: '0.875rem', padding: '0.2rem 0.5rem', flex: 1 }}
                            />
                            <button onClick={() => void handleSaveCustomName(member.playerId)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-win)', display: 'flex' }}>
                              <Check size={15} />
                            </button>
                            <button onClick={() => setEditingNameId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {displayedName}
                            </span>
                            {member.customName && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)' }}>custom</span>
                            )}
                            <button
                              onClick={() => startEditName(member.rosterId, member.customName ?? '')}
                              title="Set custom name"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '0.1rem', flexShrink: 0 }}
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}
                        <RankIcon rankLabel={member.rating?.rankLabel ?? null} ratingPoints={member.rating?.ratingPoints !== undefined && member.rating?.ratingPoints !== null ? Math.round(member.rating.ratingPoints) : null} size={42} />
                        <select
                          className="input"
                          value={member.role ?? ''}
                          onChange={(e) => void handleChangeRole(member.rosterId, (e.target.value as TeamRole) || null)}
                          style={{ width: '110px', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                        >
                          <option value="">No role</option>
                          {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                        </select>
                        <button
                          onClick={() => void handleRemovePlayer(member.rosterId, displayedName)}
                          title="Remove from roster"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                        >
                          <UserMinus size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────

const OBJ_COLORS: Record<string, string> = {
  FANGTOOTH: '#ef4444', PRIMAL_FANGTOOTH: '#b91c1c',
  ORB_PRIME: '#7c3aed', MINI_PRIME: '#a78bfa',
  SHAPER: '#c084fc',
  RED_BUFF: '#f97316', BLUE_BUFF: '#3b82f6',
  CYAN_BUFF: '#06b6d4', GOLD_BUFF: '#f0b429',
  RIVER: '#38d4c8', SEEDLING: '#22c55e',
};

const OBJ_LABELS: Record<string, string> = {
  FANGTOOTH: 'Fangtooth', PRIMAL_FANGTOOTH: 'Primal Fangtooth',
  ORB_PRIME: 'Orb Prime', MINI_PRIME: 'Mini Prime', SHAPER: 'Shaper',
  RED_BUFF: 'Red Buff', BLUE_BUFF: 'Blue Buff',
  CYAN_BUFF: 'Cyan Buff', GOLD_BUFF: 'Gold Buff',
  RIVER: 'River', SEEDLING: 'Seedling',
};

function PerformanceTab({ analysis, loading, onRefresh }: {
  teamId: string; analysis: TeamAnalysis | null; loading: boolean; onRefresh: () => void;
}) {
  const [sortKey, setSortKey] = useState<'winRate' | 'kda' | 'avgGPM' | 'avgDPM' | 'avgCS' | 'matches'>('winRate');

  if (loading) return <div className="glass-card" style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading analysis…</div>;

  if (!analysis || analysis.playerStats.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>No performance data yet</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Sync the roster players to load their stats.</div>
        <button onClick={onRefresh} style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0.4rem 0.9rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)' }}>Retry</button>
      </div>
    );
  }

  const sorted = [...analysis.playerStats].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  const teamWR = analysis.teamMatches.length > 0 ? Math.round((analysis.teamWins / analysis.teamMatches.length) * 100) : null;

  const SORT_COLS: Array<{ key: typeof sortKey; label: string }> = [
    { key: 'matches', label: 'Matches' },
    { key: 'winRate', label: 'WR %' },
    { key: 'kda', label: 'KDA' },
    { key: 'avgGPM', label: 'GPM' },
    { key: 'avgDPM', label: 'DPM' },
    { key: 'avgCS', label: 'CS' },
  ];

  // Major objectives only for control display
  const majorObjs = analysis.objectiveControl.filter((o) =>
    ['FANGTOOTH', 'PRIMAL_FANGTOOTH', 'ORB_PRIME', 'MINI_PRIME', 'SHAPER'].includes(o.entityType)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Team form summary */}
      {analysis.teamMatches.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>Team Matches</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700 }}>{analysis.teamMatches.length}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>3+ players together</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>Team Win Rate</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: teamWR !== null && teamWR >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{teamWR ?? '—'}%</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{analysis.teamWins}W · {analysis.teamLosses}L</div>
            </div>
            {/* Recent form dots */}
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem' }}>Recent Form</div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {analysis.teamMatches.slice(0, 10).map((m, i) => (
                  <div key={i} title={m.gameMode + ' · ' + (m.won === true ? 'Win' : m.won === false ? 'Loss' : '?')} style={{ width: 10, height: 10, borderRadius: '50%', background: m.won === true ? 'var(--accent-win)' : m.won === false ? 'var(--accent-loss)' : 'var(--border-color)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player comparison table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginRight: '0.5rem' }}>Player Comparison</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sort by:</span>
          {SORT_COLS.map(({ key, label }) => (
            <button key={key} onClick={() => setSortKey(key)} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', cursor: 'pointer', border: `1px solid ${sortKey === key ? 'var(--accent-blue)' : 'var(--border-color)'}`, background: sortKey === key ? 'rgba(91,156,246,0.12)' : 'transparent', color: sortKey === key ? 'var(--accent-blue)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '180px 60px 80px 70px 70px 70px 70px 70px', padding: '0.35rem 1rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
          <span>Player</span>
          {SORT_COLS.map(({ key, label }) => (
            <span key={key} style={{ textAlign: 'center', color: sortKey === key ? 'var(--accent-blue)' : undefined }}>{label}</span>
          ))}
        </div>

        {sorted.map((p) => {
          const recentTotal = p.recentWins + p.recentLosses;
          const recentWR = recentTotal > 0 ? Math.round((p.recentWins / recentTotal) * 100) : null;
          const roleSlug = p.role?.toLowerCase().replace('mid_lane', 'midlane') ?? null;
          return (
            <div key={p.playerId} style={{ display: 'grid', gridTemplateColumns: '180px 60px 80px 70px 70px 70px 70px 70px', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
              {/* Player */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                {roleSlug && <img src={`/icons/roles/${roleSlug}.png`} alt={p.role ?? ''} style={{ width: 18, height: 18, objectFit: 'contain', opacity: 0.85, flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customName ?? p.displayName}</div>
                  {p.rankLabel && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.rankLabel}</div>}
                </div>
              </div>
              {/* Stats */}
              <PerfCell value={p.matches} />
              <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                <span style={{ color: p.winRate >= 55 ? 'var(--accent-win)' : p.winRate < 45 ? 'var(--accent-loss)' : 'var(--text-primary)', fontWeight: 700 }}>{p.winRate.toFixed(1)}%</span>
                {recentWR !== null && recentTotal >= 5 && (
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>last {recentTotal}: {recentWR}%</div>
                )}
              </div>
              <PerfCell value={p.kda > 0 ? p.kda.toFixed(2) : '—'} highlight={p.kda >= 3} />
              <PerfCell value={p.avgGPM ?? '—'} />
              <PerfCell value={p.avgDPM ?? '—'} />
              <PerfCell value={p.avgCS ?? '—'} />
              <PerfCell value={p.avgWardsPlaced !== null ? p.avgWardsPlaced.toFixed(1) : '—'} />
            </div>
          );
        })}
      </div>

      {/* Objective Control */}
      {majorObjs.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Objective Control
            <span style={{ fontWeight: 400, fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>from {analysis.teamMatches.filter((m) => m.won !== null).length} team matches with event stream</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {majorObjs.map((o) => {
              const color = OBJ_COLORS[o.entityType] ?? '#64748b';
              const label = OBJ_LABELS[o.entityType] ?? o.entityType;
              return (
                <div key={o.entityType} style={{ flex: '1 1 140px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex', marginBottom: '0.4rem' }}>
                    <div style={{ width: `${o.controlPct}%`, background: color, borderRadius: '999px 0 0 999px' }} />
                    <div style={{ width: `${100 - o.controlPct}%`, background: 'rgba(248,113,113,0.4)', borderRadius: '0 999px 999px 0' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color, fontWeight: 700 }}>{o.teamCaptures} ({o.controlPct}%)</span>
                    <span style={{ color: 'var(--accent-loss)' }}>{o.rivalCaptures}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top hero pool per player */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>Hero Pool</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sorted.map((p) => (
            <div key={p.playerId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 120, fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', flexShrink: 0 }}>
                {p.customName ?? p.displayName}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {p.topHeroes.map((h) => (
                  <div key={h.slug} title={`${h.name} · ${h.matches} games · ${h.winRate.toFixed(1)}% WR`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-dark)' }}>
                      <img src={`/heroes/${h.slug}.webp`} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: h.winRate >= 55 ? 'var(--accent-win)' : h.winRate < 45 ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
                      {h.winRate.toFixed(0)}%
                    </div>
                  </div>
                ))}
                {p.topHeroes.length === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No hero data</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PerfCell({ value, highlight }: { value: string | number | null; highlight?: boolean }) {
  return (
    <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: highlight ? 'var(--accent-win)' : value === '—' || value === null ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: highlight ? 700 : 400 }}>
      {value ?? '—'}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: 'var(--bg-dark)', padding: '0.9rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.45rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  );
}

function IconBtn({ icon, onClick, title, danger }: { icon: ReactNode; onClick: () => void; title?: string; danger?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.35rem',
        color: danger ? 'var(--accent-danger)' : 'var(--text-muted)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center',
      }}
    >
      {icon}
    </button>
  );
}

function RoleIcon({ role }: { role: string | null }) {
  const iconSize = 15;
  const tone = getRoleTone(role);
  const icon = (() => {
    if (role === 'carry') return <Target size={iconSize} />;
    if (role === 'jungle') return <Activity size={iconSize} />;
    if (role === 'midlane') return <Trophy size={iconSize} />;
    if (role === 'offlane') return <Swords size={iconSize} />;
    if (role === 'support') return <Shield size={iconSize} />;
    return <Users size={iconSize} />;
  })();

  return (
    <span
      title={role ? roleLabel[role as TeamRole] : 'No role'}
      style={{
        width: 24,
        height: 24,
        borderRadius: 'var(--radius-sm)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.color,
      }}
    >
      {icon}
    </span>
  );
}

function getRoleTone(role: string | null): { color: string; background: string; border: string } {
  if (role === 'carry')   return { color: '#f0b429', background: 'rgba(240,180,41,0.12)',  border: 'rgba(240,180,41,0.26)'  };
  if (role === 'jungle')  return { color: '#7fd66b', background: 'rgba(127,214,107,0.11)', border: 'rgba(127,214,107,0.24)' };
  if (role === 'midlane') return { color: '#a78bfa', background: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.26)' };
  if (role === 'offlane') return { color: '#f87171', background: 'rgba(248,113,113,0.11)', border: 'rgba(248,113,113,0.24)' };
  if (role === 'support') return { color: '#38d4c8', background: 'rgba(56,212,200,0.11)',  border: 'rgba(56,212,200,0.26)'  };
  return { color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.06)' };
}

function RankEmblem({ rating }: { rating: { rankLabel: string | null; ratingPoints: number | null } | null }) {
  if (!rating?.rankLabel) return null;

  const iconUrl = getRankIconUrl(rating.rankLabel);
  const points = typeof rating.ratingPoints === 'number' ? Math.round(rating.ratingPoints) : null;

  return (
    <div
      title={points !== null ? `${points} VP - ${rating.rankLabel}` : rating.rankLabel}
      style={{
        width: 54,
        height: 42,
        position: 'relative',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={rating.rankLabel}
          style={{
            position: 'absolute',
            width: 42,
            height: 42,
            objectFit: 'contain',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          transform: 'translateY(1px)',
        }}
      >
        {points !== null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-primary)' }}>{points}</span>
        )}
      </div>
    </div>
  );
}

function TeamLogo({ team, size }: { team: Pick<TeamProfile, 'name' | 'abbreviation' | 'logoUrl' | 'type'>; size: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getTeamInitials(team);
  const accent = team.type === 'OWN' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)';
  const showLogo = Boolean(team.logoUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [team.logoUrl]);

  return (
    <span
      title={team.name}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: `linear-gradient(135deg, rgba(255,255,255,0.06), ${team.type === 'OWN' ? 'rgba(56,212,200,0.12)' : 'rgba(248,113,113,0.12)'})`,
        border: `1px solid ${accent}`,
        color: 'var(--text-primary)',
        fontSize: size >= 48 ? '1rem' : '0.72rem',
        fontWeight: 800,
      }}
    >
      {showLogo ? (
        <img
          src={team.logoUrl ?? undefined}
          alt={`${team.name} logo`}
          onError={() => setImageFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size >= 48 ? 6 : 3 }}
        />
      ) : (
        initials
      )}
    </span>
  );
}

function getTeamInitials(team: Pick<TeamProfile, 'name' | 'abbreviation'>): string {
  const source = team.abbreviation?.trim() || team.name;
  const words = source.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function getRankIconUrl(rankLabel: string | null): string | null {
  if (!rankLabel) return null;
  const tier = rankLabel.split(/\s+/)[0]?.toLowerCase();
  const iconId = tier ? RANK_ICON_IDS[tier] : undefined;
  return iconId ? `https://pred.gg/assets/${iconId}.webp` : null;
}

function TeamForm({
  form, onChange, onSave, onCancel, saving, title, hideType,
}: {
  form: { name: string; abbreviation: string; logoUrl: string; type: 'OWN' | 'RIVAL'; region: string; notes: string };
  onChange: (f: typeof form) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
  hideType?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const f = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [field]: e.target.value });

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only image files are supported.'); return; }
    if (file.size > 200 * 1024) { toast.error('Image must be under 200 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => onChange({ ...form, logoUrl: reader.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
        <button onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Team name *</label>
          <input className="input" value={form.name} onChange={f('name')} placeholder="e.g. Team Liquid" style={{ width: '100%' }} />
        </div>
        <div>
          <label style={labelStyle}>Abbreviation</label>
          <input className="input" value={form.abbreviation} onChange={f('abbreviation')} placeholder="e.g. TL" maxLength={10} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={labelStyle}>Region</label>
          <input className="input" value={form.region} onChange={f('region')} placeholder="e.g. EU, NA, LATAM" style={{ width: '100%' }} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Logo</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input className="input" value={form.logoUrl.startsWith('data:') ? '' : form.logoUrl} onChange={f('logoUrl')} placeholder="https://... or upload below" style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              style={{ flex: 'unset', whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
            >
              Upload image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
          {form.logoUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
              <img src={form.logoUrl} alt="Logo preview" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{form.logoUrl.startsWith('data:') ? 'Uploaded image' : form.logoUrl}</span>
              <button type="button" onClick={() => onChange({ ...form, logoUrl: '' })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                <X size={13} />
              </button>
            </div>
          )}
        </div>
        {!hideType && (
          <div>
            <label style={labelStyle}>Type</label>
            <select className="input" value={form.type} onChange={f('type')} style={{ width: '100%' }}>
              <option value="OWN">Our Team</option>
              <option value="RIVAL">Rival</option>
            </select>
          </div>
        )}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Notes</label>
          <textarea className="input" value={form.notes} onChange={f('notes')} placeholder="Optional notes…" rows={2} style={{ width: '100%', resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={onCancel} disabled={saving} style={{ flex: 'unset' }}>Cancel</button>
        <button className="btn-primary" onClick={onSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 'unset' }}>
          <Check size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem',
};
