import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { Search, UserMinus, ArrowUpDown, Users, Plus, ChevronDown, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { apiClient, ApiErrorResponse, type TeamProfile, type PlayerSearchResult, type TeamRole, type RosterMember, type RosterStatus } from '../api/client';
import { useAuth } from '../hooks/useAuth';

const ROLES: TeamRole[] = ['carry', 'jungle', 'midlane', 'offlane', 'support'];

const ROLE_LABEL: Record<string, string> = {
  CARRY: 'Carry', JUNGLE: 'Jungle', MIDLANE: 'Mid', OFFLANE: 'Offlane', SUPPORT: 'Support',
};
const ROLE_COLOR: Record<string, string> = {
  CARRY: 'var(--accent-loss)', JUNGLE: 'var(--accent-win)', MIDLANE: 'var(--accent-blue)',
  OFFLANE: 'var(--accent-prime)', SUPPORT: 'var(--accent-teal-bright)',
};
const ROLE_ICON: Record<string, string> = {
  CARRY: '/icons/roles/carry.png', JUNGLE: '/icons/roles/jungle.png',
  MIDLANE: '/icons/roles/midlane.png', OFFLANE: '/icons/roles/offlane.png',
  SUPPORT: '/icons/roles/support.png',
};

function RoleIcon({ role, size = 16 }: { role: string; size?: number }) {
  const src = ROLE_ICON[role.toUpperCase()];
  if (!src) return null;
  return <img src={src} alt={role} width={size} height={size} style={{ objectFit: 'contain', flexShrink: 0 }} />;
}

// pending swap state: which player is being moved and in which direction
type PendingSwap = { rosterId: string; direction: 'bench' | 'activate' };

export default function TeamRoster() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [teamId, setTeamId] = useState('');
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Add player
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addRole, setAddRole] = useState<TeamRole | undefined>(undefined);
  const [addStatus, setAddStatus] = useState<RosterStatus>('STARTER');
  const [adding, setAdding] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Swap state
  const [pendingSwap, setPendingSwap] = useState<PendingSwap | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string>('');
  const [swapping, setSwapping] = useState(false);

  // Remove state
  const [removing, setRemoving] = useState<string | null>(null);

  // Create team state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', abbreviation: '', logoUrl: '', region: '', notes: '' });
  const [creating, setCreating] = useState(false);
  const createFileRef = useRef<HTMLInputElement>(null);

  const isPlatformAdmin = user?.globalRole === 'PLATFORM_ADMIN';
  const isManager = user?.memberships?.some((m) => m.role === 'MANAGER') ?? false;
  const canEdit = isPlatformAdmin || isManager;

  useEffect(() => {
    apiClient.teams.list('OWN')
      .then((res) => {
        const ownTeams = res.teams ?? [];
        setTeams(ownTeams);
        if (ownTeams.length > 0) setTeamId(ownTeams[0].id);
      })
      .catch(() => toast.error(t('teamRoster.addError')))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateTeam() {
    if (!createForm.name.trim()) { toast.error('Team name is required.'); return; }
    setCreating(true);
    try {
      const created = await apiClient.teams.create({
        name: createForm.name.trim(),
        abbreviation: createForm.abbreviation.trim() || undefined,
        logoUrl: createForm.logoUrl.trim() || undefined,
        region: createForm.region.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
        type: 'OWN',
      });
      toast.success(`Team "${created.name}" created.`);
      const res = await apiClient.teams.list('OWN');
      const ownTeams = res.teams ?? [];
      setTeams(ownTeams);
      setTeamId(created.id);
      setShowCreate(false);
      setCreateForm({ name: '', abbreviation: '', logoUrl: '', region: '', notes: '' });
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to create team.');
    } finally {
      setCreating(false);
    }
  }

  function handleCreateFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only image files are supported.'); return; }
    if (file.size > 200 * 1024) { toast.error('Image must be under 200 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setCreateForm((f) => ({ ...f, logoUrl: reader.result as string }));
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!teamId) return;
    setProfile(null);
    setPendingSwap(null);
    apiClient.teams.getProfile(teamId).then(setProfile).catch(() => null);
  }, [teamId]);

  async function refreshProfile() {
    if (!teamId) return;
    const updated = await apiClient.teams.getProfile(teamId);
    setProfile(updated);
  }

  function openSwap(member: RosterMember) {
    setPendingSwap({ rosterId: member.rosterId, direction: member.rosterStatus === 'STARTER' ? 'bench' : 'activate' });
    setSwapTargetId(''); // 'none' for activate, required for bench
  }

  function cancelSwap() {
    setPendingSwap(null);
    setSwapTargetId('');
  }

  async function confirmSwap() {
    if (!profile || !pendingSwap) return;
    const movingMember = profile.roster.find((m) => m.rosterId === pendingSwap.rosterId);
    if (!movingMember) return;

    // Both directions are optional — swapTargetId empty means solo move

    setSwapping(true);
    try {
      const newStatus: RosterStatus = pendingSwap.direction === 'bench' ? 'BENCH' : 'STARTER';
      const swapStatus: RosterStatus = pendingSwap.direction === 'bench' ? 'STARTER' : 'BENCH';

      if (swapTargetId) {
        const swapMember = profile.roster.find((m) => m.rosterId === swapTargetId);
        // Execute both status changes in parallel
        await Promise.all([
          apiClient.teams.updateRoster(teamId, pendingSwap.rosterId, movingMember.role as TeamRole | null, newStatus),
          apiClient.teams.updateRoster(teamId, swapTargetId, swapMember?.role as TeamRole | null ?? null, swapStatus),
        ]);
        const movingName = movingMember.customName ?? movingMember.displayName;
        const swapName = swapMember ? (swapMember.customName ?? swapMember.displayName) : '';
        toast.success(`${movingName} ↔ ${swapName}`);
      } else {
        // Move without swapping anyone
        await apiClient.teams.updateRoster(teamId, pendingSwap.rosterId, movingMember.role as TeamRole | null, newStatus);
        const label = newStatus === 'STARTER' ? t('teamRoster.activateAction') : t('teamRoster.benchAction');
        toast.success(`${movingMember.customName ?? movingMember.displayName} → ${label}`);
      }

      setPendingSwap(null);
      setSwapTargetId('');
      await refreshProfile();
    } catch {
      toast.error(t('teamRoster.updateError'));
    } finally {
      setSwapping(false);
    }
  }

  async function handleChangeRole(member: RosterMember, role: TeamRole | null) {
    try {
      await apiClient.teams.updateRoster(teamId, member.rosterId, role, member.rosterStatus);
      await refreshProfile();
    } catch {
      toast.error(t('teamRoster.updateError'));
    }
  }

  async function handleRemove(member: RosterMember) {
    setRemoving(member.rosterId);
    try {
      await apiClient.teams.removePlayer(teamId, member.rosterId);
      toast.success(t('teamRoster.removeSuccess'));
      if (pendingSwap?.rosterId === member.rosterId) cancelSwap();
      await refreshProfile();
    } catch {
      toast.error(t('teamRoster.removeError'));
    } finally {
      setRemoving(null);
    }
  }

  function handleSearch(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiClient.players.search(q.trim(), 10);
        setResults(data.results ?? []);
      } catch { /* silent */ } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function handleAdd(player: PlayerSearchResult) {
    if (!teamId) return;
    setAdding(true);
    try {
      await apiClient.teams.addPlayer(teamId, player.id, addRole, addStatus);
      toast.success(t('teamRoster.addSuccess'));
      setQuery(''); setResults([]);
      await refreshProfile();
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : t('teamRoster.addError'));
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('common.loading')}</div>;

  const starters = profile?.roster.filter((m) => m.rosterStatus === 'STARTER') ?? [];
  const bench = profile?.roster.filter((m) => m.rosterStatus === 'BENCH') ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="header-title">{t('teamRoster.title')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
              {t('teamRoster.subtitle', 'Manage your squad composition and player roles.')}
            </p>
          </div>
          {canEdit && !showCreate && (
            <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 'unset' }}>
              <Plus size={16} /> New Team
            </button>
          )}
        </div>
      </header>

      {/* Create team form */}
      {showCreate && canEdit && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>New Team</h3>
            <button onClick={() => setShowCreate(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Team name *</label>
              <input className="input" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Team Liquid" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Abbreviation</label>
              <input className="input" value={createForm.abbreviation} onChange={(e) => setCreateForm((f) => ({ ...f, abbreviation: e.target.value }))} placeholder="e.g. TL" maxLength={10} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Region</label>
              <input className="input" value={createForm.region} onChange={(e) => setCreateForm((f) => ({ ...f, region: e.target.value }))} placeholder="e.g. EU, NA, LATAM" style={{ width: '100%' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Logo</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input className="input" value={createForm.logoUrl.startsWith('data:') ? '' : createForm.logoUrl} onChange={(e) => setCreateForm((f) => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." style={{ flex: 1 }} />
                <button type="button" onClick={() => createFileRef.current?.click()} className="btn-secondary" style={{ flex: 'unset', whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}>
                  Upload image
                </button>
                <input ref={createFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCreateFileChange} />
              </div>
              {createForm.logoUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <img src={createForm.logoUrl} alt="Logo preview" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <button type="button" onClick={() => setCreateForm((f) => ({ ...f, logoUrl: '' }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes</label>
              <textarea className="input" value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" rows={2} style={{ width: '100%', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowCreate(false)} disabled={creating} style={{ flex: 'unset' }}>Cancel</button>
            <button className="btn-primary" onClick={() => void handleCreateTeam()} disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 'unset' }}>
              <Check size={14} /> {creating ? 'Creating…' : 'Create Team'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && teams.length === 0 && !showCreate && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>No teams yet.</p>
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flex: 'unset' }}>
              <Plus size={14} /> Create your first team
            </button>
          )}
        </div>
      )}

      {/* Team selector */}
      {teams.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>{t('teamRoster.selectTeam')}</span>
          <div style={{ position: 'relative' }}>
            <select
              className="input"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              style={{ paddingRight: '2rem', appearance: 'none', minWidth: 200 }}
            >
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        </div>
      )}

      {!loading && teams.length > 0 && !profile && <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>{t('common.loading')}</div>}

      {profile && (
        <>
          {/* STARTERS */}
          <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Users size={14} style={{ color: 'var(--accent-teal-bright)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-teal-bright)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {t('teamRoster.starters')}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {starters.length} / 5
              </span>
            </div>
            {starters.length === 0 && (
              <div style={{ padding: '1.25rem 1.1rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>{t('teamRoster.noStarters')}</div>
            )}
            {starters.map((m) => (
              <PlayerRow
                key={m.rosterId}
                member={m}
                canEdit={canEdit}
                isPending={pendingSwap?.rosterId === m.rosterId}
                isDisabled={!!pendingSwap && pendingSwap.rosterId !== m.rosterId}
                removing={removing === m.rosterId}
                onOpenSwap={() => openSwap(m)}
                onRemove={() => void handleRemove(m)}
                onChangeRole={(role) => void handleChangeRole(m, role)}
              />
            ))}
            {/* Swap bar for benching a starter */}
            {pendingSwap?.direction === 'bench' && starters.some((m) => m.rosterId === pendingSwap.rosterId) && (
              <SwapBar
                label={t('teamRoster.swapWhoActivates')}
                options={bench}
                selectedId={swapTargetId}
                required={false}
                onSelect={setSwapTargetId}
                onConfirm={() => void confirmSwap()}
                onCancel={cancelSwap}
                loading={swapping}
              />
            )}
          </section>

          {/* BENCH */}
          <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Users size={14} style={{ color: 'var(--accent-prime)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-prime)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {t('teamRoster.bench')}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {bench.length}
              </span>
            </div>
            {bench.length === 0 && (
              <div style={{ padding: '1.25rem 1.1rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>{t('teamRoster.noBench')}</div>
            )}
            {bench.map((m) => (
              <PlayerRow
                key={m.rosterId}
                member={m}
                canEdit={canEdit}
                isPending={pendingSwap?.rosterId === m.rosterId}
                isDisabled={!!pendingSwap && pendingSwap.rosterId !== m.rosterId}
                removing={removing === m.rosterId}
                onOpenSwap={() => openSwap(m)}
                onRemove={() => void handleRemove(m)}
                onChangeRole={(role) => void handleChangeRole(m, role)}
              />
            ))}
            {/* Swap bar for activating a bench player */}
            {pendingSwap?.direction === 'activate' && bench.some((m) => m.rosterId === pendingSwap.rosterId) && (
              <SwapBar
                label={t('teamRoster.swapWhoBenches')}
                options={starters}
                selectedId={swapTargetId}
                required={false}
                onSelect={setSwapTargetId}
                onConfirm={() => void confirmSwap()}
                onCancel={cancelSwap}
                loading={swapping}
              />
            )}
          </section>

          {/* ADD PLAYER */}
          {canEdit && (
            <section className="glass-card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <Plus size={14} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {t('teamRoster.addPlayer')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <Search size={13} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    className="input"
                    placeholder={t('playerScouting.searchPlaceholder')}
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    style={{ paddingLeft: '2rem' }}
                  />
                </div>
                <select className="input" value={addRole ?? ''} onChange={(e) => setAddRole((e.target.value as TeamRole) || undefined)} style={{ minWidth: 120 }}>
                  <option value="">{t('teamRoster.rolePlaceholder')}</option>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r.toUpperCase()]}</option>)}
                </select>
                <select className="input" value={addStatus} onChange={(e) => setAddStatus(e.target.value as RosterStatus)} style={{ minWidth: 120 }}>
                  <option value="STARTER">{t('teamRoster.starters')}</option>
                  <option value="BENCH">{t('teamRoster.bench')}</option>
                </select>
              </div>
              {searching && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('playerScouting.searching')}</div>}
              {results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {results.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.75rem', borderRadius: 6, background: 'var(--bg-hover)' }}>
                      <span style={{ flex: 1, fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600 }}>{p.displayName}</span>
                      <button className="btn-primary" disabled={adding} onClick={() => void handleAdd(p)} style={{ fontSize: '0.72rem', padding: '0.3rem 0.85rem' }}>
                        {t('teamRoster.addPlayer')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

const labelStyle: import('react').CSSProperties = {
  display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem',
};

// ── Swap bar ──────────────────────────────────────────────────────────────────
function SwapBar({ label, options, selectedId, required, onSelect, onConfirm, onCancel, loading }: {
  label: string;
  options: RosterMember[];
  selectedId: string;
  required: boolean;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.1rem', background: 'rgba(107,170,248,0.06)', borderTop: '1px solid rgba(107,170,248,0.18)', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 700, flexShrink: 0 }}>{label}</span>
      <select
        className="input"
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        style={{ minWidth: 160, fontSize: '0.8rem' }}
        autoFocus
      >
        {!required && <option value="">{t('teamRoster.swapNone')}</option>}
        {required && <option value="">{t('teamRoster.swapConfirm')}…</option>}
        {options.map((m) => {
          const r = m.role?.toUpperCase() ?? '';
          return (
            <option key={m.rosterId} value={m.rosterId}>
              {m.customName ?? m.displayName}{r ? ` · ${ROLE_LABEL[r] ?? m.role}` : ''}
            </option>
          );
        })}
      </select>
      <button
        className="btn-primary"
        disabled={loading || (required && !selectedId)}
        onClick={onConfirm}
        style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
      >
        <Check size={13} /> {t('teamRoster.swapConfirm')}
      </button>
      <button
        className="btn-secondary"
        disabled={loading}
        onClick={onCancel}
        style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
      >
        <X size={13} /> {t('teamRoster.swapCancel')}
      </button>
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({
  member, canEdit, isPending, isDisabled, removing, onOpenSwap, onRemove, onChangeRole,
}: {
  member: RosterMember;
  canEdit: boolean;
  isPending: boolean;
  isDisabled: boolean;
  removing: boolean;
  onOpenSwap: () => void;
  onRemove: () => void;
  onChangeRole: (role: TeamRole | null) => void;
}) {
  const { t } = useTranslation();
  const role = member.role?.toUpperCase() ?? '';
  const isBench = member.rosterStatus === 'BENCH';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.75rem 1.1rem', borderBottom: '1px solid var(--border-color)',
      opacity: isDisabled ? 0.4 : 1,
      background: isPending ? 'rgba(107,170,248,0.05)' : 'transparent',
      transition: 'opacity 0.15s, background 0.15s',
    }}>
      {/* Role — icon + selector or badge */}
      {canEdit ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 90 }}>
          {role && <RoleIcon role={role} size={15} />}
          <select
            value={member.role ?? ''}
            disabled={isDisabled}
            onChange={(e) => onChangeRole((e.target.value as TeamRole) || null)}
            style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 4px', borderRadius: 4, border: `1px solid ${ROLE_COLOR[role] ?? 'var(--border-color)'}44`, background: 'transparent', color: ROLE_COLOR[role] ?? 'var(--text-muted)', fontFamily: 'var(--font-mono)', cursor: 'pointer', maxWidth: 72 }}
          >
            <option value="">{t('teamRoster.rolePlaceholder')}</option>
            {(['CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE', 'SUPPORT']).map((r) => (
              <option key={r} value={r.toLowerCase()}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
      ) : (
        role
          ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 90 }}>
              <RoleIcon role={role} size={15} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: ROLE_COLOR[role], fontFamily: 'var(--font-mono)' }}>{ROLE_LABEL[role]}</span>
            </div>
          )
          : <span style={{ minWidth: 90 }} />
      )}

      {/* Name */}
      <span style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem', color: isBench ? 'var(--text-muted)' : 'var(--text-primary)' }}>
        {member.customName ?? member.displayName}
      </span>

      {/* Rank */}
      {member.rating?.rankLabel && (
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {member.rating.rankLabel}
        </span>
      )}

      {canEdit && (
        <>
          <button
            className="btn-secondary"
            disabled={isDisabled || isPending}
            onClick={onOpenSwap}
            style={{ fontSize: '0.7rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: isPending ? 'var(--accent-blue)' : isBench ? 'var(--accent-teal-bright)' : 'var(--accent-prime)', minWidth: 80 }}
          >
            <ArrowUpDown size={11} />
            {isBench ? t('teamRoster.activateAction') : t('teamRoster.benchAction')}
          </button>
          <button
            className="btn-secondary"
            disabled={removing || isDisabled}
            onClick={onRemove}
            style={{ padding: '0.35rem', color: 'var(--accent-loss)', opacity: removing ? 0.5 : 1 }}
            title={t('teamRoster.removeAction')}
          >
            <UserMinus size={14} />
          </button>
        </>
      )}
    </div>
  );
}
