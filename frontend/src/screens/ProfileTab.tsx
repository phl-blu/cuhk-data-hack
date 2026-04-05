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
        <div className="section-heading">Profile</div>
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
      <div className="section-heading">Profile</div>

      {profile && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: '#D9F3E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              👤
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{profile.displayName}</div>
              <div style={{ color: '#4D7060', fontSize: 13 }}>{profile.district} District</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div className="stat-value">{profile.totalPoints.toLocaleString()}</div>
              <div className="stat-label">Total Points</div>
            </div>
            <div>
              <div className="stat-value" style={{ color: '#D4A020' }}>#{profile.districtRank}</div>
              <div className="stat-label">District Rank</div>
            </div>
            <div>
              <div className="stat-value" style={{ color: '#0F2D1C' }}>{profile.checkinCount}</div>
              <div className="stat-label">Check-ins</div>
            </div>
            <div>
              <div className="stat-value" style={{ color: '#0F2D1C' }}>{profile.reportCount}</div>
              <div className="stat-label">Reports</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-label">Recent Activity</div>
        {transactions.length === 0 ? (
          <p style={{ color: '#8AAD96', fontSize: 13 }}>No transactions yet. Start recycling!</p>
        ) : (
          transactions.slice(0, 20).map((tx) => (
            <div key={tx.id} className="info-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F2D1C' }}>
                  {tx.transactionType === 'checkin' ? 'Check-in' : 'Garbage Report'}
                </div>
                <div style={{ fontSize: 11, color: '#8AAD96' }}>
                  {new Date(tx.createdAt).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#2AA962', fontSize: 13 }}>+{tx.points} pts</div>
                <div style={{ fontSize: 11, color: '#8AAD96' }}>+{tx.buildingPoints} bldg</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: '#4D7060' }}>Link Octopus Card for auto-redemption</div>
        <button
          className="btn-secondary"
          style={{ width: 'auto', padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => alert('Octopus Card linking coming soon!')}
        >
          <img src="/octopus-logo.png" alt="Octopus" style={{ height: 36, width: 'auto' }} />
          <span>Link</span>
        </button>
      </div>

      <button className="btn-secondary" onClick={handleSignOut} style={{ marginTop: 8 }}>
        Sign Out
      </button>
    </div>
  );
}
