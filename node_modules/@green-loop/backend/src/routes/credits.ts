import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../lib/response.js';
import { upsertResident, applyLowBalanceDeduction } from '../services/points.js';
import pool from '../db/pool.js';

const router = Router();

const REDEMPTION_TIERS: Record<string, { pointsCost: number; hkdValue: number }> = {
  'tier-1': { pointsCost: 50,  hkdValue: 5  },
  'tier-2': { pointsCost: 100, hkdValue: 10 },
  'tier-3': { pointsCost: 200, hkdValue: 20 },
  'tier-4': { pointsCost: 500, hkdValue: 50 },
};

const LOW_BALANCE_DEDUCTION = 10;

// POST /credits/redeem
router.post('/redeem', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tier } = req.body as { tier: unknown };

    if (typeof tier !== 'string' || !REDEMPTION_TIERS[tier]) {
      sendError(res, 400, 'Invalid redemption tier', 'tier', req.requestId);
      return;
    }

    const tierConfig = REDEMPTION_TIERS[tier]!;
    const resident = req.resident!;
    await upsertResident(resident.residentId, resident.displayName, resident.district);

    // Check if low-balance deduction applies
    const applyDeduction = await applyLowBalanceDeduction(resident.residentId);
    const totalCost = tierConfig.pointsCost + (applyDeduction ? LOW_BALANCE_DEDUCTION : 0);

    // Get current balance
    const balanceResult = await pool.query<{ total_points: number }>(
      `SELECT total_points FROM residents WHERE id = $1`,
      [resident.residentId]
    );
    const currentBalance = balanceResult.rows[0]?.total_points ?? 0;

    if (currentBalance < totalCost) {
      res.status(422).json({
        error: {
          message: 'Insufficient points balance',
          currentBalance,
          requiredBalance: totalCost,
          requestId: req.requestId,
        },
      });
      return;
    }

    // Atomic: deduct points and insert redemption
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updatedResult = await client.query<{ total_points: number }>(
        `UPDATE residents SET total_points = total_points - $1 WHERE id = $2 RETURNING total_points`,
        [totalCost, resident.residentId]
      );
      const updatedBalance = updatedResult.rows[0]!.total_points;

      const redemptionResult = await client.query<{ id: number }>(
        `INSERT INTO redemptions (resident_id, tier, points_cost, hkd_value)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [resident.residentId, tier, totalCost, tierConfig.hkdValue]
      );
      const redemptionId = redemptionResult.rows[0]!.id;

      await client.query('COMMIT');

      sendSuccess(res, {
        redemptionId,
        tier,
        pointsDeducted: totalCost,
        hkdValue: tierConfig.hkdValue,
        updatedBalance,
        lowBalanceDeductionApplied: applyDeduction,
      }, 201);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// GET /credits/redemptions
router.get('/redemptions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resident = req.resident!;

    const result = await pool.query<{
      id: number;
      tier: string;
      points_cost: number;
      hkd_value: number;
      created_at: string;
    }>(
      `SELECT id, tier, points_cost, hkd_value, created_at
       FROM redemptions
       WHERE resident_id = $1
       ORDER BY created_at DESC`,
      [resident.residentId]
    );

    const redemptions = result.rows.map((row: { id: number; tier: string; points_cost: number; hkd_value: number; created_at: string }) => ({
      id: row.id,
      tier: row.tier,
      pointsDeducted: row.points_cost,
      hkdValue: row.hkd_value,
      createdAt: row.created_at,
    }));

    sendSuccess(res, { redemptions });
  } catch (err) {
    next(err);
  }
});

export default router;
