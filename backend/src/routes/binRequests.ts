import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../lib/response.js';
import { validateCoordinates, pointInDistrict } from '../services/spatial.js';
import { upsertResident } from '../services/points.js';
import pool from '../db/pool.js';

const router = Router();

// POST /bin-requests
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { lat, lng, description } = req.body as {
      lat: unknown;
      lng: unknown;
      description?: unknown;
    };

    const coordCheck = validateCoordinates(lat, lng);
    if (!coordCheck.valid) {
      sendError(res, 400, `Invalid coordinate: ${coordCheck.field}`, coordCheck.field, req.requestId);
      return;
    }

    const resident = req.resident!;
    await upsertResident(resident.residentId, resident.displayName, resident.district);

    const districtId = await pointInDistrict(lat as number, lng as number);

    const result = await pool.query<{ id: number; created_at: string }>(
      `INSERT INTO bin_requests (resident_id, district_id, location, description)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326), $5)
       RETURNING id, created_at`,
      [resident.residentId, districtId, lat, lng, description ?? null]
    );

    sendSuccess(res, {
      requestId: result.rows[0]!.id,
      message: 'Bin request submitted successfully',
      createdAt: result.rows[0]!.created_at,
    }, 201);
  } catch (err) {
    next(err);
  }
});

export default router;
