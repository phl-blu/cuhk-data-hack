import pool from '../db/pool.js';

export interface CollectionPointNearby {
  id: number;
  name: string;
  accessTier: 'basic' | 'premium';
  materials: string[];
  lat: number;
  lng: number;
  distanceMetres: number;
}

export interface GarbageReportLocation {
  id: number;
  lat: number;
  lng: number;
  districtId: number | null;
  photoUrl: string;
  createdAt: string;
}

const MAX_RADIUS_METRES = 10_000;

export function validateCoordinates(
  lat: unknown,
  lng: unknown
): { valid: boolean; field?: string } {
  if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
    return { valid: false, field: 'lat' };
  }
  if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
    return { valid: false, field: 'lng' };
  }
  return { valid: true };
}

export async function findNearby(
  lat: number,
  lng: number,
  radiusMetres: number
): Promise<CollectionPointNearby[] & { cappedRadius?: boolean }> {
  const cappedRadius = radiusMetres > MAX_RADIUS_METRES;
  const effectiveRadius = cappedRadius ? MAX_RADIUS_METRES : radiusMetres;

  const result = await pool.query<{
    id: number;
    name: string;
    access_tier: 'basic' | 'premium';
    materials: string[];
    lat: number;
    lng: number;
    distance_metres: number;
  }>(
    `SELECT
       cp.id,
       cp.name,
       cp.access_tier,
       cp.materials,
       ST_Y(cp.location::geometry) AS lat,
       ST_X(cp.location::geometry) AS lng,
       ST_Distance(
         cp.location::geography,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
       ) AS distance_metres
     FROM collection_points cp
     WHERE ST_DWithin(
       cp.location::geography,
       ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
       $3
     )
     ORDER BY distance_metres ASC`,
    [lat, lng, effectiveRadius]
  );

  const rows: CollectionPointNearby[] = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    accessTier: row.access_tier,
    materials: row.materials,
    lat: row.lat,
    lng: row.lng,
    distanceMetres: row.distance_metres,
  }));

  const output = rows as CollectionPointNearby[] & { cappedRadius?: boolean };
  if (cappedRadius) {
    output.cappedRadius = true;
  }
  return output;
}

export async function pointInDistrict(
  lat: number,
  lng: number
): Promise<number | null> {
  const result = await pool.query<{ id: number }>(
    `SELECT id
     FROM districts
     WHERE ST_Contains(boundary, ST_SetSRID(ST_MakePoint($2, $1), 4326))
     LIMIT 1`,
    [lat, lng]
  );

  return result.rows.length > 0 ? result.rows[0]!.id : null;
}

export async function findInBoundingBox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number
): Promise<GarbageReportLocation[]> {
  const result = await pool.query<{
    id: number;
    lat: number;
    lng: number;
    district_id: number | null;
    photo_url: string;
    created_at: string;
  }>(
    `SELECT
       gr.id,
       ST_Y(gr.location::geometry) AS lat,
       ST_X(gr.location::geometry) AS lng,
       gr.district_id,
       gr.photo_url,
       gr.created_at
     FROM garbage_reports gr
     WHERE ST_Within(
       gr.location,
       ST_MakeEnvelope($1, $2, $3, $4, 4326)
     )`,
    [minLng, minLat, maxLng, maxLat]
  );

  return result.rows.map((row) => ({
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    districtId: row.district_id,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
  }));
}
