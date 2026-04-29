import { BrowserRouter, Routes, Route, Link } from 'react-router';
import { Toaster } from 'sonner';
import { Home, Users, Target, Shield } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import PlayerScouting from './pages/PlayerScouting';
import TeamAnalysis from './pages/TeamAnalysis';
import ScrimReport from './pages/ScrimReport';
import './App.css';

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-gradient">PREDECESSOR</div>
        <div className="sidebar-subtitle">Scouting Engine</div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link to="/" className="nav-link"><Home size={18} /> Dashboard</Link>
        <Link to="/players" className="nav-link"><Target size={18} /> Player Scouting</Link>
        <Link to="/teams" className="nav-link"><Users size={18} /> Team Analysis</Link>
        <Link to="/scrims" className="nav-link"><Shield size={18} /> Scrim Reports</Link>
      </nav>
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
