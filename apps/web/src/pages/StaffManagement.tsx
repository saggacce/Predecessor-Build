import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Copy, Plus, Shield, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type Invitation, type TeamProfile } from '../api/client';
import { useAuth } from '../hooks/useAuth';

const ROLES = ['MANAGER', 'COACH', 'ANALISTA', 'JUGADOR'] as const;

function invitationUrl(token: string) {
  return `${window.location.origin}/register/${token}`;
}

export default function StaffManagement() {
  const { user, internalLoading } = useAuth();

  if (internalLoading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Checking session...</div>;
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '480px' }}>
        <div className="glass-card" style={{ display: 'grid', gap: '1rem' }}>
          <Shield size={34} style={{ color: 'var(--accent-blue)' }} />
          <h1 className="header-title">Staff & Invitations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Sign in to manage team members and invitations.
          </p>
          <a className="btn-primary" href="/login" style={{ width: 'fit-content' }}>Login</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Staff & Invitations</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
          Gestiona miembros del equipo y envía invitaciones.
        </p>
      </header>
      <StaffTab user={user} isPlatformAdmin={user.globalRole === 'PLATFORM_ADMIN'} />
    </div>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab({ user, isPlatformAdmin }: { user: NonNullable<ReturnType<typeof useAuth>['user']>; isPlatformAdmin: boolean }) {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [teamId, setTeamId] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('COACH');
  const [playerId, setPlayerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const manageableTeams = useMemo(() => {
    if (isPlatformAdmin) return teams;
    const managerIds = new Set(user.memberships.filter((m) => m.role === 'MANAGER').map((m) => m.teamId));
    return teams.filter((t) => managerIds.has(t.id));
  }, [teams, user, isPlatformAdmin]);

  useEffect(() => {
    apiClient.teams.list('OWN')
      .then((res) => { setTeams(res.teams); if (res.teams.length > 0) setTeamId(res.teams[0].id); })
      .catch(() => toast.error('Failed to load teams.'));
  }, []);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    apiClient.invitations.list(teamId)
      .then((res) => setInvitations(res.invitations))
      .catch((err) => { if (!(err instanceof ApiErrorResponse && err.status === 403)) toast.error('Failed to load invitations.'); setInvitations([]); })
      .finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => {
    if (manageableTeams.length > 0 && !manageableTeams.some((t) => t.id === teamId)) setTeamId(manageableTeams[0].id);
  }, [manageableTeams, teamId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!teamId) return;
    setCreating(true);
    try {
      const res = await apiClient.invitations.create({ email, teamId, role, playerId: playerId || undefined });
      setInvitations((prev) => [res.invitation, ...prev]);
      setEmail('');
      setRole('COACH');
      setPlayerId('');
      await navigator.clipboard?.writeText(invitationUrl(res.invitation.token));
      toast.success('Invitation created and link copied.');
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to create invitation');
    } finally {
      setCreating(false);
    }
  }

  const selectedTeam = teams.find((t) => t.id === teamId);

  return (
    <div className="staff-layout">
      <form className="glass-card" onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <UserPlus size={18} style={{ color: 'var(--accent-teal-bright)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>New invitation</h2>
        </div>
        <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          Team
          <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
            {manageableTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          Email
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          Role
          <select className="input" value={role} onChange={(e) => { setRole(e.target.value as (typeof ROLES)[number]); setPlayerId(''); }}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {role === 'JUGADOR' && (
          <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            Jugador en la BD
            <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">Sin vincular (vincular más tarde)</option>
              {(selectedTeam?.roster ?? []).map((m) => (
                <option key={m.playerId} value={m.playerId}>
                  {m.customName ?? m.displayName}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              Selecciona el jugador del roster para vincular su cuenta automáticamente al registrarse.
            </span>
          </label>
        )}
        <button className="btn-primary" type="submit" disabled={creating || manageableTeams.length === 0}>
          <Plus size={16} />{creating ? 'Creating...' : 'Create invitation'}
        </button>
      </form>

      <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>Pending invitations</h2>
            <p style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{selectedTeam?.name ?? 'No team selected'}</p>
          </div>
          <span className="mono" style={{ color: 'var(--accent-blue)', fontWeight: 800 }}>{invitations.length}</span>
        </div>
        {loading ? (
          <div style={{ padding: '1.25rem', color: 'var(--text-muted)' }}>Loading...</div>
        ) : invitations.length === 0 ? (
          <div style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.86rem' }}>No pending invitations.</div>
        ) : (
          <div>
            {invitations.map((inv) => (
              <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', padding: '1rem 1.1rem', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{inv.email}</strong>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-teal-bright)', border: '1px solid var(--border-teal)', borderRadius: '999px', padding: '0.14rem 0.45rem' }}>{inv.role}</span>
                  </div>
                  <div className="mono" style={{ marginTop: '0.35rem', color: 'var(--text-dim)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {invitationUrl(inv.token)}
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button className="btn-secondary" type="button" onClick={() => void navigator.clipboard?.writeText(invitationUrl(inv.token)).then(() => toast.success('Copied'))} style={{ padding: '0.5rem' }}>
                    <Copy size={15} />
                  </button>
                  <button className="btn-secondary" type="button" onClick={async () => { await apiClient.invitations.delete(inv.id); setInvitations((p) => p.filter((i) => i.id !== inv.id)); toast.success('Revoked.'); }} style={{ padding: '0.5rem', color: 'var(--accent-loss)' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
