import { useEffect, useState } from 'react';
import { Edit2, Shield, CheckCircle, XCircle, UserPlus, X, Save, Star } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiErrorResponse } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface PlatformUser {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  isActive: boolean;
  playerTier: string;
  playerTierExpiresAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  memberships: Array<{ id: string; role: string; team: { id: string; name: string; type: string; teamTier: string } }>;
}

const PLAYER_TIER_COLORS: Record<string, string> = {
  FREE: 'var(--text-muted)', PRO: 'var(--accent-blue)', PREMIUM: 'var(--accent-prime)',
};

const TEAM_TIER_COLORS: Record<string, string> = {
  FREE: 'var(--text-muted)', PRO: 'var(--accent-blue)',
  TEAM: 'var(--accent-teal-bright)', ENTERPRISE: 'var(--accent-prime)',
};

const ROLE_COLORS: Record<string, string> = {
  MANAGER: 'var(--accent-teal-bright)', COACH: 'var(--accent-blue)',
  ANALISTA: 'var(--accent-violet)', JUGADOR: 'var(--accent-prime)',
};

export default function UsersPage() {
  const { user: me, internalLoading } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [editUser, setEditUser] = useState<PlatformUser | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editTierExpiry, setEditTierExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = !internalLoading && !!me && me.globalRole === 'PLATFORM_ADMIN';

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    (apiClient as any).admin.users()
      .then((res: { users: PlatformUser[] }) => setUsers(res.users))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (internalLoading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Checking session...</div>;
  if (!me || me.globalRole !== 'PLATFORM_ADMIN') {
    return (
      <div style={{ maxWidth: '480px' }}>
        <div className="glass-card" style={{ display: 'grid', gap: '1rem' }}>
          <Shield size={34} style={{ color: 'var(--accent-loss)' }} />
          <h1 className="header-title">User Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Requiere cuenta Platform Admin.</p>
          <a className="btn-primary" href="/login" style={{ width: 'fit-content' }}>Login</a>
        </div>
      </div>
    );
  }

  function openEdit(u: PlatformUser) {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.globalRole);
    setEditTier(u.playerTier ?? 'FREE');
    setEditActive(u.isActive);
    setEditTierExpiry(u.playerTierExpiresAt ? u.playerTierExpiresAt.slice(0, 10) : '');
  }

  async function saveEdit() {
    if (!editUser) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editName !== editUser.name) payload.name = editName;
      if (editEmail !== editUser.email) payload.email = editEmail;
      if (editRole !== editUser.globalRole) payload.globalRole = editRole;
      if (editTier !== editUser.playerTier) payload.playerTier = editTier;
      if (editActive !== editUser.isActive) payload.isActive = editActive;
      if (editTierExpiry !== (editUser.playerTierExpiresAt?.slice(0, 10) ?? '')) {
        payload.playerTierExpiresAt = editTierExpiry ? new Date(editTierExpiry).toISOString() : null;
      }

      if (Object.keys(payload).length === 0) { setEditUser(null); return; }

      const res = await (apiClient as any).admin.updateUser(editUser.id, payload);
      setUsers((prev) => prev.map((u) => u.id === editUser.id ? { ...u, ...res.user } : u));
      setEditUser(null);
      toast.success('Usuario actualizado');
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="header-title">User Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
            Todos los usuarios de la plataforma — edita nombre, email, rol y tier.
          </p>
        </div>
        <a href="/management/staff" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
          <UserPlus size={14} /> Invitar usuario
        </a>
      </header>

      {loading ? (
        <div style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>Cargando usuarios...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Header row */}
          <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 150px 100px 80px', gap: '1rem', padding: '0.45rem 1.25rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span>Usuario</span><span>Rol global</span><span>Player Tier</span><span>Membresías</span><span>Último login</span><span>Acciones</span>
          </div>

          {users.map((u) => (
            <div key={u.id} className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 150px 100px 80px', gap: '1rem', alignItems: 'center', opacity: u.isActive ? 1 : 0.5 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                  {!u.isActive && <span style={{ fontSize: '0.62rem', color: 'var(--accent-loss)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 999, padding: '0.1rem 0.4rem' }}>INACTIVO</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{u.email}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: u.globalRole === 'PLATFORM_ADMIN' ? 'var(--accent-teal-bright)' : 'var(--text-muted)', background: u.globalRole === 'PLATFORM_ADMIN' ? 'rgba(56,212,200,0.1)' : 'transparent', border: u.globalRole === 'PLATFORM_ADMIN' ? '1px solid rgba(56,212,200,0.3)' : '1px solid var(--border-color)', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                  {u.globalRole === 'PLATFORM_ADMIN' ? 'ADMIN' : 'VIEWER'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: PLAYER_TIER_COLORS[u.playerTier ?? 'FREE'] ?? 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Star size={10} style={{ color: PLAYER_TIER_COLORS[u.playerTier ?? 'FREE'] }} /> {u.playerTier ?? 'FREE'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {u.memberships.length === 0
                  ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sin membresías</span>
                  : u.memberships.map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: ROLE_COLORS[m.role] ?? 'var(--text-muted)', flexShrink: 0 }}>{m.role}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.team.name}</span>
                    </div>
                  ))
                }
              </div>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : '—'}
              </span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button onClick={() => openEdit(u)} className="btn-secondary" style={{ padding: '0.35rem' }} title="Editar usuario">
                  <Edit2 size={13} style={{ color: 'var(--accent-blue)' }} />
                </button>
                <button
                  onClick={async () => {
                    try {
                      await (apiClient as any).admin.updateUser(u.id, { isActive: !u.isActive });
                      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
                      toast.success(u.isActive ? 'Usuario desactivado' : 'Usuario activado');
                    } catch (err) { toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error'); }
                  }}
                  disabled={u.id === me.id} className="btn-secondary" style={{ padding: '0.35rem', opacity: u.id === me.id ? 0.3 : 1 }} title={u.isActive ? 'Desactivar' : 'Activar'}>
                  {u.isActive ? <XCircle size={13} style={{ color: 'var(--accent-loss)' }} /> : <CheckCircle size={13} style={{ color: 'var(--accent-win)' }} />}
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && !loading && (
            <div className="glass-card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No hay usuarios registrados aún.</div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditUser(null); }}>
          <div className="glass-card" style={{ width: 440, padding: '1.5rem', position: 'relative' }}>
            <button onClick={() => setEditUser(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>

            <h2 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', fontWeight: 800 }}>Editar usuario</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {[
                { label: 'Nombre', value: editName, set: setEditName, type: 'text' },
                { label: 'Email', value: editEmail, set: setEditEmail, type: 'email' },
              ].map(({ label, value, set, type }) => (
                <div key={label}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>{label}</label>
                  <input type={type} value={value} onChange={(e) => set(e.target.value)}
                    style={{ width: '100%', padding: '0.42rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Rol global</label>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                    <option value="VIEWER">Viewer</option>
                    <option value="PLATFORM_ADMIN">Platform Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Tier</label>
                  <select value={editTier} onChange={(e) => setEditTier(e.target.value)}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                    {['FREE', 'PRO', 'PREMIUM'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {editTier !== 'FREE' && (
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Expira el (opcional)</label>
                  <input type="date" value={editTierExpiry} onChange={(e) => setEditTierExpiry(e.target.value)}
                    style={{ padding: '0.42rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: editUser.id !== me.id ? 'pointer' : 'not-allowed', fontSize: '0.82rem', color: editUser.id !== me.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} disabled={editUser.id === me.id} />
                Cuenta activa
              </label>

              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button onClick={() => setEditUser(null)} className="btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
                <button onClick={saveEdit} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <Save size={13} /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
