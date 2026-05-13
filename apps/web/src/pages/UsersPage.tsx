import { useEffect, useState } from 'react';
import { Shield, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiErrorResponse } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface PlatformUser {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  memberships: Array<{ id: string; role: string; team: { id: string; name: string } }>;
}

export default function UsersPage() {
  const { user: me, internalLoading } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await (apiClient as any).admin.users() as { users: PlatformUser[] };
      setUsers(res.users);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void fetchUsers(); }, []);

  async function toggleActive(userId: string, current: boolean) {
    try {
      await (apiClient as any).admin.updateUser(userId, { isActive: !current });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: !current } : u));
      toast.success(current ? 'Usuario desactivado' : 'Usuario activado');
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error');
    }
  }

  async function toggleAdmin(userId: string, current: string) {
    const newRole = current === 'PLATFORM_ADMIN' ? 'VIEWER' : 'PLATFORM_ADMIN';
    try {
      await (apiClient as any).admin.updateUser(userId, { globalRole: newRole });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, globalRole: newRole } : u));
      toast.success(`Rol cambiado a ${newRole}`);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error');
    }
  }

  const ROLE_COLORS: Record<string, string> = {
    MANAGER: 'var(--accent-teal-bright)', COACH: 'var(--accent-blue)',
    ANALISTA: 'var(--accent-violet)', JUGADOR: 'var(--accent-prime)',
  };

  return (
    <div>
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="header-title">User Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
            Todos los usuarios de la plataforma, sus roles y membresías.
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
          <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 100px 80px', gap: '1rem', padding: '0.45rem 1.25rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span>Usuario</span><span>Rol global</span><span>Membresías</span><span>Último login</span><span>Acciones</span>
          </div>
          {users.map((u) => (
            <div key={u.id} className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 100px 80px', gap: '1rem', alignItems: 'center', opacity: u.isActive ? 1 : 0.5 }}>
              {/* Name + email */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                  {!u.isActive && <span style={{ fontSize: '0.62rem', color: 'var(--accent-loss)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 999, padding: '0.1rem 0.4rem' }}>INACTIVO</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{u.email}</div>
              </div>
              {/* Global role */}
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: u.globalRole === 'PLATFORM_ADMIN' ? 'var(--accent-teal-bright)' : 'var(--text-muted)', background: u.globalRole === 'PLATFORM_ADMIN' ? 'rgba(56,212,200,0.1)' : 'transparent', border: u.globalRole === 'PLATFORM_ADMIN' ? '1px solid rgba(56,212,200,0.3)' : '1px solid var(--border-color)', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                  {u.globalRole === 'PLATFORM_ADMIN' ? 'ADMIN' : 'VIEWER'}
                </span>
              </div>
              {/* Memberships */}
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
              {/* Last login */}
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : '—'}
              </span>
              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  onClick={() => void toggleActive(u.id, u.isActive)}
                  disabled={u.id === me.id}
                  className="btn-secondary"
                  style={{ padding: '0.35rem', opacity: u.id === me.id ? 0.3 : 1 }}
                  title={u.isActive ? 'Desactivar' : 'Activar'}
                >
                  {u.isActive ? <XCircle size={13} style={{ color: 'var(--accent-loss)' }} /> : <CheckCircle size={13} style={{ color: 'var(--accent-win)' }} />}
                </button>
                <button
                  onClick={() => void toggleAdmin(u.id, u.globalRole)}
                  disabled={u.id === me.id}
                  className="btn-secondary"
                  style={{ padding: '0.35rem', opacity: u.id === me.id ? 0.3 : 1 }}
                  title={u.globalRole === 'PLATFORM_ADMIN' ? 'Quitar admin' : 'Hacer admin'}
                >
                  <Shield size={13} style={{ color: u.globalRole === 'PLATFORM_ADMIN' ? 'var(--accent-teal-bright)' : 'var(--text-muted)' }} />
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && !loading && (
            <div className="glass-card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No hay usuarios registrados aún.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
