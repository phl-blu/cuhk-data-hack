import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface LeaderboardEntry {
  rank: number;
  districtName: string;
  totalPoints: number;
  areaKm2: number;
  pointsPerKm2: number;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const MEDAL_COLORS: Record<number, string> = {
  1: '#fef9c3',
  2: '#f1f5f9',
  3: '#fef3c7',
};

export default function LeaderboardTab() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ data: { leaderboard: LeaderboardEntry[] } }>('/leaderboard')
      .then((res) => setEntries(res.data.leaderboard))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="screen">
        <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>🏆 District Leaderboard</h2>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton" style={{ width: '60%' }} />
            <div className="skeleton" style={{ width: '40%' }} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen">
        <p style={{ color: '#dc2626' }}>Failed to load leaderboard: {error}</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>🏆 District Leaderboard</h2>
      <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
        Ranked by recycling points per km²
      </p>
      {entries.map((entry) => {
        const isOwn = entry.districtName === session?.district;
        const medal = MEDAL[entry.rank];
        const medalBg = MEDAL_COLORS[entry.rank];
        return (
          <div
            key={entry.rank}
            className="card"
            style={{
              background: isOwn ? '#dcfce7' : medalBg ?? '#fff',
              border: isOwn ? '2px solid #16a34a' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '1.5rem', minWidth: '2rem', textAlign: 'center' }}>
              {medal ?? <span style={{ fontWeight: 700, color: '#6b7280' }}>#{entry.rank}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                {entry.districtName}
                {isOwn && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#15803d' }}>← you</span>}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {entry.totalPoints.toLocaleString()} pts · {entry.areaKm2.toFixed(1)} km²
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, color: '#15803d', fontSize: '1.1rem' }}>
                {entry.pointsPerKm2.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>pts/km²</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
