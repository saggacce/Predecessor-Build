import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, PlusCircle, Pin, PinOff, Pencil, Trash2, X, Check, ChevronDown, ChevronUp, Filter, Map as MapIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiErrorResponse, type PlaybookEntry, type PlaybookPhase, type PlaybookRole } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import TacticalBoardCanvas from '../components/TacticalBoardCanvas';

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<PlaybookPhase, string> = {
  ALL:   'Toda la partida',
  EARLY: 'Early Game',
  MID:   'Mid Game',
  LATE:  'Late Game',
};

const PHASE_COLOR: Record<PlaybookPhase, string> = {
  ALL:   'var(--text-muted)',
  EARLY: '#4ade80',
  MID:   '#facc15',
  LATE:  '#f87171',
};

const ROLE_LABEL: Record<PlaybookRole, string> = {
  CARRY:   'Carry',
  JUNGLE:  'Jungle',
  MIDLANE: 'Mid',
  OFFLANE: 'Off',
  SUPPORT: 'Support',
};

const ALL_ROLES: PlaybookRole[] = ['CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE', 'SUPPORT'];
const ALL_PHASES: PlaybookPhase[] = ['ALL', 'EARLY', 'MID', 'LATE'];

const SUGGESTED_CATEGORIES = [
  'General', 'Rotaciones', 'Objetivos', 'Draft', 'Early Game',
  'Team Fight', 'Win Conditions', 'Comunicación', 'Vision',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntryFormState {
  title: string;
  body: string;
  category: string;
  phase: PlaybookPhase;
  roles: PlaybookRole[];
  pinned: boolean;
}

const EMPTY_FORM: EntryFormState = {
  title: '', body: '', category: 'General', phase: 'ALL', roles: [], pinned: false,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: PlaybookRole }) {
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px',
      border: '1px solid var(--border-color)', borderRadius: 3,
      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {ROLE_LABEL[role]}
    </span>
  );
}

function PhaseBadge({ phase }: { phase: PlaybookPhase }) {
  if (phase === 'ALL') return null;
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px',
      border: `1px solid ${PHASE_COLOR[phase]}55`, borderRadius: 3,
      color: PHASE_COLOR[phase], textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {PHASE_LABEL[phase]}
    </span>
  );
}

// ── Entry form (create / edit) ─────────────────────────────────────────────────

interface EntryFormProps {
  initial: EntryFormState;
  onSubmit: (form: EntryFormState) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

function EntryForm({ initial, onSubmit, onCancel, submitLabel }: EntryFormProps) {
  const [form, setForm] = useState<EntryFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [showCatSuggestions, setShowCatSuggestions] = useState(false);

  function toggleRole(role: PlaybookRole) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Título y contenido son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Title */}
      <input
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder="Título de la entrada..."
        maxLength={200}
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 6, padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
          fontSize: '0.9rem', fontWeight: 600, outline: 'none', width: '100%',
        }}
        autoFocus
      />

      {/* Body */}
      <textarea
        value={form.body}
        onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
        placeholder="Descripción, pasos, reglas... (texto libre)"
        maxLength={5000}
        rows={6}
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 6, padding: '0.6rem 0.75rem', color: 'var(--text-primary)',
          fontSize: '0.83rem', fontFamily: 'inherit', resize: 'vertical',
          outline: 'none', width: '100%', lineHeight: 1.6,
        }}
      />

      {/* Category + Phase row */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Category */}
        <div style={{ position: 'relative', flex: '1 1 160px' }}>
          <input
            value={form.category}
            onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setShowCatSuggestions(true); }}
            onFocus={() => setShowCatSuggestions(true)}
            onBlur={() => setTimeout(() => setShowCatSuggestions(false), 150)}
            placeholder="Categoría"
            maxLength={80}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              borderRadius: 6, padding: '0.4rem 0.65rem', color: 'var(--text-primary)',
              fontSize: '0.8rem', outline: 'none', width: '100%',
            }}
          />
          {showCatSuggestions && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 6, marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              {SUGGESTED_CATEGORIES.filter(c =>
                c.toLowerCase().includes(form.category.toLowerCase()) && c !== form.category
              ).slice(0, 6).map(cat => (
                <div
                  key={cat}
                  onMouseDown={() => { setForm(f => ({ ...f, category: cat })); setShowCatSuggestions(false); }}
                  style={{
                    padding: '0.4rem 0.75rem', fontSize: '0.8rem',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {cat}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phase */}
        <select
          value={form.phase}
          onChange={e => setForm(f => ({ ...f, phase: e.target.value as PlaybookPhase }))}
          style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 6, padding: '0.4rem 0.65rem', color: 'var(--text-primary)',
            fontSize: '0.8rem', outline: 'none', flex: '1 1 140px',
          }}
        >
          {ALL_PHASES.map(p => (
            <option key={p} value={p}>{PHASE_LABEL[p]}</option>
          ))}
        </select>
      </div>

      {/* Roles */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Roles:</span>
        {ALL_ROLES.map(role => (
          <button
            key={role}
            type="button"
            onClick={() => toggleRole(role)}
            style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px',
              border: `1px solid ${form.roles.includes(role) ? 'var(--accent-blue)' : 'var(--border-color)'}`,
              borderRadius: 4, background: form.roles.includes(role) ? 'var(--accent-blue)22' : 'transparent',
              color: form.roles.includes(role) ? 'var(--accent-blue)' : 'var(--text-muted)',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
          >
            {ROLE_LABEL[role]}
          </button>
        ))}
        {form.roles.length === 0 && (
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Todos</span>
        )}
      </div>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
          />
          Fijar al inicio
        </label>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button type="button" onClick={onCancel}
            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 5, padding: '5px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="btn-primary"
            style={{ padding: '5px 16px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Check size={13} /> {saving ? 'Guardando...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Entry card ────────────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: PlaybookEntry;
  canEdit: boolean;
  canOpenBoard: boolean; // staff only — players see map preview but can't open editable board
  onPin: (id: string, pinned: boolean) => void;
  onEdit: (entry: PlaybookEntry) => void;
  onDelete: (id: string) => void;
}

function EntryCard({ entry, canEdit, canOpenBoard, onPin, onEdit, onDelete }: EntryCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const preview = entry.body.slice(0, 120) + (entry.body.length > 120 ? '…' : '');

  function openInBoard() {
    sessionStorage.setItem('tacboard_preload', entry.mapSnapshot!);
    navigate('/tools/tactical-board');
  }

  return (
    <div className="glass-card" style={{ padding: '0.9rem 1.1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
        {entry.pinned && <Pin size={12} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: 3 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', flex: 1 }}>
              {entry.title}
            </span>
            {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
          </button>

          {/* Badges */}
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-prime)', border: '1px solid var(--accent-prime)44', borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase' }}>
              {entry.category}
            </span>
            <PhaseBadge phase={entry.phase} />
            {entry.roles.map(r => <RoleBadge key={r} role={r} />)}
            {entry.mapSnapshot && (
              <span title="Tiene mapa táctico adjunto" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.6rem', color: 'var(--accent-blue)', opacity: 0.8 }}>
                <MapIcon size={9} /> Mapa
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
            <button
              onClick={() => onPin(entry.id, !entry.pinned)}
              title={entry.pinned ? 'Desfijar' : 'Fijar al inicio'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px', opacity: 0.7 }}
            >
              {entry.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
            <button onClick={() => onEdit(entry)} title="Editar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px', opacity: 0.7 }}>
              <Pencil size={13} />
            </button>
            {confirmDelete ? (
              <>
                <button onClick={() => onDelete(entry.id)}
                  style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', border: '1px solid var(--accent-loss)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--accent-loss)' }}>
                  Sí
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                  <X size={13} />
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} title="Eliminar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px', opacity: 0.7 }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ marginTop: '0.55rem' }}>
        {expanded ? (
          <>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65,
              fontFamily: 'inherit', margin: 0,
            }}>
              {entry.body}
            </pre>

            {/* Map section */}
            {entry.mapSnapshot && (
              <div style={{ marginTop: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button
                    onClick={() => setShowMap(m => !m)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px',
                      border: '1px solid var(--accent-blue)', borderRadius: 5,
                      background: showMap ? 'var(--accent-blue)22' : 'transparent',
                      color: 'var(--accent-blue)', cursor: 'pointer',
                    }}
                  >
                    <MapIcon size={11} />
                    {showMap ? 'Ocultar mapa' : 'Ver mapa'}
                  </button>
                  {canOpenBoard && (
                    <button
                      onClick={openInBoard}
                      title="Abrir en Tactical Board"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px',
                        border: '1px solid var(--border-color)', borderRadius: 5,
                        background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                      }}
                    >
                      <ExternalLink size={11} />
                      Abrir en tablero
                    </button>
                  )}
                </div>

                {showMap && (
                  <div style={{ height: 260, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <TacticalBoardCanvas
                      readOnly
                      compact
                      initialElements={JSON.parse(entry.mapSnapshot)}
                      style={{ borderRadius: 8 }}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            {preview}
          </p>
        )}
      </div>

      {/* Footer */}
      {expanded && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.6 }}>
          Actualizado {new Date(entry.updatedAt).toLocaleDateString()} · {entry.createdBy.name}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Playbook() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PlaybookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState('');
  const [ownTeams, setOwnTeams] = useState<{ id: string; name: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PlaybookEntry | null>(null);

  // Filters
  const [filterPhase, setFilterPhase] = useState<PlaybookPhase | 'ALL_FILTER'>('ALL_FILTER');
  const [filterRole,  setFilterRole]  = useState<PlaybookRole | ''>('');
  const [filterCat,   setFilterCat]   = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const isPlatformAdmin = user?.globalRole === 'PLATFORM_ADMIN';
  const membership = user?.memberships?.find(m => m.teamId === teamId);
  const role = isPlatformAdmin ? 'PLATFORM_ADMIN' : (membership?.role ?? '');

  const canEdit      = ['MANAGER', 'COACH', 'ANALISTA', 'PLATFORM_ADMIN'].includes(role);
  const canDelete    = ['MANAGER', 'COACH', 'PLATFORM_ADMIN'].includes(role);
  const canOpenBoard = canEdit; // same staff roles — players see map preview but not the editable board

  // ── Load teams then entries ───────────────────────────────────────────────
  useEffect(() => {
    apiClient.teams.list('OWN')
      .then(res => {
        const teams = res.teams ?? [];
        setOwnTeams(teams);
        if (teams.length > 0) setTeamId(teams[0].id);
        else setLoading(false);
      })
      .catch(() => { toast.error('Error al cargar equipos'); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    apiClient.playbook.list(teamId)
      .then(data => setEntries(data.entries))
      .catch(err => {
        const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error al cargar el playbook';
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [teamId]);

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate(form: EntryFormState) {
    try {
      const data = await apiClient.playbook.create({ teamId, ...form });
      setEntries(prev => [data.entry, ...prev].sort(sortEntries));
      setShowCreate(false);
      toast.success('Entrada añadida al playbook');
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error al crear';
      toast.error(msg);
      throw err;
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async function handleUpdate(form: EntryFormState) {
    if (!editingEntry) return;
    try {
      const data = await apiClient.playbook.update(editingEntry.id, form);
      setEntries(prev => prev.map(e => e.id === editingEntry.id ? data.entry : e).sort(sortEntries));
      setEditingEntry(null);
      toast.success('Entrada actualizada');
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error al actualizar';
      toast.error(msg);
      throw err;
    }
  }

  // ── Pin toggle ────────────────────────────────────────────────────────────
  async function handlePin(id: string, pinned: boolean) {
    try {
      const data = await apiClient.playbook.update(id, { pinned });
      setEntries(prev => prev.map(e => e.id === id ? data.entry : e).sort(sortEntries));
    } catch {
      toast.error('Error al fijar entrada');
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    try {
      await apiClient.playbook.delete(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entrada eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  }

  // ── Filtering + grouping ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterPhase !== 'ALL_FILTER' && e.phase !== filterPhase) return false;
      if (filterRole && !e.roles.includes(filterRole as PlaybookRole) && e.roles.length > 0) return false;
      if (filterCat && !e.category.toLowerCase().includes(filterCat.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterPhase, filterRole, filterCat]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlaybookEntry[]>();
    for (const e of filtered) {
      const cat = e.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(e);
    }
    // Pinned entries first within each category
    for (const [cat, list] of map) {
      map.set(cat, list.sort(sortEntries));
    }
    return map;
  }, [filtered]);

  const categories = useMemo(() => [...new Set(entries.map(e => e.category))], [entries]);
  const activeFilters = (filterPhase !== 'ALL_FILTER' ? 1 : 0) + (filterRole ? 1 : 0) + (filterCat ? 1 : 0);

  if (!loading && !teamId) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
        Necesitas pertenecer a un equipo para ver el Playbook.
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BookOpen size={22} color="var(--accent-blue)" />
          <h1 className="header-title">Playbook</h1>
          {ownTeams.length > 1 && (
            <select
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 6, padding: '3px 8px', color: 'var(--text-primary)',
                fontSize: '0.78rem', outline: 'none',
              }}
            >
              {ownTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              background: 'none', border: `1px solid ${activeFilters ? 'var(--accent-blue)' : 'var(--border-color)'}`,
              borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
              color: activeFilters ? 'var(--accent-blue)' : 'var(--text-muted)',
              fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            <Filter size={13} />
            Filtros {activeFilters > 0 && `(${activeFilters})`}
          </button>
          {canEdit && !showCreate && (
            <button onClick={() => { setShowCreate(true); setEditingEntry(null); }} className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '6px 14px', fontSize: '0.82rem' }}>
              <PlusCircle size={15} /> Nueva entrada
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="glass-card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Phase filter */}
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fase:</span>
            {(['ALL_FILTER', ...ALL_PHASES] as const).map(p => (
              <button key={p} onClick={() => setFilterPhase(p)}
                style={{
                  fontSize: '0.67rem', fontWeight: 600, padding: '2px 8px',
                  border: `1px solid ${filterPhase === p ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                  borderRadius: 4, background: filterPhase === p ? 'var(--accent-blue)22' : 'transparent',
                  color: filterPhase === p ? 'var(--accent-blue)' : 'var(--text-muted)', cursor: 'pointer',
                }}>
                {p === 'ALL_FILTER' ? 'Todas' : PHASE_LABEL[p]}
              </button>
            ))}
          </div>

          {/* Role filter */}
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rol:</span>
            <button onClick={() => setFilterRole('')}
              style={{
                fontSize: '0.67rem', padding: '2px 8px', fontWeight: 600,
                border: `1px solid ${!filterRole ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                borderRadius: 4, background: !filterRole ? 'var(--accent-blue)22' : 'transparent',
                color: !filterRole ? 'var(--accent-blue)' : 'var(--text-muted)', cursor: 'pointer',
              }}>Todos</button>
            {ALL_ROLES.map(r => (
              <button key={r} onClick={() => setFilterRole(filterRole === r ? '' : r)}
                style={{
                  fontSize: '0.67rem', padding: '2px 8px', fontWeight: 600,
                  border: `1px solid ${filterRole === r ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                  borderRadius: 4, background: filterRole === r ? 'var(--accent-blue)22' : 'transparent',
                  color: filterRole === r ? 'var(--accent-blue)' : 'var(--text-muted)', cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                }}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          {/* Category search */}
          {categories.length > 1 && (
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cat:</span>
              <input
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                placeholder="Filtrar categoría..."
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  borderRadius: 5, padding: '2px 8px', fontSize: '0.75rem',
                  color: 'var(--text-primary)', outline: 'none', width: 130,
                }}
              />
              {filterCat && (
                <button onClick={() => setFilterCat('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create form */}
      {showCreate && canEdit && (
        <div className="glass-card" style={{ padding: '1.1rem', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Nueva entrada</h3>
          <EntryForm
            initial={EMPTY_FORM}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            submitLabel="Añadir al playbook"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0', fontSize: '0.85rem' }}>
          Cargando playbook...
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <BookOpen size={40} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>El playbook está vacío.</p>
          {canEdit && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.5rem' }}>
              Añade estrategias, setups y reglas tácticas para tu equipo.
            </p>
          )}
        </div>
      )}

      {/* No results after filter */}
      {!loading && entries.length > 0 && filtered.length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>
          Ninguna entrada coincide con los filtros.
        </div>
      )}

      {/* Grouped entries */}
      {!loading && grouped.size > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {[...grouped.entries()].map(([category, categoryEntries]) => (
            <section key={category}>
              <h2 style={{
                fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--accent-prime)',
                margin: '0 0 0.6rem', paddingBottom: '0.4rem',
                borderBottom: '1px solid var(--border-color)',
              }}>
                {category} <span style={{ opacity: 0.5, fontWeight: 400 }}>({categoryEntries.length})</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {categoryEntries.map(entry =>
                  editingEntry?.id === entry.id ? (
                    <div key={entry.id} className="glass-card" style={{ padding: '1.1rem' }}>
                      <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Editar entrada
                      </h3>
                      <EntryForm
                        initial={{
                          title:    editingEntry.title,
                          body:     editingEntry.body,
                          category: editingEntry.category,
                          phase:    editingEntry.phase,
                          roles:    editingEntry.roles,
                          pinned:   editingEntry.pinned,
                        }}
                        onSubmit={handleUpdate}
                        onCancel={() => setEditingEntry(null)}
                        submitLabel="Guardar cambios"
                      />
                    </div>
                  ) : (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      canEdit={canEdit && (canDelete || entry.createdById === user?.id)}
                      canOpenBoard={canOpenBoard}
                      onPin={handlePin}
                      onEdit={setEditingEntry}
                      onDelete={handleDelete}
                    />
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortEntries(a: PlaybookEntry, b: PlaybookEntry): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
