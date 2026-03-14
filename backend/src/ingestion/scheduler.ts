import cron from 'node-cron';
import pool from '../db/pool.js';
import { normalizeOpenSpace, type OpenSpaceRaw } from './normalizers/openSpace.js';
import {
  normalizeRecyclableCollection,
  type RecyclableCollectionRaw,
} from './normalizers/recyclableCollection.js';
import { normalizePopulationCensus, type PopulationCensusRaw } from './normalizers/populationCensus.js';
import { normalizeHousingEstates, type HousingEstateRaw } from './normalizers/housingEstates.js';

// ---------------------------------------------------------------------------
// Generic GeoJSON WFS fetcher
// ---------------------------------------------------------------------------

async function fetchGeoJson(url: string): Promise<Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }>> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'GreenLoopApp/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const json = await res.json() as { features?: Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }> };
  return json.features ?? [];
}

// Extract centroid lng/lat from a GeoJSON geometry (Point or Polygon)
function extractCoords(geometry: { type: string; coordinates: unknown }): { lat: number; lng: number } | null {
  if (!geometry) return null;
  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates as [number, number];
    return { lat, lng };
  }
  if (geometry.type === 'Polygon') {
    // Use centroid of first ring
    const ring = (geometry.coordinates as number[][][])[0];
    if (!ring || ring.length === 0) return null;
    const lng = ring.reduce((s, p) => s + p[0]!, 0) / ring.length;
    const lat = ring.reduce((s, p) => s + p[1]!, 0) / ring.length;
    return { lat, lng };
  }
  if (geometry.type === 'MultiPolygon') {
    const firstRing = ((geometry.coordinates as number[][][][])[0])?.[0];
    if (!firstRing || firstRing.length === 0) return null;
    const lng = firstRing.reduce((s, p) => s + p[0]!, 0) / firstRing.length;
    const lat = firstRing.reduce((s, p) => s + p[1]!, 0) / firstRing.length;
    return { lat, lng };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Placeholder fetch functions — real URLs come from env vars
// ---------------------------------------------------------------------------

async function fetchOpenSpace(): Promise<OpenSpaceRaw[]> {
  const url = process.env['OPEN_SPACE_API_URL'] ??
    'https://portal.csdi.gov.hk/server/services/common/epd_rcd_1669597014943_12158/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=OS_POLYGON_INV_EPD&outputFormat=geojson&count=5000';
  try {
    const features = await fetchGeoJson(url);
    return features.map((f) => {
      const p = f.properties;
      const coords = extractCoords(f.geometry);
      return {
        sourceId: p['OBJECTID'] ?? p['objectid'] ?? p['id'],
        name: p['FACNAME_EN'] ?? p['facname_en'] ?? p['NAME_EN'] ?? p['name_en'] ?? p['NAME'] ?? p['name'] ?? 'Recycling Station',
        lat: coords?.lat,
        lng: coords?.lng,
        materials: [],
      } as OpenSpaceRaw;
    });
  } catch (err) {
    console.error('[ingestion] fetchOpenSpace failed', err);
    return [];
  }
}

async function fetchRecyclableCollection(): Promise<RecyclableCollectionRaw[]> {
  const url = process.env['RECYCLABLE_COLLECTION_API_URL'] ??
    'https://portal.csdi.gov.hk/server/services/common/epd_rcd_1630899452408_9505/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=geotagging&outputFormat=geojson&count=5000';
  try {
    const features = await fetchGeoJson(url);
    return features.map((f) => {
      const p = f.properties;
      const coords = extractCoords(f.geometry);
      return {
        sourceId: p['OBJECTID'] ?? p['objectid'] ?? p['id'],
        name: p['FACNAME_EN'] ?? p['facname_en'] ?? p['NAME_EN'] ?? p['name_en'] ?? p['NAME'] ?? p['name'] ?? 'Collection Point',
        lat: coords?.lat,
        lng: coords?.lng,
        materials: [],
        type: p['TYPE'] ?? p['type'] ?? p['CATEGORY'] ?? p['category'],
      } as RecyclableCollectionRaw;
    });
  } catch (err) {
    console.error('[ingestion] fetchRecyclableCollection failed', err);
    return [];
  }
}

async function fetchCensus(): Promise<PopulationCensusRaw[]> {
  const url = process.env['CENSUS_API_URL'];
  if (!url) return [];
  return [];
}

async function fetchHousingEstates(): Promise<HousingEstateRaw[]> {
  const url = process.env['HOUSING_ESTATES_API_URL'];
  if (!url) return [];
  return [];
}

// ---------------------------------------------------------------------------
// Upsert helpers
// ---------------------------------------------------------------------------

async function upsertCollectionPoints(
  records: Array<{
    sourceId: string;
    source: string;
    name: string;
    lat: number;
    lng: number;
    materials: string[];
    accessTier: string;
  }>
): Promise<void> {
  if (records.length === 0) return;

  for (const r of records) {
    await pool.query(
      `INSERT INTO collection_points (source_id, source, name, access_tier, materials, location)
       VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326))
       ON CONFLICT (source_id) DO UPDATE
         SET name        = EXCLUDED.name,
             access_tier = EXCLUDED.access_tier,
             materials   = EXCLUDED.materials,
             updated_at  = NOW()`,
      [r.sourceId, r.source, r.name, r.accessTier, r.materials, r.lng, r.lat]
    );
  }
}

async function upsertHousingEstates(
  records: Array<{ sourceId: string; name: string; districtName: string; lat: number; lng: number }>
): Promise<void> {
  if (records.length === 0) return;

  for (const r of records) {
    // Resolve district_id from name (best-effort; null if not found)
    const districtResult = await pool.query(
      `SELECT id FROM districts WHERE name = $1 LIMIT 1`,
      [r.districtName]
    );
    const districtId: number | null =
      districtResult.rows.length > 0 ? districtResult.rows[0].id : null;

    await pool.query(
      `INSERT INTO housing_estates (source_id, name, district_id, location)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
       ON CONFLICT (source_id) DO UPDATE
         SET name = EXCLUDED.name`,
      [r.sourceId, r.name, districtId, r.lng, r.lat]
    );
  }
}

async function setIngestionStatus(
  datasetName: string,
  status: 'ok' | 'error',
  recordCount: number
): Promise<void> {
  await pool.query(
    `INSERT INTO dataset_ingestion_status (dataset_name, last_ingested, record_count, status)
     VALUES ($1, NOW(), $2, $3)
     ON CONFLICT (dataset_name) DO UPDATE
       SET last_ingested = NOW(),
           record_count  = EXCLUDED.record_count,
           status        = EXCLUDED.status`,
    [datasetName, recordCount, status]
  );
}

// ---------------------------------------------------------------------------
// Main ingestion run
// ---------------------------------------------------------------------------

export async function runIngestion(): Promise<void> {
  console.log('[ingestion] Starting ingestion run');

  // --- Open Space ---
  try {
    const raw = await fetchOpenSpace();
    const normalized = normalizeOpenSpace(raw);
    await upsertCollectionPoints(normalized);
    await setIngestionStatus('open_space', 'ok', normalized.length);
    console.log(`[ingestion] open_space: ${normalized.length} records upserted`);
  } catch (err) {
    console.error('[ingestion] open_space failed', err);
    await setIngestionStatus('open_space', 'error', 0).catch(() => {});
  }

  // --- Recyclable Collection ---
  try {
    const raw = await fetchRecyclableCollection();
    const normalized = normalizeRecyclableCollection(raw);
    await upsertCollectionPoints(normalized);
    await setIngestionStatus('recyclable_collection', 'ok', normalized.length);
    console.log(`[ingestion] recyclable_collection: ${normalized.length} records upserted`);
  } catch (err) {
    console.error('[ingestion] recyclable_collection failed', err);
    await setIngestionStatus('recyclable_collection', 'error', 0).catch(() => {});
  }

  // --- Population Census ---
  try {
    const raw = await fetchCensus();
    const normalized = normalizePopulationCensus(raw);
    // Census data is for context only — no DB upsert required at this stage
    await setIngestionStatus('population_census', 'ok', normalized.length);
    console.log(`[ingestion] population_census: ${normalized.length} records processed`);
  } catch (err) {
    console.error('[ingestion] population_census failed', err);
    await setIngestionStatus('population_census', 'error', 0).catch(() => {});
  }

  // --- Housing Estates ---
  try {
    const raw = await fetchHousingEstates();
    const normalized = normalizeHousingEstates(raw);
    await upsertHousingEstates(normalized);
    await setIngestionStatus('housing_estates', 'ok', normalized.length);
    console.log(`[ingestion] housing_estates: ${normalized.length} records upserted`);
  } catch (err) {
    console.error('[ingestion] housing_estates failed', err);
    await setIngestionStatus('housing_estates', 'error', 0).catch(() => {});
  }

  console.log('[ingestion] Ingestion run complete');
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export function startScheduler(): void {
  // Run immediately on startup
  runIngestion().catch((err) => console.error('[ingestion] Initial run failed', err));

  // Schedule recurring runs
  const intervalHours = parseInt(process.env['INGEST_INTERVAL_HOURS'] ?? '24', 10);
  const cronExpression = `0 0 */${intervalHours} * * *`;

  cron.schedule(cronExpression, () => {
    runIngestion().catch((err) => console.error('[ingestion] Scheduled run failed', err));
  });

  console.log(`[ingestion] Scheduler started — cron: ${cronExpression}`);
}
