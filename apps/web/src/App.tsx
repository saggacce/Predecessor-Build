import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Link, useLocation } from 'react-router';
import { Toaster, toast } from 'sonner';
import {
  Film, BarChart2, Wrench, FileText, Users, Settings,
  LogIn, LogOut, Loader, Radio, Zap, ChevronDown, ChevronRight,
  LayoutDashboard, KeyRound,
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
import StaffManagement from './pages/StaffManagement';
import DataQualityPage from './pages/DataQualityPage';
import AuditLogsPage from './pages/AuditLogsPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import ApiStatusPage from './pages/ApiStatusPage';
import ConfigPage from './pages/ConfigPage';
import FeedbackPage from './pages/FeedbackPage';
import { FeedbackButton } from './components/FeedbackButton';
import LandingPage from './pages/LandingPage';
import { useAuth } from './hooks/useAuth';
import { apiClient } from './api/client';
import './App.css';

// ── Workspace header ──────────────────────────────────────────────────────────

function WorkspaceHeader() {
  const { authenticated, user, refreshInternalSession } = useAuth();

  async function handleInternalLogout() {
    try {
      await apiClient.auth.internalLogout();
      window.location.reload();
    } catch {
      toast.error('Logout failed');
    }
  }
  const [latestPatch, setLatestPatch] = useState<VersionRecord | null>(null);
  const isAdmin = user?.globalRole === 'PLATFORM_ADMIN';

  useEffect(() => {
    void apiClient.patches.latest()
      .then(setLatestPatch)
      .catch(() => setLatestPatch(null));
  }, []);

  const initials = user?.name
    ? user.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="workspace-header" aria-label="Workspace status">
      {/* Left — only shown for admins */}
      {isAdmin ? (
        <div>
          <div className="workspace-title">Predecessor competitive workspace</div>
          <div className="workspace-subtitle">Competitive Intel · by Synapsight</div>
        </div>
      ) : (
        <div />
      )}

      <div className="workspace-meta">
        {/* Patch badge — everyone */}
        {latestPatch && (
          <div className="workspace-chip">
            <Zap size={13} />
            Patch v{latestPatch.name}
          </div>
        )}

        {/* pred.gg status — admins only */}
        {isAdmin && (
          <div className={`workspace-chip ${authenticated ? 'connected' : ''}`}>
            <Radio size={13} />
            {authenticated ? 'pred.gg connected' : 'pred.gg disconnected'}
          </div>
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
              title="Cerrar sesión"
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

const sections: SidebarSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={17} />,
    to: '/',
  },
  {
    id: 'matches',
    label: 'Matches',
    icon: <Film size={17} />,
    to: '/matches',
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: <BarChart2 size={17} />,
    defaultOpen: true,
    items: [
      { to: '/analysis/teams', label: 'Team Analysis' },
      { to: '/analysis/players', label: 'Player Analysis' },
      { to: '/analysis/rival', label: 'Rival Scouting' },
      { to: '/analysis/draft', label: 'Draft Analysis' },
    ],
  },
  {
    id: 'tools',
    label: 'Team Tools',
    icon: <Wrench size={17} />,
    items: [
      { to: '/tools/review', label: 'Review Queue' },
      { to: '/tools/vod', label: 'VOD Index' },
      { to: '/tools/board', label: 'Tactical Board' },
      { to: '/tools/scrims', label: 'Scrim Planner' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <FileText size={17} />,
    items: [
      { to: '/reports/scrim', label: 'Scrim Report' },
      { to: '/reports/weekly', label: 'Weekly Reports' },
      { to: '/reports/players', label: 'Player Development' },
    ],
  },
  {
    id: 'management',
    label: 'Team Management',
    icon: <Users size={17} />,
    items: [
      { to: '/management/staff', label: 'Staff & Invitations' },
      { to: '/management/teams', label: 'Teams & Rosters' },
      { to: '/management/roles', label: 'Roles & Permissions' },
    ],
  },
  {
    id: 'admin',
    label: 'Platform Admin',
    icon: <Settings size={17} />,
    items: [
      { to: '/admin/users', label: 'Users' },
      { to: '/admin/data-quality', label: 'Data Quality' },
      { to: '/admin/api-status', label: 'API Status' },
      { to: '/admin/audit-logs', label: 'Audit Logs' },
      { to: '/admin/config', label: 'Configuración' },
      { to: '/admin/feedback', label: 'Feedback' },
    ],
  },
];

function Sidebar() {
  const { authenticated, loading, user, internalLoading } = useAuth();
  const location = useLocation();
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
            <div className="sidebar-subtitle">Competitive Intel</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections
          .filter((section) => {
            const isPlayer = user?.globalRole === 'PLAYER';
            const hasTeam = (user?.memberships?.length ?? 0) > 0;
            const isStandalone = isPlayer || (!hasTeam && user?.globalRole !== 'PLATFORM_ADMIN');
            if (section.id === 'admin') return user?.globalRole === 'PLATFORM_ADMIN';
            if (['tools', 'management'].includes(section.id) && isStandalone) return false;
            return true;
          })
          .map((section) => {
            const isPlayer = user?.globalRole === 'PLAYER';
            const hasTeam = (user?.memberships?.length ?? 0) > 0;
            const isStandalone = isPlayer || (!hasTeam && user?.globalRole !== 'PLATFORM_ADMIN');
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


    </aside>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </BrowserRouter>
  );
}

function AppContent() {
  const { internalAuthenticated, internalLoading } = useAuth();
  const location = useLocation();

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

  return (
      <div className="app-container">
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

            {/* Analysis */}
            <Route path="/analysis/teams" element={<TeamAnalysis />} />
            <Route path="/analysis/players" element={<PlayerScouting />} />
            <Route path="/analysis/draft" element={<ComingSoon section="Draft Analysis" description="Pick rates, ban rates, hero pool depth, comfort scores and hero overlap — coming soon." issue={79} />} />
            <Route path="/analysis/rival" element={<RivalScouting />} />

            {/* Team Tools */}
            <Route path="/tools/review" element={<ReviewQueue />} />
            <Route path="/tools/goals" element={<Navigate to="/tools/review" replace />} />
            <Route path="/tools/board" element={<ComingSoon section="Tactical Board" description="Free-form tactical planning board over the Predecessor map." issue={53} />} />
            <Route path="/tools/vod" element={<VodIndex />} />
            <Route path="/tools/scrims" element={<ComingSoon section="Scrim Planner" description="Plan scrims with focus areas linked to team goals." issue={64} />} />

            {/* Reports */}
            <Route path="/reports/scrim" element={<ScrimReport />} />
            <Route path="/reports/weekly" element={<ComingSoon section="Weekly Team Reports" description="Aggregated weekly performance summary for the coaching staff." />} />
            <Route path="/reports/players" element={<ComingSoon section="Player Development Reports" description="Individual player progress reports over time." />} />
            <Route path="/reports/rival" element={<Navigate to="/analysis/rival" replace />} />

            {/* Team Management */}
            <Route path="/management/teams" element={<ComingSoon section="Teams & Rosters" description="Create and manage teams, rosters and player assignments." issue={72} />} />
            <Route path="/management/staff" element={<StaffManagement />} />
            <Route path="/management/roles" element={<ComingSoon section="Roles & Permissions" description="Configure access levels per user and team." issue={76} />} />

            {/* Platform Admin */}
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin/data-quality" element={<DataQualityPage />} />
            <Route path="/admin/config" element={<ConfigPage />} />
            <Route path="/admin/api-status" element={<ApiStatusPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route path="/admin/feedback" element={<FeedbackPage />} />

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
