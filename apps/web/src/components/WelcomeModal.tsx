import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import { apiClient, type MissionItem } from '../api/client';

interface WelcomeModalProps {
  userName: string;
  role: string | null;
  missions: MissionItem[];
  onClose: () => void;
}

const ROLE_LABELS: Record<string, Record<string, string>> = {
  COACH:   { en: 'Coach',   es: 'Coach' },
  MANAGER: { en: 'Manager', es: 'Manager' },
  ANALISTA:{ en: 'Analyst', es: 'Analista' },
  JUGADOR: { en: 'Player',  es: 'Jugador' },
  PLAYER:  { en: 'Player',  es: 'Jugador' },
};

export function WelcomeModal({ userName, role, missions, onClose }: WelcomeModalProps) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'en' | 'es';

  const roleLabel = role ? (ROLE_LABELS[role]?.[lang] ?? role) : null;
  const greeting = lang === 'es'
    ? `¡Bienvenido a RiftLine, ${userName.split(' ')[0]}!`
    : `Welcome to RiftLine, ${userName.split(' ')[0]}!`;
  const subtitle = lang === 'es'
    ? 'Estos son tus primeros pasos para sacar el máximo partido a la plataforma.'
    : 'Here are your first steps to get the most out of the platform.';

  function handleClose() {
    setClosing(true);
    void apiClient.missions.markOnboardingSeen().catch(() => null);
    onClose();
  }

  function handleMissionClick(mission: MissionItem) {
    if (!mission.completed) {
      void apiClient.missions.markOnboardingSeen().catch(() => null);
      onClose();
      navigate(mission.ctaPath);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        opacity: closing ? 0 : 1, transition: 'opacity 0.2s',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%', maxWidth: 560, margin: '1rem',
          padding: '2rem', position: 'relative',
          border: '1px solid rgba(107,170,248,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <button
          onClick={handleClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6baaf8, #4a85e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{greeting}</h2>
            {roleLabel && (
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {roleLabel}
              </span>
            )}
          </div>
        </div>

        <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.55 }}>
          {subtitle}
        </p>

        {/* Mission list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {missions.map((m, i) => (
            <button
              key={m.id}
              onClick={() => handleMissionClick(m)}
              disabled={m.completed}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.85rem',
                padding: '0.75rem 1rem',
                background: m.completed ? 'rgba(255,255,255,0.04)' : 'rgba(107,170,248,0.07)',
                border: `1px solid ${m.completed ? 'rgba(255,255,255,0.08)' : 'rgba(107,170,248,0.2)'}`,
                borderRadius: 8, cursor: m.completed ? 'default' : 'pointer',
                textAlign: 'left', width: '100%', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!m.completed) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(107,170,248,0.13)'; }}
              onMouseLeave={(e) => { if (!m.completed) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(107,170,248,0.07)'; }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 18, textAlign: 'center' }}>
                {m.completed ? <CheckCircle2 size={16} color="var(--accent-win)" /> : i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: m.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: m.completed ? 'line-through' : 'none' }}>
                  {m.title[lang]}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {m.description[lang]}
                </div>
              </div>
              {!m.completed && <ArrowRight size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            className="btn-primary"
            style={{ fontSize: '0.82rem', padding: '0.55rem 1.25rem' }}
          >
            {lang === 'es' ? 'Empezar' : 'Get started'}
          </button>
        </div>
      </div>
    </div>
  );
}
