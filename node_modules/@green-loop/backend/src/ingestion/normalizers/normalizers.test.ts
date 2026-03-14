import { describe, it, expect } from 'vitest';
import { normalizeOpenSpace } from './openSpace.js';
import { normalizeRecyclableCollection } from './recyclableCollection.js';
import { normalizePopulationCensus } from './populationCensus.js';
import { normalizeHousingEstates } from './housingEstates.js';

// ---------------------------------------------------------------------------
// openSpace normalizer
// ---------------------------------------------------------------------------
describe('normalizeOpenSpace', () => {
  it('normalizes a valid record with accessTier = premium', () => {
    const result = normalizeOpenSpace([
      { sourceId: 'os-1', name: 'Victoria Park', lat: 22.28, lng: 114.18, materials: ['plastic', 'paper'] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceId: 'os-1',
      source: 'open_space',
      name: 'Victoria Park',
      lat: 22.28,
      lng: 114.18,
      materials: ['plastic', 'paper'],
      accessTier: 'premium',
    });
  });

  it('skips records missing sourceId', () => {
    const result = normalizeOpenSpace([{ name: 'Park', lat: 22.28, lng: 114.18 }]);
    expect(result).toHaveLength(0);
  });

  it('skips records missing name', () => {
    const result = normalizeOpenSpace([{ sourceId: 'os-2', lat: 22.28, lng: 114.18 }]);
    expect(result).toHaveLength(0);
  });

  it('skips records missing lat', () => {
    const result = normalizeOpenSpace([{ sourceId: 'os-3', name: 'Park', lng: 114.18 }]);
    expect(result).toHaveLength(0);
  });

  it('skips records missing lng', () => {
    const result = normalizeOpenSpace([{ sourceId: 'os-4', name: 'Park', lat: 22.28 }]);
    expect(result).toHaveLength(0);
  });

  it('defaults materials to empty array when absent', () => {
    const result = normalizeOpenSpace([{ sourceId: 'os-5', name: 'Park', lat: 22.28, lng: 114.18 }]);
    expect(result[0]!.materials).toEqual([]);
  });

  it('processes multiple records and skips invalid ones', () => {
    const result = normalizeOpenSpace([
      { sourceId: 'os-6', name: 'Park A', lat: 22.28, lng: 114.18 },
      { name: 'Park B', lat: 22.29, lng: 114.19 }, // missing sourceId
      { sourceId: 'os-7', name: 'Park C', lat: 22.30, lng: 114.20 },
    ]);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// recyclableCollection normalizer
// ---------------------------------------------------------------------------
describe('normalizeRecyclableCollection', () => {
  it('normalizes a valid record', () => {
    const result = normalizeRecyclableCollection([
      { sourceId: 'rc-1', name: 'Bin A', lat: 22.28, lng: 114.18, materials: ['glass'] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceId: 'rc-1',
      source: 'recyclable_collection',
      name: 'Bin A',
      lat: 22.28,
      lng: 114.18,
      materials: ['glass'],
    });
  });

  it('classifies recycling station as premium', () => {
    const result = normalizeRecyclableCollection([
      { sourceId: 'rc-2', name: 'Station', lat: 22.28, lng: 114.18, type: 'Recycling Station' },
    ]);
    expect(result[0]!.accessTier).toBe('premium');
  });

  it('classifies recycling centre as premium', () => {
    const result = normalizeRecyclableCollection([
      { sourceId: 'rc-3', name: 'Centre', lat: 22.28, lng: 114.18, type: 'Recycling Centre' },
    ]);
    expect(result[0]!.accessTier).toBe('premium');
  });

  it('classifies other types as basic', () => {
    const result = normalizeRecyclableCollection([
      { sourceId: 'rc-4', name: 'Bin', lat: 22.28, lng: 114.18, type: 'Drop-off Point' },
    ]);
    expect(result[0]!.accessTier).toBe('basic');
  });

  it('defaults to basic when type is absent', () => {
    const result = normalizeRecyclableCollection([
      { sourceId: 'rc-5', name: 'Bin', lat: 22.28, lng: 114.18 },
    ]);
    expect(result[0]!.accessTier).toBe('basic');
  });

  it('skips records missing required fields', () => {
    const result = normalizeRecyclableCollection([
      { name: 'Bin', lat: 22.28, lng: 114.18 }, // missing sourceId
    ]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// populationCensus normalizer
// ---------------------------------------------------------------------------
describe('normalizePopulationCensus', () => {
  it('normalizes a valid record', () => {
    const result = normalizePopulationCensus([
      { districtName: 'Yau Tsim Mong', population: 320000 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ districtName: 'Yau Tsim Mong', population: 320000 });
  });

  it('skips records missing districtName', () => {
    const result = normalizePopulationCensus([{ population: 100000 }]);
    expect(result).toHaveLength(0);
  });

  it('skips records missing population', () => {
    const result = normalizePopulationCensus([{ districtName: 'Central' }]);
    expect(result).toHaveLength(0);
  });

  it('coerces string population to number', () => {
    const result = normalizePopulationCensus([{ districtName: 'Sha Tin', population: '450000' }]);
    expect(result[0]!.population).toBe(450000);
  });
});

// ---------------------------------------------------------------------------
// housingEstates normalizer
// ---------------------------------------------------------------------------
describe('normalizeHousingEstates', () => {
  it('normalizes a valid record', () => {
    const result = normalizeHousingEstates([
      { sourceId: 'he-1', name: 'Mei Foo Sun Chuen', districtName: 'Sham Shui Po', lat: 22.33, lng: 114.14 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      sourceId: 'he-1',
      name: 'Mei Foo Sun Chuen',
      districtName: 'Sham Shui Po',
      lat: 22.33,
      lng: 114.14,
    });
  });

  it('skips records missing sourceId', () => {
    const result = normalizeHousingEstates([
      { name: 'Estate', districtName: 'Sha Tin', lat: 22.38, lng: 114.19 },
    ]);
    expect(result).toHaveLength(0);
  });

  it('skips records missing districtName', () => {
    const result = normalizeHousingEstates([
      { sourceId: 'he-2', name: 'Estate', lat: 22.38, lng: 114.19 },
    ]);
    expect(result).toHaveLength(0);
  });

  it('skips records missing coordinates', () => {
    const result = normalizeHousingEstates([
      { sourceId: 'he-3', name: 'Estate', districtName: 'Sha Tin' },
    ]);
    expect(result).toHaveLength(0);
  });
});
