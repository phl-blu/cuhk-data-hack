import React from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import OnboardingScreen from './screens/OnboardingScreen';
import LeaderboardTab from './screens/LeaderboardTab';
import DashboardTab from './screens/DashboardTab';
import MapTab from './screens/MapTab';
import GarbageReportTab from './screens/GarbageReportTab';
import CreditsTab from './screens/CreditsTab';
import ProfileTab from './screens/ProfileTab';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function TabBar() {
  const { session } = useAuth();
  const navigate = useNavigate();
  if (!session) return null;

  return (
    <nav className="tab-bar">
      <NavLink to="/" end className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
        <span className="tab-icon">🏆</span>
        <span>Leaderboard</span>
      </NavLink>
      <NavLink to="/dashboard" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
        <span className="tab-icon">📊</span>
        <span>Dashboard</span>
      </NavLink>
      <NavLink to="/map" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
        <span className="tab-icon">🗺️</span>
        <span>Map</span>
      </NavLink>
      <NavLink to="/report" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
        <span className="tab-icon">📷</span>
        <span>Report</span>
      </NavLink>
      <NavLink to="/credits" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
        <span className="tab-icon">💳</span>
        <span>Credits</span>
      </NavLink>
      <button
        onClick={() => navigate('/profile')}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.5rem 0.25rem',
          fontSize: '0.7rem',
          color: '#6b7280',
          background: 'none',
          borderRadius: 0,
          gap: 2,
        }}
      >
        <span className="tab-icon">👤</span>
        <span>Profile</span>
      </button>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/" element={<AuthGuard><LeaderboardTab /></AuthGuard>} />
        <Route path="/dashboard" element={<AuthGuard><DashboardTab /></AuthGuard>} />
        <Route path="/map" element={<AuthGuard><MapTab /></AuthGuard>} />
        <Route path="/report" element={<AuthGuard><GarbageReportTab /></AuthGuard>} />
        <Route path="/credits" element={<AuthGuard><CreditsTab /></AuthGuard>} />
        <Route path="/profile" element={<AuthGuard><ProfileTab /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </>
  );
}
