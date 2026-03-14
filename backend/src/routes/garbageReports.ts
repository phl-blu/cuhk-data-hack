import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../lib/response.js';
import { validateCoordinates, pointInDistrict, findInBoundingBox } from '../services/spatial.js';
import { awardGarbageReport, upsertResident } from '../services/points.js';
import pool from '../db/pool.js';

const router = Router();

// POST /garbage-reports
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { lat, lng, photoUrl } = req.body as {
      lat: unknown;
      lng: unknown;
      photoUrl: unknown;
    };

    // Validate coordinates
    const coordCheck = validateCoordinates(lat, lng);
    if (!coordCheck.valid) {
      sendError(res, 400, `Invalid coordinate: ${coordCheck.field}`, coordCheck.field, req.requestId);
      return;
    }

    // Validate photoUrl
    if (!photoUrl || typeof photoUrl !== 'string') {
      sendError(res, 400, 'photoUrl is required', 'photoUrl', req.requestId);
      return;
    }

    const resident = req.resident!;

    // Ensure resident exists in DB
    await upsertResident(resident.residentId, resident.displayName, resident.district);

    // Derive district from coordinates
    const districtId = await pointInDistrict(lat as number, lng as number);

    // Insert garbage report
    const reportResult = await pool.query<{ id: number }>(
      `INSERT INTO garbage_reports (resident_id, district_id, location, photo_url, points_awarded)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326), $5, 15)
       RETURNING id`,
      [resident.residentId, districtId, lat, lng, photoUrl]
    );
    const reportId = reportResult.rows[0]!.id;

    // Award points
    const result = await awardGarbageReport(resident.residentId, reportId);

    sendSuccess(res, {
      reportId,
      pointsAwarded: result.pointsAwarded,
      totalPoints: result.totalPoints,
    }, 201);
  } catch (err) {
    next(err);
  }
});

// GET /garbage-reports
router.get('/', async (req, res, next) => {
  try {
    const { minLat, minLng, maxLat, maxLng } = req.query;

    // Validate all four params are present and numeric
    const params = { minLat, minLng, maxLat, maxLng };
    for (const [key, val] of Object.entries(params)) {
      if (val === undefined || val === null || val === '') {
        sendError(res, 400, `Missing query parameter: ${key}`, key, req.requestId);
        return;
      }
      if (isNaN(Number(val))) {
        sendError(res, 400, `Invalid query parameter: ${key} must be numeric`, key, req.requestId);
        return;
      }
    }

    const reports = await findInBoundingBox(
      Number(minLat),
      Number(minLng),
      Number(maxLat),
      Number(maxLng)
    );

    sendSuccess(res, { reports });
  } catch (err) {
    next(err);
  }
});

export default router;
