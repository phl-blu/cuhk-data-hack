import { useEffect, useState } from 'react';
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
  { rank: 1, districtName: 'Sha Tin',            totalPoints: 18420, areaKm2: 69.0, pointsPerKm2: 266.96 },
  { rank: 2, districtName: 'Kwun Tong',           totalPoints: 15830, areaKm2: 11.3, pointsPerKm2: 140.09 },
  { rank: 3, districtName: 'Yau Tsim Mong',       totalPoints: 12100, areaKm2: 7.0,  pointsPerKm2: 172.86 },
  { rank: 4, districtName: 'Sham Shui Po',        totalPoints: 10950, areaKm2: 9.9,  pointsPerKm2: 110.61 },
  { rank: 5, districtName: 'Eastern',             totalPoints: 9870,  areaKm2: 18.6, pointsPerKm2: 53.06  },
  { rank: 6, districtName: 'Central and Western', totalPoints: 8540,  areaKm2: 12.5, pointsPerKm2: 68.32  },
];

const MEDAL_ICON: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANK_BG: Record<number, string>    = { 1: '#FEF0CC', 2: '#F1F5F9', 3: '#FEF3C7' };
const RANK_COLOR: Record<number, string> = { 1: '#D4A020', 2: '#8A9BB0', 3: '#C07840' };

export default function LeaderboardTab() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ data: { leaderboard: LeaderboardEntry[] } }>('/leaderboard')
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
        <div className="section-heading">District Leaderboard</div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="lb-row">
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, marginBottom: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '55%' }} />
              <div className="skeleton" style={{ width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="section-heading">🏆 District Leaderboard</div>
      <p style={{ color: '#8AAD96', fontSize: 11, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Ranked by recycling points per km²
      </p>

      {entries.map((entry) => {
        const isOwn = entry.districtName === session?.district;
        const medal = MEDAL_ICON[entry.rank];
        const rankBg = RANK_BG[entry.rank] ?? '#fff';
        const rankColor = RANK_COLOR[entry.rank] ?? '#8AAD96';

        return (
          <div
            key={entry.rank}
            className={`lb-row${entry.rank === 1 ? ' lb-row-gold' : ''}${isOwn ? ' lb-row-own' : ''}`}
          >
            {/* Rank badge */}
            <div
              className="lb-rank"
              style={{ background: entry.rank <= 3 ? rankBg : '#EFF9F3' }}
            >
              {medal
                ? <span style={{ fontSize: 20 }}>{medal}</span>
                : <span className="lb-rank-num" style={{ color: rankColor }}>#{entry.rank}</span>
              }
            </div>

            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0F2D1C', display: 'flex', alignItems: 'center', gap: 6 }}>
                {entry.districtName}
                {isOwn && (
                  <span style={{ fontSize: 10, background: '#D9F3E5', color: '#1A7A4A', borderRadius: 99, padding: '1px 7px', fontWeight: 700 }}>
                    You
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#8AAD96', marginTop: 2 }}>
                {entry.totalPoints.toLocaleString()} pts · {entry.areaKm2.toFixed(1)} km²
              </div>
            </div>

            {/* Score */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="lb-score" style={{ color: entry.rank <= 3 ? rankColor : '#2AA962' }}>
                {entry.pointsPerKm2.toFixed(2)}
              </div>
              <div className="lb-score-label">pts/km²</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
