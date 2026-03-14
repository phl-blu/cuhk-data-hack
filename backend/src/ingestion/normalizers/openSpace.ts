export interface OpenSpaceRaw {
  sourceId?: unknown;
  name?: unknown;
  lat?: unknown;
  lng?: unknown;
  materials?: unknown;
  [key: string]: unknown;
}

export interface OpenSpaceNormalized {
  sourceId: string;
  source: 'open_space';
  name: string;
  lat: number;
  lng: number;
  materials: string[];
  accessTier: 'premium';
}

export function normalizeOpenSpace(records: OpenSpaceRaw[]): OpenSpaceNormalized[] {
  const results: OpenSpaceNormalized[] = [];

  for (const record of records) {
    const { sourceId, name, lat, lng, materials } = record;

    if (!sourceId || !name || lat == null || lng == null) {
      console.warn('[ingestion] openSpace: skipping record missing required fields', {
        sourceId,
        name,
        lat,
        lng,
      });
      continue;
    }

    results.push({
      sourceId: String(sourceId),
      source: 'open_space',
      name: String(name),
      lat: Number(lat),
      lng: Number(lng),
      materials: Array.isArray(materials) ? materials.map(String) : [],
      accessTier: 'premium',
    });
  }

  return results;
}
