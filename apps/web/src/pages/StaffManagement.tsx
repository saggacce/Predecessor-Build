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
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [teamId, setTeamId] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('COACH');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const manageableTeams = useMemo(() => {
    if (!user) return [];
    if (user.globalRole === 'PLATFORM_ADMIN') return teams;
    const managerTeamIds = new Set(user.memberships.filter((m) => m.role === 'MANAGER').map((m) => m.teamId));
    return teams.filter((team) => managerTeamIds.has(team.id));
  }, [teams, user]);

  useEffect(() => {
    apiClient.teams
      .list('OWN')
      .then((res) => {
        setTeams(res.teams);
        if (res.teams.length > 0) setTeamId(res.teams[0].id);
      })
      .catch(() => toast.error('Failed to load teams.'));
  }, []);

  useEffect(() => {
    if (!teamId || !user) return;
    setLoading(true);
    apiClient.invitations
      .list(teamId)
      .then((res) => setInvitations(res.invitations))
      .catch((err) => {
        if (err instanceof ApiErrorResponse && err.status === 403) setInvitations([]);
        else toast.error('Failed to load invitations.');
      })
      .finally(() => setLoading(false));
  }, [teamId, user?.id]);

  useEffect(() => {
    if (manageableTeams.length > 0 && !manageableTeams.some((team) => team.id === teamId)) {
      setTeamId(manageableTeams[0].id);
    }
  }, [manageableTeams, teamId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!teamId) return;
    setCreating(true);
    try {
      const res = await apiClient.invitations.create({ email, teamId, role });
      setInvitations((prev) => [res.invitation, ...prev]);
      setEmail('');
      setRole('COACH');
      await navigator.clipboard?.writeText(invitationUrl(res.invitation.token));
      toast.success('Invitation created.');
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Failed to create invitation';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(token: string) {
    await navigator.clipboard?.writeText(invitationUrl(token));
    toast.success('Invitation link copied.');
  }

  async function handleDelete(invitation: Invitation) {
    try {
      await apiClient.invitations.delete(invitation.id);
      setInvitations((prev) => prev.filter((item) => item.id !== invitation.id));
      toast.success('Invitation revoked.');
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Failed to revoke invitation';
      toast.error(message);
    }
  }

  if (internalLoading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Checking session...</div>;
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '560px' }}>
        <div className="glass-card" style={{ display: 'grid', gap: '1rem' }}>
          <Shield size={34} style={{ color: 'var(--accent-blue)' }} />
          <h1 className="header-title">Staff</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Sign in with an internal PrimeSight account to manage team invitations.
          </p>
          <a className="btn-primary" href="/login" style={{ width: 'fit-content' }}>
            Login
          </a>
        </div>
      </div>
    );
  }

  const selectedTeam = teams.find((team) => team.id === teamId);

  return (
    <div>
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
        <div>
          <h1 className="header-title">Staff</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
            Pending invitations for team roles.
          </p>
        </div>
        <div style={{ padding: '0.45rem 0.7rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700 }}>
          {user.name}
        </div>
      </header>

      <div className="staff-layout">
        <form className="glass-card" onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <UserPlus size={18} style={{ color: 'var(--accent-teal-bright)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>New invitation</h2>
          </div>

          <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            Team
            <select className="input" value={teamId} onChange={(event) => setTeamId(event.target.value)} required>
              {manageableTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            Email
            <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            Role
            <select className="input" value={role} onChange={(event) => setRole(event.target.value as (typeof ROLES)[number])}>
              {ROLES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>

          <button className="btn-primary" type="submit" disabled={creating || manageableTeams.length === 0}>
            <Plus size={16} />
            {creating ? 'Creating...' : 'Create invitation'}
          </button>
        </form>

        <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>Pending invitations</h2>
              <p style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {selectedTeam?.name ?? 'No team selected'}
              </p>
            </div>
            <span className="mono" style={{ color: 'var(--accent-blue)', fontWeight: 800 }}>{invitations.length}</span>
          </div>

          {loading ? (
            <div style={{ padding: '1.25rem', color: 'var(--text-muted)' }}>Loading invitations...</div>
          ) : invitations.length === 0 ? (
            <div style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.86rem' }}>No pending invitations.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {invitations.map((invitation) => (
                <div key={invitation.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', padding: '1rem 1.1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{invitation.email}</strong>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-teal-bright)', border: '1px solid var(--border-teal)', borderRadius: '999px', padding: '0.14rem 0.45rem' }}>
                        {invitation.role}
                      </span>
                    </div>
                    <div className="mono" style={{ marginTop: '0.35rem', color: 'var(--text-dim)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {invitationUrl(invitation.token)}
                    </div>
                    <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button className="btn-secondary" type="button" onClick={() => void handleCopy(invitation.token)} style={{ padding: '0.5rem' }} aria-label="Copy invitation link">
                      <Copy size={15} />
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => void handleDelete(invitation)} style={{ padding: '0.5rem', color: 'var(--accent-loss)' }} aria-label="Revoke invitation">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
