import { useState } from 'react';
import { Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type PlayerSearchResult, ApiErrorResponse } from '../api/client';

export default function PlayerScouting() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await apiClient.players.search(query.trim());
      setResults(data.results ?? []);
      if (!data.results?.length) {
        toast.info('No players found in local database.', { description: 'Try fetching from pred.gg below.' });
      }
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Error searching players.';
      toast.error(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchFromPredgg = async () => {
    setLoading(true);
    const toastId = toast.loading(`Fetching "${query}" from pred.gg...`);
    try {
      await apiClient.admin.syncData('sync-player', [query.trim()]);
      const data = await apiClient.players.search(query.trim());
      setResults(data.results ?? []);
      if (data.results?.length) {
        toast.success(`Player "${query}" synced`, { id: toastId });
      } else {
        toast.warning('Player not found in pred.gg either.', { id: toastId });
      }
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Error fetching from pred.gg.';
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Player Scouting</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Search for players by name.</p>
      </header>

      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search color="var(--text-muted)" size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Enter player name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', padding: '1rem 1rem 1rem 3rem',
                color: 'var(--text-primary)', outline: 'none', fontSize: '1rem',
              }}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '0 2rem' }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
        {results.map((p) => (
          <div key={p.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: '50%', flexShrink: 0 }}>
              <User size={24} color={p.isPrivate ? 'var(--text-muted)' : 'var(--accent-blue)'} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.displayName}
                {p.isPrivate && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(private)</span>}
              </div>
              {p.inferredRegion && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{p.inferredRegion}</div>}
            </div>
          </div>
        ))}

        {!loading && searched && results.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Player not found in local database.</p>
            <button onClick={handleFetchFromPredgg} disabled={loading} className="btn-primary">
              Fetch from pred.gg
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
