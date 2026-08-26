import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, ArrowDownRight, ArrowUpRight, Crosshair, Link as LinkIcon, Minus, RefreshCw, Target } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type PlayerMetricTrend, type PlayerWeeklyReport } from '../api/client';
import { HeroAvatarWithTooltip } from '../components/HeroAvatar';
import { MatchEnrichmentCard } from '../components/MatchEnrichmentCard';
import { useAuth } from '../hooks/useAuth';

const METRIC_LABELS: Record<PlayerMetricTrend['metric'], string> = {
  kda: 'KDA',
  winRate: 'Win rate',
  averageHeroDamage: 'Daño a héroes',
  averageGold: 'Oro',
  averageLaneMinions: 'CS de línea',
};

function value(metric: PlayerMetricTrend['metric'], amount: number | null): string {
  if (amount === null) return '—';
  if (metric === 'winRate') return `${amount.toFixed(1)}%`;
  if (metric === 'kda') return amount.toFixed(2);
  return Math.round(amount).toLocaleString();
}

function TrendIcon({ direction }: { direction: PlayerMetricTrend['direction'] }) {
  if (direction === 'up') return <ArrowUpRight size={16} />;
  if (direction === 'down') return <ArrowDownRight size={16} />;
  return <Minus size={16} />;
}

function MetricCard({ trend }: { trend: PlayerMetricTrend }) {
  const color = trend.direction === 'up'
    ? 'var(--accent-win)'
    : trend.direction === 'down'
      ? 'var(--accent-loss)'
      : 'var(--text-muted)';
  const delta = trend.delta === null
    ? 'Muestra insuficiente'
    : `${trend.delta > 0 ? '+' : ''}${trend.delta}${trend.deltaUnit === 'percentage_points' ? ' pp' : '%'}`;

  return (
    <article className="glass-card" style={{ padding: '1rem 1.1rem', minWidth: 0 }}>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {METRIC_LABELS[trend.metric]}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.45rem' }}>
        <strong className="mono" style={{ fontSize: '1.35rem' }}>{value(trend.metric, trend.weekly)}</strong>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', color, fontSize: '0.72rem', fontWeight: 700 }}>
          <TrendIcon direction={trend.direction} /> {delta}
        </span>
      </div>
      <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
        Referencia 30d: {value(trend.metric, trend.baseline)}
      </p>
    </article>
  );
}

function roleMetricValue(value: number | null, unit: 'ratio' | 'per_match' | 'per_minute' | 'percent'): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  if (unit === 'ratio') return value.toFixed(2);
  if (unit === 'per_match') return value.toFixed(1);
  return value < 10 ? value.toFixed(2) : Math.round(value).toLocaleString();
}

export default function PlayerWeeklyReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<PlayerWeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [coverageRefresh, setCoverageRefresh] = useState(0);
  const linkedPlayerId = user?.linkedPlayerId;

  const loadReport = useCallback(async () => {
    if (!linkedPlayerId) {
      setLoading(false);
      return;
    }

    try {
      setReport(await apiClient.reports.playerWeekly(linkedPlayerId));
    } catch (error) {
      toast.error(error instanceof ApiErrorResponse ? error.error.message : 'No se pudo cargar el informe semanal.');
    } finally {
      setLoading(false);
    }
  }, [linkedPlayerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReport(), 0);
    return () => window.clearTimeout(timer);
  }, [loadReport]);

  async function syncMatches() {
    try {
      setSyncing(true);
      const result = await apiClient.sync.myMatches();
      await loadReport();
      setCoverageRefresh((current) => current + 1);
      toast.success(result.newMatches > 0
        ? `${result.newMatches} partidas nuevas · ${result.syncedMatches} revisadas para el informe.`
        : `Informe actualizado con ${result.syncedMatches} partidas revisadas.`);
    } catch (error) {
      toast.error(error instanceof ApiErrorResponse ? error.error.message : 'No se pudieron sincronizar tus partidas.');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Cargando informe semanal…</div>;

  if (!linkedPlayerId) {
    return (
      <div>
        <header className="header"><h1 className="header-title">Coach semanal</h1></header>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2.5rem', textAlign: 'center' }}>
          <LinkIcon size={32} style={{ color: 'var(--text-muted)' }} />
          <strong>Vincula tu perfil de jugador</strong>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.84rem' }}>Necesitamos relacionar tu cuenta con un jugador para calcular tendencias personales.</p>
          <button className="btn-primary" onClick={() => navigate('/profile')} style={{ flex: 'unset' }}>Ir al perfil</button>
        </div>
      </div>
    );
  }

  if (!report) {
    return <div className="glass-card" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No hay datos disponibles para generar el informe.</div>;
  }

  const displayName = report.player.customName ?? report.player.displayName;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header className="header">
        <div>
          <p style={{ margin: '0 0 0.3rem', color: 'var(--accent-violet)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coach personal</p>
          <h1 className="header-title">Tu semana, {displayName}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.35rem' }}>
            Últimos 7 días comparados con tu referencia móvil de 30 días.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={syncing}
          onClick={() => void syncMatches()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flex: 'unset', whiteSpace: 'nowrap' }}
        >
          <RefreshCw size={15} className={syncing ? 'spin' : undefined} />
          {syncing ? 'Actualizando historial…' : 'Actualizar historial'}
        </button>
      </header>

      <MatchEnrichmentCard
        enabled={Boolean(linkedPlayerId)}
        refreshToken={coverageRefresh}
        onCompleted={loadReport}
      />

      <section
        className="glass-card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '1.25rem',
          padding: '1.25rem',
          borderColor: 'rgba(167,139,250,0.38)',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.13), rgba(15,23,42,0.72))',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-violet)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            <Target size={16} /> Foco de la semana
          </div>
          <h2 style={{ margin: '0.65rem 0 0.4rem', fontSize: '1.3rem' }}>{report.focusOfWeek.title}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.55, fontSize: '0.86rem' }}>{report.focusOfWeek.rationale}</p>
          <div style={{ marginTop: '0.9rem', padding: '0.75rem 0.85rem', borderLeft: '3px solid var(--accent-violet)', background: 'rgba(167,139,250,0.08)', borderRadius: '0 6px 6px 0', fontSize: '0.82rem', lineHeight: 1.5 }}>
            <strong>Acción:</strong> {report.focusOfWeek.action}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 88 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.4)' }}>
            <Activity size={30} style={{ color: 'var(--accent-violet)' }} />
          </div>
        </div>
      </section>

      {report.roleCoach ? (
        <section className="glass-card" style={{ padding: '1.15rem', borderColor: 'rgba(34,211,238,0.28)' }} aria-labelledby="role-coach-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <Crosshair size={15} /> Lectura por rol
              </div>
              <h2 id="role-coach-title" style={{ margin: '0.55rem 0 0.2rem', fontSize: '1.15rem' }}>Coach de {report.roleCoach.label}</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.73rem' }}>
                {report.roleCoach.matches} partidas esta semana · {report.roleCoach.shareOfMatches}% de tu muestra de 30 días
              </p>
            </div>
            <span style={{ padding: '0.25rem 0.55rem', borderRadius: 999, background: 'rgba(34,211,238,0.1)', color: 'var(--accent-cyan)', fontSize: '0.66rem', fontWeight: 700 }}>
              Confianza {report.roleCoach.confidence === 'high' ? 'alta' : report.roleCoach.confidence === 'medium' ? 'media' : 'inicial'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.65rem', marginTop: '0.9rem' }}>
            {report.roleCoach.metrics.map((metric) => (
              <article key={metric.key} style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(15,23,42,0.48)', border: '1px solid var(--border-color)' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{metric.label}</p>
                <strong className="mono" style={{ display: 'block', marginTop: '0.35rem', fontSize: '1rem' }}>{roleMetricValue(metric.value, metric.unit)}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.64rem' }}>30d: {roleMetricValue(metric.baseline, metric.unit)}</span>
              </article>
            ))}
          </div>

          <div style={{ marginTop: '0.9rem', padding: '0.85rem', borderRadius: 8, background: 'rgba(34,211,238,0.06)' }}>
            <strong style={{ fontSize: '0.84rem' }}>{report.roleCoach.focus.title}</strong>
            <p style={{ margin: '0.35rem 0', color: 'var(--text-secondary)', fontSize: '0.77rem', lineHeight: 1.45 }}>{report.roleCoach.focus.rationale}</p>
            <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.76rem', lineHeight: 1.45 }}><strong>Próximas partidas:</strong> {report.roleCoach.focus.action}</p>
          </div>
        </section>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.75rem' }}>
        {report.trends.map((item) => <MetricCard key={item.metric} trend={item} />)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '0.9rem' }}>
        <article className="glass-card" style={{ padding: '1.1rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Actividad</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.55rem' }}>
            <strong className="mono" style={{ fontSize: '1.8rem' }}>{report.weekly.matches}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>partidas esta semana</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 0 }}>{report.baseline30d.matches} partidas en la muestra de 30 días</p>
        </article>

        <article className="glass-card" style={{ padding: '1.1rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Héroe principal de la semana</p>
          {report.topHero ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.7rem' }}>
              <HeroAvatarWithTooltip slug={report.topHero.heroSlug} name={report.topHero.heroSlug} size={48} rounded={8} />
              <div>
                <strong style={{ textTransform: 'capitalize' }}>{report.topHero.heroSlug}</strong>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                  {report.topHero.matches} partidas · {report.topHero.winRate}% WR · {report.topHero.shareOfWeeklyMatches}% de tu muestra
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin partidas esta semana.</p>
              <button type="button" className="btn-secondary" disabled={syncing} onClick={() => void syncMatches()} style={{ flex: 'unset', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                Sincronizar ahora
              </button>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
