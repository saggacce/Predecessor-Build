import { useState, useRef } from 'react';
import { MessageSquarePlus, X, Upload, Bug, Lightbulb, Zap, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/client';

const APP_SECTIONS = [
  'Dashboard', 'Player Scouting', 'Team Analysis', 'Match Detail',
  'Rival Scouting', 'Scrim Report', 'Review Queue', 'Team Goals',
  'VOD Index', 'Staff Management', 'Platform Admin', 'Profile', 'Otro',
];

export function FeedbackButton() {
  const { t } = useTranslation();

  const TYPE_CONFIG = {
    bug:         { label: t('feedbackButton.typeBug'),         icon: <Bug size={14} />,       color: 'var(--accent-loss)',        bg: 'rgba(248,113,113,0.12)' },
    suggestion:  { label: t('feedbackButton.typeSuggestion'),  icon: <Lightbulb size={14} />, color: 'var(--accent-prime)',       bg: 'rgba(240,180,41,0.12)' },
    improvement: { label: t('feedbackButton.typeImprovement'), icon: <Zap size={14} />,       color: 'var(--accent-blue)',        bg: 'rgba(91,156,246,0.12)' },
  } as const;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'bug' | 'suggestion' | 'improvement'>('bug');
  const [section, setSection] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { toast.error(t('feedbackButton.screenshotLabel')); return; }
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  }

  function reset() {
    setType('bug'); setSection(''); setDescription(''); setScreenshot(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function close() { setOpen(false); reset(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!section) { toast.error(t('feedbackButton.sectionLabel')); return; }
    if (description.trim().length < 10) { toast.error(t('feedbackButton.descriptionLabel')); return; }
    setSending(true);
    try {
      await apiClient.feedback.submit({ type, section, description: description.trim(), screenshotBase64: screenshot });
      toast.success(t('feedbackButton.submitButton'));
      close();
    } catch { toast.error(t('common.error')); }
    finally { setSending(false); }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        title={t('feedbackButton.title')}
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 900,
          width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(135deg, #5b9cf6, #4a85e0)',
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(91,156,246,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        <MessageSquarePlus size={18} />
      </button>

      {/* Modal */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: 520, padding: '1.5rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={close} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>

            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {t('feedbackButton.title')}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
              {t('feedbackButton.title')}
            </p>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Type selector */}
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('feedbackButton.typeLabel')}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(Object.entries(TYPE_CONFIG) as [keyof typeof TYPE_CONFIG, typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]][]).map(([key, cfg]) => (
                    <button
                      key={key} type="button"
                      onClick={() => setType(key)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        padding: '0.5rem 0.6rem', border: `1px solid ${type === key ? cfg.color : 'var(--border-color)'}`,
                        borderRadius: 7, background: type === key ? cfg.bg : 'transparent',
                        color: type === key ? cfg.color : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '0.75rem', fontWeight: type === key ? 700 : 400,
                        transition: 'all 0.12s',
                      }}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section */}
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('feedbackButton.sectionLabel')}
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.45rem 0.7rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: section ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.85rem' }}
                >
                  <option value="">{t('feedbackButton.sectionLabel')}…</option>
                  {APP_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('feedbackButton.descriptionLabel')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({description.length}/2000)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required minLength={10} maxLength={2000} rows={4}
                  placeholder={
                    type === 'bug'
                      ? t('feedbackButton.placeholderBug')
                      : type === 'suggestion'
                      ? t('feedbackButton.placeholderSuggestion')
                      : t('feedbackButton.placeholderImprovement')
                  }
                  style={{ width: '100%', padding: '0.5rem 0.7rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* Screenshot */}
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('feedbackButton.screenshotLabel')}
                </label>
                {screenshot ? (
                  <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color)', maxHeight: 140 }}>
                    <img src={screenshot} alt="screenshot" style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
                    <button
                      type="button"
                      onClick={() => { setScreenshot(null); if (fileRef.current) fileRef.current.value = ''; }}
                      style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{ width: '100%', padding: '0.65rem', border: '1px dashed var(--border-color)', borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.8rem' }}
                  >
                    <Upload size={14} /> {t('feedbackButton.uploadButton')}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={sending}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: sending ? 0.7 : 1 }}
              >
                <Send size={14} /> {sending ? t('dashboard.syncing') : t('feedbackButton.submitButton')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
