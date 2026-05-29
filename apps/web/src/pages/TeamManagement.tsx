import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, X, Check, Users, UserPlus, Copy, Trash2,
  ChevronDown, Search, UserMinus,
} from 'lucide-react';
import {
  apiClient, ApiErrorResponse,
  type TeamProfile, type TeamStaffMember, type PlayerSearchResult,
  type TeamRole, type RosterStatus, type RosterMember, type Invitation,
} from '../api/client';
import { useAuth } from '../hooks/useAuth';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function invitationUrl(token: string) {
  return `${window.location.origin}/register/${encodeURIComponent(token)}`;
}

const ROLE_COLORS: Record<string, string> = {
  MANAGER: 'var(--accent-prime)',
  COACH: 'var(--accent-teal-bright)',
  ANALISTA: 'var(--accent-blue)',
  JUGADOR: 'var(--accent-win)',
};

const INVITE_ROLES = ['COACH', 'ANALISTA', 'JUGADOR', 'MANAGER'] as const;
const PLAYER_ROLES: TeamRole[] = ['carry', 'jungle', 'midlane', 'offlane', 'support'];
const ROLE_LABEL: Record<string, string> = {
  CARRY: 'Carry', JUNGLE: 'Jungle', MIDLANE: 'Mid', OFFLANE: 'Offlane', SUPPORT: 'Support',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 700,
};

// ── Root ──────────────────────────────────────────────────────────────────────

export default function TeamManagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (id) {
    return <TeamDetail teamId={id} onBack={() => navigate('/management/teams')} />;
  }
  return <TeamList onSelect={(teamId) => navigate(`/management/teams/${teamId}`)} />;
}

// ── Team List ─────────────────────────────────────────────────────────────────

function TeamList({ onSelect }: { onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', abbreviation: '', logoUrl: '', region: '', notes: '' });
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isPlatformAdmin = user?.globalRole === 'PLATFORM_ADMIN';
  const isManager = user?.memberships?.some((m) => m.role === 'MANAGER') ?? false;
  const canCreate = isPlatformAdmin || isManager;

  useEffect(() => {
    apiClient.teams.list('OWN')
      .then((res) => setTeams(res.teams ?? []))
      .catch(() => toast.error(t('teamRoster.addError')))
      .finally(() => setLoading(false));
  }, []);

  function myRoleInTeam(teamId: string): string | undefined {
    return user?.memberships?.find((m) => m.team.id === teamId)?.role;
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only image files are supported.'); return; }
    if (file.size > 200 * 1024) { toast.error('Image must be under 200 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logoUrl: reader.result as string }));
    reader.readAsDataURL(file);
  }

  async function handleCreate() {
    if (!form.name.trim()) { toast.error('Team name is required.'); return; }
    setCreating(true);
    try {
      const created = await apiClient.teams.create({
        name: form.name.trim(),
        abbreviation: form.abbreviation.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        region: form.region.trim() || undefined,
        notes: form.notes.trim() || undefined,
        type: 'OWN',
      });
      toast.success(`Team "${created.name}" created.`);
      setShowCreate(false);
      setForm({ name: '', abbreviation: '', logoUrl: '', region: '', notes: '' });
      onSelect(created.id);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to create team.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('common.loading')}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="header-title">{t('teamRoster.title')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
              {t('staffManagement.description')}
            </p>
          </div>
          {canCreate && !showCreate && (
            <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 'unset' }}>
              <Plus size={16} /> {t('common.newTeam', 'New Team')}
            </button>
          )}
        </div>
      </header>

      {/* Create form */}
      {showCreate && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('common.newTeam', 'New Team')}</h3>
            <button onClick={() => setShowCreate(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>{t('common.teamName', 'Team name')} *</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Team Liquid" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>{t('common.abbreviation', 'Abbreviation')}</label>
              <input className="input" value={form.abbreviation} onChange={(e) => setForm((f) => ({ ...f, abbreviation: e.target.value }))} placeholder="e.g. TL" maxLength={10} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>{t('common.region', 'Region')}</label>
              <input className="input" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="e.g. EU, NA, LATAM" style={{ width: '100%' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>{t('common.logo', 'Logo')}</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input className="input" value={form.logoUrl.startsWith('data:') ? '' : form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." style={{ flex: 1 }} />
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary" style={{ flex: 'unset', whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}>
                  {t('common.upload', 'Upload')}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              </div>
              {form.logoUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <img src={form.logoUrl} alt="preview" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, logoUrl: '' }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setShowCreate(false)} disabled={creating} style={{ flex: 'unset' }}>{t('common.cancel', 'Cancel')}</button>
            <button className="btn-primary" onClick={() => void handleCreate()} disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 'unset' }}>
              <Check size={14} /> {creating ? t('common.creating', 'Creating…') : t('common.create', 'Create')}
            </button>
          </div>
        </div>
      )}

      {/* Team grid */}
      {teams.length === 0 && !showCreate ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <Users size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{t('teamRoster.noTeams')}</p>
          {canCreate && (
            <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flex: 'unset' }}>
              <Plus size={14} /> {t('common.newTeam', 'New Team')}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {teams.map((team) => {
            const myRole = myRoleInTeam(team.id);
            return (
              <button
                key={team.id}
                onClick={() => onSelect(team.id)}
                className="glass-card"
                style={{ textAlign: 'left', cursor: 'pointer', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)', background: 'var(--bg-card)', transition: 'border-color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-highlight)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              >
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt={team.name} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, background: 'var(--bg-dark)', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={20} style={{ color: 'var(--text-muted)' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</p>
                  {team.region && <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>{team.region}</p>}
                  {myRole && (
                    <span style={{ display: 'inline-block', marginTop: '0.4rem', fontSize: '0.68rem', fontWeight: 800, color: ROLE_COLORS[myRole] ?? 'var(--text-muted)', border: `1px solid ${ROLE_COLORS[myRole] ?? 'var(--border-color)'}`, borderRadius: '999px', padding: '0.1rem 0.5rem', letterSpacing: '0.04em' }}>
                      {myRole}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Team Detail ───────────────────────────────────────────────────────────────

function TeamDetail({ teamId, onBack }: { teamId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);

  const isPlatformAdmin = user?.globalRole === 'PLATFORM_ADMIN';
  const myMembership = user?.memberships?.find((m) => m.team.id === teamId);
  const myRole = myMembership?.role ?? null;
  const canManageStaff = isPlatformAdmin || myRole === 'MANAGER';
  const canManageRoster = isPlatformAdmin || myRole === 'MANAGER' || myRole === 'COACH';
  const canInvite = canManageStaff || myRole === 'COACH';

  async function loadProfile() {
    try {
      const data = await apiClient.teams.getProfile(teamId);
      setProfile(data);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to load team.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProfile(); }, [teamId]);

  async function handleRemoveMember(member: TeamStaffMember) {
    try {
      await apiClient.teams.removeMember(teamId, member.userId);
      toast.success(`${member.name} removed from the team.`);
      setProfile((p) => p ? { ...p, staff: p.staff.filter((s) => s.userId !== member.userId) } : p);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to remove member.');
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('common.loading')}</div>;
  if (!profile) return null;

  const staffMembers = profile.staff.filter((s) => s.role !== 'JUGADOR');
  const playerMembers = profile.staff.filter((s) => s.role === 'JUGADOR');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <header className="header">
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: 0, marginBottom: '0.75rem' }}>
          <ArrowLeft size={14} /> {t('common.back', 'Back')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {profile.logoUrl && (
              <img src={profile.logoUrl} alt={profile.name} style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div>
              <h1 className="header-title" style={{ marginBottom: 0 }}>{profile.name}</h1>
              {(profile.abbreviation || profile.region) && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  {[profile.abbreviation, profile.region].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
          {canInvite && (
            <button className="btn-primary" onClick={() => setShowAddMember(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 'unset' }}>
              <UserPlus size={15} /> {t('staffManagement.newInvitation')}
            </button>
          )}
        </div>
      </header>

      {/* Add member panel */}
      {showAddMember && (
        <AddMemberPanel
          teamId={teamId}
          canInviteManager={canManageStaff}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Invitations panel */}
      {canInvite && (
        <InvitationsPanel teamId={teamId} />
      )}

      {/* Staff section */}
      <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Users size={14} style={{ color: 'var(--accent-teal-bright)' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-teal-bright)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {t('common.staff', 'Staff')}
          </span>
        </div>
        {staffMembers.length === 0 ? (
          <div style={{ padding: '1.25rem 1.1rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>{t('common.noMembers', 'No staff members yet.')}</div>
        ) : (
          staffMembers.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              canRemove={canManageStaff && !(member.role === 'MANAGER' && !isPlatformAdmin)}
              onRemove={() => void handleRemoveMember(member)}
            />
          ))
        )}
      </section>

      {/* Player members section */}
      {playerMembers.length > 0 && (
        <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users size={14} style={{ color: 'var(--accent-win)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-win)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {t('common.players', 'Jugadores')}
            </span>
          </div>
          {playerMembers.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              canRemove={canManageStaff}
              onRemove={() => void handleRemoveMember(member)}
            />
          ))}
        </section>
      )}

      {/* pred.gg Roster section */}
      <RosterSection
        teamId={teamId}
        roster={profile.roster}
        canEdit={canManageRoster}
        onRosterChange={loadProfile}
      />
    </div>
  );
}

// ── Member Row ────────────────────────────────────────────────────────────────

function MemberRow({ member, canRemove, onRemove }: { member: TeamStaffMember; canRemove: boolean; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.1rem', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: ROLE_COLORS[member.role] ?? 'var(--text-muted)', flexShrink: 0 }}>
        {member.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</p>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</p>
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: ROLE_COLORS[member.role] ?? 'var(--text-muted)', border: `1px solid ${ROLE_COLORS[member.role] ?? 'var(--border-color)'}`, borderRadius: '999px', padding: '0.1rem 0.5rem', letterSpacing: '0.04em', flexShrink: 0 }}>
        {member.role}
      </span>
      {canRemove && (
        <button onClick={onRemove} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-loss)', display: 'flex', padding: '0.25rem', flexShrink: 0 }}>
          <UserMinus size={15} />
        </button>
      )}
    </div>
  );
}

// ── Add Member Panel ──────────────────────────────────────────────────────────

function AddMemberPanel({ teamId, canInviteManager, onClose }: { teamId: string; canInviteManager: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<typeof INVITE_ROLES[number]>('COACH');
  const [playerId, setPlayerId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  // Player search for JUGADOR role
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiClient.players.search(q);
        setResults(res.results ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
  }

  const availableRoles = canInviteManager ? INVITE_ROLES : INVITE_ROLES.filter((r) => r !== 'MANAGER');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) { toast.error(t('staffManagement.emailLabel') + ' required.'); return; }
    setCreating(true);
    try {
      const res = await apiClient.invitations.create({
        email: email.trim(),
        teamId,
        role,
        playerId: playerId || undefined,
      });
      const url = invitationUrl(res.invitation.token);
      setCreatedLink(url);
      await navigator.clipboard?.writeText(url);
      toast.success(t('staffManagement.invitationCreated'));
      setEmail('');
      setPlayerId('');
      setQuery('');
      setResults([]);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : t('staffManagement.failedCreate'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <UserPlus size={16} style={{ color: 'var(--accent-teal-bright)' }} />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>{t('staffManagement.newInvitation')}</h3>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'grid', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={labelStyle}>{t('staffManagement.emailLabel')}</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
        </label>

        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={labelStyle}>{t('staffManagement.roleLabel')}</span>
          <div style={{ position: 'relative' }}>
            <select className="input" value={role} onChange={(e) => { setRole(e.target.value as typeof INVITE_ROLES[number]); setPlayerId(''); setQuery(''); setResults([]); }} style={{ paddingRight: '2rem', appearance: 'none', width: '100%' }}>
              {availableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        </label>

        {role === 'JUGADOR' && (
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={labelStyle}>{t('staffManagement.playerLabel')}</span>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input className="input" value={query} onChange={(e) => handleSearch(e.target.value)} placeholder={t('playerScouting.searchPlaceholder')} style={{ paddingLeft: '2rem' }} />
            </div>
            {searching && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('playerScouting.searching')}</p>}
            {results.length > 0 && (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: 160, overflowY: 'auto' }}>
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPlayerId(p.id); setQuery(p.displayName); setResults([]); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: playerId === p.id ? 'rgba(107,170,248,0.1)' : 'var(--bg-card)', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.84rem' }}
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            )}
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('staffManagement.playerHelperText')}</p>
          </label>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 'unset' }}>{t('common.cancel', 'Cancel')}</button>
          <button type="submit" className="btn-primary" disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 'unset' }}>
            <UserPlus size={14} /> {creating ? t('staffManagement.creatingButton') : t('staffManagement.createButton')}
          </button>
        </div>
      </form>

      {createdLink && (
        <div style={{ background: 'rgba(107,170,248,0.08)', border: '1px solid var(--accent-blue)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 700 }}>Invitation link (already copied):</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{createdLink}</span>
            <button onClick={() => { void navigator.clipboard?.writeText(createdLink); toast.success(t('staffManagement.invitationCopied')); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)', display: 'flex', padding: '0.25rem' }}>
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Invitations Panel ─────────────────────────────────────────────────────────

function InvitationsPanel({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.invitations.list(teamId)
      .then((res) => setInvitations(res.invitations ?? []))
      .catch((err) => {
        if (!(err instanceof ApiErrorResponse && err.status === 403)) toast.error(t('staffManagement.failedLoadInvitations'));
        setInvitations([]);
      })
      .finally(() => setLoading(false));
  }, [teamId]);

  async function handleRevoke(id: string) {
    await apiClient.invitations.delete(id);
    setInvitations((p) => p.filter((i) => i.id !== id));
    toast.success(t('staffManagement.invitationRevoked'));
  }

  if (loading || invitations.length === 0) return null;

  return (
    <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <UserPlus size={14} style={{ color: 'var(--accent-prime)' }} />
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-prime)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {t('staffManagement.pendingInvitations')}
        </span>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{invitations.length}</span>
      </div>
      {invitations.map((inv) => (
        <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.73rem' }}>{t('staffManagement.expires', { date: new Date(inv.expiresAt).toLocaleDateString() })}</p>
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: ROLE_COLORS[inv.role] ?? 'var(--text-muted)', border: `1px solid ${ROLE_COLORS[inv.role] ?? 'var(--border-color)'}`, borderRadius: '999px', padding: '0.1rem 0.5rem', flexShrink: 0 }}>
            {inv.role}
          </span>
          <button onClick={() => { void navigator.clipboard?.writeText(invitationUrl(inv.token)); toast.success(t('staffManagement.invitationCopied')); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '0.25rem', flexShrink: 0 }}>
            <Copy size={14} />
          </button>
          <button onClick={() => void handleRevoke(inv.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-loss)', display: 'flex', padding: '0.25rem', flexShrink: 0 }}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </section>
  );
}

// ── Roster Section ────────────────────────────────────────────────────────────

function RosterSection({ teamId, roster, canEdit, onRosterChange }: {
  teamId: string;
  roster: RosterMember[];
  canEdit: boolean;
  onRosterChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addRole, setAddRole] = useState<TeamRole | undefined>(undefined);
  const [addStatus, setAddStatus] = useState<RosterStatus>('STARTER');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiClient.players.search(q);
        setResults(res.results ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
  }

  async function handleAdd(player: PlayerSearchResult) {
    setAdding(true);
    try {
      await apiClient.teams.addPlayer(teamId, player.id, addRole, addStatus);
      toast.success(t('teamRoster.addSuccess'));
      setQuery(''); setResults([]);
      void apiClient.missions.complete('ADD_ROSTER_PLAYER').catch(() => null);
      await onRosterChange();
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : t('teamRoster.addError'));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(member: RosterMember) {
    setRemoving(member.rosterId);
    try {
      await apiClient.teams.removePlayer(teamId, member.rosterId);
      toast.success(t('teamRoster.removeSuccess'));
      await onRosterChange();
    } catch {
      toast.error(t('teamRoster.removeError'));
    } finally {
      setRemoving(null);
    }
  }

  async function handleChangeStatus(member: RosterMember, status: RosterStatus) {
    try {
      await apiClient.teams.updateRoster(teamId, member.rosterId, member.role as TeamRole | null, status);
      await onRosterChange();
    } catch {
      toast.error(t('teamRoster.updateError'));
    }
  }

  const starters = roster.filter((m) => m.rosterStatus === 'STARTER');
  const bench = roster.filter((m) => m.rosterStatus === 'BENCH');

  return (
    <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Users size={14} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Roster pred.gg
        </span>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{roster.length}</span>
      </div>

      {/* Starters */}
      {starters.length > 0 && (
        <div>
          <div style={{ padding: '0.45rem 1.1rem', background: 'rgba(107,170,248,0.05)', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('teamRoster.starters')} ({starters.length}/5)</span>
          </div>
          {starters.map((m) => (
            <RosterRow key={m.rosterId} member={m} canEdit={canEdit} removing={removing === m.rosterId}
              onRemove={() => void handleRemove(m)}
              onChangeStatus={(s) => void handleChangeStatus(m, s)} />
          ))}
        </div>
      )}

      {/* Bench */}
      {bench.length > 0 && (
        <div>
          <div style={{ padding: '0.45rem 1.1rem', background: 'rgba(157,78,221,0.05)', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('teamRoster.bench')} ({bench.length})</span>
          </div>
          {bench.map((m) => (
            <RosterRow key={m.rosterId} member={m} canEdit={canEdit} removing={removing === m.rosterId}
              onRemove={() => void handleRemove(m)}
              onChangeStatus={(s) => void handleChangeStatus(m, s)} />
          ))}
        </div>
      )}

      {roster.length === 0 && (
        <div style={{ padding: '1.25rem 1.1rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>No pred.gg players linked yet.</div>
      )}

      {/* Add player */}
      {canEdit && (
        <div style={{ padding: '1rem 1.1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={labelStyle}>{t('teamRoster.addPlayer')}</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input className="input" value={query} onChange={(e) => handleSearch(e.target.value)} placeholder={t('playerScouting.searchPlaceholder')} style={{ paddingLeft: '2rem', width: '100%' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select className="input" value={addRole ?? ''} onChange={(e) => setAddRole((e.target.value || undefined) as TeamRole | undefined)} style={{ paddingRight: '1.8rem', appearance: 'none' }}>
                <option value="">{t('teamRoster.rolePlaceholder')}</option>
                {PLAYER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r.toUpperCase()] ?? r}</option>)}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select className="input" value={addStatus} onChange={(e) => setAddStatus(e.target.value as RosterStatus)} style={{ paddingRight: '1.8rem', appearance: 'none' }}>
                <option value="STARTER">{t('teamRoster.starters')}</option>
                <option value="BENCH">{t('teamRoster.bench')}</option>
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
          </div>
          {searching && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('playerScouting.searching')}</p>}
          {results.length > 0 && (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: 160, overflowY: 'auto' }}>
              {results.map((p) => (
                <button
                  key={p.id}
                  disabled={adding}
                  onClick={() => void handleAdd(p)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'var(--bg-card)', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.84rem' }}
                >
                  {p.displayName}
                  {adding && ' …'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Roster Row ────────────────────────────────────────────────────────────────

function RosterRow({ member, canEdit, removing, onRemove, onChangeStatus }: {
  member: RosterMember;
  canEdit: boolean;
  removing: boolean;
  onRemove: () => void;
  onChangeStatus: (status: RosterStatus) => void;
}) {
  const { t } = useTranslation();
  const isStarter = member.rosterStatus === 'STARTER';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.1rem', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.customName ?? member.displayName}
        </p>
        {member.role && (
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{ROLE_LABEL[member.role.toUpperCase()] ?? member.role}</span>
        )}
      </div>
      {member.rating?.rankLabel && (
        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{member.rating.rankLabel}</span>
      )}
      {canEdit && (
        <>
          <button
            onClick={() => onChangeStatus(isStarter ? 'BENCH' : 'STARTER')}
            style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.72rem', padding: '0.2rem 0.5rem', flexShrink: 0 }}
          >
            {isStarter ? t('teamRoster.benchAction') : t('teamRoster.activateAction')}
          </button>
          <button onClick={onRemove} disabled={removing} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-loss)', display: 'flex', padding: '0.25rem', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
