import cron from 'node-cron';
import pool from '../db/pool.js';
import { normalizeOpenSpace, type OpenSpaceRaw } from './normalizers/openSpace.js';
import {
  normalizeRecyclableCollection,
  type RecyclableCollectionRaw,
} from './normalizers/recyclableCollection.js';
import { normalizePopulationCensus, type PopulationCensusRaw } from './normalizers/populationCensus.js';
import { normalizeHousingEstates, type HousingEstateRaw } from './normalizers/housingEstates.js';

async function fetchGeoJson(url: string): Promise<Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }>> {
  const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'GreenLoopApp/1.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' fetching ' + url);
  const json = await res.json() as { features?: Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }> };
  return json.features ?? [];
}

function extractCoords(geometry: { type: string; coordinates: unknown }): { lat: number; lng: number } | null {
  if (!geometry) return null;
  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates as [number, number];
    return { lat, lng };
  }
  if (geometry.type === 'Polygon') {
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


async function fetchOpenSpace(): Promise<OpenSpaceRaw[]> {
  const url = process.env['OPEN_SPACE_API_URL'] ??
    'https://portal.csdi.gov.hk/server/services/common/epd_rcd_1669597014943_12158/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=OS_POLYGON_INV_EPD&outputFormat=geojson&count=5000';
  try {
    const features = await fetchGeoJson(url);
    console.log('[ingestion] open_space raw feature count: ' + features.length);
    if (features.length > 0) console.log('[ingestion] open_space sample properties:', JSON.stringify(features[0]?.properties));
    return features.map((f) => {
      const p = f.properties;
      const coords = extractCoords(f.geometry);
      return { sourceId: p['OBJECTID'] ?? p['objectid'] ?? p['id'], name: p['FACNAME_EN'] ?? p['NAME_EN'] ?? p['NAME'] ?? 'Recycling Station', lat: coords?.lat, lng: coords?.lng, materials: [] } as OpenSpaceRaw;
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
    console.log('[ingestion] recyclable_collection raw feature count: ' + features.length);
    if (features.length > 0) {
      console.log('[ingestion] recyclable_collection sample properties:', JSON.stringify(features[0]?.properties));
      console.log('[ingestion] recyclable_collection sample geometry:', JSON.stringify(features[0]?.geometry));
    }
    return features.map((f) => {
      const p = f.properties;
      const coords = extractCoords(f.geometry);
      return { sourceId: p['OBJECTID'] ?? p['objectid'] ?? p['id'], name: p['FACNAME_EN'] ?? p['NAME_EN'] ?? p['NAME'] ?? 'Collection Point', lat: coords?.lat, lng: coords?.lng, materials: [], type: p['TYPE'] ?? p['type'] ?? p['CATEGORY'] ?? p['category'] } as RecyclableCollectionRaw;
    });
  } catch (err) {
    console.error('[ingestion] fetchRecyclableCollection failed', err);
    return [];
  }
}

async function fetchCensus(): Promise<PopulationCensusRaw[]> {
  if (!process.env['CENSUS_API_URL']) return [];
  return [];
}

async function fetchHousingEstates(): Promise<HousingEstateRaw[]> {
  if (!process.env['HOUSING_ESTATES_API_URL']) return [];
  return [];
}


// Build parameterized SQL row placeholder: ($1, $2, ...) starting at startIdx (1-based)
function rowPlaceholder(startIdx: number, colCount: number): string {
  const parts: string[] = [];
  for (let i = 0; i < colCount; i++) {
    parts.push('$' + (startIdx + i));
  }
  return '(' + parts.join(', ') + ')';
}

async function upsertCollectionPoints(
  records: Array<{ sourceId: string; source: string; name: string; lat: number; lng: number; materials: string[]; accessTier: string }>
): Promise<void> {
  if (records.length === 0) return;

  // Acquire a single client for the whole batch to avoid pool exhaustion
  const client = await pool.connect();
  try {
    const CHUNK = 200;
    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK);
      const values: unknown[] = [];
      const rows: string[] = [];

      chunk.forEach((r, idx) => {
        const base = idx * 7 + 1;
        values.push(r.sourceId, r.source, r.name, r.accessTier, r.materials, r.lng, r.lat);
        // location uses ST_MakePoint(lng, lat) so we inline those two params
        rows.push(
          '(' +
          '$' + base + ', ' +
          '$' + (base + 1) + ', ' +
          '$' + (base + 2) + ', ' +
          '$' + (base + 3) + ', ' +
          '$' + (base + 4) + ', ' +
          'ST_SetSRID(ST_MakePoint($' + (base + 5) + ', $' + (base + 6) + '), 4326)' +
          ')'
        );
      });

      const sql =
        'INSERT INTO collection_points (source_id, source, name, access_tier, materials, location) VALUES ' +
        rows.join(', ') +
        ' ON CONFLICT (source_id) DO UPDATE SET' +
        ' name = EXCLUDED.name,' +
        ' access_tier = EXCLUDED.access_tier,' +
        ' materials = EXCLUDED.materials,' +
        ' updated_at = NOW()';

      await client.query(sql, values);
    }
  } finally {
    client.release();
  }
}


async function upsertHousingEstates(
  records: Array<{ sourceId: string; name: string; districtName: string; lat: number; lng: number }>
): Promise<void> {
  if (records.length === 0) return;
  for (const r of records) {
    const districtResult = await pool.query('SELECT id FROM districts WHERE name = $1 LIMIT 1', [r.districtName]);
    const districtId: number | null = districtResult.rows.length > 0 ? districtResult.rows[0].id : null;
    await pool.query(
      'INSERT INTO housing_estates (source_id, name, district_id, location) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)) ON CONFLICT (source_id) DO UPDATE SET name = EXCLUDED.name',
      [r.sourceId, r.name, districtId, r.lng, r.lat]
    );
  }
}

async function setIngestionStatus(datasetName: string, status: 'ok' | 'error', recordCount: number): Promise<void> {
  await pool.query(
    'INSERT INTO dataset_ingestion_status (dataset_name, last_ingested, record_count, status) VALUES ($1, NOW(), $2, $3) ON CONFLICT (dataset_name) DO UPDATE SET last_ingested = NOW(), record_count = EXCLUDED.record_count, status = EXCLUDED.status',
    [datasetName, recordCount, status]
  );
}

export async function runIngestion(): Promise<void> {
  console.log('[ingestion] Starting ingestion run');

  try {
    const raw = await fetchOpenSpace();
    const normalized = normalizeOpenSpace(raw);
    await upsertCollectionPoints(normalized);
    await setIngestionStatus('open_space', 'ok', normalized.length);
    console.log('[ingestion] open_space: ' + normalized.length + ' records upserted');
  } catch (err) {
    console.error('[ingestion] open_space failed', err);
    await setIngestionStatus('open_space', 'error', 0).catch(() => {});
  }

  try {
    const raw = await fetchRecyclableCollection();
    const normalized = normalizeRecyclableCollection(raw);
    await upsertCollectionPoints(normalized);
    await setIngestionStatus('recyclable_collection', 'ok', normalized.length);
    console.log('[ingestion] recyclable_collection: ' + normalized.length + ' records upserted');
  } catch (err) {
    console.error('[ingestion] recyclable_collection failed', err);
    await setIngestionStatus('recyclable_collection', 'error', 0).catch(() => {});
  }

  try {
    const raw = await fetchCensus();
    const normalized = normalizePopulationCensus(raw);
    await setIngestionStatus('population_census', 'ok', normalized.length);
    console.log('[ingestion] population_census: ' + normalized.length + ' records processed');
  } catch (err) {
    console.error('[ingestion] population_census failed', err);
    await setIngestionStatus('population_census', 'error', 0).catch(() => {});
  }

  try {
    const raw = await fetchHousingEstates();
    const normalized = normalizeHousingEstates(raw);
    await upsertHousingEstates(normalized);
    await setIngestionStatus('housing_estates', 'ok', normalized.length);
    console.log('[ingestion] housing_estates: ' + normalized.length + ' records upserted');
  } catch (err) {
    console.error('[ingestion] housing_estates failed', err);
    await setIngestionStatus('housing_estates', 'error', 0).catch(() => {});
  }

  console.log('[ingestion] Ingestion run complete');
}

export function startScheduler(): void {
  // Delay 30s so the app can serve API requests before ingestion starts
  setTimeout(() => {
    runIngestion().catch((err) => console.error('[ingestion] Initial run failed', err));
  }, 30_000);

  const intervalHours = parseInt(process.env['INGEST_INTERVAL_HOURS'] ?? '24', 10);
  const cronExpression = '0 0 */' + intervalHours + ' * * *';

  cron.schedule(cronExpression, () => {
    runIngestion().catch((err) => console.error('[ingestion] Scheduled run failed', err));
  });

  console.log('[ingestion] Scheduler started — cron: ' + cronExpression);
}
