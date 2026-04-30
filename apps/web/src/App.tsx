import { BrowserRouter, Routes, Route, Link } from 'react-router';
import { Toaster, toast } from 'sonner';
import { Home, Users, Target, Shield, LogIn, LogOut, Loader } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import PlayerScouting from './pages/PlayerScouting';
import TeamAnalysis from './pages/TeamAnalysis';
import ScrimReport from './pages/ScrimReport';
import { useAuth } from './hooks/useAuth';
import { apiClient } from './api/client';
import './App.css';

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

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-gradient">PREDECESSOR</div>
        <div className="sidebar-subtitle">Scouting Engine</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        <Link to="/" className="nav-link"><Home size={18} /> Dashboard</Link>
        <Link to="/players" className="nav-link"><Target size={18} /> Player Scouting</Link>
        <Link to="/teams" className="nav-link"><Users size={18} /> Team Analysis</Link>
        <Link to="/scrims" className="nav-link"><Shield size={18} /> Scrim Reports</Link>
      </nav>

      {/* Auth section at bottom of sidebar */}
      <div className="sidebar-auth">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
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
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>
            Login to enable player search and stats
          </p>
        )}
        {!loading && authenticated && (
          <p style={{ fontSize: '0.7rem', color: 'var(--accent-success)', marginTop: '0.5rem' }}>
            ✓ pred.gg connected
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
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/players" element={<PlayerScouting />} />
            <Route path="/teams" element={<TeamAnalysis />} />
            <Route path="/scrims" element={<ScrimReport />} />
          </Routes>
        </main>
      </div>
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </BrowserRouter>
  );
}
