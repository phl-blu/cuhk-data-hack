import { Router } from 'express';
import { sendSuccess } from '../lib/response.js';
import pool from '../db/pool.js';

const router = Router();

// GET /leaderboard
router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query<{
      district_name: string;
      total_points: string;
      area_km2: number;
      points_per_km2: number;
    }>(
      `SELECT
         d.name AS district_name,
         COALESCE(dp.total_points, 0) AS total_points,
         d.area_km2,
         COALESCE(dp.total_points, 0)::double precision / NULLIF(d.area_km2, 0) AS points_per_km2
       FROM districts d
       LEFT JOIN district_points dp ON dp.district_id = d.id
       ORDER BY points_per_km2 DESC NULLS LAST`
    );

    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      districtName: row.district_name,
      totalPoints: Number(row.total_points),
      areaKm2: row.area_km2,
      pointsPerKm2: row.points_per_km2 ?? 0,
    }));

    sendSuccess(res, { leaderboard });
  } catch (err) {
    next(err);
  }
});

export default router;
