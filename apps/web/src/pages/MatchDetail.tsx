import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { ArrowLeft, Trophy, Skull, Clock, RefreshCw, Pencil, Check, X, Monitor, Gamepad2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type MatchDetail as MatchDetailData, type MatchPlayerDetail, ApiErrorResponse } from '../api/client';

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = location.state as { fromPlayerId?: string; fromPlayerName?: string } | null;
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
    const toastId = toast.loading('Fetching player names from pred.gg…');
    try {
      const updated = await apiClient.matches.syncPlayers(id);
      setMatch(updated);
      toast.success('Player names updated', { id: toastId });
    } catch (err) {
      toast.error(err instanceof ApiErrorResponse ? err.error.message : 'Failed to fetch players.', { id: toastId });
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

  const tabs: { key: typeof tab; label: string; disabled?: boolean }[] = [
    { key: 'scoreboard', label: 'Scoreboard' },
    { key: 'statistics', label: 'Statistics', disabled: true },
    { key: 'timeline', label: 'Timeline', disabled: true },
    { key: 'analysis', label: 'Analysis', disabled: true },
  ];

  return (
    <div>
      <header className="header" style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => fromState?.fromPlayerId
            ? navigate('/players', { state: { autoLoadPlayerId: fromState.fromPlayerId } })
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
              {hasHidden && (
                <button
                  onClick={() => void handleSyncPlayers()}
                  disabled={syncing}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: syncing ? 'not-allowed' : 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(91,156,246,0.1)', color: 'var(--accent-blue)', opacity: syncing ? 0.6 : 1 }}
                >
                  <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                  {syncing ? 'Fetching…' : 'Fetch player names'}
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
          editingPlayerId={editingPlayerId} editingValue={editingValue}
          onStartEdit={(playerId, current) => { setEditingPlayerId(playerId); setEditingValue(current); }}
          onSaveEdit={handleSaveCustomName}
          onCancelEdit={() => setEditingPlayerId(null)}
          onEditValueChange={setEditingValue}
        />
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

function ScoreboardTab({ match, duskWon, dawnWon, isAram, editingPlayerId, editingValue, onStartEdit, onSaveEdit, onCancelEdit, onEditValueChange }: {
  match: MatchDetailData;
  duskWon: boolean;
  dawnWon: boolean;
  isAram: boolean;
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
              <span style={{ flex: '2 1 180px' }}>Player</span>
              <span style={{ flex: '1 1 90px', display: 'flex', justifyContent: 'center' }}>K / D / A</span>
              <span style={{ flex: '1 1 90px', display: 'flex', justifyContent: 'center' }}>DMG to heroes</span>
              <span style={{ flex: '0 0 56px', display: 'flex', justifyContent: 'center' }}>Gold total</span>
              {!isAram && <span className="hide-mobile" style={{ flex: '0 0 48px', display: 'flex', justifyContent: 'center' }}>Wards</span>}
              <span className="hide-mobile" style={{ flex: '0 0 180px', display: 'flex', justifyContent: 'center' }}>Items</span>
            </div>

            {/* Player rows */}
            {players.map((p) => (
              <PlayerRow
                key={p.id} player={p} isAram={isAram}
                teamColor={key === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)'}
                maxDamage={maxDamage}
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

function PlayerRow({ player, isAram, teamColor, maxDamage, isEditing, editingValue, onStartEdit, onSaveEdit, onCancelEdit, onEditValueChange }: {
  player: MatchPlayerDetail; isAram: boolean; teamColor: string; maxDamage: number;
  isEditing: boolean; editingValue: string;
  onStartEdit: (playerId: string, current: string) => void;
  onSaveEdit: (playerId: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (v: string) => void;
}) {
  const kda = player.deaths > 0
    ? ((player.kills + player.assists) / player.deaths).toFixed(2)
    : player.kills + player.assists > 0 ? 'Perfect' : '0.00';

  const [imgErr, setImgErr] = useState(false);
  const navigate = useNavigate();
  const displayedName = player.customName ?? player.playerName;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-color)',
      background: 'rgba(255,255,255,0.01)', flexWrap: 'wrap',
    }}>
      {/* Hero + player */}
      <div
        onClick={() => player.playerId && navigate('/players', { state: { autoLoadPlayerId: player.playerId } })}
        style={{ flex: '2 1 180px', display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, cursor: player.playerId ? 'pointer' : 'default' }}
        title={player.playerId ? `View ${displayedName}'s profile` : undefined}
      >
        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }}>
          {!imgErr && player.heroImageUrl
            ? <img src={player.heroImageUrl} alt={player.heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {player.heroSlug.slice(0, 2).toUpperCase()}
              </div>
          }
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.heroName ?? player.heroSlug}
          </div>
          {isEditing && player.playerId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
              <input
                autoFocus
                value={editingValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(player.playerId!); if (e.key === 'Escape') onCancelEdit(); }}
                placeholder={player.playerName}
                style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', background: 'var(--bg-dark)', border: '1px solid var(--accent-blue)', borderRadius: '4px', color: 'var(--text-primary)', width: '120px' }}
              />
              <button onClick={() => onSaveEdit(player.playerId!)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-win)', display: 'flex' }}><Check size={13} /></button>
              <button onClick={onCancelEdit} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={13} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span style={{ color: teamColor, fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>{player.rankLabel ?? ''}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayedName}</span>
              {player.isConsole
                ? <Gamepad2 size={11} title="Console player" style={{ flexShrink: 0, color: 'var(--accent-violet)' }} />
                : <Monitor size={11} title="PC player" style={{ flexShrink: 0, color: 'var(--text-muted)', opacity: 0.5 }} />
              }
              {player.customName && <span style={{ fontSize: '0.62rem', color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)' }}>custom</span>}
              {player.playerId && (
                <button
                  onClick={() => onStartEdit(player.playerId!, player.customName ?? '')}
                  title="Set custom name"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0, flexShrink: 0 }}
                >
                  <Pencil size={10} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* K/D/A */}
      <div style={{ flex: '1 1 90px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
        <div>
          <span style={{ color: 'var(--accent-win)' }}>{player.kills}</span>
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          <span style={{ color: 'var(--accent-loss)' }}>{player.deaths}</span>
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          <span>{player.assists}</span>
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{kda} KDA</div>
      </div>

      {/* Damage bar */}
      <div style={{ flex: '1 1 90px', minWidth: 0 }}>
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

      {/* Gold */}
      <div style={{ flex: '0 0 56px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-prime)' }}>
        {player.gold !== null ? `${(player.gold / 1000).toFixed(1)}k` : '—'}
      </div>

      {/* Wards (non-ARAM only) */}
      {!isAram && (
        <div className="hide-mobile" style={{ flex: '0 0 48px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {player.wardsPlaced ?? '—'}
        </div>
      )}

      {/* Items */}
      <div className="hide-mobile" style={{ flex: '0 0 180px', display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gap: '3px', justifyContent: 'center', alignContent: 'center' }}>
        {player.inventoryItems.filter(Boolean).slice(0, 6).map((slug, i) => (
          <ItemIcon key={i} slug={slug} />
        ))}
      </div>
    </div>
  );
}

function formatItemName(slug: string): string {
  return slug.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function ItemIcon({ slug }: { slug: string }) {
  const [err, setErr] = useState(false);
  const label = formatItemName(slug);
  return (
    <div title={label} style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', flexShrink: 0, cursor: 'default' }}>
      {!err
        ? <img src={`/items/${slug}.webp`} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setErr(true)} />
        : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.04)' }} />
      }
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
