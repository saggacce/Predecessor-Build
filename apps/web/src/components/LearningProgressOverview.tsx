import type { CSSProperties } from 'react';
import { Activity, BookOpenCheck, Eye, Trophy } from 'lucide-react';
import type { PlayerLearningProgress } from '../api/client';

const panel: CSSProperties = {
  padding: '1rem',
  border: '1px solid var(--border-color)',
  borderRadius: 12,
  background: 'var(--bg-card)',
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function radarPoint(index: number, total: number, value: number, radius = 78) {
  const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / total);
  return `${120 + Math.cos(angle) * radius * value},${112 + Math.sin(angle) * radius * value}`;
}

function CompetencyRadar({ progress }: { progress: PlayerLearningProgress }) {
  const competencies = progress.profile.competencies;
  const outer = competencies.map((_, index) => radarPoint(index, competencies.length, 1)).join(' ');
  const middle = competencies.map((_, index) => radarPoint(index, competencies.length, 0.5)).join(' ');
  const mastery = competencies.map((item, index) => radarPoint(index, competencies.length, item.estimatedMastery)).join(' ');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: '1rem', alignItems: 'center' }}>
      <svg viewBox="0 0 240 224" role="img" aria-label="Radar del dominio actual por competencia" style={{ width: '100%', maxWidth: 280 }}>
        <polygon points={outer} fill="rgba(255,255,255,.018)" stroke="var(--border-color)" />
        <polygon points={middle} fill="none" stroke="rgba(255,255,255,.07)" />
        {competencies.map((_, index) => <line key={index} x1="120" y1="112" x2={radarPoint(index, competencies.length, 1).split(',')[0]} y2={radarPoint(index, competencies.length, 1).split(',')[1]} stroke="rgba(255,255,255,.06)" />)}
        <polygon points={mastery} fill="rgba(56,212,200,.2)" stroke="var(--accent-cyan)" strokeWidth="2" />
        {competencies.map((item, index) => {
          const [cx, cy] = radarPoint(index, competencies.length, item.estimatedMastery).split(',');
          return <circle key={item.key} cx={cx} cy={cy} r="3" fill="var(--accent-cyan)" />;
        })}
        <text x="120" y="216" textAnchor="middle" fill="var(--text-muted)" fontSize="9">Dominio actual · no es MMR</text>
      </svg>
      <div style={{ display: 'grid', gap: '.42rem' }}>
        {competencies.map((item, index) => {
          const trend = progress.trends.find((entry) => entry.competencyKey === item.key);
          const trendLabel = trend?.direction === 'IMPROVING' ? 'mejorando' : trend?.direction === 'NEEDS_ATTENTION' ? 'revisar' : 'estable';
          const trendColor = trend?.direction === 'IMPROVING' ? 'var(--accent-cyan)' : trend?.direction === 'NEEDS_ATTENTION' ? '#fbbf24' : 'var(--text-muted)';
          return <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '1.4rem minmax(120px, 1fr) auto', gap: '.45rem', alignItems: 'center', fontSize: '.76rem' }}>
            <span style={{ color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)' }}>{index + 1}</span>
            <span>{item.label}<small style={{ display: 'block', color: 'var(--text-muted)' }}>{item.levelLabel} · confianza {percent(item.confidence)}</small></span>
            <span style={{ textAlign: 'right' }}><strong>{percent(item.estimatedMastery)}</strong><small style={{ display: 'block', color: trendColor }}>{trendLabel}</small></span>
          </div>;
        })}
      </div>
    </div>
  );
}

function EvidenceSparkline({ points }: { points: Array<{ score: number; occurredAt: string }> }) {
  if (points.length < 2) return <div style={{ height: 34, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: '.68rem' }}>Aún sin tendencia</div>;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 30 - (point.score * 26);
    return `${x},${y}`;
  }).join(' ');
  return <svg viewBox="0 0 100 34" role="img" aria-label="Tendencia de las últimas evidencias evaluadas" preserveAspectRatio="none" style={{ width: '100%', height: 34 }}>
    <line x1="0" y1="17" x2="100" y2="17" stroke="rgba(255,255,255,.07)" />
    <polyline points={coordinates} fill="none" stroke="var(--accent-cyan)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export function LearningProgressOverview({ progress, compact = false }: { progress: PlayerLearningProgress; compact?: boolean }) {
  const stats = [
    { label: 'Evidencias', value: progress.summary.totalEvidence, icon: <Activity size={15} /> },
    { label: 'Misiones', value: progress.summary.completedMissions, icon: <Trophy size={15} /> },
    { label: 'Replays revisados', value: progress.summary.reviewedReplayMoments, icon: <BookOpenCheck size={15} /> },
    { label: 'Overlay observado', value: progress.summary.overlayObservations, icon: <Eye size={15} /> },
  ];
  return <div style={{ display: 'grid', gap: '1rem' }}>
    <section style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.8rem', alignItems: 'start', flexWrap: 'wrap', marginBottom: '.8rem' }}>
        <div><h3 style={{ margin: 0 }}>Mapa de competencias</h3><p style={{ color: 'var(--text-muted)', fontSize: '.76rem', margin: '.3rem 0 0' }}>Separa lo que sabes, lo que has practicado y lo que RiftLine ha podido observar.</p></div>
        <span style={{ color: 'var(--accent-cyan)', fontSize: '.72rem' }}>{progress.profile.overallLevelLabel} · confianza {percent(progress.profile.confidence)}</span>
      </div>
      <CompetencyRadar progress={progress} />
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '.65rem' }}>
      {stats.map((item) => <div key={item.label} style={{ ...panel, display: 'flex', gap: '.65rem', alignItems: 'center', padding: '.8rem' }}><span style={{ color: 'var(--accent-violet)' }}>{item.icon}</span><div><strong>{item.value}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{item.label}</small></div></div>)}
    </div>

    {!compact && <section style={panel}>
      <h3 style={{ marginTop: 0 }}>Evolución de evidencias</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '.76rem' }}>Las líneas muestran las últimas respuestas y prácticas evaluadas. No sustituyen la ejecución observada en partida.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '.6rem' }}>
        {progress.profile.competencies.map((competency) => {
          const trend = progress.trends.find((entry) => entry.competencyKey === competency.key);
          return <article key={competency.key} style={{ padding: '.75rem', border: '1px solid var(--border-color)', borderRadius: 8, background: 'rgba(255,255,255,.018)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', fontSize: '.76rem' }}><strong>{competency.label}</strong><span style={{ color: 'var(--text-muted)' }}>{trend?.evidenceCount ?? 0} señales</span></div>
            <EvidenceSparkline points={trend?.points ?? []} />
          </article>;
        })}
      </div>
    </section>}

    {!compact && <section style={panel}>
      <h3 style={{ marginTop: 0 }}>Historial de aprendizaje</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '.76rem' }}>{progress.note}</p>
      <div style={{ display: 'grid', gap: '.55rem' }}>
        {progress.timeline.slice(0, 12).map((item) => <article key={item.id} style={{ padding: '.7rem .8rem', borderLeft: `3px solid ${item.confidence === 'OBSERVED' ? 'var(--accent-cyan)' : item.confidence === 'GUIDED' ? 'var(--accent-violet)' : 'var(--border-color)'}`, background: 'rgba(255,255,255,.018)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.7rem', flexWrap: 'wrap' }}><strong style={{ fontSize: '.8rem' }}>{item.title}</strong><small style={{ color: 'var(--text-muted)' }}>{new Date(item.occurredAt).toLocaleDateString('es-ES')} · {item.sourceLabel}</small></div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '.74rem', marginTop: '.25rem' }}>{item.competencyLabel} · {item.detail}</div>
        </article>)}
        {progress.timeline.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>Completa el diagnóstico para crear la primera evidencia de tu evolución.</div>}
      </div>
    </section>}
  </div>;
}
