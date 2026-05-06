import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router';
import { Toaster, toast } from 'sonner';
import { Home, Users, Target, Shield, LogIn, LogOut, Loader, Radio, Zap } from 'lucide-react';
import type { VersionRecord } from '@predecessor/data-model';
import Dashboard from './pages/Dashboard';
import PlayerScouting from './pages/PlayerScouting';
import TeamAnalysis from './pages/TeamAnalysis';
import ScrimReport from './pages/ScrimReport';
import MatchDetail from './pages/MatchDetail';
import { useAuth } from './hooks/useAuth';
import { apiClient } from './api/client';
import './App.css';

function WorkspaceHeader() {
  const { authenticated } = useAuth();
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
      </div>
    </header>
  );
}

function Sidebar() {
  const { authenticated, loading } = useAuth();

  async function handleLogout() {
    try {
      await apiClient.auth.logout();
      window.location.reload();
    } catch {
      toast.error('Logout failed');
    }
  }

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <Home size={18} /> },
    { to: '/players', label: 'Player Scouting', icon: <Target size={18} /> },
    { to: '/teams', label: 'Team Analysis', icon: <Users size={18} /> },
    { to: '/scrims', label: 'Scrim Reports', icon: <Shield size={18} /> },
  ];

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
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-auth">
        {loading ? (
          <div className="session-state muted">
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Checking session...
          </div>
        ) : authenticated ? (
          <button onClick={handleLogout} className="btn-auth btn-auth-logout">
            <LogOut size={16} /> Logout pred.gg
          </button>
        ) : (
          <a href={apiClient.auth.loginUrl()} className="btn-auth btn-auth-login">
            <LogIn size={16} /> Login with pred.gg
          </a>
        )}
        {!loading && !authenticated && (
          <p className="sidebar-note">
            Login to enable player search and stats
          </p>
        )}
        {!loading && authenticated && (
          <p className="sidebar-note connected">
            pred.gg connected
          </p>
        )}
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <WorkspaceHeader />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/players" element={<PlayerScouting />} />
            <Route path="/teams" element={<TeamAnalysis />} />
            <Route path="/scrims" element={<ScrimReport />} />
            <Route path="/matches/:id" element={<MatchDetail />} />
          </Routes>
        </main>
      </div>
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </BrowserRouter>
  );
}
