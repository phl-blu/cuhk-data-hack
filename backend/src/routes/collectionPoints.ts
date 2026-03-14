import { Router } from 'express';
import { sendSuccess, sendError } from '../lib/response.js';
import { validateCoordinates, findNearby } from '../services/spatial.js';
import pool from '../db/pool.js';

const router = Router();

// GET /collection-points/nearby
router.get('/nearby', async (req, res, next) => {
  try {
    const { lat, lng, radius } = req.query;

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    const coordCheck = validateCoordinates(
      lat !== undefined ? parsedLat : lat,
      lng !== undefined ? parsedLng : lng
    );
    if (!coordCheck.valid) {
      sendError(res, 400, `Invalid coordinate: ${coordCheck.field}`, coordCheck.field, req.requestId);
      return;
    }

    const MAX_RADIUS = 10_000;
    const requestedRadius = radius !== undefined ? Number(radius) : MAX_RADIUS;
    const effectiveRadius = Math.min(requestedRadius, MAX_RADIUS);
    const cappedRadius = requestedRadius > MAX_RADIUS;

    const points = await findNearby(parsedLat, parsedLng, effectiveRadius);

    sendSuccess(res, { points, cappedRadius });
  } catch (err) {
    next(err);
  }
});

// GET /collection-points
router.get('/', async (req, res, next) => {
  try {
    const { tier } = req.query;

    let query = `
      SELECT
        id,
        name,
        access_tier,
        materials,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng
      FROM collection_points
    `;
    const params: string[] = [];

    if (tier === 'basic' || tier === 'premium') {
      query += ` WHERE access_tier = $1`;
      params.push(tier);
    }

    query += ` ORDER BY id ASC`;

    const result = await pool.query<{
      id: number;
      name: string;
      access_tier: 'basic' | 'premium';
      materials: string[];
      lat: number;
      lng: number;
    }>(query, params);

    const points = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      accessTier: row.access_tier,
      materials: row.materials,
      lat: row.lat,
      lng: row.lng,
    }));

    sendSuccess(res, { points });
  } catch (err) {
    next(err);
  }
});

export default router;
