import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../lib/response.js';
import { validateCoordinates, findNearby } from '../services/spatial.js';
import { isDuplicateCheckIn, awardCheckIn, upsertResident } from '../services/points.js';
import pool from '../db/pool.js';

const router = Router();

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { collectionPointId, lat, lng } = req.body as {
      collectionPointId: unknown;
      lat: unknown;
      lng: unknown;
    };

    // Validate coordinates
    const coordCheck = validateCoordinates(lat, lng);
    if (!coordCheck.valid) {
      sendError(res, 400, `Invalid coordinate: ${coordCheck.field}`, coordCheck.field, req.requestId);
      return;
    }

    if (typeof collectionPointId !== 'number') {
      sendError(res, 400, 'collectionPointId must be a number', 'collectionPointId', req.requestId);
      return;
    }

    const resident = req.resident!;

    // Ensure resident exists in DB
    await upsertResident(resident.residentId, resident.displayName, resident.district);

    // Duplicate check-in
    const duplicate = await isDuplicateCheckIn(resident.residentId, collectionPointId);
    if (duplicate) {
      res.status(409).json({
        error: {
          message: 'Already checked in recently',
          retryAfterSeconds: 3600,
          requestId: req.requestId,
        },
      });
      return;
    }

    // Proximity check: find nearby within 200 m
    const nearby = await findNearby(lat as number, lng as number, 200);
    const found = nearby.find((p) => p.id === collectionPointId);
    if (!found) {
      sendError(res, 422, 'Collection point is not within 200 metres of your location', undefined, req.requestId);
      return;
    }

    // Get collection point tier from DB
    const cpResult = await pool.query<{ access_tier: 'basic' | 'premium' }>(
      `SELECT access_tier FROM collection_points WHERE id = $1`,
      [collectionPointId]
    );
    if (cpResult.rows.length === 0) {
      sendError(res, 422, 'Collection point not found', undefined, req.requestId);
      return;
    }
    const tier = cpResult.rows[0]!.access_tier;

    // Award points
    const result = await awardCheckIn(
      resident.residentId,
      collectionPointId,
      tier,
      lat as number,
      lng as number
    );

    sendSuccess(res, {
      pointsAwarded: result.pointsAwarded,
      totalPoints: result.totalPoints,
      checkinId: result.checkinId,
    }, 201);
  } catch (err) {
    next(err);
  }
});

export default router;
