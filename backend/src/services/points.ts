import pool from '../db/pool.js';

export interface PointsTransaction {
  id: number;
  points: number;
  transactionType: 'checkin' | 'garbage_report';
  referenceId: string;
  createdAt: string;
}

const CHECKIN_POINTS: Record<'basic' | 'premium', number> = {
  basic: 10,
  premium: 20,
};

const UNDERSERVED_PREMIUM_MULTIPLIER = 1.5;
const GARBAGE_REPORT_POINTS = 15;

export async function awardCheckIn(
  residentId: string,
  collectionPointId: number,
  tier: 'basic' | 'premium',
  lat: number,
  lng: number,
  isUnderserved = false
): Promise<{ pointsAwarded: number; buildingPointsAwarded: number; totalPoints: number; checkinId: number }> {
  const basePoints = CHECKIN_POINTS[tier];
  const pointsAwarded = (tier === 'premium' && isUnderserved)
    ? Math.round(basePoints * UNDERSERVED_PREMIUM_MULTIPLIER)
    : basePoints;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert checkin record
    const checkinResult = await client.query<{ id: number }>(
      `INSERT INTO checkins (resident_id, collection_point_id, resident_lat, resident_lng, points_awarded)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [residentId, collectionPointId, lat, lng, pointsAwarded]
    );
    const checkinId = checkinResult.rows[0]!.id;

    // Resolve residential_area_id for building points
    const raResult = await client.query<{ residential_area_id: number | null }>(
      `SELECT residential_area_id FROM residents WHERE id = $1`,
      [residentId]
    );
    const residentialAreaId = raResult.rows[0]?.residential_area_id ?? null;

    // Insert points transaction with individual + building columns
    await client.query(
      `INSERT INTO points_transactions (resident_id, points, individual_points, building_points, transaction_type, reference_id)
       VALUES ($1, $2, $2, $3, 'checkin', $4)`,
      [residentId, pointsAwarded, residentialAreaId ? pointsAwarded : 0, String(checkinId)]
    );

    // Update resident totals
    const residentResult = await client.query<{ total_points: number }>(
      `UPDATE residents
       SET total_points = total_points + $1, checkin_count = checkin_count + 1
       WHERE id = $2
       RETURNING total_points`,
      [pointsAwarded, residentId]
    );
    const totalPoints = residentResult.rows[0]!.total_points;

    // Upsert district_points
    await client.query(
      `INSERT INTO district_points (district_id, total_points, updated_at)
       SELECT district_id, $1, NOW() FROM residents WHERE id = $2
       ON CONFLICT (district_id) DO UPDATE
         SET total_points = district_points.total_points + $1,
             updated_at = NOW()`,
      [pointsAwarded, residentId]
    );

    // Upsert building_points for residential area if applicable
    let buildingPointsAwarded = 0;
    if (residentialAreaId) {
      buildingPointsAwarded = pointsAwarded;
      await client.query(
        `INSERT INTO building_points (residential_area_id, total_points, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (residential_area_id) DO UPDATE
           SET total_points = building_points.total_points + $2,
               updated_at = NOW()`,
        [residentialAreaId, pointsAwarded]
      );
    }

    await client.query('COMMIT');
    return { pointsAwarded, buildingPointsAwarded, totalPoints, checkinId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function awardGarbageReport(
  residentId: string,
  reportId: number
): Promise<{ pointsAwarded: number; buildingPointsAwarded: number; totalPoints: number }> {
  const pointsAwarded = GARBAGE_REPORT_POINTS;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve residential_area_id
    const raResult = await client.query<{ residential_area_id: number | null }>(
      `SELECT residential_area_id FROM residents WHERE id = $1`,
      [residentId]
    );
    const residentialAreaId = raResult.rows[0]?.residential_area_id ?? null;

    // Insert points transaction
    await client.query(
      `INSERT INTO points_transactions (resident_id, points, individual_points, building_points, transaction_type, reference_id)
       VALUES ($1, $2, $2, $3, 'garbage_report', $4)`,
      [residentId, pointsAwarded, residentialAreaId ? pointsAwarded : 0, String(reportId)]
    );

    // Update resident totals
    const residentResult = await client.query<{ total_points: number }>(
      `UPDATE residents
       SET total_points = total_points + $1, report_count = report_count + 1
       WHERE id = $2
       RETURNING total_points`,
      [pointsAwarded, residentId]
    );
    const totalPoints = residentResult.rows[0]!.total_points;

    // Upsert district_points
    await client.query(
      `INSERT INTO district_points (district_id, total_points, updated_at)
       SELECT district_id, $1, NOW() FROM residents WHERE id = $2
       ON CONFLICT (district_id) DO UPDATE
         SET total_points = district_points.total_points + $1,
             updated_at = NOW()`,
      [pointsAwarded, residentId]
    );

    // Upsert building_points for residential area if applicable
    let buildingPointsAwarded = 0;
    if (residentialAreaId) {
      buildingPointsAwarded = pointsAwarded;
      await client.query(
        `INSERT INTO building_points (residential_area_id, total_points, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (residential_area_id) DO UPDATE
           SET total_points = building_points.total_points + $2,
               updated_at = NOW()`,
        [residentialAreaId, pointsAwarded]
      );
    }

    await client.query('COMMIT');
    return { pointsAwarded, buildingPointsAwarded, totalPoints };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function isDuplicateCheckIn(
  residentId: string,
  collectionPointId: number
): Promise<boolean> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM checkins
     WHERE resident_id = $1
       AND collection_point_id = $2
       AND created_at > NOW() - INTERVAL '60 minutes'`,
    [residentId, collectionPointId]
  );
  return parseInt(result.rows[0]!.count, 10) > 0;
}

export async function getPointsHistory(residentId: string): Promise<PointsTransaction[]> {
  const result = await pool.query<{
    id: number;
    points: number;
    transaction_type: 'checkin' | 'garbage_report';
    reference_id: string;
    created_at: string;
  }>(
    `SELECT id, points, transaction_type, reference_id, created_at
     FROM points_transactions
     WHERE resident_id = $1
     ORDER BY created_at DESC`,
    [residentId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    points: row.points,
    transactionType: row.transaction_type,
    referenceId: row.reference_id,
    createdAt: row.created_at,
  }));
}

export async function upsertResident(
  residentId: string,
  displayName: string,
  districtName: string
): Promise<void> {
  const districtResult = await pool.query<{ id: number }>(
    `SELECT id FROM districts WHERE name = $1`,
    [districtName]
  );
  const districtId = districtResult.rows[0]?.id ?? null;

  await pool.query(
    `INSERT INTO residents (id, display_name, district_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [residentId, displayName, districtId]
  );
}

// Check if resident's balance fell below 50 after their last redemption.
// Returns true if a 10-pt deduction should be applied to the next redemption.
export async function applyLowBalanceDeduction(residentId: string): Promise<boolean> {
  // Get the resident's current total_points and the timestamp of their last redemption
  const result = await pool.query<{ total_points: number; last_redemption_at: string | null }>(
    `SELECT
       r.total_points,
       (SELECT created_at FROM redemptions WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 1) AS last_redemption_at
     FROM residents r
     WHERE r.id = $1`,
    [residentId]
  );

  if (result.rows.length === 0) return false;

  const { total_points, last_redemption_at } = result.rows[0]!;

  // No prior redemption — no deduction
  if (!last_redemption_at) return false;

  // Check if balance dropped below 50 after the last redemption
  // We approximate this by checking if current balance < 50
  return total_points < 50;
}
