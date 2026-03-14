import { describe, it } from 'vitest';
import fc from 'fast-check';
import { getMockFillLevel, getFillCategory } from './MapTab';

describe('bin-fill-status property-based tests', () => {
  it('5.1 Property 1: getFillCategory returns correct label and color for all percentages', () => {
    // Feature: bin-fill-status, Property 1: getFillCategory returns correct label and color for all percentages
    // Validates: Requirements 1.2, 1.3, 2.1
    fc.assert(fc.property(fc.integer({ min: 0, max: 100 }), (pct) => {
      const { label, color } = getFillCategory(pct);
      const validLabels = ['Empty', 'Low', 'Medium', 'High', 'Full'];
      const validColors = ['#16a34a', '#d97706', '#dc2626'];
      if (!validLabels.includes(label)) return false;
      if (!validColors.includes(color)) return false;
      // threshold consistency
      if (pct <= 20) return label === 'Empty' && color === '#16a34a';
      if (pct <= 40) return label === 'Low'   && color === '#16a34a';
      if (pct <= 60) return label === 'Medium'&& color === '#d97706';
      if (pct <= 80) return label === 'High'  && color === '#dc2626';
      return label === 'Full' && color === '#dc2626';
    }), { numRuns: 101 });
  });

  it('5.2 Property 2: getMockFillLevel is deterministic', () => {
    // Feature: bin-fill-status, Property 2: getMockFillLevel is deterministic
    // Validates: Requirement 1.5
    fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }), (id) => {
      return getMockFillLevel(id) === getMockFillLevel(id);
    }), { numRuns: 100 });
  });

  it('5.3 Property 3: getMockFillLevel output is always in range [0, 100]', () => {
    // Feature: bin-fill-status, Property 3: getMockFillLevel output is always in range [0, 100]
    // Validates: Requirements 1.1, 1.5
    fc.assert(fc.property(fc.integer({ min: 0, max: 100000 }), (id) => {
      const pct = getMockFillLevel(id);
      return pct >= 0 && pct <= 100;
    }), { numRuns: 100 });
  });
});
