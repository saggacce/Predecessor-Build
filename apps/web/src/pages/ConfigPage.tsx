import { useEffect, useState } from 'react';
import { RotateCcw, Save, Settings, Monitor, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiClient, type PlatformConfigEntry } from '../api/client';
import { invalidateConfigCache } from '../hooks/useConfig';

type Tab = 'analyst' | 'display' | 'llm';

export default function ConfigPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<PlatformConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('analyst');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    apiClient.admin.getConfig()
      .then(({ config }) => { setEntries(config); setLoading(false); })
      .catch(() => { toast.error(t('config.loadError')); setLoading(false); });
  }, [t]);

  const numericVisible = entries.filter((e) => e.group === tab && e.textValue === null && e.minValue !== null);
  const llmEntries = entries.filter((e) => e.group === 'llm');
  const llmEnabled = llmEntries.find((e) => e.key === 'llm_enabled');
  const llmApiKeyEntry = llmEntries.find((e) => e.key === 'llm_api_key');
  const llmTextEntries = llmEntries.filter((e) => e.textValue !== null && e.key !== 'llm_api_key');
  const llmNumericEntries = llmEntries.filter((e) => e.textValue === null && e.key !== 'llm_enabled');

  function getDraft(entry: PlatformConfigEntry): string {
    return drafts[entry.key] ?? String(entry.value);
  }
  function getTextDraft(entry: PlatformConfigEntry): string {
    return textDrafts[entry.key] ?? (entry.textValue ?? '');
  }
  function setDraft(key: string, val: string) {
    setDrafts((d) => ({ ...d, [key]: val }));
  }
  function setTextDraft(key: string, val: string) {
    setTextDrafts((d) => ({ ...d, [key]: val }));
  }
  function isDirty(entry: PlatformConfigEntry) {
    return drafts[entry.key] !== undefined && Number(drafts[entry.key]) !== entry.value;
  }
  function isTextDirty(entry: PlatformConfigEntry) {
    return textDrafts[entry.key] !== undefined && textDrafts[entry.key] !== (entry.textValue ?? '');
  }
  function isAtDefault(entry: PlatformConfigEntry) {
    return entry.value === entry.defaultValue;
  }

  async function save(entry: PlatformConfigEntry) {
    const raw = drafts[entry.key];
    if (raw === undefined) return;
    const num = Number(raw);
    if (isNaN(num)) { toast.error(t('config.invalidValue')); return; }
    if (entry.minValue !== null && num < entry.minValue) {
      toast.error(`Mínimo: ${entry.minValue}${entry.unit ? ' ' + entry.unit : ''}`); return;
    }
    if (entry.maxValue !== null && num > entry.maxValue) {
      toast.error(`Máximo: ${entry.maxValue}${entry.unit ? ' ' + entry.unit : ''}`); return;
    }
    setSaving(entry.key);
    try {
      const { config: updated } = await apiClient.admin.updateConfig(entry.key, num);
      setEntries((prev) => prev.map((e) => e.key === entry.key ? updated : e));
      setDrafts((d) => { const n = { ...d }; delete n[entry.key]; return n; });
      invalidateConfigCache();
      toast.success(`"${entry.label}" actualizado`);
    } catch { toast.error(t('config.saveError')); }
    finally { setSaving(null); }
  }

  async function saveText(entry: PlatformConfigEntry) {
    const val = textDrafts[entry.key];
    if (val === undefined) return;
    setSaving(entry.key);
    try {
      const { config: updated } = await apiClient.admin.updateConfigText(entry.key, val);
      setEntries((prev) => prev.map((e) => e.key === entry.key ? updated : e));
      setTextDrafts((d) => { const n = { ...d }; delete n[entry.key]; return n; });
      invalidateConfigCache();
      toast.success(`"${entry.label}" actualizado`);
    } catch { toast.error(t('config.saveError')); }
    finally { setSaving(null); }
  }

  async function toggleLlm() {
    if (!llmEnabled) return;
    const newVal = llmEnabled.value === 1 ? 0 : 1;
    setSaving('llm_enabled');
    try {
      const { config: updated } = await apiClient.admin.updateConfig('llm_enabled', newVal);
      setEntries((prev) => prev.map((e) => e.key === 'llm_enabled' ? updated : e));
      invalidateConfigCache();
      toast.success(newVal === 1 ? 'Focus of the Day activado' : 'Focus of the Day desactivado');
    } catch { toast.error(t('config.saveError')); }
    finally { setSaving(null); }
  }

  async function reset(entry: PlatformConfigEntry) {
    setSaving(entry.key);
    try {
      const { config: updated } = await apiClient.admin.resetConfig(entry.key);
      setEntries((prev) => prev.map((e) => e.key === entry.key ? updated : e));
      setDrafts((d) => { const n = { ...d }; delete n[entry.key]; return n; });
      invalidateConfigCache();
      toast.success(`"${entry.label}" restablecido al valor por defecto`);
    } catch { toast.error(t('config.resetError')); }
    finally { setSaving(null); }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'analyst', label: t('config.thresholds'), icon: <Settings size={14} /> },
    { id: 'display', label: t('config.displayRules'), icon: <Monitor size={14} /> },
    { id: 'llm', label: 'IA / Focus of the Day', icon: <Sparkles size={14} /> },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: 820 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Configuración de plataforma
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.35rem' }}>
          Ajusta los umbrales del motor de análisis, las reglas de visualización y el módulo de IA.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        {tabs.map((tab_item) => (
          <button key={tab_item.id} onClick={() => setTab(tab_item.id)} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.55rem 1rem', border: 'none', borderRadius: '6px 6px 0 0',
            background: tab === tab_item.id ? 'var(--bg-card)' : 'transparent',
            color: tab === tab_item.id ? 'var(--accent-blue)' : 'var(--text-muted)',
            fontWeight: tab === tab_item.id ? 700 : 400,
            cursor: 'pointer', fontSize: '0.82rem',
            borderBottom: tab === tab_item.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
          }}>
            {tab_item.icon} {tab_item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('config.loading')}</div>
      ) : tab === 'llm' ? (
        <LlmConfigTab
          llmEnabled={llmEnabled}
          llmApiKeyEntry={llmApiKeyEntry}
          llmTextEntries={llmTextEntries}
          llmNumericEntries={llmNumericEntries}
          saving={saving}
          textDrafts={textDrafts}
          getTextDraft={getTextDraft}
          setTextDraft={setTextDraft}
          isTextDirty={isTextDirty}
          getDraft={getDraft}
          setDraft={setDraft}
          isDirty={isDirty}
          onToggle={toggleLlm}
          onSaveText={saveText}
          onSaveNum={save}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {numericVisible.map((entry) => (
            <NumericConfigCard
              key={entry.key}
              entry={entry}
              draft={getDraft(entry)}
              dirty={isDirty(entry)}
              atDefault={isAtDefault(entry)}
              isSaving={saving === entry.key}
              onChangeDraft={(v) => setDraft(entry.key, v)}
              onSave={() => save(entry)}
              onReset={() => reset(entry)}
            />
          ))}
        </div>
      )}

      {tab === 'display' && (
        <p style={{ marginTop: '1.25rem', fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Los cambios en las Reglas de Visualización se aplican inmediatamente en los badges y alertas de la interfaz. Recarga la página si ya tenías una vista abierta.
        </p>
      )}
    </div>
  );
}

// ── LLM Config Tab ─────────────────────────────────────────────────────────────
function LlmConfigTab({
  llmEnabled, llmApiKeyEntry, llmTextEntries, llmNumericEntries, saving, textDrafts,
  getTextDraft, setTextDraft, isTextDirty, getDraft, setDraft, isDirty,
  onToggle, onSaveText, onSaveNum,
}: {
  llmEnabled: PlatformConfigEntry | undefined;
  llmApiKeyEntry: PlatformConfigEntry | undefined;
  llmTextEntries: PlatformConfigEntry[];
  llmNumericEntries: PlatformConfigEntry[];
  saving: string | null;
  textDrafts: Record<string, string>;
  getTextDraft: (e: PlatformConfigEntry) => string;
  setTextDraft: (k: string, v: string) => void;
  isTextDirty: (e: PlatformConfigEntry) => boolean;
  getDraft: (e: PlatformConfigEntry) => string;
  setDraft: (k: string, v: string) => void;
  isDirty: (e: PlatformConfigEntry) => boolean;
  onToggle: () => void;
  onSaveText: (e: PlatformConfigEntry) => void;
  onSaveNum: (e: PlatformConfigEntry) => void;
}) {
  const isEnabled = llmEnabled?.value === 1;
  const isToggling = saving === 'llm_enabled';
  const apiKeyIsSet = llmApiKeyEntry?.textValue === '__SET__';
  const apiKeyDraft = textDrafts['llm_api_key'] ?? '';
  const apiKeyDirty = apiKeyDraft.trim().length > 0;
  const apiKeySaving = saving === 'llm_api_key';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Enable/disable toggle card */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem', borderLeft: `3px solid ${isEnabled ? 'var(--accent-teal-bright)' : 'var(--border-color)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Sparkles size={20} style={{ color: isEnabled ? 'var(--accent-violet)' : 'var(--text-muted)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              Focus of the Day
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Genera un análisis diario con IA para el coach basado en los insights del equipo. Aparece en el Dashboard de COACH y MANAGER. Requiere una API key configurada abajo.
            </div>
          </div>
          <button
            onClick={onToggle}
            disabled={isToggling}
            style={{ background: 'none', border: 'none', cursor: isToggling ? 'wait' : 'pointer', padding: 0, opacity: isToggling ? 0.5 : 1, flexShrink: 0 }}
            title={isEnabled ? 'Desactivar' : 'Activar'}
          >
            {isEnabled
              ? <ToggleRight size={36} style={{ color: 'var(--accent-teal-bright)' }} />
              : <ToggleLeft size={36} style={{ color: 'var(--text-muted)' }} />
            }
          </button>
        </div>
        <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: isEnabled ? 'rgba(56,212,200,0.12)' : 'rgba(255,255,255,0.05)',
            color: isEnabled ? 'var(--accent-teal-bright)' : 'var(--text-muted)',
          }}>
            {isEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
          </span>
          {!isEnabled && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              El módulo no aparecerá en el Dashboard mientras esté desactivado.
            </span>
          )}
        </div>
      </div>

      {/* API Key */}
      {llmApiKeyEntry && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Autenticación
          </div>
          <div className="glass-card" style={{ padding: '1rem 1.25rem', borderLeft: `3px solid ${apiKeyIsSet ? 'var(--accent-teal-bright)' : 'var(--accent-loss)'}` }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              API Key
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, padding: '1px 7px', borderRadius: 4,
                background: apiKeyIsSet ? 'rgba(56,212,200,0.12)' : 'rgba(255,80,80,0.12)',
                color: apiKeyIsSet ? 'var(--accent-teal-bright)' : 'var(--accent-loss)',
              }}>
                {apiKeyIsSet ? 'CONFIGURADA' : 'NO CONFIGURADA'}
              </span>
              {apiKeyDirty && (
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-prime)', background: 'rgba(240,180,41,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                  nueva clave lista para guardar
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.7rem', lineHeight: 1.5 }}>
              Clave de autenticación del proveedor LLM (OpenRouter, OpenAI, etc.). Se almacena de forma segura en el servidor y nunca se devuelve en texto plano.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="password"
                value={apiKeyDraft}
                onChange={(e) => setTextDraft('llm_api_key', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && apiKeyDirty && llmApiKeyEntry) onSaveText(llmApiKeyEntry);
                }}
                placeholder={apiKeyIsSet ? 'Introduce una nueva clave para reemplazarla' : 'sk-or-v1-…'}
                style={{
                  flex: 1, padding: '0.4rem 0.65rem',
                  background: 'var(--bg-dark)',
                  border: `1px solid ${apiKeyDirty ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                  borderRadius: 6, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)', fontSize: '0.82rem',
                }}
              />
              <button
                onClick={() => llmApiKeyEntry && onSaveText(llmApiKeyEntry)}
                disabled={!apiKeyDirty || apiKeySaving}
                style={{
                  padding: '0.4rem 0.7rem', border: 'none', borderRadius: 6,
                  cursor: apiKeyDirty ? 'pointer' : 'not-allowed',
                  background: apiKeyDirty ? 'var(--accent-blue)' : 'var(--bg-dark)',
                  color: apiKeyDirty ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.72rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  opacity: apiKeySaving ? 0.6 : 1,
                }}
              >
                <Save size={12} /> {apiKeySaving ? '…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text config fields (model, base URL) */}
      {llmTextEntries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Proveedor y modelo
          </div>
          {llmTextEntries.map((entry) => {
            const dirty = isTextDirty(entry);
            const isSaving = saving === entry.key;
            return (
              <div key={entry.key} className="glass-card" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {entry.label}
                      {dirty && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-prime)', background: 'rgba(240,180,41,0.12)', padding: '1px 6px', borderRadius: 4 }}>modificado</span>}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.6rem', lineHeight: 1.5 }}>{entry.description}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        value={getTextDraft(entry)}
                        onChange={(e) => setTextDraft(entry.key, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && dirty) onSaveText(entry); }}
                        placeholder={entry.textValue ?? ''}
                        style={{
                          flex: 1, padding: '0.4rem 0.65rem',
                          background: 'var(--bg-dark)',
                          border: `1px solid ${dirty ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                          borderRadius: 6, color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)', fontSize: '0.82rem',
                        }}
                      />
                      <button
                        onClick={() => onSaveText(entry)}
                        disabled={!dirty || isSaving}
                        style={{
                          padding: '0.4rem 0.7rem', border: 'none', borderRadius: 6,
                          cursor: dirty ? 'pointer' : 'not-allowed',
                          background: dirty ? 'var(--accent-blue)' : 'var(--bg-dark)',
                          color: dirty ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.72rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          opacity: isSaving ? 0.6 : 1,
                        }}
                      >
                        <Save size={12} /> {isSaving ? '…' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Numeric LLM config (max_tokens, etc.) */}
      {llmNumericEntries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Parámetros del modelo
          </div>
          {llmNumericEntries.map((entry) => {
            const dirty = isDirty(entry);
            const isSaving = saving === entry.key;
            const draft = getDraft(entry);
            const numDraft = Number(draft);
            const rangeError = !isNaN(numDraft) && (
              (entry.minValue !== null && numDraft < entry.minValue) ||
              (entry.maxValue !== null && numDraft > entry.maxValue)
            );
            return (
              <div key={entry.key} className="glass-card" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{entry.label}</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{entry.description}</p>
                    {entry.minValue !== null && entry.maxValue !== null && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                        Rango: {entry.minValue} – {entry.maxValue}{entry.unit ? ` ${entry.unit}` : ''} · Defecto: {entry.defaultValue}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <input
                      type="number" value={draft}
                      min={entry.minValue ?? undefined} max={entry.maxValue ?? undefined}
                      onChange={(e) => setDraft(entry.key, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !rangeError) onSaveNum(entry); }}
                      style={{
                        width: 90, padding: '0.4rem 0.6rem', background: 'var(--bg-dark)',
                        border: `1px solid ${rangeError ? 'var(--accent-loss)' : dirty ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                        borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
                        fontSize: '0.88rem', textAlign: 'right',
                      }}
                    />
                    {entry.unit && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 40 }}>{entry.unit}</span>}
                    <button onClick={() => onSaveNum(entry)} disabled={!dirty || rangeError || isSaving} style={{
                      padding: '0.4rem 0.7rem', border: 'none', borderRadius: 6,
                      cursor: dirty && !rangeError ? 'pointer' : 'not-allowed',
                      background: dirty && !rangeError ? 'var(--accent-blue)' : 'var(--bg-dark)',
                      color: dirty && !rangeError ? '#fff' : 'var(--text-muted)',
                      fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem',
                    }}>
                      <Save size={12} /> {isSaving ? '…' : 'Guardar'}
                    </button>
                    <button onClick={() => onSaveNum({ ...entry, value: entry.defaultValue })} disabled={entry.value === entry.defaultValue || isSaving} style={{
                      padding: '0.4rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: 6,
                      cursor: entry.value !== entry.defaultValue ? 'pointer' : 'not-allowed',
                      background: 'transparent', color: 'var(--text-muted)', fontSize: '0.72rem',
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                    }}>
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ── Numeric config card (reusable for analyst / display tabs) ─────────────────
function NumericConfigCard({ entry, draft, dirty, atDefault, isSaving, onChangeDraft, onSave, onReset }: {
  entry: PlatformConfigEntry;
  draft: string;
  dirty: boolean;
  atDefault: boolean;
  isSaving: boolean;
  onChangeDraft: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const numDraft = Number(draft);
  const rangeError = !isNaN(numDraft) && (
    (entry.minValue !== null && numDraft < entry.minValue) ||
    (entry.maxValue !== null && numDraft > entry.maxValue)
  );

  return (
    <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{entry.label}</span>
            {!atDefault && (
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-prime)', background: 'rgba(240,180,41,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                {t('config.modified')}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{entry.description}</p>
          <div style={{ marginTop: '0.35rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Defecto: <b style={{ color: 'var(--text-secondary)' }}>{entry.defaultValue}{entry.unit ? ` ${entry.unit}` : ''}</b>
            {entry.minValue !== null && entry.maxValue !== null && (
              <span style={{ marginLeft: '0.75rem' }}>
                Rango: {entry.minValue} – {entry.maxValue}{entry.unit ? ` ${entry.unit}` : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <input
            type="number" value={draft}
            min={entry.minValue ?? undefined} max={entry.maxValue ?? undefined}
            step={entry.unit === 'wards/min' ? 0.05 : 1}
            onChange={(e) => onChangeDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !rangeError) onSave(); }}
            style={{
              width: 90, padding: '0.4rem 0.6rem', background: 'var(--bg-dark)',
              border: `1px solid ${rangeError ? 'var(--accent-loss)' : dirty ? 'var(--accent-blue)' : 'var(--border-color)'}`,
              borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
              fontSize: '0.88rem', textAlign: 'right',
            }}
          />
          {entry.unit && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 48 }}>{entry.unit}</span>}
          <button onClick={onSave} disabled={!dirty || rangeError || isSaving} title={t('config.saveButton')} style={{
            padding: '0.4rem 0.7rem', border: 'none', borderRadius: 6,
            cursor: dirty && !rangeError ? 'pointer' : 'not-allowed',
            background: dirty && !rangeError ? 'var(--accent-blue)' : 'var(--bg-dark)',
            color: dirty && !rangeError ? '#fff' : 'var(--text-muted)',
            fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem',
            opacity: isSaving ? 0.6 : 1,
          }}>
            <Save size={12} /> {isSaving ? '…' : t('config.saveButton')}
          </button>
          <button onClick={onReset} disabled={atDefault || isSaving} title={t('config.resetButton')} style={{
            padding: '0.4rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: 6,
            cursor: !atDefault ? 'pointer' : 'not-allowed',
            background: 'transparent', color: !atDefault ? 'var(--text-secondary)' : 'var(--text-muted)',
            fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
            opacity: isSaving ? 0.6 : 1,
          }}>
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
