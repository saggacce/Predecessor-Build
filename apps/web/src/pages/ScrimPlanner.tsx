import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, PlusCircle, Trash2, CheckCircle, Clock, Shield, AlertTriangle, Edit2, Check, X, ExternalLink, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiErrorResponse, type ScrimScheduleItem, type TeamProfile } from '../api/client';
import { useAuth } from '../hooks/useAuth';

const TYPE_LABEL: Record<string, string> = { SCRIM: 'Scrim', OFFICIAL: 'Oficial', PRACTICE: 'Practice' };
const TYPE_COLOR: Record<string, string> = {
  SCRIM: 'var(--accent-blue)',
  OFFICIAL: 'var(--accent-loss)',
  PRACTICE: 'var(--text-muted)',
};
const RESULT_COLOR: Record<string, string> = {
  WIN: 'var(--accent-win)',
  LOSS: 'var(--accent-loss)',
  DRAW: 'var(--accent-prime)',
};

export default function ScrimPlanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ownTeams, setOwnTeams] = useState<TeamProfile[]>([]);
  const [rivalTeams, setRivalTeams] = useState<TeamProfile[]>([]);
  const [teamId, setTeamId] = useState('');
  const [items, setItems] = useState<ScrimScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New scrim form
  const [showForm, setShowForm] = useState(false);
  const [formDt, setFormDt] = useState('');
  const [formType, setFormType] = useState<'SCRIM' | 'OFFICIAL' | 'PRACTICE'>('SCRIM');
  const [formRivalId, setFormRivalId] = useState('');
  const [formRivalName, setFormRivalName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit result inline
  const [editingResult, setEditingResult] = useState<string | null>(null);

  const isPlatformAdmin = user?.globalRole === 'PLATFORM_ADMIN';
  const canEdit = isPlatformAdmin || (user?.memberships?.some((m) => m.teamId === teamId && m.role === 'COACH') ?? false);

  useEffect(() => {
    Promise.all([
      apiClient.teams.list('OWN'),
      apiClient.teams.list('RIVAL'),
    ]).then(([own, rival]) => {
      const teams = own.teams ?? [];
      setOwnTeams(teams);
      setRivalTeams(rival.teams ?? []);
      if (teams.length > 0) setTeamId(teams[0].id);
    }).catch(() => toast.error('Error al cargar equipos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!teamId) return;
    apiClient.schedule.list(teamId)
      .then((r) => setItems(r.items))
      .catch(() => toast.error('Error al cargar el calendario'));
  }, [teamId]);

  const upcoming = items.filter((i) => new Date(i.scheduledAt) >= new Date()).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const past = items.filter((i) => new Date(i.scheduledAt) < new Date()).sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));

  async function handleCreate() {
    if (!formDt || !teamId) return;
    setSaving(true);
    try {
      const r = await apiClient.schedule.create({
        teamId,
        scheduledAt: new Date(formDt).toISOString(),
        type: formType,
        rivalTeamId: formRivalId || undefined,
        rivalName: !formRivalId && formRivalName ? formRivalName : undefined,
        notes: formNotes || undefined,
      });
      setItems((prev) => [...prev, r.item]);
      toast.success('Scrim añadido');
      setShowForm(false);
      setFormDt(''); setFormType('SCRIM'); setFormRivalId(''); setFormRivalName(''); setFormNotes('');
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.schedule.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('Eliminado');
    } catch { toast.error('Error al eliminar'); }
  }

  async function handleSetResult(id: string, result: 'WIN' | 'LOSS' | 'DRAW' | null) {
    try {
      const r = await apiClient.schedule.update(id, { result });
      setItems((prev) => prev.map((i) => i.id === id ? r.item : i));
      setEditingResult(null);
    } catch { toast.error('Error al actualizar'); }
  }

  async function handleSetStatus(id: string, status: 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO') {
    try {
      const r = await apiClient.schedule.update(id, { status });
      setItems((prev) => prev.map((i) => i.id === id ? r.item : i));
      toast.success(status === 'CANCELADO' ? 'Partido cancelado' : status === 'CONFIRMADO' ? 'Confirmado' : 'Marcado como pendiente');
    } catch { toast.error('Error al actualizar'); }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="header" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Calendar size={22} style={{ color: 'var(--accent-blue)' }} />
          <div>
            <h1 className="header-title">Scrim Planner</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.1rem' }}>
              Calendario de scrims y partidas oficiales
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {ownTeams.length > 1 && (
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
              style={{ fontSize: '0.85rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '0.4rem 0.75rem', color: 'var(--text-primary)' }}>
              {ownTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <button
            onClick={() => navigate('/tools/review-sessions')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.38rem 0.75rem', fontWeight: 600 }}
            title="Ver sesiones de revisión"
          >
            <ClipboardList size={14} /> Review Sessions
          </button>
        </div>
      </header>

      {/* New scrim button / form */}
      {canEdit && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <PlusCircle size={15} /> Añadir scrim
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Nuevo scrim</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                {/* Date */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Fecha y hora</label>
                  <input type="datetime-local" value={formDt} onChange={(e) => setFormDt(e.target.value)}
                    style={{ width: '100%', fontSize: '0.82rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, padding: '0.4rem 0.6rem', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                </div>

                {/* Type */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Tipo</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value as typeof formType)}
                    style={{ width: '100%', fontSize: '0.82rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, padding: '0.4rem 0.6rem', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                    <option value="SCRIM">Scrim</option>
                    <option value="OFFICIAL">Partido oficial</option>
                    <option value="PRACTICE">Practice</option>
                  </select>
                </div>

                {/* Rival — from DB or free text */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Rival</label>
                  <select value={formRivalId} onChange={(e) => { setFormRivalId(e.target.value); if (e.target.value) setFormRivalName(''); }}
                    style={{ width: '100%', fontSize: '0.82rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, padding: '0.4rem 0.6rem', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                    <option value="">— Rival libre —</option>
                    {rivalTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {/* Free text rival name when not in DB */}
                {!formRivalId && (
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Nombre del rival</label>
                    <input placeholder="ej: Team Alpha" value={formRivalName} onChange={(e) => setFormRivalName(e.target.value)}
                      style={{ width: '100%', fontSize: '0.82rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, padding: '0.4rem 0.6rem', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Notas (opcional)</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Focus del scrim, estrategias a probar…"
                  style={{ width: '100%', fontSize: '0.82rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, padding: '0.4rem 0.6rem', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => void handleCreate()} disabled={saving || !formDt} className="btn-primary" style={{ fontSize: '0.82rem' }}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button onClick={() => { setShowForm(false); setFormDt(''); setFormRivalId(''); setFormRivalName(''); setFormNotes(''); }}
                  className="btn-secondary" style={{ fontSize: '0.82rem' }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upcoming */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Clock size={14} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Próximos ({upcoming.length})</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No hay scrims programados
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {upcoming.map((item) => <ScrimCard key={item.id} item={item} canEdit={canEdit} onDelete={handleDelete} onSetResult={handleSetResult} onSetStatus={handleSetStatus} editingResult={editingResult} setEditingResult={setEditingResult} />)}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <CheckCircle size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Historial ({past.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {past.slice(0, 10).map((item) => <ScrimCard key={item.id} item={item} canEdit={canEdit} onDelete={handleDelete} onSetResult={handleSetResult} onSetStatus={handleSetStatus} editingResult={editingResult} setEditingResult={setEditingResult} isPast />)}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Scrim card ────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  PENDIENTE:  'var(--text-muted)',
  CONFIRMADO: 'var(--accent-win)',
  CANCELADO:  'var(--accent-loss)',
};
const STATUS_LABEL: Record<string, string> = {
  PENDIENTE:  'Pendiente',
  CONFIRMADO: 'Confirmado',
  CANCELADO:  'Cancelado',
};

function ScrimCard({ item, canEdit, onDelete, onSetResult, onSetStatus, editingResult, setEditingResult, isPast = false }: {
  item: ScrimScheduleItem;
  canEdit: boolean;
  onDelete: (id: string) => void;
  onSetResult: (id: string, result: 'WIN' | 'LOSS' | 'DRAW' | null) => void;
  onSetStatus: (id: string, status: 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO') => void;
  editingResult: string | null;
  setEditingResult: (id: string | null) => void;
  isPast?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const date = new Date(item.scheduledAt);
  const rival = item.rivalTeam?.name ?? item.rivalName ?? 'Rival por confirmar';
  const typeColor = TYPE_COLOR[item.type] ?? 'var(--text-muted)';
  const status = item.status ?? 'PENDIENTE';
  const isCancelled = status === 'CANCELADO';

  return (
    <div className="glass-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', opacity: isCancelled ? 0.45 : isPast && !item.result ? 0.65 : 1 }}>
      {/* Date block */}
      <div style={{ textAlign: 'center', minWidth: 42, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{date.getDate()}</div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {date.toLocaleString(undefined, { month: 'short' })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 36, background: 'var(--border-color)', flexShrink: 0 }} />

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>vs {rival}</span>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: typeColor, border: `1px solid ${typeColor}44`, borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {TYPE_LABEL[item.type]}
          </span>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: STATUS_COLOR[status], border: `1px solid ${STATUS_COLOR[status]}44`, borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {STATUS_LABEL[status]}
          </span>
          {item.result && (
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: RESULT_COLOR[item.result], background: `${RESULT_COLOR[item.result]}18`, borderRadius: 3, padding: '1px 6px' }}>
              {item.result}
            </span>
          )}
          {item.predggMatchId && (
            <a
              href={`https://pred.gg/matches/${item.predggMatchId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver partida en pred.gg"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.62rem', color: 'var(--text-muted)', textDecoration: 'none', opacity: 0.7 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} /> pred.gg
            </a>
          )}
        </div>
        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          {date.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          {item.rivalTeam && <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>· <Shield size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> en BD</span>}
        </div>
        {item.notes && (
          <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontStyle: 'italic' }}>{item.notes}</div>
        )}
      </div>

      {/* Actions */}
      {canEdit && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
          {/* Confirm / Cancel status — only for upcoming */}
          {!isPast && !isCancelled && status !== 'CONFIRMADO' && (
            <button onClick={() => onSetStatus(item.id, 'CONFIRMADO')} title="Confirmar partido"
              style={{ background: 'none', border: '1px solid var(--accent-win)', borderRadius: 4, cursor: 'pointer', color: 'var(--accent-win)', padding: '4px 7px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Check size={11} /> Confirmar
            </button>
          )}
          {!isPast && !isCancelled && (
            <button onClick={() => onSetStatus(item.id, 'CANCELADO')} title="Cancelar partido"
              style={{ background: 'none', border: '1px solid var(--accent-loss)44', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 7px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <X size={11} /> Cancelar
            </button>
          )}
          {isCancelled && !isPast && (
            <button onClick={() => onSetStatus(item.id, 'PENDIENTE')} title="Reactivar partido"
              style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 7px', fontSize: '0.7rem' }}>
              Reactivar
            </button>
          )}
          {/* Set result (for past or unresulted) */}
          {(isPast || !item.result) && editingResult === item.id ? (
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {(['WIN', 'LOSS', 'DRAW'] as const).map((r) => (
                <button key={r} onClick={() => onSetResult(item.id, r)}
                  style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 7px', border: `1px solid ${RESULT_COLOR[r]}`, borderRadius: 4, background: 'transparent', cursor: 'pointer', color: RESULT_COLOR[r] }}>
                  {r}
                </button>
              ))}
              <button onClick={() => setEditingResult(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}>
                <X size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingResult(item.id)} title="Registrar resultado"
              style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 7px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Edit2 size={11} /> {item.result ? 'Editar' : 'Resultado'}
            </button>
          )}
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>¿Eliminar?</span>
              <button onClick={() => { onDelete(item.id); setConfirmDelete(false); }}
                style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', border: '1px solid var(--accent-loss)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--accent-loss)' }}>
                Sí
              </button>
              <button onClick={() => setConfirmDelete(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}>
                <X size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', opacity: 0.6 }}
              title="Eliminar">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
