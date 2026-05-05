import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
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
import { apiClient, type TeamProfile, type TeamRole, type PlayerSearchResult, ApiErrorResponse } from '../api/client';

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

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<TeamFormData>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [rosterQuery, setRosterQuery] = useState('');
  const [rosterResults, setRosterResults] = useState<PlayerSearchResult[]>([]);
  const [rosterSearching, setRosterSearching] = useState(false);
  const [addingRole, setAddingRole] = useState<TeamRole | undefined>(undefined);
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

  async function handleSelectTeam(id: string) {
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
              </div>
            )}

            <div className="glass-card">
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
                            {p.displayName}
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
                  {selected.roster.map((member) => (
                    <div
                      key={member.rosterId}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)' }}
                    >
                      <RoleIcon role={member.role} />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{member.displayName}</span>
                      <RankEmblem rating={member.rating} />
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
                        onClick={() => void handleRemovePlayer(member.rosterId, member.displayName)}
                        title="Remove from roster"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                      >
                        <UserMinus size={15} />
                      </button>
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
  const f = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [field]: e.target.value });

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
          <label style={labelStyle}>Logo URL</label>
          <input className="input" value={form.logoUrl} onChange={f('logoUrl')} placeholder="https://..." style={{ width: '100%' }} />
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
