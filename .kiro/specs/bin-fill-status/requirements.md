# Requirements Document

## Introduction

Bin Fill Status is a frontend-only UI enhancement for the Green Loop App. It adds a visual fill level indicator to the Collection_Point detail panel in the Map_Tab. Fill levels are mocked/hardcoded per collection point — there is no backend, no API, and no database involvement. The goal is to validate the UI concept before any real data integration is considered.

---

## Glossary

- **Fill_Level_Percentage**: A static integer from 0 to 100 representing how full a bin is, where 0 is completely empty and 100 is completely full. In this implementation the value is mocked.
- **Fill_Category**: A discrete label derived from Fill_Level_Percentage: Empty (0–20%), Low (21–40%), Medium (41–60%), High (61–80%), Full (81–100%).
- **Fill_Status_Indicator**: The UI element on the Collection_Point detail panel that communicates the current Fill_Category and Fill_Level_Percentage to the Resident.
- **Mock_Fill_Level**: A deterministic, hardcoded fill level assigned to each Collection_Point for display purposes only. It does not reflect real bin state.
- **Collection_Point**: As defined in the Green Loop App glossary — any physical recycling deposit location shown on the Map_Tab.
- **Map_Tab**: The frontend tab rendering Collection_Points on an interactive Mapbox map.
- **Resident**: A Hong Kong resident using the App.

---

## Requirements

### Requirement 1: Display Fill Status Indicator in Collection Point Detail Panel

**User Story:** As a Resident, I want to see a fill level indicator when I tap a collection point, so that I can get a sense of how full the bin might be.

#### Acceptance Criteria

1. WHEN a Resident taps a Collection_Point marker on the Map_Tab, THE Frontend SHALL display a Fill_Status_Indicator in the detail panel showing the Mock_Fill_Level percentage and the corresponding Fill_Category label.
2. THE Frontend SHALL derive the Fill_Category from the Mock_Fill_Level using the following thresholds: Empty (0–20%), Low (21–40%), Medium (41–60%), High (61–80%), Full (81–100%).
3. THE Frontend SHALL colour-code the Fill_Status_Indicator label according to Fill_Category: green for Empty or Low, amber for Medium, red for High or Full.
4. THE Frontend SHALL display the Fill_Status_Indicator as a text percentage (e.g. "67% full") alongside the colour-coded Fill_Category label (e.g. "Medium").
5. THE Frontend SHALL assign Mock_Fill_Level values that are deterministic per Collection_Point (e.g. derived from the point's id) so the indicator is stable across re-renders.

---

### Requirement 2: Colour-Coded Map Markers by Fill Status

**User Story:** As a Resident, I want map markers to visually reflect fill level at a glance, so that I can quickly spot available bins on the map.

#### Acceptance Criteria

1. WHEN the Map_Tab renders Collection_Point markers, THE Frontend SHALL colour-code each marker according to the Collection_Point's Mock_Fill_Level Fill_Category: green for Empty or Low, amber for Medium, red for High or Full.
2. WHERE the fill-status marker colour conflicts with the existing Access_Tier colour scheme, THE Frontend SHALL give fill-status colour priority over the Access_Tier colour.
3. THE Frontend SHALL display a small map legend explaining the fill-status colour coding, visible on the Map_Tab.
