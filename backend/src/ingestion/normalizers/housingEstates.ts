export interface HousingEstateRaw {
  sourceId?: unknown;
  name?: unknown;
  districtName?: unknown;
  lat?: unknown;
  lng?: unknown;
  [key: string]: unknown;
}

export interface HousingEstateNormalized {
  sourceId: string;
  name: string;
  districtName: string;
  lat: number;
  lng: number;
}

export function normalizeHousingEstates(records: HousingEstateRaw[]): HousingEstateNormalized[] {
  const results: HousingEstateNormalized[] = [];

  for (const record of records) {
    const { sourceId, name, districtName, lat, lng } = record;

    if (!sourceId || !name || !districtName || lat == null || lng == null) {
      console.warn('[ingestion] housingEstates: skipping record missing required fields', {
        sourceId,
        name,
        districtName,
        lat,
        lng,
      });
      continue;
    }

    results.push({
      sourceId: String(sourceId),
      name: String(name),
      districtName: String(districtName),
      lat: Number(lat),
      lng: Number(lng),
    });
  }

  return results;
}
