import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'react-router';
import { BookOpen, BrainCircuit, CheckCircle2, Crosshair, Film, Loader, MonitorPlay, Search, ShieldAlert, Target } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiClient,
  type EncyclopediaEntry,
  type LearningQuestionView,
  type MissionRecommendation,
  type PlayerLearningProfile,
  type PlacementSummary,
  type PlayerReplaySession,
  type PlayerTrainingCycle,
} from '../api/client';

type AcademyTab = 'path' | 'diagnostic' | 'knowledge' | 'replay' | 'live';

const card: CSSProperties = { padding: '1.1rem', border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-card)' };
const button: CSSProperties = { border: '1px solid var(--border-color)', borderRadius: 7, padding: '0.55rem 0.8rem', color: 'var(--text-primary)', background: 'rgba(255,255,255,.035)', cursor: 'pointer' };

function percent(value: number) { return `${Math.round(value * 100)}%`; }

export default function PlayerAcademyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<AcademyTab>(() => searchParams.get('onboarding') === '1' ? 'diagnostic' : 'path');
  const [profile, setProfile] = useState<PlayerLearningProfile | null>(null);
  const [mission, setMission] = useState<MissionRecommendation | null>(null);
  const [cycles, setCycles] = useState<PlayerTrainingCycle[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [profileResult, cycleResult] = await Promise.all([apiClient.playerLearning.profile(), apiClient.playerLearning.cycles()]);
    setProfile(profileResult.profile); setMission(profileResult.recommendation); setCycles(cycleResult.cycles);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([apiClient.playerLearning.profile(), apiClient.playerLearning.cycles()])
      .then(([profileResult, cycleResult]) => {
        if (cancelled) return;
        setProfile(profileResult.profile); setMission(profileResult.recommendation); setCycles(cycleResult.cycles);
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
      {tab === 'knowledge' && <Knowledge />}
      {tab === 'replay' && <ReplayReview />}
      {tab === 'live' && <LocalTraining />}
    </div>
  );
}

function LearningPath({ profile, mission, cycles, onChanged }: { profile: PlayerLearningProfile; mission: MissionRecommendation | null; cycles: PlayerTrainingCycle[]; onChanged: () => Promise<void> }) {
  const active = cycles.find((cycle) => cycle.status === 'ACTIVE');
  const [placementSummary, setPlacementSummary] = useState<PlacementSummary | null>(null);
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
  return <div style={{ display: 'grid', gap: '1rem' }}>
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div><div style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>NIVEL PEDAGÓGICO {profile.overallLevel}</div><h2 style={{ margin: '.2rem 0' }}>{profile.overallLevelLabel}</h2>{placementSummary && <div style={{ color: 'var(--accent-cyan)', marginBottom: '.2rem' }}>Conocimiento diagnosticado: {placementSummary.band.label}</div>}<div style={{ color: 'var(--text-muted)' }}>Confianza de la evaluación: {percent(profile.confidence)} · {profile.placementStatus === 'PROVISIONAL' ? 'resultado provisional' : 'en construcción'}</div></div>
        <label style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Rol principal<br/><select value={profile.activeRole ?? ''} onChange={async (event) => { await apiClient.playerLearning.updateProfile((event.target.value || null) as PlayerLearningProfile['activeRole']); await onChanged(); }} style={{ ...button, marginTop: '.3rem' }}><option value="">Aún no definido</option>{['CARRY','SUPPORT','MIDLANE','JUNGLE','OFFLANE'].map((role) => <option key={role}>{role}</option>)}</select></label>
      </div>
    </section>
    <section style={{ ...card, display: 'grid', gap: '.7rem' }}><h3 style={{ margin: 0 }}>Competencias</h3>{profile.competencies.map((item) => <div key={item.key}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem' }}><span>{item.label} <small style={{ color: 'var(--text-muted)' }}>· {item.levelLabel}</small></span><span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{item.evidenceCount} evidencias</span></div><div style={{ height: 7, background: 'rgba(255,255,255,.06)', borderRadius: 8, marginTop: 5 }}><div style={{ width: percent(item.mastery), height: '100%', background: 'var(--accent-cyan)', borderRadius: 8 }} /></div></div>)}</section>
    <section style={card}><h3 style={{ marginTop: 0 }}>{active ? 'Misión activa' : 'Siguiente misión recomendada'}</h3>{active ? <><strong>{active.title}</strong><p>{active.cue}</p><div style={{ color: 'var(--text-muted)' }}>{active.matchesPlayed}/{active.targetMatches} partidas observadas. Completar partidas no aprueba por sí solo la misión: después debes revisar la evidencia.</div></> : mission ? <><div style={{ color: 'var(--accent-violet)', fontSize: '.75rem' }}>{mission.competencyLabel}</div><strong>{mission.title}</strong><p>{mission.cue}</p><ul>{mission.replayChecks.map((check) => <li key={check}>{check}</li>)}</ul><button style={button} onClick={startMission}>Iniciar misión de {mission.targetMatches} partidas</button></> : null}</section>
  </div>;
}

function Diagnostic({ profile, onChanged, onFinished }: { profile: PlayerLearningProfile; onChanged: () => Promise<void>; onFinished: () => void }) {
  const [questions, setQuestions] = useState<LearningQuestionView[]>([]); const [index, setIndex] = useState(0); const [feedback, setFeedback] = useState<{ feedback: string; principle: string } | null>(null); const [busy, setBusy] = useState(false);
  const [answeredBeforeVisit, setAnsweredBeforeVisit] = useState(0);
  const [total, setTotal] = useState(20); const [summary, setSummary] = useState<PlacementSummary | null>(null);
  const [promotion, setPromotion] = useState<{ eligible: boolean; reason?: string; competency?: { label: string }; question?: LearningQuestionView } | null>(null); const [promotionAnswered, setPromotionAnswered] = useState(false);
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
  if (summary) return <section style={{ ...card, maxWidth: 860 }}>
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
    <button style={button} onClick={onFinished}>Ver mi ruta personalizada</button>
  </section>;
  const isPromotion = index >= questions.length && !!promotion?.eligible && !!promotion.question && !promotionAnswered;
  const current = questions[index] ?? (isPromotion ? promotion?.question : undefined);
  if (!current) return <section style={card}><CheckCircle2 color="var(--accent-cyan)"/><h3>Diagnóstico recorrido</h3><p>Ya has contestado esta ronda. Es una estimación provisional; tu nivel se confirmará con misiones y revisiones reales.</p><p style={{ color: 'var(--text-muted)' }}><strong>Prueba de ascenso:</strong> {promotion?.reason ?? 'La siguiente prueba aparecerá cuando una misión y varias evidencias demuestren consistencia.'}</p><button style={button} onClick={onFinished}>Ver mi ruta personalizada</button></section>;
  async function answer(optionId: string) {
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
    {!feedback ? <div style={{ display: 'grid', gap: '.55rem' }}>{current.options.map((option) => <button disabled={busy} key={option.id} style={{ ...button, textAlign: 'left', lineHeight: 1.4, opacity: busy ? .65 : 1 }} onClick={() => void answer(option.id)}>{option.text}</button>)}</div> : <div style={{ padding: '1rem', borderLeft: '3px solid var(--accent-cyan)', background: 'rgba(56,212,200,.06)' }}><strong>Qué aprender de la respuesta</strong><p>{feedback.feedback}</p><p style={{ color: 'var(--accent-cyan)' }}>{feedback.principle}</p><button style={button} onClick={() => { setFeedback(null); setPromotionAnswered(true); }}>Finalizar prueba</button></div>}
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

function ReplayReview() {
  const [sessions, setSessions] = useState<PlayerReplaySession[]>([]); const [title, setTitle] = useState('Mi revisión'); const [url, setUrl] = useState('');
  const load = () => apiClient.playerLearning.replays().then((result) => setSessions(result.sessions)); useEffect(() => { load().catch(() => toast.error('No se pudieron cargar los replays')); }, []);
  async function create() { try { await apiClient.playerLearning.createReplay({ title, recordingUrl: url || null }); setUrl(''); await load(); toast.success('Revisión creada'); } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo crear'); } }
  return <div style={{ display: 'grid', gap: '1rem' }}><section style={card}><h3 style={{ marginTop: 0 }}>Revisa causas, no sólo resultados</h3><p style={{ color: 'var(--text-muted)' }}>La API puede señalar cuándo mirar. El vídeo permite confirmar visión disponible, movimiento, intención y alternativas. La grabación sigue siendo personal y no entra en las sesiones de equipo.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '.5rem' }}><input value={title} onChange={(e) => setTitle(e.target.value)} style={button}/><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL privada o local servida por ti (opcional)" style={button}/><button onClick={() => void create()} style={button}>Crear revisión</button></div></section>{sessions.map((session) => <section key={session.id} style={card}><strong>{session.title}</strong><div style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{session.status} · {session.markers.length} momentos</div>{session.recordingUrl && <a href={session.recordingUrl} target="_blank" rel="noreferrer">Abrir grabación</a>}{session.markers.map((marker) => <div key={marker.id} style={{ marginTop: '.6rem' }}><b>{Math.floor(marker.gameTime/60)}:{String(marker.gameTime%60).padStart(2,'0')} · {marker.title}</b><p>{marker.question}</p></div>)}</section>)}</div>;
}

function LocalTraining() {
  const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null); const [mode, setMode] = useState('STANDARD'); const [status, setStatus] = useState('Sin iniciar'); const [capturing, setCapturing] = useState(false);
  const rankedSelected = mode === 'RANKED';
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  async function start() { try { const result = await apiClient.playerLearning.startLiveSession(mode); if (result.session.status === 'BLOCKED') { setStatus(result.reason); return; } const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream; setCapturing(true); setStatus('Captura local activa. Consejos desactivados: el modo todavía no ha sido verificado automáticamente.'); stream.getVideoTracks()[0]?.addEventListener('ended', () => setCapturing(false)); } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo iniciar la captura'); } }
  function stop() { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCapturing(false); setStatus('Captura detenida'); }
  return <div style={{ display: 'grid', gap: '1rem' }}><section style={{ ...card, borderColor: 'rgba(248,113,113,.35)' }}><div style={{ display: 'flex', gap: '.7rem', alignItems: 'center' }}><ShieldAlert color="#f87171"/><div><strong>Ranked nunca está permitido</strong><div style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>Herramienta personal, local, sin memoria del juego, inyección, automatización ni uso de equipo. Ante duda sobre el modo, falla cerrada y no da consejos.</div></div></div></section><section style={card}><h3 style={{ marginTop: 0 }}>Prototipo de captura local</h3><p>Esta fase demuestra permiso y captura de pantalla. No ofrece todavía coaching en vivo: falta un detector automático fiable del modo y autorización de Omeda antes de distribuirlo.</p><div style={{ display: 'flex', gap: '.5rem' }}><select value={mode} onChange={(e) => { setMode(e.target.value); setStatus(e.target.value === 'RANKED' ? 'Bloqueado: RiftLine no inicia captura ni consejos en Ranked.' : 'Sin iniciar'); }} disabled={capturing} style={button}>{['STANDARD','QUICK','ARAM','LABS','PRACTICE','AI','CUSTOM','RANKED'].map((value) => <option key={value}>{value}</option>)}</select>{capturing ? <button onClick={stop} style={button}>Detener captura</button> : <button disabled={rankedSelected} onClick={() => void start()} style={{ ...button, opacity: rankedSelected ? .45 : 1, cursor: rankedSelected ? 'not-allowed' : 'pointer' }}><Crosshair size={14}/> {rankedSelected ? 'Bloqueado en Ranked' : 'Compartir pantalla'}</button>}</div><p style={{ color: rankedSelected || status.includes('desactivados') ? '#fbbf24' : 'var(--text-muted)' }}>{status}</p><video ref={videoRef} autoPlay muted style={{ width: '100%', maxHeight: 440, background: '#05070b', borderRadius: 8, display: capturing ? 'block' : 'none' }}/></section></div>;
}
