import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Link, useLocation, useNavigate } from 'react-router';
import { Toaster, toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Film, BarChart2, Wrench, FileText, Users, Settings,
  LogIn, LogOut, Loader, Radio, Zap, ChevronDown, ChevronRight,
  LayoutDashboard, KeyRound, Presentation,
} from 'lucide-react';
import type { VersionRecord } from '@predecessor/data-model';
import Dashboard from './pages/Dashboard';
import PlayerScouting from './pages/PlayerScouting';
import TeamAnalysis from './pages/TeamAnalysis';
import ScrimReport from './pages/ScrimReport';
import MatchDetail from './pages/MatchDetail';
import ReviewQueue from './pages/ReviewQueue';
import MatchList from './pages/MatchList';
import ComingSoon from './pages/ComingSoon';
import VodIndex from './pages/VodIndex';
import RivalScouting from './pages/RivalScouting';
import Login from './pages/Login';
import Register from './pages/Register';
import Unauthorized from './pages/Unauthorized';
import TeamManagement from './pages/TeamManagement';
import DataQualityPage from './pages/DataQualityPage';
import AuditLogsPage from './pages/AuditLogsPage';
import InvitationsAdminPage from './pages/InvitationsAdminPage';
import PlayerMatchesPage from './pages/PlayerMatchesPage';
import PlayerWeeklyReportPage from './pages/PlayerWeeklyReportPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import ApiStatusPage from './pages/ApiStatusPage';
import ConfigPage from './pages/ConfigPage';
import FeedbackPage from './pages/FeedbackPage';
import PermissionsPage from './pages/PermissionsPage';
import { FeedbackButton } from './components/FeedbackButton';
import { PermissionsProvider } from './contexts/PermissionsContext';
import LandingPage from './pages/LandingPage';
import ScrimPlanner from './pages/ScrimPlanner';
import SessionMode from './pages/SessionMode';
import TacticalBoard from './pages/TacticalBoard';
import Playbook from './pages/Playbook';
import ReviewSessions from './pages/ReviewSessions';
import { useAuth } from './hooks/useAuth';
import { ViewAsProvider, useViewAs, type ViewAsRole } from './hooks/useViewAs';
import { WorkspaceModeProvider, useWorkspaceMode } from './hooks/useWorkspaceMode';
import { apiClient } from './api/client';
import { LanguageFirstTimeModal, shouldShowLanguageModal } from './components/LanguageSwitcher';
import i18n, { isSupportedLanguage } from './i18n';
import './App.css';

// ── Workspace header ──────────────────────────────────────────────────────────

function WorkspaceHeader() {
  const { authenticated, user, refreshInternalSession } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mode, setMode } = useWorkspaceMode();

  async function handleInternalLogout() {
    try {
      await apiClient.auth.internalLogout();
      window.location.reload();
    } catch {
      toast.error(t('common.error'));
    }
  }
  const [latestPatch, setLatestPatch] = useState<VersionRecord | null>(null);
  const isAdmin = user?.globalRole === 'PLATFORM_ADMIN';

  useEffect(() => {
    void apiClient.patches.latest()
      .then(setLatestPatch)
      .catch(() => setLatestPatch(null));

    const onVersionsSync = () => {
      void apiClient.patches.latest().then(setLatestPatch).catch(() => null);
    };
    window.addEventListener('versions-synced', onVersionsSync);
    return () => window.removeEventListener('versions-synced', onVersionsSync);
  }, []);

  const isStaff = isAdmin || (user?.memberships?.some((m) => m.role === 'COACH' || m.role === 'MANAGER') ?? false);

  const initials = user?.name
    ? user.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="workspace-header" aria-label="Workspace status">
      {/* Left — only shown for admins */}
      {isAdmin ? (
        <div>
          <div className="workspace-title">{t('workspace.title')}</div>
          <div className="workspace-subtitle">{t('workspace.subtitle')}</div>
        </div>
      ) : (
        <div />
      )}

      <div className="workspace-meta">
        {user?.linkedPlayerId && (user.memberships?.length ?? 0) > 0 && user.globalRole !== 'PLATFORM_ADMIN' && (
          <div role="group" aria-label="Espacio de trabajo" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 7, border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.025)' }}>
            <button type="button" onClick={() => { setMode('player'); navigate('/'); }} style={{ padding: '0.24rem 0.5rem', border: 0, borderRadius: 5, background: mode === 'player' ? 'rgba(56,212,200,0.14)' : 'transparent', color: mode === 'player' ? 'var(--accent-cyan)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 750 }}>Jugador</button>
            <button type="button" onClick={() => { setMode('team'); navigate('/'); }} style={{ padding: '0.24rem 0.5rem', border: 0, borderRadius: 5, background: mode !== 'player' ? 'rgba(167,139,250,0.14)' : 'transparent', color: mode !== 'player' ? 'var(--accent-violet)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 750 }}>Equipo</button>
          </div>
        )}
        {/* View As role selector — admin only */}
        {isAdmin && (
          <ViewAsSelector />
        )}

        {/* Session Mode button — COACH / MANAGER / ADMIN */}
        {isStaff && (
          <button
            onClick={() => navigate('/session')}
            title="Modo Sesión — vista de proyección para sesiones de equipo"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: 5, cursor: 'pointer', color: 'var(--accent-violet)',
              padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.2)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.1)'; }}
          >
            <Presentation size={13} /> Sesión
          </button>
        )}

        {/* Patch badge — everyone */}
        {latestPatch && (
          <div className="workspace-chip">
            <Zap size={13} />
            Catálogo v{latestPatch.name}
          </div>
        )}

        {/* pred.gg status — admins only, click to connect via OAuth */}
        {isAdmin && (
          <a
            href="/api/auth/predgg"
            className={`workspace-chip ${authenticated ? 'connected' : ''}`}
            style={{ textDecoration: 'none', cursor: 'pointer' }}
            title={authenticated ? t('workspace.predggTooltipConnected') : t('workspace.predggTooltipDisconnected')}
          >
            <Radio size={13} />
            {authenticated ? t('workspace.predggConnected') : t('workspace.predggDisconnected')}
          </a>
        )}

        {/* User chip with avatar + logout */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Link to="/profile" style={{ textDecoration: 'none' }}>
              <div className="workspace-chip connected" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.55rem 0.2rem 0.2rem' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: 'rgba(167,139,250,0.25)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)' }}>{initials}</span>
                  }
                </div>
                {user.name}
              </div>
            </Link>
            <button
              onClick={handleInternalLogout}
              title={t('common.logout')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', transition: 'color 0.15s, border-color 0.15s' }}
              onMouseEnter={(e) => { const b = e.currentTarget; b.style.color = 'var(--accent-loss)'; b.style.borderColor = 'rgba(248,113,113,0.4)'; }}
              onMouseLeave={(e) => { const b = e.currentTarget; b.style.color = 'var(--text-muted)'; b.style.borderColor = 'var(--border-color)'; }}
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ── Sidebar section ───────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
}

interface SidebarSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  to?: string;           // single link (no subsections)
  items?: NavItem[];     // collapsible subsections
  defaultOpen?: boolean;
}

interface SidebarSectionProps {
  section: SidebarSection;
  isOpen: boolean;
  onToggle: () => void;
  badgeCount?: number;
}

function SidebarSectionEl({ section, isOpen, onToggle, badgeCount = 0 }: SidebarSectionProps) {
  const location = useLocation();

  const isActive = section.to
    ? (section.to === '/' ? location.pathname === '/' : location.pathname.startsWith(section.to))
    : section.items?.some((item) => location.pathname.startsWith(item.to)) ?? false;

  if (section.to) {
    return (
      <NavLink
        to={section.to}
        end={section.to === '/'}
        className={({ isActive: a }) => `nav-link${a ? ' active' : ''}`}
      >
        {section.icon}
        <span>{section.label}</span>
      </NavLink>
    );
  }

  return (
    <div className="nav-section">
      <button
        className={`nav-section-header${isActive ? ' active' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="nav-section-icon">{section.icon}</span>
        <span className="nav-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{section.label}{badgeCount > 0 && <span style={{ fontSize: '0.55rem', fontWeight: 800, background: 'var(--accent-loss)', color: '#fff', borderRadius: 999, padding: '1px 5px', lineHeight: 1.5 }}>{badgeCount}</span>}</span>
        <span className="nav-section-chevron">
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>
      {isOpen && (
        <div className="nav-section-items">
          {section.items?.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: a }) => `nav-sublink${a ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function useSections(t: (key: string) => string): SidebarSection[] {
  const { user } = useAuth();
  const { viewAs } = useViewAs();
  const { mode } = useWorkspaceMode();
  const effectiveRole = viewAs ?? user?.globalRole;
  const hasTeam = viewAs
    ? ['MANAGER', 'COACH', 'ANALISTA', 'JUGADOR'].includes(viewAs)
    : (user?.memberships?.length ?? 0) > 0;
  const isStandalonePlayer = !!user && (
    (mode === 'player' && effectiveRole !== 'PLATFORM_ADMIN')
    ||
    effectiveRole === 'PLAYER'
    || (!hasTeam && effectiveRole !== 'PLATFORM_ADMIN' && effectiveRole !== 'MANAGER')
  );

  if (isStandalonePlayer) {
    return [
      {
        id: 'dashboard',
        label: t('nav.playerHome'),
        icon: <LayoutDashboard size={17} />,
        to: '/',
      },
      {
        id: 'player-coach',
        label: t('nav.playerCoach'),
        icon: <FileText size={17} />,
        to: '/reports/weekly',
      },
      {
        id: 'matches',
        label: t('nav.playerMatches'),
        icon: <Film size={17} />,
        to: '/player/matches',
      },
      {
        id: 'profile',
        label: t('nav.playerProfile'),
        icon: <Settings size={17} />,
        to: '/profile',
      },
    ];
  }

  return [
    {
      id: 'dashboard',
      label: t('nav.dashboard'),
      icon: <LayoutDashboard size={17} />,
      to: '/',
    },
    {
      id: 'management',
      label: t('nav.management'),
      icon: <Users size={17} />,
      items: [
        { to: '/management/teams', label: t('nav.teamsRoster') },
      ],
    },
    {
      id: 'matches',
      label: t('nav.matches'),
      icon: <Film size={17} />,
      to: '/matches',
    },
    {
      id: 'analysis',
      label: t('nav.analysis'),
      icon: <BarChart2 size={17} />,
      defaultOpen: true,
      items: [
        { to: '/analysis/teams', label: t('nav.teamAnalysis') },
        { to: '/analysis/players', label: t('nav.playerScouting') },
        { to: '/analysis/rival', label: t('nav.rivalScouting') },
        { to: '/analysis/draft', label: 'Draft Analysis' },
      ],
    },
    {
      id: 'tools',
      label: 'Team Tools',
      icon: <Wrench size={17} />,
      items: [
        { to: '/tools/review', label: t('nav.reviewQueue') },
        { to: '/tools/vod', label: t('nav.vodIndex') },
        { to: '/tools/board', label: 'Tactical Board' },
        { to: '/tools/scrims', label: 'Scrim Planner' },
        { to: '/tools/playbook', label: 'Playbook' },
        { to: '/tools/review-sessions', label: 'Review Sessions' },
      ],
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <FileText size={17} />,
      items: [
        { to: '/reports/scrim', label: t('nav.scrimReport') },
        { to: '/reports/weekly', label: 'Weekly Reports' },
        { to: '/reports/players', label: 'Player Development' },
      ],
    },
    {
      id: 'admin',
      label: t('nav.platformAdmin'),
      icon: <Settings size={17} />,
      items: [
        { to: '/admin/users', label: t('nav.users') },
        { to: '/admin/invitations', label: t('nav.invitations') },
        { to: '/admin/data-quality', label: t('nav.dataQuality') },
        { to: '/management/roles', label: t('nav.rolesPermissions') },
        { to: '/admin/api-status', label: t('nav.apiStatus') },
        { to: '/admin/audit-logs', label: t('nav.auditLogs') },
        { to: '/admin/config', label: t('nav.config') },
        { to: '/admin/feedback', label: t('nav.feedback') },
      ],
    },
  ];
}

function Sidebar() {
  const { authenticated, loading, user, internalLoading } = useAuth();
  const { viewAs } = useViewAs();
  const { mode } = useWorkspaceMode();
  const location = useLocation();
  const { t } = useTranslation();
  const sections = useSections(t);
  const [feedbackUnread, setFeedbackUnread] = useState(0);

  // Load unread feedback count for platform admins
  useEffect(() => {
    if (!user || user.globalRole !== 'PLATFORM_ADMIN') return;
    apiClient.feedback.unreadCount()
      .then(({ count }) => setFeedbackUnread(count))
      .catch(() => null);
  }, [user, location.pathname]); // refresh when navigating away from feedback page

  // Accordion: only one section open at a time
  const getInitialOpen = () => {
    const active = sections.find((s) =>
      s.items?.some((item) => location.pathname.startsWith(item.to))
    );
    return active?.id ?? sections.find((s) => s.defaultOpen)?.id ?? null;
  };

  const [openSection, setOpenSection] = useState<string | null>(getInitialOpen);

  // Auto-open section when navigating to a route inside it
  useEffect(() => {
    const active = sections.find((s) =>
      s.items?.some((item) => location.pathname.startsWith(item.to))
    );
    if (active) setOpenSection(active.id);
  }, [location.pathname]);

  async function handlePredggLogout() {
    try {
      await apiClient.auth.logout();
      window.location.reload();
    } catch {
      toast.error('Logout failed');
    }
  }

  async function handleInternalLogout() {
    try {
      await apiClient.auth.internalLogout();
      window.location.reload();
    } catch {
      toast.error('Logout failed');
    }
  }

  const primaryMembership = user?.memberships[0] ?? null;
  const roleLabel = user?.globalRole === 'PLATFORM_ADMIN'
    ? 'PLATFORM_ADMIN'
    : primaryMembership?.role ?? user?.globalRole;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <img src="/favicon.svg" alt="" />
          </div>
          <div>
<div className="logo-name">RiftLine</div>
            <div className="sidebar-subtitle">Aprendizaje competitivo</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections
          .filter((section) => {
            const effectiveRole = viewAs ?? user?.globalRole;
            const isPlayer = effectiveRole === 'PLAYER';
            const hasTeam = viewAs ? ['MANAGER','COACH','ANALISTA','JUGADOR'].includes(viewAs) : (user?.memberships?.length ?? 0) > 0;
            const isStandalone = (mode === 'player' && effectiveRole !== 'PLATFORM_ADMIN') || isPlayer || (!hasTeam && effectiveRole !== 'PLATFORM_ADMIN');
            if (section.id === 'admin') return !viewAs && user?.globalRole === 'PLATFORM_ADMIN';
            if (['tools', 'management'].includes(section.id) && isStandalone) return false;
            return true;
          })
          .map((section) => {
            const effectiveRole = viewAs ?? user?.globalRole;
            const isPlayer = effectiveRole === 'PLAYER';
            const hasTeam = viewAs ? ['MANAGER','COACH','ANALISTA','JUGADOR'].includes(viewAs) : (user?.memberships?.length ?? 0) > 0;
            const isStandalone = (mode === 'player' && effectiveRole !== 'PLATFORM_ADMIN') || isPlayer || (!hasTeam && effectiveRole !== 'PLATFORM_ADMIN');
            const filteredSection = isStandalone && section.items ? {
              ...section,
              items: section.id === 'analysis'
                ? section.items.filter((i) => i.to.startsWith('/analysis/players'))
                : section.id === 'reports'
                ? section.items.filter((i) => i.to.includes('player') || i.to.includes('weekly'))
                : section.items,
            } : section;
            return (
              <SidebarSectionEl
                key={section.id}
                section={filteredSection}
                isOpen={openSection === section.id}
                onToggle={() => setOpenSection((prev) => prev === section.id ? null : section.id)}
                badgeCount={section.id === 'admin' && feedbackUnread > 0 ? feedbackUnread : 0}
              />
            );
          })}
      </nav>

      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
        <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          Datos de partidas y jugadores:{' '}
          <a href="https://pred.gg" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>pred.gg</a>
          {' '}·{' '}
          <a href="https://omeda.city" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>omeda.city</a>
        </p>
      </div>

    </aside>
  );
}

// ── Weekly Reports — role-aware ───────────────────────────────────────────────
function WeeklyReportsPage() {
  const { user } = useAuth();
  const { viewAs } = useViewAs();
  const { mode } = useWorkspaceMode();
  const hasTeam = (user?.memberships?.length ?? 0) > 0;
  const isStandalonePlayer = (mode === 'player' && user?.globalRole !== 'PLATFORM_ADMIN') || viewAs === 'PLAYER' || user?.globalRole === 'PLAYER' || (!hasTeam && user?.globalRole !== 'PLATFORM_ADMIN');

  if (isStandalonePlayer) {
    return <PlayerWeeklyReportPage />;
  }

  return (
    <ComingSoon
      section="Weekly Team Reports"
      description="Aggregated weekly performance summary for the coaching staff."
    />
  );
}


// ── View As Role selector (admin only) ───────────────────────────────────────
const VIEW_AS_OPTIONS: Array<{ value: ViewAsRole; label: string; color: string }> = [
  { value: null,       label: 'Admin (real)',  color: 'var(--accent-teal-bright)' },
  { value: 'MANAGER',  label: 'Manager',       color: 'var(--accent-blue)' },
  { value: 'COACH',    label: 'Coach',         color: 'var(--accent-violet)' },
  { value: 'ANALISTA', label: 'Analista',      color: 'var(--accent-prime)' },
  { value: 'JUGADOR',  label: 'Jugador',       color: '#7fd66b' },
  { value: 'PLAYER',   label: 'Player (solo)', color: 'var(--accent-loss)' },
];

function ViewAsSelector() {
  const { viewAs, setViewAs } = useViewAs();
  const { t } = useTranslation();
  const current = VIEW_AS_OPTIONS.find(o => o.value === viewAs) ?? VIEW_AS_OPTIONS[0];

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('workspace.viewAs')}:</span>
      <select
        value={viewAs ?? ''}
        onChange={(e) => setViewAs((e.target.value || null) as ViewAsRole)}
        style={{
          padding: '0.18rem 0.5rem',
          background: viewAs ? `${current.color}18` : 'transparent',
          border: `1px solid ${viewAs ? current.color + '55' : 'var(--border-color)'}`,
          borderRadius: 5,
          color: current.color,
          fontSize: '0.68rem',
          fontWeight: 700,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {VIEW_AS_OPTIONS.map(o => (
          <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <PermissionsProvider>
        <ViewAsProvider>
          <WorkspaceModeProvider>
            <AppContent />
            <Toaster position="bottom-right" theme="dark" richColors closeButton />
          </WorkspaceModeProvider>
        </ViewAsProvider>
      </PermissionsProvider>
    </BrowserRouter>
  );
}

function AppContent() {
  const { internalAuthenticated, internalLoading, user } = useAuth();
  const location = useLocation();
  const [showLangModal, setShowLangModal] = useState(false);

  // Apply DB language preference when user loads
  useEffect(() => {
    if (!user?.language) return;
    const lang = user.language;
    if (isSupportedLanguage(lang) && lang !== i18n.language) {
      void i18n.changeLanguage(lang);
    }
    if (shouldShowLanguageModal(user.language)) {
      setShowLangModal(true);
    }
  }, [user?.language]);

  // Holographic hover — update --mouse-x/y on every .glass-card
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const target = (e.target as Element).closest('.glass-card') as HTMLElement | null;
      if (!target) return;
      const r = target.getBoundingClientRect();
      target.style.setProperty('--mouse-x', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
      target.style.setProperty('--mouse-y', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
    }
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMouseMove);
  }, []);

  // While checking auth: render nothing to avoid flash of wrong content
  if (internalLoading) return null;

  // Unauthenticated: show landing/login/register without sidebar
  if (!internalAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register/:token" element={<Register />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    );
  }

  // Session mode renders fullscreen without sidebar/header
  if (location.pathname === '/session') {
    return <SessionMode />;
  }

  return (
      <div className="app-container">
        {showLangModal && <LanguageFirstTimeModal onDismiss={() => setShowLangModal(false)} />}
        <Sidebar />
        <FeedbackButton />
        <main className="main-content">
          <WorkspaceHeader />
          <Routes>
            {/* Dashboard */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register/:token" element={<Register />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Matches */}
            <Route path="/matches" element={<MatchList />} />
            <Route path="/matches/:id" element={<MatchDetail />} />
            <Route path="/matches/live/:predggUuid" element={<MatchDetail liveMode />} />
            <Route path="/player/matches" element={<PlayerMatchesPage />} />

            {/* Analysis */}
            <Route path="/analysis/teams" element={<TeamAnalysis />} />
            <Route path="/analysis/players" element={<PlayerScouting />} />
            <Route path="/analysis/draft" element={<ComingSoon section="Draft Analysis" description="Pick rates, ban rates, hero pool depth, comfort scores and hero overlap — coming soon." issue={79} />} />
            <Route path="/analysis/rival" element={<RivalScouting />} />

            {/* Team Tools */}
            <Route path="/tools/review" element={<ReviewQueue />} />
            <Route path="/tools/goals" element={<Navigate to="/tools/review" replace />} />
            <Route path="/tools/board" element={<TacticalBoard />} />
            <Route path="/tools/playbook" element={<Playbook />} />
            <Route path="/tools/review-sessions" element={<ReviewSessions />} />
            <Route path="/tools/vod" element={<VodIndex />} />
            <Route path="/tools/scrims" element={<ScrimPlanner />} />

            {/* Reports */}
            <Route path="/reports/scrim" element={<ScrimReport />} />
            <Route path="/reports/weekly" element={<WeeklyReportsPage />} />
            <Route path="/reports/players" element={<ComingSoon section="Player Development Reports" description="Individual player progress reports over time." />} />
            <Route path="/reports/rival" element={<Navigate to="/analysis/rival" replace />} />

            {/* Team Management */}
            <Route path="/management/teams" element={<TeamManagement />} />
            <Route path="/management/teams/:id" element={<TeamManagement />} />
            <Route path="/management/staff" element={<Navigate to="/management/teams" replace />} />

            {/* Platform Admin */}
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin/data-quality" element={<DataQualityPage />} />
            <Route path="/admin/config" element={<ConfigPage />} />
            <Route path="/admin/api-status" element={<ApiStatusPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route path="/admin/invitations" element={<InvitationsAdminPage />} />
            <Route path="/admin/feedback" element={<FeedbackPage />} />
            <Route path="/management/roles" element={<PermissionsPage />} />

            {/* Session Mode */}
            <Route path="/session" element={<SessionMode />} />

            {/* Backward compatibility redirects */}
            <Route path="/players" element={<Navigate to="/analysis/players" replace />} />
            <Route path="/teams" element={<Navigate to="/analysis/teams" replace />} />
            <Route path="/scrims" element={<Navigate to="/reports/scrim" replace />} />
            <Route path="/review" element={<Navigate to="/tools/review" replace />} />
          </Routes>
        </main>
      </div>
  );
}
