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

// ── Hero Showcase ────────────────────────────────────────────────────────────

const SHOWCASE_HEROES: Array<{ slug: string; name: string; role: string; color: string }> = [
  { slug: 'gideon',    name: 'Gideon',    role: 'Mage',        color: '#a78bfa' },
  { slug: 'kallari',   name: 'Kallari',   role: 'Assassin',    color: '#f87171' },
  { slug: 'murdock',   name: 'Murdock',   role: 'Marksman',    color: '#f0b429' },
  { slug: 'countess',  name: 'Countess',  role: 'Assassin',    color: '#f87171' },
  { slug: 'drongo',    name: 'Drongo',    role: 'Marksman',    color: '#f0b429' },
  { slug: 'sparrow',   name: 'Sparrow',   role: 'Marksman',    color: '#f0b429' },
  { slug: 'aurora',    name: 'Aurora',    role: 'Tank',        color: '#38d4c8' },
  { slug: 'the-fey',   name: 'The Fey',   role: 'Mage',        color: '#a78bfa' },
  { slug: 'rampage',   name: 'Rampage',   role: 'Fighter',     color: '#5b9cf6' },
  { slug: 'dekker',    name: 'Dekker',    role: 'Support',     color: '#38d4c8' },
  { slug: 'steel',     name: 'Steel',     role: 'Tank',        color: '#38d4c8' },
  { slug: 'serath',    name: 'Serath',    role: 'Assassin',    color: '#f87171' },
];

function HeroShowcase() {
  return (
    <div style={{ animation: 'fadeUp 0.8s ease 0.25s both', position: 'relative', zIndex: 10 }}>
      {/* Hero grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      }}>
        {SHOWCASE_HEROES.map(({ slug, name, role, color }, i) => (
          <div
            key={slug}
            style={{
              position: 'relative',
              borderRadius: 10,
              overflow: 'hidden',
              aspectRatio: '1',
              background: 'rgba(20,25,36,0.9)',
              border: `1px solid rgba(255,255,255,0.07)`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              animation: `fadeIn 0.4s ease ${0.1 + i * 0.05}s both`,
              cursor: 'default',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'scale(1.04)';
              el.style.borderColor = color + '60';
              el.style.zIndex = '2';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'scale(1)';
              el.style.borderColor = 'rgba(255,255,255,0.07)';
              el.style.zIndex = '1';
            }}
          >
            <img
              src={`/heroes/${slug}.webp`}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
            }} />
            {/* Name + role */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '0.35rem 0.4rem',
            }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{name}</div>
              <div style={{ fontSize: '0.5rem', color, marginTop: '0.1rem', fontWeight: 600, letterSpacing: '0.04em' }}>{role}</div>
            </div>
            {/* Color accent top-left */}
            <div style={{
              position: 'absolute', top: 6, left: 6,
              width: 5, height: 5, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }} />
          </div>
        ))}
      </div>

      {/* Bottom chips */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {[
          { label: '51 Héroes', value: 'disponibles', color: 'var(--accent-violet)' },
          { label: '5 Roles',   value: 'de juego',    color: 'var(--accent-teal-bright)' },
          { label: 'Live data', value: 'pred.gg API', color: 'var(--accent-prime)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1,
            background: 'rgba(20,25,36,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
            padding: '0.55rem 0.65rem',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color }}>{label}</div>
            <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.15rem', letterSpacing: '0.04em' }}>{value.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
