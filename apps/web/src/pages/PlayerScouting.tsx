import { useState } from 'react';
import { Search, User, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type PlayerSearchResult, type SyncedPlayer, ApiErrorResponse } from '../api/client';

type Phase =
  | { tag: 'idle' }
  | { tag: 'searching' }
  | { tag: 'results'; players: PlayerSearchResult[] }
  | { tag: 'empty'; query: string }          // local DB has nothing
  | { tag: 'syncing'; step: string }         // fetching from pred.gg
  | { tag: 'synced'; player: SyncedPlayer }  // pred.gg found + saved
  | { tag: 'not_found'; query: string }      // pred.gg also has nothing
  | { tag: 'error'; message: string };

export default function PlayerScouting() {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>({ tag: 'idle' });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setPhase({ tag: 'searching' });
    try {
      const data = await apiClient.players.search(q);
      const players = data.results ?? [];
      setPhase(players.length > 0 ? { tag: 'results', players } : { tag: 'empty', query: q });
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Search failed.';
      setPhase({ tag: 'error', message: msg });
    }
  }

  async function handleSyncFromPredgg(name: string) {
    setPhase({ tag: 'syncing', step: 'Connecting to pred.gg...' });

    // Small delay so the user sees the step before the actual request fires
    await new Promise((r) => setTimeout(r, 400));
    setPhase({ tag: 'syncing', step: `Searching for "${name}" on pred.gg...` });

    try {
      const res = await apiClient.players.sync(name);
      setPhase({ tag: 'syncing', step: 'Saving to local database...' });
      await new Promise((r) => setTimeout(r, 300));
      setPhase({ tag: 'synced', player: res.player });
      toast.success(`"${res.player.displayName}" synced successfully`);
    } catch (err) {
      if (err instanceof ApiErrorResponse && err.status === 404) {
        setPhase({ tag: 'not_found', query: name });
      } else if (err instanceof ApiErrorResponse && err.error.code === 'PREDGG_AUTH_REQUIRED') {
        setPhase({ tag: 'error', message: 'pred.gg requires user login to search players. Add players manually once OAuth is available.' });
      } else {
        const msg = err instanceof ApiErrorResponse ? err.error.message : 'Sync failed.';
        setPhase({ tag: 'error', message: msg });
        toast.error(msg);
      }
    }
  }

  function reset() {
    setPhase({ tag: 'idle' });
    setQuery('');
  }

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Player Scouting</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Search the local database or fetch directly from pred.gg.
        </p>
      </header>

      {/* Search bar */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              color="var(--text-muted)"
              size={20}
              style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Enter player name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={phase.tag === 'searching' || phase.tag === 'syncing'}
              style={{
                width: '100%', background: 'var(--bg-dark)',
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                padding: '1rem 1rem 1rem 3rem', color: 'var(--text-primary)',
                outline: 'none', fontSize: '1rem',
                opacity: (phase.tag === 'searching' || phase.tag === 'syncing') ? 0.6 : 1,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={phase.tag === 'searching' || phase.tag === 'syncing' || !query.trim()}
            className="btn-primary"
            style={{ padding: '0 2rem' }}
          >
            {phase.tag === 'searching' ? 'Searching...' : 'Search'}
          </button>
          {phase.tag !== 'idle' && (
            <button type="button" onClick={reset} className="btn-secondary" style={{ padding: '0 1rem' }}>
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Phase: searching */}
      {phase.tag === 'searching' && (
        <StatusCard icon={<Spinner />} title="Searching local database..." color="var(--accent-blue)" />
      )}

      {/* Phase: results */}
      {phase.tag === 'results' && (
        <>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {phase.players.length} player{phase.players.length !== 1 ? 's' : ''} found in local database
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {phase.players.map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
        </>
      )}

      {/* Phase: empty — player not in local DB */}
      {phase.tag === 'empty' && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <Search color="var(--text-muted)" size={40} />
          </div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            "{phase.query}" not in local database
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            Fetch the player directly from pred.gg and save them locally.
          </p>
          <button
            onClick={() => void handleSyncFromPredgg(phase.query)}
            className="btn-primary"
            style={{ padding: '0.75rem 2rem' }}
          >
            Fetch from pred.gg
          </button>
        </div>
      )}

      {/* Phase: syncing — step-by-step progress */}
      {phase.tag === 'syncing' && (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Spinner size={40} color="var(--accent-purple)" />
          </div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Syncing player...</h3>
          <p style={{ color: 'var(--accent-blue)', fontSize: '0.875rem', fontWeight: 500 }}>
            {phase.step}
          </p>
          <SyncSteps currentStep={phase.step} />
        </div>
      )}

      {/* Phase: synced — player found and saved */}
      {phase.tag === 'synced' && (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <CheckCircle color="var(--accent-success)" size={24} />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Player synced successfully</h3>
          </div>
          <PlayerCard
            player={{
              id: phase.player.id,
              displayName: phase.player.displayName,
              isPrivate: phase.player.isPrivate,
              inferredRegion: phase.player.inferredRegion,
              lastSynced: phase.player.lastSynced.toString(),
            }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem' }}>
            Player is now saved locally. Search for them anytime without fetching again.
          </p>
        </div>
      )}

      {/* Phase: not found on pred.gg */}
      {phase.tag === 'not_found' && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <XCircle color="var(--accent-danger)" size={40} style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Player not found
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            "{phase.query}" was not found on pred.gg. Check the spelling and try again.
          </p>
        </div>
      )}

      {/* Phase: error */}
      {phase.tag === 'error' && (
        <StatusCard
          icon={<AlertCircle color="var(--accent-danger)" size={24} />}
          title={phase.message}
          color="var(--accent-danger)"
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PlayerCard({ player }: { player: { id: string; displayName: string; isPrivate: boolean; inferredRegion: string | null; lastSynced: string } }) {
  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: '50%', flexShrink: 0 }}>
        <User size={24} color={player.isPrivate ? 'var(--text-muted)' : 'var(--accent-blue)'} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.displayName}
          {player.isPrivate && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem',
              background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
              private
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
          {player.inferredRegion ?? 'Region unknown'}
          <span style={{ margin: '0 0.4rem' }}>·</span>
          Last synced {new Date(player.lastSynced).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color }}>
      {icon}
      <span style={{ fontWeight: 500 }}>{title}</span>
    </div>
  );
}

function Spinner({ size = 24, color = 'var(--accent-blue)' }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `3px solid rgba(255,255,255,0.1)`,
      borderTopColor: color,
      animation: 'spin 0.8s linear infinite',
      display: 'inline-block',
    }} />
  );
}

const SYNC_STEPS = [
  'Connecting to pred.gg...',
  'Searching for',
  'Saving to local database...',
];

function SyncSteps({ currentStep }: { currentStep: string }) {
  const currentIdx = SYNC_STEPS.findIndex((s) => currentStep.startsWith(s));
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
      {SYNC_STEPS.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: i < currentIdx ? 'var(--accent-success)'
              : i === currentIdx ? 'var(--accent-purple)'
              : 'var(--border-color)',
            transition: 'background 0.3s',
          }} />
          {i < SYNC_STEPS.length - 1 && (
            <div style={{ width: '24px', height: '1px', background: 'var(--border-color)' }} />
          )}
        </div>
      ))}
    </div>
  );
}
