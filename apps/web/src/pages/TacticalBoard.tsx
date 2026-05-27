import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import TacticalBoardCanvas, { type BoardElement } from '../components/TacticalBoardCanvas';
import { apiClient, type PlaybookEntry, ApiErrorResponse } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { BookOpen, X, Check } from 'lucide-react';

// ── Save-to-Playbook modal ─────────────────────────────────────────────────────

interface SaveModalProps {
  teamId: string;
  elements: BoardElement[];
  onClose: () => void;
}

function SaveToPlaybookModal({ teamId, elements, onClose }: SaveModalProps) {
  const [entries, setEntries]       = useState<PlaybookEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [mode, setMode]             = useState<'existing' | 'new'>('existing');
  const [selectedId, setSelectedId] = useState<string>('');
  const [newTitle, setNewTitle]     = useState('');
  const [newBody, setNewBody]       = useState('');

  useEffect(() => {
    apiClient.playbook.list(teamId)
      .then(d => { setEntries(d.entries); if (d.entries.length === 0) setMode('new'); })
      .catch(() => toast.error('Error al cargar entradas'))
      .finally(() => setLoading(false));
  }, [teamId]);

  async function handleSave() {
    if (!elements.length) { toast.error('El tablero está vacío'); return; }
    const snapshot = JSON.stringify(elements);
    setSaving(true);
    try {
      if (mode === 'existing') {
        if (!selectedId) { toast.error('Selecciona una entrada'); setSaving(false); return; }
        await apiClient.playbook.update(selectedId, { mapSnapshot: snapshot });
        toast.success('Mapa guardado en la entrada del Playbook');
      } else {
        if (!newTitle.trim()) { toast.error('El título es obligatorio'); setSaving(false); return; }
        await apiClient.playbook.create({
          teamId,
          title: newTitle.trim(),
          body: newBody.trim() || ' ',
          mapSnapshot: snapshot,
        });
        toast.success('Entrada creada con el mapa en el Playbook');
      }
      onClose();
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Error al guardar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 12, padding: '1.5rem', width: 420, maxWidth: '90vw',
        maxHeight: '80vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={18} color="var(--accent-blue)" />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Guardar en Playbook
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setMode('existing')}
            disabled={entries.length === 0}
            style={{
              flex: 1, padding: '6px 0', fontSize: '0.8rem', fontWeight: 600,
              borderRadius: 6, cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
              border: `1px solid ${mode === 'existing' ? 'var(--accent-blue)' : 'var(--border-color)'}`,
              background: mode === 'existing' ? 'var(--accent-blue)22' : 'transparent',
              color: mode === 'existing' ? 'var(--accent-blue)' : 'var(--text-muted)',
              opacity: entries.length === 0 ? 0.4 : 1,
            }}
          >
            Entrada existente
          </button>
          <button
            onClick={() => setMode('new')}
            style={{
              flex: 1, padding: '6px 0', fontSize: '0.8rem', fontWeight: 600,
              borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${mode === 'new' ? 'var(--accent-blue)' : 'var(--border-color)'}`,
              background: mode === 'new' ? 'var(--accent-blue)22' : 'transparent',
              color: mode === 'new' ? 'var(--accent-blue)' : 'var(--text-muted)',
            }}
          >
            Nueva entrada
          </button>
        </div>

        {loading && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
            Cargando entradas...
          </p>
        )}

        {/* Existing entries list */}
        {!loading && mode === 'existing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 260, overflowY: 'auto' }}>
            {entries.length === 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                No hay entradas en el playbook. Crea una nueva.
              </p>
            )}
            {entries.map(e => (
              <label key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.5rem 0.75rem',
                border: `1px solid ${selectedId === e.id ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                borderRadius: 7,
                background: selectedId === e.id ? 'var(--accent-blue)11' : 'var(--bg-secondary)',
                cursor: 'pointer',
              }}>
                <input
                  type="radio"
                  name="entry"
                  value={e.id}
                  checked={selectedId === e.id}
                  onChange={() => setSelectedId(e.id)}
                  style={{ accentColor: 'var(--accent-blue)' }}
                />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{e.title}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {e.category}{e.mapSnapshot ? ' · 🗺 tiene mapa' : ''}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* New entry form */}
        {!loading && mode === 'new' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Título de la entrada..."
              maxLength={200}
              autoFocus
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 6, padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
                fontSize: '0.88rem', fontWeight: 600, outline: 'none',
              }}
            />
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="Descripción opcional..."
              maxLength={5000}
              rows={3}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 6, padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
                fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none',
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '7px 16px', fontSize: '0.82rem', background: 'none',
            border: '1px solid var(--border-color)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '7px 16px', fontSize: '0.82rem' }}
          >
            <Check size={14} />
            {saving ? 'Guardando...' : 'Guardar mapa'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TacticalBoard() {
  const { user, internalLoading } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams]                   = useState<{ id: string; name: string }[]>([]);
  const [teamId, setTeamId]                 = useState<string>('');
  const [boardElements, setBoardElements]   = useState<BoardElement[]>([]);
  const [initialElements, setInitialElements] = useState<BoardElement[] | undefined>(undefined);
  const [showSaveModal, setShowSaveModal]   = useState(false);

  // Check sessionStorage for a snapshot to preload (set by Playbook "Abrir en tablero")
  useEffect(() => {
    const preload = sessionStorage.getItem('tacboard_preload');
    if (preload) {
      try {
        const els = JSON.parse(preload) as BoardElement[];
        setInitialElements(els);
      } catch { /* ignore malformed data */ }
      sessionStorage.removeItem('tacboard_preload');
    }
  }, []);

  useEffect(() => {
    if (internalLoading || !user) return;
    apiClient.teams.list('OWN')
      .then(r => {
        const list = r.teams ?? [];
        setTeams(list);
        if (list.length > 0) setTeamId(list[0].id);
      })
      .catch(() => {});
  }, [internalLoading, user]);

  // canEdit — only staff roles can save to playbook
  const isPlatformAdmin = user?.globalRole === 'PLATFORM_ADMIN';
  const membership = user?.memberships?.find(m => m.teamId === teamId);
  const role = isPlatformAdmin ? 'PLATFORM_ADMIN' : (membership?.role ?? '');
  const canSaveToPlaybook = ['MANAGER', 'COACH', 'ANALISTA', 'PLATFORM_ADMIN'].includes(role);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Tactical Board
          </h1>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
            Doble clic en un token de rol para asignar jugador y héroe · Ctrl+Z para deshacer · Del para eliminar seleccionado
          </p>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {teams.length > 0 && (
            <>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Equipo:</span>
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', borderRadius: 6, padding: '4px 8px',
                  fontSize: '0.82rem', cursor: 'pointer',
                }}
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </>
          )}

          {canSaveToPlaybook && teamId && (
            <button
              onClick={() => setShowSaveModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600,
                border: '1px solid var(--accent-blue)', borderRadius: 7,
                background: 'var(--accent-blue)18', color: 'var(--accent-blue)',
                cursor: 'pointer',
              }}
            >
              <BookOpen size={13} />
              Guardar en Playbook
            </button>
          )}
        </div>
      </div>

      {/* Canvas — fills remaining space using absolute positioning to avoid ResizeObserver loop */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', padding: '0.75rem' }}>
        <TacticalBoardCanvas
          teamId={teamId || undefined}
          style={{ position: 'absolute', inset: '0.75rem', borderRadius: 8 }}
          initialElements={initialElements}
          onElementsChange={setBoardElements}
        />
      </div>

      {/* Save-to-Playbook modal */}
      {showSaveModal && teamId && (
        <SaveToPlaybookModal
          teamId={teamId}
          elements={boardElements}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
