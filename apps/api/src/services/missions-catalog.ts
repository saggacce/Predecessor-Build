export type MissionRole = 'COACH' | 'MANAGER' | 'ANALISTA' | 'JUGADOR' | 'PLAYER';

export interface Mission {
  id: string;
  roles: MissionRole[];
  title: Record<'en' | 'es', string>;
  description: Record<'en' | 'es', string>;
  ctaPath: string;
  /** Lower = first in list */
  order: number;
  /** If true, completion is detected server-side from DB state, not via POST /missions/complete */
  autoDetect?: boolean;
}

export const MISSIONS_CATALOG: Mission[] = [
  // ── Shared (all roles) ────────────────────────────────────────────────────────
  {
    id: 'COMPLETE_PROFILE',
    roles: ['COACH', 'MANAGER', 'ANALISTA', 'JUGADOR', 'PLAYER'],
    title: { en: 'Complete your profile', es: 'Completa tu perfil' },
    description: { en: 'Add a bio to tell your team about yourself.', es: 'Añade una bio para que tu equipo sepa quién eres.' },
    ctaPath: '/profile',
    order: 1,
    autoDetect: true,
  },
  {
    id: 'LINK_PREDGG',
    roles: ['COACH', 'MANAGER', 'ANALISTA', 'JUGADOR', 'PLAYER'],
    title: { en: 'Link your pred.gg account', es: 'Vincula tu cuenta de pred.gg' },
    description: { en: 'Connect your pred.gg profile to unlock your personal stats.', es: 'Conecta tu perfil de pred.gg para desbloquear tus estadísticas.' },
    ctaPath: '/profile',
    order: 2,
    autoDetect: true,
  },

  // ── COACH ─────────────────────────────────────────────────────────────────────
  {
    id: 'CREATE_FIRST_SCRIM',
    roles: ['COACH'],
    title: { en: 'Schedule your first scrim', es: 'Programa tu primer scrim' },
    description: { en: 'Create your first scrim or match in the Scrim Planner.', es: 'Crea tu primer scrim o partido en el Planificador.' },
    ctaPath: '/tools/scrims',
    order: 3,
  },
  {
    id: 'CREATE_PLAYBOOK_ENTRY',
    roles: ['COACH'],
    title: { en: 'Create a playbook entry', es: 'Crea una entrada en el Playbook' },
    description: { en: 'Document a tactic or strategy for your team.', es: 'Documenta una táctica o estrategia para tu equipo.' },
    ctaPath: '/tools/playbook',
    order: 4,
  },
  {
    id: 'ADD_RIVAL_PLAYER',
    roles: ['COACH'],
    title: { en: 'Scout a rival player', es: 'Haz scouting de un rival' },
    description: { en: "Add a rival player to an upcoming opponent's lineup.", es: 'Añade un jugador rival al alineación de tu próximo adversario.' },
    ctaPath: '/tools/scrims',
    order: 5,
  },
  {
    id: 'COMPLETE_REVIEW_SESSION',
    roles: ['COACH'],
    title: { en: 'Complete a review session', es: 'Completa una sesión de revisión' },
    description: { en: 'Lead a full review session with your team.', es: 'Lleva a cabo una sesión de revisión completa con tu equipo.' },
    ctaPath: '/tools/review-sessions',
    order: 6,
  },
  {
    id: 'USE_TACTICAL_BOARD',
    roles: ['COACH'],
    title: { en: 'Use the Tactical Board', es: 'Usa el Tablero Táctico' },
    description: { en: 'Draw your first tactical plan on the board.', es: 'Dibuja tu primer plan táctico en el tablero.' },
    ctaPath: '/tools/board',
    order: 7,
  },
  {
    id: 'CHECK_INSIGHTS',
    roles: ['COACH', 'ANALISTA'],
    title: { en: "Check your team's insights", es: 'Revisa los insights de tu equipo' },
    description: { en: 'Review the automated performance insights for your team.', es: 'Consulta los insights automáticos de rendimiento del equipo.' },
    ctaPath: '/analysis/teams',
    order: 8,
  },

  // ── MANAGER ───────────────────────────────────────────────────────────────────
  {
    id: 'ADD_ROSTER_PLAYER',
    roles: ['MANAGER'],
    title: { en: 'Add a player to your roster', es: 'Añade un jugador al roster' },
    description: { en: 'Expand your squad by adding a player.', es: 'Amplía tu plantilla añadiendo un jugador.' },
    ctaPath: '/management/teams',
    order: 3,
  },
  {
    id: 'INVITE_MEMBER',
    roles: ['MANAGER'],
    title: { en: 'Invite a team member', es: 'Invita a un miembro del equipo' },
    description: { en: 'Send an invitation to a player, analyst, or coach.', es: 'Envía una invitación a un jugador, analista o coach.' },
    ctaPath: '/management/teams',
    order: 4,
  },
  {
    id: 'SET_TEAM_GOAL',
    roles: ['MANAGER'],
    title: { en: 'Set a team goal', es: 'Establece un objetivo de equipo' },
    description: { en: 'Define a collective objective for your squad.', es: 'Define un objetivo colectivo para tu equipo.' },
    ctaPath: '/tools/review',
    order: 5,
  },
  {
    id: 'VIEW_TEAM_PERFORMANCE',
    roles: ['MANAGER'],
    title: { en: "Review your team's performance", es: 'Revisa el rendimiento de tu equipo' },
    description: { en: 'Check win rates, form, and key stats for your squad.', es: 'Consulta las victorias, la forma y las stats clave de tu plantilla.' },
    ctaPath: '/analysis/teams',
    order: 6,
  },

  // ── ANALISTA ──────────────────────────────────────────────────────────────────
  {
    id: 'RUN_PLAYER_ANALYSIS',
    roles: ['ANALISTA'],
    title: { en: 'Analyse a player', es: 'Analiza a un jugador' },
    description: { en: "Open a player's scouting report to review their stats.", es: 'Abre el informe de scouting de un jugador para revisar sus stats.' },
    ctaPath: '/analysis/players',
    order: 3,
  },
  {
    id: 'CREATE_REVIEW_ITEM',
    roles: ['ANALISTA'],
    title: { en: 'Create a review item', es: 'Crea un ítem de revisión' },
    description: { en: 'Log a finding from a match into the review queue.', es: 'Registra un hallazgo de un partido en la cola de revisión.' },
    ctaPath: '/tools/review',
    order: 4,
  },
  {
    id: 'COMPLETE_ANALYSIS',
    roles: ['ANALISTA'],
    title: { en: 'Complete your first analysis', es: 'Completa tu primer análisis' },
    description: { en: 'Mark a post-match analysis as done from the Dashboard.', es: 'Marca un análisis post-partido como hecho desde el Dashboard.' },
    ctaPath: '/',
    order: 5,
  },

  // ── JUGADOR en equipo ─────────────────────────────────────────────────────────
  {
    id: 'VIEW_PLAYER_PROFILE',
    roles: ['JUGADOR', 'PLAYER'],
    title: { en: 'View your player profile', es: 'Consulta tu perfil de jugador' },
    description: { en: 'Check your stats, hero pool, and performance trends.', es: 'Revisa tus stats, pool de héroes y tendencias de rendimiento.' },
    ctaPath: '/analysis/players',
    order: 3,
  },
  {
    id: 'SET_WEEKLY_GOAL',
    roles: ['JUGADOR', 'PLAYER'],
    title: { en: 'Set a weekly goal', es: 'Establece un objetivo semanal' },
    description: { en: 'Define a personal training objective for this week.', es: 'Define un objetivo de entrenamiento personal para esta semana.' },
    ctaPath: '/',
    order: 4,
  },
  {
    id: 'VIEW_HERO_POOL',
    roles: ['JUGADOR', 'PLAYER'],
    title: { en: 'Check your hero pool', es: 'Revisa tu pool de héroes' },
    description: { en: 'Review your win rates and performance by hero.', es: 'Consulta tus tasas de victoria y rendimiento por héroe.' },
    ctaPath: '/analysis/players',
    order: 5,
  },
  {
    id: 'VIEW_TEAM_ANALYSIS',
    roles: ['JUGADOR'],
    title: { en: "View your team's performance", es: 'Consulta el rendimiento de tu equipo' },
    description: { en: "Explore your team's collective stats and insights.", es: 'Explora las stats colectivas e insights de tu equipo.' },
    ctaPath: '/analysis/teams',
    order: 6,
  },

  // ── PLAYER standalone ─────────────────────────────────────────────────────────
  {
    id: 'SEARCH_PLAYER',
    roles: ['PLAYER'],
    title: { en: 'Search for a player', es: 'Busca a un jugador' },
    description: { en: 'Look up any Predecessor player using the search tool.', es: 'Encuentra a cualquier jugador de Predecessor con el buscador.' },
    ctaPath: '/analysis/players',
    order: 5,
  },
];

/** Achievement awarded when a user completes all their onboarding missions */
export const ONBOARDING_ACHIEVEMENT_ID = 'FIRST_STEPS';

export function getMissionsForRole(role: MissionRole): Mission[] {
  return MISSIONS_CATALOG
    .filter((m) => m.roles.includes(role))
    .sort((a, b) => a.order - b.order);
}
