import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { apiClient, ApiErrorResponse, type Invitation } from '../api/client';

const ROLE_COLORS: Record<string, string> = {
  MANAGER: 'var(--accent-prime)',
  COACH: 'var(--accent-teal-bright)',
  ANALISTA: 'var(--accent-blue)',
  JUGADOR: 'var(--accent-win)',
  PLATFORM_ADMIN: 'var(--accent-teal-bright)',
};

function invitationUrl(token: string) {
  return `${window.location.origin}/register/${encodeURIComponent(token)}`;
}

function invitationStatus(inv: Invitation): { label: string; color: string; icon: React.ReactNode } {
  if (inv.usedAt) return { label: 'Aceptada', color: 'var(--accent-win)', icon: <CheckCircle size={13} /> };
  if (new Date(inv.expiresAt) < new Date()) return { label: 'Caducada', color: 'var(--text-muted)', icon: <XCircle size={13} /> };
  return { label: 'Pendiente', color: '#f0b429', icon: <Clock size={13} /> };
}

export default function InvitationsAdminPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'used' | 'expired'>('all');

  useEffect(() => {
    apiClient.invitations.list()
      .then((res) => setInvitations(res.invitations ?? []))
      .catch(() => toast.error('Error al cargar las invitaciones.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleRevoke(id: string) {
    try {
      await apiClient.invitations.delete(id);
      setInvitations((p) => p.filter((i) => i.id !== id));
      toast.success('Invitación revocada.');
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al revocar.');
    }
  }

  const filtered = invitations.filter((inv) => {
    if (filter === 'pending') return !inv.usedAt && new Date(inv.expiresAt) >= new Date();
    if (filter === 'used') return !!inv.usedAt;
    if (filter === 'expired') return !inv.usedAt && new Date(inv.expiresAt) < new Date();
    return true;
  });

  const pending = invitations.filter((i) => !i.usedAt && new Date(i.expiresAt) >= new Date()).length;
  const used = invitations.filter((i) => !!i.usedAt).length;
  const expired = invitations.filter((i) => !i.usedAt && new Date(i.expiresAt) < new Date()).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="header">
        <h1 className="header-title">Invitaciones</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
          Todas las invitaciones enviadas a la plataforma.
        </p>
      </header>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Pendientes', value: pending, color: '#f0b429' },
          { label: 'Aceptadas', value: used, color: 'var(--accent-win)' },
          { label: 'Caducadas', value: expired, color: 'var(--text-muted)' },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>{kpi.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)' }}>
        {(['all', 'pending', 'used', 'expired'] as const).map((f) => {
          const labels = { all: 'Todas', pending: 'Pendientes', used: 'Aceptadas', expired: 'Caducadas' };
          return (
            <button key={f} onClick={() => setFilter(f)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: filter === f ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: filter === f ? '2px solid var(--accent-blue)' : '2px solid transparent' }}>
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay invitaciones.</div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px 120px 120px 80px', gap: '1rem', padding: '0.45rem 1.25rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-color)' }}>
            <span>Email</span><span>Rol</span><span>Equipo</span><span>Enviada por</span><span>Expira</span><span>Estado</span>
          </div>
          {filtered.map((inv) => {
            const status = invitationStatus(inv);
            const isPending = !inv.usedAt && new Date(inv.expiresAt) >= new Date();
            return (
              <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px 120px 120px 80px', gap: '1rem', alignItems: 'center', padding: '0.65rem 1.25rem', borderBottom: '1px solid var(--border-color)', opacity: inv.usedAt || new Date(inv.expiresAt) < new Date() ? 0.6 : 1 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</p>
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: ROLE_COLORS[inv.role] ?? 'var(--text-muted)', border: `1px solid ${ROLE_COLORS[inv.role] ?? 'var(--border-color)'}`, borderRadius: '999px', padding: '0.1rem 0.45rem', whiteSpace: 'nowrap' }}>
                  {inv.role}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.teamId ? inv.teamId.slice(0, 16) + '…' : '—'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.invitedBy?.name ?? '—'}
                </span>
                <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: status.color }}>
                    {status.icon} {status.label}
                  </span>
                  {isPending && (
                    <div style={{ display: 'flex', gap: '0.2rem', marginLeft: 'auto' }}>
                      <button onClick={() => { void navigator.clipboard?.writeText(invitationUrl(inv.token)); toast.success('Copiado'); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)', padding: '0.2rem', display: 'flex' }}>
                        <Copy size={13} />
                      </button>
                      <button onClick={() => void handleRevoke(inv.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-loss)', padding: '0.2rem', display: 'flex' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
