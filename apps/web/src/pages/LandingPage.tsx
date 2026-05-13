import { Link } from 'react-router';
import { BarChart2, Target, Eye, Zap, Users, Shield, ArrowRight } from 'lucide-react';

const FEATURES = [
  { icon: <BarChart2 size={18} />, color: 'var(--accent-teal-bright)', title: 'Team Analysis', desc: 'Win rate, visión, objetivos y draft. Análisis histórico por parche.' },
  { icon: <Target size={18} />, color: 'var(--accent-loss)', title: 'Scrim Report', desc: 'Inteligencia pre-partido. Ban targets y win conditions prescritos.' },
  { icon: <Eye size={18} />, color: 'var(--accent-violet)', title: 'Rival Scouting', desc: 'Identidad del rival, threat players y control de objetivos.' },
  { icon: <Zap size={18} />, color: 'var(--accent-prime)', title: 'Analyst Insights', desc: '+30 reglas deterministas detectan patrones críticos del equipo.' },
  { icon: <Users size={18} />, color: 'var(--accent-blue)', title: 'Player Scouting', desc: 'Perfil completo: héroes, métricas avanzadas y evolución de forma.' },
  { icon: <Shield size={18} />, color: 'var(--accent-win)', title: 'Review Queue', desc: 'Flujo de revisión vinculado a Team Goals y Player Goals.' },
];

// Mini stat bar for the mockup
function MiniBar({ h, color, label }: { h: number; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
      <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ width: '100%', height: `${h}%`, background: color, borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
      </div>
      <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{label}</span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(56,212,200,0.4); }
          70%  { box-shadow: 0 0 0 10px rgba(56,212,200,0); }
          100% { box-shadow: 0 0 0 0 rgba(56,212,200,0); }
        }
        @keyframes orb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -20px) scale(1.05); }
          66%       { transform: translate(-20px, 15px) scale(0.97); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes bar-grow {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        .landing-feature-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .landing-feature-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .landing-cta-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .landing-cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(91,156,246,0.5);
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-dark)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'DM Sans, Outfit, sans-serif',
        overflowX: 'hidden',
        position: 'relative',
      }}>

        {/* ── Background orbs ──────────────────────────────────────────────── */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
        }}>
          {/* Teal orb — top left */}
          <div style={{
            position: 'absolute', top: '-10%', left: '-10%',
            width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(56,212,200,0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'orb-drift 18s ease-in-out infinite',
          }} />
          {/* Blue orb — bottom right */}
          <div style={{
            position: 'absolute', bottom: '-15%', right: '-10%',
            width: 700, height: 700,
            background: 'radial-gradient(circle, rgba(91,156,246,0.10) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'orb-drift 22s ease-in-out infinite reverse',
          }} />
          {/* Violet orb — center */}
          <div style={{
            position: 'absolute', top: '40%', left: '50%',
            width: 400, height: 400,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'orb-drift 26s ease-in-out infinite',
          }} />
          {/* Dot grid */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />
        </div>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header style={{
          width: '100%', maxWidth: 960,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.5rem 1.5rem',
          position: 'relative', zIndex: 10,
          animation: 'fadeIn 0.6s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <img src="/favicon.svg" alt="Rift Line" style={{ width: 30, height: 30 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Rift Line</span>
          </div>
          <Link to="/login" style={{
            textDecoration: 'none',
            fontSize: '0.85rem', fontWeight: 700,
            padding: '0.45rem 1.1rem',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7,
            color: 'var(--text-primary)',
            background: 'rgba(255,255,255,0.05)',
            transition: 'background 0.15s, border-color 0.15s',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'; }}
          >
            Iniciar sesión
          </Link>
        </header>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 960, width: '100%',
          padding: '4rem 1.5rem 2rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '3rem',
          alignItems: 'center',
          position: 'relative', zIndex: 10,
        }}>
          {/* Left — text */}
          <div>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(56,212,200,0.08)',
              border: '1px solid rgba(56,212,200,0.2)',
              borderRadius: 999, padding: '0.3rem 0.85rem',
              marginBottom: '1.5rem',
              animation: 'fadeUp 0.5s ease both',
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--accent-teal-bright)',
                animation: 'pulse-ring 2s infinite',
              }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-teal-bright)', letterSpacing: '0.06em' }}>
                COMPETITIVE INTEL · PREDECESSOR
              </span>
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              lineHeight: 1.1,
              margin: '0 0 1.1rem',
              letterSpacing: '-0.025em',
              animation: 'fadeUp 0.6s ease 0.1s both',
            }}>
              Inteligencia competitiva<br />
              <span style={{
                background: 'linear-gradient(135deg, #38d4c8 0%, #5b9cf6 50%, #a78bfa 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'shimmer 4s linear infinite',
              }}>
                para equipos serios
              </span>
            </h1>

            <p style={{
              fontSize: '0.95rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              marginBottom: '2rem',
              animation: 'fadeUp 0.6s ease 0.2s both',
            }}>
              Análisis de equipo, scouting de rivales, insights automáticos y flujos de revisión estructurados para coaches, analistas y managers.
            </p>

            {/* CTAs */}
            <div style={{
              display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
              animation: 'fadeUp 0.6s ease 0.3s both',
            }}>
              <Link to="/login" className="landing-cta-btn" style={{
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                fontSize: '0.9rem', fontWeight: 700,
                padding: '0.65rem 1.5rem',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #5b9cf6, #4a85e0)',
                color: '#fff',
                border: 'none',
              }}>
                Acceder <ArrowRight size={15} />
              </Link>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <button disabled style={{
                  fontSize: '0.9rem', fontWeight: 600,
                  padding: '0.65rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  color: 'var(--text-muted)',
                  cursor: 'not-allowed',
                }}>
                  Registrarse
                </button>
                <span style={{
                  position: 'absolute', top: -11, right: -6,
                  fontSize: '0.55rem', fontWeight: 700,
                  color: 'var(--accent-prime)',
                  background: 'var(--bg-dark)',
                  border: '1px solid rgba(240,180,41,0.3)',
                  borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap',
                }}>Próximamente</span>
              </div>
            </div>

            <p style={{
              fontSize: '0.7rem', color: 'var(--text-muted)',
              marginTop: '0.9rem',
              animation: 'fadeUp 0.6s ease 0.4s both',
            }}>
              Acceso por invitación · Contacta al administrador de tu organización
            </p>
          </div>

          {/* Right — App mockup */}
          <div style={{
            animation: 'fadeUp 0.8s ease 0.2s both, floatY 6s ease-in-out 1s infinite',
          }}>
            <AppMockup />
          </div>
        </section>

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        <div style={{
          maxWidth: 960, width: '100%',
          padding: '1rem 1.5rem 2.5rem',
          display: 'flex', gap: '2rem', flexWrap: 'wrap',
          position: 'relative', zIndex: 10,
          animation: 'fadeUp 0.7s ease 0.4s both',
        }}>
          {[
            { value: '+30', label: 'Reglas de insights' },
            { value: '5',   label: 'Módulos de análisis' },
            { value: '100%', label: 'Datos reales de partida' },
          ].map(({ value, label }) => (
            <div key={label} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-teal-bright)' }}>{value}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 100, lineHeight: 1.3 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 960, width: '100%', padding: '0 1.5rem', position: 'relative', zIndex: 10 }}>
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent)' }} />
        </div>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 960, width: '100%',
          padding: '3.5rem 1.5rem 4rem',
          position: 'relative', zIndex: 10,
        }}>
          <p style={{
            textAlign: 'center',
            fontSize: '0.68rem', fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.12em',
            marginBottom: '2rem',
            animation: 'fadeIn 0.6s ease 0.5s both',
          }}>
            Módulos disponibles
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
            gap: '0.85rem',
          }}>
            {FEATURES.map(({ icon, color, title, desc }, i) => (
              <div
                key={title}
                className="landing-feature-card glass-card"
                style={{
                  display: 'flex', gap: '0.9rem', alignItems: 'flex-start',
                  padding: '1rem 1.15rem',
                  borderLeft: `3px solid ${color}`,
                  animation: `fadeUp 0.5s ease ${0.1 + i * 0.07}s both`,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{title}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA bottom ────────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 600, width: '100%',
          textAlign: 'center',
          padding: '0 1.5rem 5rem',
          position: 'relative', zIndex: 10,
          animation: 'fadeUp 0.6s ease 0.8s both',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(56,212,200,0.06), rgba(91,156,246,0.06))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '2.5rem 2rem',
          }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.6rem', letterSpacing: '-0.02em' }}>
              ¿Listo para analizar?
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Accede con tu cuenta de Rift Line o contacta a tu manager para recibir una invitación.
            </p>
            <Link to="/login" className="landing-cta-btn" style={{
              textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.95rem', fontWeight: 700,
              padding: '0.7rem 1.75rem',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #5b9cf6, #4a85e0)',
              color: '#fff',
            }}>
              Iniciar sesión <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer style={{
          width: '100%', textAlign: 'center',
          padding: '1.5rem',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          fontSize: '0.68rem', color: 'var(--text-muted)',
          position: 'relative', zIndex: 10,
        }}>
          Rift Line by Synapsight · Competitive Intel · Acceso restringido
        </footer>
      </div>
    </>
  );
}

// ── App mockup card ───────────────────────────────────────────────────────────
function AppMockup() {
  return (
    <div style={{
      background: 'rgba(30,35,48,0.8)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      overflow: 'hidden',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      {/* Window chrome */}
      <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>Rift Line — Team Analysis</span>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>Alpha Squad</div>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>OWN · 24 partidas</div>
          </div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-teal-bright)', background: 'rgba(56,212,200,0.1)', border: '1px solid rgba(56,212,200,0.25)', borderRadius: 4, padding: '2px 7px' }}>TEAM</div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { label: 'Win Rate', value: '62%', color: 'var(--accent-win)' },
            { label: 'KDA', value: '3.4', color: 'var(--accent-blue)' },
            { label: 'Throw', value: '8%', color: 'var(--accent-prime)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '0.45rem 0.5rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Mini bar chart */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0.65rem 0.75rem' }}>
          <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Objective Control</div>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-end' }}>
            <MiniBar h={78} color="var(--accent-loss)" label="FT" />
            <MiniBar h={55} color="#b91c1c" label="PFT" />
            <MiniBar h={66} color="var(--accent-violet)" label="Prime" />
            <MiniBar h={44} color="var(--accent-violet)" label="Mini" />
            <MiniBar h={30} color="#c084fc" label="Shaper" />
          </div>
        </div>

        {/* Form strip */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
          <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Forma reciente</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {['W','W','L','W','W','W','L','W','W','W'].map((r, i) => (
              <div key={i} style={{
                width: 18, height: 18, borderRadius: 3,
                background: r === 'W' ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.2)',
                border: `1px solid ${r === 'W' ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.35)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '0.45rem', fontWeight: 800, color: r === 'W' ? 'var(--accent-win)' : 'var(--accent-loss)', fontFamily: 'monospace' }}>{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Insight chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 6, padding: '0.45rem 0.65rem',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>
            Jungla muere antes de objetivos en el 60% de las partidas
          </span>
        </div>
      </div>
    </div>
  );
}
