export interface PopulationCensusRaw {
  districtName?: unknown;
  population?: unknown;
  [key: string]: unknown;
}

export interface PopulationCensusNormalized {
  districtName: string;
  population: number;
}

export function normalizePopulationCensus(
  records: PopulationCensusRaw[]
): PopulationCensusNormalized[] {
  const results: PopulationCensusNormalized[] = [];

  for (const record of records) {
    const { districtName, population } = record;

    if (!districtName || population == null) {
      console.warn('[ingestion] populationCensus: skipping record missing required fields', {
        districtName,
        population,
      });
      continue;
    }

    results.push({
      districtName: String(districtName),
      population: Number(population),
    });
  }

  return results;
}
