import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router';
import { HeroAvatarWithTooltip } from '../components/HeroAvatar';
import { useHeroMeta } from '../hooks/useHeroMeta';
import { ArrowLeft, Trophy, Skull, Clock, RefreshCw, Pencil, Check, X, Monitor, Gamepad2, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type MatchDetail as MatchDetailData, type MatchPlayerDetail, type MatchEvents, ApiErrorResponse } from '../api/client';

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = location.state as { fromPlayerId?: string; fromPlayerName?: string } | null;
  const heroMeta = useHeroMeta();
  const [match, setMatch] = useState<MatchDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'scoreboard' | 'statistics' | 'timeline' | 'analysis'>('scoreboard');
  const [syncing, setSyncing] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const data = await apiClient.matches.getDetail(id);
        setMatch(data);
        // Auto-sync when event stream is missing — also resolves player names via Bearer
        if (!data.eventStreamSynced) {
          setSyncing(true);
          try {
            const updated = await apiClient.matches.syncPlayers(id);
            setMatch(updated);
          } catch {
            // Silent — requires auth; user can retry manually
          } finally {
            setSyncing(false);
          }
        }
      } catch (err) {
        toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to load match.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSaveCustomName(playerId: string) {
    try {
      await apiClient.players.setCustomName(playerId, editingValue.trim() || null);
      setEditingPlayerId(null);
      const updated = await apiClient.matches.getDetail(id!);
      setMatch(updated);
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to save name.');
    }
  }

  async function handleSyncPlayers() {
    if (!id) return;
    setSyncing(true);
    const toastId = toast.loading('Syncing match data from pred.gg…');
    try {
      const updated = await apiClient.matches.syncPlayers(id);
      setMatch(updated);
      toast.success('Match data updated', { id: toastId });
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to sync match.', { id: toastId });
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading match…</div>;
  if (!match) return <div style={{ padding: '2rem', color: 'var(--accent-loss)' }}>Match not found.</div>;

  const isAram = match.gameMode === 'ARAM' || match.gameMode === 'BRAWL';
  const duskWon = match.winningTeam === 'DUSK';
  const dawnWon = match.winningTeam === 'DAWN';
  const hasHidden = [...match.dusk, ...match.dawn].some((p) => p.playerName === 'HIDDEN');
  const fullySynced = match.rosterSynced && match.eventStreamSynced;
  const showSyncButton = !fullySynced || hasHidden;

  const tabs: { key: typeof tab; label: string; disabled?: boolean }[] = [
    { key: 'scoreboard', label: 'Scoreboard' },
    { key: 'statistics', label: 'Statistics' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'analysis', label: 'Analysis' },
  ];

  return (
    <div>
      <header className="header" style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => fromState?.fromPlayerId
            ? navigate('/analysis/players', { state: { autoLoadPlayerId: fromState.fromPlayerId } })
            : navigate(-1)
          }
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem', padding: 0 }}
        >
          <ArrowLeft size={16} />
          {fromState?.fromPlayerName ? `Back to ${fromState.fromPlayerName}` : 'Back'}
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 className="header-title" style={{ marginBottom: '0.25rem' }}>Match Detail</h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                {match.predggUuid}
              </span>
              <GameModeBadge mode={match.gameMode} />
              {match.region && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{match.region.toUpperCase()}</span>}
              {showSyncButton && (
                <button
                  onClick={() => void handleSyncPlayers()}
                  disabled={syncing}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: syncing ? 'not-allowed' : 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)', opacity: syncing ? 0.6 : 1 }}
                >
                  <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                  {syncing ? 'Syncing…' : hasHidden ? 'Fetch player names' : !match.rosterSynced ? 'Sync match' : 'Sync events'}
                </button>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {new Date(match.startTime).toLocaleDateString()} · {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', marginTop: '0.2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <Clock size={13} /> <span style={{ fontFamily: 'var(--font-mono)' }}>{formatDuration(match.duration)}</span>
            </div>
            {match.version && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Patch {match.version}</div>}
          </div>
        </div>
      </header>

      {/* Team score banner */}
      <TeamScoreBanner match={match} duskWon={duskWon} dawnWon={dawnWon} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            disabled={t.disabled}
            onClick={() => !t.disabled && setTab(t.key)}
            style={{
              background: 'transparent', border: 'none', cursor: t.disabled ? 'not-allowed' : 'pointer',
              padding: '0.6rem 1.1rem', fontSize: '0.875rem', fontWeight: 600,
              color: tab === t.key ? 'var(--accent-blue)' : t.disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
              borderBottom: tab === t.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              opacity: t.disabled ? 0.4 : 1,
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'scoreboard' && (
        <ScoreboardTab
          match={match} duskWon={duskWon} dawnWon={dawnWon} isAram={isAram}
          heroMeta={heroMeta}
          editingPlayerId={editingPlayerId} editingValue={editingValue}
          onStartEdit={(playerId, current) => { setEditingPlayerId(playerId); setEditingValue(current); }}
          onSaveEdit={handleSaveCustomName}
          onCancelEdit={() => setEditingPlayerId(null)}
          onEditValueChange={setEditingValue}
        />
      )}
      {tab === 'statistics' && (
        <StatisticsTab match={match} duskWon={duskWon} dawnWon={dawnWon} onResync={handleSyncPlayers} syncing={syncing} />
      )}
      {tab === 'timeline' && (
        <TimelineTab match={match} onResync={handleSyncPlayers} syncing={syncing} />
      )}
      {tab === 'analysis' && (
        <AnalysisTab match={match} duskWon={duskWon} dawnWon={dawnWon} onResync={handleSyncPlayers} syncing={syncing} />
      )}
    </div>
  );
}

function TeamScoreBanner({ match, duskWon, dawnWon }: { match: MatchDetailData; duskWon: boolean; dawnWon: boolean }) {
  const duskKills = match.dusk.reduce((s, p) => s + p.kills, 0);
  const dawnKills = match.dawn.reduce((s, p) => s + p.kills, 0);
  const duskGold = match.dusk.reduce((s, p) => s + (p.gold ?? 0), 0);
  const dawnGold = match.dawn.reduce((s, p) => s + (p.gold ?? 0), 0);

  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', marginBottom: '1rem', gap: '1rem' }}>
      {/* DUSK side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
        <div style={{ width: 4, height: 36, borderRadius: 999, background: duskWon ? 'var(--accent-win)' : 'var(--accent-loss)', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent-teal-bright)', letterSpacing: '0.08em' }}>DUSK</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{(duskGold / 1000).toFixed(1)}k gold</div>
        </div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: duskWon ? 'var(--accent-win)' : 'var(--accent-loss)', fontFamily: 'var(--font-mono)', background: duskWon ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${duskWon ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.35)'}`, borderRadius: '4px', padding: '0.15rem 0.5rem' }}>
          {duskWon ? 'VICTORY' : 'DEFEAT'}
        </div>
      </div>

      {/* Score */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
          <span style={{ color: duskWon ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{duskKills}</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 0.5rem', fontSize: '1.4rem' }}>—</span>
          <span style={{ color: dawnWon ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{dawnKills}</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>KILLS</div>
      </div>

      {/* DAWN side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, justifyContent: 'flex-end' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: dawnWon ? 'var(--accent-win)' : 'var(--accent-loss)', fontFamily: 'var(--font-mono)', background: dawnWon ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${dawnWon ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.35)'}`, borderRadius: '4px', padding: '0.15rem 0.5rem' }}>
          {dawnWon ? 'VICTORY' : 'DEFEAT'}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent-loss)', letterSpacing: '0.08em' }}>DAWN</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{(dawnGold / 1000).toFixed(1)}k gold</div>
        </div>
        <div style={{ width: 4, height: 36, borderRadius: 999, background: dawnWon ? 'var(--accent-win)' : 'var(--accent-loss)', flexShrink: 0 }} />
      </div>
    </div>
  );
}

function HeaderTooltip({ label, tip, style }: { label: string; tip: string; style?: React.CSSProperties }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', cursor: 'help', ...style }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {label}
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '6px', padding: '0.5rem 0.8rem', fontSize: '0.72rem',
          color: 'var(--text-secondary)', fontWeight: 400, textTransform: 'none',
          letterSpacing: 'normal', whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)', pointerEvents: 'none',
        }}>
          {tip}
        </div>
      )}
    </span>
  );
}

function ScoreboardTab({ match, duskWon, dawnWon, isAram, heroMeta, editingPlayerId, editingValue, onStartEdit, onSaveEdit, onCancelEdit, onEditValueChange }: {
  match: MatchDetailData;
  duskWon: boolean;
  dawnWon: boolean;
  isAram: boolean;
  heroMeta: Map<string, import('../api/client').HeroMeta>;
  editingPlayerId: string | null;
  editingValue: string;
  onStartEdit: (playerId: string, current: string) => void;
  onSaveEdit: (playerId: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (v: string) => void;
}) {
  const teams: Array<{ key: 'dusk' | 'dawn'; label: string; players: MatchPlayerDetail[]; won: boolean }> = [
    { key: 'dusk', label: 'Dusk', players: match.dusk, won: duskWon },
    { key: 'dawn', label: 'Dawn', players: match.dawn, won: dawnWon },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {teams.map(({ key, label, players, won }) => {
        const totalKills = players.reduce((s, p) => s + p.kills, 0);
        const totalGold = players.reduce((s, p) => s + (p.gold ?? 0), 0);
        const totalDamage = players.reduce((s, p) => s + (p.heroDamage ?? 0), 0);
        const maxDamage = Math.max(...players.map((p) => p.heroDamage ?? 0), 1);
        const teamKills = Math.max(totalKills, 1);

        return (
          <div key={key} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Team header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: won ? (key === 'dusk' ? 'rgba(56,212,200,0.06)' : 'rgba(56,212,200,0.06)') : 'rgba(248,113,113,0.05)',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 4, height: 20, borderRadius: 999, background: key === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: key === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)' }}>{label}</span>
                {won
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-win)', fontFamily: 'var(--font-mono)' }}><Trophy size={12} /> VICTORY</span>
                  : <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-loss)', fontFamily: 'var(--font-mono)' }}><Skull size={12} /> DEFEAT</span>
                }
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span><span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{totalKills}</span> kills</span>
                <span><span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{(totalGold / 1000).toFixed(1)}k</span> gold total</span>
                <span><span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{(totalDamage / 1000).toFixed(1)}k</span> hero dmg</span>
              </div>
            </div>

            {/* Column headers */}
            <div style={headerRowStyle}>
              <span style={{ flex: '0 0 210px' }}>Player</span>
              <span className="hide-mobile" style={{ flex: '0 0 52px', display: 'flex', justifyContent: 'center' }}><HeaderTooltip label="Role" tip="Rol desempeñado en la partida" /></span>
              <HeaderTooltip label="K / D / A" tip="Kills / Deaths / Assists" style={{ flex: '0 0 110px', display: 'flex', justifyContent: 'center' }} />
              <HeaderTooltip label="KP%" tip="Kill Participation — % de kills del equipo en que participó (kills + assists)" style={{ flex: '0 0 56px', display: 'flex', justifyContent: 'center' }} />
              <HeaderTooltip label="DMG to heroes" tip="Daño total infligido a héroes rivales durante la partida" style={{ flex: '1 1 100px', display: 'flex', justifyContent: 'center' }} />
              <HeaderTooltip label="GPM" tip="Gold Per Minute — ritmo de farmeo y progresión económica" style={{ flex: '0 0 56px', display: 'flex', justifyContent: 'center' }} />
              <HeaderTooltip label="Gold total" tip="Oro total acumulado al final de la partida" style={{ flex: '0 0 76px', display: 'flex', justifyContent: 'center' }} />
              {!isAram && <span className="hide-mobile" style={{ flex: '0 0 80px', display: 'flex', justifyContent: 'center' }}><HeaderTooltip label="Wards" tip="Guardianes colocados / destruidos durante la partida" /></span>}
              <span className="hide-mobile" style={{ flex: '0 0 196px', display: 'flex', justifyContent: 'center' }}><HeaderTooltip label="Items" tip="Inventario final del jugador" /></span>
              <span className="hide-mobile" style={{ flex: '0 0 160px', display: 'flex', justifyContent: 'center' }}><HeaderTooltip label="Augments" tip="Mejoras pre-partida seleccionadas por el jugador" /></span>
            </div>

            {/* Player rows */}
            {players.map((p) => (
              <PlayerRow
                key={p.id} player={p} isAram={isAram}
                teamColor={key === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)'}
                maxDamage={maxDamage}
                teamKills={teamKills}
                matchDuration={match.duration}
                heroMeta={heroMeta}
                isEditing={editingPlayerId === p.playerId}
                editingValue={editingValue}
                onStartEdit={onStartEdit}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                onEditValueChange={onEditValueChange}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PlayerRow({ player, isAram, teamColor, maxDamage, teamKills, matchDuration, heroMeta, isEditing, editingValue, onStartEdit, onSaveEdit, onCancelEdit, onEditValueChange }: {
  player: MatchPlayerDetail; isAram: boolean; teamColor: string; maxDamage: number; teamKills: number; matchDuration: number;
  heroMeta: Map<string, import('../api/client').HeroMeta>;
  isEditing: boolean; editingValue: string;
  onStartEdit: (playerId: string, current: string) => void;
  onSaveEdit: (playerId: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (v: string) => void;
}) {
  const kda = player.deaths > 0
    ? ((player.kills + player.assists) / player.deaths).toFixed(2)
    : player.kills + player.assists > 0 ? 'Perfect' : '0.00';

  const navigate = useNavigate();
  const displayedName = player.customName ?? player.playerName;
  const roleSlug = player.role?.toLowerCase().replace('mid_lane', 'midlane') ?? null;
  const roleLabel = player.role
    ? player.role.charAt(0) + player.role.slice(1).toLowerCase().replace('_', ' ')
    : null;
  const meta = heroMeta.get(player.heroSlug) ?? null;
  const heroDisplayName = meta?.displayName ?? player.heroName ?? player.heroSlug;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-color)',
      background: 'rgba(255,255,255,0.01)', flexWrap: 'wrap',
    }}>
      {/* Player column: hero avatar + text */}
      <div
        onClick={() => player.playerId && navigate('/analysis/players', { state: { autoLoadPlayerId: player.playerId } })}
        style={{ flex: '0 0 210px', display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, cursor: player.playerId ? 'pointer' : 'default' }}
      >
        <HeroAvatarWithTooltip
          slug={player.heroSlug}
          name={player.heroName}
          imageUrl={player.heroImageUrl}
          meta={meta}
          size={44}
          rounded={10}
        />

        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          {/* Row 1: Hero name */}
          <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {heroDisplayName}
            </span>
          </div>

          {/* Row 2: Player name + platform + edit */}
          {isEditing && player.playerId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input
                autoFocus
                value={editingValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(player.playerId!); if (e.key === 'Escape') onCancelEdit(); }}
                placeholder={player.playerName}
                style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', background: 'var(--bg-dark)', border: '1px solid var(--accent-blue)', borderRadius: '4px', color: 'var(--text-primary)', width: '100px' }}
              />
              <button onClick={() => onSaveEdit(player.playerId!)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-win)', display: 'flex' }}><Check size={13} /></button>
              <button onClick={onCancelEdit} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={13} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>{displayedName}</span>
              {player.isConsole
                ? <Gamepad2 size={11} style={{ flexShrink: 0, color: 'var(--accent-violet)' }} />
                : <Monitor size={11} style={{ flexShrink: 0, color: 'var(--text-muted)', opacity: 0.4 }} />
              }
              {player.customName && <span style={{ fontSize: '0.6rem', color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>custom</span>}
              {player.playerId && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStartEdit(player.playerId!, player.customName ?? ''); }}
                  title="Set custom name"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0, flexShrink: 0 }}
                >
                  <Pencil size={10} />
                </button>
              )}
            </div>
          )}

          {/* Row 3: Rank + level */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {player.rankLabel && <span style={{ color: teamColor, fontWeight: 600 }}>{player.rankLabel}</span>}
            {player.level && <span style={{ color: 'var(--text-muted)' }}>Lvl {player.level}</span>}
          </div>
        </div>
      </div>

      {/* Role */}
      <div className="hide-mobile" style={{ flex: '0 0 52px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {roleSlug
          ? <img src={`/icons/roles/${roleSlug}.png`} alt={roleLabel ?? ''} title={roleLabel ?? ''} style={{ width: 22, height: 22, objectFit: 'contain', opacity: 0.9 }} />
          : <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
        }
      </div>

      {/* K/D/A */}
      <div style={{ flex: '0 0 110px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
        <div>
          <span style={{ color: 'var(--accent-win)' }}>{player.kills}</span>
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          <span style={{ color: 'var(--accent-loss)' }}>{player.deaths}</span>
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          <span>{player.assists}</span>
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{kda} KDA</div>
      </div>

      {/* KP% */}
      <div style={{ flex: '0 0 56px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {Math.round((player.kills + player.assists) / teamKills * 100)}%
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>KP</div>
      </div>

      {/* Damage bar */}
      <div style={{ flex: '1 1 100px', minWidth: 0 }}>
        {player.heroDamage !== null ? (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', textAlign: 'right', marginBottom: '0.2rem' }}>
              {player.heroDamage.toLocaleString()}
            </div>
            <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: `${Math.round((player.heroDamage / maxDamage) * 100)}%`,
                background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-teal-bright))',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
      </div>

      {/* GPM */}
      <div style={{ flex: '0 0 56px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-prime)' }}>
        {player.gold !== null && matchDuration > 0
          ? Math.round(player.gold / (matchDuration / 60))
          : '—'}
      </div>

      {/* Gold total */}
      <div style={{ flex: '0 0 76px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-prime)' }}>
        {player.gold !== null ? `${(player.gold / 1000).toFixed(1)}k` : '—'}
      </div>

      {/* Wards (non-ARAM only) */}
      {!isAram && (
        <div className="hide-mobile" style={{ flex: '0 0 80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{player.wardsPlaced ?? '—'}</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 0.2rem' }}>/</span>
          <span style={{ color: 'var(--accent-loss)', opacity: 0.8 }}>{player.wardsDestroyed ?? '—'}</span>
        </div>
      )}

      {/* Items */}
      <div className="hide-mobile" style={{ flex: '0 0 196px', display: 'flex', gap: '4px', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'center' }}>
        {player.inventoryItems.filter((s) => s && s.length > 0).slice(0, 6).map((slug, i) => (
          <ItemIcon key={i} slug={slug} />
        ))}
      </div>

      {/* Augments */}
      <div className="hide-mobile" style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center', padding: '0 4px' }}>
        {player.perks && player.perks.length > 0 ? player.perks.map((perk) => (
          <div key={perk.id} title={perk.displayName} style={{
            fontSize: '0.6rem',
            fontFamily: 'var(--font-mono)',
            padding: '1px 5px',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            background: perk.slot === 'HERO_SPECIFIC_1' ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
            color: perk.slot === 'HERO_SPECIFIC_1' ? 'var(--accent-violet)' : 'var(--text-muted)',
            border: perk.slot === 'HERO_SPECIFIC_1' ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.06)',
          }}>
            {perk.displayName}
          </div>
        )) : (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
        )}
      </div>
    </div>
  );
}

// ── Analysis Tab ─────────────────────────────────────────────────────────────

const OBJ_GROUPS = [
  { key: 'fangtooth', label: 'Fangtooth',  types: ['FANGTOOTH', 'PRIMAL_FANGTOOTH'], color: '#ef4444' },
  { key: 'prime',     label: 'Prime',      types: ['ORB_PRIME', 'MINI_PRIME'],        color: '#a78bfa' },
  { key: 'shaper',    label: 'Shaper',     types: ['SHAPER'],                         color: '#c084fc' },
  { key: 'buffs',     label: 'Buffs',      types: ['RED_BUFF','BLUE_BUFF','CYAN_BUFF','GOLD_BUFF'], color: '#f0b429' },
  { key: 'river',     label: 'River',      types: ['RIVER','SEEDLING'],               color: '#38d4c8' },
] as const;

function AnalysisTab({ match, duskWon, dawnWon: _dawnWon, onResync, syncing }: {
  match: MatchDetailData; duskWon: boolean; dawnWon: boolean;
  onResync: () => void; syncing: boolean;
}) {
  const [events, setEvents] = useState<MatchEvents | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (!match.eventStreamSynced) return;
    setLoadingEvents(true);
    void apiClient.matches.getEvents(match.id)
      .then(setEvents)
      .catch(() => toast.error('Failed to load analysis data.'))
      .finally(() => setLoadingEvents(false));
  }, [match.id, match.eventStreamSynced]);

  if (!match.eventStreamSynced) {
    return (
      <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>Analysis not available</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
          Sync this match to load objective control, gold timeline and deaths before objectives.
        </div>
        <button onClick={onResync} disabled={syncing} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, padding: '0.45rem 1rem', borderRadius: '6px', cursor: syncing ? 'not-allowed' : 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)', opacity: syncing ? 0.6 : 1 }}>
          <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Syncing…' : 'Sync match'}
        </button>
      </div>
    );
  }

  if (loadingEvents) return <div className="glass-card" style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading analysis…</div>;
  if (!events) return null;

  const allPlayers = [...match.dusk, ...match.dawn];
  const durationMins = Math.ceil(match.duration / 60);

  // ── Gold timeline ──────────────────────────────────────────────
  const hasGold = allPlayers.some((p) => p.goldEarnedAtInterval?.length);
  const goldDiff: number[] = [];
  if (hasGold) {
    for (let t = 0; t < durationMins; t++) {
      const duskG = match.dusk.reduce((s, p) => s + (p.goldEarnedAtInterval?.[t] ?? 0), 0);
      const dawnG = match.dawn.reduce((s, p) => s + (p.goldEarnedAtInterval?.[t] ?? 0), 0);
      goldDiff.push(duskG - dawnG);
    }
  }

  // ── Objective control ─────────────────────────────────────────
  const objStats = OBJ_GROUPS.map((g) => {
    const kills = events.objectiveKills.filter((o) => g.types.includes(o.entityType as never));
    const dusk = kills.filter((o) => o.killerTeam === 'DUSK').length;
    const dawn = kills.filter((o) => o.killerTeam === 'DAWN').length;
    const total = dusk + dawn;
    const first = kills.sort((a, b) => a.gameTime - b.gameTime)[0];
    return { ...g, dusk, dawn, total, first };
  }).filter((g) => g.total > 0);

  // First tower
  const outerTowers = events.structureDestructions
    .filter((s) => s.structureType === 'OUTER_TOWER')
    .sort((a, b) => a.gameTime - b.gameTime);
  const firstTower = outerTowers[0] ?? null;

  // ── Deaths Before Objectives ──────────────────────────────────
  const WINDOWS = [30, 60, 120] as const;
  const majorObjectives = events.objectiveKills.filter((o) =>
    ['FANGTOOTH', 'PRIMAL_FANGTOOTH', 'ORB_PRIME', 'MINI_PRIME', 'SHAPER'].includes(o.entityType)
  ).sort((a, b) => a.gameTime - b.gameTime);

  const dboRows = majorObjectives.map((obj) => {
    const meta = OBJECTIVE_META[obj.entityType] ?? { label: obj.entityType, color: '#64748b', abbr: '?' };
    const windows = WINDOWS.map((w) => {
      const t0 = obj.gameTime - w;
      const duskDeaths = events.heroKills.filter((k) => k.killedTeam === 'DUSK' && k.gameTime >= t0 && k.gameTime < obj.gameTime).length;
      const dawnDeaths = events.heroKills.filter((k) => k.killedTeam === 'DAWN' && k.gameTime >= t0 && k.gameTime < obj.gameTime).length;
      return { w, duskDeaths, dawnDeaths };
    });
    return { obj, meta, windows };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Objective Control ── */}
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Objective Control
          {firstTower && <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>First tower: <span style={{ color: firstTower.destructionTeam === 'DUSK' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)', fontWeight: 600 }}>{firstTower.destructionTeam}</span> at {formatTime(firstTower.gameTime)}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {objStats.map((g) => (
            <div key={g.key} className="glass-card" style={{ padding: '0.75rem 1rem', minWidth: 140, flex: '1 1 140px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{g.label}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{g.total} total</span>
              </div>
              {/* Bar */}
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex', marginBottom: '0.4rem' }}>
                {g.total > 0 && <>
                  <div style={{ width: `${(g.dusk / g.total) * 100}%`, background: 'var(--accent-teal-bright)', borderRadius: '999px 0 0 999px' }} />
                  <div style={{ width: `${(g.dawn / g.total) * 100}%`, background: 'var(--accent-loss)', borderRadius: '0 999px 999px 0' }} />
                </>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--accent-teal-bright)', fontWeight: 700 }}>{g.dusk} DUSK</span>
                <span style={{ color: 'var(--accent-loss)', fontWeight: 700 }}>DAWN {g.dawn}</span>
              </div>
              {g.first && (
                <div style={{ marginTop: '0.3rem', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  First: <span style={{ color: g.first.killerTeam === 'DUSK' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)', fontWeight: 600 }}>{g.first.killerTeam}</span> at {formatTime(g.first.gameTime)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Gold Diff Timeline ── */}
      {hasGold && goldDiff.length > 1 ? (
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Gold Difference (DUSK − DAWN)
          </div>
          <GoldDiffChart goldDiff={goldDiff} events={events} match={match} duskWon={duskWon} />
        </div>
      ) : match.eventStreamSynced && !hasGold ? (
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gold timeline not available — re-sync to fetch per-minute gold data.</span>
          <button onClick={onResync} disabled={syncing} style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--accent-blue)', background: 'transparent', color: 'var(--accent-blue)' }}>Re-sync</button>
        </div>
      ) : null}

      {/* ── Deaths Before Objectives ── */}
      {dboRows.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Deaths Before Objectives
            <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>deaths in windows before each major objective</span>
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.35rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.015)', gap: '0.5rem' }}>
              <span style={{ flex: '0 0 130px' }}>Objective</span>
              <span style={{ flex: '0 0 56px', textAlign: 'center' }}>Time</span>
              <span style={{ flex: '0 0 64px', textAlign: 'center' }}>Team</span>
              {WINDOWS.map((w) => (
                <span key={w} style={{ flex: '1 1 80px', textAlign: 'center' }}>−{w}s deaths</span>
              ))}
            </div>
            {dboRows.map(({ obj, meta, windows }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                <div style={{ flex: '0 0 130px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                  <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                </div>
                <span style={{ flex: '0 0 56px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{formatTime(obj.gameTime)}</span>
                <span style={{ flex: '0 0 64px', textAlign: 'center', fontWeight: 700, fontSize: '0.7rem', color: obj.killerTeam === 'DUSK' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)' }}>{obj.killerTeam}</span>
                {windows.map(({ w, duskDeaths, dawnDeaths }) => (
                  <div key={w} style={{ flex: '1 1 80px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--accent-teal-bright)', fontWeight: duskDeaths > 0 ? 700 : 400, opacity: duskDeaths === 0 ? 0.4 : 1 }}>{duskDeaths}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 0.2rem' }}>·</span>
                    <span style={{ color: 'var(--accent-loss)', fontWeight: dawnDeaths > 0 ? 700 : 400, opacity: dawnDeaths === 0 ? 0.4 : 1 }}>{dawnDeaths}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>DUSK · DAWN deaths in each pre-objective window</div>
        </div>
      )}

      {/* ── Kill Heatmap ── */}
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Match Heatmap</div>
        <AnalysisHeatmap events={events} match={match} />
      </div>

    </div>
  );
}

// ── Gold Diff Chart ───────────────────────────────────────────────────────────

function GoldDiffChart({ goldDiff, events, match: _match, duskWon }: {
  goldDiff: number[]; events: MatchEvents; match: MatchDetailData; duskWon: boolean;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

  const n = goldDiff.length;
  // 48px per minute so dots spread out — minimum 640px
  const W = Math.max(640, n * 48 + 64);
  const H = 180;
  const PAD = { t: 20, b: 30, l: 52, r: 24 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxAbs = Math.max(...goldDiff.map(Math.abs), 1000);

  const xScale = (i: number) => PAD.l + (i / (n - 1)) * innerW;
  const yScale = (v: number) => PAD.t + innerH / 2 - (v / maxAbs) * (innerH / 2);

  const pts = goldDiff.map((v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');
  const areaPos = goldDiff.map((v, i) => ({ x: xScale(i), y: yScale(Math.max(v, 0)) }));
  const areaNeg = goldDiff.map((v, i) => ({ x: xScale(i), y: yScale(Math.min(v, 0)) }));
  const midY = yScale(0);

  // All objectives on chart (not just major ones)
  const chartObjs = events.objectiveKills
    .filter((o) => !['RIVER', 'SEEDLING'].includes(o.entityType))
    .map((o) => {
      const tMin = o.gameTime / 60;
      const tFloor = Math.floor(tMin);
      const diff = tFloor < n ? goldDiff[tFloor] : null;
      const meta = OBJECTIVE_META[o.entityType] ?? { label: o.entityType, color: '#64748b', abbr: '?' };
      return { o, tMin, diff, meta };
    })
    .filter((obj) => obj.tMin < n);

  const formatK = (v: number) => {
    const sign = v >= 0 ? '+' : '-';
    return Math.abs(v) >= 1000 ? `${sign}${(Math.abs(v) / 1000).toFixed(1)}k` : `${sign}${Math.abs(v)}`;
  };

  // Structure destructions on chart
  const chartStructures = events.structureDestructions
    .map((s) => {
      const tMin = s.gameTime / 60;
      const tFloor = Math.floor(tMin);
      const diff = tFloor < n ? goldDiff[tFloor] : null;
      const meta = STRUCTURE_META[s.structureType] ?? { label: s.structureType, abbr: '?' };
      return { s, tMin, diff, meta };
    })
    .filter((st) => st.tMin < n);

  return (
    <div className="glass-card" style={{ padding: '0.75rem 1rem', overflowX: 'auto', position: 'relative' }}>
      <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>
        {/* Zero line */}
        <line x1={PAD.l} y1={midY} x2={W - PAD.r} y2={midY} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

        {/* Area fills */}
        <polygon points={[`${xScale(0).toFixed(1)},${midY}`, ...areaPos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`), `${xScale(n - 1).toFixed(1)},${midY}`].join(' ')} fill="rgba(56,212,200,0.18)" />
        <polygon points={[`${xScale(0).toFixed(1)},${midY}`, ...areaNeg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`), `${xScale(n - 1).toFixed(1)},${midY}`].join(' ')} fill="rgba(248,113,113,0.18)" />

        {/* Line */}
        <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />

        {/* Structure destructions — small squares on the line */}
        {chartStructures.map(({ s, tMin, diff, meta }, i) => {
          const x = xScale(tMin);
          const y = diff != null ? yScale(diff) : midY;
          const color = s.destructionTeam === 'DUSK' ? '#38d4c8' : '#f87171';
          return (
            <rect key={i} x={x - 3} y={y - 3} width={6} height={6}
              fill={color} opacity={0.85} stroke="#000" strokeWidth={0.5}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, content: (
                <><TlTipTitle label={meta.label} color="#94a3b8" /><TlTipRow label="Time" value={formatTime(s.gameTime)} /><TlTipRow label="Destroyed by" value={s.destructionTeam ?? '?'} />{diff != null && <TlTipRow label="Gold diff" value={formatK(diff)} />}</>
              )})}
              onMouseLeave={() => setTip(null)}
            />
          );
        })}

        {/* Objective markers — vertical line + interactive dot */}
        {chartObjs.map(({ o, tMin, diff, meta }, i) => {
          const x = xScale(tMin);
          // Count how many of this objective type DUSK and DAWN have captured so far
          const sameType = chartObjs.filter((c, ci) => c.o.entityType === o.entityType && ci <= i);
          const duskCount = sameType.filter((c) => c.o.killerTeam === 'DUSK').length;
          const dawnCount = sameType.filter((c) => c.o.killerTeam === 'DAWN').length;
          return (
            <g key={i}>
              <line x1={x} y1={PAD.t} x2={x} y2={H - PAD.b} stroke={meta.color} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
              <circle cx={x} cy={PAD.t + 6} r={5} fill={meta.color} opacity={0.95} stroke="#000" strokeWidth={0.8}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, content: (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                      <TlTipTitle label={meta.label} color={meta.color} />
                      <TlTipTime time={formatTime(o.gameTime)} />
                    </div>
                    <TlTipRow label="Captured by" value={o.killerTeam ?? '?'} />
                    {diff != null && <TlTipRow label="Gold diff" value={formatK(diff)} />}
                    <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      Score so far: <span style={{ color: '#38d4c8', fontWeight: 700 }}>{duskCount} DUSK</span> · <span style={{ color: '#f87171', fontWeight: 700 }}>DAWN {dawnCount}</span>
                    </div>
                  </>
                )})}
                onMouseLeave={() => setTip(null)}
              />
              {/* Abbr label below dot */}
              <text x={x} y={PAD.t + 15} textAnchor="middle" fontSize={7} fill={meta.color} fontFamily="monospace" fontWeight="bold" opacity={0.9}>{meta.abbr}</text>
            </g>
          );
        })}

        {/* Y axis labels */}
        {[-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].map((v) => (
          <text key={v} x={PAD.l - 4} y={yScale(v) + 4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.4)" fontFamily="monospace">
            {formatK(v)}
          </text>
        ))}

        {/* X axis — minute labels */}
        {Array.from({ length: n }, (_, i) => i).filter((i) => i % 5 === 0).map((i) => (
          <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)" fontFamily="monospace">{i}m</text>
        ))}

        {/* Labels */}
        <text x={PAD.l + 4} y={PAD.t + 11} fontSize={9} fill="rgba(56,212,200,0.8)" fontFamily="monospace" fontWeight="bold">DUSK AHEAD</text>
        <text x={PAD.l + 4} y={H - PAD.b - 4} fontSize={9} fill="rgba(248,113,113,0.8)" fontFamily="monospace" fontWeight="bold">DAWN AHEAD</text>
      </svg>

      {/* Final diff */}
      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        <span>Final diff: <span style={{ color: (goldDiff.at(-1) ?? 0) >= 0 ? 'var(--accent-teal-bright)' : 'var(--accent-loss)', fontWeight: 700 }}>{(goldDiff.at(-1) ?? 0) >= 0 ? '+' : ''}{formatK(goldDiff.at(-1) ?? 0)}</span> gold</span>
        <span>Peak DUSK: <span style={{ color: 'var(--accent-teal-bright)', fontWeight: 700 }}>+{formatK(Math.max(...goldDiff))}</span></span>
        <span>Peak DAWN: <span style={{ color: 'var(--accent-loss)', fontWeight: 700 }}>+{formatK(Math.abs(Math.min(...goldDiff)))}</span></span>
        {!duskWon && Math.max(...goldDiff) > 3000 && <span style={{ color: '#f0b429', fontWeight: 700 }}>⚠ Possible throw</span>}
        {duskWon && Math.min(...goldDiff) < -3000 && <span style={{ color: '#f0b429', fontWeight: 700 }}>⚡ Comeback</span>}
      </div>

      {/* Tooltip portal */}
      {tip && createPortal(
        <div style={{ position: 'fixed', left: tip.x, top: tip.y - 10, transform: 'translate(-50%, -100%)', zIndex: 9999, background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.75rem', minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>
          {tip.content}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Analysis Heatmap ──────────────────────────────────────────────────────────

type HeatmapLayer = 'kills' | 'wards' | 'objectives' | 'structures' | 'preobj-deaths' | 'prime-conv' | 'teamfights';

function AnalysisHeatmap({ events, match }: { events: MatchEvents; match: MatchDetailData }) {
  const [layer, setLayer] = useState<HeatmapLayer>('kills');
  const [killRoleFilter, setKillRoleFilter] = useState<string | null>(null);
  const W = 360; const H = 386;

  // Role lookup from match players (HM-014)
  const playerRoleMap = new Map<string, string>();
  for (const p of [...match.dusk, ...match.dawn]) {
    if (p.playerId && p.role) playerRoleMap.set(p.playerId, p.role);
  }
  const ROLE_COLORS: Record<string, string> = {
    carry: '#f0b429', jungle: '#22c55e', midlane: '#a78bfa', offlane: '#f97316', support: '#38bdf8',
  };

  function gameToHeat(x: number, y: number) {
    const px = ((x - MAP_BOUNDS.minX) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX)) * W;
    const py = ((y - MAP_BOUNDS.minY) / (MAP_BOUNDS.maxY - MAP_BOUNDS.minY)) * H;
    return { px, py };
  }

  const layers: { key: HeatmapLayer; label: string }[] = [
    { key: 'kills', label: 'Kills' },
    { key: 'wards', label: 'Wards' },
    { key: 'objectives', label: 'Objectives' },
    { key: 'structures', label: 'Structures' },
    { key: 'preobj-deaths', label: 'Pre-Obj Deaths' },
    { key: 'prime-conv', label: 'Prime Conv.' },
    { key: 'teamfights', label: 'Teamfights' },
  ];

  // Pre-objective deaths: kills within 90s before a major objective (HM-002)
  const majorObjTimes = events.objectiveKills
    .filter((o) => ['FANGTOOTH', 'PRIMAL_FANGTOOTH', 'ORB_PRIME', 'MINI_PRIME'].includes(o.entityType))
    .map((o) => o.gameTime);
  const preobjDeaths = events.heroKills.filter((k) =>
    k.locationX != null && k.locationY != null &&
    majorObjTimes.some((t) => k.gameTime >= t - 90 && k.gameTime < t),
  );

  // Prime conversion: structures destroyed within 180s of ORB_PRIME (HM-012)
  const orbPrimes = events.objectiveKills
    .filter((o) => o.entityType === 'ORB_PRIME')
    .map((o) => ({ time: o.gameTime, team: o.killerTeam }));
  const primeConvStructures = events.structureDestructions.filter((sd) =>
    sd.locationX != null && sd.locationY != null &&
    orbPrimes.some((op) => sd.gameTime >= op.time && sd.gameTime <= op.time + 180 && sd.destructionTeam === op.team),
  );

  // Teamfight clusters: groups of 3+ kills within a 20s window (HM-013)
  const sortedKills = [...events.heroKills].sort((a, b) => a.gameTime - b.gameTime);
  const teamfightClusters: { cx: number; cy: number; count: number; winner: string | null }[] = [];
  const usedIdx = new Set<number>();
  for (let i = 0; i < sortedKills.length; i++) {
    if (usedIdx.has(i)) continue;
    const window = sortedKills.reduce<number[]>((acc, k, j) => {
      if (!usedIdx.has(j) && Math.abs(k.gameTime - sortedKills[i].gameTime) <= 20) acc.push(j);
      return acc;
    }, []);
    if (window.length < 3) continue;
    const valid = window.filter((j) => sortedKills[j].locationX != null && sortedKills[j].locationY != null);
    if (valid.length < 3) continue;
    const cx = valid.reduce((s, j) => s + sortedKills[j].locationX!, 0) / valid.length;
    const cy = valid.reduce((s, j) => s + sortedKills[j].locationY!, 0) / valid.length;
    const dusk = valid.filter((j) => sortedKills[j].killedTeam === 'DUSK').length;
    const dawn = valid.filter((j) => sortedKills[j].killedTeam === 'DAWN').length;
    teamfightClusters.push({ cx, cy, count: valid.length, winner: dusk > dawn ? 'DAWN' : dawn > dusk ? 'DUSK' : null });
    window.forEach((j) => usedIdx.add(j));
  }

  return (
    <div className="glass-card" style={{ padding: '0.75rem 1rem' }}>
      {/* Layer toggles */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {layers.map((l) => (
          <button key={l.key} onClick={() => setLayer(l.key)} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.18rem 0.6rem', borderRadius: '4px', cursor: 'pointer', border: `1px solid ${layer === l.key ? 'var(--accent-blue)' : 'var(--border-color)'}`, background: layer === l.key ? 'rgba(91,156,246,0.15)' : 'transparent', color: layer === l.key ? 'var(--accent-blue)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
            {l.label}
          </button>
        ))}
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '0.25rem', fontFamily: 'var(--font-mono)' }}>
          {layer === 'kills' ? `${events.heroKills.length} kills` : layer === 'wards' ? `${events.wardEvents.length} ward events` : layer === 'structures' ? `${events.structureDestructions.length} structures` : layer === 'preobj-deaths' ? `${preobjDeaths.length} deaths before objective` : layer === 'prime-conv' ? `${primeConvStructures.length} structures after Prime` : layer === 'teamfights' ? `${teamfightClusters.length} teamfights` : `${events.objectiveKills.length} objectives`}
        </span>
      </div>

      {/* Role filter for kills layer (HM-014) */}
      {layer === 'kills' && (
        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Color by role:</span>
          {[null, 'carry', 'jungle', 'midlane', 'offlane', 'support'].map((r) => (
            <button key={r ?? 'team'} onClick={() => setKillRoleFilter(r)} style={{ fontSize: '0.62rem', fontWeight: 600, padding: '0.12rem 0.45rem', borderRadius: '3px', cursor: 'pointer', border: `1px solid ${killRoleFilter === r ? (r ? ROLE_COLORS[r] : 'var(--accent-blue)') : 'var(--border-color)'}`, background: killRoleFilter === r ? `${r ? ROLE_COLORS[r] : 'var(--accent-blue)'}22` : 'transparent', color: killRoleFilter === r ? (r ? ROLE_COLORS[r] : 'var(--accent-blue)') : 'var(--text-muted)' }}>
              {r ?? 'Team'}
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <img src="/maps/map.png" alt="map" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', opacity: 0.65, borderRadius: 6 }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {layer === 'kills' && events.heroKills.map((k, i) => {
            if (k.locationX == null || k.locationY == null) return null;
            const { px, py } = gameToHeat(k.locationX, k.locationY);
            let color = k.killedTeam === 'DUSK' ? '#f87171' : '#38d4c8';
            if (killRoleFilter && k.killedPlayerId) {
              const role = playerRoleMap.get(k.killedPlayerId);
              if (role !== killRoleFilter) return null;
              color = ROLE_COLORS[role] ?? color;
            }
            return <circle key={i} cx={px} cy={py} r={4} fill={color} opacity={0.75} stroke="#000" strokeWidth={0.5} />;
          })}
          {layer === 'preobj-deaths' && preobjDeaths.map((k, i) => {
            const { px, py } = gameToHeat(k.locationX!, k.locationY!);
            const color = k.killedTeam === 'DUSK' ? '#f87171' : '#38d4c8';
            return <circle key={i} cx={px} cy={py} r={5} fill={color} opacity={0.8} stroke="#f0b429" strokeWidth={1} />;
          })}
          {layer === 'prime-conv' && primeConvStructures.map((s, i) => {
            if (s.locationX == null || s.locationY == null) return null;
            const { px, py } = gameToHeat(s.locationX, s.locationY);
            return <rect key={i} x={px - 6} y={py - 6} width={12} height={12} fill="#7c3aed" opacity={0.85} stroke="#a78bfa" strokeWidth={1} rx={2} />;
          })}
          {layer === 'teamfights' && teamfightClusters.map((tf, i) => {
            const { px, py } = gameToHeat(tf.cx, tf.cy);
            const r = 8 + Math.min(tf.count * 1.5, 12);
            const color = tf.winner === 'DUSK' ? '#38d4c8' : tf.winner === 'DAWN' ? '#f87171' : '#f0b429';
            return (
              <g key={i}>
                <circle cx={px} cy={py} r={r} fill={color} opacity={0.25} />
                <circle cx={px} cy={py} r={4} fill={color} opacity={0.9} stroke="#000" strokeWidth={0.5} />
                <text x={px} y={py + 14} textAnchor="middle" fontSize={8} fill={color} opacity={0.9}>{tf.count}</text>
              </g>
            );
          })}
          {layer === 'wards' && events.wardEvents.map((w, i) => {
            if (w.locationX == null || w.locationY == null) return null;
            const { px, py } = gameToHeat(w.locationX, w.locationY);
            const color = w.eventType === 'PLACEMENT' ? (w.team === 'DUSK' ? '#38d4c8' : '#f87171') : '#f97316';
            const r = w.eventType === 'PLACEMENT' ? 3 : 2;
            return <circle key={i} cx={px} cy={py} r={r} fill={color} opacity={0.6} />;
          })}
          {layer === 'objectives' && events.objectiveKills.map((o, i) => {
            if (o.locationX == null || o.locationY == null) return null;
            const { px, py } = gameToHeat(o.locationX, o.locationY);
            const meta = OBJECTIVE_META[o.entityType] ?? { color: '#64748b' };
            return <circle key={i} cx={px} cy={py} r={6} fill={meta.color} opacity={0.85} stroke="#000" strokeWidth={1} />;
          })}
          {layer === 'structures' && events.structureDestructions.map((s, i) => {
            if (s.locationX == null || s.locationY == null) return null;
            const { px, py } = gameToHeat(s.locationX, s.locationY);
            const color = s.destructionTeam === 'DUSK' ? 'var(--accent-teal-bright)' : s.destructionTeam === 'DAWN' ? '#f87171' : '#94a3b8';
            return <rect key={i} x={px - 5} y={py - 5} width={10} height={10} fill={color} opacity={0.85} stroke="#000" strokeWidth={0.5} rx={2} />;
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
        {layer === 'kills' && <><span style={{ color: '#f87171' }}>● DUSK died</span><span style={{ color: '#38d4c8' }}>● DAWN died</span></>}
        {layer === 'wards' && <><span style={{ color: '#38d4c8' }}>● DUSK placed</span><span style={{ color: '#f87171' }}>● DAWN placed</span><span style={{ color: '#f97316' }}>● Destroyed</span></>}
        {layer === 'objectives' && OBJ_GROUPS.map((g) => <span key={g.key} style={{ color: g.color }}>● {g.label}</span>)}
        {layer === 'structures' && <><span style={{ color: 'var(--accent-teal-bright)' }}>■ DUSK destroyed</span><span style={{ color: '#f87171' }}>■ DAWN destroyed</span></>}
        {layer === 'preobj-deaths' && <><span style={{ color: '#f87171' }}>● DUSK died</span><span style={{ color: '#38d4c8' }}>● DAWN died</span><span style={{ color: '#f0b429' }}>(within 90s of major obj)</span></>}
        {layer === 'prime-conv' && <span style={{ color: '#a78bfa' }}>■ Structures destroyed within 3 min of Orb Prime</span>}
        {layer === 'teamfights' && <><span style={{ color: '#38d4c8' }}>● DUSK won</span><span style={{ color: '#f87171' }}>● DAWN won</span><span style={{ color: '#f0b429' }}>● Even — number = kills in fight</span></>}
        {layer === 'kills' && killRoleFilter && <span style={{ color: ROLE_COLORS[killRoleFilter] }}>● Deaths of {killRoleFilter} players</span>}
      </div>
    </div>
  );
}

// ── Timeline Tab ─────────────────────────────────────────────────────────────

const MINS_PX_BASE = 64;
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2, 3, 5, 8];
const ZOOM_DEFAULT = 2; // index into ZOOM_LEVELS → 1×

const OBJECTIVE_META: Record<string, { label: string; color: string; abbr: string; zone?: string }> = {
  FANGTOOTH:        { label: 'Fangtooth',        color: '#ef4444', abbr: 'FT',  zone: 'Jungle boss' },
  PRIMAL_FANGTOOTH: { label: 'Primal Fangtooth', color: '#b91c1c', abbr: 'PFT', zone: 'Jungle boss' },
  ORB_PRIME:        { label: 'Orb Prime',        color: '#7c3aed', abbr: 'OP',  zone: 'Main objective' },
  MINI_PRIME:       { label: 'Mini Prime',       color: '#a78bfa', abbr: 'MP',  zone: 'Main objective' },
  SHAPER:           { label: 'Shaper',               color: '#c084fc', abbr: 'SHP', zone: 'River' },
  RED_BUFF:         { label: 'Red Buff',         color: '#f97316', abbr: 'RB',  zone: 'Jungle' },
  BLUE_BUFF:        { label: 'Blue Buff',        color: '#3b82f6', abbr: 'BB',  zone: 'Jungle' },
  CYAN_BUFF:        { label: 'Cyan Buff (Lane)', color: '#06b6d4', abbr: 'CB',  zone: 'Lane' },
  GOLD_BUFF:        { label: 'Gold Buff (Lane)', color: '#f0b429', abbr: 'GB',  zone: 'Lane' },
  RIVER:            { label: 'River Creature',   color: '#38d4c8', abbr: 'RC',  zone: 'River' },
  SEEDLING:         { label: 'Seedling',         color: '#22c55e', abbr: 'SD',  zone: 'River' },
};

const STRUCTURE_META: Record<string, { label: string; abbr: string }> = {
  OUTER_TOWER: { label: 'Outer Tower', abbr: 'T1'   },
  INNER_TOWER: { label: 'Inner Tower', abbr: 'T2'   },
  INHIBITOR:   { label: 'Inhibitor',   abbr: 'INH'  },
  CORE:        { label: 'Core',        abbr: 'CORE' },
};

const WARD_LABELS: Record<string, string> = {
  STEALTH:      'Stealth Ward',
  ORACLE:       'Oracle Ward',
  SENTRY:       'Sentry Ward',
  SONAR_DRONE:  'Sonar Drone',
  SOLSTONE_DRONE: 'Solstone Drone',
};

type TimelineSection = 'kills' | 'objectives' | 'structures' | 'purchases' | 'wards';

const SECTION_CONFIG: Record<TimelineSection, { label: string; color: string }> = {
  kills:      { label: 'Kills',       color: 'var(--accent-teal-bright)' },
  objectives: { label: 'Objectives',  color: '#f0b429' },
  structures: { label: 'Structures',  color: '#94a3b8' },
  purchases:  { label: 'Purchases',   color: 'var(--accent-prime)' },
  wards:      { label: 'Wards',       color: 'var(--accent-blue)' },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function teamColor(team: string | null) {
  return team === 'DUSK' ? 'var(--accent-teal-bright)' : team === 'DAWN' ? 'var(--accent-loss)' : 'var(--text-muted)';
}

function TimelineTab({ match, onResync, syncing }: {
  match: MatchDetailData; onResync: () => void; syncing: boolean;
}) {
  const [events, setEvents] = useState<MatchEvents | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [zoomIdx, setZoomIdx] = useState(ZOOM_DEFAULT);
  const [visible, setVisible] = useState<Set<TimelineSection>>(
    new Set(['kills', 'objectives', 'structures', 'purchases', 'wards'])
  );
  const [hoveredDot, setHoveredDot] = useState<MapDot | null>(null);
  const [pinnedDots, setPinnedDots] = useState<MapDot[]>([]);

  useEffect(() => {
    if (!match.eventStreamSynced) return;
    setLoadingEvents(true);
    void apiClient.matches.getEvents(match.id)
      .then(setEvents)
      .catch(() => toast.error('Failed to load timeline events.'))
      .finally(() => setLoadingEvents(false));
  }, [match.id, match.eventStreamSynced]);

  if (!match.eventStreamSynced) {
    return (
      <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>Timeline not available</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
          Sync this match with your pred.gg account to load the full event timeline.
        </div>
        <button onClick={onResync} disabled={syncing} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, padding: '0.45rem 1rem', borderRadius: '6px', cursor: syncing ? 'not-allowed' : 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)', opacity: syncing ? 0.6 : 1 }}>
          <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Syncing…' : 'Sync match events'}
        </button>
      </div>
    );
  }

  if (loadingEvents) return <div className="glass-card" style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading timeline…</div>;
  if (!events) return null;

  const zoom = ZOOM_LEVELS[zoomIdx];
  const durationMins = match.duration / 60;
  const totalWidth = Math.max(durationMins * MINS_PX_BASE * zoom, 600);
  const numMinutes = Math.ceil(durationMins);
  const pos = (gameTime: number) => `${(gameTime / match.duration) * 100}%`;

  const toggleSection = (s: TimelineSection) =>
    setVisible((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  // Build UUID → player info map from match roster
  const playerByUuid = new Map<string, { name: string; heroSlug: string | null; heroImageUrl: string | null }>();
  for (const p of [...match.dusk, ...match.dawn]) {
    if (p.predggPlayerUuid) {
      playerByUuid.set(p.predggPlayerUuid, {
        name: p.customName ?? p.playerName,
        heroSlug: p.heroSlug,
        heroImageUrl: p.heroImageUrl,
      });
    }
  }

  const duskKills = events.heroKills.filter((k) => k.killerTeam === 'DUSK');
  const dawnKills = events.heroKills.filter((k) => k.killerTeam === 'DAWN');
  const duskBuys  = events.transactions.filter((t) => t.team === 'DUSK' && t.transactionType === 'BUY');
  const dawnBuys  = events.transactions.filter((t) => t.team === 'DAWN' && t.transactionType === 'BUY');
  const wardsPlaced    = events.wardEvents.filter((w) => w.eventType === 'PLACEMENT');
  const wardsDestroyed = events.wardEvents.filter((w) => w.eventType === 'DESTRUCTION');

  const mapDots: MapDot[] = [...pinnedDots, ...(hoveredDot ? [hoveredDot] : [])];

  function onEventHover(dot: MapDot | null) { setHoveredDot(dot); }
  function onEventClick(dot: MapDot) {
    setPinnedDots((prev) => {
      const exists = prev.some((d) => d.x === dot.x && d.y === dot.y && d.label === dot.label);
      if (exists) return prev.filter((d) => !(d.x === dot.x && d.y === dot.y && d.label === dot.label));
      return [...prev, { ...dot, pinned: true }];
    });
  }

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {/* Section toggles */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {(Object.entries(SECTION_CONFIG) as [TimelineSection, { label: string; color: string }][]).map(([key, cfg]) => {
            const active = visible.has(key);
            return (
              <button key={key} onClick={() => toggleSection(key)} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.18rem 0.6rem', borderRadius: '4px', cursor: 'pointer', border: `1px solid ${active ? cfg.color : 'var(--border-color)'}`, background: active ? `${cfg.color}18` : 'transparent', color: active ? cfg.color : 'var(--text-muted)', transition: 'all 0.15s' }}>
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Zoom</span>
          <button onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0} style={{ width: 24, height: 24, borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: zoomIdx === 0 ? 'not-allowed' : 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: zoomIdx === 0 ? 0.4 : 1 }}>−</button>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', minWidth: 28, textAlign: 'center' }}>{zoom}×</span>
          <button onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_LEVELS.length - 1} style={{ width: 24, height: 24, borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: zoomIdx === ZOOM_LEVELS.length - 1 ? 'not-allowed' : 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: zoomIdx === ZOOM_LEVELS.length - 1 ? 0.4 : 1 }}>+</button>
        </div>

        {/* Stats summary */}
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {events.heroKills.length}K · {events.objectiveKills.length}Obj · {events.structureDestructions.length}Str · {events.wardEvents.length}W
        </span>
      </div>

      {/* Timeline + Map side by side */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      {/* Scrollable timeline */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
          <div style={{ position: 'relative', width: totalWidth, minWidth: '100%' }}>

            {/* Minute gridlines (behind everything) */}
            {Array.from({ length: numMinutes + 1 }, (_, i) => (
              <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / durationMins) * 100}%`, width: 1, background: 'rgba(255,255,255,0.04)', pointerEvents: 'none', zIndex: 0 }} />
            ))}

            {/* Time axis */}
            <TlAxis durationMins={durationMins} numMinutes={numMinutes} />

            {/* ── KILLS ── */}
            {visible.has('kills') && <>
              <TlSectionHeader label={`Kills — DUSK ${duskKills.length} / DAWN ${dawnKills.length}`} color="var(--accent-teal-bright)" />
              <TlLane label="DUSK" labelColor="var(--accent-teal-bright)">
                {duskKills.map((k, i) => {
                  const dot = k.locationX != null && k.locationY != null
                    ? { x: k.locationX, y: k.locationY, color: 'var(--accent-teal-bright)', label: `Kill ${formatTime(k.gameTime)}`, pinned: false }
                    : undefined;
                  return (
                    <TlEvent key={i} left={pos(k.gameTime)} color="var(--accent-teal-bright)" size={18}
                      mapDot={dot} onHover={onEventHover} onEventClick={onEventClick}
                      tooltipContent={<>
                        <TlTipTime time={formatTime(k.gameTime)} />
                        <div style={{ height: '0.4rem' }} />
                        <TlTipHeroRow heroSlug={k.killedHeroSlug} name={k.killedHeroSlug ?? '?'} teamColor={teamColor(k.killedTeam)} icon={<Skull size={12} />} />
                        <TlTipHeroRow heroSlug={k.killerHeroSlug} name={k.killerHeroSlug ?? '?'} teamColor="var(--accent-teal-bright)" icon={<Swords size={12} />} />
                      </>}
                    >
                      {k.killerHeroSlug && <img src={`/heroes/${k.killerHeroSlug}.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </TlEvent>
                  );
                })}
              </TlLane>
              <TlLane label="DAWN" labelColor="var(--accent-loss)">
                {dawnKills.map((k, i) => {
                  const dot = k.locationX != null && k.locationY != null
                    ? { x: k.locationX, y: k.locationY, color: 'var(--accent-loss)', label: `Kill ${formatTime(k.gameTime)}`, pinned: false }
                    : undefined;
                  return (
                    <TlEvent key={i} left={pos(k.gameTime)} color="var(--accent-loss)" size={18}
                      mapDot={dot} onHover={onEventHover} onEventClick={onEventClick}
                      tooltipContent={<>
                        <TlTipTime time={formatTime(k.gameTime)} />
                        <div style={{ height: '0.4rem' }} />
                        <TlTipHeroRow heroSlug={k.killedHeroSlug} name={k.killedHeroSlug ?? '?'} teamColor={teamColor(k.killedTeam)} icon={<Skull size={12} />} />
                        <TlTipHeroRow heroSlug={k.killerHeroSlug} name={k.killerHeroSlug ?? '?'} teamColor="var(--accent-loss)" icon={<Swords size={12} />} />
                      </>}
                    >
                      {k.killerHeroSlug && <img src={`/heroes/${k.killerHeroSlug}.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </TlEvent>
                  );
                })}
              </TlLane>
            </>}

            {/* ── OBJECTIVES ── */}
            {visible.has('objectives') && <>
              <TlSectionHeader label={`Objectives — ${events.objectiveKills.length} events`} color="#f0b429" />
              <TlLane label="All" labelColor="#f0b429">
                {events.objectiveKills.map((o, i) => {
                  const meta = OBJECTIVE_META[o.entityType] ?? { label: o.entityType, color: '#64748b', abbr: o.entityType.slice(0, 3) };
                  const dot = o.locationX != null && o.locationY != null
                    ? { x: o.locationX, y: o.locationY, color: meta.color, label: meta.abbr, pinned: false }
                    : undefined;
                  const killer = o.killerPlayerId ? (playerByUuid.get(o.killerPlayerId) ?? null) : null;
                  return (
                    <TlEvent key={i} left={pos(o.gameTime)} color={meta.color} size={22}
                      mapDot={dot} onHover={onEventHover} onEventClick={onEventClick}
                      tooltipContent={<>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                          <TlTipTitle label={meta.label} color={meta.color} />
                          <TlTipTime time={formatTime(o.gameTime)} />
                        </div>
                        <TlTipRow label="Team" value={o.killerTeam ?? '?'} />
                        {killer && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                            {killer.heroSlug && (
                              <div style={{ width: 22, height: 22, borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
                                <img src={`/heroes/${killer.heroSlug}.webp`} alt={killer.heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            )}
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                              {killer.heroSlug ?? killer.name}
                            </span>
                          </div>
                        )}
                      </>}
                    >
                      <span style={{ fontSize: '0.42rem', fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1, pointerEvents: 'none' }}>{meta.abbr}</span>
                    </TlEvent>
                  );
                })}
              </TlLane>
            </>}

            {/* ── STRUCTURES ── */}
            {visible.has('structures') && <>
              <TlSectionHeader label={`Structures — ${events.structureDestructions.length} destroyed`} color="#94a3b8" />
              <TlLane label="All" labelColor="#94a3b8">
                {events.structureDestructions.map((s, i) => {
                  const meta = STRUCTURE_META[s.structureType] ?? { label: s.structureType, abbr: s.structureType.slice(0, 3) };
                  const tc = teamColor(s.destructionTeam);
                  const dot = s.locationX != null && s.locationY != null
                    ? { x: s.locationX, y: s.locationY, color: tc, label: meta.abbr, pinned: false }
                    : undefined;
                  return (
                    <TlEvent key={i} left={pos(s.gameTime)} color={tc} size={20} shape="square"
                      mapDot={dot} onHover={onEventHover} onEventClick={onEventClick}
                      tooltipContent={<>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                          <TlTipTitle label={meta.label} color="#94a3b8" />
                          <TlTipTime time={formatTime(s.gameTime)} />
                        </div>
                        <TlTipRow label="Destroyed by" value={s.destructionTeam ?? '?'} />
                      </>}
                    >
                      <span style={{ fontSize: '0.38rem', fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1, pointerEvents: 'none' }}>{meta.abbr}</span>
                    </TlEvent>
                  );
                })}
              </TlLane>
            </>}

            {/* ── PURCHASES ── */}
            {visible.has('purchases') && (duskBuys.length > 0 || dawnBuys.length > 0) && <>
              <TlSectionHeader label={`Purchases — ${duskBuys.length + dawnBuys.length} items bought`} color="var(--accent-prime)" />
              {duskBuys.length > 0 && (
                <TlLane label="DUSK" labelColor="var(--accent-teal-bright)">
                  {duskBuys.map((t, i) => (
                    <TlEvent key={i} left={pos(t.gameTime)} color="var(--accent-teal-bright)" size={16}
                      tooltipContent={<>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                          <TlTipTitle label="Item Purchased" color="var(--accent-prime)" />
                          <TlTipTime time={formatTime(t.gameTime)} />
                        </div>
                        <TlTipItemRow itemName={t.itemName} />
                        <div style={{ marginTop: '0.4rem' }}><TlTipRow label="Team" value="DUSK" /></div>
                      </>}
                    >
                      {t.itemName && <img src={`/items/${t.itemName.toLowerCase()}.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    </TlEvent>
                  ))}
                </TlLane>
              )}
              {dawnBuys.length > 0 && (
                <TlLane label="DAWN" labelColor="var(--accent-loss)">
                  {dawnBuys.map((t, i) => (
                    <TlEvent key={i} left={pos(t.gameTime)} color="var(--accent-loss)" size={16}
                      tooltipContent={<>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                          <TlTipTitle label="Item Purchased" color="var(--accent-prime)" />
                          <TlTipTime time={formatTime(t.gameTime)} />
                        </div>
                        <TlTipItemRow itemName={t.itemName} />
                        <div style={{ marginTop: '0.4rem' }}><TlTipRow label="Team" value="DAWN" /></div>
                      </>}
                    >
                      {t.itemName && <img src={`/items/${t.itemName.toLowerCase()}.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    </TlEvent>
                  ))}
                </TlLane>
              )}
            </>}

            {/* ── WARDS ── */}
            {visible.has('wards') && events.wardEvents.length > 0 && <>
              <TlSectionHeader label={`Wards — ${wardsPlaced.length} placed · ${wardsDestroyed.length} cleared`} color="var(--accent-blue)" />
              {wardsPlaced.length > 0 && (
                <TlLane label="Placed" labelColor="var(--accent-blue)">
                  {wardsPlaced.map((w, i) => {
                    const dot = w.locationX != null && w.locationY != null
                      ? { x: w.locationX, y: w.locationY, color: teamColor(w.team), label: 'W+', pinned: false }
                      : undefined;
                    return (
                    <TlEvent key={i} left={pos(w.gameTime)} color={teamColor(w.team)} size={11}
                      mapDot={dot} onHover={onEventHover} onEventClick={onEventClick}
                      tooltipContent={<>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                          <TlTipTitle label="Ward Placed" color="var(--accent-blue)" />
                          <TlTipTime time={formatTime(w.gameTime)} />
                        </div>
                        <TlTipRow label="Type" value={WARD_LABELS[w.wardType] ?? w.wardType} />
                        <TlTipRow label="Team" value={w.team ?? '?'} />
                      </>}
                    />
                  );})}
                </TlLane>
              )}
              {wardsDestroyed.length > 0 && (
                <TlLane label="Cleared" labelColor="var(--accent-loss)">
                  {wardsDestroyed.map((w, i) => {
                    const dot = w.locationX != null && w.locationY != null
                      ? { x: w.locationX, y: w.locationY, color: teamColor(w.team), label: 'W×', pinned: false }
                      : undefined;
                    return (
                    <TlEvent key={i} left={pos(w.gameTime)} color={teamColor(w.team)} size={11} shape="square"
                      mapDot={dot} onHover={onEventHover} onEventClick={onEventClick}
                      tooltipContent={<>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                          <TlTipTitle label="Ward Cleared" color="var(--accent-loss)" />
                          <TlTipTime time={formatTime(w.gameTime)} />
                        </div>
                        <TlTipRow label="Type" value={WARD_LABELS[w.wardType] ?? w.wardType} />
                        <TlTipRow label="Team" value={w.team ?? '?'} />
                      </>}
                    />
                  );})}
                </TlLane>
              )}
            </>}

          </div>
        </div>
      </div>
      </div>{/* end timeline flex child */}

      {/* Map panel */}
      <MapOverlay dots={mapDots} onClearPinned={() => setPinnedDots([])} />
      </div>{/* end flex row */}
    </div>
  );
}

function TlAxis({ durationMins, numMinutes }: { durationMins: number; numMinutes: number }) {
  return (
    <div style={{ position: 'relative', height: 26, borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.015)' }}>
      {Array.from({ length: numMinutes + 1 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: `${(i / durationMins) * 100}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', paddingTop: '5px' }}>{i}m</span>
          <div style={{ width: 1, height: 5, background: 'var(--border-color)', marginTop: 1 }} />
        </div>
      ))}
    </div>
  );
}

function TlSectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ height: 22, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', paddingLeft: '0.5rem' }}>
      <div style={{ position: 'sticky', left: 0 }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', background: 'var(--bg-card)', paddingRight: '0.5rem' }}>{label}</span>
      </div>
    </div>
  );
}

function TlLane({ label, labelColor, children }: { label: string; labelColor: string; children?: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', height: 44, borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'sticky', left: 0, zIndex: 10, width: 72, flexShrink: 0, paddingLeft: '0.5rem', background: 'var(--bg-card)', height: '100%', display: 'flex', alignItems: 'center', borderRight: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: '0.58rem', fontWeight: 700, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ position: 'relative', flex: 1, height: '100%' }}>
        {children}
      </div>
    </div>
  );
}

function TlEvent({ left, color, size = 16, shape = 'circle', tooltipContent, mapDot, onHover, onEventClick, children }: {
  left: string; color: string; size?: number; shape?: 'circle' | 'square';
  tooltipContent: React.ReactNode; children?: React.ReactNode;
  mapDot?: MapDot; onHover?: (dot: MapDot | null) => void; onEventClick?: (dot: MapDot) => void;
}) {
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const hasLocation = !!mapDot;

  function showTip() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      // Clamp X so tooltip doesn't escape viewport
      const x = Math.max(90, Math.min(r.left + r.width / 2, window.innerWidth - 90));
      setTipPos({ x, y: r.top });
    }
    if (mapDot) onHover?.(mapDot);
  }

  return (
    <div
      ref={ref}
      onMouseEnter={showTip}
      onMouseLeave={() => { setTipPos(null); onHover?.(null); }}
      onClick={() => { if (mapDot) onEventClick?.(mapDot); }}
      style={{ position: 'absolute', left, top: '50%', transform: 'translate(-50%, -50%)', width: size, height: size, borderRadius: shape === 'square' ? 3 : '50%', background: `${color}25`, border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasLocation ? 'pointer' : 'default', zIndex: 2, flexShrink: 0 }}
    >
      <div style={{ width: '100%', height: '100%', borderRadius: 'inherit', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
      {tipPos && createPortal(
        <div style={{ position: 'fixed', left: tipPos.x, top: tipPos.y - 10, transform: 'translate(-50%, -100%)', zIndex: 9999, background: '#0d1117', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.75rem', minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>
          {tooltipContent}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Map overlay ──────────────────────────────────────────────────────────────

// Calibrated via least-squares regression over 10 fixed-position reference points
// (T1×6, T2×3, Fangtooth) extracted from user-annotated map image.
// Error < 4px across all reference points. Game Y increases downward (no inversion).
// Scale: ~0.03287 px/game_unit (isotropic X and Y).
const MAP_BOUNDS = { minX: -16311, maxX: 17637, minY: -16498, maxY: 20026 };

function gameToMap(x: number, y: number, w: number, h: number): { px: number; py: number } {
  const px = ((x - MAP_BOUNDS.minX) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX)) * w;
  const py = ((y - MAP_BOUNDS.minY) / (MAP_BOUNDS.maxY - MAP_BOUNDS.minY)) * h;
  return { px, py };
}

interface MapDot {
  x: number; y: number;
  color: string;
  label: string;
  pinned: boolean;
}

function MapOverlay({ dots, onClearPinned }: { dots: MapDot[]; onClearPinned: () => void }) {
  const W = 280;
  const H = 300;

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden', position: 'relative', width: W, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Map</span>
        {dots.some((d) => d.pinned) && (
          <button onClick={onClearPinned} style={{ fontSize: '0.6rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>Clear pins</button>
        )}
      </div>
      <div style={{ position: 'relative', width: W, height: H }}>
        <img src="/maps/map.png" alt="map" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.75 }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {dots.map((dot, i) => {
            const { px, py } = gameToMap(dot.x, dot.y, W, H);
            return (
              <g key={i}>
                <circle cx={px} cy={py} r={dot.pinned ? 7 : 5} fill={dot.color} opacity={dot.pinned ? 0.95 : 0.8} stroke="#000" strokeWidth={1.5} />
                {dot.pinned && (
                  <text x={px + 9} y={py + 4} fontSize={8} fill={dot.color} fontWeight="bold" style={{ fontFamily: 'monospace' }}>{dot.label}</text>
                )}
              </g>
            );
          })}
        </svg>
        {dots.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0 1rem' }}>Hover or click an event<br />to see its location</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tooltip builders ──────────────────────────────────────────────────────────

function TlTipTime({ time }: { time: string }) {
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>{time}</span>;
}

function TlTipTitle({ label, color }: { label: string; color?: string }) {
  return <div style={{ fontWeight: 800, fontSize: '0.72rem', color: color ?? 'var(--text-primary)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>{label}</div>;
}

function TlTipHeroRow({ heroSlug, name, teamColor: tc, icon }: { heroSlug: string | null; name: string; teamColor: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
      <span style={{ color: tc, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ width: 26, height: 26, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-dark)', border: `1px solid ${tc}55`, flexShrink: 0 }}>
        {heroSlug && <img src={`/heroes/${heroSlug}.webp`} alt={heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: tc, textTransform: 'capitalize' }}>{name ?? '?'}</span>
    </div>
  );
}

function TlTipRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.67rem', lineHeight: 1.8 }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 48 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

function TlTipItemRow({ itemName }: { itemName: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.3rem' }}>
      <div style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
        {itemName && <img src={`/items/${itemName.toLowerCase()}.webp`} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
      </div>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>{itemName ?? '?'}</span>
    </div>
  );
}

// ── Statistics Tab ────────────────────────────────────────────────────────────

function StatisticsTab({ match, duskWon, dawnWon, onResync, syncing }: {
  match: MatchDetailData; duskWon: boolean; dawnWon: boolean;
  onResync: () => void; syncing: boolean;
}) {
  const allPlayers = [...match.dusk, ...match.dawn];
  const hasExtendedStats = allPlayers.some((p) => p.physicalDamageDealtToHeroes !== null);

  if (!hasExtendedStats) {
    return (
      <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
          Extended statistics not available
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
          Sync this match from pred.gg to load detailed combat stats, CS, healing, and objective damage.
        </div>
        <button
          onClick={onResync}
          disabled={syncing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, padding: '0.45rem 1rem', borderRadius: '6px', cursor: syncing ? 'not-allowed' : 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)', opacity: syncing ? 0.6 : 1 }}
        >
          <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Syncing…' : 'Sync match stats'}
        </button>
      </div>
    );
  }

  const teams: Array<{ key: 'dusk' | 'dawn'; label: string; players: MatchPlayerDetail[]; won: boolean }> = [
    { key: 'dusk', label: 'Dusk', players: match.dusk, won: duskWon },
    { key: 'dawn', label: 'Dawn', players: match.dawn, won: dawnWon },
  ];

  // Global max values for relative bars across both teams
  const maxHeroDmg = Math.max(...allPlayers.map((p) => p.heroDamage ?? 0), 1);
  const maxDmgTaken = Math.max(...allPlayers.map((p) => p.heroDamageTaken ?? 0), 1);
  const maxCS = Math.max(...allPlayers.map((p) => p.laneMinionsKilled ?? 0), 1);
  const matchMinutes = Math.max(match.duration / 60, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Section 1 — Damage Output */}
      <StatSection title="Damage Output" description="Hero damage breakdown (physical · magic · true) and total dealt">
        {teams.map(({ key, label, players, won }) => (
          <StatTeamBlock key={key} teamKey={key} label={label} won={won}>
            <div style={statHeaderRowStyle}>
              <span style={{ flex: '0 0 200px' }}>Player</span>
              <span style={{ flex: '1 1 160px' }}>Hero DMG breakdown</span>
              <span style={{ flex: '0 0 88px', textAlign: 'right' }}>Total DMG</span>
              <span style={{ flex: '0 0 76px', textAlign: 'right' }}>Struct /m</span>
              <span style={{ flex: '0 0 76px', textAlign: 'right' }}>Obj /m</span>
            </div>
            {players.map((p) => {
              const phys = p.physicalDamageDealtToHeroes ?? 0;
              const magic = p.magicalDamageDealtToHeroes ?? 0;
              const trueD = p.trueDamageDealtToHeroes ?? 0;
              const heroTotal = (phys + magic + trueD) || (p.heroDamage ?? 0);
              const barW = heroTotal / maxHeroDmg;
              return (
                <div key={p.id} style={statRowStyle}>
                  <StatPlayerCell player={p} teamColor={key === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)'} />
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
                      {phys > 0 && <span style={{ color: '#f97316' }}>{(phys / 1000).toFixed(1)}k P</span>}
                      {magic > 0 && <span style={{ color: '#a78bfa' }}>{(magic / 1000).toFixed(1)}k M</span>}
                      {trueD > 0 && <span style={{ color: '#94a3b8' }}>{(trueD / 1000).toFixed(1)}k T</span>}
                    </div>
                    <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
                      {heroTotal > 0 && <>
                        <div style={{ width: `${(phys / heroTotal) * barW * 100}%`, height: '100%', background: '#f97316' }} />
                        <div style={{ width: `${(magic / heroTotal) * barW * 100}%`, height: '100%', background: '#a78bfa' }} />
                        <div style={{ width: `${(trueD / heroTotal) * barW * 100}%`, height: '100%', background: '#94a3b8' }} />
                      </>}
                    </div>
                  </div>
                  <StatNum value={p.totalDamage} style={{ flex: '0 0 88px' }} />
                  <div style={{ flex: '0 0 76px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {p.totalDamageDealtToStructures !== null ? `${(p.totalDamageDealtToStructures / matchMinutes / 1000).toFixed(1)}k` : '—'}
                  </div>
                  <div style={{ flex: '0 0 76px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {p.totalDamageDealtToObjectives !== null ? `${(p.totalDamageDealtToObjectives / matchMinutes / 1000).toFixed(1)}k` : '—'}
                  </div>
                </div>
              );
            })}
          </StatTeamBlock>
        ))}
      </StatSection>

      {/* Section 2 — Survivability */}
      <StatSection title="Survivability" description="Damage received from heroes, taken per minute, and healing per minute">
        {teams.map(({ key, label, players, won }) => (
          <StatTeamBlock key={key} teamKey={key} label={label} won={won}>
            <div style={statHeaderRowStyle}>
              <span style={{ flex: '0 0 200px' }}>Player</span>
              <span style={{ flex: '1 1 120px' }}>Hero DMG taken</span>
              <span style={{ flex: '0 0 76px', textAlign: 'right' }}>Taken /m</span>
              <span style={{ flex: '0 0 80px', textAlign: 'right' }}>Total taken</span>
              <span style={{ flex: '0 0 72px', textAlign: 'right' }}>Heal /m</span>
              <span style={{ flex: '0 0 76px', textAlign: 'right' }}>Largest crit</span>
            </div>
            {players.map((p) => (
              <div key={p.id} style={statRowStyle}>
                <StatPlayerCell player={p} teamColor={key === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)'} />
                <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                    {p.heroDamageTaken !== null ? p.heroDamageTaken.toLocaleString() : '—'}
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${((p.heroDamageTaken ?? 0) / maxDmgTaken) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #f87171, #f97316)',
                      borderRadius: 999,
                    }} />
                  </div>
                </div>
                <div style={{ flex: '0 0 76px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {p.heroDamageTaken !== null ? Math.round(p.heroDamageTaken / matchMinutes).toLocaleString() : '—'}
                </div>
                <StatNum value={p.totalDamageTaken} style={{ flex: '0 0 80px' }} />
                <div style={{ flex: '0 0 72px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-win)' }}>
                  {p.totalHealingDone !== null ? Math.round(p.totalHealingDone / matchMinutes).toLocaleString() : '—'}
                </div>
                <StatNum value={p.largestCriticalStrike} style={{ flex: '0 0 76px' }} />
              </div>
            ))}
          </StatTeamBlock>
        ))}
      </StatSection>

      {/* Section 3 — Farm & Highlights */}
      <StatSection title="Farm & Highlights" description="Creep score, gold efficiency, ward activity per minute, and multi-kill performance">
        {teams.map(({ key, label, players, won }) => (
          <StatTeamBlock key={key} teamKey={key} label={label} won={won}>
            <div style={statHeaderRowStyle}>
              <span style={{ flex: '0 0 200px' }}>Player</span>
              <span style={{ flex: '1 1 120px' }}>CS</span>
              <span style={{ flex: '0 0 80px', textAlign: 'right' }}>Gold spent</span>
              <span style={{ flex: '0 0 76px', textAlign: 'right' }}>Kill spree</span>
              <span style={{ flex: '0 0 72px', textAlign: 'right' }}>Multi-kill</span>
              <span style={{ flex: '0 0 84px', textAlign: 'right' }}>Wards P/D /m</span>
            </div>
            {players.map((p) => (
              <div key={p.id} style={statRowStyle}>
                <StatPlayerCell player={p} teamColor={key === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)'} />
                <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                    {p.laneMinionsKilled !== null ? p.laneMinionsKilled : '—'}
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${((p.laneMinionsKilled ?? 0) / maxCS) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--accent-teal-bright), var(--accent-blue))',
                      borderRadius: 999,
                    }} />
                  </div>
                </div>
                <div style={{ flex: '0 0 80px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-prime)' }}>
                  {p.goldSpent !== null ? `${(p.goldSpent / 1000).toFixed(1)}k` : '—'}
                </div>
                <StatNum value={p.largestKillingSpree} style={{ flex: '0 0 76px' }} />
                <StatNum value={p.multiKill} color="var(--accent-violet)" style={{ flex: '0 0 72px' }} />
                <div style={{ flex: '0 0 84px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                  {p.wardsPlaced !== null ? (
                    <>
                      <span style={{ color: 'var(--accent-blue)' }}>{(p.wardsPlaced / matchMinutes).toFixed(1)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>/</span>
                      <span style={{ color: 'var(--accent-loss)', opacity: 0.85 }}>{p.wardsDestroyed !== null ? (p.wardsDestroyed / matchMinutes).toFixed(1) : '—'}</span>
                    </>
                  ) : '—'}
                </div>
              </div>
            ))}
          </StatTeamBlock>
        ))}
      </StatSection>
      {/* Section 4 — Participation */}
      <StatSection title="Participation" description="Kill share, death share, and damage share within the team">
        {teams.map(({ key, label, players, won }) => {
          const teamKills = Math.max(players.reduce((s, p) => s + p.kills, 0), 1);
          const teamDeaths = Math.max(players.reduce((s, p) => s + p.deaths, 0), 1);
          const teamHeroDmg = Math.max(players.reduce((s, p) => s + (p.heroDamage ?? 0), 0), 1);
          return (
            <StatTeamBlock key={key} teamKey={key} label={label} won={won}>
              <div style={statHeaderRowStyle}>
                <span style={{ flex: '0 0 200px' }}>Player</span>
                <span style={{ flex: '1 1 100px' }}>Kill Share %</span>
                <span style={{ flex: '0 0 88px', textAlign: 'right' }}>Death Share %</span>
                <span style={{ flex: '0 0 88px', textAlign: 'right' }}>Dmg Share %</span>
              </div>
              {players.map((p) => {
                const ks = Math.round((p.kills / teamKills) * 100);
                const ds = Math.round((p.deaths / teamDeaths) * 100);
                const dms = p.heroDamage !== null ? Math.round((p.heroDamage / teamHeroDmg) * 100) : null;
                return (
                  <div key={p.id} style={statRowStyle}>
                    <StatPlayerCell player={p} teamColor={key === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)'} />
                    <div style={{ flex: '1 1 100px', minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: '0.25rem', color: 'var(--accent-win)' }}>{ks}%</div>
                      <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${ks}%`, height: '100%', background: 'var(--accent-win)', borderRadius: 999 }} />
                      </div>
                    </div>
                    <div style={{ flex: '0 0 88px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: ds > 30 ? 'var(--accent-loss)' : 'var(--text-muted)' }}>
                      {ds}%
                    </div>
                    <div style={{ flex: '0 0 88px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-prime)' }}>
                      {dms !== null ? `${dms}%` : '—'}
                    </div>
                  </div>
                );
              })}
            </StatTeamBlock>
          );
        })}
      </StatSection>
    </div>
  );
}

function StatSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.6rem' }}>{description}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  );
}

function StatTeamBlock({ teamKey, label, won, children }: { teamKey: 'dusk' | 'dawn'; label: string; won: boolean; children: React.ReactNode }) {
  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid var(--border-color)',
        background: won ? 'rgba(56,212,200,0.04)' : 'rgba(248,113,113,0.04)',
      }}>
        <div style={{ width: 3, height: 16, borderRadius: 999, background: teamKey === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: teamKey === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)' }}>{label}</span>
        {won
          ? <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-win)', fontFamily: 'var(--font-mono)' }}>VICTORY</span>
          : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-loss)', fontFamily: 'var(--font-mono)' }}>DEFEAT</span>
        }
      </div>
      {children}
    </div>
  );
}

function StatPlayerCell({ player, teamColor }: { player: MatchPlayerDetail; teamColor: string }) {
  const navigate = useNavigate();
  const displayedName = player.customName ?? player.playerName;
  return (
    <div
      onClick={() => player.playerId && navigate('/analysis/players', { state: { autoLoadPlayerId: player.playerId } })}
      style={{ flex: '0 0 200px', display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, cursor: player.playerId ? 'pointer' : 'default' }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-dark)', flexShrink: 0, border: `1px solid ${teamColor}40` }}>
        <img src={player.heroImageUrl ?? `/heroes/${player.heroSlug}.webp`} alt={player.heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.heroName ?? player.heroSlug}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayedName}
        </div>
      </div>
    </div>
  );
}

function StatNum({ value, color, style }: { value: number | null; color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: color ?? 'var(--text-secondary)', ...style }}>
      {value !== null ? value.toLocaleString() : <span style={{ color: 'var(--text-muted)' }}>—</span>}
    </div>
  );
}

const statHeaderRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem',
  padding: '0.35rem 1rem',
  fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: '1px solid var(--border-color)',
  background: 'rgba(255,255,255,0.01)',
};

const statRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem',
  padding: '0.55rem 1rem',
  borderBottom: '1px solid var(--border-color)',
};

// ── Scoreboard helpers ────────────────────────────────────────────────────────

function formatItemName(slug: string): string {
  return slug.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function ItemIcon({ slug }: { slug: string }) {
  const [err, setErr] = useState(false);
  const label = formatItemName(slug);
  if (err) return null;
  return (
    <div title={label} style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', flexShrink: 0, cursor: 'default' }}>
      <img src={`/items/${slug}.webp`} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setErr(true)} />
    </div>
  );
}

function GameModeBadge({ mode }: { mode: string }) {
  const label = mode === 'RANKED' ? 'Ranked' : mode === 'ARAM' ? 'ARAM' : mode === 'BRAWL' ? 'Brawl' : mode;
  const color = mode === 'RANKED' ? 'var(--accent-violet)' : mode === 'ARAM' || mode === 'BRAWL' ? 'var(--accent-prime)' : 'var(--accent-blue)';
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: '4px', padding: '0.1rem 0.45rem', fontFamily: 'var(--font-mono)' }}>
      {label}
    </span>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem',
  padding: '0.4rem 1rem',
  fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: '1px solid var(--border-color)',
  background: 'rgba(255,255,255,0.015)',
};
