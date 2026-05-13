import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient } from '../api/client';

const SOCIAL_PROVIDERS = [
  {
    id: 'discord',
    label: 'Discord',
    color: '#5865F2',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.013.04.028.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .028-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
      </svg>
    ),
  },
  {
    id: 'steam',
    label: 'Steam',
    color: '#1b2838',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
      </svg>
    ),
  },
  {
    id: 'epic',
    label: 'Epic Games',
    color: '#2a2a2a',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3.488 0v18.049l2.377 1.676V3.142H17.97v13.694l-5.532 3.9-5.027-3.543v3.363l5.027 3.444L24 18.049V0H3.488z"/>
      </svg>
    ),
  },
] as const;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.auth.internalLogin(email, password);
      toast.success('Sesión iniciada.');
      window.location.assign('/');
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Login failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
            <img src="/favicon.svg" alt="RiftLine" style={{ width: 56, height: 56 }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.6rem', letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1 }}>RiftLine</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--accent-teal-bright)', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase', marginTop: '0.2rem' }}>Competitive Intel</div>
            </div>
          </Link>
        </div>

        {/* Login form */}
        <div className="glass-card" style={{ padding: '1.75rem' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>Iniciar sesión</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 1.5rem' }}>
            Accede con tu cuenta de RiftLine
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email
              </label>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Contraseña
              </label>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
            <button
              className="btn-primary"
              type="submit"
              disabled={submitting}
              style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.65rem' }}
            >
              <LogIn size={16} />
              {submitting ? 'Accediendo...' : 'Acceder'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>o continúa con</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          </div>

          {/* Social providers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', position: 'relative' }}>
            {SOCIAL_PROVIDERS.map(({ id, label, color, icon }) => (
              <div key={id} style={{ position: 'relative' }}>
                <button
                  disabled
                  onMouseEnter={() => setHoveredProvider(id)}
                  onMouseLeave={() => setHoveredProvider(null)}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'not-allowed',
                    opacity: 0.45,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <span style={{ color, flexShrink: 0 }}>{icon}</span>
                  <span>Continuar con {label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.58rem', fontWeight: 700, color: 'var(--accent-prime)', background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.25)', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>
                    Próximamente
                  </span>
                </button>

                {/* Tooltip */}
                {hoveredProvider === id && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 7,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 10,
                    pointerEvents: 'none',
                  }}>
                    🚀 El acceso con <b style={{ color: 'var(--text-primary)' }}>{label}</b> estará disponible próximamente
                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--border-color)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
          Acceso por invitación · <Link to="/" style={{ color: 'var(--accent-teal-bright)', textDecoration: 'none' }}>Volver a inicio</Link>
        </p>
      </div>
    </div>
  );
}
