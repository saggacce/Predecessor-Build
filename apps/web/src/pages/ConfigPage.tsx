import { useEffect, useState } from 'react';
import { RotateCcw, Save, Settings, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type PlatformConfigEntry } from '../api/client';
import { invalidateConfigCache } from '../hooks/useConfig';

export default function ConfigPage() {
  const [entries, setEntries] = useState<PlatformConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'analyst' | 'display'>('analyst');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    apiClient.admin.getConfig()
      .then(({ config }) => { setEntries(config); setLoading(false); })
      .catch(() => { toast.error('Error cargando configuración'); setLoading(false); });
  }, []);

  const visible = entries.filter((e) => e.group === tab);

  function getDraft(entry: PlatformConfigEntry): string {
    return drafts[entry.key] ?? String(entry.value);
  }

  function setDraft(key: string, val: string) {
    setDrafts((d) => ({ ...d, [key]: val }));
  }

  function isDirty(entry: PlatformConfigEntry) {
    return drafts[entry.key] !== undefined && Number(drafts[entry.key]) !== entry.value;
  }

  function isAtDefault(entry: PlatformConfigEntry) {
    return entry.value === entry.defaultValue;
  }

  async function save(entry: PlatformConfigEntry) {
    const raw = drafts[entry.key];
    if (raw === undefined) return;
    const num = Number(raw);
    if (isNaN(num)) { toast.error('Valor no válido'); return; }
    if (entry.minValue !== null && num < entry.minValue) {
      toast.error(`Mínimo: ${entry.minValue}${entry.unit ? ' ' + entry.unit : ''}`);
      return;
    }
    if (entry.maxValue !== null && num > entry.maxValue) {
      toast.error(`Máximo: ${entry.maxValue}${entry.unit ? ' ' + entry.unit : ''}`);
      return;
    }
    setSaving(entry.key);
    try {
      const { config: updated } = await apiClient.admin.updateConfig(entry.key, num);
      setEntries((prev) => prev.map((e) => e.key === entry.key ? updated : e));
      setDrafts((d) => { const n = { ...d }; delete n[entry.key]; return n; });
      invalidateConfigCache();
      toast.success(`"${entry.label}" actualizado`);
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(null);
    }
  }

  async function reset(entry: PlatformConfigEntry) {
    setSaving(entry.key);
    try {
      const { config: updated } = await apiClient.admin.resetConfig(entry.key);
      setEntries((prev) => prev.map((e) => e.key === entry.key ? updated : e));
      setDrafts((d) => { const n = { ...d }; delete n[entry.key]; return n; });
      invalidateConfigCache();
      toast.success(`"${entry.label}" restablecido al valor por defecto`);
    } catch {
      toast.error('Error al restablecer');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 820 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Configuración de plataforma
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.35rem' }}>
          Ajusta los umbrales del motor de análisis y las reglas de visualización. Los cambios se aplican en el siguiente análisis.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
        {([
          { id: 'analyst', label: 'Umbrales de Análisis', icon: <Settings size={14} /> },
          { id: 'display', label: 'Reglas de Visualización', icon: <Monitor size={14} /> },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem', border: 'none', borderRadius: '6px 6px 0 0',
              background: tab === t.id ? 'var(--bg-card)' : 'transparent',
              color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-muted)',
              fontWeight: tab === t.id ? 700 : 400,
              cursor: 'pointer', fontSize: '0.82rem',
              borderBottom: tab === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cargando configuración…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {visible.map((entry) => {
            const dirty = isDirty(entry);
            const atDefault = isAtDefault(entry);
            const isSaving = saving === entry.key;
            const draft = getDraft(entry);
            const numDraft = Number(draft);
            const rangeError = !isNaN(numDraft) && (
              (entry.minValue !== null && numDraft < entry.minValue) ||
              (entry.maxValue !== null && numDraft > entry.maxValue)
            );

            return (
              <div key={entry.key} className="glass-card" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  {/* Label + description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {entry.label}
                      </span>
                      {!atDefault && (
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-prime)', background: 'rgba(240,180,41,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                          MODIFICADO
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                      {entry.description}
                    </p>
                    <div style={{ marginTop: '0.35rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Defecto: <b style={{ color: 'var(--text-secondary)' }}>{entry.defaultValue}{entry.unit ? ` ${entry.unit}` : ''}</b>
                      {entry.minValue !== null && entry.maxValue !== null && (
                        <span style={{ marginLeft: '0.75rem' }}>
                          Rango: {entry.minValue} – {entry.maxValue}{entry.unit ? ` ${entry.unit}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Input + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        value={draft}
                        min={entry.minValue ?? undefined}
                        max={entry.maxValue ?? undefined}
                        step={entry.unit === 'wards/min' ? 0.05 : entry.unit === '%' ? 1 : 1}
                        onChange={(e) => setDraft(entry.key, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !rangeError) save(entry); }}
                        style={{
                          width: 90,
                          padding: '0.4rem 0.6rem',
                          background: 'var(--bg-dark)',
                          border: `1px solid ${rangeError ? 'var(--accent-loss)' : dirty ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.88rem',
                          textAlign: 'right',
                        }}
                      />
                      {entry.unit && (
                        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                          {/* Unit shown separately */}
                        </span>
                      )}
                    </div>
                    {entry.unit && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 48 }}>
                        {entry.unit}
                      </span>
                    )}
                    <button
                      onClick={() => save(entry)}
                      disabled={!dirty || rangeError || isSaving}
                      title="Guardar"
                      style={{
                        padding: '0.4rem 0.7rem', border: 'none', borderRadius: 6, cursor: dirty && !rangeError ? 'pointer' : 'not-allowed',
                        background: dirty && !rangeError ? 'var(--accent-blue)' : 'var(--bg-dark)',
                        color: dirty && !rangeError ? '#fff' : 'var(--text-muted)',
                        fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem',
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      <Save size={12} /> {isSaving ? '…' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => reset(entry)}
                      disabled={atDefault || isSaving}
                      title="Restablecer al valor por defecto"
                      style={{
                        padding: '0.4rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: 6,
                        cursor: !atDefault ? 'pointer' : 'not-allowed',
                        background: 'transparent',
                        color: !atDefault ? 'var(--text-secondary)' : 'var(--text-muted)',
                        fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'display' && (
        <p style={{ marginTop: '1.25rem', fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Los cambios en las Reglas de Visualización se aplican inmediatamente en los badges y alertas de la interfaz (Pocket Pick, One-Trick, pool de héroes). Recarga la página si ya tenías una vista abierta.
        </p>
      )}
    </div>
  );
}
