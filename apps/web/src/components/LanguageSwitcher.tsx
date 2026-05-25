import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { toast } from 'sonner';
import i18n, { type SupportedLanguage } from '../i18n';
import { apiClient } from '../api/client';

const LANGUAGES: { value: SupportedLanguage; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
];

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  async function handleChange(lang: SupportedLanguage) {
    if (lang === i18n.language) return;
    setSaving(true);
    try {
      await i18n.changeLanguage(lang);
      await apiClient.profile.update({ language: lang });
    } catch {
      // Best-effort — language changed locally even if API call fails
    } finally {
      setSaving(false);
    }
  }

  if (compact) {
    return (
      <select
        value={i18n.language}
        onChange={(e) => void handleChange(e.target.value as SupportedLanguage)}
        disabled={saving}
        className="input"
        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
        aria-label={t('languageSwitcher.label')}
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <Globe size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <select
        value={i18n.language}
        onChange={(e) => void handleChange(e.target.value as SupportedLanguage)}
        disabled={saving}
        className="input"
        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
        aria-label={t('languageSwitcher.label')}
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── First-time language selection modal ───────────────────────────────────────

const FIRST_TIME_KEY = 'rl_lang_chosen';

export function LanguageFirstTimeModal({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) ?? 'en'
  );
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      await i18n.changeLanguage(selected);
      await apiClient.profile.update({ language: selected });
      localStorage.setItem(FIRST_TIME_KEY, '1');
      onDismiss();
    } catch {
      localStorage.setItem(FIRST_TIME_KEY, '1');
      onDismiss();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div className="glass-card" style={{ maxWidth: 360, width: '100%', display: 'grid', gap: '1.25rem', textAlign: 'center' }}>
        <Globe size={32} style={{ color: 'var(--accent-blue)', margin: '0 auto' }} />
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{t('languageSwitcher.chooseTitle')}</h2>
          <p style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {t('languageSwitcher.chooseSubtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setSelected(l.value)}
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: 8,
                border: `2px solid ${selected === l.value ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                background: selected === l.value ? 'rgba(107,170,248,0.12)' : 'transparent',
                color: selected === l.value ? 'var(--accent-blue)' : 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>
        <button
          className="btn-primary"
          onClick={() => void handleConfirm()}
          disabled={saving}
          style={{ width: '100%' }}
        >
          {saving ? '...' : t('languageSwitcher.confirmButton')}
        </button>
      </div>
    </div>
  );
}

export function shouldShowLanguageModal(userLanguage?: string): boolean {
  if (localStorage.getItem(FIRST_TIME_KEY)) return false;
  // Already explicitly set by the user
  if (userLanguage && userLanguage !== 'en') return false;
  // If browser language differs from default, prompt the user
  const browserLang = navigator.language.split('-')[0];
  return browserLang !== (i18n.language ?? 'en');
}
