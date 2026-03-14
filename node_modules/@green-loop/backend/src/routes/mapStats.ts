import { Router } from 'express';
import { sendSuccess, sendError } from '../lib/response.js';
import pool from '../db/pool.js';

const router = Router();

// GET /map/stats
router.get('/', async (req, res, next) => {
  try {
    const { minLat, minLng, maxLat, maxLng } = req.query;

    // Validate all four params
    for (const [key, val] of Object.entries({ minLat, minLng, maxLat, maxLng })) {
      if (val === undefined || val === '') {
        sendError(res, 400, `Missing query parameter: ${key}`, key, req.requestId);
        return;
      }
      if (isNaN(Number(val))) {
        sendError(res, 400, `Invalid query parameter: ${key} must be numeric`, key, req.requestId);
        return;
      }
    }

    const bbox = [Number(minLng), Number(minLat), Number(maxLng), Number(maxLat)];
    const envelope = `ST_MakeEnvelope($1, $2, $3, $4, 4326)`;

    // Count checkins within bounding box (using collection_point location)
    const checkinsResult = await pool.query<{ count: string }>(
      `SELECT COUNT(c.id) AS count
       FROM checkins c
       JOIN collection_points cp ON cp.id = c.collection_point_id
       WHERE ST_Within(cp.location, ${envelope})`,
      bbox
    );

    // Sum points from points_transactions for checkins/reports within bbox
    const pointsResult = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(pt.points), 0) AS total
       FROM points_transactions pt
       WHERE (
         pt.transaction_type = 'checkin' AND EXISTS (
           SELECT 1 FROM checkins c
           JOIN collection_points cp ON cp.id = c.collection_point_id
           WHERE c.id = pt.reference_id::integer
             AND ST_Within(cp.location, ${envelope})
         )
       ) OR (
         pt.transaction_type = 'garbage_report' AND EXISTS (
           SELECT 1 FROM garbage_reports gr
           WHERE gr.id = pt.reference_id::integer
             AND ST_Within(gr.location, ${envelope})
         )
       )`,
      bbox
    );

    // Count garbage reports within bounding box
    const reportsResult = await pool.query<{ count: string }>(
      `SELECT COUNT(id) AS count
       FROM garbage_reports
       WHERE ST_Within(location, ${envelope})`,
      bbox
    );

    sendSuccess(res, {
      totalCheckins: Number(checkinsResult.rows[0]!.count),
      totalPoints: Number(pointsResult.rows[0]!.total),
      totalGarbageReports: Number(reportsResult.rows[0]!.count),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
