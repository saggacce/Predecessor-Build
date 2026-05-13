import { Link } from 'react-router';
import { Shield, BarChart2, Target, Eye, Zap, Users } from 'lucide-react';

const FEATURES = [
  { icon: <BarChart2 size={20} />, color: 'var(--accent-teal-bright)', title: 'Team Analysis', desc: 'Win rate, forma reciente, análisis de visión, objetivos y draft en tiempo real.' },
  { icon: <Target size={20} />, color: 'var(--accent-loss)', title: 'Scrim Report', desc: 'Inteligencia pre-partido: ban targets, win conditions y scouting del rival.' },
  { icon: <Eye size={20} />, color: 'var(--accent-violet)', title: 'Rival Scouting', desc: 'Identidad del rival, jugadores amenazantes y control de objetivos.' },
  { icon: <Zap size={20} />, color: 'var(--accent-prime)', title: 'Analyst Insights', desc: 'Motor determinista con más de 30 reglas que detectan patrones críticos.' },
  { icon: <Users size={20} />, color: 'var(--accent-blue)', title: 'Player Scouting', desc: 'Perfil completo de cualquier jugador: héroes, métricas y evolución.' },
  { icon: <Shield size={20} />, color: 'var(--accent-win)', title: 'Review Queue', desc: 'Flujo de revisión de partidas con Team Goals y Player Goals vinculados.' },
];

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 1.5rem 4rem',
      fontFamily: 'DM Sans, Outfit, sans-serif',
    }}>

      {/* Header */}
      <header style={{ width: '100%', maxWidth: 900, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src="/favicon.svg" alt="PrimeSight" style={{ width: 28, height: 28 }} />
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>PrimeSight</span>
        </div>
        <Link to="/login" className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.45rem 1.1rem' }}>
          Iniciar sesión
        </Link>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 700, textAlign: 'center', marginBottom: '4rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(56,212,200,0.1)', border: '1px solid rgba(56,212,200,0.25)', borderRadius: 999, padding: '0.3rem 0.85rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-teal-bright)' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-teal-bright)', letterSpacing: '0.05em' }}>COMPETITIVE INTELLIGENCE · PREDECESSOR</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1, margin: '0 0 1.25rem', letterSpacing: '-0.02em' }}>
          Inteligencia competitiva<br />
          <span style={{ background: 'linear-gradient(135deg, #38d4c8, #5b9cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            para equipos serios
          </span>
        </h1>

        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '2rem', maxWidth: 520, margin: '0 auto 2rem' }}>
          Análisis de equipo, scouting de rivales, insights automáticos y flujos de revisión para coaches, analistas y managers de Predecessor.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" className="btn-primary" style={{ fontSize: '0.95rem', padding: '0.65rem 1.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            Acceder a PrimeSight
          </Link>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <button disabled style={{
              fontSize: '0.95rem', padding: '0.65rem 1.75rem',
              background: 'transparent', border: '1px solid var(--border-color)',
              borderRadius: 7, color: 'var(--text-muted)', cursor: 'not-allowed', opacity: 0.6,
            }}>
              Registrarse
            </button>
            <span style={{
              position: 'absolute', top: -10, right: -8,
              fontSize: '0.55rem', fontWeight: 700, color: 'var(--accent-prime)',
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>
              Próximamente
            </span>
          </div>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.85rem' }}>
          Acceso por invitación. Contacta al administrador de tu organización.
        </p>
      </section>

      {/* Features grid */}
      <section style={{ maxWidth: 900, width: '100%' }}>
        <h2 style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>
          Módulos disponibles
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {FEATURES.map(({ icon, color, title, desc }) => (
            <div key={title} className="glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '1.1rem 1.25rem', borderLeft: `3px solid ${color}` }}>
              <span style={{ color, flexShrink: 0, marginTop: '0.1rem' }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: '4rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        PrimeSight — Herramienta privada de inteligencia competitiva para Predecessor · Acceso restringido
      </footer>
    </div>
  );
}
