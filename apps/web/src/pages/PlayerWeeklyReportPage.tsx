import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, ArrowDownRight, ArrowUpRight, Crosshair, Flag, Link as LinkIcon, Minus, Package, RefreshCw, Shield, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type ChampionPoolContext, type PlayerBenchmarkResponse, type PlayerBuildReview, type PlayerMetricTrend, type PlayerWeeklyReport, type WeeklyGoalEvaluation } from '../api/client';
import { HeroAvatarWithTooltip } from '../components/HeroAvatar';
import { MatchEnrichmentCard } from '../components/MatchEnrichmentCard';
import { PlayerCoachChat } from '../components/PlayerCoachChat';
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

const poolSelectStyle = {
  padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-color)',
  background: 'var(--bg-dark)', color: 'var(--text-secondary)', fontSize: '0.68rem',
} as const;

function MatchupSummary({ title, row, accent, empty }: {
  title: string;
  row: ChampionPoolContext['hardestMatchup'];
  accent: string;
  empty: string;
}) {
  return (
    <article style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(15,23,42,0.48)', border: '1px solid var(--border-color)' }}>
      <p style={{ margin: 0, color: accent, fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
      {row ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.55rem' }}>
          <HeroAvatarWithTooltip slug={row.heroSlug} name={row.heroSlug} size={34} rounded={7} />
          <div>
            <strong style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>{row.heroSlug}</strong>
            <p style={{ margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.66rem' }}>{row.matches} partidas · {row.winRate}% WR · {row.kda.toFixed(2)} KDA</p>
          </div>
        </div>
      ) : <p style={{ margin: '0.45rem 0 0', color: 'var(--text-muted)', fontSize: '0.66rem' }}>{empty}</p>}
    </article>
  );
}

function benchmarkMetricLabel(key: string): string {
  const labels: Record<string, string> = {
    winRate: 'Win rate', kda: 'KDA', damagePerMinute: 'Daño/min', goldPerMinute: 'Oro/min',
    csPerMinute: 'CS/min', wardsPerMatch: 'Wards/partida',
  };
  return labels[key] ?? key;
}

function CapabilityBadge({ label, available, reason }: { label: string; available: boolean; reason: string | null }) {
  return (
    <span title={reason ?? 'Disponible'} style={{
      padding: '0.2rem 0.45rem', borderRadius: 999, fontSize: '0.6rem',
      color: available ? 'var(--accent-win)' : 'var(--text-muted)',
      background: available ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.035)',
      border: `1px solid ${available ? 'rgba(74,222,128,0.2)' : 'var(--border-color)'}`,
    }}>
      {available ? '✓' : '🔒'} {label}
    </span>
  );
}

function roleMetricValue(value: number | null, unit: 'ratio' | 'per_match' | 'per_minute' | 'percent'): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  if (unit === 'ratio') return value.toFixed(2);
  if (unit === 'per_match') return value.toFixed(1);
  return value < 10 ? value.toFixed(2) : Math.round(value).toLocaleString();
}

function loadoutSlotLabel(slot: string, index: number): string {
  const normalized = slot.toUpperCase();
  if (normalized.includes('AUGMENT') || normalized.includes('HERO_SPECIFIC')) return 'Augmento';
  if (normalized.includes('ETERNAL')) return 'Eternal';
  if (normalized.includes('BLESSING')) return normalized.endsWith('_2') ? 'Bendición II' : 'Bendición I';
  return slot || `Ranura ${index + 1}`;
}

function WeeklyBuildLessons({ review }: { review: PlayerBuildReview }) {
  const adaptationNeeded = review.matches.filter(({ analysis }) => analysis.verdict.grade !== 'correct').length;
  const signalCounts = new Map<string, { title: string; count: number }>();
  const loadoutCounts = new Map<string, { label: string; count: number; why: string; verdict: 'correct' | 'conditional' | 'questionable' }>();
  const changeCounts = new Map<string, { item: string; slug: string; count: number; why: string }>();

  for (const { analysis } of review.matches) {
    for (const signal of analysis.signals.filter((entry) => entry.key !== 'adaptation-ok')) {
      const current = signalCounts.get(signal.key);
      signalCounts.set(signal.key, { title: signal.title, count: (current?.count ?? 0) + 1 });
    }
    for (const perk of analysis.eternalLoadout.filter((entry) => entry.verdict !== 'correct')) {
      const key = `${perk.slot}:${perk.displayName}`;
      const current = loadoutCounts.get(key);
      loadoutCounts.set(key, {
        label: `${loadoutSlotLabel(perk.slot, 0)} · ${perk.displayName}`,
        count: (current?.count ?? 0) + 1,
        why: perk.why,
        verdict: perk.verdict,
      });
    }
    for (const change of analysis.recommendedBuild.changes) {
      const current = changeCounts.get(change.item.slug);
      changeCounts.set(change.item.slug, { item: change.item.displayName, slug: change.item.slug, count: (current?.count ?? 0) + 1, why: change.item.reason });
    }
  }

  const repeatedSignal = [...signalCounts.values()].sort((a, b) => b.count - a.count)[0];
  const loadoutLesson = [...loadoutCounts.values()].sort((a, b) => {
    if (a.verdict !== b.verdict) return a.verdict === 'questionable' ? -1 : 1;
    return b.count - a.count;
  })[0];
  const repeatedChange = [...changeCounts.values()].sort((a, b) => b.count - a.count)[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))', gap: '0.6rem', marginTop: '0.9rem' }}>
      <article style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(240,180,41,0.045)', border: '1px solid rgba(240,180,41,0.18)' }}>
        <p style={{ margin: 0, color: 'var(--accent-prime)', fontSize: '0.59rem', fontWeight: 800, textTransform: 'uppercase' }}>Patrón de adaptación</p>
        <strong style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.76rem' }}>{adaptationNeeded} de {review.matches.length} builds necesitaban ajustes</strong>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)', fontSize: '0.64rem', lineHeight: 1.4 }}>
          {repeatedSignal ? `${repeatedSignal.title} apareció en ${repeatedSignal.count} ${repeatedSignal.count === 1 ? 'partida' : 'partidas'}.` : 'No se repitió ninguna carencia contextual importante.'}
        </p>
      </article>

      <article style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(167,139,250,0.045)', border: '1px solid rgba(167,139,250,0.18)' }}>
        <p style={{ margin: 0, color: 'var(--accent-violet)', fontSize: '0.59rem', fontWeight: 800, textTransform: 'uppercase' }}>Aprendizaje de loadout</p>
        <strong style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.76rem' }}>{loadoutLesson?.label ?? 'Loadouts coherentes'}</strong>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)', fontSize: '0.64rem', lineHeight: 1.4 }}>
          {loadoutLesson ? `${loadoutLesson.why}${loadoutLesson.count > 1 ? ` Se repitió ${loadoutLesson.count} veces.` : ''}` : 'Los Augmentos, Eternals y Bendiciones analizados encajaron con su rol y patrón de juego.'}
        </p>
      </article>

      <article style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(56,212,200,0.04)', border: '1px solid rgba(56,212,200,0.18)' }}>
        <p style={{ margin: 0, color: 'var(--accent-cyan)', fontSize: '0.59rem', fontWeight: 800, textTransform: 'uppercase' }}>Regla para la próxima partida</p>
        {repeatedChange ? (
          <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.35rem', alignItems: 'flex-start' }}>
            <img src={`/items/${repeatedChange.slug}.webp`} alt="" style={{ width: 34, height: 34, borderRadius: 5, flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', fontSize: '0.76rem' }}>Considera {repeatedChange.item}</strong>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.64rem', lineHeight: 1.4 }}>{repeatedChange.why}{repeatedChange.count > 1 ? ` Fue recomendable en ${repeatedChange.count} partidas.` : ''}</p>
            </div>
          </div>
        ) : <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)', fontSize: '0.64rem', lineHeight: 1.4 }}>Mantén el núcleo actual, pero vuelve a revisar la composición rival antes de completar la segunda pieza.</p>}
      </article>
    </div>
  );
}

function BuildReviewCard({ entry, onOpen }: { entry: PlayerBuildReview['matches'][number]; onOpen: () => void }) {
  const { analysis, match } = entry;
  const finalItems = analysis.inventory.filter((item) => item.slotType === 'PASSIVE' && item.rarity === 'EPIC');
  const visibleItems = finalItems.length > 0 ? finalItems : analysis.inventory.filter((item) => item.slotType === 'PASSIVE').slice(0, 6);
  const primarySignal = analysis.signals.find((signal) => signal.severity === 'critical')
    ?? analysis.signals.find((signal) => signal.severity === 'warning')
    ?? analysis.signals[0];
  const signalColor = primarySignal?.severity === 'critical'
    ? 'var(--accent-loss)'
    : primarySignal?.severity === 'warning'
      ? 'var(--accent-prime)'
      : 'var(--accent-win)';
  const assessmentBySlug = new Map(analysis.inventoryAssessments.map((item) => [item.slug, item]));
  const firstChange = analysis.recommendedBuild.changes[0];
  const buildVerdictLabel = analysis.verdict.grade === 'correct'
    ? 'Correcta'
    : analysis.verdict.grade === 'mostly_correct'
      ? 'Casi correcta'
      : analysis.verdict.grade === 'mixed'
        ? 'Mejorable'
        : 'Mal adaptada';
  const buildVerdictColor = analysis.verdict.grade === 'correct'
    ? 'var(--accent-win)'
    : analysis.verdict.grade === 'poor'
      ? 'var(--accent-loss)'
      : 'var(--accent-prime)';

  return (
    <article style={{ padding: '0.9rem', borderRadius: 9, background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border-color)', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.65rem', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
          <HeroAvatarWithTooltip slug={analysis.heroSlug} name={analysis.heroSlug} size={38} rounded={7} />
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', textTransform: 'capitalize', fontSize: '0.82rem' }}>{analysis.heroSlug}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>{analysis.role ?? 'Sin rol'} · {new Date(match.startTime).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', color: analysis.result === 'win' ? 'var(--accent-win)' : 'var(--accent-loss)', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase' }}>{analysis.result === 'win' ? 'Victoria' : 'Derrota'}</span>
          <span style={{ display: 'block', marginTop: '0.2rem', color: buildVerdictColor, fontSize: '0.58rem', fontWeight: 800 }}>{buildVerdictLabel} · {analysis.verdict.score}/100</span>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <p style={{ margin: '0 0 0.4rem', color: 'var(--text-muted)', fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Build final</p>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', minHeight: 30 }}>
          {visibleItems.length > 0 ? visibleItems.map((item) => {
            const assessment = assessmentBySlug.get(item.slug);
            return (
            <span key={item.slug} title={`${item.displayName}${assessment ? ` — ${assessment.explanation}` : ''}`} style={{ width: 30, height: 30, borderRadius: 5, overflow: 'hidden', border: `1px solid ${assessment?.verdict === 'correct' ? 'rgba(74,222,128,0.42)' : 'rgba(240,180,41,0.34)'}`, background: 'var(--bg-dark)' }}>
              <img src={`/items/${item.slug}.webp`} alt={item.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            </span>
          );}) : <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>Build todavía incompleta</span>}
        </div>
      </div>

      <div style={{ marginTop: '0.7rem' }}>
        <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)', fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ancestro y bendiciones</p>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {analysis.eternalLoadout.length > 0 ? analysis.eternalLoadout.map((perk, index) => {
            const color = perk.verdict === 'correct' ? 'var(--accent-win)' : perk.verdict === 'questionable' ? 'var(--accent-loss)' : 'var(--accent-prime)';
            return (
            <span key={`${perk.id}-${index}`} title={`${perk.displayName} — ${perk.why}`} style={{ padding: '0.22rem 0.4rem', borderRadius: 5, background: 'rgba(167,139,250,0.08)', border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`, color: 'var(--text-secondary)', fontSize: '0.59rem' }}>
              <strong style={{ color: 'var(--accent-violet)' }}>{loadoutSlotLabel(perk.slot, index)}:</strong> {perk.displayName}
              <span style={{ color, marginLeft: '0.25rem' }}>●</span>
            </span>
          );}) : <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>Sin loadout sincronizado</span>}
        </div>
        {analysis.eternalLoadout.some((perk) => perk.verdict !== 'correct') && (
          <div style={{ marginTop: '0.45rem', display: 'grid', gap: '0.3rem' }}>
            {analysis.eternalLoadout.filter((perk) => perk.verdict !== 'correct').slice(0, 2).map((perk) => (
              <p key={`lesson-${perk.id}`} style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.61rem', lineHeight: 1.4 }}><strong style={{ color: perk.verdict === 'questionable' ? 'var(--accent-loss)' : 'var(--accent-prime)' }}>{perk.displayName}:</strong> {perk.why}</p>
            ))}
          </div>
        )}
      </div>

      {primarySignal ? (
        <div style={{ marginTop: '0.75rem', padding: '0.6rem', borderRadius: 7, borderLeft: `3px solid ${signalColor}`, background: 'rgba(255,255,255,0.025)' }}>
          <strong style={{ display: 'block', color: signalColor, fontSize: '0.7rem' }}>{primarySignal.title}</strong>
          <span style={{ display: 'block', marginTop: '0.2rem', color: 'var(--text-muted)', fontSize: '0.63rem', lineHeight: 1.35 }}>{primarySignal.recommendation}</span>
        </div>
      ) : null}

      {firstChange && (
        <div style={{ marginTop: '0.6rem', padding: '0.6rem', borderRadius: 7, background: 'rgba(56,212,200,0.04)', border: '1px solid rgba(56,212,200,0.16)' }}>
          <strong style={{ display: 'block', color: 'var(--accent-cyan)', fontSize: '0.68rem' }}>Cambio recomendado</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
            {firstChange.insteadOf && <><span style={{ color: 'var(--text-muted)', fontSize: '0.64rem', textDecoration: 'line-through' }}>{firstChange.insteadOf.displayName}</span><span style={{ color: 'var(--text-muted)' }}>→</span></>}
            <img src={`/items/${firstChange.item.slug}.webp`} alt="" style={{ width: 24, height: 24, borderRadius: 4 }} />
            <strong style={{ fontSize: '0.68rem' }}>{firstChange.item.displayName}</strong>
          </div>
          <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)', fontSize: '0.61rem', lineHeight: 1.4 }}>{firstChange.timing}</p>
        </div>
      )}

      <button type="button" className="btn-secondary" onClick={onOpen} style={{ marginTop: '0.75rem', flex: 'unset', width: '100%', justifyContent: 'center', fontSize: '0.68rem' }}>
        Ver análisis completo
      </button>
    </article>
  );
}

export default function PlayerWeeklyReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<PlayerWeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [coverageRefresh, setCoverageRefresh] = useState(0);
  const [goalEvaluations, setGoalEvaluations] = useState<WeeklyGoalEvaluation[]>([]);
  const [savingGoal, setSavingGoal] = useState(false);
  const [poolContext, setPoolContext] = useState<ChampionPoolContext | null>(null);
  const [benchmark, setBenchmark] = useState<PlayerBenchmarkResponse | null>(null);
  const [buildReview, setBuildReview] = useState<PlayerBuildReview | null>(null);
  const [buildReviewLoading, setBuildReviewLoading] = useState(true);
  const [poolFilters, setPoolFilters] = useState({ days: 90, role: '', gameMode: 'RANKED', heroSlug: '' });
  const [poolFiltersReady, setPoolFiltersReady] = useState(false);
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

  const loadGoalProgress = useCallback(async () => {
    if (!linkedPlayerId) return;
    try {
      const result = await apiClient.weeklyGoals.progress();
      setGoalEvaluations(result.evaluations);
    } catch {
      // The report remains useful even if goal tracking is temporarily unavailable.
    }
  }, [linkedPlayerId]);

  const loadBuildReview = useCallback(async () => {
    if (!linkedPlayerId) return;
    try {
      setBuildReviewLoading(true);
      setBuildReview(await apiClient.reports.playerBuilds(linkedPlayerId, { days: 30, limit: 5 }));
    } catch {
      setBuildReview(null);
    } finally {
      setBuildReviewLoading(false);
    }
  }, [linkedPlayerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void Promise.all([loadReport(), loadGoalProgress(), loadBuildReview()]), 0);
    return () => window.clearTimeout(timer);
  }, [loadBuildReview, loadGoalProgress, loadReport]);

  useEffect(() => {
    if (!report || poolFiltersReady) return;
    setPoolFilters((current) => ({
      ...current,
      role: report.roleCoach?.role ?? '',
      heroSlug: report.championPool.mainHero ?? '',
    }));
    setPoolFiltersReady(true);
  }, [poolFiltersReady, report]);

  useEffect(() => {
    if (!linkedPlayerId || !poolFiltersReady) return;
    let cancelled = false;
    const contextRequest = apiClient.players.championPoolContext(linkedPlayerId, {
      days: poolFilters.days,
      role: poolFilters.role || undefined,
      gameMode: poolFilters.gameMode || undefined,
      heroSlug: poolFilters.heroSlug || undefined,
    }).then((data) => { if (!cancelled) setPoolContext(data); }).catch(() => { if (!cancelled) setPoolContext(null); });
    const benchmarkRequest = poolFilters.heroSlug
      ? apiClient.players.benchmarks(linkedPlayerId, {
        heroSlug: poolFilters.heroSlug,
        role: poolFilters.role || undefined,
        gameMode: poolFilters.gameMode || undefined,
      }).then((data) => { if (!cancelled) setBenchmark(data); }).catch(() => { if (!cancelled) setBenchmark(null); })
      : Promise.resolve(setBenchmark(null));
    void Promise.all([contextRequest, benchmarkRequest]);
    return () => { cancelled = true; };
  }, [linkedPlayerId, poolFilters, poolFiltersReady]);

  async function syncMatches() {
    try {
      setSyncing(true);
      const result = await apiClient.sync.myMatches();
      await Promise.all([loadReport(), loadGoalProgress(), loadBuildReview()]);
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

  async function startTrainingPlan() {
    if (!report?.roleCoach || !linkedPlayerId) return;
    const training = report.roleCoach.training;
    try {
      setSavingGoal(true);
      await apiClient.weeklyGoals.create({
        title: `${report.roleCoach.focus.title} · 5 partidas`,
        metricKey: training.metricKey,
        targetValue: training.targetValue ?? undefined,
        playerId: linkedPlayerId,
      });
      await loadGoalProgress();
      toast.success('Plan de cinco partidas iniciado. El progreso se actualizará automáticamente.');
    } catch (error) {
      toast.error(error instanceof ApiErrorResponse ? error.error.message : 'No se pudo iniciar el plan de entrenamiento.');
    } finally {
      setSavingGoal(false);
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
  const activeGoal = goalEvaluations.find((evaluation) => evaluation.goal.status === 'ACTIVE') ?? goalEvaluations[0] ?? null;

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

      <section className="glass-card" style={{ padding: '1.15rem', borderColor: 'rgba(240,180,41,0.3)' }} aria-labelledby="build-review-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-prime)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <Package size={15} /> Decisiones de partida
            </div>
            <h2 id="build-review-title" style={{ margin: '0.55rem 0 0.2rem', fontSize: '1.15rem' }}>Builds, Augmentos, Eternals y Bendiciones</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.73rem' }}>Qué decisiones repites, cuáles funcionan para tu rol y qué debes adaptar en la próxima partida.</p>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.55rem', borderRadius: 999, background: 'rgba(240,180,41,0.08)', color: 'var(--accent-prime)', fontSize: '0.64rem', fontWeight: 700 }}>
            <Shield size={13} /> Últimos 30 días
          </span>
        </div>

        {buildReviewLoading ? (
          <div style={{ marginTop: '0.85rem', padding: '0.9rem', borderRadius: 8, background: 'rgba(255,255,255,0.025)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Analizando tus builds y Ancestros recientes…
          </div>
        ) : buildReview && buildReview.matches.length > 0 ? (
          <>
            <WeeklyBuildLessons review={buildReview} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(285px, 1fr))', gap: '0.7rem', marginTop: '0.9rem' }}>
              {buildReview.matches.map((entry) => (
                <BuildReviewCard key={entry.match.id} entry={entry} onOpen={() => navigate(`/matches/${entry.match.id}?tab=statistics`)} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ marginTop: '0.85rem', padding: '0.9rem', borderRadius: 8, background: 'rgba(255,255,255,0.025)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Todavía no hay builds analizables. Pulsa «Actualizar historial» para completar las partidas recientes.
          </div>
        )}
      </section>

      <section className="glass-card" style={{ padding: '1.15rem' }} aria-labelledby="champion-pool-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-violet)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <Sparkles size={15} /> Champion pool
            </div>
            <h2 id="champion-pool-title" style={{ margin: '0.55rem 0 0.2rem', fontSize: '1.15rem' }}>Principal, alternativa y tendencia</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.73rem' }}>
              {report.championPool.totalMatches30d} partidas en 30 días
              {report.championPool.currentPatch ? ` · parche ${report.championPool.currentPatch}` : ''}
            </p>
          </div>
        </div>

        {report.championPool.heroes.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '0.7rem', marginTop: '0.9rem' }}>
            {report.championPool.heroes.map((hero) => {
              const designation = hero.designation === 'main' ? 'Principal' : hero.designation === 'alternate' ? 'Alternativa' : 'Experimental';
              const trend = hero.trend === 'improving' ? 'Mejorando' : hero.trend === 'declining' ? 'Bajando' : hero.trend === 'stable' ? 'Estable' : 'Sin muestra';
              const trendColor = hero.trend === 'improving' ? 'var(--accent-win)' : hero.trend === 'declining' ? 'var(--accent-loss)' : 'var(--text-muted)';
              return (
                <article key={hero.heroSlug} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.8rem', borderRadius: 9, border: '1px solid var(--border-color)', background: 'rgba(15,23,42,0.48)' }}>
                  <HeroAvatarWithTooltip slug={hero.heroSlug} name={hero.heroSlug} size={46} rounded={8} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                      <strong style={{ textTransform: 'capitalize', fontSize: '0.84rem' }}>{hero.heroSlug}</strong>
                      <span style={{ color: hero.designation === 'main' ? 'var(--accent-violet)' : 'var(--text-muted)', fontSize: '0.61rem', fontWeight: 800 }}>{designation}</span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.69rem' }}>
                      {hero.matches30d} {hero.matches30d === 1 ? 'partida' : 'partidas'} · {hero.winRate30d}% WR · {hero.kda30d.toFixed(2)} KDA
                    </p>
                    <p style={{ margin: '0.18rem 0 0', color: trendColor, fontSize: '0.65rem' }}>
                      {hero.currentPatchMatches} en parche · {trend}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin partidas suficientes para construir el champion pool.</p>
        )}

        <div style={{ marginTop: '0.9rem', padding: '0.85rem', borderRadius: 8, background: 'rgba(167,139,250,0.07)', borderLeft: '3px solid var(--accent-violet)' }}>
          <strong style={{ fontSize: '0.84rem' }}>{report.championPool.recommendation.title}</strong>
          <p style={{ margin: '0.35rem 0', color: 'var(--text-secondary)', fontSize: '0.77rem', lineHeight: 1.45 }}>{report.championPool.recommendation.rationale}</p>
          <p style={{ margin: 0, fontSize: '0.76rem', lineHeight: 1.45 }}><strong>Plan:</strong> {report.championPool.recommendation.action}</p>
        </div>

        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '0.88rem' }}>Enfrentamientos personales</strong>
              <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                Tu rendimiento real contra héroes enemigos y junto a aliados, filtrado por contexto.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <select value={poolFilters.days} onChange={(event) => setPoolFilters((current) => ({ ...current, days: Number(event.target.value) }))} style={poolSelectStyle} aria-label="Periodo del champion pool">
                <option value={30}>30 días</option><option value={90}>90 días</option><option value={180}>180 días</option><option value={365}>1 año</option>
              </select>
              <select value={poolFilters.gameMode} onChange={(event) => setPoolFilters((current) => ({ ...current, gameMode: event.target.value }))} style={poolSelectStyle} aria-label="Modo de juego">
                <option value="">Todos los modos</option>
                {(poolContext?.filters.available.gameModes ?? ['RANKED', 'STANDARD']).map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
              <select value={poolFilters.role} onChange={(event) => setPoolFilters((current) => ({ ...current, role: event.target.value }))} style={poolSelectStyle} aria-label="Rol">
                <option value="">Todos los roles</option>
                {(poolContext?.filters.available.roles ?? ['CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE', 'SUPPORT']).map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <select value={poolFilters.heroSlug} onChange={(event) => setPoolFilters((current) => ({ ...current, heroSlug: event.target.value }))} style={poolSelectStyle} aria-label="Héroe">
                <option value="">Todos los héroes</option>
                {(poolContext?.filters.available.heroes ?? report.championPool.heroes.map((hero) => hero.heroSlug)).map((hero) => <option key={hero} value={hero}>{hero}</option>)}
              </select>
            </div>
          </div>

          {poolContext && poolContext.sampleSize > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.7rem', marginTop: '0.8rem' }}>
              <MatchupSummary title="Más difícil" row={poolContext.hardestMatchup} accent="var(--accent-loss)" empty="Se necesitan al menos dos partidas contra el mismo héroe." />
              <MatchupSummary title="Más favorable" row={poolContext.strongestMatchup} accent="var(--accent-win)" empty="Se necesitan al menos dos partidas contra el mismo héroe." />
              <MatchupSummary title="Mejor sinergia" row={[...poolContext.synergies].filter((row) => row.matches >= 2).sort((a, b) => b.winRate - a.winRate)[0] ?? null} accent="var(--accent-cyan)" empty="Aún no hay una pareja con muestra suficiente." />
            </div>
          ) : (
            <p style={{ margin: '0.8rem 0 0', color: 'var(--text-muted)', fontSize: '0.74rem' }}>No hay partidas que coincidan con estos filtros.</p>
          )}

          {benchmark && (
            <div style={{ marginTop: '0.8rem', padding: '0.8rem', borderRadius: 8, background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.16)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.78rem' }}>Comparación con jugadores de Pred.gg</strong>
                {benchmark.benchmark.rating?.percentile != null && <span style={{ color: 'var(--accent-cyan)', fontSize: '0.67rem', fontWeight: 700 }}>Top {(benchmark.benchmark.rating.percentile * 100).toFixed(1)}% en Pred.gg</span>}
              </div>
              {benchmark.benchmark.available && benchmark.benchmark.comparison ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.45rem', marginTop: '0.65rem' }}>
                  {benchmark.benchmark.comparison.map((metric) => (
                    <div key={metric.key} style={{ padding: '0.55rem', borderRadius: 6, background: 'rgba(15,23,42,0.5)' }}>
                      <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.58rem', textTransform: 'uppercase' }}>{benchmarkMetricLabel(metric.key)}</span>
                      <strong className="mono" style={{ fontSize: '0.8rem', color: metric.delta >= 0 ? 'var(--accent-win)' : 'var(--accent-loss)' }}>{metric.player.toFixed(2)}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.58rem' }}> · base {metric.population.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ margin: '0.55rem 0 0', color: 'var(--text-muted)', fontSize: '0.68rem' }}>{benchmark.benchmark.reason}</p>}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                <CapabilityBadge label="Especialistas" available={benchmark.specialists.available} reason={benchmark.specialists.reason} />
                <CapabilityBadge label="Matchups globales" available={benchmark.matchups.available} reason={benchmark.matchups.reason} />
                <CapabilityBadge label="Distribución de rango" available={benchmark.ratingDistribution.available} reason={benchmark.ratingDistribution.reason} />
              </div>
            </div>
          )}
        </div>
      </section>

      {report.roleCoach ? (
        <section className="glass-card" style={{ padding: '1.15rem', borderColor: 'rgba(52,211,153,0.28)' }} aria-labelledby="training-loop-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-win)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <Flag size={15} /> Ciclo de entrenamiento
              </div>
              <h2 id="training-loop-title" style={{ margin: '0.55rem 0 0.25rem', fontSize: '1.15rem' }}>
                {activeGoal ? activeGoal.goal.title : 'Entrena, mide y reevalúa'}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                {activeGoal
                  ? `${activeGoal.matchesTracked} de ${activeGoal.targetMatches} partidas registradas automáticamente`
                  : `Objetivo sugerido: ${report.roleCoach.training.metricLabel} durante cinco partidas`}
              </p>
            </div>
            {!activeGoal ? (
              <button type="button" className="btn-primary" disabled={savingGoal} onClick={() => void startTrainingPlan()} style={{ flex: 'unset', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                {savingGoal ? 'Iniciando…' : 'Iniciar plan de 5 partidas'}
              </button>
            ) : null}
          </div>

          {activeGoal ? (
            <div style={{ marginTop: '0.85rem' }}>
              <div role="progressbar" aria-label="Partidas completadas del plan" aria-valuemin={0} aria-valuemax={activeGoal.targetMatches} aria-valuenow={activeGoal.matchesTracked} style={{ height: 7, borderRadius: 999, overflow: 'hidden', background: 'rgba(148,163,184,0.14)' }}>
                <div style={{ width: `${Math.min(100, (activeGoal.matchesTracked / activeGoal.targetMatches) * 100)}%`, height: '100%', background: 'var(--accent-win)', borderRadius: 999 }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.73rem' }}>Valor actual: <strong>{activeGoal.metricValue ?? '—'}</strong></span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.73rem' }}>Referencia anterior: <strong>{activeGoal.baselineValue ?? '—'}</strong></span>
                {activeGoal.goal.targetValue !== null ? <span style={{ color: 'var(--text-secondary)', fontSize: '0.73rem' }}>Objetivo: <strong>{activeGoal.goal.targetValue}</strong></span> : null}
              </div>
              <p style={{ margin: '0.65rem 0 0', color: activeGoal.matchesTracked >= activeGoal.targetMatches ? 'var(--accent-win)' : 'var(--text-muted)', fontSize: '0.75rem' }}>
                {activeGoal.matchesTracked >= activeGoal.targetMatches
                  ? activeGoal.outcome === 'target_achieved' || activeGoal.outcome === 'improved'
                    ? 'Ciclo completado con mejora. Revisa el informe y decide si consolidas o subes el objetivo.'
                    : 'Ciclo completado. Revisa las cinco partidas y ajusta el objetivo antes del siguiente bloque.'
                  : `Faltan ${activeGoal.targetMatches - activeGoal.matchesTracked} partidas para reevaluar con una muestra cerrada.`}
              </p>
            </div>
          ) : (
            <div style={{ marginTop: '0.85rem', padding: '0.8rem', borderRadius: 8, background: 'rgba(52,211,153,0.06)' }}>
              <strong style={{ fontSize: '0.8rem' }}>{report.roleCoach.focus.title}</strong>
              <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.45 }}>
                El sistema guardará una referencia, contará solo las cinco partidas posteriores y comparará el resultado automáticamente.
              </p>
            </div>
          )}
        </section>
      ) : null}

      <PlayerCoachChat playerId={linkedPlayerId} />

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
