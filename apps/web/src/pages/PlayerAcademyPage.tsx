import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'react-router';
import { BookOpen, BrainCircuit, CheckCircle2, Crosshair, Film, Loader, MonitorPlay, Search, ShieldAlert, Target, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiClient,
  type EncyclopediaEntry,
  type LearningReviewStatus,
  type LearningQuestionView,
  type LiveDetectorReadiness,
  type LiveTrainingReport,
  type MissionRecommendation,
  type PlayerLearningProfile,
  type PlayerLearningProgress,
  type PlacementSummary,
  type PlayerReplaySession,
  type ReplayMarker,
  type PlayerTrainingCycle,
} from '../api/client';
import { LearningProgressOverview } from '../components/LearningProgressOverview';
import {
  createLiveModeOcr,
  isFreshModeSignalForCalibration,
  isModeSignalReliableForVerification,
  type OcrModeSignal,
} from '../services/liveModeOcr';
import { buildSilentHudObservation, shouldRecordHudSignal } from '../services/liveHudObservation';
import {
  captureFrame,
  createModeTemplate,
  cropFrame,
  findModeTemplateMatch,
  isUsableTemplateRect,
  loadModeTemplates,
  saveModeTemplates,
  type ModeTemplate,
  type NormalizedRect,
} from '../services/modeTemplateDetector';

type AcademyTab = 'path' | 'diagnostic' | 'progress' | 'knowledge' | 'replay' | 'live';

const card: CSSProperties = { padding: '1.1rem', border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-card)' };
const button: CSSProperties = { border: '1px solid var(--border-color)', borderRadius: 7, padding: '0.55rem 0.8rem', color: 'var(--text-primary)', background: 'rgba(255,255,255,.035)', cursor: 'pointer' };

function percent(value: number) { return `${Math.round(value * 100)}%`; }

export default function PlayerAcademyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<AcademyTab>(() => searchParams.get('onboarding') === '1' ? 'diagnostic' : 'path');
  const [profile, setProfile] = useState<PlayerLearningProfile | null>(null);
  const [mission, setMission] = useState<MissionRecommendation | null>(null);
  const [cycles, setCycles] = useState<PlayerTrainingCycle[]>([]);
  const [progress, setProgress] = useState<PlayerLearningProgress | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [profileResult, cycleResult, progressResult] = await Promise.all([apiClient.playerLearning.profile(), apiClient.playerLearning.cycles(), apiClient.playerLearning.progress()]);
    setProfile(profileResult.profile); setMission(profileResult.recommendation); setCycles(cycleResult.cycles); setProgress(progressResult);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([apiClient.playerLearning.profile(), apiClient.playerLearning.cycles(), apiClient.playerLearning.progress()])
      .then(([profileResult, cycleResult, progressResult]) => {
        if (cancelled) return;
        setProfile(profileResult.profile); setMission(profileResult.recommendation); setCycles(cycleResult.cycles); setProgress(progressResult);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'No se pudo cargar la academia'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  if (loading) return <div className="page-loading"><Loader className="spin" /> Preparando tu ruta de aprendizaje…</div>;
  if (!profile) return <div style={card}>Vincula primero tu jugador de Predecessor desde Mi perfil.</div>;

  const tabs: Array<{ id: AcademyTab; label: string; icon: React.ReactNode }> = [
    { id: 'path', label: 'Mi ruta', icon: <Target size={15} /> },
    { id: 'diagnostic', label: 'Diagnóstico', icon: <BrainCircuit size={15} /> },
    { id: 'progress', label: 'Mi evolución', icon: <TrendingUp size={15} /> },
    { id: 'knowledge', label: 'Enciclopedia', icon: <BookOpen size={15} /> },
    { id: 'replay', label: 'Revisión de replay', icon: <Film size={15} /> },
    { id: 'live', label: 'Entrenamiento local', icon: <MonitorPlay size={15} /> },
  ];
  return (
    <div style={{ padding: '1.25rem', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ color: 'var(--accent-cyan)', fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Academia personal</div>
        <h1 style={{ margin: '.25rem 0' }}>Aprende a decidir, no a copiar recetas</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: 760, margin: 0 }}>Tu nivel aquí mide aprendizaje demostrado, no tu rango. El coach ajusta profundidad, preguntas y práctica a tus evidencias.</p>
      </div>
      <div role="tablist" style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} style={{ ...button, display: 'flex', gap: '.4rem', alignItems: 'center', borderColor: tab === item.id ? 'var(--accent-cyan)' : 'var(--border-color)', color: tab === item.id ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>{item.icon}{item.label}</button>)}
      </div>
      {tab === 'path' && <LearningPath profile={profile} mission={mission} cycles={cycles} onChanged={refresh} />}
      {tab === 'diagnostic' && <Diagnostic profile={profile} onChanged={refresh} onFinished={() => { setSearchParams({}); setTab('path'); }} />}
      {tab === 'progress' && progress && <LearningProgressOverview progress={progress} />}
      {tab === 'knowledge' && <Knowledge />}
      {tab === 'replay' && <ReplayReview />}
      {tab === 'live' && <LocalTraining onOpenReplay={() => setTab('replay')} />}
    </div>
  );
}

function LearningPath({ profile, mission, cycles, onChanged }: { profile: PlayerLearningProfile; mission: MissionRecommendation | null; cycles: PlayerTrainingCycle[]; onChanged: () => Promise<void> }) {
  const active = cycles.find((cycle) => cycle.status === 'ACTIVE');
  const [placementSummary, setPlacementSummary] = useState<PlacementSummary | null>(null);
  const [outcome, setOutcome] = useState<'ACHIEVED' | 'PARTIAL' | 'NOT_YET'>('ACHIEVED');
  const [reflection, setReflection] = useState('');
  const [closingMission, setClosingMission] = useState(false);
  useEffect(() => {
    if (!profile.activeRole) return;
    void apiClient.playerLearning.placement().then((placement) => setPlacementSummary(placement.summary)).catch(() => setPlacementSummary(null));
  }, [profile.activeRole, profile.placementStatus]);
  async function startMission() {
    if (!mission) return;
    try {
      await apiClient.playerLearning.createCycle({ focusKey: mission.key, title: mission.title, cue: mission.cue, targetMatches: mission.targetMatches, competencyKey: mission.competencyKey, learningLevel: profile.overallLevel, successCriteria: mission.successCriteria });
      toast.success('Misión iniciada'); await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo iniciar'); }
  }
  async function closeMission(status: 'COMPLETED' | 'ARCHIVED') {
    if (!active) return;
    if (status === 'COMPLETED' && reflection.trim().length < 20) {
      toast.error('Explica brevemente qué observaste antes de cerrar la misión.');
      return;
    }
    setClosingMission(true);
    try {
      await apiClient.playerLearning.updateCycle(active.id, status, status === 'COMPLETED' ? { outcome, reflection: reflection.trim() } : undefined);
      setReflection('');
      toast.success(status === 'COMPLETED' ? 'Misión revisada. La evidencia ya forma parte de tu evolución.' : 'Misión archivada');
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cerrar la misión');
    } finally {
      setClosingMission(false);
    }
  }
  const practiceComplete = active ? active.matchesPlayed >= active.targetMatches : false;
  const closedCycles = cycles.filter((cycle) => cycle.status !== 'ACTIVE').slice(0, 4);
  return <div style={{ display: 'grid', gap: '1rem' }}>
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div><div style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>NIVEL PEDAGÓGICO {profile.overallLevel}</div><h2 style={{ margin: '.2rem 0' }}>{profile.overallLevelLabel}</h2>{placementSummary && <div style={{ color: 'var(--accent-cyan)', marginBottom: '.2rem' }}>Conocimiento diagnosticado: {placementSummary.band.label}</div>}<div style={{ color: 'var(--text-muted)' }}>Confianza de la evaluación: {percent(profile.confidence)} · {profile.placementStatus === 'PROVISIONAL' ? 'resultado provisional' : 'en construcción'}</div></div>
        <label style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Rol principal<br/><select value={profile.activeRole ?? ''} onChange={async (event) => { await apiClient.playerLearning.updateProfile((event.target.value || null) as PlayerLearningProfile['activeRole']); await onChanged(); }} style={{ ...button, marginTop: '.3rem' }}><option value="">Aún no definido</option>{['CARRY','SUPPORT','MIDLANE','JUNGLE','OFFLANE'].map((role) => <option key={role}>{role}</option>)}</select></label>
      </div>
    </section>
    <section style={{ ...card, display: 'grid', gap: '.7rem' }}><h3 style={{ margin: 0 }}>Competencias</h3><p style={{ color: 'var(--text-muted)', fontSize: '.75rem', margin: 0 }}>La estimación se modera mientras hay pocas evidencias, para que una sola respuesta no parezca dominio demostrado.</p>{profile.competencies.map((item) => <div key={item.key}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem' }}><span>{item.label} <small style={{ color: 'var(--text-muted)' }}>· {item.levelLabel}</small></span><span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{percent(item.estimatedMastery)} estimado · {item.evidenceCount} evidencias</span></div><div style={{ height: 7, background: 'rgba(255,255,255,.06)', borderRadius: 8, marginTop: 5 }}><div style={{ width: percent(item.estimatedMastery), height: '100%', background: 'var(--accent-cyan)', borderRadius: 8 }} /></div></div>)}</section>
    <section style={card}><h3 style={{ marginTop: 0 }}>Ruta de aprendizaje</h3><p style={{ color: 'var(--text-muted)', fontSize: '.76rem' }}>El diagnóstico propone un punto de partida. Para ascender necesitas práctica, varias evidencias consistentes y una prueba; las partidas por sí solas no suben el nivel.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '.55rem' }}>{profile.levels.map((level) => {
      const current = level.level === profile.overallLevel; const completed = level.level < profile.overallLevel;
      return <article key={level.key} style={{ padding: '.7rem', borderRadius: 8, border: `1px solid ${current ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: current ? 'rgba(56,212,200,.055)' : 'rgba(255,255,255,.018)', opacity: level.level > profile.overallLevel ? .7 : 1 }}><small style={{ color: current ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>{completed ? 'SUPERADO' : current ? 'NIVEL ACTUAL' : `NIVEL ${level.level}`}</small><strong style={{ display: 'block', margin: '.2rem 0' }}>{level.label}</strong><span style={{ color: 'var(--text-muted)', fontSize: '.7rem', lineHeight: 1.4 }}>{level.description}</span></article>;
    })}</div></section>
    <section style={card}>
      <h3 style={{ marginTop: 0 }}>{active ? 'Misión activa' : 'Siguiente misión recomendada'}</h3>
      {active ? <div style={{ display: 'grid', gap: '.75rem' }}>
        <div><div style={{ color: 'var(--accent-violet)', fontSize: '.72rem' }}>{active.competencyKey ? profile.competencies.find((item) => item.key === active.competencyKey)?.label : 'Práctica personal'}</div><strong>{active.title}</strong><p style={{ marginBottom: '.35rem' }}>{active.cue}</p></div>
        <div><div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '.75rem' }}><span>Práctica observada</span><span>{active.matchesPlayed}/{active.targetMatches} partidas</span></div><div style={{ height: 7, background: 'rgba(255,255,255,.06)', borderRadius: 8, marginTop: 5 }}><div style={{ width: percent(active.progress), height: '100%', background: practiceComplete ? 'var(--accent-cyan)' : 'var(--accent-violet)', borderRadius: 8 }} /></div></div>
        {!practiceComplete ? <p style={{ color: 'var(--text-muted)', fontSize: '.78rem', margin: 0 }}>El coach recopilará evidencias durante las partidas. Después tendrás que revisar el resultado: jugar las partidas no aprueba automáticamente la misión.</p> : <div style={{ padding: '.85rem', border: '1px solid rgba(56,212,200,.25)', borderRadius: 8, background: 'rgba(56,212,200,.04)' }}>
          <strong>Revisa la práctica antes de cerrarla</strong>
          <p style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>Valora el conjunto de partidas, no sólo la mejor. Esta reflexión cuenta como evidencia guiada; la prueba de ascenso confirmará el conocimiento.</p>
          <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', marginBottom: '.6rem' }}>{([
            ['ACHIEVED', 'Lo apliqué con consistencia'],
            ['PARTIAL', 'Lo detecté, pero fui irregular'],
            ['NOT_YET', 'Todavía no lo apliqué'],
          ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setOutcome(value)} style={{ ...button, borderColor: outcome === value ? 'var(--accent-cyan)' : 'var(--border-color)', color: outcome === value ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>{label}</button>)}</div>
          <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} maxLength={1600} rows={4} placeholder="¿Qué observaste, qué cambió en tus decisiones y qué necesitas revisar todavía?" style={{ ...button, width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.45 }} />
          <button disabled={closingMission || reflection.trim().length < 20} onClick={() => void closeMission('COMPLETED')} style={{ ...button, marginTop: '.6rem', opacity: closingMission || reflection.trim().length < 20 ? .55 : 1 }}>Guardar revisión y cerrar misión</button>
        </div>}
        <button disabled={closingMission} onClick={() => void closeMission('ARCHIVED')} style={{ ...button, justifySelf: 'start', color: 'var(--text-muted)' }}>Archivar y elegir otro foco</button>
      </div> : mission ? <>
        <div style={{ color: 'var(--accent-violet)', fontSize: '.75rem' }}>{mission.competencyLabel}</div><strong>{mission.title}</strong><p>{mission.cue}</p><ul>{mission.replayChecks.map((check) => <li key={check}>{check}</li>)}</ul><button style={button} onClick={startMission}>Iniciar misión de {mission.targetMatches} partidas</button>
      </> : null}
    </section>
    {closedCycles.length > 0 && <section style={card}><h3 style={{ marginTop: 0 }}>Misiones anteriores</h3><div style={{ display: 'grid', gap: '.5rem' }}>{closedCycles.map((cycle) => {
      const evaluation = cycle.evaluation && typeof cycle.evaluation === 'object' ? cycle.evaluation as { outcome?: string; reflection?: string } : {};
      const resultLabel = evaluation.outcome === 'ACHIEVED' ? 'Aplicada con consistencia' : evaluation.outcome === 'PARTIAL' ? 'Aplicación irregular' : evaluation.outcome === 'NOT_YET' ? 'Necesita más práctica' : cycle.status === 'ARCHIVED' ? 'Archivada' : 'Completada';
      return <article key={cycle.id} style={{ padding: '.65rem .75rem', background: 'rgba(255,255,255,.02)', borderRadius: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}><strong>{cycle.title}</strong><small style={{ color: 'var(--text-muted)' }}>{resultLabel}</small></div>{evaluation.reflection && <p style={{ color: 'var(--text-secondary)', fontSize: '.76rem', margin: '.35rem 0 0' }}>{evaluation.reflection}</p>}</article>;
    })}</div></section>}
  </div>;
}

function Diagnostic({ profile, onChanged, onFinished }: { profile: PlayerLearningProfile; onChanged: () => Promise<void>; onFinished: () => void }) {
  const [questions, setQuestions] = useState<LearningQuestionView[]>([]); const [index, setIndex] = useState(0); const [feedback, setFeedback] = useState<{ feedback: string; principle: string } | null>(null); const [busy, setBusy] = useState(false);
  const [answeredBeforeVisit, setAnsweredBeforeVisit] = useState(0);
  const [total, setTotal] = useState(20); const [summary, setSummary] = useState<PlacementSummary | null>(null);
  const [promotion, setPromotion] = useState<{ eligible: boolean; reason?: string; competency?: { label: string }; question?: LearningQuestionView } | null>(null);
  const [promotionMode, setPromotionMode] = useState(false);
  useEffect(() => { if (!profile.activeRole) return; Promise.all([apiClient.playerLearning.placement(), apiClient.playerLearning.promotion()]).then(([placement, promotionResult]) => { setQuestions(placement.questions); setAnsweredBeforeVisit(placement.answered); setTotal(placement.total); setSummary(placement.summary); setPromotion(promotionResult); }).catch(() => toast.error('No se pudo cargar el diagnóstico')); }, [profile.activeRole]);
  async function chooseRole(activeRole: NonNullable<PlayerLearningProfile['activeRole']>) {
    setBusy(true);
    try {
      await apiClient.playerLearning.updateProfile(activeRole);
      await onChanged();
      toast.success('Rol guardado. Empezamos tu diagnóstico.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el rol');
    } finally {
      setBusy(false);
    }
  }
  if (!profile.activeRole) return <section style={{ ...card, maxWidth: 760 }}><BrainCircuit color="var(--accent-violet)"/><div style={{ color: 'var(--accent-cyan)', fontSize: '.72rem', fontWeight: 800, marginTop: '.7rem' }}>PRIMER PASO · 1 DE 2</div><h2>¿Qué rol quieres aprender primero?</h2><p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>Tu diagnóstico combinará fundamentos generales con situaciones propias de este rol. Podrás cambiarlo más adelante; no afecta a tu rango ni bloquea el resto de la plataforma.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '.55rem', marginTop: '1rem' }}>{(['CARRY','SUPPORT','MIDLANE','JUNGLE','OFFLANE'] as const).map((role) => <button key={role} disabled={busy} onClick={() => void chooseRole(role)} style={{ ...button, padding: '.8rem', textAlign: 'center', opacity: busy ? .6 : 1 }}>{role}</button>)}</div></section>;
  if (summary && !promotionMode) return <section style={{ ...card, maxWidth: 860 }}>
    <CheckCircle2 color="var(--accent-cyan)"/>
    <div style={{ color: 'var(--accent-cyan)', fontSize: '.72rem', fontWeight: 800, marginTop: '.7rem' }}>DIAGNÓSTICO DE CONOCIMIENTO · {summary.answered} SITUACIONES</div>
    <h2 style={{ marginBottom: '.35rem' }}>{summary.band.label}</h2>
    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>{summary.band.description}</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '.65rem', margin: '1rem 0' }}>
      {[['Criterio global', summary.overallScore], ['Fundamentos comunes', summary.generalScore], [`Rol ${profile.activeRole}`, summary.roleScore]].map(([label, score]) => <div key={String(label)} style={{ padding: '.8rem', borderRadius: 8, background: 'rgba(255,255,255,.035)' }}><div style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>{String(label)}</div><strong style={{ fontSize: '1.25rem' }}>{percent(Number(score))}</strong></div>)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '.65rem' }}>
      {summary.strongest && <div style={{ padding: '.8rem', borderLeft: '3px solid var(--accent-cyan)', background: 'rgba(56,212,200,.06)' }}><small style={{ color: 'var(--text-muted)' }}>SEÑAL MÁS FUERTE</small><div>{summary.strongest.label}</div></div>}
      {summary.priority && <div style={{ padding: '.8rem', borderLeft: '3px solid var(--accent-violet)', background: 'rgba(167,139,250,.06)' }}><small style={{ color: 'var(--text-muted)' }}>PRIMERA PRIORIDAD</small><div>{summary.priority.label}</div></div>}
    </div>
    <p style={{ color: 'var(--text-muted)', fontSize: '.8rem', lineHeight: 1.5 }}>{summary.limitation}</p>
    <div style={{ display: 'flex', gap: '.55rem', alignItems: 'center', flexWrap: 'wrap' }}><button style={button} onClick={onFinished}>Ver mi ruta personalizada</button>{promotion?.eligible && promotion.question ? <button style={{ ...button, borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }} onClick={() => { setFeedback(null); setPromotionMode(true); }}>Realizar prueba de ascenso · {promotion.competency?.label}</button> : <small style={{ color: 'var(--text-muted)' }}>Próximo ascenso: {promotion?.reason ?? 'completa una misión y reúne evidencias consistentes.'}</small>}</div>
  </section>;
  const isPromotion = promotionMode && !!promotion?.eligible && !!promotion.question;
  const current = isPromotion ? promotion?.question : questions[index];
  if (!current) return <section style={card}><CheckCircle2 color="var(--accent-cyan)"/><h3>Diagnóstico recorrido</h3><p>Ya has contestado esta ronda. Es una estimación provisional; tu nivel se confirmará con misiones y revisiones reales.</p><p style={{ color: 'var(--text-muted)' }}><strong>Prueba de ascenso:</strong> {promotion?.reason ?? 'La siguiente prueba aparecerá cuando una misión y varias evidencias demuestren consistencia.'}</p><button style={button} onClick={onFinished}>Ver mi ruta personalizada</button></section>;
  async function answer(optionId: string) {
    if (!current) return;
    setBusy(true);
    try {
      const { result } = await apiClient.playerLearning.answerQuestion(current.key, optionId, isPromotion ? 'PROMOTION' : 'PLACEMENT');
      await onChanged();
      if (isPromotion) {
        setFeedback(result);
      } else if (index + 1 < questions.length) {
        setIndex((value) => value + 1);
      } else {
        const completed = await apiClient.playerLearning.placement();
        setQuestions(completed.questions);
        setAnsweredBeforeVisit(completed.answered);
        setTotal(completed.total);
        setSummary(completed.summary);
        setIndex(0);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar'); } finally { setBusy(false); }
  }
  const situationNumber = answeredBeforeVisit + index + 1;
  return <section style={{ ...card, maxWidth: 860 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', color: 'var(--text-muted)', fontSize: '.75rem' }}><span>{isPromotion ? `Prueba de ascenso · ${promotion?.competency?.label}` : `Situación ${situationNumber} de ${total} · ${current.competencyLabel}`}</span>{!isPromotion && <span>{Math.round(((situationNumber - 1) / total) * 100)}%</span>}</div>
    {!isPromotion && <><div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 8, marginTop: '.45rem' }}><div style={{ width: percent((situationNumber - 1) / total), height: '100%', background: 'var(--accent-cyan)', borderRadius: 8 }} /></div>{situationNumber === 1 && <p style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>20 situaciones · unos 10–15 minutos. No mostraremos correcciones hasta terminar para no influir en tus respuestas posteriores.</p>}</>}
    <h2>{current.prompt}</h2><p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{current.context}</p>
    {!feedback ? <div style={{ display: 'grid', gap: '.55rem' }}>{current.options.map((option) => <button disabled={busy} key={option.id} style={{ ...button, textAlign: 'left', lineHeight: 1.4, opacity: busy ? .65 : 1 }} onClick={() => void answer(option.id)}>{option.text}</button>)}</div> : <div style={{ padding: '1rem', borderLeft: '3px solid var(--accent-cyan)', background: 'rgba(56,212,200,.06)' }}><strong>Qué aprender de la respuesta</strong><p>{feedback.feedback}</p><p style={{ color: 'var(--accent-cyan)' }}>{feedback.principle}</p><button style={button} onClick={onFinished}>Finalizar prueba y volver a mi ruta</button></div>}
  </section>;
}

function readableText(value: unknown) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function KnowledgeDetails({ entry }: { entry: EncyclopediaEntry }) {
  const details = (entry.details && typeof entry.details === 'object' ? entry.details : {}) as Record<string, unknown>;
  const abilities = Array.isArray(details.abilities) ? details.abilities as Array<Record<string, unknown>> : [];
  const effects = Array.isArray(details.effects) ? details.effects as Array<Record<string, unknown>> : [];
  const stats = details.stats && typeof details.stats === 'object' ? details.stats as Record<string, unknown> : null;
  if (abilities.length) return <div style={{ display: 'grid', gap: '.55rem', marginTop: '.55rem' }}>{abilities.map((ability, index) => <div key={`${String(ability.key ?? index)}`} style={{ padding: '.55rem', background: 'rgba(0,0,0,.16)', borderRadius: 6 }}><strong>{String(ability.key ?? '')} · {String(ability.display_name ?? 'Habilidad')}</strong><p style={{ margin: '.25rem 0', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{readableText(ability.menu_description ?? ability.game_description)}</p>{Array.isArray(ability.cooldown) && ability.cooldown.length > 0 ? <small>Enfriamiento: {ability.cooldown.join(' / ')}</small> : null}</div>)}</div>;
  if (effects.length || stats) return <div style={{ marginTop: '.55rem' }}>{stats ? <div><strong>Estadísticas</strong><p style={{ color: 'var(--text-secondary)' }}>{Object.entries(stats).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' / ') : String(value)}`).join(' · ') || 'Sin estadísticas descritas'}</p></div> : null}{effects.map((effect, index) => <p key={index} style={{ color: 'var(--text-secondary)' }}><strong>{String(effect.name ?? 'Efecto')}:</strong> {readableText(effect.text ?? effect.description)}</p>)}</div>;
  return <div style={{ marginTop: '.55rem', color: 'var(--text-secondary)' }}>{Object.entries(details).filter(([, value]) => value != null).map(([key, value]) => <p key={key} style={{ margin: '.25rem 0' }}><strong>{key}:</strong> {readableText(Array.isArray(value) ? value.join(', ') : value)}</p>)}</div>;
}

function Knowledge() {
  const [query, setQuery] = useState(''); const [kind, setKind] = useState<EncyclopediaEntry['kind'] | ''>(''); const [entries, setEntries] = useState<EncyclopediaEntry[]>([]); const [coverage, setCoverage] = useState<{ patch: { name: string } | null; domains: Record<string, { total: number; percent: number }>; gaps: string[]; disclaimer: string } | null>(null);
  useEffect(() => { Promise.all([apiClient.playerLearning.knowledgeCoverage(), apiClient.playerLearning.searchKnowledge('', 'concept')]).then(([a,b]) => { setCoverage(a); setEntries(b.entries); }).catch(() => toast.error('No se pudo consultar el conocimiento')); }, []);
  async function search() { const result = await apiClient.playerLearning.searchKnowledge(query, kind || undefined); setEntries(result.entries); }
  return <div style={{ display: 'grid', gap: '1rem' }}><section style={card}><h3 style={{ marginTop: 0 }}>Cobertura trazable {coverage?.patch ? `· parche ${coverage.patch.name}` : ''}</h3><p style={{ color: 'var(--text-muted)' }}>{coverage?.disclaimer}</p><div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>{coverage && Object.entries(coverage.domains).map(([key, value]) => <span key={key} style={{ ...button, cursor: 'default', fontSize: '.72rem' }}>{key}: {value.total} · {value.percent}%</span>)}</div>{coverage?.gaps.map((gap) => <p key={gap} style={{ color: '#fbbf24', fontSize: '.78rem' }}>Pendiente: {gap}</p>)}</section><section style={card}><div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}><div style={{ position: 'relative', flex: '1 1 300px' }}><Search size={15} style={{ position: 'absolute', left: 10, top: 11 }} /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} placeholder="Busca héroes, habilidades, objetos, Eternos, Augmentos o conceptos" style={{ ...button, width: '100%', paddingLeft: 34, boxSizing: 'border-box' }} /></div><select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} style={button}><option value="">Todo</option><option value="concept">Conceptos</option><option value="hero">Héroes</option><option value="item">Objetos</option><option value="loadout">Loadout</option><option value="eternal_category">Eternos</option></select><button onClick={() => void search()} style={button}>Buscar</button></div><div style={{ display: 'grid', gap: '.65rem' }}>{entries.map((entry) => <article key={`${entry.kind}-${entry.key}`} style={{ padding: '.8rem', background: 'rgba(255,255,255,.025)', borderRadius: 8 }}><div style={{ fontSize: '.65rem', color: 'var(--accent-violet)', textTransform: 'uppercase' }}>{entry.kind} · {entry.patch ? `parche ${entry.patch}` : 'fundamento estable'} · confianza {entry.confidence}</div><strong>{entry.title}</strong><p style={{ margin: '.3rem 0', color: 'var(--text-muted)' }}>{entry.summary}</p><small>{entry.source}</small><details style={{ marginTop: '.55rem' }}><summary style={{ cursor: 'pointer', color: 'var(--accent-cyan)', fontSize: '.75rem' }}>Ver datos y explicación disponibles</summary><KnowledgeDetails entry={entry}/></details></article>)}</div></section></div>;
}

const REPLAY_STATUS_LABELS: Record<LearningReviewStatus, string> = {
  PENDING: 'Pendiente de revisar',
  CONFIRMED_MISTAKE: 'Decisión mejorable confirmada',
  GOOD_DECISION: 'Buena decisión confirmada',
  INCONCLUSIVE: 'No concluyente',
};

function ReplayMarkerReview({ sessionId, marker, onChanged }: { sessionId: string; marker: ReplayMarker; onChanged: () => Promise<void> }) {
  const [conclusion, setConclusion] = useState(marker.conclusion ?? '');
  const [saving, setSaving] = useState(false);
  async function save(status: Exclude<LearningReviewStatus, 'PENDING'>) {
    if (conclusion.trim().length < 20) {
      toast.error('Describe qué demuestra el vídeo antes de clasificar el momento.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.playerLearning.updateReplayMarker(sessionId, marker.id, { status, conclusion: conclusion.trim() });
      toast.success('Conclusión guardada como evidencia guiada');
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la conclusión');
    } finally {
      setSaving(false);
    }
  }
  async function assessSignal(signalAssessment: Exclude<ReplayMarker['signalAssessment'], 'UNREVIEWED'>) {
    setSaving(true);
    try {
      await apiClient.playerLearning.updateReplayMarker(sessionId, marker.id, { signalAssessment });
      toast.success('Validación del detector guardada');
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo validar la señal');
    } finally {
      setSaving(false);
    }
  }
  return <article style={{ marginTop: '.65rem', padding: '.75rem', borderRadius: 8, background: 'rgba(255,255,255,.025)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}><strong>{captureTime(marker.videoTime)} de vídeo · {marker.title}</strong><small style={{ color: marker.status === 'PENDING' ? '#fbbf24' : 'var(--accent-cyan)' }}>{REPLAY_STATUS_LABELS[marker.status]}</small></div>
    <p style={{ margin: '.4rem 0' }}>{marker.question}</p>
    {marker.sourceEventId && <div style={{ margin: '.6rem 0', padding: '.65rem', border: '1px solid rgba(167,139,250,.25)', borderRadius: 7, background: 'rgba(124,92,252,.04)' }}><strong style={{ fontSize: '.76rem' }}>Primero valida el detector</strong><p style={{ color: 'var(--text-muted)', fontSize: '.72rem', margin: '.25rem 0 .45rem' }}>¿El vídeo muestra realmente el evento que RiftLine señaló? Esto no valora todavía si tu decisión fue buena o mala.</p><div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>{([
      ['CONFIRMED_SIGNAL', 'Sí, acertó'],
      ['FALSE_POSITIVE', 'No, falso positivo'],
      ['NOT_VERIFIABLE', 'No se puede comprobar'],
    ] as const).map(([assessment, label]) => <button key={assessment} disabled={saving} onClick={() => void assessSignal(assessment)} style={{ ...button, opacity: saving ? .55 : 1, borderColor: marker.signalAssessment === assessment ? 'var(--accent-violet)' : 'var(--border-color)' }}>{label}</button>)}</div></div>}
    <textarea value={conclusion} onChange={(event) => setConclusion(event.target.value)} maxLength={1600} rows={3} placeholder="Separa lo que ves, lo que interpretas y qué harías en una situación similar." style={{ ...button, width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.45 }} />
    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.5rem' }}>{([
      ['GOOD_DECISION', 'Buena decisión'],
      ['CONFIRMED_MISTAKE', 'Decisión mejorable'],
      ['INCONCLUSIVE', 'No puedo concluirlo'],
    ] as const).map(([status, label]) => <button key={status} disabled={saving} onClick={() => void save(status)} style={{ ...button, opacity: saving ? .55 : 1, borderColor: marker.status === status ? 'var(--accent-cyan)' : 'var(--border-color)' }}>{label}</button>)}</div>
  </article>;
}

function ReplaySessionReview({ session, onChanged }: { session: PlayerReplaySession; onChanged: () => Promise<void> }) {
  const [recordingUrl, setRecordingUrl] = useState(session.recordingUrl ?? '');
  const [offsetSeconds, setOffsetSeconds] = useState(session.offsetSeconds);
  const [expectedDeaths, setExpectedDeaths] = useState(session.detectorCalibration?.byEventType.DEATH_REVIEW.expectedEvents ?? 0);
  const [expectedSkillAlerts, setExpectedSkillAlerts] = useState(session.detectorCalibration?.byEventType.SKILL_LEVEL_AVAILABLE.expectedEvents ?? 0);
  const [saving, setSaving] = useState(false);
  async function saveRecording() {
    setSaving(true);
    try {
      await apiClient.playerLearning.updateReplay(session.id, { recordingUrl: recordingUrl.trim() || null, offsetSeconds });
      toast.success('Grabación y tiempos actualizados');
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la grabación');
    } finally {
      setSaving(false);
    }
  }
  async function saveDetectorCalibration() {
    if (!session.recordingUrl) {
      toast.error('Guarda primero la grabación completa para poder calibrar.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.playerLearning.updateReplay(session.id, {
        detectorCalibration: { fullRecordingReviewed: true, expectedDeathReviews: expectedDeaths, expectedSkillAlerts },
      });
      toast.success('Revisión completa guardada para calibrar eventos omitidos');
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la calibración');
    } finally {
      setSaving(false);
    }
  }
  return <section style={card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}><div><strong>{session.title}</strong><div style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{session.status} · {session.markers.length} momentos</div></div>{session.recordingUrl && <a href={session.recordingUrl} target="_blank" rel="noreferrer">Abrir grabación</a>}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.5rem', marginTop: '.7rem' }}><input value={recordingUrl} onChange={(event) => setRecordingUrl(event.target.value)} placeholder="URL privada o local servida por ti" style={{ ...button, minWidth: 0 }}/><input type="number" value={offsetSeconds} onChange={(event) => setOffsetSeconds(Number(event.target.value) || 0)} aria-label="Ajuste temporal en segundos" title="Segundos que separan el inicio de la captura y el inicio de la grabación" style={{ ...button, minWidth: 0 }}/><button disabled={saving} onClick={() => void saveRecording()} style={{ ...button, opacity: saving ? .55 : 1 }}>{saving ? 'Guardando…' : 'Guardar y alinear'}</button></div>
    <p style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>El ajuste temporal desplaza todos los marcadores. Usa un valor positivo si el vídeo empieza antes que la captura y comprueba siempre el primer momento.</p>
    {session.liveTrainingSessionId && <div style={{ margin: '.75rem 0', padding: '.75rem', borderRadius: 8, border: '1px solid rgba(56,212,200,.24)', background: 'rgba(56,212,200,.035)' }}><strong>Calibración opcional con el replay completo</strong><p style={{ color: 'var(--text-muted)', fontSize: '.74rem' }}>Después de validar cada marcador, revisa toda la grabación y cuenta cuántas veces ocurrieron realmente estas dos señales. Sólo así RiftLine puede medir eventos omitidos. No completa misiones ni cambia tu nivel.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '.45rem' }}><label style={{ color: 'var(--text-muted)', fontSize: '.7rem' }}>Pantallas propias de reaparición<input type="number" min={0} max={100} value={expectedDeaths} onChange={(event) => setExpectedDeaths(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} style={{ ...button, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '.2rem' }}/></label><label style={{ color: 'var(--text-muted)', fontSize: '.7rem' }}>Avisos de punto de habilidad<input type="number" min={0} max={100} value={expectedSkillAlerts} onChange={(event) => setExpectedSkillAlerts(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} style={{ ...button, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '.2rem' }}/></label><button disabled={saving || !session.recordingUrl} onClick={() => void saveDetectorCalibration()} style={{ ...button, alignSelf: 'end', opacity: saving || !session.recordingUrl ? .5 : 1 }}>Confirmar revisión completa</button></div>{session.detectorCalibration && <div style={{ marginTop: '.55rem', color: 'var(--text-muted)', fontSize: '.72rem' }}>{(['DEATH_REVIEW', 'SKILL_LEVEL_AVAILABLE'] as const).map((eventType) => { const result = session.detectorCalibration!.byEventType[eventType]; return <div key={eventType}>{eventType === 'DEATH_REVIEW' ? 'Reapariciones' : 'Avisos de habilidad'}: {result.confirmedSignals} confirmados · {result.missedEvents} omitidos{result.eligible ? '' : ' · muestra excluida hasta resolver marcadores pendientes o no verificables'}</div>; })}</div>}</div>}
    {session.markers.length > 0 ? session.markers.map((marker) => <ReplayMarkerReview key={marker.id} sessionId={session.id} marker={marker} onChanged={onChanged}/>) : <p style={{ color: 'var(--text-muted)' }}>{session.liveTrainingSessionId ? 'El acompañante no creó marcadores. Si revisas la grabación completa, la calibración permitirá registrar los eventos que omitió.' : 'Añade una grabación o crea la revisión desde un informe para obtener momentos guiados.'}</p>}
  </section>;
}

function ReplayReview() {
  const [sessions, setSessions] = useState<PlayerReplaySession[]>([]); const [title, setTitle] = useState('Mi revisión'); const [url, setUrl] = useState('');
  const load = async () => { const result = await apiClient.playerLearning.replays(); setSessions(result.sessions); };
  useEffect(() => {
    let cancelled = false;
    void apiClient.playerLearning.replays().then((result) => { if (!cancelled) setSessions(result.sessions); }).catch(() => toast.error('No se pudieron cargar los replays'));
    return () => { cancelled = true; };
  }, []);
  async function create() { try { await apiClient.playerLearning.createReplay({ title, recordingUrl: url || null }); setUrl(''); await load(); toast.success('Revisión creada'); } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo crear'); } }
  return <div style={{ display: 'grid', gap: '1rem' }}><section style={card}><h3 style={{ marginTop: 0 }}>Revisa causas, no sólo resultados</h3><p style={{ color: 'var(--text-muted)' }}>La API y el acompañante señalan cuándo mirar. El vídeo permite confirmar visión, movimiento, intención y alternativas. Clasificar un momento exige una conclusión escrita; reconocer que la evidencia no basta también es una respuesta válida.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.5rem' }}><input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...button, minWidth: 0 }}/><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL privada o local servida por ti (opcional)" style={{ ...button, minWidth: 0 }}/><button onClick={() => void create()} style={button}>Crear revisión</button></div></section>{sessions.length > 0 ? sessions.map((session) => <ReplaySessionReview key={session.id} session={session} onChanged={load}/>) : <section style={{ ...card, color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text-primary)' }}>Todavía no hay revisiones</strong><p style={{ marginBottom: 0 }}>Puedes crear una manualmente o finalizar una captura verificada para importar automáticamente sus momentos.</p></section>}</div>;
}

async function finishLiveTrainingSession(sessionId: string): Promise<LiveTrainingReport> {
  await apiClient.playerLearning.endLiveSession(sessionId);
  return (await apiClient.playerLearning.liveSessionReport(sessionId)).report;
}

const LIVE_EVIDENCE_LABELS: Record<string, string> = {
  positioning: 'posicionamiento',
  available_vision: 'visión disponible',
  movement: 'movimiento previo',
  cooldowns: 'habilidades y objetos disponibles',
  player_intent: 'intención de la jugada',
  hero: 'héroe utilizado',
  current_ability_levels: 'niveles actuales de habilidades',
  recommended_skill_order: 'orden contextual de habilidades',
  combat_state: 'estado de combate',
};

function LiveEvidenceSummary({ evidence }: { evidence: Record<string, unknown> }) {
  const explanation = typeof evidence.explanation === 'string' ? evidence.explanation : null;
  const missingInputs = Array.isArray(evidence.missingInputs)
    ? evidence.missingInputs.filter((input): input is string => typeof input === 'string')
    : [];
  if (!explanation && !missingInputs.length) return null;
  return <div style={{ marginTop: '.35rem', color: 'var(--text-muted)', fontSize: '.74rem' }}>{explanation && <p style={{ margin: 0 }}>{explanation}</p>}{missingInputs.length > 0 && <p style={{ margin: '.3rem 0 0' }}><strong>Confirma en el replay:</strong> {missingInputs.map((input) => LIVE_EVIDENCE_LABELS[input] ?? input).join(', ')}.</p>}</div>;
}

function captureTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const DETECTOR_STATUS: Record<LiveDetectorReadiness['detectors'][number]['status'], { label: string; color: string }> = {
  VERIFIED_THIS_SESSION: { label: 'Verificado en esta sesión', color: 'var(--accent-cyan)' },
  SIGNAL_CAPTURED: { label: 'Señal capturada', color: '#a78bfa' },
  AVAILABLE_UNVALIDATED: { label: 'Disponible · falta validar', color: '#fbbf24' },
  PENDING_IMPLEMENTATION: { label: 'Pendiente de implementar', color: 'var(--text-muted)' },
  SAFETY_BLOCKED: { label: 'Bloqueado por seguridad', color: '#f87171' },
};

function DetectorReadinessPanel({ readiness }: { readiness: LiveDetectorReadiness }) {
  const headline = readiness.overallStatus === 'SAFETY_BLOCKED'
    ? 'Captura bloqueada por seguridad'
    : readiness.overallStatus === 'PARTIAL_EVIDENCE'
      ? 'Evidencia parcial obtenida'
      : readiness.overallStatus === 'MODE_ONLY'
        ? 'Modo verificado; faltan señales de juego'
        : 'Necesita calibración con una partida permitida';
  return <section style={card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.7rem', alignItems: 'start', flexWrap: 'wrap' }}>
      <div><div style={{ color: 'var(--accent-violet)', fontSize: '.7rem', fontWeight: 800 }}>COBERTURA REAL DEL ACOMPAÑANTE</div><h3 style={{ margin: '.25rem 0' }}>{headline}</h3><p style={{ color: 'var(--text-muted)', fontSize: '.76rem', maxWidth: 780, marginBottom: 0 }}>{readiness.accuracyExplanation}</p></div>
      <span style={{ ...button, cursor: 'default' }}>{readiness.implementedCount}/{readiness.totalCount} áreas con detector</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '.55rem', marginTop: '.8rem' }}>
      {readiness.detectors.map((detector) => {
        const status = DETECTOR_STATUS[detector.status];
        return <details key={detector.key} style={{ padding: '.7rem .75rem', border: '1px solid var(--border-color)', borderRadius: 8, background: 'rgba(255,255,255,.018)' }}>
          <summary style={{ cursor: 'pointer' }}><span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.65rem', textTransform: 'uppercase' }}>{detector.area}</span><strong>{detector.label}</strong><span style={{ display: 'block', color: status.color, fontSize: '.7rem', marginTop: '.2rem' }}>{status.label}{detector.sessionSignals > 0 ? ` · ${detector.sessionSignals} señales` : ''}</span></summary>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.74rem' }}><strong>Puede demostrar:</strong> {detector.whatItCanProve}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '.74rem' }}><strong>No puede demostrar:</strong> {detector.limitation}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '.74rem' }}><strong>Calibración:</strong> {detector.quality.status === 'NO_SAMPLES'
            ? 'sin señales revisadas todavía.'
            : detector.quality.estimatedSignalPrecision === null
              ? `${detector.quality.labelledSamples} revisadas · ${detector.quality.confirmedSignals} confirmadas · ${detector.quality.falsePositives} falsos positivos · mínimo ${detector.quality.minimumForEstimate} señales evaluables para estimar acierto.`
              : `${Math.round(detector.quality.estimatedSignalPrecision * 100)}% de las señales emitidas fueron confirmadas en ${detector.quality.confirmedSignals + detector.quality.falsePositives} casos evaluables; no mide eventos omitidos.`}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '.74rem' }}><strong>Eventos omitidos:</strong> {detector.quality.recallStatus === 'NO_REPLAYS'
            ? 'sin grabaciones completas revisadas.'
            : detector.quality.estimatedRecall === null
              ? `${detector.quality.fullyReviewedReplays} replays completos · ${detector.quality.expectedEvents} eventos reales · ${detector.quality.missedEvents} omitidos · mínimo ${detector.quality.minimumExpectedForRecall} eventos para estimar cobertura.`
              : `${Math.round(detector.quality.estimatedRecall * 100)}% de ${detector.quality.expectedEvents} eventos reales detectados · ${detector.quality.missedEvents} omitidos.`}</p>
          <p style={{ fontSize: '.74rem', marginBottom: 0 }}><strong>Siguiente validación:</strong> {detector.nextStep}</p>
        </details>;
      })}
    </div>
  </section>;
}

function LiveTrainingReportReview({ report, busy, onCreateReplay }: { report: LiveTrainingReport; busy: boolean; onCreateReplay: () => void }) {
  const primary = report.review.primaryFocus;
  const eventsById = new Map(report.events.map((event) => [event.id, event]));
  return <section style={card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.7rem', flexWrap: 'wrap' }}>
      <div><div style={{ color: 'var(--accent-cyan)', fontSize: '.7rem', fontWeight: 800 }}>INFORME DE LA ÚLTIMA CAPTURA</div><h3 style={{ margin: '.25rem 0' }}>{report.detectedGameMode ?? report.requestedGameMode} · {report.status}</h3></div>
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}><span style={{ ...button, cursor: 'default' }}>{report.summary.observations} observaciones</span><span style={{ ...button, cursor: 'default' }}>{report.summary.spoken} mostradas</span><span style={{ ...button, cursor: 'default' }}>{report.summary.silent} para revisión</span></div>
    </div>
    <p style={{ color: 'var(--text-muted)', fontSize: '.76rem' }}>{report.limitation}</p>
    <div style={{ padding: '.7rem .8rem', borderRadius: 8, background: 'rgba(124,92,252,.055)', border: '1px solid rgba(124,92,252,.22)', marginBottom: '.7rem' }}><strong>Impacto en tu nivel</strong><p style={{ color: 'var(--text-muted)', fontSize: '.75rem', margin: '.25rem 0 0' }}>{report.review.learningImpact.explanation}</p></div>
    {primary ? <article style={{ padding: '.85rem', borderRadius: 9, border: '1px solid rgba(56,212,200,.28)', background: 'rgba(56,212,200,.045)', marginBottom: '.75rem' }}>
      <div style={{ color: 'var(--accent-cyan)', fontSize: '.68rem', fontWeight: 800 }}>FOCO PRINCIPAL · {captureTime(primary.captureTimeSeconds)} DE CAPTURA</div>
      <h4 style={{ margin: '.3rem 0' }}>{primary.title}</h4>
      <p style={{ margin: '.3rem 0' }}><strong>Hecho:</strong> {primary.observedFact}</p>
      <p style={{ margin: '.3rem 0' }}><strong>Inferencia prudente:</strong> {primary.inference}</p>
      <p style={{ margin: '.3rem 0', color: 'var(--text-muted)' }}><strong>Límite:</strong> {primary.limitation}</p>
      <p style={{ margin: '.45rem 0 0' }}><strong>Pregunta para el replay:</strong> {primary.replayQuestion}</p>
    </article> : null}
    {report.review.reviewMoments.length > 0 ? <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '.55rem' }}><strong>Cronología para revisar</strong><button disabled={busy} onClick={onCreateReplay} style={{ ...button, opacity: busy ? .55 : 1 }}>{busy ? 'Creando revisión…' : 'Crear revisión con estos momentos'}</button></div>
      <div style={{ display: 'grid', gap: '.45rem' }}>{report.review.reviewMoments.map((moment) => {
        const event = eventsById.get(moment.eventId);
        return <details key={moment.eventId} style={{ padding: '.65rem .75rem', borderRadius: 8, background: 'rgba(255,255,255,.025)' }}><summary style={{ cursor: 'pointer' }}><strong>{captureTime(moment.captureTimeSeconds)} · {moment.title}</strong><small style={{ marginLeft: '.55rem', color: 'var(--text-muted)' }}>{event?.advice ? 'Mostrada en overlay' : 'Guardada sin interrumpir'}</small></summary><p><strong>Observado:</strong> {moment.observedFact}</p><p><strong>Qué puede significar:</strong> {moment.inference}</p><p style={{ color: 'var(--text-muted)' }}>{moment.limitation}</p><p><strong>Revisa desde {captureTime(moment.suggestedClip.startSeconds)} hasta {captureTime(moment.suggestedClip.endSeconds)}:</strong> {moment.replayQuestion}</p>{event && <LiveEvidenceSummary evidence={event.evidence}/>}</details>;
      })}</div>
    </> : <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}><p style={{ margin: 0 }}>No se registraron observaciones: es el resultado correcto cuando el modo o las señales no son suficientemente fiables.</p>{report.modeVerification === 'VERIFIED_ALLOWED' && report.status === 'COMPLETED' && <button disabled={busy} onClick={onCreateReplay} style={{ ...button, opacity: busy ? .55 : 1 }}>{busy ? 'Creando revisión…' : 'Crear revisión para comprobar eventos omitidos'}</button>}</div>}
    <p style={{ color: 'var(--text-muted)', fontSize: '.72rem', marginBottom: 0 }}><strong>Fortalezas:</strong> {report.review.strengthsLimitation}</p>
  </section>;
}

function LocalTraining({ onOpenReplay }: { onOpenReplay: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null); const liveSessionIdRef = useRef<string | null>(null); const captureStartedAtRef = useRef<number | null>(null); const sentSignalsRef = useRef(new Set<string>()); const liveCanAdviseRef = useRef(false); const recordedHudSignalsRef = useRef(new Map<string, string>()); const calibrationCanvasRef = useRef<HTMLCanvasElement | null>(null); const calibrationSurfaceRef = useRef<HTMLDivElement>(null); const selectionStartRef = useRef<{ x: number; y: number } | null>(null); const [mode, setMode] = useState('STANDARD'); const [status, setStatus] = useState('Sin iniciar'); const [capturing, setCapturing] = useState(false);
  const [companionEnvironment, setCompanionEnvironment] = useState<Awaited<ReturnType<RiftLineCompanionBridge['getEnvironment']>>>(null);
  const [gameWindows, setGameWindows] = useState<RiftLineGameWindow[]>([]); const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null); const [scanning, setScanning] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null); const [modeVerification, setModeVerification] = useState('UNVERIFIED'); const [verifiedMode, setVerifiedMode] = useState<string | null>(null); const [ocrStatus, setOcrStatus] = useState('OCR local pendiente');
  const [lastReport, setLastReport] = useState<LiveTrainingReport | null>(null); const [silentObservationCount, setSilentObservationCount] = useState(0); const [creatingReplayReview, setCreatingReplayReview] = useState(false);
  const [detectorReadiness, setDetectorReadiness] = useState<LiveDetectorReadiness | null>(null);
  const [lastOcrSignal, setLastOcrSignal] = useState<OcrModeSignal | null>(null); const [modeTemplates, setModeTemplates] = useState<ModeTemplate[]>(() => loadModeTemplates()); const [calibrationFrameUrl, setCalibrationFrameUrl] = useState<string | null>(null); const [calibrationRect, setCalibrationRect] = useState<NormalizedRect | null>(null); const [calibrationSignal, setCalibrationSignal] = useState<OcrModeSignal | null>(null); const [calibrating, setCalibrating] = useState(false); const [calibrationStatus, setCalibrationStatus] = useState('');
  const companion = typeof window !== 'undefined' ? window.riftlineCompanion : undefined;
  const rankedSelected = mode === 'RANKED';
  function acceptLiveReport(report: LiveTrainingReport) {
    setLastReport(report);
    setDetectorReadiness(report.readiness);
  }
  useEffect(() => {
    let cancelled = false;
    void apiClient.playerLearning.liveReadiness()
      .then((result) => { if (!cancelled) setDetectorReadiness(result.readiness); })
      .catch(() => { if (!cancelled) setDetectorReadiness(null); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const cleanup = () => {
      const sessionId = liveSessionIdRef.current;
      liveSessionIdRef.current = null;
      liveCanAdviseRef.current = false;
      captureStartedAtRef.current = null;
      if (sessionId) void apiClient.playerLearning.endLiveSession(sessionId).catch(() => undefined);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    if (!companion) return cleanup;
    void companion.getEnvironment().then(setCompanionEnvironment);
    void companion.scanGameWindows().then((sources) => { setGameWindows(sources); setSelectedSourceId(sources.find((source) => source.selected)?.id ?? sources[0]?.id ?? null); });
    const removePanicListener = companion.onPanicStop(() => {
      const sessionId = liveSessionIdRef.current;
      liveSessionIdRef.current = null;
      liveCanAdviseRef.current = false;
      captureStartedAtRef.current = null;
      if (sessionId) void finishLiveTrainingSession(sessionId).then(acceptLiveReport).catch(() => undefined);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLiveSessionId(null);
      setCapturing(false);
      setStatus('Captura y overlay detenidos mediante el atajo de emergencia.');
    });
    return () => { removePanicListener(); cleanup(); };
  }, [companion]);
  useEffect(() => {
    if (!companion || !capturing || !liveSessionId) return;
    let cancelled = false;
    let running = false;
    let detector: Awaited<ReturnType<typeof createLiveModeOcr>> | null = null;
    const blockCapture = (reason: string) => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      liveSessionIdRef.current = null;
      liveCanAdviseRef.current = false;
      setLiveSessionId(null);
      setCapturing(false);
      setStatus(reason);
      void companion.clearAdvice();
      void finishLiveTrainingSession(liveSessionId).then(acceptLiveReport).catch(() => undefined);
    };
    const scanMode = async () => {
      if (cancelled || running || !videoRef.current || videoRef.current.readyState < 2) return;
      running = true;
      try {
        if (!detector) {
          setOcrStatus('Preparando OCR local…');
          detector = await createLiveModeOcr((progress) => setOcrStatus((current) => current.startsWith('OCR:') || current.startsWith('Plantilla:') ? current : `Leyendo rótulos del modo… ${Math.round(progress * 100)}%`));
        }
        if (cancelled) return;
        const frame = captureFrame(videoRef.current);
        if (!frame) return;
        const templateMatch = findModeTemplateMatch(frame, liveSessionId, modeTemplates);
        const inspection = await detector.inspect(frame, templateMatch ? [templateMatch.rect] : []);
        const signal = inspection.modeSignal;
        if (signal) {
          setLastOcrSignal(signal);
          const signalKey = `screen_ocr:${signal.detectedGameMode}`;
          if (!isModeSignalReliableForVerification(signal)) {
            setOcrStatus(`OCR: ${signal.detectedGameMode} · confianza ${Math.round(signal.confidence * 100)}%. Puedes preparar el recorte; para verificar la sesión necesita alcanzar el 85%.`);
          } else if (!sentSignalsRef.current.has(signalKey)) {
            sentSignalsRef.current.add(signalKey);
            const verification = await apiClient.playerLearning.verifyLiveMode(liveSessionId, signal.detectedGameMode, { source: 'screen_ocr', confidence: signal.confidence, capturedAt: signal.capturedAt });
            liveCanAdviseRef.current = verification.canAdvise;
            setModeVerification(verification.session.modeVerification);
            if (verification.canAdvise) setVerifiedMode(verification.session.detectedGameMode);
            setOcrStatus(`OCR: ${signal.detectedGameMode} · confianza ${Math.round(signal.confidence * 100)}%. ${verification.reason ?? 'Modo permitido verificado.'}`);
            if (verification.session.status === 'BLOCKED') {
              blockCapture(verification.reason ?? 'Sesión bloqueada por seguridad.');
              return;
            }
          } else {
            setOcrStatus(`OCR: ${signal.detectedGameMode} · confianza ${Math.round(signal.confidence * 100)}% · ya registrado; buscando una plantilla de otra sesión.`);
          }
        } else {
          setOcrStatus('No se encontró un rótulo de modo fiable. El coach permanece en silencio.');
        }
        if (cancelled || !videoRef.current) return;
        if (templateMatch) {
          const templateKey = `screen_template:${templateMatch.template.mode}`;
          if (!sentSignalsRef.current.has(templateKey)) {
            sentSignalsRef.current.add(templateKey);
            const verification = await apiClient.playerLearning.verifyLiveMode(liveSessionId, templateMatch.template.mode, { source: 'screen_template', confidence: templateMatch.confidence, capturedAt: new Date().toISOString() });
            liveCanAdviseRef.current = verification.canAdvise;
            setModeVerification(verification.session.modeVerification);
            if (verification.canAdvise) setVerifiedMode(verification.session.detectedGameMode);
            setOcrStatus(`Plantilla: ${templateMatch.template.mode} · coincidencia ${Math.round(templateMatch.confidence * 100)}%. ${verification.reason ?? 'Modo permitido verificado por dos fuentes.'}`);
            if (verification.session.status === 'BLOCKED') {
              blockCapture(verification.reason ?? 'Las señales visuales son contradictorias; sesión bloqueada.');
              return;
            }
            if (verification.canAdvise) setStatus(`Modo ${templateMatch.template.mode} verificado por OCR y plantilla. El coach ya puede registrar observaciones.`);
          }
        }
        if (liveCanAdviseRef.current) {
          for (const hudSignal of inspection.hudSignals) {
            const previousCapturedAt = recordedHudSignalsRef.current.get(hudSignal.eventType);
            if (!shouldRecordHudSignal(hudSignal, previousCapturedAt)) continue;
            recordedHudSignalsRef.current.set(hudSignal.eventType, hudSignal.capturedAt);
            try {
              const captureStart = captureStartedAtRef.current;
              const result = await apiClient.playerLearning.submitLiveObservation(liveSessionId, {
                ...buildSilentHudObservation(hudSignal),
                gameTime: captureStart == null ? null : Math.max(0, Math.floor((Date.parse(hudSignal.capturedAt) - captureStart) / 1000)),
              });
              if (!cancelled && result.delivery === 'SILENT_REVIEW') setSilentObservationCount((count) => count + 1);
            } catch {
              if (recordedHudSignalsRef.current.get(hudSignal.eventType) === hudSignal.capturedAt) recordedHudSignalsRef.current.delete(hudSignal.eventType);
            }
          }
        }
      } catch {
        setOcrStatus('El OCR local no pudo completar la lectura. El coach permanece en silencio.');
      } finally { running = false; }
    };
    void scanMode();
    const interval = window.setInterval(() => void scanMode(), 8_000);
    return () => { cancelled = true; window.clearInterval(interval); if (detector) void detector.terminate(); };
  }, [capturing, companion, liveSessionId, modeTemplates]);
  async function scanGame() {
    if (!companion) return [];
    setScanning(true);
    try {
      const sources = await companion.scanGameWindows();
      setGameWindows(sources);
      const selected = sources.find((source) => source.selected)?.id ?? sources[0]?.id ?? null;
      setSelectedSourceId(selected);
      if (!sources.length) setStatus('No se detecta Predecessor. Abre el juego y vuelve a buscar.');
      return sources;
    } finally { setScanning(false); }
  }
  async function selectSource(sourceId: string) {
    if (!companion) return false;
    const result = await companion.selectGameWindow(sourceId);
    if (result.selected) {
      setSelectedSourceId(sourceId);
      setGameWindows((sources) => sources.map((source) => ({ ...source, selected: source.id === sourceId })));
    }
    return result.selected;
  }
  async function start() {
    try {
      if (companion) {
        const sources = gameWindows.length ? gameWindows : await scanGame();
        const sourceId = selectedSourceId ?? sources[0]?.id;
        if (!sourceId || !(await selectSource(sourceId))) {
          setStatus('No se puede iniciar: abre Predecessor y selecciona su ventana.');
          return;
        }
      }
      const result = await apiClient.playerLearning.startLiveSession(mode);
      if (result.session.status === 'BLOCKED') { setStatus(result.reason); return; }
      liveSessionIdRef.current = result.session.id;
      setLiveSessionId(result.session.id);
      setLastReport(null);
      setDetectorReadiness(null);
      setSilentObservationCount(0);
      setLastOcrSignal(null);
      setVerifiedMode(null);
      setCalibrationFrameUrl(null);
      setCalibrationRect(null);
      setCalibrationSignal(null);
      setCalibrationStatus('');
      sentSignalsRef.current.clear();
      recordedHudSignalsRef.current.clear();
      liveCanAdviseRef.current = result.canAdvise;
      setModeVerification(result.session.modeVerification);
      setOcrStatus(companion ? 'Esperando el primer fotograma legible…' : 'OCR disponible sólo en el acompañante de escritorio.');
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      captureStartedAtRef.current = Date.now();
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCapturing(true);
      setStatus(companion ? 'Ventana de Predecessor capturada. El coach sigue en silencio hasta verificar automáticamente el modo.' : 'Captura local activa. Consejos desactivados: el modo todavía no ha sido verificado automáticamente.');
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        const sessionId = liveSessionIdRef.current;
        liveSessionIdRef.current = null;
        liveCanAdviseRef.current = false;
        captureStartedAtRef.current = null;
        if (sessionId) void finishLiveTrainingSession(sessionId).then(acceptLiveReport).catch(() => undefined);
        setLiveSessionId(null);
        setCapturing(false);
        setStatus('La ventana dejó de compartirse.');
      });
    } catch (error) {
      const sessionId = liveSessionIdRef.current;
      liveSessionIdRef.current = null;
      liveCanAdviseRef.current = false;
      captureStartedAtRef.current = null;
      if (sessionId) void apiClient.playerLearning.endLiveSession(sessionId).catch(() => undefined);
      setLiveSessionId(null);
      setStatus(error instanceof Error ? error.message : 'No se pudo iniciar la captura');
    }
  }
  function stop() {
    const sessionId = liveSessionIdRef.current;
    liveSessionIdRef.current = null;
    liveCanAdviseRef.current = false;
    captureStartedAtRef.current = null;
    if (sessionId) void finishLiveTrainingSession(sessionId).then(acceptLiveReport).catch(() => undefined);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLiveSessionId(null);
    setCapturing(false);
    setStatus('Captura detenida');
    if (companion) void companion.clearAdvice();
  }
  async function previewOverlay() {
    if (!companion) return;
    const result = await companion.showAdvice({ title: 'Prueba visual del overlay', cue: 'Esta tarjeta no es un consejo de partida.', reason: 'Sirve para comprobar tamaño, posición y legibilidad sin analizar ni alterar el juego.', principle: 'El acompañante sólo mostrará consejos reales después de verificar un modo permitido y reunir evidencia suficiente.', priority: 'NORMAL', durationMs: 8_000 });
    setStatus(result.shown ? 'Prueba visible durante ocho segundos. Ctrl+Shift+F10 la oculta y detiene la captura.' : 'No se pudo mostrar la prueba del overlay.');
  }
  function saveCalibrationFrame() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setStatus('Todavía no hay un fotograma disponible para guardar.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `riftline-calibration-${mode.toLowerCase()}-${canvas.width}x${canvas.height}-${Date.now()}.jpg`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
      setStatus('Muestra guardada localmente. Revísala antes de compartirla: puede contener nombres o chat visibles.');
    }, 'image/jpeg', 0.9);
  }
  function beginTemplateCalibration() {
    const video = videoRef.current;
    if (!isFreshModeSignalForCalibration(lastOcrSignal)) {
      setCalibrationStatus('Espera a una lectura OCR reciente de un modo permitido. El recorte se validará después con un mínimo del 75% de confianza.');
      return;
    }
    const frame = video ? captureFrame(video) : null;
    if (!frame) {
      setCalibrationStatus('Todavía no hay un fotograma nítido para calibrar.');
      return;
    }
    calibrationCanvasRef.current = frame;
    setCalibrationSignal(lastOcrSignal);
    setCalibrationFrameUrl(frame.toDataURL('image/jpeg', 0.88));
    setCalibrationRect(null);
    setCalibrationStatus(`Dibuja un rectángulo ajustado alrededor del texto ${lastOcrSignal.detectedGameMode}.`);
  }
  function calibrationPoint(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = calibrationSurfaceRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }
  function startCalibrationSelection(event: React.PointerEvent<HTMLDivElement>) {
    const point = calibrationPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    selectionStartRef.current = point;
    setCalibrationRect({ ...point, width: 0, height: 0 });
  }
  function updateCalibrationSelection(event: React.PointerEvent<HTMLDivElement>) {
    const startPoint = selectionStartRef.current;
    const point = calibrationPoint(event);
    if (!startPoint || !point) return;
    setCalibrationRect({ x: Math.min(startPoint.x, point.x), y: Math.min(startPoint.y, point.y), width: Math.abs(point.x - startPoint.x), height: Math.abs(point.y - startPoint.y) });
  }
  function endCalibrationSelection(event: React.PointerEvent<HTMLDivElement>) {
    updateCalibrationSelection(event);
    selectionStartRef.current = null;
  }
  async function saveModeTemplate() {
    const frame = calibrationCanvasRef.current;
    const sessionId = liveSessionIdRef.current;
    if (!frame || !sessionId || !calibrationRect || !isUsableTemplateRect(calibrationRect) || !calibrationSignal) {
      setCalibrationStatus('Necesitas capturar primero un fotograma reconocido y dibujar un recorte válido alrededor del rótulo.');
      return;
    }
    const crop = cropFrame(frame, calibrationRect);
    if (!crop) return;
    setCalibrating(true);
    setCalibrationStatus('Comprobando que el recorte contiene realmente el modo…');
    let detector: Awaited<ReturnType<typeof createLiveModeOcr>> | null = null;
    try {
      detector = await createLiveModeOcr();
      const cropSignal = await detector.scan(crop);
      if (!cropSignal || cropSignal.detectedGameMode !== calibrationSignal.detectedGameMode || cropSignal.confidence < 0.75) {
        setCalibrationStatus('El recorte no contiene el mismo rótulo de modo con suficiente claridad. Ajusta el rectángulo al texto y prueba de nuevo.');
        return;
      }
      const template = createModeTemplate(frame, calibrationRect, cropSignal, sessionId);
      if (!template) {
        setCalibrationStatus('La región no tiene contraste suficiente para crear una plantilla fiable.');
        return;
      }
      const nextTemplates = [...modeTemplates, template].slice(-20);
      saveModeTemplates(nextTemplates);
      setModeTemplates(nextTemplates);
      setCalibrationFrameUrl(null);
      setCalibrationRect(null);
      setCalibrationSignal(null);
      setCalibrationStatus(`Plantilla ${template.mode} guardada. No puede validar esta sesión; se comprobará automáticamente en una captura posterior.`);
    } catch {
      setCalibrationStatus('No se pudo validar el recorte con OCR. La plantilla no se ha guardado.');
    } finally {
      if (detector) await detector.terminate();
      setCalibrating(false);
    }
  }
  function removeModeTemplate(templateId: string) {
    const nextTemplates = modeTemplates.filter((template) => template.id !== templateId);
    saveModeTemplates(nextTemplates);
    setModeTemplates(nextTemplates);
  }
  async function createReplayReviewFromReport() {
    if (!lastReport) return;
    setCreatingReplayReview(true);
    try {
      await apiClient.playerLearning.createReplay({
        liveTrainingSessionId: lastReport.modeVerification === 'VERIFIED_ALLOWED' && lastReport.status === 'COMPLETED' ? lastReport.id : null,
        title: `Revisión del entrenamiento · ${lastReport.detectedGameMode ?? lastReport.requestedGameMode}`,
        markers: lastReport.review.reviewMoments.map((moment) => ({
          gameTime: moment.captureTimeSeconds,
          sourceEventId: moment.eventId,
          category: moment.category,
          title: moment.title,
          question: moment.replayQuestion,
        })),
      });
      toast.success(lastReport.review.reviewMoments.length
        ? 'Revisión creada con los momentos detectados. Añade o abre tu grabación para confirmar las causas.'
        : 'Revisión creada sin marcadores. Añade la grabación completa para comprobar si hubo eventos omitidos.');
      onOpenReplay();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la revisión');
    } finally {
      setCreatingReplayReview(false);
    }
  }
  return <div style={{ display: 'grid', gap: '1rem' }}>
    <section style={{ ...card, borderColor: 'rgba(248,113,113,.35)' }}><div style={{ display: 'flex', gap: '.7rem', alignItems: 'center' }}><ShieldAlert color="#f87171"/><div><strong>Ranked nunca está permitido</strong><div style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>La sesión necesita dos señales automáticas coincidentes para reconocer un modo permitido. Una señal fiable de Ranked la bloquea de forma irreversible; ante cualquier duda, no hay consejos.</div></div></div></section>
    {companionEnvironment && <section style={{ ...card, borderColor: 'rgba(56,212,200,.34)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}><div><div style={{ color: 'var(--accent-cyan)', fontSize: '.7rem', fontWeight: 800 }}>ACOMPAÑANTE WINDOWS CONECTADO · v{companionEnvironment.version}</div><strong>Captura limitada a una ventana de Predecessor</strong><p style={{ color: 'var(--text-muted)', fontSize: '.76rem', marginBottom: 0 }}>Atajo de emergencia: {companionEnvironment.panicShortcut}. El overlay ignora el ratón y el teclado; no envía acciones al juego.</p></div><button disabled={scanning || capturing} onClick={() => void scanGame()} style={button}>{scanning ? 'Buscando…' : 'Detectar Predecessor'}</button></div>{gameWindows.length > 0 ? <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', marginTop: '.75rem' }}>{gameWindows.map((source) => <button key={source.id} disabled={capturing} onClick={() => void selectSource(source.id)} style={{ ...button, borderColor: selectedSourceId === source.id ? 'var(--accent-cyan)' : 'var(--border-color)', color: selectedSourceId === source.id ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>{source.name}</button>)}</div> : <p style={{ color: 'var(--text-muted)', fontSize: '.76rem', marginBottom: 0 }}>Predecessor todavía no está abierto o no expone una ventana capturable.</p>}</section>}
    <section style={card}><h3 style={{ marginTop: 0 }}>{companion ? 'Captura privada de Predecessor' : 'Prototipo de captura local'}</h3><p>La selección manual sólo expresa qué esperas jugar: nunca verifica el modo ni habilita coaching. Los detectores automáticos deben confirmarlo antes de que aparezca un consejo real.</p><label style={{ color: 'var(--text-muted)', fontSize: '.74rem' }}>Modo que esperas jugar</label><div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.35rem' }}><select value={mode} onChange={(e) => { setMode(e.target.value); setStatus(e.target.value === 'RANKED' ? 'Bloqueado: RiftLine no inicia captura ni consejos en Ranked.' : 'Sin iniciar'); }} disabled={capturing} style={button}>{['STANDARD','QUICK','ARAM','LABS','PRACTICE','AI','CUSTOM','RANKED'].map((value) => <option key={value}>{value}</option>)}</select>{capturing ? <button onClick={stop} style={button}>Detener captura</button> : <button disabled={rankedSelected} onClick={() => void start()} style={{ ...button, opacity: rankedSelected ? .45 : 1, cursor: rankedSelected ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}><Crosshair size={14}/> {rankedSelected ? 'Bloqueado en Ranked' : companion ? 'Iniciar monitorización' : 'Compartir pantalla'}</button>}{companion && <button disabled={!capturing} onClick={() => void previewOverlay()} style={{ ...button, opacity: capturing ? 1 : .45 }}>Probar tarjeta del overlay</button>}{companion && <button disabled={!capturing} onClick={saveCalibrationFrame} style={{ ...button, opacity: capturing ? 1 : .45 }}>Guardar muestra local</button>}</div><p style={{ color: rankedSelected || status.includes('silencio') || status.includes('desactivados') ? '#fbbf24' : 'var(--text-muted)' }}>{status}</p>{capturing && companion && <div style={{ padding: '.65rem .75rem', marginBottom: '.65rem', borderRadius: 8, background: 'rgba(255,255,255,.025)', color: 'var(--text-muted)', fontSize: '.75rem' }}>{modeVerification === 'VERIFIED_ALLOWED' ? <><strong style={{ color: 'var(--accent-cyan)' }}>Monitorización activa · {verifiedMode ?? mode}</strong><div>Modo permitido confirmado. RiftLine observa señales conservadoras para el informe posterior.</div><small>Esta versión beta todavía no emite consejos reales durante la partida.</small><details style={{ marginTop: '.4rem' }}><summary style={{ cursor: 'pointer' }}>Diagnóstico técnico del detector</summary><div>{ocrStatus}</div></details></> : <><strong style={{ color: '#fbbf24' }}>Preparando monitorización · {modeVerification}</strong><div>{ocrStatus}</div></>}<div>Observaciones guardadas para revisión: {silentObservationCount}</div></div>}<video ref={videoRef} autoPlay muted style={{ width: '100%', maxHeight: 440, background: '#05070b', borderRadius: 8, display: capturing ? 'block' : 'none' }}/></section>
    {companion && <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap', alignItems: 'start' }}>
        <div><div style={{ color: 'var(--accent-violet)', fontSize: '.7rem', fontWeight: 800 }}>SEGUNDA SEÑAL AUTOMÁTICA</div><h3 style={{ margin: '.25rem 0' }}>Calibrar el rótulo del modo</h3><p style={{ color: 'var(--text-muted)', maxWidth: 760, fontSize: '.78rem' }}>Cuando el OCR reconozca un modo permitido, pausa visualmente en ese rótulo, captura el fotograma y dibuja un rectángulo ajustado alrededor del texto. RiftLine volverá a leer sólo ese recorte antes de guardarlo.</p></div>
        <button disabled={!capturing || calibrating || !isFreshModeSignalForCalibration(lastOcrSignal)} onClick={beginTemplateCalibration} style={{ ...button, opacity: capturing && isFreshModeSignalForCalibration(lastOcrSignal) ? 1 : .45 }}>Capturar rótulo para calibrar</button>
      </div>
      {calibrationStatus && <p style={{ color: calibrationStatus.includes('guardada') ? 'var(--accent-cyan)' : '#fbbf24', fontSize: '.76rem' }}>{calibrationStatus}</p>}
      {calibrationFrameUrl && <div style={{ display: 'grid', gap: '.65rem' }}>
        <div ref={calibrationSurfaceRef} onPointerDown={startCalibrationSelection} onPointerMove={updateCalibrationSelection} onPointerUp={endCalibrationSelection} onPointerCancel={() => { selectionStartRef.current = null; }} style={{ position: 'relative', width: '100%', cursor: 'crosshair', touchAction: 'none', userSelect: 'none', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', background: '#05070b' }}>
          <img src={calibrationFrameUrl} alt="Fotograma local para seleccionar el rótulo del modo" draggable={false} style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none' }} />
          {calibrationRect && <div aria-hidden style={{ position: 'absolute', left: `${calibrationRect.x * 100}%`, top: `${calibrationRect.y * 100}%`, width: `${calibrationRect.width * 100}%`, height: `${calibrationRect.height * 100}%`, border: '2px solid var(--accent-cyan)', background: 'rgba(56,212,200,.12)', boxShadow: '0 0 0 9999px rgba(0,0,0,.38)', pointerEvents: 'none' }} />}
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}><button disabled={calibrating || !calibrationRect || !isUsableTemplateRect(calibrationRect)} onClick={() => void saveModeTemplate()} style={{ ...button, opacity: calibrating || !calibrationRect || !isUsableTemplateRect(calibrationRect) ? .45 : 1 }}>{calibrating ? 'Validando recorte…' : `Guardar plantilla ${calibrationSignal?.detectedGameMode ?? ''}`}</button><button disabled={calibrating} onClick={() => { setCalibrationFrameUrl(null); setCalibrationRect(null); setCalibrationSignal(null); }} style={button}>Cancelar</button></div>
      </div>}
      {modeTemplates.length > 0 ? <div style={{ display: 'grid', gap: '.45rem', marginTop: '.8rem' }}>{modeTemplates.map((template) => <div key={template.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '.7rem', alignItems: 'center', padding: '.55rem .65rem', borderRadius: 7, background: 'rgba(255,255,255,.025)' }}><div><strong>{template.mode}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{template.sourceWidth}×{template.sourceHeight} · OCR de calibración {Math.round(template.calibrationOcrConfidence * 100)}% · válida desde otra sesión</small></div><button onClick={() => removeModeTemplate(template.id)} style={{ ...button, color: 'var(--text-muted)' }}>Eliminar</button></div>)}</div> : <p style={{ color: 'var(--text-muted)', fontSize: '.76rem', marginBottom: 0 }}>Aún no hay plantillas. El coach seguirá en silencio aunque el OCR reconozca un modo permitido.</p>}
    </section>}
    {lastReport && <LiveTrainingReportReview report={lastReport} busy={creatingReplayReview} onCreateReplay={() => void createReplayReviewFromReport()} />}
    {detectorReadiness ? <DetectorReadinessPanel readiness={detectorReadiness}/> : capturing ? <section style={card}><strong>Cobertura en evaluación</strong><p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>El resumen de detectores se actualizará al terminar la captura. Durante la partida sólo se muestra el estado de verificación necesario para mantener el sistema en silencio ante cualquier duda.</p></section> : null}
    <section style={card}><h3 style={{ marginTop: 0 }}>Cómo intervendrá el coach</h3><ul style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}><li>No habla durante un combate.</li><li>Como máximo cuatro intervenciones cada diez minutos y nunca repite el mismo concepto en cinco minutos.</li><li>Una observación dudosa se guarda para el informe, pero no interrumpe.</li><li>Cada consejo explica qué señales lo activaron y qué condición podría cambiarlo.</li></ul><p style={{ color: 'var(--text-muted)', fontSize: '.76rem', marginBottom: 0 }}>La Academia distingue las señales declaradas, guiadas y observadas: el overlay no podrá ascenderte por sí solo.</p></section>
  </div>;
}
