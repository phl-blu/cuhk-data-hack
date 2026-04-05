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
        <div className="section-heading">Credits</div>
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
      <div className="section-heading">💳 Credits</div>

      {/* Balance summary card */}
      <div className="card" style={{ background: '#EFF9F3' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div className="card-label">Balance</div>
            <div className="stat-value">{balance.toLocaleString()}</div>
            <div className="stat-label">pts</div>
          </div>
          <div>
            <div className="card-label">Earned</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0F2D1C' }}>{totalEarned.toLocaleString()}</div>
            <div className="stat-label">pts</div>
          </div>
          <div>
            <div className="card-label">Redeemed</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0F2D1C' }}>{totalRedeemed.toLocaleString()}</div>
            <div className="stat-label">pts</div>
          </div>
        </div>
        {profile?.residentialAreaName && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #B6E8CC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#4D7060' }}>🏢 {profile.residentialAreaName}</span>
            <span style={{ fontWeight: 700, color: '#2AA962', fontSize: 13 }}>
              {(profile.residentialAreaBuildingPoints ?? 0).toLocaleString()} bldg pts
            </span>
          </div>
        )}
      </div>

      {nextTier && (
        <div className="alert-warn">
          🎯 Earn <strong>{nextTier.pointsNeeded}</strong> more pts to redeem HK${nextTier.tier.hkd}
        </div>
      )}
      {!nextTier && balance >= TIERS[TIERS.length - 1]!.points && (
        <div className="alert-success">🏆 All tiers unlocked. Keep recycling!</div>
      )}
      {redeemMsg && <div className="alert-success">{redeemMsg}</div>}
      {redeemError && (
        <div className="alert-error">
          {redeemError.message}
          {redeemError.current !== undefined && redeemError.required !== undefined && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Balance: {redeemError.current} pts · Required: {redeemError.required} pts
            </div>
          )}
        </div>
      )}

      {/* Redemption tiers */}
      <div className="card-label" style={{ marginBottom: 8 }}>Redeem for Octopus Card</div>
      {TIERS.map(({ tier, points, hkd }) => {
        const canRedeem = balance >= points;
        return (
          <div key={tier} className={`tier-card${canRedeem ? '' : ' tier-card-locked'}`}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0F2D1C' }}>HK${hkd}</div>
              <div style={{ fontSize: 12, color: '#8AAD96', marginTop: 2 }}>{points} points required</div>
            </div>
            <button
              className={canRedeem ? 'btn-primary' : 'btn-secondary'}
              style={{ width: 'auto', padding: '8px 20px', fontSize: 13 }}
              disabled={!canRedeem || redeeming !== null}
              onClick={() => handleRedeem(tier, points, hkd)}
            >
              {redeeming === tier ? '…' : 'Redeem'}
            </button>
          </div>
        );
      })}

      {/* Building leaderboard */}
      {areaLeaderboard.length > 0 && (
        <>
          <div className="card-label" style={{ marginTop: 20, marginBottom: 8 }}>
            Top Buildings — {profile?.district}
          </div>
          {areaLeaderboard.map((area, idx) => (
            <div key={area.id} className="lb-row" style={idx === 0 ? { background: '#FFFBEE' } : {}}>
              <div className="lb-rank" style={{ background: idx === 0 ? '#FEF0CC' : '#EFF9F3' }}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="lb-rank-num">#{area.rank}</span>}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0F2D1C' }}>{area.name}</div>
              <div style={{ fontWeight: 700, color: '#2AA962', fontSize: 13 }}>
                {area.totalBuildingPoints.toLocaleString()} pts
              </div>
            </div>
          ))}
        </>
      )}

      {/* History */}
      {redemptions.length > 0 && (
        <>
          <div className="card-label" style={{ marginTop: 20, marginBottom: 8 }}>Redemption History</div>
          {redemptions.map((r) => (
            <div key={r.id} className="info-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>HK${r.hkdValue}</div>
                <div style={{ fontSize: 11, color: '#8AAD96' }}>{new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
              <div style={{ color: '#B91C1C', fontWeight: 600, fontSize: 13 }}>−{r.pointsDeducted} pts</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
