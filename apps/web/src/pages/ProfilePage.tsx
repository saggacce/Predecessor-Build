import { useEffect, useState } from 'react';
import { Camera, Key, Link2, Link2Off, Save, Shield, Star, User } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type UserProfile } from '../api/client';

const PLAYER_TIER_CONFIG = {
  FREE:    { label: 'Free',    color: 'var(--text-muted)',        bg: 'rgba(100,116,139,0.1)' },
  PRO:     { label: 'Pro',     color: 'var(--accent-blue)',       bg: 'rgba(91,156,246,0.12)' },
  PREMIUM: { label: 'Premium', color: 'var(--accent-prime)',      bg: 'rgba(240,180,41,0.12)' },
};

const TEAM_TIER_CONFIG = {
  FREE:       { label: 'Free',       color: 'var(--text-muted)',          bg: 'rgba(100,116,139,0.1)' },
  PRO:        { label: 'Pro',        color: 'var(--accent-blue)',          bg: 'rgba(91,156,246,0.12)' },
  TEAM:       { label: 'Team',       color: 'var(--accent-teal-bright)',   bg: 'rgba(56,212,200,0.12)' },
  ENTERPRISE: { label: 'Enterprise', color: 'var(--accent-prime)',         bg: 'rgba(240,180,41,0.12)' },
};

const TIMEZONES = [
  'UTC', 'Europe/Madrid', 'Europe/London', 'America/New_York',
  'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Australia/Sydney',
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'security' | 'social' | 'membership'>('info');

  // Profile form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [timezone, setTimezone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Email form
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    apiClient.profile.get()
      .then(({ user }) => {
        setProfile(user);
        setName(user.name);
        setBio(user.bio ?? '');
        setAvatarUrl(user.avatarUrl ?? '');
        setTimezone(user.timezone ?? '');
        setLoading(false);
      })
      .catch(() => { toast.error('Error cargando perfil'); setLoading(false); });
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const { user } = await apiClient.profile.update({
        name: name.trim() || undefined,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        timezone: timezone || null,
      });
      setProfile(user);
      toast.success('Perfil actualizado');
    } catch { toast.error('Error al guardar'); }
    finally { setSavingProfile(false); }
  }

  async function changePassword() {
    if (newPw !== confirmPw) { toast.error('Las contraseñas no coinciden'); return; }
    if (newPw.length < 8) { toast.error('Mínimo 8 caracteres'); return; }
    setSavingPw(true);
    try {
      await apiClient.profile.changePassword(currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      toast.success('Contraseña actualizada');
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      toast.error(msg ?? 'Error al cambiar contraseña');
    }
    finally { setSavingPw(false); }
  }

  async function changeEmail() {
    setSavingEmail(true);
    try {
      const { user } = await apiClient.profile.changeEmail(newEmail, emailPw);
      setProfile(user);
      setNewEmail(''); setEmailPw('');
      toast.success('Email actualizado');
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      toast.error(msg ?? 'Error al cambiar email');
    }
    finally { setSavingEmail(false); }
  }

  async function disconnect(provider: 'discord' | 'epic' | 'steam') {
    try {
      await apiClient.profile.disconnectSocial(provider);
      setProfile((p) => p ? { ...p,
        discordId: provider === 'discord' ? null : p.discordId,
        discordUsername: provider === 'discord' ? null : p.discordUsername,
        epicGamesId: provider === 'epic' ? null : p.epicGamesId,
        epicGamesUsername: provider === 'epic' ? null : p.epicGamesUsername,
        steamId: provider === 'steam' ? null : p.steamId,
        steamUsername: provider === 'steam' ? null : p.steamUsername,
      } : p);
      toast.success('Cuenta desconectada');
    } catch { toast.error('Error al desconectar'); }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Cargando perfil…</div>;
  if (!profile) return <div style={{ padding: '2rem', color: 'var(--accent-loss)' }}>No se pudo cargar el perfil.</div>;

  const playerTier = PLAYER_TIER_CONFIG[profile.playerTier] ?? PLAYER_TIER_CONFIG.FREE;
  const initials = profile.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  const TABS = [
    { id: 'info' as const, label: 'Información', icon: <User size={14} /> },
    { id: 'security' as const, label: 'Seguridad', icon: <Key size={14} /> },
    { id: 'social' as const, label: 'Conexiones', icon: <Link2 size={14} /> },
    { id: 'membership' as const, label: 'Membresía', icon: <Star size={14} /> },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: 740 }}>
      {/* Header */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{initials}</span>
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{profile.name}</h1>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: playerTier.color, background: playerTier.bg, padding: '2px 8px', borderRadius: 999, border: `1px solid ${playerTier.color}40` }}>
              {playerTier.label.toUpperCase()}
            </span>
            {profile.globalRole === 'PLATFORM_ADMIN' && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent-teal-bright)', background: 'rgba(56,212,200,0.1)', padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Shield size={9} /> ADMIN
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{profile.email}</div>
          {profile.bio && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>{profile.bio}</div>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: tab === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent' }}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* Tab: Información */}
      {tab === 'info' && (
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Información de perfil</h2>

          {/* Avatar preview + URL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <Camera size={18} style={{ color: 'var(--text-muted)' }} />
              }
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>URL del avatar</label>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '0.4rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.88rem' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Bio <span style={{ color: 'var(--text-muted)' }}>({bio.length}/300)</span></label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder="Una frase sobre ti…" style={{ width: '100%', padding: '0.45rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Zona horaria</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} style={{ padding: '0.45rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <option value="">— Sin especificar —</option>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          <button onClick={saveProfile} disabled={savingProfile} className="btn-primary" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Save size={13} /> {savingProfile ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Tab: Seguridad */}
      {tab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Change email */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700 }}>Cambiar email</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.8rem' }}>Email actual: <b style={{ color: 'var(--text-secondary)' }}>{profile.email}</b></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Nuevo email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ width: '100%', padding: '0.42rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.85rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Contraseña actual (confirmación)</label>
                <input type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} style={{ width: '100%', padding: '0.42rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.85rem' }} />
              </div>
              <button onClick={changeEmail} disabled={savingEmail || !newEmail || !emailPw} className="btn-primary" style={{ alignSelf: 'flex-start', fontSize: '0.82rem', padding: '0.42rem 1rem' }}>
                {savingEmail ? 'Actualizando…' : 'Cambiar email'}
              </button>
            </div>
          </div>

          {/* Change password */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700 }}>Cambiar contraseña</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {[
                { label: 'Contraseña actual', value: currentPw, set: setCurrentPw },
                { label: 'Nueva contraseña (mín. 8 caracteres)', value: newPw, set: setNewPw },
                { label: 'Confirmar nueva contraseña', value: confirmPw, set: setConfirmPw },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>{label}</label>
                  <input type="password" value={value} onChange={(e) => set(e.target.value)} style={{ width: '100%', padding: '0.42rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                </div>
              ))}
              <button onClick={changePassword} disabled={savingPw || !currentPw || !newPw || !confirmPw} className="btn-primary" style={{ alignSelf: 'flex-start', fontSize: '0.82rem', padding: '0.42rem 1rem' }}>
                {savingPw ? 'Actualizando…' : 'Cambiar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Conexiones sociales */}
      {tab === 'social' && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '0.9rem', fontWeight: 700 }}>Cuentas conectadas</h2>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
            Conecta tus cuentas de juego y servicios. Los flujos de autorización OAuth estarán disponibles próximamente.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {([
              { provider: 'discord' as const, label: 'Discord', color: '#5865F2', id: profile.discordId, username: profile.discordUsername, icon: '🎮' },
              { provider: 'epic' as const, label: 'Epic Games', color: '#fff', id: profile.epicGamesId, username: profile.epicGamesUsername, icon: '🎮' },
              { provider: 'steam' as const, label: 'Steam', color: '#1b2838', id: profile.steamId, username: profile.steamUsername, icon: '🎮' },
            ] as const).map(({ provider, label, color, id, username }) => (
              <div key={provider} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: 8, background: id ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                    {label[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{label}</div>
                    <div style={{ fontSize: '0.72rem', color: id ? 'var(--accent-win)' : 'var(--text-muted)' }}>
                      {id ? (username ?? id) : 'No conectado'}
                    </div>
                  </div>
                </div>
                {id ? (
                  <button onClick={() => void disconnect(provider)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 6, background: 'transparent', color: 'var(--accent-loss)', cursor: 'pointer', fontSize: '0.75rem' }}>
                    <Link2Off size={12} /> Desconectar
                  </button>
                ) : (
                  <button disabled style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', cursor: 'not-allowed', fontSize: '0.75rem', opacity: 0.6 }}>
                    <Link2 size={12} /> Conectar <span style={{ fontSize: '0.6rem', color: 'var(--accent-prime)', marginLeft: 2 }}>Próximamente</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Membresía */}
      {tab === 'membership' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Player tier */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 0.3rem', fontSize: '0.9rem', fontWeight: 700 }}>Tier de jugador</h2>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              Acceso a funciones personales: historial completo, métricas avanzadas, insights individuales y LLM coach.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem', border: `1px solid ${playerTier.color}40`, borderRadius: 8, background: playerTier.bg, marginBottom: '1rem' }}>
              <Star size={18} style={{ color: playerTier.color, flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 800, color: playerTier.color }}>{playerTier.label}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                  {profile.playerTierExpiresAt
                    ? `hasta ${new Date(profile.playerTierExpiresAt).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`
                    : profile.playerTier === 'FREE' ? 'gratuito' : 'sin expiración'
                  }
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
              {([
                { tier: 'FREE',    label: 'Free',    color: 'var(--text-muted)',    features: ['Últimas 20 partidas', 'Stats básicos', 'Hero pool propio'] },
                { tier: 'PRO',     label: 'Pro',     color: 'var(--accent-blue)',   features: ['Historial completo', 'GPM, DPM, KP', 'Insights personales', 'Player Goals'] },
                { tier: 'PREMIUM', label: 'Premium', color: 'var(--accent-prime)',  features: ['Todo Pro', 'LLM Coach personal', 'Focus of the Day', 'Análisis de tendencias'] },
              ] as const).map(({ tier: t, label, color, features }) => {
                const isCurrent = profile.playerTier === t;
                return (
                  <div key={t} style={{ padding: '0.8rem', border: `1px solid ${isCurrent ? color : 'var(--border-color)'}`, borderRadius: 8, background: isCurrent ? `${color}12` : 'transparent' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color, marginBottom: '0.5rem' }}>
                      {label}{isCurrent && <span style={{ fontSize: '0.55rem', background: `${color}20`, borderRadius: 999, padding: '1px 5px', marginLeft: 4 }}>ACTUAL</span>}
                    </div>
                    {features.map((f) => <div key={f} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>✓ {f}</div>)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team tier — from memberships */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 0.3rem', fontSize: '0.9rem', fontWeight: 700 }}>Tier de equipo</h2>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              Acceso a funciones colectivas: análisis de equipo, Scrim Report, Review Queue, Discord Bot. Lo gestiona el responsable del equipo.
            </p>
            {profile.memberships.filter((m) => m.team.type === 'OWN').length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No perteneces a ningún equipo OWN actualmente.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {profile.memberships.filter((m) => m.team.type === 'OWN').map((m) => {
                  const tt = TEAM_TIER_CONFIG[m.team.teamTier as keyof typeof TEAM_TIER_CONFIG] ?? TEAM_TIER_CONFIG.FREE;
                  return (
                    <div key={m.team.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: `1px solid ${tt.color}30`, borderRadius: 8, background: tt.bg }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{m.team.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.6rem' }}>{m.role}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: tt.color, background: `${tt.color}15`, padding: '2px 8px', borderRadius: 999 }}>{tt.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
              {([
                { tier: 'FREE',       label: 'Free',       color: 'var(--text-muted)',          features: ['Team Analysis', 'Rival Scouting', '3 rivales'] },
                { tier: 'PRO',        label: 'Pro',        color: 'var(--accent-blue)',          features: ['Rivales ilimitados', 'Scrim Report', 'Review Queue', 'Insights'] },
                { tier: 'TEAM',       label: 'Team',       color: 'var(--accent-teal-bright)',   features: ['Todo Pro', 'Discord Bot', 'LLM colectivo', 'Tactical Board'] },
                { tier: 'ENTERPRISE', label: 'Enterprise', color: 'var(--accent-prime)',         features: ['Todo Team', 'API access', 'White-label', 'Soporte prio.'] },
              ] as const).map(({ tier: t, label, color, features }) => (
                <div key={t} style={{ padding: '0.7rem', border: `1px solid var(--border-color)`, borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.75rem', color, marginBottom: '0.4rem' }}>{label}</div>
                  {features.map((f) => <div key={f} style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '0.12rem' }}>✓ {f}</div>)}
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
              El tier del equipo lo gestiona el Manager o un Platform Admin desde el panel de administración.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
