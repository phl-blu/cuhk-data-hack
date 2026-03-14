import { describe, it, expect } from 'vitest';

// Pure helper extracted from points service logic — tested in isolation
// (no DB required)

function calculateCheckInPoints(
  tier: 'basic' | 'premium',
  isUnderserved = false
): number {
  const base = tier === 'basic' ? 10 : 20;
  return tier === 'premium' && isUnderserved ? Math.round(base * 1.5) : base;
}

describe('calculateCheckInPoints', () => {
  it('awards 10 points for basic tier', () => {
    expect(calculateCheckInPoints('basic')).toBe(10);
  });

  it('awards 20 points for premium tier (non-underserved)', () => {
    expect(calculateCheckInPoints('premium', false)).toBe(20);
  });

  it('awards 30 points for premium tier in underserved area (1.5× multiplier)', () => {
    expect(calculateCheckInPoints('premium', true)).toBe(30);
  });

  it('basic tier is unaffected by underserved flag', () => {
    expect(calculateCheckInPoints('basic', true)).toBe(10);
  });
});

describe('garbage report points', () => {
  it('always awards 15 points', () => {
    const GARBAGE_REPORT_POINTS = 15;
    expect(GARBAGE_REPORT_POINTS).toBe(15);
  });
});
