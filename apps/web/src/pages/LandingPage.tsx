import { Link } from 'react-router';
import { BarChart2, Target, Eye, Zap, Users, Shield, ArrowRight } from 'lucide-react';

const FEATURES = [
  { icon: <BarChart2 size={18} />, color: 'var(--accent-teal-bright)', title: 'Team Analysis',    desc: 'Win rate, visión, objetivos y draft. Análisis histórico por parche.' },
  { icon: <Target size={18} />,    color: 'var(--accent-loss)',         title: 'Scrim Report',    desc: 'Inteligencia pre-partido. Ban targets y win conditions prescritos.' },
  { icon: <Eye size={18} />,       color: 'var(--accent-violet)',       title: 'Rival Scouting',  desc: 'Identidad del rival, threat players y control de objetivos.' },
  { icon: <Zap size={18} />,       color: 'var(--accent-prime)',        title: 'Analyst Insights',desc: '+30 reglas deterministas detectan patrones críticos del equipo.' },
  { icon: <Users size={18} />,     color: 'var(--accent-blue)',         title: 'Player Scouting', desc: 'Perfil completo: héroes, métricas avanzadas y evolución de forma.' },
  { icon: <Shield size={18} />,    color: 'var(--accent-win)',          title: 'Review Queue',    desc: 'Flujo de revisión vinculado a Team Goals y Player Goals.' },
];

const HEROES = [
  { slug: 'gideon',   name: 'Gideon',   role: 'Mage',     color: '#a78bfa' },
  { slug: 'kallari',  name: 'Kallari',  role: 'Assassin', color: '#f87171' },
  { slug: 'murdock',  name: 'Murdock',  role: 'Marksman', color: '#f0b429' },
  { slug: 'countess', name: 'Countess', role: 'Assassin', color: '#f87171' },
  { slug: 'drongo',   name: 'Drongo',   role: 'Marksman', color: '#f0b429' },
  { slug: 'sparrow',  name: 'Sparrow',  role: 'Marksman', color: '#f0b429' },
  { slug: 'aurora',   name: 'Aurora',   role: 'Tank',     color: '#38d4c8' },
  { slug: 'the-fey',  name: 'The Fey',  role: 'Mage',     color: '#a78bfa' },
  { slug: 'rampage',  name: 'Rampage',  role: 'Fighter',  color: '#5b9cf6' },
  { slug: 'dekker',   name: 'Dekker',   role: 'Support',  color: '#38d4c8' },
  { slug: 'steel',    name: 'Steel',    role: 'Tank',     color: '#38d4c8' },
  { slug: 'serath',   name: 'Serath',   role: 'Assassin', color: '#f87171' },
];

function HeroShowcase() {
  return (
    <div style={{ animation: 'fadeUp 0.8s ease 0.25s both', position: 'relative', zIndex: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.65rem' }}>
        {HEROES.map(({ slug, name, role, color }, i) => (
          <div key={slug}
            style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: 'rgba(20,25,36,0.9)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', animation: `fadeIn 0.4s ease ${0.05 + i * 0.05}s both`, transition: 'transform 0.2s ease, border-color 0.2s ease' }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'scale(1.05)'; el.style.borderColor = color + '55'; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'scale(1)'; el.style.borderColor = 'rgba(255,255,255,0.07)'; }}
          >
            <img src={`/heroes/${slug}.webp`} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.35rem 0.45rem' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{name}</div>
              <div style={{ fontSize: '0.5rem', color, marginTop: '0.1rem', fontWeight: 600, letterSpacing: '0.04em' }}>{role}</div>
            </div>
            <div style={{ position: 'absolute', top: 6, left: 6, width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {[
          { label: '51 Héroes', sub: 'disponibles', color: 'var(--accent-violet)' },
          { label: '5 Roles',   sub: 'de juego',    color: 'var(--accent-teal-bright)' },
          { label: 'Live Data', sub: 'pred.gg API',  color: 'var(--accent-prime)' },
        ].map(({ label, sub, color }) => (
          <div key={label} style={{ flex: 1, background: 'rgba(20,25,36,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '0.5rem 0.6rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 700, color }}>{label}</div>
            <div style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.15rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse-ring { 0%{box-shadow:0 0 0 0 rgba(56,212,200,0.4);} 70%{box-shadow:0 0 0 10px rgba(56,212,200,0);} 100%{box-shadow:0 0 0 0 rgba(56,212,200,0);} }
        @keyframes orb-drift { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(30px,-20px) scale(1.05);} 66%{transform:translate(-20px,15px) scale(0.97);} }
        @keyframes shimmer { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
        .landing-feature-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .landing-feature-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .landing-cta-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .landing-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(91,156,246,0.5); }
      `}</style>

      <div style={{ minHeight:'100vh', background:'var(--bg-dark)', display:'flex', flexDirection:'column', alignItems:'center', fontFamily:'DM Sans,Outfit,sans-serif', overflowX:'hidden', position:'relative' }}>

        {/* Orbs */}
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
          <div style={{ position:'absolute', top:'-10%', left:'-10%', width:600, height:600, background:'radial-gradient(circle, rgba(56,212,200,0.12) 0%, transparent 70%)', borderRadius:'50%', animation:'orb-drift 18s ease-in-out infinite' }} />
          <div style={{ position:'absolute', bottom:'-15%', right:'-10%', width:700, height:700, background:'radial-gradient(circle, rgba(91,156,246,0.10) 0%, transparent 70%)', borderRadius:'50%', animation:'orb-drift 22s ease-in-out infinite reverse' }} />
          <div style={{ position:'absolute', top:'40%', left:'50%', width:400, height:400, transform:'translate(-50%,-50%)', background:'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)', borderRadius:'50%', animation:'orb-drift 26s ease-in-out infinite' }} />
          <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize:'32px 32px' }} />
        </div>

        {/* Header */}
        <header style={{ width:'100%', maxWidth:960, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.5rem', position:'relative', zIndex:10, animation:'fadeIn 0.6s ease both' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.65rem' }}>
            <img src="/favicon.svg" alt="RiftLine" style={{ width:100, height:100 }} />
            <div>
              <div style={{ fontWeight:900, fontSize:'1.75rem', color:'var(--text-primary)', letterSpacing:'-0.04em', lineHeight:1 }}>RiftLine</div>
              <div style={{ fontSize:'0.68rem', color:'var(--accent-teal-bright)', letterSpacing:'0.08em', fontWeight:600, textTransform:'uppercase', marginTop:'0.2rem' }}>Competitive Intel</div>
            </div>
          </div>
          <Link to="/login" style={{ textDecoration:'none', fontSize:'0.85rem', fontWeight:700, padding:'0.45rem 1.1rem', border:'1px solid rgba(255,255,255,0.12)', borderRadius:7, color:'var(--text-primary)', background:'rgba(255,255,255,0.05)', transition:'background 0.15s' }}
            onMouseEnter={(e)=>{(e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,0.1)';}}
            onMouseLeave={(e)=>{(e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,0.05)';}}>
            Iniciar sesión
          </Link>
        </header>

        {/* Hero */}
        <section style={{ maxWidth:960, width:'100%', padding:'4rem 1.5rem 2rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3rem', alignItems:'center', position:'relative', zIndex:10 }}>
          <div>

            <h1 style={{ fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:900, color:'var(--text-primary)', lineHeight:1.1, margin:'0 0 1.1rem', letterSpacing:'-0.025em', animation:'fadeUp 0.6s ease 0.1s both' }}>
              Inteligencia competitiva<br />
              <span style={{ background:'linear-gradient(135deg,#38d4c8 0%,#5b9cf6 50%,#a78bfa 100%)', backgroundSize:'200% auto', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', animation:'shimmer 4s linear infinite' }}>
                para equipos serios
              </span>
            </h1>
            <p style={{ fontSize:'0.95rem', color:'var(--text-secondary)', lineHeight:1.7, marginBottom:'2rem', animation:'fadeUp 0.6s ease 0.2s both' }}>
              Análisis de equipo, scouting de rivales, insights automáticos y flujos de revisión estructurados para coaches, analistas y managers.
            </p>
            <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', animation:'fadeUp 0.6s ease 0.3s both' }}>
              <Link to="/login" className="landing-cta-btn" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'0.4rem', fontSize:'0.9rem', fontWeight:700, padding:'0.65rem 1.5rem', borderRadius:8, background:'linear-gradient(135deg,#5b9cf6,#4a85e0)', color:'#fff' }}>
                Acceder <ArrowRight size={15} />
              </Link>
              <div style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
                <button disabled style={{ fontSize:'0.9rem', fontWeight:600, padding:'0.65rem 1.5rem', background:'transparent', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'var(--text-muted)', cursor:'not-allowed' }}>Registrarse</button>
                <span style={{ position:'absolute', top:-11, right:-6, fontSize:'0.55rem', fontWeight:700, color:'var(--accent-prime)', background:'var(--bg-dark)', border:'1px solid rgba(240,180,41,0.3)', borderRadius:4, padding:'1px 5px', whiteSpace:'nowrap' }}>Próximamente</span>
              </div>
            </div>
            <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:'0.9rem', animation:'fadeUp 0.6s ease 0.4s both' }}>
              Acceso por invitación · Contacta al administrador de tu organización
            </p>
          </div>
          <HeroShowcase />
        </section>

        {/* Stats */}
        <div style={{ maxWidth:960, width:'100%', padding:'1rem 1.5rem 2.5rem', display:'flex', gap:'2rem', flexWrap:'wrap', position:'relative', zIndex:10, animation:'fadeUp 0.7s ease 0.4s both' }}>
          {[{value:'+30',label:'Reglas de insights'},{value:'5',label:'Módulos de análisis'},{value:'100%',label:'Datos reales de partida'}].map(({value,label})=>(
            <div key={label} style={{ display:'flex', gap:'0.6rem', alignItems:'center' }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'1.5rem', fontWeight:800, color:'var(--accent-teal-bright)' }}>{value}</span>
              <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', maxWidth:100, lineHeight:1.3 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ maxWidth:960, width:'100%', padding:'0 1.5rem', position:'relative', zIndex:10 }}>
          <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.07) 30%,rgba(255,255,255,0.07) 70%,transparent)' }} />
        </div>

        {/* Features */}
        <section style={{ maxWidth:960, width:'100%', padding:'3.5rem 1.5rem 4rem', position:'relative', zIndex:10 }}>
          <p style={{ textAlign:'center', fontSize:'0.68rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'2rem', animation:'fadeIn 0.6s ease 0.5s both' }}>Módulos disponibles</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(270px,1fr))', gap:'0.85rem' }}>
            {FEATURES.map(({icon,color,title,desc},i)=>(
              <div key={title} className="landing-feature-card glass-card" style={{ display:'flex', gap:'0.9rem', alignItems:'flex-start', padding:'1rem 1.15rem', borderLeft:`3px solid ${color}`, animation:`fadeUp 0.5s ease ${0.1+i*0.07}s both` }}>
                <div style={{ width:36, height:36, borderRadius:8, flexShrink:0, background:`${color}15`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', color }}>{icon}</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--text-primary)', marginBottom:'0.2rem' }}>{title}</div>
                  <div style={{ fontSize:'0.76rem', color:'var(--text-muted)', lineHeight:1.55 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA bottom */}
        <section style={{ maxWidth:600, width:'100%', textAlign:'center', padding:'0 1.5rem 5rem', position:'relative', zIndex:10, animation:'fadeUp 0.6s ease 0.8s both' }}>
          <div style={{ background:'linear-gradient(135deg,rgba(56,212,200,0.06),rgba(91,156,246,0.06))', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'2.5rem 2rem' }}>
            <h2 style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text-primary)', margin:'0 0 0.6rem', letterSpacing:'-0.02em' }}>¿Listo para analizar?</h2>
            <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', margin:'0 0 1.5rem', lineHeight:1.6 }}>Accede con tu cuenta de RiftLine o contacta a tu manager para recibir una invitación.</p>
            <Link to="/login" className="landing-cta-btn" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'0.4rem', fontSize:'0.95rem', fontWeight:700, padding:'0.7rem 1.75rem', borderRadius:8, background:'linear-gradient(135deg,#5b9cf6,#4a85e0)', color:'#fff' }}>
              Iniciar sesión <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <footer style={{ width:'100%', textAlign:'center', padding:'1.5rem', borderTop:'1px solid rgba(255,255,255,0.05)', fontSize:'0.68rem', color:'var(--text-muted)', position:'relative', zIndex:10 }}>
          RiftLine by Synapsight · Competitive Intel · Acceso restringido
        </footer>
      </div>
    </>
  );
}
