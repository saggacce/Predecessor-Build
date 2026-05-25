import { useEffect, useRef, useState } from 'react';
import { Search, UserMinus, ArrowUpDown, Users, Plus, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiErrorResponse, type TeamProfile, type PlayerSearchResult, type TeamRole, type RosterMember, type RosterStatus } from '../api/client';
import { useAuth } from '../hooks/useAuth';

const ROLES: TeamRole[] = ['carry', 'jungle', 'midlane', 'offlane', 'support'];

const ROLE_LABEL: Record<string, string> = {
  CARRY: 'Carry', JUNGLE: 'Jungle', MIDLANE: 'Mid', OFFLANE: 'Offlane', SUPPORT: 'Support',
};
const ROLE_COLOR: Record<string, string> = {
  CARRY: 'var(--accent-loss)', JUNGLE: 'var(--accent-win)', MIDLANE: 'var(--accent-blue)',
  OFFLANE: 'var(--accent-prime)', SUPPORT: 'var(--accent-teal-bright)',
};

export default function TeamRoster() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [teamId, setTeamId] = useState('');
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Add player
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addRole, setAddRole] = useState<TeamRole | undefined>(undefined);
  const [addStatus, setAddStatus] = useState<RosterStatus>('STARTER');
  const [adding, setAdding] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit state
  const [toggling, setToggling] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const isPlatformAdmin = user?.globalRole === 'PLATFORM_ADMIN';
  const isManager = user?.memberships?.some((m) => m.role === 'MANAGER') ?? false;
  const canEdit = isPlatformAdmin || isManager;

  useEffect(() => {
    apiClient.teams.list('OWN')
      .then((res) => {
        const ownTeams = res.teams ?? [];
        setTeams(ownTeams);
        if (ownTeams.length > 0) setTeamId(ownTeams[0].id);
      })
      .catch(() => toast.error('No se pudieron cargar los equipos.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!teamId) return;
    setProfile(null);
    apiClient.teams.getProfile(teamId).then(setProfile).catch(() => null);
  }, [teamId]);

  async function refreshProfile() {
    if (!teamId) return;
    const updated = await apiClient.teams.getProfile(teamId);
    setProfile(updated);
  }

  function handleSearch(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiClient.players.search(q.trim(), 10);
        setResults(data.results ?? []);
      } catch { /* silent */ } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function handleAdd(player: PlayerSearchResult) {
    if (!teamId) return;
    setAdding(true);
    try {
      await apiClient.teams.addPlayer(teamId, player.id, addRole, addStatus);
      toast.success(`${player.displayName} añadido al roster.`);
      setQuery(''); setResults([]);
      await refreshProfile();
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Error al añadir jugador.');
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleStatus(member: RosterMember) {
    const next: RosterStatus = member.rosterStatus === 'STARTER' ? 'BENCH' : 'STARTER';
    setToggling(member.rosterId);
    try {
      await apiClient.teams.updateRoster(teamId, member.rosterId, member.role as TeamRole | null, next);
      toast.success(`${member.customName ?? member.displayName} → ${next === 'STARTER' ? 'Titular' : 'Suplente'}`);
      await refreshProfile();
    } catch {
      toast.error('Error al cambiar estado.');
    } finally {
      setToggling(null);
    }
  }

  async function handleChangeRole(member: RosterMember, role: TeamRole | null) {
    try {
      await apiClient.teams.updateRoster(teamId, member.rosterId, role, member.rosterStatus);
      await refreshProfile();
    } catch {
      toast.error('Error al cambiar rol.');
    }
  }

  async function handleRemove(member: RosterMember) {
    setRemoving(member.rosterId);
    try {
      await apiClient.teams.removePlayer(teamId, member.rosterId);
      toast.success(`${member.customName ?? member.displayName} retirado del roster.`);
      await refreshProfile();
    } catch {
      toast.error('Error al retirar jugador.');
    } finally {
      setRemoving(null);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Cargando…</div>;

  const starters = profile?.roster.filter((m) => m.rosterStatus === 'STARTER') ?? [];
  const bench = profile?.roster.filter((m) => m.rosterStatus === 'BENCH') ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="header">
        <h1 className="header-title">Teams & Roster</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
          Gestión de roster, posiciones y estado de jugadores.
        </p>
      </header>

      {/* Team selector */}
      {teams.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>Equipo</span>
          <div style={{ position: 'relative' }}>
            <select
              className="input"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              style={{ paddingRight: '2rem', appearance: 'none', minWidth: 200 }}
            >
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        </div>
      )}

      {!profile && <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>Cargando roster…</div>}

      {profile && (
        <>
          {/* STARTERS */}
          <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Users size={14} style={{ color: 'var(--accent-teal-bright)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-teal-bright)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Titulares
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {starters.length} / 5
              </span>
            </div>
            {starters.length === 0 && (
              <div style={{ padding: '1.25rem 1.1rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>Sin titulares asignados.</div>
            )}
            {starters.map((m) => (
              <PlayerRow
                key={m.rosterId}
                member={m}
                canEdit={canEdit}
                toggling={toggling === m.rosterId}
                removing={removing === m.rosterId}
                onToggle={() => void handleToggleStatus(m)}
                onRemove={() => void handleRemove(m)}
                onChangeRole={(role) => void handleChangeRole(m, role)}
              />
            ))}
          </section>

          {/* BENCH */}
          <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Users size={14} style={{ color: 'var(--accent-prime)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-prime)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Suplentes
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {bench.length}
              </span>
            </div>
            {bench.length === 0 && (
              <div style={{ padding: '1.25rem 1.1rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>Sin suplentes.</div>
            )}
            {bench.map((m) => (
              <PlayerRow
                key={m.rosterId}
                member={m}
                canEdit={canEdit}
                toggling={toggling === m.rosterId}
                removing={removing === m.rosterId}
                onToggle={() => void handleToggleStatus(m)}
                onRemove={() => void handleRemove(m)}
                onChangeRole={(role) => void handleChangeRole(m, role)}
              />
            ))}
          </section>

          {/* ADD PLAYER */}
          {canEdit && (
            <section className="glass-card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <Plus size={14} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Añadir jugador
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <Search size={13} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    className="input"
                    placeholder="Buscar jugador por nombre…"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    style={{ paddingLeft: '2rem' }}
                  />
                </div>
                <select className="input" value={addRole ?? ''} onChange={(e) => setAddRole((e.target.value as TeamRole) || undefined)} style={{ minWidth: 120 }}>
                  <option value="">Sin rol</option>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r.toUpperCase()]}</option>)}
                </select>
                <select className="input" value={addStatus} onChange={(e) => setAddStatus(e.target.value as RosterStatus)} style={{ minWidth: 120 }}>
                  <option value="STARTER">Titular</option>
                  <option value="BENCH">Suplente</option>
                </select>
              </div>
              {searching && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Buscando…</div>}
              {results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {results.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.75rem', borderRadius: 6, background: 'var(--bg-hover)' }}>
                      <span style={{ flex: 1, fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600 }}>{p.displayName}</span>
                      <button
                        className="btn-primary"
                        disabled={adding}
                        onClick={() => void handleAdd(p)}
                        style={{ fontSize: '0.72rem', padding: '0.3rem 0.85rem' }}
                      >
                        Añadir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({
  member, canEdit, toggling, removing, onToggle, onRemove, onChangeRole,
}: {
  member: RosterMember;
  canEdit: boolean;
  toggling: boolean;
  removing: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChangeRole: (role: TeamRole | null) => void;
}) {
  const role = member.role?.toUpperCase() ?? '';
  const isBench = member.rosterStatus === 'BENCH';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.1rem', borderBottom: '1px solid var(--border-color)' }}>
      {/* Role selector */}
      {canEdit ? (
        <select
          value={member.role ?? ''}
          onChange={(e) => onChangeRole((e.target.value as TeamRole) || null)}
          style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, border: `1px solid ${ROLE_COLOR[role] ?? 'var(--border-color)'}44`, background: 'transparent', color: ROLE_COLOR[role] ?? 'var(--text-muted)', fontFamily: 'var(--font-mono)', cursor: 'pointer', minWidth: 70 }}
        >
          <option value="">Sin rol</option>
          {(['CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE', 'SUPPORT']).map((r) => (
            <option key={r} value={r.toLowerCase()}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      ) : (
        role ? (
          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, border: `1px solid ${ROLE_COLOR[role]}44`, color: ROLE_COLOR[role], fontFamily: 'var(--font-mono)', minWidth: 70, textAlign: 'center' }}>
            {ROLE_LABEL[role]}
          </span>
        ) : (
          <span style={{ minWidth: 70 }} />
        )
      )}

      {/* Name */}
      <span style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem', color: isBench ? 'var(--text-muted)' : 'var(--text-primary)' }}>
        {member.customName ?? member.displayName}
      </span>

      {/* Rank */}
      {member.rating?.rankLabel && (
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {member.rating.rankLabel}
        </span>
      )}

      {canEdit && (
        <>
          {/* Bench / Activar */}
          <button
            className="btn-secondary"
            disabled={toggling}
            onClick={onToggle}
            style={{ fontSize: '0.7rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: isBench ? 'var(--accent-teal-bright)' : 'var(--accent-prime)', opacity: toggling ? 0.5 : 1, minWidth: 80 }}
          >
            <ArrowUpDown size={11} />
            {isBench ? 'Activar' : 'Bench'}
          </button>

          {/* Remove */}
          <button
            className="btn-secondary"
            disabled={removing}
            onClick={onRemove}
            style={{ padding: '0.35rem', color: 'var(--accent-loss)', opacity: removing ? 0.5 : 1 }}
            title="Retirar del roster"
          >
            <UserMinus size={14} />
          </button>
        </>
      )}
    </div>
  );
}
