import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient } from '../api/client';

// ── Social provider icons ─────────────────────────────────────────────────────
const DiscordIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.013.04.028.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .028-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);

const SteamIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
  </svg>
);

// Correct Epic Games logo — the official stylized "E" mark
const EpicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 128 128" fill="currentColor">
    <path d="M19.2 0v100.184L35.328 111.36V17.066H98.56v17.067H52.395v17.067H98.56v17.066H52.395V85.33H98.56v17.067H35.328l-16.129 11.178L35.328 128H108.8V0H19.2z"/>
  </svg>
);

const PROVIDERS = [
  { id: 'discord', label: 'Discord',    Icon: DiscordIcon, color: '#5865F2' },
  { id: 'steam',   label: 'Steam',      Icon: SteamIcon,   color: '#66c0f4' },
  { id: 'epic',    label: 'Epic Games', Icon: EpicIcon,    color: '#e0e0e0' },
] as const;

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tooltip, setTooltip]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.auth.internalLogin(email, password);
      toast.success('Sesión iniciada.');
      window.location.assign('/');
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* Full-screen page — no sidebar, no workspace header */
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-dark)',
      padding: '1.5rem',
      position: 'fixed',
      inset: 0,
      zIndex: 50,
    }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>

        {/* Brand */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/favicon.svg" alt="RiftLine" style={{ width: 80, height: 80, filter: 'drop-shadow(0 0 24px rgba(167,139,250,0.5))' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: '2rem', letterSpacing: '-0.05em', color: 'var(--text-primary)', lineHeight: 1, background: 'linear-gradient(120deg,#c4b5fd,#a78bfa,#5b9cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              RiftLine
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--accent-teal-bright)', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase', marginTop: '0.3rem' }}>
              Competitive Intel
            </div>
          </div>
        </Link>

        {/* Card */}
        <div className="glass-card" style={{ width: '100%', padding: '1.75rem 2rem' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>Iniciar sesión</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 1.5rem' }}>Accede con tu cuenta de RiftLine</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
              <input className="input" type="email" autoComplete="email" placeholder="tu@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contraseña</label>
              <input className="input" type="password" autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <button className="btn-primary" type="submit" disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem', width: '100%', marginTop: '0.25rem' }}>
              <LogIn size={16} />
              {submitting ? 'Accediendo...' : 'Acceder'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0 1.25rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>o conecta con</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          </div>

          {/* Social icon buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            {PROVIDERS.map(({ id, label, Icon, color }) => (
              <div key={id} style={{ position: 'relative' }}>
                <button
                  disabled
                  onMouseEnter={() => setTooltip(id)}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    width: 52, height: 52,
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.03)',
                    color,
                    cursor: 'not-allowed',
                    opacity: 0.45,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { setTooltip(id); (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'; (e.currentTarget as HTMLButtonElement).style.borderColor = color + '55'; }}
                  onMouseLeave={(e) => { setTooltip(null); (e.currentTarget as HTMLButtonElement).style.opacity = '0.45'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)'; }}
                >
                  <Icon />
                </button>

                {/* Tooltip */}
                {tooltip === id && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 10px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    pointerEvents: 'none',
                  }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{label}</span> estará disponible próximamente
                    {/* Arrow */}
                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--border-color)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Acceso por invitación ·{' '}
          <Link to="/" style={{ color: 'var(--accent-teal-bright)', textDecoration: 'none' }}>Volver a inicio</Link>
        </p>
      </div>
    </div>
  );
}
