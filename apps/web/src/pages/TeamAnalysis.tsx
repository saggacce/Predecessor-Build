import React, { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { RankIcon } from '../components/RankIcon';
import { useHeroMeta, normalizeHeroSlug } from '../hooks/useHeroMeta';
import { useConfig } from '../hooks/useConfig';
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
  FileText,
  BarChart3,
  Ban,
  GitCompare,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type TeamProfile, type TeamRole, type PlayerSearchResult, type TeamAnalysis, type TeamDraftAnalysis, type TeamObjectiveAnalysis, type TeamPhaseAnalysis, type TeamVisionAnalysis, type RivalHeroStat, type PlayerAnalysisStat, type Insight, ApiErrorResponse } from '../api/client';

const ROLES: TeamRole[] = ['carry', 'jungle', 'midlane', 'offlane', 'support'];

const roleLabel: Record<TeamRole, string> = {
  carry: 'Carry',
  jungle: 'Jungle',
  midlane: 'Mid',
  offlane: 'Offlane',
  support: 'Support',
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


class TeamAnalysisErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-loss)', margin: '1rem 0' }}>
          <div style={{ fontWeight: 700, color: 'var(--accent-loss)', marginBottom: '0.5rem' }}>Error en el análisis</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '1rem' }}>{this.state.error.message}</div>
          <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => this.setState({ error: null })}>Cerrar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function TeamAnalysis() {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [selected, setSelected] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [detailTab, setDetailTab] = useState<'roster' | 'performance' | 'phase' | 'vision' | 'objectives' | 'draft'>('roster');
  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [phaseAnalysis, setPhaseAnalysis] = useState<TeamPhaseAnalysis | null>(null);
  const [loadingPhaseAnalysis, setLoadingPhaseAnalysis] = useState(false);
  const [visionAnalysis, setVisionAnalysis] = useState<TeamVisionAnalysis | null>(null);
  const [loadingVisionAnalysis, setLoadingVisionAnalysis] = useState(false);
  const [objectiveAnalysis, setObjectiveAnalysis] = useState<TeamObjectiveAnalysis | null>(null);
  const [loadingObjectiveAnalysis, setLoadingObjectiveAnalysis] = useState(false);
  const [draftAnalysis, setDraftAnalysis] = useState<TeamDraftAnalysis | null>(null);
  const [loadingDraftAnalysis, setLoadingDraftAnalysis] = useState(false);

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

  async function loadDraftAnalysis(teamId: string) {
    setLoadingDraftAnalysis(true);
    setDraftAnalysis(null);
    try {
      const data = await apiClient.teams.getDraftAnalysis(teamId);
      setDraftAnalysis(data);
    } catch {
      // silent — show empty state
    } finally {
      setLoadingDraftAnalysis(false);
    }
  }

  async function loadPhaseAnalysis(teamId: string) {
    setLoadingPhaseAnalysis(true);
    setPhaseAnalysis(null);
    try {
      const data = await apiClient.teams.getPhaseAnalysis(teamId);
      setPhaseAnalysis(data);
    } catch {
      // silent — show empty state
    } finally {
      setLoadingPhaseAnalysis(false);
    }
  }

  async function loadVisionAnalysis(teamId: string) {
    setLoadingVisionAnalysis(true);
    setVisionAnalysis(null);
    try {
      const data = await apiClient.teams.getVisionAnalysis(teamId);
      setVisionAnalysis(data);
    } catch {
      // silent — show empty state
    } finally {
      setLoadingVisionAnalysis(false);
    }
  }

  async function loadObjectiveAnalysis(teamId: string) {
    setLoadingObjectiveAnalysis(true);
    setObjectiveAnalysis(null);
    try {
      const data = await apiClient.teams.getObjectiveAnalysis(teamId);
      setObjectiveAnalysis(data);
    } catch {
      // silent — show empty state
    } finally {
      setLoadingObjectiveAnalysis(false);
    }
  }

  function handleTabChange(tab: 'roster' | 'performance' | 'phase' | 'vision' | 'objectives' | 'draft') {
    setDetailTab(tab);
    if (tab === 'performance' && selected && !analysis) {
      void loadAnalysis(selected.id);
    }
    if (tab === 'phase' && selected && !phaseAnalysis) {
      void loadPhaseAnalysis(selected.id);
    }
    if (tab === 'vision' && selected && !visionAnalysis) {
      void loadVisionAnalysis(selected.id);
    }
    if (tab === 'objectives' && selected && !objectiveAnalysis) {
      void loadObjectiveAnalysis(selected.id);
    }
    if (tab === 'draft' && selected && !draftAnalysis) {
      void loadDraftAnalysis(selected.id);
    }
  }

  async function handleSelectTeam(id: string) {
    setDetailTab('roster');
    setAnalysis(null);
    setPhaseAnalysis(null);
    setVisionAnalysis(null);
    setObjectiveAnalysis(null);
    setDraftAnalysis(null);
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
                {group.map((team) => {
                  const accentColor = team.type === 'OWN' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)';
                  return (
                  <div
                    key={team.id}
                    className="team-list-row"
                    style={{
                      display: 'flex', alignItems: 'center',
                      marginBottom: '0.5rem',
                      background: selected?.id === team.id ? 'rgba(157,78,221,0.12)' : 'var(--bg-card)',
                      border: selected?.id === team.id ? '1px solid var(--border-highlight)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: 3, alignSelf: 'stretch', background: accentColor, flexShrink: 0, opacity: selected?.id === team.id ? 1 : 0.55 }} />
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
                    <div style={{ display: 'flex', gap: '0.5rem', paddingRight: '0.5rem' }}>
                      <IconBtn icon={<Pencil size={13} />} onClick={() => { void handleSelectTeam(team.id).then(() => openEdit(team)); }} title="Edit" />
                      <IconBtn icon={<Trash2 size={13} />} onClick={() => void handleDeleteTeam(team)} title="Delete" danger />
                    </div>
                  </div>
                  );
                })}
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
                    {selected.type === 'RIVAL' && (
                      <Link
                        to={`/reports/scrim?rival=${selected.id}`}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem', color: 'var(--accent-teal-bright)', borderColor: 'rgba(56,212,200,0.3)' }}
                      >
                        <FileText size={13} /> Quick Report
                      </Link>
                    )}
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
                <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', marginTop: '1.5rem', overflowX: 'auto' }}>
                  <button onClick={() => handleTabChange('roster')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: detailTab === 'roster' ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: detailTab === 'roster' ? '2px solid var(--accent-blue)' : '2px solid transparent', transition: 'color 0.15s' }}>
                    Roster
                  </button>
                  <PerformanceTabButton
                    active={detailTab === 'performance'}
                    hasTeamMatches={analysis ? analysis.teamMatches.length > 0 : null}
                    rosterSize={selected?.roster.length ?? 0}
                    onClick={() => handleTabChange('performance')}
                  />
                  <AnalysisTabButton active={detailTab === 'phase'} label="Phase" onClick={() => handleTabChange('phase')} />
                  <AnalysisTabButton active={detailTab === 'vision'} label="Vision" onClick={() => handleTabChange('vision')} />
                  <AnalysisTabButton active={detailTab === 'objectives'} label="Objectives" onClick={() => handleTabChange('objectives')} />
                  <button onClick={() => handleTabChange('draft')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: detailTab === 'draft' ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: detailTab === 'draft' ? '2px solid var(--accent-blue)' : '2px solid transparent', transition: 'color 0.15s' }}>
                    Draft
                  </button>
                </div>
              </div>
            )}

            {/* Performance Tab */}
            {detailTab === 'performance' && selected && (
              <TeamAnalysisErrorBoundary>
              <PerformanceTab
                teamId={selected.id}
                analysis={analysis}
                loading={loadingAnalysis}
                onRefresh={() => void loadAnalysis(selected.id)}
              />
              </TeamAnalysisErrorBoundary>
            )}

            {/* Phase Tab */}
            {detailTab === 'phase' && selected && (
              <PhaseAnalysisTab
                analysis={phaseAnalysis}
                loading={loadingPhaseAnalysis}
                onRefresh={() => void loadPhaseAnalysis(selected.id)}
              />
            )}

            {/* Vision Tab */}
            {detailTab === 'vision' && selected && (
              <VisionAnalysisTab
                analysis={visionAnalysis}
                loading={loadingVisionAnalysis}
                onRefresh={() => void loadVisionAnalysis(selected.id)}
              />
            )}

            {/* Objectives Tab */}
            {detailTab === 'objectives' && selected && (
              <ObjectiveAnalysisTab
                analysis={objectiveAnalysis}
                loading={loadingObjectiveAnalysis}
                onRefresh={() => void loadObjectiveAnalysis(selected.id)}
              />
            )}

            {/* Draft Tab */}
            {detailTab === 'draft' && selected && (
              <DraftAnalysisTab
                team={selected}
                analysis={draftAnalysis}
                loading={loadingDraftAnalysis}
                onRefresh={() => void loadDraftAnalysis(selected.id)}
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

function AnalysisTabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: active ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent', transition: 'color 0.15s', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  );
}

// ── Phase / Vision / Objective Analysis Tabs ────────────────────────────────

function PhaseAnalysisTab({ analysis, loading, onRefresh }: {
  analysis: TeamPhaseAnalysis | null; loading: boolean; onRefresh: () => void;
}) {
  if (loading) return <AnalysisLoading text="Loading phase analysis…" />;
  if (!analysis || analysis.sampleSize === 0) return <AnalysisEmpty title="No phase data yet" body="Sync team matches with event streams to calculate phase deltas." onRefresh={onRefresh} />;

  const objectiveDiffs = [
    { label: '10m', value: analysis.avgObjectiveDiff10 },
    { label: '15m', value: analysis.avgObjectiveDiff15 },
    { label: '20m', value: analysis.avgObjectiveDiff20 },
  ];
  const maxAbsDiff = Math.max(...objectiveDiffs.map((d) => Math.abs(d.value ?? 0)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <AnalysisHeader title="Phase Analysis" sampleSize={analysis.sampleSize} onRefresh={onRefresh} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        <AnalysisKpi label="Kill Diff @10" value={formatSigned(analysis.avgKillDiff10)} tone={toneForSigned(analysis.avgKillDiff10)} />
        <AnalysisKpi label="Kill Diff @15" value={formatSigned(analysis.avgKillDiff15)} tone={toneForSigned(analysis.avgKillDiff15)} />
        <AnalysisKpi label="Throw Rate" value={formatPct(analysis.throwRate)} tone={analysis.throwRate !== null && analysis.throwRate >= 25 ? 'var(--accent-loss)' : 'var(--text-secondary)'} />
        <AnalysisKpi label="Comeback Rate" value={formatPct(analysis.comebackRate)} tone={analysis.comebackRate !== null && analysis.comebackRate >= 20 ? 'var(--accent-win)' : 'var(--text-secondary)'} />
      </div>

      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.8rem' }}>Objective Diff Timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {objectiveDiffs.map((diff) => {
            const value = diff.value ?? 0;
            const pct = Math.min((Math.abs(value) / maxAbsDiff) * 100, 100);
            const color = value >= 0 ? 'var(--accent-win)' : 'var(--accent-loss)';
            return (
              <div key={diff.label} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 54px', gap: '0.75rem', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{diff.label}</span>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', marginLeft: value < 0 ? `${100 - pct}%` : 0, background: color, borderRadius: 999 }} />
                </div>
                <span className="mono" style={{ fontSize: '0.72rem', color, textAlign: 'right', fontWeight: 700 }}>{formatSigned(diff.value)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <AnalysisTable title="Per-match Phase Breakdown">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 74px 74px 86px 86px 86px', padding: '0.45rem 0.8rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span>Match</span><span>Result</span><span>KD@10</span><span>KD@15</span><span>OD@15</span><span>OD@20</span>
        </div>
        {analysis.perMatch.slice(0, 20).map((match) => (
          <div key={match.matchId} style={{ display: 'grid', gridTemplateColumns: '1fr 74px 74px 86px 86px 86px', padding: '0.55rem 0.8rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.predggUuid}</span>
            <span className="mono" style={{ fontSize: '0.7rem', color: match.won === true ? 'var(--accent-win)' : match.won === false ? 'var(--accent-loss)' : 'var(--text-muted)', fontWeight: 700 }}>{match.won === true ? 'WIN' : match.won === false ? 'LOSS' : '—'}</span>
            <SignedCell value={match.killDiff10} />
            <SignedCell value={match.killDiff15} />
            <SignedCell value={match.objectiveDiff15} />
            <SignedCell value={match.objectiveDiff20} />
          </div>
        ))}
      </AnalysisTable>
    </div>
  );
}

function VisionAnalysisTab({ analysis, loading, onRefresh }: {
  analysis: TeamVisionAnalysis | null; loading: boolean; onRefresh: () => void;
}) {
  if (loading) return <AnalysisLoading text="Loading vision analysis…" />;
  if (!analysis || analysis.sampleSize === 0) return <AnalysisEmpty title="No vision data yet" body="Sync event streams to calculate ward and objective context." onRefresh={onRefresh} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <AnalysisHeader title="Vision Analysis" sampleSize={analysis.sampleSize} onRefresh={onRefresh} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
        <AnalysisKpi label="Vision Control Score" value={formatNullableNumber(analysis.visionControlScore, 1)} tone={analysis.visionControlScore !== null && analysis.visionControlScore >= 60 ? 'var(--accent-win)' : 'var(--text-secondary)'} />
        <AnalysisKpi label="Obj Lost After Death" value={formatPct(analysis.objectiveLostAfterAllyDeathRate)} tone={analysis.objectiveLostAfterAllyDeathRate !== null && analysis.objectiveLostAfterAllyDeathRate >= 25 ? 'var(--accent-loss)' : 'var(--text-secondary)'} />
        <AnalysisKpi label="Obj Taken After Kill" value={formatPct(analysis.objectiveTakenAfterEnemyDeathRate)} tone={analysis.objectiveTakenAfterEnemyDeathRate !== null && analysis.objectiveTakenAfterEnemyDeathRate >= 25 ? 'var(--accent-win)' : 'var(--text-secondary)'} />
      </div>
      <AnalysisTable title="Vision by Objective">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 78px 78px 86px 92px 92px', padding: '0.45rem 0.8rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span>Objective</span><span>Taken</span><span>Wards</span><span>Lost</span><span>Cleared</span><span>J/S alive</span>
        </div>
        {analysis.byObjective.map((objective) => (
          <div key={objective.entityType} style={{ display: 'grid', gridTemplateColumns: '1.2fr 78px 78px 86px 92px 92px', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{OBJ_LABELS[objective.entityType] ?? objective.entityType}</span>
            <MonoCell value={objective.teamTaken} />
            <MonoCell value={formatNullableNumber(objective.avgWardsNearby, 1)} />
            <MonoCell value={formatNullableNumber(objective.avgWardsLost, 1)} />
            <MonoCell value={formatNullableNumber(objective.avgEnemyWardsCleared, 1)} />
            <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{formatPct(objective.junglerAliveRate)} / {formatPct(objective.supportAliveRate)}</span>
          </div>
        ))}
      </AnalysisTable>
    </div>
  );
}

function ObjectiveAnalysisTab({ analysis, loading, onRefresh }: {
  analysis: TeamObjectiveAnalysis | null; loading: boolean; onRefresh: () => void;
}) {
  if (loading) return <AnalysisLoading text="Loading objective analysis…" />;
  if (!analysis || analysis.sampleSize === 0) return <AnalysisEmpty title="No objective analysis yet" body="Sync team matches with objective events to calculate conversions and timings." onRefresh={onRefresh} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <AnalysisHeader title="Objective Analysis" sampleSize={analysis.sampleSize} onRefresh={onRefresh} />
      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.85rem' }}>Conversion Funnel</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {analysis.conversions.map((conversion) => (
            <div key={conversion.entityType}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{OBJ_LABELS[conversion.entityType] ?? conversion.entityType}</span>
                <span className="mono" style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{conversion.taken} taken</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
                <ConversionSegment label="Structure" value={conversion.toAnyStructureRate} color="var(--accent-blue)" />
                <ConversionSegment label="Inhibitor" value={conversion.toInhibitorRate} color="var(--accent-prime)" />
                <ConversionSegment label="Core" value={conversion.toCoreRate} color="var(--accent-win)" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <AnalysisTable title="Timing Consistency">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 80px 110px 100px 100px', padding: '0.45rem 0.8rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span>Objective</span><span>Taken</span><span>Avg Time</span><span>Std Dev</span><span>Priority</span>
        </div>
        {analysis.timingStats.map((timing) => {
          const inconsistent = timing.stdDevSecs !== null && timing.stdDevSecs > 120;
          return (
            <div key={timing.entityType} style={{ display: 'grid', gridTemplateColumns: '1.2fr 80px 110px 100px 100px', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{OBJ_LABELS[timing.entityType] ?? timing.entityType}</span>
              <MonoCell value={timing.teamTaken} />
              <MonoCell value={formatDuration(timing.avgGameTimeSecs)} />
              <span className="mono" style={{ fontSize: '0.7rem', color: inconsistent ? '#f97316' : 'var(--text-muted)' }}>{formatDuration(timing.stdDevSecs)}{inconsistent ? ' · inconsistent' : ''}</span>
              <MonoCell value={formatPct(timing.priorityShare)} />
            </div>
          );
        })}
      </AnalysisTable>
    </div>
  );
}

// ── Draft Analysis Tab ───────────────────────────────────────────────────────

type DraftSubTab = 'picks' | 'bans' | 'pool' | 'overlap';

const DRAFT_TABS: Array<{ key: DraftSubTab; label: string; icon: ReactNode }> = [
  { key: 'picks', label: 'Pick Rates', icon: <BarChart3 size={14} /> },
  { key: 'bans', label: 'Ban Rates', icon: <Ban size={14} /> },
  { key: 'pool', label: 'Hero Pool', icon: <Layers size={14} /> },
  { key: 'overlap', label: 'Hero Overlap', icon: <GitCompare size={14} /> },
];

function DraftAnalysisTab({ team, analysis, loading, onRefresh }: {
  team: TeamProfile; analysis: TeamDraftAnalysis | null; loading: boolean; onRefresh: () => void;
}) {
  const [subTab, setSubTab] = useState<DraftSubTab>('picks');
  const playerById = new Map(team.roster.map((member) => [member.playerId, member]));

  if (loading) return <div className="glass-card" style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading draft analysis…</div>;

  if (!analysis || analysis.sampleSize === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>No draft data yet</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Sync roster player matches so the system can detect team drafts.</div>
        <button onClick={onRefresh} style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0.4rem 0.9rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Draft Analysis</div>
          <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{analysis.sampleSize} team matches</span>
          <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{analysis.rankedSampleSize} ranked matches</span>
          <button onClick={onRefresh} style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: '5px', cursor: 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.08)', color: 'var(--accent-blue)' }}>Refresh</button>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
          {DRAFT_TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', background: subTab === key ? 'rgba(91,156,246,0.12)' : 'transparent', border: `1px solid ${subTab === key ? 'rgba(91,156,246,0.35)' : 'transparent'}`, cursor: 'pointer', padding: '0.4rem 0.65rem', borderRadius: 6, fontSize: '0.76rem', fontWeight: 700, color: subTab === key ? 'var(--accent-blue)' : 'var(--text-muted)' }}
            >
              {icon} {label}
            </button>
          ))}
        </div>
        <div style={{ padding: '1rem' }}>
          {subTab === 'picks' && <DraftPickRates stats={analysis.pickRates} playerById={playerById} sampleSize={analysis.sampleSize} />}
          {subTab === 'bans' && <DraftBanRates ownBans={analysis.ownBanRates} receivedBans={analysis.receivedBanRates} rankedSampleSize={analysis.rankedSampleSize} />}
          {subTab === 'pool' && <DraftHeroPool playerDepth={analysis.playerDepth} playerById={playerById} />}
          {subTab === 'overlap' && <DraftHeroOverlap overlaps={analysis.heroOverlap} playerById={playerById} />}
        </div>
      </div>
    </div>
  );
}

function DraftPickRates({ stats, playerById, sampleSize }: {
  stats: TeamDraftAnalysis['pickRates']; playerById: Map<string, TeamProfile['roster'][number]>; sampleSize: number;
}) {
  if (stats.length === 0) return <DraftEmptyState text="No picked heroes found in the current sample." />;
  const top = stats.slice(0, 14);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem' }}>
      {top.map((hero) => (
        <HeroDraftCard key={hero.heroSlug} heroSlug={hero.heroSlug}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem', marginTop: '0.65rem' }}>
            <MiniMetric label="Picks" value={`${hero.pickCount}/${sampleSize}`} />
            <MiniMetric label="Pick Rate" value={`${hero.pickRate}%`} tone={hero.pickRate >= 35 ? 'var(--accent-blue)' : undefined} />
            <MiniMetric label="WR" value={`${hero.winRate}%`} tone={hero.winRate >= 55 ? 'var(--accent-win)' : hero.winRate < 45 ? 'var(--accent-loss)' : undefined} />
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
            {hero.playedBy.map((playerId) => <PlayerPill key={playerId} playerId={playerId} playerById={playerById} />)}
          </div>
        </HeroDraftCard>
      ))}
    </div>
  );
}

function DraftBanRates({ ownBans, receivedBans, rankedSampleSize }: {
  ownBans: TeamDraftAnalysis['ownBanRates']; receivedBans: TeamDraftAnalysis['receivedBanRates']; rankedSampleSize: number;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
      <BanColumn title="Own bans" subtitle={`${rankedSampleSize} ranked matches`} stats={ownBans} />
      <BanColumn title="Bans received" subtitle="Solo partidas RANKED" stats={receivedBans} highlight />
    </div>
  );
}

function DraftHeroPool({ playerDepth, playerById }: {
  playerDepth: TeamDraftAnalysis['playerDepth']; playerById: Map<string, TeamProfile['roster'][number]>;
}) {
  const heroMeta = useHeroMeta();
  const config = useConfig();
  const pocketPickWr = config.get('display_pocket_pick_wr') ?? 65;
  const pocketPickMaxGames = config.get('display_pocket_pick_max_games') ?? 10;
  const narrowDepth = config.get('display_hero_pool_narrow_depth') ?? 2;
  if (playerDepth.length === 0) return <DraftEmptyState text="No hero pool data found for this roster." />;
  const sorted = [...playerDepth].sort((a, b) => b.heroCount - a.heroCount);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {sorted.map((player) => {
        const member = playerById.get(player.playerId);
        return (
          <div key={player.playerId} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
              <RoleIcon role={member?.role ?? null} />
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{member ? member.customName ?? member.displayName : player.playerId}</span>
              <span className="mono" style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{player.heroCount} qualified heroes</span>
              {player.heroCount <= 2 && <span className="mono" style={{ fontSize: '0.6rem', color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 999, padding: '0.1rem 0.45rem' }}>narrow pool</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '0.5rem' }}>
              {player.topHeroes.map((hero) => {
                const isPocketPick = hero.games <= pocketPickMaxGames && hero.winRate >= pocketPickWr;
                return (
                <div key={hero.heroSlug} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, border: `1px solid ${isPocketPick ? 'rgba(240,180,41,0.45)' : 'var(--border-color)'}`, borderRadius: 6, padding: '0.4rem', background: isPocketPick ? 'rgba(240,180,41,0.06)' : 'var(--bg-dark)' }}>
                  <HeroIcon heroSlug={hero.heroSlug} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatHeroName(hero.heroSlug)}</span>
                      {isPocketPick && <span className="mono" style={{ fontSize: '0.54rem', color: '#f0b429', flexShrink: 0 }}>pocket</span>}
                    </div>
                    <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{hero.games}g · {hero.winRate}% WR · {hero.comfortScore} comfort</div>
                  </div>
                </div>
                );
              })}
              {player.topHeroes.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No comfort picks yet.</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DraftHeroOverlap({ overlaps, playerById }: {
  overlaps: TeamDraftAnalysis['heroOverlap']; playerById: Map<string, TeamProfile['roster'][number]>;
}) {
  if (overlaps.length === 0) return <DraftEmptyState text="No shared comfort picks detected across roster players." />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem' }}>
      {overlaps.map((overlap) => {
        const members = overlap.playerIds.map((id) => playerById.get(id)).filter(Boolean);
        const roles = new Set(members.map((member) => member?.role).filter(Boolean));
        const hasKnownRoles = roles.size > 0;
        return (
          <HeroDraftCard key={overlap.heroSlug} heroSlug={overlap.heroSlug}>
            <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {overlap.playerIds.map((playerId) => <PlayerPill key={playerId} playerId={playerId} playerById={playerById} />)}
            </div>
            <div style={{ marginTop: '0.65rem', fontSize: '0.68rem', color: hasKnownRoles && roles.size <= 1 ? '#f97316' : 'var(--text-muted)' }}>
              {!hasKnownRoles ? 'Shared pick with unassigned roster roles.' : roles.size <= 1 ? 'Shared inside the same role group.' : 'Shared across multiple roles.'}
            </div>
          </HeroDraftCard>
        );
      })}
    </div>
  );
}

function BanColumn({ title, subtitle, stats, highlight }: {
  title: string; subtitle: string; stats: TeamDraftAnalysis['ownBanRates']; highlight?: boolean;
}) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ padding: '0.75rem 0.9rem', borderBottom: '1px solid var(--border-color)', background: highlight ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.02)' }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: highlight ? 'var(--accent-loss)' : 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
      {stats.length === 0 ? (
        <div style={{ padding: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>No bans in this sample.</div>
      ) : (
        <div>
          {stats.slice(0, 12).map((ban, index) => (
            <div key={ban.heroSlug} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.8rem', borderBottom: index === Math.min(stats.length, 12) - 1 ? 'none' : '1px solid var(--border-color)' }}>
              <HeroIcon heroSlug={ban.heroSlug} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatHeroName(ban.heroSlug)}</div>
                <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{ban.count} bans</div>
              </div>
              <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: ban.rate >= 30 ? 'var(--accent-loss)' : 'var(--text-secondary)' }}>{ban.rate}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeroDraftCard({ heroSlug, children }: { heroSlug: string; children: ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem', background: 'rgba(255,255,255,0.02)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
        <HeroIcon heroSlug={heroSlug} size={38} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatHeroName(heroSlug)}</div>
          <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{heroSlug}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function HeroIcon({ heroSlug, size }: { heroSlug: string; size: number }) {
  const heroMeta = useHeroMeta();
  const [imgErr, setImgErr] = useState(false);
  const meta = heroMeta.get(heroSlug);
  const label = meta?.displayName ?? formatHeroName(heroSlug);
  const localSrc = `/heroes/${normalizeHeroSlug(heroSlug)}.webp`;
  const src = !imgErr ? localSrc : (meta?.imageUrl ?? null);
  return (
    <div style={{ width: size, height: size, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', flexShrink: 0 }}>
      {src
        ? <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(8, size * 0.28), fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label.slice(0, 2).toUpperCase()}</div>
      }
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.12rem' }}>{label}</div>
      <div className="mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: tone ?? 'var(--text-secondary)' }}>{value}</div>
    </div>
  );
}

function PlayerPill({ playerId, playerById }: { playerId: string; playerById: Map<string, TeamProfile['roster'][number]> }) {
  const member = playerById.get(playerId);
  const role = member?.role ?? null;
  const tone = getRoleTone(role);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.64rem', fontWeight: 700, color: tone.color, background: tone.background, border: `1px solid ${tone.border}`, borderRadius: 999, padding: '0.12rem 0.45rem', maxWidth: '100%' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member ? member.customName ?? member.displayName : playerId}</span>
    </span>
  );
}

function DraftEmptyState({ text }: { text: string }) {
  return <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 8, background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{text}</div>;
}

function formatHeroName(heroSlug: string) {
  return heroSlug.split(/[-_]/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

function AnalysisHeader({ title, sampleSize, onRefresh }: { title: string; sampleSize: number; onRefresh: () => void }) {
  return (
    <div className="glass-card" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{title}</div>
      <span className="mono" style={{ fontSize: '0.68rem', color: sampleSize < 5 ? '#f0b429' : 'var(--text-muted)' }}>{sampleSize} match sample{sampleSize < 5 ? ' · low sample' : ''}</span>
      <button onClick={onRefresh} style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: '5px', cursor: 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.08)', color: 'var(--accent-blue)' }}>Refresh</button>
    </div>
  );
}

function AnalysisKpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass-card" style={{ padding: '0.9rem 1rem' }}>
      <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>{label}</div>
      <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: tone ?? 'var(--text-secondary)' }}>{value}</div>
    </div>
  );
}

function AnalysisLoading({ text }: { text: string }) {
  return <div className="glass-card" style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{text}</div>;
}

function AnalysisEmpty({ title, body, onRefresh }: { title: string; body: string; onRefresh: () => void }) {
  return (
    <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>{title}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{body}</div>
      <button onClick={onRefresh} style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0.4rem 0.9rem', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)' }}>Retry</button>
    </div>
  );
}

function AnalysisTable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'auto' }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ minWidth: 620 }}>{children}</div>
    </div>
  );
}

function ConversionSegment({ label, value, color }: { label: string; value: number | null; color: string }) {
  const width = value ?? 0;
  return (
    <div>
      <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '0.25rem' }}>
        <div style={{ width: `${Math.min(Math.max(width, 0), 100)}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{label}</span>
        <span className="mono" style={{ fontSize: '0.62rem', color }}>{formatPct(value)}</span>
      </div>
    </div>
  );
}

function SignedCell({ value }: { value: number | null }) {
  return <span className="mono" style={{ fontSize: '0.7rem', color: toneForSigned(value), fontWeight: 700 }}>{formatSigned(value)}</span>;
}

function MonoCell({ value }: { value: string | number }) {
  return <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{value}</span>;
}

function toneForSigned(value: number | null) {
  if (value === null || value === 0) return 'var(--text-muted)';
  return value > 0 ? 'var(--accent-win)' : 'var(--accent-loss)';
}

function formatSigned(value: number | null) {
  if (value === null) return '—';
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function formatPct(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function formatNullableNumber(value: number | null, digits = 0) {
  return value === null ? '—' : value.toFixed(digits);
}

function formatDuration(value: number | null) {
  if (value === null) return '—';
  const mins = Math.floor(value / 60);
  const secs = Math.round(value % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
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

function PerformanceTab({ teamId, analysis, loading, onRefresh }: {
  teamId: string; analysis: TeamAnalysis | null; loading: boolean; onRefresh: () => void;
}) {
  const [syncingMatches, setSyncingMatches] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; remaining: number } | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoadingInsights(true);
    apiClient.analyst.insights(teamId)
      .then((res) => setInsights(res.insights))
      .catch(() => setInsights([]))
      .finally(() => setLoadingInsights(false));
  }, [teamId]);

  async function handleSyncMatches() {
    setSyncingMatches(true);
    try {
      const res = await apiClient.teams.syncMatches(teamId, 10);
      setSyncResult({ synced: res.synced, remaining: res.remaining });
      toast.success(`${res.synced} matches synced${res.remaining > 0 ? ` · ${res.remaining} remaining` : ''}`);
      onRefresh();
    } catch {
      toast.error('Sync failed — make sure you are logged in.');
    } finally {
      setSyncingMatches(false);
    }
  }
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

  const winMatches = analysis.teamMatches.filter((m) => m.won === true);
  const lossMatches = analysis.teamMatches.filter((m) => m.won === false);

  const duskMatches = analysis.teamMatches.filter((m) => m.teamSide === 'DUSK');
  const dawnMatches = analysis.teamMatches.filter((m) => m.teamSide === 'DAWN');
  const duskWR = duskMatches.length > 0 ? Math.round((duskMatches.filter((m) => m.won).length / duskMatches.length) * 100) : null;
  const dawnWR = dawnMatches.length > 0 ? Math.round((dawnMatches.filter((m) => m.won).length / dawnMatches.length) * 100) : null;
  const avgWinDuration = winMatches.length > 0 ? Math.round(winMatches.reduce((s, m) => s + m.duration, 0) / winMatches.length / 60) : null;
  const avgLossDuration = lossMatches.length > 0 ? Math.round(lossMatches.reduce((s, m) => s + m.duration, 0) / lossMatches.length / 60) : null;

  const ftMatches = analysis.teamMatches.filter((m) => m.firstTowerWon !== null);
  const ftWon = ftMatches.filter((m) => m.firstTowerWon === true).length;
  const firstTowerRate = ftMatches.length > 0 ? Math.round((ftWon / ftMatches.length) * 100) : null;

  const patchStats = (() => {
    const map = new Map<string, { wins: number; losses: number }>();
    for (const m of analysis.teamMatches) {
      const key = m.version ?? 'Unknown';
      const entry = map.get(key) ?? { wins: 0, losses: 0 };
      if (m.won === true) entry.wins++;
      else if (m.won === false) entry.losses++;
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([patch, { wins, losses }]) => ({ patch, wins, losses, total: wins + losses, wr: Math.round((wins / Math.max(wins + losses, 1)) * 100) }))
      .sort((a, b) => b.patch.localeCompare(a.patch));
  })();

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

      {/* Team form summary — always visible */}
      {(() => {
        const hasData = analysis.teamMatches.length > 0;
        const statLabel = (text: string) => (
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: hasData ? 'var(--text-muted)' : 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>{text}</div>
        );
        const statValue = (content: React.ReactNode) => (
          <div style={{ opacity: hasData ? 1 : 0.3 }}>{content}</div>
        );

        return (
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', opacity: hasData ? 1 : 0.75 }}>
            {!hasData && (
              <div style={{ padding: '0.55rem 1.25rem', background: 'rgba(251,191,36,0.06)', borderBottom: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'rgba(251,191,36,0.8)', fontWeight: 600 }}>Team Form requires 3+ roster players appearing together in the same match.</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sync each player's profile so the system can detect shared matches.</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', padding: '1rem 1.25rem' }}>
              <div>
                {statLabel('Team Matches')}
                {statValue(<div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700 }}>{hasData ? analysis.teamMatches.length : '—'}</div>)}
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>3+ players together</div>
              </div>
              <div>
                {statLabel('Team Win Rate')}
                {statValue(
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: hasData && teamWR !== null && teamWR >= 50 ? 'var(--accent-win)' : hasData ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
                    {hasData ? `${teamWR ?? '—'}%` : '—'}
                  </div>
                )}
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{hasData ? `${analysis.teamWins}W · ${analysis.teamLosses}L` : 'no data yet'}</div>
              </div>
              <div>
                {statLabel('Avg Duration')}
                {statValue(
                  <>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-win)' }}>{avgWinDuration !== null ? `${avgWinDuration}m` : '—'} <span style={{ fontWeight: 400, fontSize: '0.68rem', color: 'var(--text-muted)' }}>wins</span></div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-loss)' }}>{avgLossDuration !== null ? `${avgLossDuration}m` : '—'} <span style={{ fontWeight: 400, fontSize: '0.68rem', color: 'var(--text-muted)' }}>losses</span></div>
                  </>
                )}
              </div>
              <div>
                {statLabel('First Tower')}
                {hasData ? (
                  firstTowerRate !== null ? (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: firstTowerRate >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{firstTowerRate}%</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{ftWon}/{ftMatches.length} matches</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--text-muted)' }}>—</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Sync event stream</div>
                    </>
                  )
                ) : statValue(<div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--text-muted)' }}>—</div>)}
              </div>
              <div>
                {statLabel('By Side')}
                {statValue(
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                    <div><span style={{ color: 'var(--accent-teal-bright)', fontWeight: 700 }}>DUSK</span> <span style={{ color: duskWR !== null && duskWR >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{duskWR !== null ? `${duskWR}%` : '—'}</span> <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>({duskMatches.length}g)</span></div>
                    <div><span style={{ color: '#f87171', fontWeight: 700 }}>DAWN</span> <span style={{ color: dawnWR !== null && dawnWR >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{dawnWR !== null ? `${dawnWR}%` : '—'}</span> <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>({dawnMatches.length}g)</span></div>
                  </div>
                )}
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {statLabel('Recent Form')}
                {hasData ? (
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {analysis.teamMatches.slice(0, 10).map((m, i) => (
                      <div key={i} title={m.gameMode + ' · ' + (m.won === true ? 'Win' : m.won === false ? 'Loss' : '?')} style={{ width: 10, height: 10, borderRadius: '50%', background: m.won === true ? 'var(--accent-win)' : m.won === false ? 'var(--accent-loss)' : 'var(--border-color)' }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Winrate by patch (TEAM-002) */}
      {patchStats.length > 1 && (
        <div className="glass-card" style={{ padding: '0.75rem 1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Winrate by Patch</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {patchStats.map(({ patch, wins, losses, wr }) => (
              <div key={patch} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', flex: '0 0 72px' }}>{patch}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${wr}%`, height: '100%', background: wr >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)', borderRadius: 999, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: wr >= 50 ? 'var(--accent-win)' : 'var(--accent-loss)', flex: '0 0 36px', textAlign: 'right' }}>{wr}%</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', flex: '0 0 60px' }}>{wins}W {losses}L</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversion rates (TEAM-016/017) */}
      {(analysis.primeConversionRate !== null || analysis.fangtoolhConversionRate !== null) && (
        <div className="glass-card" style={{ padding: '0.75rem 1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Objective Conversion</div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {analysis.primeConversionRate !== null && (
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Orb Prime → Structure</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: analysis.primeConversionRate >= 60 ? 'var(--accent-win)' : analysis.primeConversionRate >= 40 ? 'var(--accent-prime)' : 'var(--accent-loss)' }}>{analysis.primeConversionRate}%</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>structure within 3 min</div>
              </div>
            )}
            {analysis.fangtoolhConversionRate !== null && (
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Fangtooth → Structure</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: analysis.fangtoolhConversionRate >= 60 ? 'var(--accent-win)' : analysis.fangtoolhConversionRate >= 40 ? 'var(--accent-prime)' : 'var(--accent-loss)' }}>{analysis.fangtoolhConversionRate}%</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>structure within 2 min</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scouting Report — RIVAL only */}
      {analysis.teamType === 'RIVAL' && analysis.rivalHeroPool.length > 0 && (
        <ScoutingReport playerStats={analysis.playerStats} heroPool={analysis.rivalHeroPool} />
      )}

      {/* Player comparison table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'clip' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '180px 60px 80px 70px 70px 70px 70px 70px 72px', padding: '0.35rem 1rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 1 }}>
          <span>Player</span>
          {SORT_COLS.map(({ key, label }) => (
            <span key={key} style={{ textAlign: 'center', color: sortKey === key ? 'var(--accent-blue)' : undefined }}>{label}</span>
          ))}
          <span style={{ textAlign: 'center' }}>E.Deaths</span>
        </div>

        {(() => {
          const maxGPM = Math.max(...sorted.map((p) => p.avgGPM ?? 0), 1);
          const maxDPM = Math.max(...sorted.map((p) => p.avgDPM ?? 0), 1);
          return sorted.map((p) => {
            const recentTotal = p.recentWins + p.recentLosses;
            const recentWR = recentTotal > 0 ? Math.round((p.recentWins / recentTotal) * 100) : null;
            const roleSlug = p.role?.toLowerCase().replace('mid_lane', 'midlane') ?? null;
            return (
              <div key={p.playerId} style={{ display: 'grid', gridTemplateColumns: '180px 60px 80px 70px 70px 70px 70px 70px 72px', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
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
                    <div style={{ fontSize: '0.6rem', color: recentWR > p.winRate ? 'var(--accent-win)' : recentWR < p.winRate ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
                      last {recentTotal}: {recentWR}%
                    </div>
                  )}
                </div>
                <PerfCell value={p.kda > 0 ? p.kda.toFixed(2) : '—'} highlight={p.kda >= 3} />
                <BarCell value={p.avgGPM ?? null} max={maxGPM} color="var(--accent-prime)" />
                <BarCell value={p.avgDPM ?? null} max={maxDPM} color="var(--accent-loss)" />
                <PerfCell value={p.avgCS ?? '—'} />
                <PerfCell value={p.avgWardsPlaced !== null ? p.avgWardsPlaced.toFixed(1) : '—'} />
                <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: p.earlyDeathRate !== null && p.earlyDeathRate >= 1 ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
                  {p.earlyDeathRate !== null ? p.earlyDeathRate.toFixed(2) : '—'}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Objective Control */}
      {(majorObjs.length > 0 || analysis.teamType === 'RIVAL') && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              Objective Control
              {majorObjs.length > 0 && <span style={{ fontWeight: 400, fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>from team matches with event stream</span>}
            </div>
            {analysis.teamType === 'RIVAL' && (
              <button onClick={() => void handleSyncMatches()} disabled={syncingMatches} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: '5px', cursor: syncingMatches ? 'not-allowed' : 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.08)', color: 'var(--accent-blue)', opacity: syncingMatches ? 0.6 : 1 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, border: syncingMatches ? '2px solid var(--accent-blue)' : 'none', borderTopColor: 'transparent', borderRadius: '50%', animation: syncingMatches ? 'spin 0.8s linear infinite' : 'none', background: syncingMatches ? 'transparent' : 'none', marginRight: syncingMatches ? 2 : 0 }} />
                {syncingMatches ? 'Syncing...' : `Sync matches (10)${syncResult?.remaining ? ` · ${syncResult.remaining} left` : ''}`}
              </button>
            )}
          </div>
          {majorObjs.length === 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>No event stream data yet. Click "Sync matches" to load objective stats.</p>
          )}
          {majorObjs.length > 0 && <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: majorObjs.length === 0 ? 0 : '0.5rem' }}>
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
                  {o.avgGameTimeSecs && (
                    <div style={{ marginTop: '0.3rem', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                      avg capture {Math.floor(o.avgGameTimeSecs / 60)}:{String(o.avgGameTimeSecs % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>}
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
                {p.topHeroes.map((h) => {
                  const isPocketPick = h.matches < pocketPickMaxGames && h.winRate > pocketPickWr;
                  return (
                  <div key={h.slug} title={`${h.name} · ${h.matches} games · ${h.winRate.toFixed(1)}% WR${isPocketPick ? ' · Pocket pick' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', border: isPocketPick ? '1px solid var(--accent-prime)' : '1px solid var(--border-color)', background: 'var(--bg-dark)', boxShadow: isPocketPick ? '0 0 6px rgba(240,180,41,0.4)' : 'none' }}>
                      <img src={`/heroes/${normalizeHeroSlug(h.slug)}.webp`} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: isPocketPick ? 'var(--accent-prime)' : h.winRate >= 55 ? 'var(--accent-win)' : h.winRate < 45 ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
                      {h.winRate.toFixed(0)}%
                    </div>
                  </div>
                  );
                })}
                {p.topHeroes.length === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No hero data</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Analyst Panel ─────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Analyst</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Insights automáticos basados en reglas</span>
          {insights && insights.length > 0 && (
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              {insights.filter(i => i.severity !== 'positive' && i.severity !== 'low').length} alertas · {insights.filter(i => i.severity === 'positive').length} fortalezas
            </span>
          )}
        </div>
        {loadingInsights ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Analizando…</div>
        ) : !insights || insights.length === 0 ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No se generaron insights. Sincroniza más partidas del equipo.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {insights.map((ins, i) => (
              <InsightCard
                key={ins.id}
                insight={ins}
                last={i === insights.length - 1}
                expanded={expandedEvidence.has(ins.id)}
                teamId={teamId}
                onToggle={() => setExpandedEvidence((prev) => {
                  const next = new Set(prev);
                  next.has(ins.id) ? next.delete(ins.id) : next.add(ins.id);
                  return next;
                })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--accent-loss)',
  high: '#f97316',
  medium: '#f0b429',
  low: 'var(--text-muted)',
  positive: 'var(--accent-win)',
};
const SEVERITY_BG: Record<string, string> = {
  critical: 'rgba(248,113,113,0.08)',
  high: 'rgba(249,115,22,0.08)',
  medium: 'rgba(240,180,41,0.06)',
  low: 'rgba(255,255,255,0.03)',
  positive: 'rgba(74,222,128,0.08)',
};
const CATEGORY_LABEL: Record<string, string> = {
  macro: 'Macro', vision: 'Visión', draft: 'Draft', performance: 'Rendimiento', economy: 'Economía',
};

function InsightCard({ insight: ins, last, expanded, onToggle, teamId }: {
  insight: Insight; last: boolean; expanded: boolean; onToggle: () => void; teamId: string;
}) {
  const [added, setAdded] = useState(false);

  async function handleAddToReview() {
    try {
      await apiClient.review.create({
        teamId,
        insightId: ins.id,
        eventType: ins.category,
        priority: ins.severity === 'positive' ? 'low' : ins.severity,
        reason: ins.title,
      });
      setAdded(true);
      toast.success('Added to Review Queue.');
    } catch {
      toast.error('Failed to add to review.');
    }
  }
  const color = SEVERITY_COLOR[ins.severity] ?? 'var(--text-muted)';
  const bg = SEVERITY_BG[ins.severity] ?? 'transparent';
  return (
    <div style={{
      display: 'flex', gap: '0.75rem', padding: '0.85rem 1rem',
      borderBottom: last ? 'none' : '1px solid var(--border-color)',
      background: bg, borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ flexShrink: 0, paddingTop: '0.1rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: '0.35rem' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{ins.title}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.1rem 0.45rem', borderRadius: 999, background: `${color}22`, color, border: `1px solid ${color}44` }}>
            {ins.severity}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {CATEGORY_LABEL[ins.category]}
          </span>
          {ins.reviewRequired && (
            <button
              onClick={(e) => { e.stopPropagation(); void handleAddToReview(); }}
              disabled={added || ins.severity === 'positive'}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.1rem 0.45rem', borderRadius: 999, background: added ? 'rgba(74,222,128,0.1)' : 'rgba(91,156,246,0.1)', color: added ? 'var(--accent-win)' : 'var(--accent-blue)', border: `1px solid ${added ? 'rgba(74,222,128,0.3)' : 'rgba(91,156,246,0.3)'}`, cursor: added ? 'default' : 'pointer' }}
            >
              {added ? '✓ Added' : '+ Review'}
            </button>
          )}
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.4rem', lineHeight: 1.5 }}>{ins.body}</p>
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.68rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
        >
          {expanded ? '▲ Ocultar evidencia' : '▼ Ver evidencia'}
        </button>
        {expanded && (
          <div style={{ marginTop: '0.5rem' }}>
            <ul style={{ margin: '0 0 0.5rem 0', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {ins.evidence.map((e, i) => (
                <li key={i} style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{e}</li>
              ))}
            </ul>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '0.45rem 0.65rem', borderLeft: `2px solid ${color}` }}>
              💡 {ins.recommendation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoutingReport({ playerStats, heroPool }: { playerStats: PlayerAnalysisStat[]; heroPool: RivalHeroStat[] }) {
  // Build hero pool per player
  const poolByPlayer = new Map<string, RivalHeroStat[]>();
  for (const h of heroPool) {
    const arr = poolByPlayer.get(h.playerId) ?? [];
    arr.push(h);
    poolByPlayer.set(h.playerId, arr);
  }

  // Threat score: weighted combo of winRate, kda, dpm
  function threatScore(p: PlayerAnalysisStat): number {
    return Math.round((p.winRate * 0.4) + (Math.min(p.kda, 10) * 5) + (p.avgDPM ? Math.min(p.avgDPM / 15, 10) : 0));
  }

  // Ban suggestions: heroes with 3+ games and high WR from actual matches
  const banCandidates = heroPool
    .filter((h) => h.games >= 3 && h.winRate >= 50)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
    .slice(0, 6);

  // Pool depth per player (heroes with 2+ games)
  function poolDepth(pid: string) { return (poolByPlayer.get(pid) ?? []).filter((h) => h.games >= 2).length; }

  const sorted = [...playerStats].sort((a, b) => threatScore(b) - threatScore(a));

  return (
    <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-loss)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>⚔</span> Scouting Report
      </div>

      {/* Threat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {sorted.map((p) => {
          const threat = threatScore(p);
          const heroes = (poolByPlayer.get(p.playerId) ?? []).slice(0, 4);
          const depth = poolDepth(p.playerId);
          const threatColor = threat >= 60 ? '#ef4444' : threat >= 40 ? '#f97316' : '#f0b429';
          const threatLabel = threat >= 60 ? 'High Threat' : threat >= 40 ? 'Medium' : 'Low';
          const roleSlug = p.role?.toLowerCase().replace('mid_lane', 'midlane') ?? null;
          return (
            <div key={p.playerId} style={{ border: `1px solid ${threatColor}33`, borderRadius: '8px', padding: '0.75rem', background: `${threatColor}08` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  {roleSlug && <img src={`/icons/roles/${roleSlug}.png`} alt={p.role ?? ''} style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.8, flexShrink: 0 }} />}
                  <span style={{ fontWeight: 700, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customName ?? p.displayName}</span>
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: threatColor, background: `${threatColor}18`, border: `1px solid ${threatColor}44`, borderRadius: '4px', padding: '0.1rem 0.4rem', flexShrink: 0 }}>{threatLabel}</span>
              </div>
              {/* Stats row */}
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                <span>WR <b style={{ color: p.winRate >= 55 ? 'var(--accent-win)' : p.winRate < 45 ? 'var(--accent-loss)' : 'var(--text-secondary)' }}>{p.winRate.toFixed(0)}%</b></span>
                <span>KDA <b style={{ color: 'var(--text-secondary)' }}>{p.kda.toFixed(2)}</b></span>
                {p.avgDPM && <span>DPM <b style={{ color: 'var(--text-secondary)' }}>{Math.round(p.avgDPM)}</b></span>}
              </div>
              {/* Hero pool */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {heroes.map((h) => (
                  <div key={h.heroSlug} title={`${h.heroSlug} · ${h.games}g · ${h.winRate}% WR`} style={{ width: 28, height: 28, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', flexShrink: 0 }}>
                    <img src={`/heroes/${normalizeHeroSlug(h.heroSlug)}.webp`} alt={h.heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                ))}
                {depth <= narrowDepth && (
                  <span title="Narrow hero pool — high ban vulnerability" style={{ fontSize: '0.6rem', color: '#f97316', marginLeft: '4px' }}>⚠ narrow pool</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ban suggestions */}
      {banCandidates.length > 0 && (
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
            Ban Targets
            <span style={{ fontWeight: 400, marginLeft: '0.4rem' }}>— heroes with ≥3 games and highest win rate</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {banCandidates.map((h, i) => {
              const owner = playerStats.find((p) => (poolByPlayer.get(p.playerId) ?? []).some((ph) => ph.heroSlug === h.heroSlug && ph.playerId === h.playerId));
              return (
                <div key={`${h.playerId}-${h.heroSlug}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.6rem', border: `1px solid ${i === 0 ? '#ef4444' : i <= 2 ? '#f97316' : 'var(--border-color)'}`, borderRadius: '6px', background: i === 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                    <img src={`/heroes/${normalizeHeroSlug(h.heroSlug)}.webp`} alt={h.heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>{h.heroSlug}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{h.winRate}% WR · {h.games}g{owner ? ` · ${owner.customName ?? owner.displayName}` : ''}</div>
                  </div>
                  {i === 0 && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#ef4444', marginLeft: '0.2rem' }}>BAN 1</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
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

function BarCell({ value, max, color = 'var(--accent-blue)' }: { value: number | null; max: number; color?: string }) {
  const pct = value !== null && max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ position: 'relative', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: value !== null ? 'var(--text-secondary)' : 'var(--text-muted)', padding: '0.1rem 0.25rem' }}>
      {pct > 0 && (
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: color, opacity: 0.12, borderRadius: 3 }} />
      )}
      <span style={{ position: 'relative' }}>{value !== null ? Math.round(value) : '—'}</span>
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

// ── Performance Tab Button with hover tooltip ─────────────────────────────────

function PerformanceTabButton({ active, hasTeamMatches, rosterSize, onClick }: {
  active: boolean;
  hasTeamMatches: boolean | null; // null = not yet loaded
  rosterSize: number;
  onClick: () => void;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const needsSync = hasTeamMatches === false;
  const notEnoughPlayers = rosterSize < 3;

  const tooltipLines: string[] = [];
  if (notEnoughPlayers) {
    tooltipLines.push(`Roster needs at least 3 players (currently ${rosterSize}).`);
  } else if (needsSync) {
    tooltipLines.push('No team matches detected yet.');
    tooltipLines.push('Sync each roster player\'s profile so the system');
    tooltipLines.push('finds matches where 3+ played together.');
  } else {
    tooltipLines.push('Player stats, hero pool, objective control,');
    tooltipLines.push('team form and first tower rate.');
    if (hasTeamMatches === null) tooltipLines.push('Loading analysis…');
  }

  const dimmed = !active && (needsSync || notEnoughPlayers);

  function handleMouseMove(e: MouseEvent) {
    setTooltip({ x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <button
        onClick={onClick}
        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '0.55rem 1rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: active
            ? 'var(--accent-blue)'
            : dimmed ? 'rgba(148,163,184,0.35)' : 'var(--text-muted)',
          borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
          transition: 'color 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
        }}
      >
        Performance
        {dimmed && (
          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'rgba(148,163,184,0.45)', fontWeight: 400 }}>
            ·  needs data
          </span>
        )}
      </button>

      {tooltip && createPortal(
        <div style={{
          position: 'fixed',
          left: tooltip.x + 14,
          top: tooltip.y + 14,
          zIndex: 9999,
          background: 'var(--bg-card, #1e2433)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          pointerEvents: 'none',
          maxWidth: 280,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {tooltipLines.map((line, i) => (
            <div key={i} style={{
              fontSize: '0.72rem',
              color: i === 0 && (needsSync || notEnoughPlayers) ? 'var(--accent-loss)' : 'var(--text-secondary)',
              lineHeight: 1.5,
              fontWeight: i === 0 ? 600 : 400,
            }}>
              {line}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
