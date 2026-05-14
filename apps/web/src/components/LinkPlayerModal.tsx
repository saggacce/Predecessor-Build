import { useState } from 'react';
import { Search, Link2, X, CheckCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type PlayerSearchResult } from '../api/client';

interface Props {
  onLinked: (playerId: string, displayName: string) => void;
  onClose: () => void;
}

export function LinkPlayerModal({ onLinked, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (query.trim().length < 2) { toast.error('Escribe al menos 2 caracteres'); return; }
    setSearching(true);
    setSearched(true);
    try {
      const { results: r } = await apiClient.players.search(query.trim());
      setResults(r);
    } catch { toast.error('Error buscando jugadores'); }
    finally { setSearching(false); }
  }

  async function handleLink(player: PlayerSearchResult) {
    setLinking(player.id);
    try {
      await apiClient.profile.linkPlayer(player.id);
      toast.success(`Perfil vinculado: ${player.customName ?? player.displayName}`);
      onLinked(player.id, player.customName ?? player.displayName);
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message ?? 'Error al vincular';
      toast.error(msg);
    } finally {
      setLinking(null);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card" style={{ width: '100%', maxWidth: 520, padding: '1.5rem', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <Link2 size={18} style={{ color: 'var(--accent-teal-bright)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Vincular perfil de jugador</h2>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
          Busca tu nombre de jugador en Predecessor para vincular tu cuenta y ver tus estadísticas.
        </p>

        {/* Search */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
            placeholder="Tu nombre en el juego…"
            style={{ flex: 1, padding: '0.5rem 0.75rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 7, color: 'var(--text-primary)', fontSize: '0.88rem' }}
            autoFocus
          />
          <button
            onClick={() => void handleSearch()}
            disabled={searching || query.trim().length < 2}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.9rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
          >
            <Search size={14} />
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {/* Results */}
        {searched && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 280, overflowY: 'auto' }}>
            {results.length === 0 && !searching && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No se encontraron jugadores con ese nombre.<br />
                <span style={{ fontSize: '0.75rem' }}>Prueba con otro nombre o comprueba la ortografía.</span>
              </div>
            )}
            {results.map((player) => (
              <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                {/* Avatar placeholder */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(56,212,200,0.15)', border: '1px solid rgba(56,212,200,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={16} style={{ color: 'var(--accent-teal-bright)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.customName ?? player.displayName}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem', display: 'flex', gap: '0.5rem' }}>
                    {player.isConsole && <span style={{ color: 'var(--accent-prime)' }}>Console</span>}
                    {player.inferredRegion && <span>{player.inferredRegion}</span>}
                  </div>
                </div>
                <button
                  onClick={() => void handleLink(player)}
                  disabled={!!linking}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', background: 'rgba(56,212,200,0.1)', border: '1px solid rgba(56,212,200,0.3)', borderRadius: 6, color: 'var(--accent-teal-bright)', cursor: linking ? 'not-allowed' : 'pointer', fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap', opacity: linking && linking !== player.id ? 0.5 : 1 }}
                >
                  {linking === player.id
                    ? <><span style={{ width: 10, height: 10, border: '2px solid var(--accent-teal-bright)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} /></>
                    : <><CheckCircle size={13} /> Soy yo</>
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.5 }}>
          ¿No encuentras tu perfil? Puede que aún no esté en nuestra base de datos.
          Contacta al administrador para sincronizarlo desde pred.gg.
        </p>
      </div>
    </div>
  );
}
