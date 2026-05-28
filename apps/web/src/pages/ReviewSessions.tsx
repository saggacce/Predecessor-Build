import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Plus, ChevronDown, ChevronRight, Check, X, Trash2,
  Clock, CheckCircle2, Circle, Edit2, ClipboardList,
  ListTodo, User, Calendar,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiClient, ApiErrorResponse } from '../api/client';
import type { ReviewSession, AgendaItem, ActionItem, ReviewSessionStatus, ActionItemStatus } from '../api/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ReviewSessionStatus, string> = {
  PENDIENTE:  'Pendiente',
  EN_CURSO:   'En curso',
  COMPLETADA: 'Completada',
};
const STATUS_COLOR: Record<ReviewSessionStatus, string> = {
  PENDIENTE:  'var(--text-muted)',
  EN_CURSO:   'var(--accent-blue)',
  COMPLETADA: 'var(--accent-win)',
};
const ACTION_STATUS_LABEL: Record<ActionItemStatus, string> = {
  ABIERTO:    'Abierto',
  EN_PROGRESO:'En progreso',
  COMPLETADO: 'Completado',
};
const ACTION_STATUS_COLOR: Record<ActionItemStatus, string> = {
  ABIERTO:    'var(--text-muted)',
  EN_PROGRESO:'var(--accent-blue)',
  COMPLETADO: 'var(--accent-win)',
};

function formatTs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Agenda item row ───────────────────────────────────────────────────────────

function AgendaRow({ item, sessionId, canEdit, onUpdated, onDeleted }: {
  item: AgendaItem;
  sessionId: string;
  canEdit: boolean;
  onUpdated: (item: AgendaItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [desc, setDesc] = useState(item.description ?? '');
  const [ts, setTs] = useState(item.vodTimestamp != null ? String(item.vodTimestamp) : '');
  const [playerRef, setPlayerRef] = useState(item.playerRef ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const tsNum = ts.trim() ? parseInt(ts, 10) : null;
      const res = await apiClient.reviewSessions.updateAgendaItem(sessionId, item.id, {
        title: title.trim() || item.title,
        description: desc.trim() || null,
        vodTimestamp: tsNum,
        playerRef: playerRef.trim() || null,
      });
      onUpdated(res.item);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleReviewed() {
    try {
      const res = await apiClient.reviewSessions.updateAgendaItem(sessionId, item.id, { reviewed: !item.reviewed });
      onUpdated(res.item);
    } catch {
      toast.error('Error al actualizar');
    }
  }

  async function handleDelete() {
    try {
      await apiClient.reviewSessions.deleteAgendaItem(sessionId, item.id);
      onDeleted(item.id);
    } catch {
      toast.error('Error al eliminar');
    }
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)' }}>
      {canEdit && (
        <button onClick={toggleReviewed} style={{ marginTop: 2, background: 'none', border: 'none', cursor: 'pointer', color: item.reviewed ? 'var(--accent-win)' : 'var(--border-color)', flexShrink: 0, padding: 0 }} title={item.reviewed ? 'Marcar como pendiente' : 'Marcar como revisado'}>
          {item.reviewed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </button>
      )}
      {!canEdit && (
        <div style={{ marginTop: 2, color: item.reviewed ? 'var(--accent-win)' : 'var(--border-color)', flexShrink: 0 }}>
          {item.reviewed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del punto"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
            />
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              rows={2}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={ts}
                onChange={(e) => setTs(e.target.value)}
                placeholder="Timestamp VOD (seg)"
                type="number"
                min={0}
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              />
              <input
                value={playerRef}
                onChange={(e) => setPlayerRef(e.target.value)}
                placeholder="Ref. jugador"
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: '0.78rem' }}>Guardar</button>
              <button onClick={() => { setEditing(false); setTitle(item.title); setDesc(item.description ?? ''); setTs(item.vodTimestamp != null ? String(item.vodTimestamp) : ''); setPlayerRef(item.playerRef ?? ''); }} className="btn-secondary" style={{ fontSize: '0.78rem' }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: item.reviewed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: item.reviewed ? 'line-through' : 'none' }}>{item.title}</div>
            {item.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{item.description}</div>}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
              {item.vodTimestamp != null && (
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Clock size={10} /> {formatTs(item.vodTimestamp)}
                </span>
              )}
              {item.playerRef && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <User size={10} /> {item.playerRef}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {canEdit && !editing && (
        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
          <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }} title="Editar">
            <Edit2 size={13} />
          </button>
          <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', opacity: 0.6 }} title="Eliminar">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Action item row ───────────────────────────────────────────────────────────

function ActionRow({ item, sessionId, canEdit, members, onUpdated, onDeleted }: {
  item: ActionItem;
  sessionId: string;
  canEdit: boolean;
  members: Array<{ id: string; name: string }>;
  onUpdated: (item: ActionItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [assignedTo, setAssignedTo] = useState(item.assignedTo ?? '');
  const [dueDate, setDueDate] = useState(item.dueDate ? item.dueDate.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiClient.reviewSessions.updateActionItem(sessionId, item.id, {
        title: title.trim() || item.title,
        assignedTo: assignedTo || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      });
      onUpdated(res.item);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function cycleStatus() {
    const next: Record<ActionItemStatus, ActionItemStatus> = { ABIERTO: 'EN_PROGRESO', EN_PROGRESO: 'COMPLETADO', COMPLETADO: 'ABIERTO' };
    try {
      const res = await apiClient.reviewSessions.updateActionItem(sessionId, item.id, { status: next[item.status] });
      onUpdated(res.item);
    } catch {
      toast.error('Error al actualizar estado');
    }
  }

  async function handleDelete() {
    try {
      await apiClient.reviewSessions.deleteActionItem(sessionId, item.id);
      onDeleted(item.id);
    } catch {
      toast.error('Error al eliminar');
    }
  }

  const statusColor = ACTION_STATUS_COLOR[item.status];

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
      <button
        onClick={canEdit ? cycleStatus : undefined}
        style={{ marginTop: 2, background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', color: statusColor, flexShrink: 0, padding: 0 }}
        title={canEdit ? `Estado: ${ACTION_STATUS_LABEL[item.status]} — clic para cambiar` : ACTION_STATUS_LABEL[item.status]}
      >
        {item.status === 'COMPLETADO' ? <CheckCircle2 size={15} /> : item.status === 'EN_PROGRESO' ? <Clock size={15} /> : <Circle size={15} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la acción"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              >
                <option value="">Sin asignar</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                type="date"
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: '0.78rem' }}>Guardar</button>
              <button onClick={() => { setEditing(false); setTitle(item.title); setAssignedTo(item.assignedTo ?? ''); setDueDate(item.dueDate ? item.dueDate.slice(0, 10) : ''); }} className="btn-secondary" style={{ fontSize: '0.78rem' }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: item.status === 'COMPLETADO' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: item.status === 'COMPLETADO' ? 'line-through' : 'none' }}>{item.title}</div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: statusColor }}>{ACTION_STATUS_LABEL[item.status]}</span>
              {item.assignee && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <User size={9} /> {item.assignee.name}
                </span>
              )}
              {item.dueDate && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Calendar size={9} /> {new Date(item.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {canEdit && !editing && (
        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
          <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }} title="Editar">
            <Edit2 size={13} />
          </button>
          <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', opacity: 0.6 }} title="Eliminar">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ session, canEdit, canDelete, members, onUpdated, onDeleted }: {
  session: ReviewSession;
  canEdit: boolean;
  canDelete: boolean;
  members: Array<{ id: string; name: string }>;
  onUpdated: (s: ReviewSession) => void;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(session.title);
  const [notesVal, setNotesVal] = useState(session.notes ?? '');
  const [editingNotes, setEditingNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Agenda
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>(session.agendaItems);
  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaDesc, setAgendaDesc] = useState('');
  const [agendaTs, setAgendaTs] = useState('');
  const [agendaPlayer, setAgendaPlayer] = useState('');
  const [savingAgenda, setSavingAgenda] = useState(false);

  // Actions
  const [actionItems, setActionItems] = useState<ActionItem[]>(session.actionItems);
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [actionAssignee, setActionAssignee] = useState('');
  const [actionDue, setActionDue] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  async function patchSession(data: Parameters<typeof apiClient.reviewSessions.update>[1]) {
    try {
      const res = await apiClient.reviewSessions.update(session.id, data);
      onUpdated(res.session);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al actualizar');
    }
  }

  async function saveTitle() {
    const t = titleVal.trim();
    if (!t || t === session.title) { setEditingTitle(false); return; }
    await patchSession({ title: t });
    setEditingTitle(false);
  }

  async function saveNotes() {
    await patchSession({ notes: notesVal.trim() || null });
    setEditingNotes(false);
  }

  async function handleAddAgenda() {
    if (!agendaTitle.trim()) return;
    setSavingAgenda(true);
    try {
      const tsNum = agendaTs.trim() ? parseInt(agendaTs, 10) : undefined;
      const res = await apiClient.reviewSessions.createAgendaItem(session.id, {
        title: agendaTitle.trim(),
        description: agendaDesc.trim() || undefined,
        vodTimestamp: tsNum,
        playerRef: agendaPlayer.trim() || undefined,
      });
      setAgendaItems((prev) => [...prev, res.item]);
      setAgendaTitle(''); setAgendaDesc(''); setAgendaTs(''); setAgendaPlayer('');
      setShowAgendaForm(false);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al añadir punto');
    } finally {
      setSavingAgenda(false);
    }
  }

  async function handleAddAction() {
    if (!actionTitle.trim()) return;
    setSavingAction(true);
    try {
      const res = await apiClient.reviewSessions.createActionItem(session.id, {
        title: actionTitle.trim(),
        assignedTo: actionAssignee || undefined,
        dueDate: actionDue ? new Date(actionDue).toISOString() : undefined,
      });
      setActionItems((prev) => [...prev, res.item]);
      setActionTitle(''); setActionAssignee(''); setActionDue('');
      setShowActionForm(false);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al añadir acción');
    } finally {
      setSavingAction(false);
    }
  }

  async function handleDelete() {
    try {
      await apiClient.reviewSessions.delete(session.id);
      onDeleted(session.id);
      toast.success('Sesión eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  }

  const status = session.status;
  const statusColor = STATUS_COLOR[status];
  const reviewedCount = agendaItems.filter((i) => i.reviewed).length;
  const openActions = actionItems.filter((i) => i.status !== 'COMPLETADO').length;

  return (
    <div className="glass-card" style={{ marginBottom: '0.75rem' }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingTitle && canEdit ? (
            <div style={{ display: 'flex', gap: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={titleVal}
                onChange={(e) => setTitleVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--accent-blue)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.25rem 0.5rem', fontSize: '0.92rem', fontWeight: 700 }}
              />
              <button onClick={saveTitle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-win)' }}><Check size={15} /></button>
              <button onClick={() => setEditingTitle(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={15} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{session.title}</span>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: statusColor, border: `1px solid ${statusColor}44`, borderRadius: 3, padding: '1px 5px' }}>
                {STATUS_LABEL[status]}
              </span>
              {session.scrim && (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  · vs {session.scrim.rivalName ?? '—'} ({new Date(session.scrim.scheduledAt).toLocaleDateString()})
                </span>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
            {session.scheduledAt && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <Calendar size={10} /> {new Date(session.scheduledAt).toLocaleString()}
              </span>
            )}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <ClipboardList size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {reviewedCount}/{agendaItems.length} revisados
            </span>
            <span style={{ fontSize: '0.7rem', color: openActions > 0 ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
              <ListTodo size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {openActions} acciones abiertas
            </span>
          </div>
        </div>

        {/* Quick status cycle + edit/delete */}
        {canEdit && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            {status !== 'EN_CURSO' && (
              <button
                onClick={() => void patchSession({ status: status === 'PENDIENTE' ? 'EN_CURSO' : 'PENDIENTE' })}
                style={{ background: 'none', border: '1px solid var(--accent-blue)', borderRadius: 4, cursor: 'pointer', color: 'var(--accent-blue)', padding: '3px 8px', fontSize: '0.68rem', fontWeight: 700 }}
              >
                {status === 'PENDIENTE' ? 'Iniciar' : 'Reabrir'}
              </button>
            )}
            {status === 'EN_CURSO' && (
              <button
                onClick={() => void patchSession({ status: 'COMPLETADA' })}
                style={{ background: 'none', border: '1px solid var(--accent-win)', borderRadius: 4, cursor: 'pointer', color: 'var(--accent-win)', padding: '3px 8px', fontSize: '0.68rem', fontWeight: 700 }}
              >
                Completar
              </button>
            )}
            <button onClick={() => setEditingTitle(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }} title="Editar título">
              <Edit2 size={14} />
            </button>
            {canDelete && (
              confirmDelete ? (
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>¿Eliminar?</span>
                  <button onClick={handleDelete} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', border: '1px solid var(--accent-loss)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--accent-loss)' }}>Sí</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}><X size={13} /></button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', opacity: 0.6 }} title="Eliminar sesión">
                  <Trash2 size={14} />
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Notes */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Notas de sesión</div>
            {editingNotes && canEdit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <textarea
                  autoFocus
                  value={notesVal}
                  onChange={(e) => setNotesVal(e.target.value)}
                  rows={4}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.5rem 0.75rem', fontSize: '0.82rem', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button onClick={saveNotes} className="btn-primary" style={{ fontSize: '0.78rem' }}>Guardar</button>
                  <button onClick={() => { setEditingNotes(false); setNotesVal(session.notes ?? ''); }} className="btn-secondary" style={{ fontSize: '0.78rem' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, fontSize: '0.82rem', color: session.notes ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: session.notes ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
                  {session.notes ?? 'Sin notas'}
                </div>
                {canEdit && (
                  <button onClick={() => setEditingNotes(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }} title="Editar notas">
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Agenda */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ClipboardList size={12} /> Agenda ({agendaItems.length})
              </div>
              {canEdit && (
                <button onClick={() => setShowAgendaForm((v) => !v)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 7px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Plus size={11} /> Añadir punto
                </button>
              )}
            </div>

            {agendaItems.length === 0 && !showAgendaForm && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin puntos en agenda</div>
            )}
            {agendaItems.map((item) => (
              <AgendaRow
                key={item.id}
                item={item}
                sessionId={session.id}
                canEdit={canEdit}
                onUpdated={(updated) => setAgendaItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))}
                onDeleted={(id) => setAgendaItems((prev) => prev.filter((i) => i.id !== id))}
              />
            ))}

            {showAgendaForm && canEdit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <input
                  autoFocus
                  value={agendaTitle}
                  onChange={(e) => setAgendaTitle(e.target.value)}
                  placeholder="Título del punto *"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
                />
                <textarea
                  value={agendaDesc}
                  onChange={(e) => setAgendaDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  rows={2}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    value={agendaTs}
                    onChange={(e) => setAgendaTs(e.target.value)}
                    placeholder="Timestamp VOD (seg)"
                    type="number"
                    min={0}
                    style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  />
                  <input
                    value={agendaPlayer}
                    onChange={(e) => setAgendaPlayer(e.target.value)}
                    placeholder="Ref. jugador"
                    style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button onClick={handleAddAgenda} disabled={savingAgenda || !agendaTitle.trim()} className="btn-primary" style={{ fontSize: '0.78rem' }}>Añadir</button>
                  <button onClick={() => { setShowAgendaForm(false); setAgendaTitle(''); setAgendaDesc(''); setAgendaTs(''); setAgendaPlayer(''); }} className="btn-secondary" style={{ fontSize: '0.78rem' }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {/* Action items */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ListTodo size={12} /> Acciones ({actionItems.length})
              </div>
              {canEdit && (
                <button onClick={() => setShowActionForm((v) => !v)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 7px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Plus size={11} /> Añadir acción
                </button>
              )}
            </div>

            {actionItems.length === 0 && !showActionForm && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin acciones</div>
            )}
            {actionItems.map((item) => (
              <ActionRow
                key={item.id}
                item={item}
                sessionId={session.id}
                canEdit={canEdit}
                members={members}
                onUpdated={(updated) => setActionItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))}
                onDeleted={(id) => setActionItems((prev) => prev.filter((i) => i.id !== id))}
              />
            ))}

            {showActionForm && canEdit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <input
                  autoFocus
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="Título de la acción *"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={actionAssignee}
                    onChange={(e) => setActionAssignee(e.target.value)}
                    style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  >
                    <option value="">Sin asignar</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input
                    value={actionDue}
                    onChange={(e) => setActionDue(e.target.value)}
                    type="date"
                    style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button onClick={handleAddAction} disabled={savingAction || !actionTitle.trim()} className="btn-primary" style={{ fontSize: '0.78rem' }}>Añadir</button>
                  <button onClick={() => { setShowActionForm(false); setActionTitle(''); setActionAssignee(''); setActionDue(''); }} className="btn-secondary" style={{ fontSize: '0.78rem' }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
            Creada por {session.createdBy.name} · {new Date(session.createdAt).toLocaleDateString()}
            {session.completedAt && ` · Completada el ${new Date(session.completedAt).toLocaleDateString()}`}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create session modal ──────────────────────────────────────────────────────

function CreateSessionModal({ teamId, scrims, onCreated, onClose }: {
  teamId: string;
  scrims: Array<{ id: string; scheduledAt: string; rivalName: string | null; type: string }>;
  onCreated: (s: ReviewSession) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [scrimId, setScrimId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.reviewSessions.create({
        teamId,
        title: title.trim(),
        notes: notes.trim() || undefined,
        scrimId: scrimId || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      onCreated(res.session);
      toast.success('Sesión creada');
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al crear sesión');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 480, padding: '1.5rem', margin: '1rem' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', color: 'var(--text-primary)' }}>Nueva sesión de revisión</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Título *</label>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); if (e.key === 'Escape') onClose(); }}
              placeholder="Ej: Revisión vs Team Alpha"
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.5rem 0.75rem', fontSize: '0.88rem', boxSizing: 'border-box' }}
            />
          </div>

          {scrims.length > 0 && (
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scrim asociado (opcional)</label>
              <select
                value={scrimId}
                onChange={(e) => setScrimId(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.5rem 0.75rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
              >
                <option value="">Sin scrim asociado</option>
                {scrims.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.scheduledAt).toLocaleDateString()} · {s.type} vs {s.rivalName ?? 'Rival'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha de sesión (opcional)</label>
            <input
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              type="datetime-local"
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.5rem 0.75rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notas iniciales (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto previo a la sesión..."
              rows={3}
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-primary)', padding: '0.5rem 0.75rem', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button onClick={handleCreate} disabled={saving || !title.trim()} className="btn-primary" style={{ fontSize: '0.85rem' }}>
              {saving ? 'Creando...' : 'Crear sesión'}
            </button>
            <button onClick={onClose} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReviewSessions() {
  const { user } = useAuth();
  const teamId = user?.memberships[0]?.teamId ?? '';
  const role = user?.memberships[0]?.role ?? user?.globalRole ?? '';

  const canEdit = ['MANAGER', 'COACH', 'ANALISTA', 'PLATFORM_ADMIN'].includes(role);
  const canDelete = ['MANAGER', 'COACH', 'PLATFORM_ADMIN'].includes(role);

  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [scrims, setScrims] = useState<Array<{ id: string; scheduledAt: string; rivalName: string | null; type: string }>>([]);

  // Derive team members from sessions (unique assignees + createdBy)
  const members = (() => {
    const map = new Map<string, string>();
    sessions.forEach((s) => {
      map.set(s.createdBy.id, s.createdBy.name);
      s.actionItems.forEach((a) => { if (a.assignee) map.set(a.assignee.id, a.assignee.name); });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  })();

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    Promise.all([
      apiClient.reviewSessions.list(teamId),
      apiClient.schedule.list(teamId),
    ]).then(([{ sessions: s }, { items }]) => {
      setSessions(s);
      setScrims(items.map((i) => ({ id: i.id, scheduledAt: i.scheduledAt, rivalName: i.rivalName, type: i.type })));
    }).catch(() => {
      toast.error('Error al cargar sesiones');
    }).finally(() => setLoading(false));
  }, [teamId]);

  if (!teamId) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Necesitas pertenecer a un equipo para acceder a las sesiones de revisión.</div>
      </div>
    );
  }

  const pending    = sessions.filter((s) => s.status === 'PENDIENTE');
  const inProgress = sessions.filter((s) => s.status === 'EN_CURSO');
  const completed  = sessions.filter((s) => s.status === 'COMPLETADA');

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 860, margin: '0 auto' }}>
      <div className="header">
        <div>
          <h1 className="header-title">Sesiones de Revisión</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Organiza revisiones de partidas con agenda y seguimiento de acciones
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Plus size={16} /> Nueva sesión
          </button>
        )}
      </div>

      {loading && (
        <div style={{ color: 'var(--text-muted)', marginTop: '2rem', fontSize: '0.9rem' }}>Cargando...</div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', marginTop: '1.5rem' }}>
          <ClipboardList size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No hay sesiones de revisión aún</div>
          {canEdit && (
            <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ marginTop: '1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={15} /> Crear primera sesión
            </button>
          )}
        </div>
      )}

      {inProgress.length > 0 && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>En curso</h2>
          {inProgress.map((s) => (
            <SessionCard key={s.id} session={s} canEdit={canEdit} canDelete={canDelete} members={members}
              onUpdated={(updated) => setSessions((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              onDeleted={(id) => setSessions((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section style={{ marginTop: inProgress.length > 0 ? '1.5rem' : '1.5rem' }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>Pendientes</h2>
          {pending.map((s) => (
            <SessionCard key={s.id} session={s} canEdit={canEdit} canDelete={canDelete} members={members}
              onUpdated={(updated) => setSessions((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              onDeleted={(id) => setSessions((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-win)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>Completadas</h2>
          {completed.map((s) => (
            <SessionCard key={s.id} session={s} canEdit={canEdit} canDelete={canDelete} members={members}
              onUpdated={(updated) => setSessions((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              onDeleted={(id) => setSessions((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </section>
      )}

      {showCreate && (
        <CreateSessionModal
          teamId={teamId}
          scrims={scrims}
          onCreated={(s) => { setSessions((prev) => [s, ...prev]); setShowCreate(false); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
