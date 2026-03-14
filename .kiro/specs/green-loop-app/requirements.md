# Requirements Document

## Introduction

Green Loop is a gamified civic recycling app for Hong Kong residents, built for the Green Loop Challenge hackathon. The app motivates residents to recycle and report misplaced garbage by turning civic participation into a district-level competition. On first launch, residents enter a display name and select their Hong Kong district from a list of the 18 administrative districts — no OAuth or external identity provider is required for this prototype. The app surfaces nearby recycling collection points from government spatial datasets, lets residents log recycling check-ins and garbage reports to earn points, and ranks districts on a live leaderboard. A dual reward mechanism credits both the individual and their residential building/area for every recycling action. Individual points are redeemable for Octopus card top-ups. A dedicated credit dashboard surfaces all reward balances and redemption options. The system comprises a mobile-first frontend (tabs: Points/Leaderboard, Dashboard, Credits, Map, Misplaced Garbage, Profile) and a REST API backend that ingests HK government open datasets, manages user points, and serves spatial queries.

---

## Glossary

- **App**: The Green Loop full-stack application, comprising the Frontend and the API.
- **Frontend**: The mobile-first web application presented to the resident across all tabs.
- **API**: The backend REST service that stores data, runs business logic, and serves all Frontend tabs.
- **Resident**: A Hong Kong resident using the App, identified by a self-entered display name and a self-selected District.
- **Session**: A locally stored record (e.g. localStorage) containing the Resident's display name and selected District, persisted across page reloads for the duration of the prototype.
- **District**: One of Hong Kong's 18 administrative districts, used as the primary unit for leaderboard aggregation and spatial queries.
- **Residential_Area**: A building or estate-level grouping of Residents, used as the secondary unit for Building_Points aggregation.
- **Collection_Point**: Any physical location where a Resident can deposit recyclables, classified as either Basic_Access or Premium_Access.
- **Basic_Access**: A Collection_Point tier comprising standard street-level recycling bins with limited material acceptance.
- **Premium_Access**: A Collection_Point tier comprising GREEN@COMMUNITY stations that accept a broader range of materials including Styrofoam and beverage cartons.
- **GREEN@COMMUNITY_Station**: A government-operated Premium_Access recycling station under the GREEN@COMMUNITY network.
- **Check_In**: A Resident action of logging a recycling deposit at a Collection_Point, which awards Points.
- **Garbage_Report**: A Resident-submitted report of misplaced or illegally dumped garbage, including a photo, timestamp, and geo-coordinates.
- **Individual_Points**: Points credited to a specific Resident for their recycling actions, redeemable for Octopus card top-ups.
- **Building_Points**: Points credited to a Resident's associated Residential_Area each time that Resident earns Individual_Points.
- **Points**: A numeric score awarded to a Resident for Check_Ins and Garbage_Reports; each action simultaneously awards Individual_Points to the Resident and Building_Points to the Resident's Residential_Area.
- **Leaderboard**: A ranked list of all Districts ordered by their aggregate Points per km² of district land area.
- **Credits_Dashboard**: The Frontend tab showing a Resident's Individual_Points balance, Building_Points balance, redemption history, and Octopus card top-up options.
- **Octopus_Card**: Hong Kong's contactless transit and payment card; the redemption target for Individual_Points.
- **Redemption**: The act of converting Individual_Points into an Octopus card top-up credit.
- **Bin_Request**: A Resident-submitted request for a new Collection_Point to be added in an underserved area.
- **Underserved_Area**: A geographic zone identified as lacking sufficient Collection_Points relative to its residential density.
- **Dashboard**: The Frontend tab showing a Resident's personal summary, District standing, and nearest Collection_Point.
- **Map_Tab**: The Frontend tab rendering Collection_Points and Garbage_Reports on an interactive map with live statistics.
- **Spatial_Query**: A database query that filters Collection_Points by proximity to a given coordinate.
- **Access_Tier**: The classification of a Collection_Point as Basic_Access or Premium_Access.

---

## Requirements

### Requirement 1: Prototype Onboarding and Session

**User Story:** As a Resident, I want to enter my display name and select my Hong Kong district on first launch, so that I can start using the app immediately without needing an account or external login.

#### Acceptance Criteria

1. WHEN the App is opened and no local Session exists, THE Frontend SHALL display an onboarding screen prompting the Resident to enter a display name and select a District from a dropdown list of Hong Kong's 18 administrative districts.
2. WHEN the Resident submits the onboarding form, THE Frontend SHALL validate that the display name is between 1 and 50 characters and that a District has been selected before proceeding.
3. WHEN the onboarding form is valid and submitted, THE Frontend SHALL store the Resident's display name and selected District in localStorage as the Session and navigate to the main app.
4. WHEN the App is opened and a valid local Session already exists, THE Frontend SHALL skip the onboarding screen and navigate directly to the main app.
5. IF the Resident submits the onboarding form with an empty display name or no District selected, THEN THE Frontend SHALL display a validation error identifying the missing field and SHALL NOT create a Session.
6. WHEN a Resident taps "Sign Out" on the Profile_Tab, THE Frontend SHALL clear the local Session from localStorage and redirect the Resident to the onboarding screen.
7. THE Frontend SHALL derive the Resident identifier sent to the API from the locally stored Session (e.g. a combination of display name and District) for the duration of the prototype.

---

### Requirement 2: Points System and Dual Reward Mechanism

**User Story:** As a Resident, I want to earn Points for recycling and reporting garbage, so that my civic actions contribute to both my personal rewards and my building's collective score.

#### Acceptance Criteria

1. WHEN a Resident submits a Check_In at a Basic_Access Collection_Point, THE API SHALL award 10 Individual_Points to the Resident's account.
2. WHEN a Resident submits a Check_In at a Premium_Access Collection_Point, THE API SHALL award 20 Individual_Points to the Resident's account.
3. WHEN a Resident submits a valid Garbage_Report with a photo and geo-coordinates, THE API SHALL award 15 Individual_Points to the Resident's account.
4. WHEN Individual_Points are awarded to a Resident, THE API SHALL simultaneously award an equal number of Building_Points to the Resident's associated Residential_Area in the same atomic transaction.
5. WHEN Individual_Points are awarded, THE API SHALL add the awarded Points to the Resident's District aggregate used by the Leaderboard.
6. THE API SHALL record each Points transaction with the Resident identifier, Individual_Points amount, Building_Points amount, transaction type (Check_In or Garbage_Report), timestamp, and associated Collection_Point or Garbage_Report identifier.
7. WHEN a Resident requests their Points history, THE API SHALL return all Points transactions for that Resident ordered by timestamp descending.
8. IF a Resident attempts to submit a Check_In at the same Collection_Point more than once within a 60-minute window, THEN THE API SHALL reject the duplicate Check_In with a 409 status and award no Points.
9. WHEN a Resident earns Individual_Points, THE API SHALL apply a bonus multiplier of 1.5× to Check_Ins performed at Premium_Access Collection_Points located in Underserved_Areas.
10. WHEN a Resident's Individual_Points balance falls below 50 after a Redemption, THE API SHALL apply a 10-point deduction to the next Redemption request to discourage low-balance redemptions.

---

### Requirement 3: District Leaderboard

**User Story:** As a Resident, I want to see how my District ranks against others, so that I feel motivated to contribute to a collective recycling goal.

#### Acceptance Criteria

1. THE API SHALL expose a leaderboard endpoint that returns all Districts ranked by aggregate Points per km² of district land area in descending order.
2. WHEN the leaderboard is requested, THE API SHALL include for each District: District name, total aggregate Points, district land area in km², Points per km², and rank.
3. WHEN a Resident's Points are updated, THE API SHALL update the District aggregate within 5 seconds so that the Leaderboard reflects the change on the next request.
4. THE Frontend Leaderboard_Tab SHALL display the full District ranking and highlight the Resident's own District.
5. THE Frontend Leaderboard_Tab SHALL display the top three Districts with a visual distinction from the remaining entries.
6. WHEN the Leaderboard_Tab is opened, THE Frontend SHALL fetch the latest leaderboard data from the API and display it within 3 seconds on a standard mobile connection.

---

### Requirement 4: Dashboard Tab

**User Story:** As a Resident, I want a personal summary screen, so that I can quickly see my standing, my District's performance, and where to recycle next.

#### Acceptance Criteria

1. WHEN the Dashboard_Tab is opened, THE Frontend SHALL display the Resident's current District, total Individual_Points, and rank within the District leaderboard.
2. WHEN the Dashboard_Tab is opened and the Resident's device location is available, THE Frontend SHALL display the name, Access_Tier, and walking distance to the nearest Collection_Point.
3. WHEN the Dashboard_Tab is opened, THE Frontend SHALL display the Resident's total Check_In count and total Garbage_Report count for the current calendar month.
4. THE Dashboard_Tab SHALL provide a button that navigates the Resident directly to the Map_Tab centered on the nearest Collection_Point.
5. IF the Resident's device location is unavailable, THEN THE Frontend SHALL display the nearest Collection_Point based on the Resident's selected District centroid instead.
6. WHEN the Dashboard_Tab data is loading, THE Frontend SHALL display a loading indicator and SHALL NOT display stale data from a previous session.

---

### Requirement 5: Map Tab — Collection Points and Live Statistics

**User Story:** As a Resident, I want to see recycling Collection_Points on a live map with real-time statistics, so that I can find the most convenient place to recycle and understand recycling activity in my area.

#### Acceptance Criteria

1. WHEN the Map_Tab is opened, THE Frontend SHALL render an interactive map centered on the Resident's current device location or, if unavailable, the Resident's selected District centroid.
2. WHEN the Map_Tab renders, THE Frontend SHALL display all Collection_Points within 2 kilometres of the map center as map markers, distinguishing Basic_Access markers from Premium_Access markers using different visual styles.
3. WHEN a Resident taps a Collection_Point marker, THE Frontend SHALL display a detail panel showing the Collection_Point name, Access_Tier, accepted material types, and distance from the Resident's current location.
4. THE API SHALL expose a Spatial_Query endpoint accepting latitude, longitude, and radius parameters and returning all Collection_Points within that radius annotated with Access_Tier, name, accepted materials, and distance.
5. WHEN the Resident pans or zooms the map, THE Frontend SHALL fetch updated Collection_Points for the new visible area from the API.
6. THE Map_Tab SHALL display Garbage_Reports submitted by all Residents as a separate layer of markers, distinguishing them visually from Collection_Point markers.
7. WHERE the device and browser support WebGL, THE Frontend SHALL render the map in a 3D tilted view with building extrusions.
8. THE API SHALL ingest Collection_Point data from both the Open Space Database of Recycling Stations and the Recyclable Collection Points Data government datasets and classify each record by Access_Tier.
9. WHEN the Map_Tab is active, THE Frontend SHALL display a live statistics overlay showing the total number of Check_Ins, total Individual_Points earned, and total Garbage_Reports submitted within the current map viewport, updating whenever the viewport changes.
10. WHEN the Map_Tab is active, THE API SHALL expose an endpoint returning aggregate recycling statistics (total Check_Ins, total Points, total Garbage_Reports) for a given bounding box, computed from stored transaction data.
11. THE Map_Tab SHALL visually distinguish Underserved_Areas on the map using a distinct overlay or shading, based on Collection_Point density relative to residential population data.

---

### Requirement 6: Misplaced Garbage Reporting

**User Story:** As a Resident, I want to report misplaced or illegally dumped garbage with a photo and location, so that my report contributes to keeping my District clean and earns me Points.

#### Acceptance Criteria

1. WHEN a Resident submits a Garbage_Report, THE Frontend SHALL capture and attach the Resident's current GPS coordinates automatically without requiring manual input.
2. WHEN a Resident submits a Garbage_Report, THE Frontend SHALL require the Resident to attach at least one photo as evidence before submission is allowed.
3. WHEN a Garbage_Report is submitted, THE API SHALL store the photo, GPS coordinates, District (derived from coordinates), Resident identifier, and UTC timestamp.
4. WHEN a Garbage_Report is stored, THE API SHALL return the assigned report identifier and awarded Points to the Frontend within 3 seconds.
5. THE API SHALL expose an endpoint returning all Garbage_Reports within a given bounding box, including coordinates, timestamp, District, and a thumbnail URL for the photo.
6. WHEN the Map_Tab Garbage_Report layer is active, THE Frontend SHALL display all Garbage_Reports returned by the API as map markers with the report timestamp visible on tap.
7. IF a Resident submits a Garbage_Report without a photo, THEN THE Frontend SHALL display a validation error and SHALL NOT submit the report to the API.
8. IF a Resident's GPS coordinates cannot be determined at submission time, THEN THE Frontend SHALL display an error message and SHALL NOT submit the report until coordinates are available.
9. THE API SHALL derive the District for each Garbage_Report by performing a point-in-polygon lookup against the 18 District boundaries.

---

### Requirement 7: Recycling Check-In

**User Story:** As a Resident, I want to log a recycling Check_In at a Collection_Point, so that my recycling activity is recorded and I earn Points.

#### Acceptance Criteria

1. WHEN a Resident taps a Collection_Point marker on the Map_Tab, THE Frontend SHALL display a "Check In" button in the detail panel.
2. WHEN a Resident taps "Check In", THE Frontend SHALL submit a Check_In request to the API containing the Resident identifier, Collection_Point identifier, and current GPS coordinates.
3. WHEN the API receives a Check_In request, THE API SHALL verify that the Resident's submitted GPS coordinates are within 200 metres of the Collection_Point's coordinates before awarding Points.
4. IF the Resident's GPS coordinates are more than 200 metres from the Collection_Point, THEN THE API SHALL reject the Check_In with a 422 status and return a message indicating the Resident is too far from the Collection_Point.
5. WHEN a Check_In is accepted, THE API SHALL return the awarded Individual_Points amount, the Building_Points awarded to the Resident's Residential_Area, and the Resident's updated total Individual_Points to the Frontend.
6. THE Frontend SHALL display a confirmation message showing the Individual_Points awarded and the Building_Points credited to the Resident's Residential_Area immediately after a successful Check_In.

---

### Requirement 8: Government Dataset Ingestion

**User Story:** As a backend developer, I want all relevant HK government datasets ingested and normalized, so that the API can serve accurate spatial and demographic data without manual data preparation.

#### Acceptance Criteria

1. WHEN the API starts, THE API SHALL ingest data from the following government datasets: Open Space Database of Recycling Stations, Recyclable Collection Points Data, 2021 Population Census, and Location and Profile of Public Housing Estates.
2. WHEN Open Space Database records are ingested, THE API SHALL normalize each record to include a unique identifier, name, coordinates (latitude and longitude), accepted material types, and Access_Tier set to "Premium_Access".
3. WHEN Recyclable Collection Points records are ingested, THE API SHALL normalize each record to include a unique identifier, coordinates, and Access_Tier set to "Basic_Access" for street bins or "Premium_Access" for recycling stations.
4. WHEN Population Census records are ingested, THE API SHALL normalize each record to include District identifier and total resident population, and store this data for map context and demographic reference (not used for leaderboard scoring).
5. WHEN Public Housing Estate records are ingested, THE API SHALL normalize each record to include estate identifier, District, and coordinates, and use this data to identify high-density residential zones on the Map_Tab.
6. IF a required field is missing from an ingested record, THEN THE API SHALL reject that record, log a warning with the field name and source dataset name, and continue processing remaining records.
7. THE API SHALL re-ingest all datasets on a configurable schedule, defaulting to once every 24 hours, to reflect updates from government sources.
8. THE API SHALL expose a `GET /health` endpoint that returns the ingestion status and last-updated timestamp for each dataset.

---

### Requirement 9: Spatial Query API

**User Story:** As a frontend developer, I want a proximity search endpoint, so that the Map_Tab and Dashboard can display the nearest Collection_Points to the Resident's location.

#### Acceptance Criteria

1. THE API SHALL expose a `GET /collection-points/nearby` endpoint accepting `lat`, `lng`, and `radius` (in metres) query parameters and returning all Collection_Points within that radius.
2. WHEN the nearby endpoint returns results, THE API SHALL include for each Collection_Point: identifier, name, Access_Tier, accepted material types, coordinates, and distance from the query point in metres.
3. WHEN the nearby endpoint returns results, THE API SHALL sort results by distance ascending.
4. THE API SHALL expose a `GET /collection-points` endpoint accepting an optional `tier` query parameter with values "basic" or "premium" to filter results by Access_Tier.
5. WHEN a `radius` parameter exceeding 10,000 metres is provided, THE API SHALL cap the effective radius at 10,000 metres and include a note in the response indicating the cap was applied.
6. IF the `lat` or `lng` parameters are missing or outside valid coordinate ranges, THEN THE API SHALL return a 400 status with a JSON body describing the specific validation error.
7. WHEN no Collection_Points exist within the queried radius, THE API SHALL return an empty array with a 200 status.

---

### Requirement 10: Profile Tab

**User Story:** As a Resident, I want a profile screen showing my chosen name, district, Points, and recycling history, so that I can track my personal contribution over time.

#### Acceptance Criteria

1. WHEN the Profile_Tab is opened, THE Frontend SHALL display the Resident's display name and selected District as stored in the local Session.
2. WHEN the Profile_Tab is opened, THE Frontend SHALL display the Resident's total Individual_Points, total Check_In count, and total Garbage_Report count.
3. WHEN the Profile_Tab is opened, THE Frontend SHALL display the Resident's Points transaction history showing the most recent 20 transactions with type, Individual_Points awarded, Building_Points awarded, and timestamp.
4. THE Frontend SHALL display the Resident's District rank on the Leaderboard within the Profile_Tab.
5. WHEN a Resident taps "Sign Out" on the Profile_Tab, THE Frontend SHALL clear the local Session from localStorage and redirect the Resident to the onboarding screen.
6. THE API SHALL expose a `GET /residents/me` endpoint returning the Resident's profile including display name, District, total Individual_Points, total Building_Points for their Residential_Area, Check_In count, Garbage_Report count, and District leaderboard rank.

---

### Requirement 11: REST API Structure and Error Handling

**User Story:** As a frontend developer, I want consistent, well-structured API responses and error codes, so that the Frontend can handle all states reliably during the hackathon demo.

#### Acceptance Criteria

1. THE API SHALL return all responses in JSON format with a consistent envelope containing a `data` field for success responses and an `error` field for error responses.
2. WHEN any endpoint receives a request with invalid or missing required parameters, THE API SHALL return a 400 status with a JSON body identifying the specific invalid field and reason.
3. WHEN an authenticated endpoint receives a request without a valid session token, THE API SHALL return a 401 status.
4. WHEN an unhandled exception occurs, THE API SHALL log the stack trace and return a 500 status with a generic error message that does not expose internal implementation details.
5. THE API SHALL assign a unique request identifier to each inbound request and include it in all log entries and error responses for that request.
6. THE API SHALL emit structured JSON logs for every inbound request including HTTP method, path, status code, and response time in milliseconds.
7. THE API SHALL expose the following core endpoints: `GET /residents/me`, `GET /residents/me/points`, `POST /checkins`, `POST /garbage-reports`, `GET /garbage-reports`, `GET /collection-points/nearby`, `GET /collection-points`, `GET /leaderboard`, `GET /map/stats`, `POST /bin-requests`, `GET /credits/redemptions`, `POST /credits/redeem`, and `GET /health`.

---

### Requirement 12: Collection Point Coverage and Bin Requests

**User Story:** As a Resident, I want to request a new collection point or get directions to the nearest one, so that underserved areas in my neighbourhood can be better served.

#### Acceptance Criteria

1. WHEN a Resident taps the "Request a Bin" button on the Map_Tab or Dashboard_Tab, THE Frontend SHALL display a form allowing the Resident to submit a Bin_Request with their current GPS coordinates and an optional description.
2. WHEN a Bin_Request is submitted, THE API SHALL store the Resident identifier, GPS coordinates, District, optional description, and UTC timestamp.
3. WHEN a Bin_Request is submitted, THE API SHALL return a confirmation to the Frontend within 3 seconds.
4. THE Map_Tab detail panel for any Collection_Point SHALL include a "Get Directions" button that opens the device's default maps application with the Collection_Point coordinates as the destination.
5. THE API SHALL identify Underserved_Areas by computing Collection_Point density (Collection_Points per km²) per District and flagging Districts whose density falls below 0.5 Collection_Points per km².
6. WHEN the Map_Tab is rendered, THE Frontend SHALL display a "Request a Bin" button accessible from the map toolbar, visible at all zoom levels.
7. THE API SHALL expose a `GET /collection-points/underserved` endpoint returning Districts and sub-areas identified as Underserved_Areas, including their current Collection_Point density and residential population.
8. WHEN a new Collection_Point is added to an Underserved_Area via dataset ingestion or manual addition, THE API SHALL recalculate the Underserved_Area status for the affected District within 60 seconds.

---

### Requirement 13: Credits Dashboard and Octopus Card Redemption

**User Story:** As a Resident, I want a dedicated credits dashboard where I can view my reward balances and redeem Individual_Points for Octopus card top-ups, so that my recycling efforts translate into tangible everyday value.

#### Acceptance Criteria

1. WHEN the Credits_Dashboard tab is opened, THE Frontend SHALL display the Resident's current Individual_Points balance, total Individual_Points earned to date, total Individual_Points redeemed to date, and the Resident's Residential_Area Building_Points balance.
2. WHEN the Credits_Dashboard tab is opened, THE Frontend SHALL display the available Octopus card top-up tiers, showing the Individual_Points cost and corresponding HKD value for each tier.
3. WHEN a Resident selects a redemption tier and confirms, THE Frontend SHALL submit a Redemption request to the API containing the Resident identifier and selected tier.
4. WHEN the API receives a Redemption request, THE API SHALL verify that the Resident's current Individual_Points balance is sufficient for the selected tier before processing.
5. IF the Resident's Individual_Points balance is insufficient for the selected tier, THEN THE API SHALL reject the Redemption with a 422 status and return the current balance and the required balance.
6. WHEN a Redemption is processed, THE API SHALL deduct the corresponding Individual_Points from the Resident's balance and record the Redemption with Resident identifier, tier, HKD value, Individual_Points deducted, and UTC timestamp in the same atomic transaction.
7. WHEN a Redemption is successfully processed, THE API SHALL return the updated Individual_Points balance and a Redemption confirmation identifier to the Frontend within 3 seconds.
8. THE Credits_Dashboard SHALL display the Resident's full Redemption history showing tier, HKD value, Individual_Points deducted, and timestamp for each past Redemption.
9. THE API SHALL expose a `GET /credits/redemptions` endpoint returning the Resident's Redemption history ordered by timestamp descending.
10. THE API SHALL expose a `POST /credits/redeem` endpoint accepting the selected redemption tier and processing the Redemption atomically.
11. WHEN the Credits_Dashboard is opened, THE Frontend SHALL display motivational messaging showing how many more Individual_Points the Resident needs to reach the next redemption tier.
12. THE Credits_Dashboard SHALL display the Resident's Residential_Area Building_Points balance alongside a leaderboard of the top 5 Residential_Areas within the Resident's District ranked by Building_Points.

---

### Requirement 14: Residential Area Building Points

**User Story:** As a Resident, I want my recycling actions to also benefit my building's collective score, so that neighbours are motivated to recycle together.

#### Acceptance Criteria

1. THE API SHALL maintain a Building_Points aggregate for each Residential_Area, updated atomically whenever a Resident associated with that Residential_Area earns Individual_Points.
2. WHEN a Resident is created or their Session is established, THE API SHALL associate the Resident with a Residential_Area based on their nearest Public Housing Estate or a default District-level area if no estate match is found within 500 metres.
3. THE API SHALL expose a `GET /residential-areas/:id/points` endpoint returning the Residential_Area's total Building_Points, rank within its District, and the list of contributing Residents (display names only).
4. WHEN the Credits_Dashboard is opened, THE Frontend SHALL display the Resident's Residential_Area name, total Building_Points, and rank among Residential_Areas within the same District.
5. THE API SHALL expose a `GET /residential-areas/leaderboard` endpoint accepting an optional `districtId` parameter and returning Residential_Areas ranked by Building_Points descending within that District.
6. WHEN Building_Points are awarded to a Residential_Area, THE API SHALL update the Residential_Area aggregate within 5 seconds so that the Credits_Dashboard reflects the change on the next request.

