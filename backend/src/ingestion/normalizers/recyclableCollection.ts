export interface RecyclableCollectionRaw {
  sourceId?: unknown;
  name?: unknown;
  lat?: unknown;
  lng?: unknown;
  materials?: unknown;
  type?: unknown;
  category?: unknown;
  [key: string]: unknown;
}

export interface RecyclableCollectionNormalized {
  sourceId: string;
  source: 'recyclable_collection';
  name: string;
  lat: number;
  lng: number;
  materials: string[];
  accessTier: 'basic' | 'premium';
}

const RECYCLING_STATION_KEYWORDS = ['recycling station', 'recycling centre', 'recycling center'];

function classifyAccessTier(record: RecyclableCollectionRaw): 'basic' | 'premium' {
  const typeValue = record.type ?? record.category;
  if (!typeValue) return 'basic';
  const lower = String(typeValue).toLowerCase();
  return RECYCLING_STATION_KEYWORDS.some((kw) => lower.includes(kw)) ? 'premium' : 'basic';
}

export function normalizeRecyclableCollection(
  records: RecyclableCollectionRaw[]
): RecyclableCollectionNormalized[] {
  const results: RecyclableCollectionNormalized[] = [];

  for (const record of records) {
    const { sourceId, name, lat, lng, materials } = record;

    if (!sourceId || !name || lat == null || lng == null) {
      console.warn('[ingestion] recyclableCollection: skipping record missing required fields', {
        sourceId,
        name,
        lat,
        lng,
      });
      continue;
    }

    results.push({
      sourceId: String(sourceId),
      source: 'recyclable_collection',
      name: String(name),
      lat: Number(lat),
      lng: Number(lng),
      materials: Array.isArray(materials) ? materials.map(String) : [],
      accessTier: classifyAccessTier(record),
    });
  }

  return results;
}
