import React, { useEffect, useState } from 'react';
import { apiClient, ApiError } from '../api/client';

interface ResidentProfile {
  totalPoints: number;
  residentialAreaName: string | null;
  residentialAreaBuildingPoints: number;
  district: string;
}

interface Redemption {
  id: number;
  tier: string;
  hkdValue: number;
  pointsDeducted: number;
  createdAt: string;
}

interface ResidentialAreaEntry {
  id: number;
  name: string;
  districtName: string | null;
  totalBuildingPoints: number;
  rank: number;
}

const TIERS = [
  { tier: 'tier-1', points: 50,  hkd: 5  },
  { tier: 'tier-2', points: 100, hkd: 10 },
  { tier: 'tier-3', points: 200, hkd: 20 },
  { tier: 'tier-4', points: 500, hkd: 50 },
];

function getNextTier(balance: number): { tier: typeof TIERS[number]; pointsNeeded: number } | null {
  const next = TIERS.find((t) => t.points > balance);
  if (!next) return null;
  return { tier: next, pointsNeeded: next.points - balance };
}

export default function CreditsTab() {
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalRedeemed, setTotalRedeemed] = useState(0);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [areaLeaderboard, setAreaLeaderboard] = useState<ResidentialAreaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<{ message: string; current?: number; required?: number } | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, redemptionsRes, areasRes] = await Promise.all([
          apiClient.get<{ data: ResidentProfile }>('/residents/me'),
          apiClient.get<{ data: { redemptions: Redemption[] } }>('/credits/redemptions'),
          apiClient.get<{ data: { areas: ResidentialAreaEntry[] } }>('/residential-areas/leaderboard'),
        ]);

        const prof = profileRes.data;
        setProfile(prof);

        const reds = redemptionsRes.data.redemptions ?? [];
        setRedemptions(reds);
        setTotalRedeemed(reds.reduce((sum, r) => sum + r.pointsDeducted, 0));

        // Compute total earned from transactions (balance + redeemed)
        const txRes = await apiClient.get<{ data: { transactions: Array<{ points: number }> } }>('/residents/me/points');
        const earned = txRes.data.transactions.reduce((sum, t) => sum + t.points, 0);
        setTotalEarned(earned);

        // Filter leaderboard to resident's district, top 5
        const districtAreas = areasRes.data.areas
          .filter((a) => a.districtName === prof.district)
          .slice(0, 5);
        setAreaLeaderboard(districtAreas);
      } catch {
        // handled by loading state
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  async function handleRedeem(tier: string, points: number, hkd: number) {
    setRedeemMsg(null);
    setRedeemError(null);
    setRedeeming(tier);

    try {
      const res = await apiClient.post<{ data: { redemptionId: number; updatedBalance: number; pointsDeducted: number } }>(
        '/credits/redeem',
        { tier },
      );
      const { updatedBalance, pointsDeducted, redemptionId } = res.data;

      setProfile((prev) => prev ? { ...prev, totalPoints: updatedBalance } : prev);
      setTotalRedeemed((prev) => prev + pointsDeducted);
      setRedeemMsg(`Redeemed HK$${hkd} — confirmation #${redemptionId} 🎉`);

      // Refresh redemption history
      const histRes = await apiClient.get<{ data: { redemptions: Redemption[] } }>('/credits/redemptions');
      setRedemptions(histRes.data.redemptions ?? []);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const current = e.data['currentBalance'] as number | undefined;
        const required = e.data['requiredBalance'] as number | undefined;
        setRedeemError({
          message: 'Insufficient points balance',
          ...(current !== undefined && { current }),
          ...(required !== undefined && { required }),
        });
      } else {
        setRedeemError({ message: e instanceof Error ? e.message : 'Redemption failed' });
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

  const balance = profile?.totalPoints ?? 0;
  const nextTier = getNextTier(balance);

  return (
    <div className="screen">
      <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>💳 Credits</h2>

      {/* Balance summary card */}
      <div className="card" style={{ background: '#f0fdf4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Balance</div>
            <div style={{ fontWeight: 800, fontSize: '2rem', color: '#15803d' }}>{balance.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>pts</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total Earned</div>
            <div style={{ fontWeight: 700, fontSize: '1.4rem', color: '#374151' }}>{totalEarned.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>pts</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Redeemed</div>
            <div style={{ fontWeight: 700, fontSize: '1.4rem', color: '#374151' }}>{totalRedeemed.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>pts</div>
          </div>
        </div>

        {profile?.residentialAreaName && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              🏢 {profile.residentialAreaName}
            </div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>
              {(profile.residentialAreaBuildingPoints ?? 0).toLocaleString()} building pts
            </div>
          </div>
        )}
      </div>

      {/* Motivational message */}
      {nextTier && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#92400e' }}>
          🎯 Earn <strong>{nextTier.pointsNeeded}</strong> more points to redeem HK${nextTier.tier.hkd}!
        </div>
      )}
      {!nextTier && balance >= TIERS[TIERS.length - 1]!.points && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#15803d' }}>
          🏆 You've unlocked all redemption tiers. Keep recycling!
        </div>
      )}

      {/* Feedback messages */}
      {redeemMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#15803d', fontWeight: 600 }}>
          {redeemMsg}
        </div>
      )}
      {redeemError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#dc2626' }}>
          {redeemError.message}
          {redeemError.current !== undefined && redeemError.required !== undefined && (
            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Balance: {redeemError.current} pts · Required: {redeemError.required} pts
            </div>
          )}
        </div>
      )}

      {/* Redemption tiers */}
      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Redeem for Octopus Card</div>
      {TIERS.map(({ tier, points, hkd }) => {
        const canRedeem = balance >= points;
        return (
          <div key={tier} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700 }}>HK${hkd}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{points} points</div>
            </div>
            <button
              className={canRedeem ? 'btn-primary' : 'btn-secondary'}
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
              disabled={!canRedeem || redeeming !== null}
              onClick={() => handleRedeem(tier, points, hkd)}
            >
              {redeeming === tier ? '…' : 'Redeem'}
            </button>
          </div>
        );
      })}

      {/* Residential area leaderboard */}
      {areaLeaderboard.length > 0 && (
        <>
          <div style={{ fontWeight: 600, margin: '1rem 0 0.5rem' }}>
            🏢 Top Buildings in {profile?.district}
          </div>
          {areaLeaderboard.map((area, idx) => (
            <div
              key={area.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: idx === 0 ? '#fefce8' : undefined,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: idx === 0 ? '#ca8a04' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : '#6b7280', minWidth: '1.5rem', textAlign: 'center' }}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${area.rank}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{area.name}</div>
              </div>
              <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>
                {area.totalBuildingPoints.toLocaleString()} pts
              </div>
            </div>
          ))}
        </>
      )}

      {/* Redemption history */}
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
