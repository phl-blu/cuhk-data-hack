import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { useAuth } from './auth/AuthContext';
import OnboardingScreen from './screens/OnboardingScreen';

const LeaderboardTab = lazy(() => import('./screens/LeaderboardTab'));
const DashboardTab   = lazy(() => import('./screens/DashboardTab'));
const MapTab         = lazy(() => import('./screens/MapTab'));
const GarbageReportTab = lazy(() => import('./screens/GarbageReportTab'));
const CreditsTab     = lazy(() => import('./screens/CreditsTab'));
const ProfileTab     = lazy(() => import('./screens/ProfileTab'));

function TabFallback() {
  return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8AAD96' }}>
      Loading…
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

// SVG icons matching the design reference
const IconLeaderboard = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="10" width="4" height="10" rx="2" fill={active ? '#D4A020' : '#8AAD96'} />
    <rect x="10" y="5" width="4" height="15" rx="2" fill={active ? '#D4A020' : '#8AAD96'} />
    <rect x="17" y="8" width="4" height="12" rx="2" fill={active ? '#D4A020' : '#8AAD96'} />
    <path d="M5 10 L12 5 L19 8" stroke={active ? '#D4A020' : '#8AAD96'} strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>
);

const IconDashboard = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="8" height="8" rx="2.5" stroke={active ? '#1A7A4A' : '#8AAD96'} strokeWidth="1.8" fill={active ? '#D9F3E5' : 'none'} />
    <rect x="13" y="3" width="8" height="8" rx="2.5" stroke={active ? '#1A7A4A' : '#8AAD96'} strokeWidth="1.8" fill={active ? '#D9F3E5' : 'none'} />
    <rect x="3" y="13" width="8" height="8" rx="2.5" stroke={active ? '#1A7A4A' : '#8AAD96'} strokeWidth="1.8" fill={active ? '#D9F3E5' : 'none'} />
    <rect x="13" y="13" width="8" height="8" rx="2.5" stroke={active ? '#1A7A4A' : '#8AAD96'} strokeWidth="1.8" fill={active ? '#B6E8CC' : 'none'} />
    <rect x="15" y="16" width="2" height="3" rx="1" fill={active ? '#1A7A4A' : '#8AAD96'} />
    <rect x="18" y="15" width="2" height="4" rx="1" fill={active ? '#1A7A4A' : '#8AAD96'} />
  </svg>
);

const IconMap = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" stroke={active ? '#1A6BB5' : '#8AAD96'} strokeWidth="1.8" fill={active ? '#D0EDFD' : 'none'} strokeLinejoin="round" />
    <path d="M9 3v15M15 6v15" stroke={active ? '#1A6BB5' : '#8AAD96'} strokeWidth="1.5" />
    <circle cx="15" cy="10" r="2.5" fill={active ? '#1A6BB5' : '#8AAD96'} />
    <path d="M15 12.5 L15 15" stroke={active ? '#1A6BB5' : '#8AAD96'} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconReport = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" stroke={active ? '#1A7A4A' : '#8AAD96'} strokeWidth="1.8" fill={active ? '#E8F5EE' : 'none'} />
    <path d="M14 3v6h6" stroke={active ? '#1A7A4A' : '#8AAD96'} strokeWidth="1.8" />
    <rect x="8" y="12" width="8" height="6" rx="1.5" stroke={active ? '#1A7A4A' : '#8AAD96'} strokeWidth="1.5" fill={active ? '#D9F3E5' : 'none'} />
    <circle cx="12" cy="15" r="1.5" fill={active ? '#1A7A4A' : '#8AAD96'} />
  </svg>
);

const IconCredits = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="20" height="13" rx="3" stroke={active ? '#5B4DB8' : '#8AAD96'} strokeWidth="1.8" fill={active ? '#EBE8FA' : 'none'} />
    <path d="M2 10h20" stroke={active ? '#5B4DB8' : '#8AAD96'} strokeWidth="2.5" />
    <rect x="5" y="14" width="4" height="2.5" rx="1" fill={active ? '#5B4DB8' : '#8AAD96'} />
  </svg>
);

const IconProfile = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={active ? '#3E5A6E' : '#8AAD96'} strokeWidth="1.8" fill={active ? '#DDE6ED' : 'none'} />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#3E5A6E' : '#8AAD96'} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <circle cx="16" cy="6" r="3" fill={active ? '#2AA962' : '#D9F3E5'} />
    <path d="M14.5 6h3M16 4.5v3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const TAB_BG: Record<string, string> = {
  '/':        '#FEF0CC',
  '/dashboard': '#D9F3E5',
  '/map':     '#D0EDFD',
  '/report':  '#E8F5EE',
  '/credits': '#EBE8FA',
  '/profile': '#DDE6ED',
};

function TabBar() {
  const { session } = useAuth();
  const navigate = useNavigate();
  if (!session) return null;

  const tabs = [
    { to: '/',          label: 'Leaderboard', Icon: IconLeaderboard },
    { to: '/dashboard', label: 'Dashboard',   Icon: IconDashboard   },
    { to: '/map',       label: 'Map',         Icon: IconMap         },
    { to: '/report',    label: 'Report',      Icon: IconReport      },
    { to: '/credits',   label: 'Credits',     Icon: IconCredits     },
    { to: '/profile',   label: 'Profile',     Icon: IconProfile     },
  ];

  return (
    <nav className="tab-bar">
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
        >
          {({ isActive }) => (
            <>
              <div className="tab-icon-wrap" style={isActive ? { background: TAB_BG[to] } : {}}>
                <Icon active={isActive} />
              </div>
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const { session } = useAuth();
  return (
    <>
      {session && (
        <div className="app-header">
          <span style={{ fontSize: 22 }}>♻️</span>
          <span className="app-header-title">iAM Green</span>
          <span className="app-header-sub">Recycling Rewards</span>
        </div>
      )}
      <Suspense fallback={<TabFallback />}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/"          element={<AuthGuard><LeaderboardTab /></AuthGuard>} />
          <Route path="/dashboard" element={<AuthGuard><DashboardTab /></AuthGuard>} />
          <Route path="/map"       element={<AuthGuard><MapTab /></AuthGuard>} />
          <Route path="/report"    element={<AuthGuard><GarbageReportTab /></AuthGuard>} />
          <Route path="/credits"   element={<AuthGuard><CreditsTab /></AuthGuard>} />
          <Route path="/profile"   element={<AuthGuard><ProfileTab /></AuthGuard>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <TabBar />
      <Analytics />
    </>
  );
}
