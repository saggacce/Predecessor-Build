import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Copy, Plus, Shield, Trash2, UserPlus, Database, ScrollText, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type Invitation, type TeamProfile, type SyncLog } from '../api/client';
import { useAuth } from '../hooks/useAuth';

const ROLES = ['MANAGER', 'COACH', 'ANALISTA', 'JUGADOR'] as const;
type AdminTab = 'staff' | 'data' | 'logs';

function invitationUrl(token: string) {
  return `${window.location.origin}/register/${token}`;
}

export default function StaffManagement() {
  const { user, internalLoading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('staff');

  if (internalLoading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Checking session...</div>;
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '560px' }}>
        <div className="glass-card" style={{ display: 'grid', gap: '1rem' }}>
          <Shield size={34} style={{ color: 'var(--accent-blue)' }} />
          <h1 className="header-title">Platform Admin</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Sign in with a PrimeSight internal account to access this section.
          </p>
          <a className="btn-primary" href="/login" style={{ width: 'fit-content' }}>Login</a>
        </div>
      </div>
    );
  }

  const isPlatformAdmin = user.globalRole === 'PLATFORM_ADMIN';

  return (
    <div>
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
        <div>
          <h1 className="header-title">Platform Admin</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
            User management, data quality and audit logs.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.7rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem' }}>
          <Shield size={13} style={{ color: isPlatformAdmin ? 'var(--accent-teal-bright)' : 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{user.name}</span>
          {isPlatformAdmin && <span style={{ fontSize: '0.65rem', color: 'var(--accent-teal-bright)', fontWeight: 700 }}>ADMIN</span>}
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        {([
          { id: 'staff', label: 'Staff & Invitations', icon: <UserPlus size={14} /> },
          { id: 'data', label: 'Data Controls', icon: <Database size={14} />, adminOnly: true },
          { id: 'logs', label: 'Audit Logs', icon: <ScrollText size={14} />, adminOnly: true },
        ] as Array<{ id: AdminTab; label: string; icon: React.ReactNode; adminOnly?: boolean }>).map(({ id, label, icon, adminOnly }) => {
          if (adminOnly && !isPlatformAdmin) return null;
          return (
            <button key={id} onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: tab === id ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: tab === id ? '2px solid var(--accent-blue)' : '2px solid transparent', transition: 'color 0.15s' }}>
              {icon}{label}
            </button>
          );
        })}
      </div>

      {tab === 'staff' && <StaffTab user={user} isPlatformAdmin={isPlatformAdmin} />}
      {tab === 'data' && isPlatformAdmin && <DataControlsTab />}
      {tab === 'logs' && isPlatformAdmin && <AuditLogsTab />}
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
      const res = await apiClient.invitations.create({ email, teamId, role });
      setInvitations((prev) => [res.invitation, ...prev]);
      setEmail('');
      setRole('COACH');
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
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
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

// ── Data Controls Tab ─────────────────────────────────────────────────────────

type OpState = 'idle' | 'running' | 'done' | 'error';

function DataControlsTab() {
  const [ops, setOps] = useState<Record<string, { state: OpState; result?: string }>>({});

  async function runOp(key: string, fn: () => Promise<string>) {
    setOps((p) => ({ ...p, [key]: { state: 'running' } }));
    try {
      const result = await fn();
      setOps((p) => ({ ...p, [key]: { state: 'done', result } }));
      toast.success(result);
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Operation failed';
      setOps((p) => ({ ...p, [key]: { state: 'error', result: msg } }));
      toast.error(msg);
    }
  }

  const controls: Array<{ key: string; label: string; desc: string; fn: () => Promise<string> }> = [
    {
      key: 'versions', label: 'Sync Versions', desc: 'Fetch all game versions from pred.gg and upsert into DB.',
      fn: async () => { const r = await apiClient.admin.syncVersions(); return `${r.synced} version${r.synced !== 1 ? 's' : ''} synced in ${(r.elapsed / 1000).toFixed(1)}s`; },
    },
    {
      key: 'stale', label: 'Sync Stale Players', desc: 'Re-sync players whose data is outdated (batch of 20).',
      fn: async () => { const r = await apiClient.admin.syncStale(); return `${r.synced} synced · ${r.skipped} skipped · ${r.errors} errors`; },
    },
    {
      key: 'incomplete', label: 'Sync Incomplete Matches', desc: 'Fetch full 10-player rosters for matches with missing MatchPlayers.',
      fn: async () => { const r = await apiClient.admin.syncIncompleteMatches(); return `${r.synced} matches synced · ${r.errors} errors`; },
    },
    {
      key: 'fixids', label: 'Fix HeroKill Player IDs', desc: 'Repair event stream records that reference pred.gg UUIDs instead of internal IDs.',
      fn: async () => { const r = await apiClient.admin.fixHeroKillPlayerIds(); return `Updated ${r.heroKillsUpdated} kills · ${r.objectiveKillsUpdated} objectives · ${r.wardEventsUpdated} wards · ${r.placeholdersCreated} placeholders created`; },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {controls.map(({ key, label, desc, fn }) => {
        const op = ops[key];
        return (
          <div key={key} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{desc}</div>
              {op?.result && (
                <div style={{ marginTop: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: op.state === 'done' ? 'var(--accent-win)' : 'var(--accent-loss)' }}>
                  {op.state === 'done' ? <CheckCircle size={11} style={{ display: 'inline', marginRight: 4 }} /> : <XCircle size={11} style={{ display: 'inline', marginRight: 4 }} />}
                  {op.result}
                </div>
              )}
            </div>
            <button
              onClick={() => void runOp(key, fn)}
              disabled={op?.state === 'running'}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <RefreshCw size={13} style={{ animation: op?.state === 'running' ? 'spin 0.8s linear infinite' : 'none' }} />
              {op?.state === 'running' ? 'Running...' : 'Run'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Audit Logs Tab ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  success: 'var(--accent-win)',
  error: 'var(--accent-loss)',
  skipped: 'var(--accent-prime)',
};

function AuditLogsTab() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await apiClient.admin.syncLogs(100, entityFilter || undefined, statusFilter || undefined);
      setLogs(res.logs);
      setTotal(res.total);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchLogs(); }, [entityFilter, statusFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filters */}
      <div className="glass-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={{ flex: '1 1 160px' }}>
          <option value="">All entities</option>
          {['player', 'match', 'version', 'auth'].map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '1 1 140px' }}>
          <option value="">All statuses</option>
          {['success', 'error', 'skipped'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {total} entries
        </span>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'clip' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 120px 120px 90px 1fr', padding: '0.35rem 1rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', position: 'sticky', top: 0 }}>
          <span>Time</span><span>Entity</span><span>Operation</span><span>Status</span><span>Details</span>
        </div>
        {loading ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No logs found.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '110px 120px 120px 90px 1fr', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', alignItems: 'start', fontSize: '0.78rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {new Date(log.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{log.entity}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{log.operation}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {log.status === 'success' ? <CheckCircle size={11} style={{ color: 'var(--accent-win)', flexShrink: 0 }} /> : log.status === 'error' ? <XCircle size={11} style={{ color: 'var(--accent-loss)', flexShrink: 0 }} /> : <AlertTriangle size={11} style={{ color: 'var(--accent-prime)', flexShrink: 0 }} />}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: STATUS_COLORS[log.status] ?? 'var(--text-muted)' }}>{log.status}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: log.error ? 'var(--accent-loss)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.error ?? log.entityId}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
