# Design Document: Bin Fill Status

## Overview

A frontend-only UI enhancement to `MapTab.tsx` that adds mock fill-level indicators to collection point markers and their detail panels. No backend, API, or database changes are involved.

Two small pure functions (`getMockFillLevel` and `getFillCategory`) drive all visual changes:
- Map markers are recoloured by fill status instead of access tier.
- The collection point detail panel gains a fill status row (percentage bar + category label).
- A small legend panel on the map explains the colour coding.

## Architecture

All changes are confined to `frontend/src/screens/MapTab.tsx`. The two utility functions can be defined at the top of that file (or extracted to a co-located helper if preferred, but a separate file is not required).

```
MapTab.tsx
  ├── getMockFillLevel(id)   → deterministic 0–100 integer
  ├── getFillCategory(pct)   → { label, color }
  ├── fetchCollectionPoints  → uses getFillCategory for marker background
  ├── Collection point popup → adds fill status row
  └── Fill legend overlay    → static panel on map
```

No new routes, no new components, no state additions beyond what already exists.

## Components and Interfaces

### `getMockFillLevel(id: number): number`

Returns a deterministic integer in [0, 100] derived from the collection point's numeric id.

```ts
function getMockFillLevel(id: number): number {
  return (id * 37) % 101;
}
```

The formula `(id * 37) % 101` distributes ids across the full 0–100 range without clustering, and is stable across re-renders.

### `getFillCategory(pct: number): { label: string; color: string }`

Maps a percentage to a display label and hex colour.

```ts
function getFillCategory(pct: number): { label: string; color: string } {
  if (pct <= 20) return { label: 'Empty',  color: '#16a34a' };
  if (pct <= 40) return { label: 'Low',    color: '#16a34a' };
  if (pct <= 60) return { label: 'Medium', color: '#d97706' };
  if (pct <= 80) return { label: 'High',   color: '#dc2626' };
  return           { label: 'Full',   color: '#dc2626' };
}
```

Thresholds and colours:

| Range   | Label  | Colour  | Hex       |
|---------|--------|---------|-----------|
| 0–20%   | Empty  | Green   | `#16a34a` |
| 21–40%  | Low    | Green   | `#16a34a` |
| 41–60%  | Medium | Amber   | `#d97706` |
| 61–80%  | High   | Red     | `#dc2626` |
| 81–100% | Full   | Red     | `#dc2626` |

### Marker colour change (`fetchCollectionPoints`)

Replace the existing access-tier colour logic:

```ts
// Before
background: ${pt.accessTier === 'premium' ? '#16a34a' : '#2563eb'};

// After
const { color } = getFillCategory(getMockFillLevel(pt.id));
background: ${color};
```

### Fill status row in the detail panel

Inside the collection point bottom sheet, after the materials line and before the action buttons, add:

```tsx
{(() => {
  const pct = getMockFillLevel(popup.point.id);
  const { label, color } = getFillCategory(pct);
  return (
    <div style={{ marginTop: '0.5rem' }}>
      {/* Progress bar */}
      <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '4px' }} />
      </div>
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.25rem' }}>
        <span style={{ color: '#6b7280' }}>Fill level</span>
        <span style={{ color, fontWeight: 600 }}>{pct}% · {label}</span>
      </div>
    </div>
  );
})()}
```

### Fill legend overlay

A small static panel positioned bottom-left on the map (above the stats overlay), rendered as an absolute-positioned div in the JSX return:

```tsx
<div style={{
  position: 'absolute', bottom: '9rem', left: '0.75rem',
  background: 'rgba(255,255,255,0.93)', borderRadius: '10px',
  padding: '0.4rem 0.6rem', fontSize: '0.7rem',
  boxShadow: '0 1px 6px rgba(0,0,0,0.15)', lineHeight: 1.8,
  pointerEvents: 'none',
}}>
  <div style={{ fontWeight: 600, marginBottom: '0.2rem', color: '#374151' }}>Fill level</div>
  {[
    { color: '#16a34a', label: 'Empty / Low' },
    { color: '#d97706', label: 'Medium' },
    { color: '#dc2626', label: 'High / Full' },
  ].map(({ color, label }) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
      <span style={{ color: '#374151' }}>{label}</span>
    </div>
  ))}
</div>
```

## Data Models

No new data models. The two utility functions operate on the existing `CollectionPoint.id: number` field already present in the interface:

```ts
interface CollectionPoint {
  id: number;          // ← used as input to getMockFillLevel
  name: string;
  accessTier: 'basic' | 'premium';
  materials: string[];
  lat: number;
  lng: number;
  distanceMetres: number;
}
```

No new state, no new props, no new API calls.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: getFillCategory returns correct label and color for all percentages

*For any* integer percentage in [0, 100], `getFillCategory` must return a label of exactly one of {Empty, Low, Medium, High, Full} and a color of exactly one of {`#16a34a`, `#d97706`, `#dc2626`}, consistent with the threshold bands: Empty/Low → `#16a34a`, Medium → `#d97706`, High/Full → `#dc2626`.

**Validates: Requirements 1.2, 1.3, 2.1**

### Property 2: getMockFillLevel is deterministic

*For any* collection point id, calling `getMockFillLevel(id)` multiple times must always return the same value — the result is stable across re-renders and repeated calls.

**Validates: Requirements 1.5**

### Property 3: getMockFillLevel output is always in range [0, 100]

*For any* integer id, `getMockFillLevel(id)` must return a value in the closed interval [0, 100].

**Validates: Requirements 1.1, 1.5**

### Property 4: Detail panel renders percentage and category label for any collection point

*For any* collection point with a valid numeric id, the rendered detail panel must contain both the numeric fill percentage (as a string like "N%") and the corresponding Fill_Category label string.

**Validates: Requirements 1.1, 1.4**

## Error Handling

Since both utility functions are pure and operate on bounded integer inputs, there are no async failure modes. Defensive notes:

- `getMockFillLevel` receives `id` from the API response. If `id` is ever `NaN` or non-integer, `(NaN * 37) % 101` returns `NaN`. The progress bar width would render as `NaN%` (treated as 0 by browsers). This is acceptable for a mock — no guard needed.
- `getFillCategory` receives the output of `getMockFillLevel`, which is always in [0, 100] for valid ids, so all branches are reachable and the function always returns a value.
- The legend panel is static JSX with no data dependency — it cannot fail.

## Testing Strategy

### Unit tests

Focus on specific examples and edge cases for the two pure functions:

- `getMockFillLevel(0)` → `0` (boundary)
- `getMockFillLevel(1)` → `37`
- `getMockFillLevel(100)` → `(3700) % 101 = 3700 - 36*101 = 3700 - 3636 = 64`
- `getFillCategory(0)` → `{ label: 'Empty', color: '#16a34a' }`
- `getFillCategory(20)` → `{ label: 'Empty', color: '#16a34a' }` (boundary)
- `getFillCategory(21)` → `{ label: 'Low', color: '#16a34a' }` (boundary)
- `getFillCategory(100)` → `{ label: 'Full', color: '#dc2626' }`
- Legend panel renders 3 colour swatches with labels "Empty / Low", "Medium", "High / Full"

### Property-based tests

Use [fast-check](https://github.com/dubzzz/fast-check) (already available in the frontend ecosystem).

Each property test must run a minimum of 100 iterations.

**Property 1: getFillCategory label and color correctness**
```
// Feature: bin-fill-status, Property 1: getFillCategory returns correct label and color for all percentages
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
```

**Property 2: getMockFillLevel is deterministic**
```
// Feature: bin-fill-status, Property 2: getMockFillLevel is deterministic
fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }), (id) => {
  return getMockFillLevel(id) === getMockFillLevel(id);
}), { numRuns: 100 });
```

**Property 3: getMockFillLevel output is always in [0, 100]**
```
// Feature: bin-fill-status, Property 3: getMockFillLevel output is always in range [0, 100]
fc.assert(fc.property(fc.integer({ min: 0, max: 100000 }), (id) => {
  const pct = getMockFillLevel(id);
  return pct >= 0 && pct <= 100;
}), { numRuns: 100 });
```

**Property 4: Detail panel renders percentage and label**
```
// Feature: bin-fill-status, Property 4: Detail panel renders percentage and category label for any collection point
fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }), (id) => {
  const pct = getMockFillLevel(id);
  const { label } = getFillCategory(pct);
  // rendered output must contain both the percentage string and the label
  const rendered = renderFillStatusRow(id); // helper that returns the text content
  return rendered.includes(`${pct}%`) && rendered.includes(label);
}), { numRuns: 100 });
```
