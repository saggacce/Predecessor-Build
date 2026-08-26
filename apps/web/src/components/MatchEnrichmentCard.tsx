import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, DatabaseZap, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type PlayerMatchEnrichmentStatus } from '../api/client';

interface MatchEnrichmentCardProps {
  enabled: boolean;
  refreshToken?: number;
  onCompleted?: () => void;
}

export function MatchEnrichmentCard({ enabled, refreshToken = 0, onCompleted }: MatchEnrichmentCardProps) {
  const [status, setStatus] = useState<PlayerMatchEnrichmentStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const wasRunning = useRef(false);
  const completionHandler = useRef(onCompleted);

  useEffect(() => {
    completionHandler.current = onCompleted;
  }, [onCompleted]);

  const loadStatus = useCallback(async () => {
    if (!enabled) return;
    try {
      const next = await apiClient.sync.matchCoverage();
      setStatus(next);
      if (wasRunning.current && !next.job?.running) completionHandler.current?.();
      wasRunning.current = Boolean(next.job?.running);
    } catch (error) {
      toast.error(error instanceof ApiErrorResponse ? error.error.message : 'No se pudo comprobar la calidad de las partidas.');
    }
  }, [enabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus, refreshToken]);

  useEffect(() => {
    if (!status?.job?.running) return;
    const timer = window.setInterval(() => void loadStatus(), 2000);
    return () => window.clearInterval(timer);
  }, [loadStatus, status?.job?.running]);

  async function startEnrichment() {
    try {
      setStarting(true);
      const next = await apiClient.sync.enrichMyMatches((status?.failed ?? 0) > 0);
      setStatus(next);
      wasRunning.current = Boolean(next.job?.running);
      toast.success(next.job?.running ? 'Análisis detallado iniciado en segundo plano.' : 'La muestra ya está completa.');
    } catch (error) {
      toast.error(error instanceof ApiErrorResponse ? error.error.message : 'No se pudo iniciar el análisis detallado.');
    } finally {
      setStarting(false);
    }
  }

  if (!enabled || !status) return null;

  const running = Boolean(status.job?.running);
  const complete = status.totalMatches > 0 && status.pending === 0;
  const progressLabel = running && status.job
    ? `${status.job.processed} de ${status.job.total} pendientes procesadas`
    : `${status.fullyEnriched} de ${status.totalMatches} partidas listas para el coach`;

  return (
    <section className="glass-card" style={{ padding: '1rem 1.1rem' }} aria-labelledby="match-coverage-title">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
          <div style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 9, flexShrink: 0, color: complete ? 'var(--accent-win)' : 'var(--accent-violet)', background: complete ? 'rgba(52,211,153,0.12)' : 'rgba(167,139,250,0.12)' }}>
            {complete ? <CheckCircle2 size={20} /> : <DatabaseZap size={20} />}
          </div>
          <div>
            <h2 id="match-coverage-title" style={{ margin: 0, fontSize: '0.9rem' }}>Calidad de la muestra</h2>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {progressLabel}. Ventana de {status.windowDays} días.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={starting || running || status.pending === 0}
          onClick={() => void startEnrichment()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flex: 'unset', whiteSpace: 'nowrap', fontSize: '0.74rem' }}
        >
          <RefreshCw size={14} className={starting || running ? 'spin' : undefined} />
          {running ? 'Analizando…' : complete ? 'Muestra completa' : 'Analizar pendientes'}
        </button>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={status.coveragePercent}
        aria-label="Cobertura de partidas listas para el coach"
        style={{ height: 7, marginTop: '0.85rem', overflow: 'hidden', borderRadius: 999, background: 'rgba(148,163,184,0.14)' }}
      >
        <div style={{ width: `${status.coveragePercent}%`, height: '100%', borderRadius: 999, background: complete ? 'var(--accent-win)' : 'var(--accent-violet)', transition: 'width 0.25s ease' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.68rem', flexWrap: 'wrap' }}>
        <span>{status.coveragePercent}% con plantilla y eventos completos</span>
        {status.failed > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-loss)' }}>
            <TriangleAlert size={12} /> {status.failed} {status.failed === 1 ? 'partida requiere reintento' : 'partidas requieren reintento'}
          </span>
        ) : null}
      </div>
    </section>
  );
}
