import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Skull, Clock, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type MatchDetail as MatchDetailData, type MatchPlayerDetail, ApiErrorResponse } from '../api/client';

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'scoreboard' | 'statistics' | 'timeline' | 'analysis'>('scoreboard');

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

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading match…</div>;
  if (!match) return <div style={{ padding: '2rem', color: 'var(--accent-loss)' }}>Match not found.</div>;

  const isAram = match.gameMode === 'ARAM' || match.gameMode === 'BRAWL';
  const duskWon = match.winningTeam === 'DUSK';
  const dawnWon = match.winningTeam === 'DAWN';

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
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem', padding: 0 }}
        >
          <ArrowLeft size={16} /> Back
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
        <ScoreboardTab match={match} duskWon={duskWon} dawnWon={dawnWon} isAram={isAram} />
      )}
    </div>
  );
}

function ScoreboardTab({ match, duskWon, dawnWon, isAram }: {
  match: MatchDetailData;
  duskWon: boolean;
  dawnWon: boolean;
  isAram: boolean;
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
                <span><span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{(totalGold / 1000).toFixed(1)}k</span> gold</span>
                <span><span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{(totalDamage / 1000).toFixed(1)}k</span> dmg</span>
              </div>
            </div>

            {/* Column headers */}
            <div style={headerRowStyle}>
              <span style={{ flex: '2 1 180px' }}>Player</span>
              <span style={{ flex: '1 1 90px', textAlign: 'center' }}>K / D / A</span>
              <span style={{ flex: '1 1 90px', textAlign: 'right' }}>Damage</span>
              <span style={{ flex: '0 0 56px', textAlign: 'right' }}>Gold</span>
              <span style={{ flex: '0 0 40px', textAlign: 'right' }}>CS</span>
              {!isAram && <span style={{ flex: '0 0 48px', textAlign: 'right' }}>Wards</span>}
              <span style={{ flex: '0 0 130px' }}>Items</span>
            </div>

            {/* Player rows */}
            {players.map((p) => (
              <PlayerRow key={p.id} player={p} isAram={isAram} teamColor={key === 'dusk' ? 'var(--accent-teal-bright)' : 'var(--accent-loss)'} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PlayerRow({ player, isAram, teamColor }: { player: MatchPlayerDetail; isAram: boolean; teamColor: string }) {
  const kda = player.deaths > 0
    ? ((player.kills + player.assists) / player.deaths).toFixed(2)
    : player.kills + player.assists > 0 ? 'Perfect' : '0.00';

  const [imgErr, setImgErr] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-color)',
      background: 'rgba(255,255,255,0.01)',
      flexWrap: 'wrap',
    }}>
      {/* Hero + player */}
      <div style={{ flex: '2 1 180px', display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }}>
          {!imgErr && player.heroImageUrl
            ? <img src={player.heroImageUrl} alt={player.heroSlug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {player.heroSlug.slice(0, 2).toUpperCase()}
              </div>
          }
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.heroName ?? player.heroSlug}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: teamColor, fontWeight: 600, marginRight: '0.35rem', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
              {player.rankLabel ?? ''}
            </span>
            {player.customName ?? player.playerName}
          </div>
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
      <div style={{ flex: '1 1 90px', textAlign: 'right' }}>
        {player.heroDamage !== null
          ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{player.heroDamage.toLocaleString()}</div>
          : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
        }
      </div>

      {/* Gold */}
      <div style={{ flex: '0 0 56px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-prime)' }}>
        {player.gold !== null ? `${(player.gold / 1000).toFixed(1)}k` : '—'}
      </div>

      {/* CS — wards placed used as CS approximation since we track wardsPlaced, not CS directly */}
      <div style={{ flex: '0 0 40px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
        —
      </div>

      {/* Wards (non-ARAM only) */}
      {!isAram && (
        <div style={{ flex: '0 0 48px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {player.wardsPlaced ?? '—'}
        </div>
      )}

      {/* Items */}
      <div style={{ flex: '0 0 130px', display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
        {player.inventoryItems.slice(0, 6).map((slug, i) => (
          <ItemIcon key={i} slug={slug} />
        ))}
      </div>
    </div>
  );
}

function ItemIcon({ slug }: { slug: string }) {
  const [err, setErr] = useState(false);
  return (
    <div style={{ width: 20, height: 20, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
      {!err
        ? <img src={`/items/${slug}.webp`} alt={slug} title={slug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setErr(true)} />
        : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.04)' }} title={slug} />
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
