import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface ResidentProfile {
  displayName: string;
  district: string;
  totalPoints: number;
  districtRank: number;
  checkinCount: number;
  reportCount: number;
}

interface Transaction {
  id: number;
  points: number;
  buildingPoints: number;
  transactionType: 'checkin' | 'garbage_report';
  createdAt: string;
}

export default function ProfileTab() {
  const { clearSession } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get<{ data: ResidentProfile }>('/residents/me'),
      apiClient.get<{ data: { transactions: Transaction[] } }>('/residents/me/points'),
    ])
      .then(([profileRes, txRes]) => {
        setProfile(profileRes.data);
        setTransactions(txRes.data.transactions ?? []);
      })
      .catch(() => {/* handled by loading */})
      .finally(() => setLoading(false));
  }, []);

  function handleSignOut() {
    clearSession();
    navigate('/onboarding');
  }

  if (loading) {
    return (
      <div className="screen">
        <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>👤 Profile</h2>
        {Array.from({ length: 3 }).map((_, i) => (
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
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>👤 Profile</h2>

      {profile && (
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{profile.displayName}</div>
          <div style={{ color: '#6b7280', marginBottom: '0.75rem' }}>{profile.district}</div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#15803d' }}>{profile.totalPoints}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Total Points</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#1d4ed8' }}>#{profile.districtRank}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>District Rank</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>{profile.checkinCount}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Check-ins</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>{profile.reportCount}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Reports</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Recent Activity</div>
        {transactions.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>No transactions yet. Start recycling!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {transactions.slice(0, 20).map((tx) => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {tx.transactionType === 'checkin' ? '✅ Check-in' : '📷 Garbage Report'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#15803d' }}>+{tx.points} pts</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>🏢 +{tx.buildingPoints}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>🐙 Octopus Card</div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.2rem' }}>Link to redeem points automatically</div>
        </div>
        <button
          className="btn-secondary"
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}
          onClick={() => alert('Octopus Card linking coming soon!')}
        >
          Link Card
        </button>
      </div>

      <button className="btn-secondary" onClick={handleSignOut} style={{ marginTop: '0.5rem' }}>
        🚪 Sign Out
      </button>
    </div>
  );
}
