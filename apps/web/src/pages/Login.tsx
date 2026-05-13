import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient } from '../api/client';

// ── Social provider icons ─────────────────────────────────────────────────────
// Discord Clyde mascot (official shape)
const DiscordIcon = () => (
  <svg width="26" height="20" viewBox="0 0 245 240" fill="#fff">
    <path d="M104.4 103.9c-5.7 0-10.2 5-10.2 11.1s4.6 11.1 10.2 11.1c5.7 0 10.2-5 10.2-11.1.1-6.1-4.5-11.1-10.2-11.1zm36.5 0c-5.7 0-10.2 5-10.2 11.1s4.6 11.1 10.2 11.1c5.7 0 10.2-5 10.2-11.1s-4.5-11.1-10.2-11.1z"/>
    <path d="M189.5 20h-134C44.2 20 35 29.2 35 40.6v135.2c0 11.4 9.2 20.6 20.5 20.6h113.4l-5.3-18.5 12.8 11.9 12.1 11.2 21.5 19V40.6c0-11.4-9.2-20.6-20.5-20.6zm-38.6 130.6s-3.6-4.3-6.6-8.1c13.1-3.7 18.1-11.9 18.1-11.9-4.1 2.7-8 4.6-11.5 5.9-5 2.1-9.8 3.5-14.5 4.3-9.6 1.8-18.4 1.3-25.9-.1-5.7-1.1-10.6-2.7-14.7-4.3-2.3-.9-4.8-2-7.3-3.4-.3-.2-.6-.3-.9-.5-.2-.1-.3-.2-.4-.3-1.8-1-2.8-1.7-2.8-1.7s4.8 8 17.5 11.8c-3 3.8-6.7 8.3-6.7 8.3-22.1-.7-30.5-15.2-30.5-15.2 0-32.2 14.4-58.3 14.4-58.3 14.4-10.8 28.1-10.5 28.1-10.5l1 1.2c-18 5.2-26.3 13.1-26.3 13.1s2.2-1.2 5.9-2.9c10.7-4.7 19.2-6 22.7-6.3.6-.1 1.1-.2 1.7-.2 6.1-.8 13-.9 20.2-.1 9.5 1.1 19.7 3.9 30.1 9.6 0 0-7.9-7.5-24.9-12.7l1.4-1.6s13.7-.3 28.1 10.5c0 0 14.4 26.1 14.4 58.3 0 0-8.5 14.5-30.6 15.2z"/>
  </svg>
);

const SteamIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
  </svg>
);

// Epic Games — white filled shield with dark EPIC GAMES text (official icon)
const EpicIcon = () => (
  <svg width="28" height="30" viewBox="0 0 100 108" xmlns="http://www.w3.org/2000/svg">
    {/* White filled shield */}
    <path d="M8 5 H92 Q97 5 97 12 V66 Q97 92 50 106 Q3 92 3 66 V12 Q3 5 8 5 Z" fill="white"/>
    {/* EPIC — dark text matching background */}
    <text x="50" y="50" textAnchor="middle" dominantBaseline="middle"
          fill="#1b2a3b" fontSize="36" fontWeight="900"
          fontFamily="'Arial Black','Arial Bold',Arial,sans-serif">EPIC</text>
    {/* GAMES — dark smaller text */}
    <text x="50" y="71" textAnchor="middle" dominantBaseline="middle"
          fill="#1b2a3b" fontSize="14" fontWeight="800"
          fontFamily="Arial,sans-serif" letterSpacing="4">GAMES</text>
    {/* Chevron arrow */}
    <path d="M40 84 L50 93 L60 84" fill="none" stroke="#1b2a3b"
          strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PROVIDERS = [
  { id: 'discord', label: 'Discord',    Icon: DiscordIcon, bg: '#5865F2', iconColor: '#fff' },
  { id: 'steam',   label: 'Steam',      Icon: SteamIcon,   bg: '#1b2838', iconColor: '#66c0f4' },
  { id: 'epic',    label: 'Epic Games', Icon: EpicIcon,    bg: '#1b2a3b', iconColor: '#fff' },
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
            {PROVIDERS.map(({ id, label, Icon, bg, iconColor }) => (
              <div key={id} style={{ position: 'relative' }}>
                <button
                  disabled
                  style={{
                    width: 64, height: 64,
                    borderRadius: 12,
                    border: 'none',
                    background: bg,
                    color: iconColor,
                    cursor: 'not-allowed',
                    opacity: 0.5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity 0.15s, transform 0.15s',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                  onMouseEnter={(e) => { setTooltip(id); (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'; }}
                  onMouseLeave={(e) => { setTooltip(null); (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; }}
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
