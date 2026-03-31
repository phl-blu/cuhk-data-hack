import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import OnboardingScreen from './screens/OnboardingScreen';

const LeaderboardTab = lazy(() => import('./screens/LeaderboardTab'));
const DashboardTab = lazy(() => import('./screens/DashboardTab'));
const MapTab = lazy(() => import('./screens/MapTab'));
const GarbageReportTab = lazy(() => import('./screens/GarbageReportTab'));
const CreditsTab = lazy(() => import('./screens/CreditsTab'));
const ProfileTab = lazy(() => import('./screens/ProfileTab'));

function TabFallback() {
  return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
      Loading…
    </div>
  );
}

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
  const { session } = useAuth();
  return (
    <>
      {session && (
        <div style={{
          background: '#2e7d32',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1rem',
          borderBottom: '3px solid #81c784',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '1.1rem' }}>♻️</span>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.01em' }}>iAM Green</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.68rem', opacity: 0.7, letterSpacing: '0.03em' }}>
            Recycling Rewards
          </span>
        </div>
      )}
      <Suspense fallback={<TabFallback />}>
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
      </Suspense>
      <TabBar />
    </>
  );
}
