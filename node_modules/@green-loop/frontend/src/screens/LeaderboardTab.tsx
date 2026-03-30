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

const PLACEHOLDER_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, districtName: 'Sha Tin',           totalPoints: 18420, areaKm2: 69.0, pointsPerKm2: 266.96 },
  { rank: 2, districtName: 'Kwun Tong',          totalPoints: 15830, areaKm2: 11.3, pointsPerKm2: 140.09 },
  { rank: 3, districtName: 'Yau Tsim Mong',      totalPoints: 12100, areaKm2: 7.0,  pointsPerKm2: 172.86 },
  { rank: 4, districtName: 'Sham Shui Po',       totalPoints: 10950, areaKm2: 9.9,  pointsPerKm2: 110.61 },
  { rank: 5, districtName: 'Eastern',            totalPoints: 9870,  areaKm2: 18.6, pointsPerKm2: 53.06  },
  { rank: 6, districtName: 'Central and Western',totalPoints: 8540,  areaKm2: 12.5, pointsPerKm2: 68.32  },
];

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

  useEffect(() => {
    apiClient
      .get<{ data: { leaderboard: LeaderboardEntry[] } }>('/leaderboard', true)
      .then((res) => {
        const data = res.data.leaderboard;
        setEntries(data && data.length > 0 ? data : PLACEHOLDER_ENTRIES);
      })
      .catch(() => setEntries(PLACEHOLDER_ENTRIES))
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
