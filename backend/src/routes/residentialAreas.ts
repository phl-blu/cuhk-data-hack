import { Router } from 'express';
import { sendSuccess, sendError } from '../lib/response.js';
import pool from '../db/pool.js';

const router = Router();

// GET /residential-areas/leaderboard — must be before /:id to avoid route conflict
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { districtId } = req.query;

    let query = `
      SELECT
        ra.id,
        ra.name,
        d.name AS district_name,
        COALESCE(bp.total_points, 0) AS total_points,
        RANK() OVER (
          ${districtId ? 'PARTITION BY ra.district_id ' : ''}
          ORDER BY COALESCE(bp.total_points, 0) DESC
        ) AS rank
      FROM residential_areas ra
      LEFT JOIN building_points bp ON bp.residential_area_id = ra.id
      LEFT JOIN districts d ON d.id = ra.district_id
    `;
    const params: unknown[] = [];

    if (districtId !== undefined) {
      query += ` WHERE ra.district_id = $1`;
      params.push(Number(districtId));
    }

    query += ` ORDER BY total_points DESC`;

    const result = await pool.query<{
      id: number;
      name: string;
      district_name: string | null;
      total_points: string;
      rank: string;
    }>(query, params);

    const areas = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      districtName: row.district_name,
      totalBuildingPoints: Number(row.total_points),
      rank: Number(row.rank),
    }));

    sendSuccess(res, { areas });
  } catch (err) {
    next(err);
  }
});

// GET /residential-areas/:id/points
router.get('/:id/points', async (req, res, next) => {
  try {
    const id = Number(req.params['id']);
    if (isNaN(id)) {
      sendError(res, 400, 'Invalid residential area id', 'id', req.requestId);
      return;
    }

    // Get area info and building points
    const areaResult = await pool.query<{
      id: number;
      name: string;
      district_id: number | null;
      total_points: string;
    }>(
      `SELECT ra.id, ra.name, ra.district_id, COALESCE(bp.total_points, 0) AS total_points
       FROM residential_areas ra
       LEFT JOIN building_points bp ON bp.residential_area_id = ra.id
       WHERE ra.id = $1`,
      [id]
    );

    if (areaResult.rows.length === 0) {
      sendError(res, 404, 'Residential area not found', undefined, req.requestId);
      return;
    }

    const area = areaResult.rows[0]!;

    // Compute rank within district
    const rankResult = await pool.query<{ rank: string }>(
      `SELECT COUNT(*) + 1 AS rank
       FROM residential_areas ra2
       LEFT JOIN building_points bp2 ON bp2.residential_area_id = ra2.id
       WHERE ra2.district_id = $1
         AND COALESCE(bp2.total_points, 0) > $2`,
      [area.district_id, area.total_points]
    );
    const rank = rankResult.rows[0] ? Number(rankResult.rows[0].rank) : null;

    // Get contributor display names
    const contributorsResult = await pool.query<{ display_name: string }>(
      `SELECT DISTINCT display_name FROM residents WHERE residential_area_id = $1`,
      [id]
    );
    const contributors = contributorsResult.rows.map((r) => r.display_name);

    sendSuccess(res, {
      id: area.id,
      name: area.name,
      totalBuildingPoints: Number(area.total_points),
      districtRank: rank,
      contributors,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
