import React, { useEffect, useState } from 'react';
import { apiClient, ApiError } from '../api/client';

interface ResidentProfile {
  totalPoints: number;
}

interface Redemption {
  id: number;
  tier: string;
  hkdValue: number;
  pointsDeducted: number;
  createdAt: string;
}

const TIERS = [
  { tier: 'tier-1', points: 50, hkd: 5 },
  { tier: 'tier-2', points: 100, hkd: 10 },
  { tier: 'tier-3', points: 200, hkd: 20 },
  { tier: 'tier-4', points: 500, hkd: 50 },
];

export default function CreditsTab() {
  const [balance, setBalance] = useState<number | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<{ data: { totalPoints: number } }>('/residents/me'),
      apiClient.get<{ data: { redemptions: Redemption[] } }>('/credits/redemptions'),
    ])
      .then(([profileRes, redemptionsRes]) => {
        setBalance(profileRes.data.totalPoints);
        setRedemptions(redemptionsRes.data.redemptions ?? []);
      })
      .catch(() => {/* handled by loading */})
      .finally(() => setLoading(false));
  }, []);

  async function handleRedeem(tier: string, points: number, hkd: number) {
    setRedeemMsg(null);
    setRedeemError(null);
    setRedeeming(tier);

    try {
      const res = await apiClient.post<{ data: { redemptionId: number; updatedBalance: number } }>(
        '/credits/redeem',
        { tier },
      );
      setBalance(res.data.updatedBalance);
      setRedeemMsg(`Redeemed! HK$${hkd} credited to your Octopus card 🎉`);

      // Refresh redemption history
      const histRes = await apiClient.get<{ data: { redemptions: Redemption[] } }>('/credits/redemptions');
      setRedemptions(histRes.data.redemptions ?? []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setRedeemError(`Need ${points - (balance ?? 0)} more points to redeem HK$${hkd}`);
      } else {
        setRedeemError(e instanceof Error ? e.message : 'Redemption failed');
      }
    } finally {
      setRedeeming(null);
    }
  }

  if (loading) {
    return (
      <div className="screen">
        <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>💳 Credits</h2>
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
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>💳 Credits</h2>

      <div className="card" style={{ textAlign: 'center', background: '#f0fdf4' }}>
        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Your Balance</div>
        <div style={{ fontWeight: 800, fontSize: '2.5rem', color: '#15803d' }}>{balance ?? 0}</div>
        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>points</div>
      </div>

      {redeemMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#15803d', fontWeight: 600 }}>
          {redeemMsg}
        </div>
      )}
      {redeemError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#dc2626' }}>
          {redeemError}
        </div>
      )}

      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Redeem for Octopus Card</div>
      {TIERS.map(({ tier, points, hkd }) => {
        const canRedeem = (balance ?? 0) >= points;
        return (
          <div key={tier} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700 }}>HK${hkd}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{points} points</div>
            </div>
            <button
              className={canRedeem ? 'btn-primary' : 'btn-secondary'}
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
              disabled={!canRedeem || redeeming === tier}
              onClick={() => handleRedeem(tier, points, hkd)}
            >
              {redeeming === tier ? '…' : 'Redeem'}
            </button>
          </div>
        );
      })}

      {redemptions.length > 0 && (
        <>
          <div style={{ fontWeight: 600, margin: '1rem 0 0.5rem' }}>Redemption History</div>
          {redemptions.map((r) => (
            <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>HK${r.hkdValue}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#dc2626' }}>
                −{r.pointsDeducted} pts
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
