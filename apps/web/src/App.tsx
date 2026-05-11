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
import Login from './pages/Login';
import Register from './pages/Register';
import Unauthorized from './pages/Unauthorized';
import StaffManagement from './pages/StaffManagement';
import { useAuth } from './hooks/useAuth';
import { apiClient } from './api/client';
import './App.css';

// ── Workspace header ──────────────────────────────────────────────────────────

function WorkspaceHeader() {
  const { authenticated, user } = useAuth();
  const [latestPatch, setLatestPatch] = useState<VersionRecord | null>(null);

  useEffect(() => {
    void apiClient.patches.latest()
      .then(setLatestPatch)
      .catch(() => setLatestPatch(null));
  }, []);

  return (
    <header className="workspace-header" aria-label="Workspace status">
      <div>
        <div className="workspace-title">Predecessor competitive workspace</div>
        <div className="workspace-subtitle">Scouting, roster analysis and scrim preparation</div>
      </div>
      <div className="workspace-meta">
        {latestPatch && (
          <div className="workspace-chip">
            <Zap size={13} />
            Patch v{latestPatch.name}
          </div>
        )}
        <div className={`workspace-chip ${authenticated ? 'connected' : ''}`}>
          <Radio size={13} />
          {authenticated ? 'pred.gg connected' : 'pred.gg login required'}
        </div>
        {user && (
          <div className="workspace-chip connected">
            <KeyRound size={13} />
            {user.name}
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
}

function SidebarSectionEl({ section, isOpen, onToggle }: SidebarSectionProps) {
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
        <span className="nav-section-label">{section.label}</span>
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
    items: [
      { to: '/matches', label: 'Match List' },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: <BarChart2 size={17} />,
    defaultOpen: true,
    items: [
      { to: '/analysis/teams', label: 'Team Analysis' },
      { to: '/analysis/players', label: 'Player Analysis' },
      { to: '/analysis/draft', label: 'Draft Analysis' },
      { to: '/analysis/rival', label: 'Rival Scouting' },
    ],
  },
  {
    id: 'tools',
    label: 'Team Tools',
    icon: <Wrench size={17} />,
    items: [
      { to: '/tools/review', label: 'Review Queue' },
      { to: '/tools/goals', label: 'Team Goals' },
      { to: '/tools/board', label: 'Tactical Board' },
      { to: '/tools/vod', label: 'VOD Index' },
      { to: '/tools/scrims', label: 'Scrim Planner' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <FileText size={17} />,
    items: [
      { to: '/reports/scrim', label: 'Scrim Reports' },
      { to: '/reports/weekly', label: 'Weekly Team' },
      { to: '/reports/players', label: 'Player Development' },
      { to: '/reports/rival', label: 'Rival Scouting' },
    ],
  },
  {
    id: 'management',
    label: 'Team Management',
    icon: <Users size={17} />,
    items: [
      { to: '/management/teams', label: 'Teams & Rosters' },
      { to: '/management/staff', label: 'Staff' },
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
    ],
  },
];

function Sidebar() {
  const { authenticated, loading, user, internalLoading } = useAuth();
  const location = useLocation();

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
            <div className="logo-name">PrimeSight</div>
            <div className="sidebar-subtitle">Competitive Intelligence</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <SidebarSectionEl
            key={section.id}
            section={section}
            isOpen={openSection === section.id}
            onToggle={() => setOpenSection((prev) => prev === section.id ? null : section.id)}
          />
        ))}
      </nav>

      <div className="sidebar-auth">
        {internalLoading ? (
          <div className="session-state muted">
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Checking internal session...
          </div>
        ) : user ? (
          <div className="internal-session-card">
            <div className="internal-session-name">{user.name}</div>
            <div className="internal-session-email">{user.email}</div>
            <div className="internal-session-row">
              <span className="internal-role-badge">{roleLabel}</span>
              <button onClick={handleInternalLogout} className="btn-auth btn-auth-logout" type="button">
                <LogOut size={15} /> Logout
              </button>
            </div>
          </div>
        ) : (
          <Link to="/login" className="btn-auth btn-auth-login">
            <KeyRound size={16} /> Internal login
          </Link>
        )}

        <div className="sidebar-auth-divider" />

        {loading ? (
          <div className="session-state muted">
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Checking pred.gg...
          </div>
        ) : authenticated ? (
          <button onClick={handlePredggLogout} className="btn-auth btn-auth-logout" type="button">
            <LogOut size={16} /> Logout pred.gg
          </button>
        ) : (
          <a href={apiClient.auth.loginUrl()} className="btn-auth btn-auth-login">
            <LogIn size={16} /> Login with pred.gg
          </a>
        )}
        {!loading && !authenticated && (
          <p className="sidebar-note">Login to enable player search and stats</p>
        )}
        {!loading && authenticated && (
          <p className="sidebar-note connected">pred.gg connected</p>
        )}
      </div>
    </aside>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />
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
            <Route path="/analysis/rival" element={<ComingSoon section="Rival Scouting" description="Rival team identity, objective priority, vision patterns and direct comparison — coming soon." issue={74} />} />

            {/* Team Tools */}
            <Route path="/tools/review" element={<ReviewQueue />} />
            <Route path="/tools/goals" element={<ReviewQueue />} />
            <Route path="/tools/board" element={<ComingSoon section="Tactical Board" description="Free-form tactical planning board over the Predecessor map." issue={53} />} />
            <Route path="/tools/vod" element={<ComingSoon section="VOD & Replay Index" description="External VOD links and timestamps linked to matches and review items." issue={56} />} />
            <Route path="/tools/scrims" element={<ComingSoon section="Scrim Planner" description="Plan scrims with focus areas linked to team goals." issue={64} />} />

            {/* Reports */}
            <Route path="/reports/scrim" element={<ScrimReport />} />
            <Route path="/reports/weekly" element={<ComingSoon section="Weekly Team Reports" description="Aggregated weekly performance summary for the coaching staff." />} />
            <Route path="/reports/players" element={<ComingSoon section="Player Development Reports" description="Individual player progress reports over time." />} />
            <Route path="/reports/rival" element={<ComingSoon section="Rival Scouting Reports" description="Full scouting report for opponent teams." />} />

            {/* Team Management */}
            <Route path="/management/teams" element={<ComingSoon section="Teams & Rosters" description="Create and manage teams, rosters and player assignments." issue={72} />} />
            <Route path="/management/staff" element={<StaffManagement />} />
            <Route path="/management/roles" element={<ComingSoon section="Roles & Permissions" description="Configure access levels per user and team." issue={76} />} />

            {/* Platform Admin */}
            <Route path="/admin/users" element={<ComingSoon section="User Management" description="Platform-wide user administration." issue={78} />} />
            <Route path="/admin/data-quality" element={<ComingSoon section="Data Quality" description="Monitor sync status, incomplete matches and data freshness." issue={78} />} />
            <Route path="/admin/api-status" element={<ComingSoon section="API Status" description="pred.gg connection health, sync logs and error counts." issue={78} />} />
            <Route path="/admin/audit-logs" element={<ComingSoon section="Audit Logs" description="History of platform operations and security events." issue={78} />} />

            {/* Backward compatibility redirects */}
            <Route path="/players" element={<Navigate to="/analysis/players" replace />} />
            <Route path="/teams" element={<Navigate to="/analysis/teams" replace />} />
            <Route path="/scrims" element={<Navigate to="/reports/scrim" replace />} />
            <Route path="/review" element={<Navigate to="/tools/review" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </BrowserRouter>
  );
}
