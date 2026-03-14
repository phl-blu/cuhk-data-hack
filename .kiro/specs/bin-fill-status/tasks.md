# Implementation Plan: Bin Fill Status

## Overview

All changes are confined to `frontend/src/screens/MapTab.tsx`, plus a co-located test file. The two pure utility functions drive every visual change.

## Tasks

- [x] 1. Add utility functions to MapTab.tsx
  - Add `getMockFillLevel(id: number): number` at the top of the file (above the component), using the formula `(id * 37) % 101`
  - Add `getFillCategory(pct: number): { label: string; color: string }` immediately after, mapping the five threshold bands to their label/color pairs
  - _Requirements: 1.2, 1.3, 1.5_

- [x] 2. Update marker colour in `fetchCollectionPoints`
  - Replace the access-tier colour expression (`pt.accessTier === 'premium' ? '#16a34a' : '#2563eb'`) with `getFillCategory(getMockFillLevel(pt.id)).color`
  - _Requirements: 2.1, 2.2_

- [x] 3. Add fill status row to the collection point detail panel
  - Inside the collection point bottom sheet, after the materials line and before the action buttons, insert the fill status row: a progress bar `<div>` whose width is `${pct}%` and whose background is the category colour, plus a label row showing "Fill level" on the left and `${pct}% · ${label}` on the right
  - _Requirements: 1.1, 1.4_

- [x] 4. Add fill legend overlay to the map JSX
  - Add a static absolute-positioned panel (bottom: 9rem, left: 0.75rem) with `pointerEvents: 'none'` showing three colour swatches: green "Empty / Low", amber "Medium", red "High / Full"
  - _Requirements: 2.3_

- [x] 5. Write property-based tests for the utility functions
  - Create `frontend/src/screens/MapTab.fillStatus.test.ts`; import `getMockFillLevel` and `getFillCategory` (export them from MapTab.tsx or extract to a co-located helper as needed) and `fc` from `fast-check`

  - [x]* 5.1 Write property test for getFillCategory label and color correctness
    - **Property 1: getFillCategory returns correct label and color for all percentages**
    - **Validates: Requirements 1.2, 1.3, 2.1**

  - [x]* 5.2 Write property test for getMockFillLevel determinism
    - **Property 2: getMockFillLevel is deterministic**
    - **Validates: Requirements 1.5**

  - [x]* 5.3 Write property test for getMockFillLevel range
    - **Property 3: getMockFillLevel output is always in range [0, 100]**
    - **Validates: Requirements 1.1, 1.5**

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Sub-tasks marked with `*` are optional and can be skipped for a faster MVP
- Properties 1–3 map directly to the correctness properties in design.md
- The two utility functions must be exported (or re-exported from a helper) for the test file to import them
