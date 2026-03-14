# Requirements Document

## Introduction

A backend analytics service for the Green Loop Challenge — a spatial data science project addressing Hong Kong's "first-mile problem" in recycling. Residents in ultra-dense urban areas do not consistently bring recyclables to collection points, causing recycling rates to fluctuate despite the expansion of the GREEN@COMMUNITY network.

The service ingests and normalizes seven official Hong Kong datasets covering recycling infrastructure, waste management facilities, residential buildings, and population census data. It performs spatial gap analysis, computes coverage ratios by access tier, correlates collection point density with population, and surfaces historical material recovery trends. Clean REST endpoints expose these insights to a frontend supporting the three analytical pillars of the challenge: Analyze & Uncover, Innovate & Propose, and Justify & Measure.

## Glossary

- **Analytics_Service**: The backend application responsible for ingesting, normalizing, analyzing, and serving recycling analytics data.
- **GREEN@COMMUNITY_Station**: A high-quality recycling station operated under the GREEN@COMMUNITY network that accepts lower-value recyclables including Styrofoam and beverage cartons. Classified as "Premium Access".
- **Collection_Point**: Any physical location where residents can deposit recyclables, including both street bins and GREEN@COMMUNITY_Stations.
- **Basic_Access**: A Collection_Point tier comprising standard street-level recycling bins with limited material acceptance.
- **Premium_Access**: A Collection_Point tier comprising GREEN@COMMUNITY_Stations with broader material acceptance including Styrofoam and beverage cartons.
- **Access_Tier**: The classification of a Collection_Point as either Basic_Access or Premium_Access.
- **Waste_Management_Facility**: A strategic infrastructure site including Strategic Landfills, Refuse Transfer Stations, and Chemical Waste Treatment Centres.
- **Public_Housing_Estate**: A government-managed residential estate with known population intake and flat counts, used as a proxy for high-density waste generation zones.
- **Private_Building**: A privately owned residential or mixed-use building identified by district, used to identify clusters potentially underserved relative to public estates.
- **Coverage_Ratio**: The number of Collection_Points per unit of population or residential units within a defined geographic area.
- **Gap_Zone**: A geographic area where Coverage_Ratio falls below a defined threshold, indicating underservice.
- **Material_Recovery_Rate**: The percentage of a given material type (Paper, Plastic, Metal) recovered through recycling relative to total waste generated, measured annually.
- **District**: One of Hong Kong's 18 administrative districts used as the primary geographic unit for aggregation and comparison.
- **External_API**: A third-party or government open-data endpoint providing one of the seven required datasets.
- **Cache**: An in-memory or persistent store used to reduce redundant calls to External_APIs.

## Requirements

### Requirement 1: Dataset Ingestion and Normalization

**User Story:** As a data engineer, I want all seven Hong Kong datasets ingested and normalized into consistent schemas, so that downstream analysis can query across sources without manual transformation.

#### Acceptance Criteria

1. WHEN the Analytics_Service starts, THE Analytics_Service SHALL fetch data from all seven External_APIs: Open Space Database of Recycling Stations, Recyclable Collection Points Data, Waste Management Facilities, Datasets for Solid Waste in Hong Kong, Location and Profile of Public Housing Estates, Database of Private Buildings in Hong Kong, and 2021 Population Census.
2. WHEN GREEN@COMMUNITY_Station records are ingested, THE Analytics_Service SHALL normalize each record to include a unique identifier, name, coordinates (latitude and longitude), accepted material types, and Access_Tier set to "Premium_Access".
3. WHEN Recyclable Collection Points records are ingested, THE Analytics_Service SHALL normalize each record to include a unique identifier, coordinates, and Access_Tier set to either "Basic_Access" for street bins or "Premium_Access" for recycling stations.
4. WHEN Waste_Management_Facility records are ingested, THE Analytics_Service SHALL normalize each record to include a unique identifier, facility type (Landfill, Transfer Station, or Chemical Waste Treatment Centre), and coordinates.
5. WHEN Public_Housing_Estate records are ingested, THE Analytics_Service SHALL normalize each record to include estate identifier, District, coordinates, total flat count, and population intake figure.
6. WHEN Private_Building records are ingested, THE Analytics_Service SHALL normalize each record to include building identifier, District, and coordinates.
7. WHEN Population Census records are ingested, THE Analytics_Service SHALL normalize each record to include District identifier and total resident population.
8. WHEN solid waste recovery records are ingested, THE Analytics_Service SHALL normalize each record to include year, material type (Paper, Plastic, or Metal), and recovered volume in tonnes.
9. IF a required field is missing from an ingested record, THEN THE Analytics_Service SHALL reject that record, log a warning with the field name and source dataset name, and continue processing remaining records.
10. THE Analytics_Service SHALL preserve the original source identifier alongside each normalized record to enable traceability.

---

### Requirement 2: Access Tier Classification

**User Story:** As a policy analyst, I want every Collection_Point classified as Basic_Access or Premium_Access, so that I can distinguish baseline infrastructure from higher-quality GREEN@COMMUNITY service in all analyses.

#### Acceptance Criteria

1. THE Analytics_Service SHALL assign Access_Tier "Premium_Access" to all records sourced from the Open Space Database of Recycling Stations.
2. THE Analytics_Service SHALL assign Access_Tier "Basic_Access" to street bin records and "Premium_Access" to recycling station records sourced from the Recyclable Collection Points dataset.
3. WHEN a Coverage_Ratio is computed, THE Analytics_Service SHALL compute separate ratios for Basic_Access Collection_Points and Premium_Access Collection_Points within the same geographic unit.
4. WHEN spatial gap analysis results are returned, THE Analytics_Service SHALL include the Access_Tier breakdown for each Gap_Zone, indicating whether the deficit is in Basic_Access, Premium_Access, or both.
5. IF a Collection_Point record does not contain sufficient information to determine Access_Tier, THEN THE Analytics_Service SHALL flag the record as "Unknown_Tier", log a warning, and exclude it from tier-specific Coverage_Ratio calculations.

---

### Requirement 3: Spatial Gap Analysis

**User Story:** As a city planner, I want to identify underserved districts and neighbourhoods, so that I can propose data-backed locations for new Collection_Points.

#### Acceptance Criteria

1. WHEN gap analysis is requested, THE Analytics_Service SHALL compute the Coverage_Ratio of Collection_Points per 1,000 residents for each District using the normalized Collection_Points and Population Census datasets.
2. WHEN gap analysis is requested, THE Analytics_Service SHALL compute the Coverage_Ratio of Collection_Points per 1,000 residential units for each District using the Public_Housing_Estate and Private_Building datasets.
3. WHEN a District's Coverage_Ratio falls below a configurable threshold, THE Analytics_Service SHALL classify that District as a Gap_Zone.
4. WHEN gap analysis results are returned, THE Analytics_Service SHALL include for each Gap_Zone: District name, total resident population, total residential units, Basic_Access count, Premium_Access count, and both Coverage_Ratios.
5. WHEN a geographic bounding box is provided, THE Analytics_Service SHALL return all Collection_Points whose coordinates fall within that bounding box, annotated with their Access_Tier.
6. WHEN a center coordinate and radius in kilometres is provided, THE Analytics_Service SHALL return all Collection_Points within that radius, annotated with Access_Tier and distance from the query point.
7. IF no Collection_Points exist within a queried area, THEN THE Analytics_Service SHALL return an empty array with a 200 status and include the computed Coverage_Ratio of zero for that area.

---

### Requirement 4: Population Density Correlation

**User Story:** As a data scientist, I want Collection_Point density correlated with population and housing data, so that I can quantify the relationship between residential density and recycling access gaps.

#### Acceptance Criteria

1. WHEN correlation analysis is requested for a District, THE Analytics_Service SHALL join Collection_Point counts with the Population Census resident count for that District and return the Coverage_Ratio.
2. WHEN correlation analysis is requested, THE Analytics_Service SHALL separately account for Public_Housing_Estate population and Private_Building counts within each District to surface differences in access between public and private residential clusters.
3. THE Analytics_Service SHALL identify the five Districts with the lowest Premium_Access Coverage_Ratio and return them ranked in ascending order.
4. THE Analytics_Service SHALL identify the five Districts with the highest resident population and return their corresponding Basic_Access and Premium_Access Coverage_Ratios.
5. WHEN Public_Housing_Estate data is joined with Collection_Point data, THE Analytics_Service SHALL compute the number of Collection_Points within 500 metres of each estate centroid, broken down by Access_Tier.

---

### Requirement 5: Historical Material Recovery Trends

**User Story:** As a sustainability analyst, I want historical recovery trends for Paper, Plastic, and Metal, so that I can identify which materials are improving and which need targeted intervention.

#### Acceptance Criteria

1. WHEN trend data is requested, THE Analytics_Service SHALL return annual Material_Recovery_Rate for Paper, Plastic, and Metal for all available years in the Solid Waste dataset.
2. WHEN trend data is requested for a specific material type, THE Analytics_Service SHALL return only records matching that material type.
3. WHEN trend data is requested for a date range, THE Analytics_Service SHALL filter records to years within the specified start and end years inclusive.
4. THE Analytics_Service SHALL compute the year-over-year change in recovered volume in tonnes for each material type and include it in the trend response.
5. IF no recovery data exists for a requested material type and year range, THEN THE Analytics_Service SHALL return an empty result set with a 200 status.

---

### Requirement 6: REST API Endpoints

**User Story:** As a frontend developer, I want well-defined REST endpoints for all analytical outputs, so that I can build the challenge dashboard without depending on raw government API formats.

#### Acceptance Criteria

1. THE Analytics_Service SHALL expose a `GET /districts` endpoint that returns all 18 Districts with their resident population, residential unit count, Basic_Access count, Premium_Access count, and both Coverage_Ratios.
2. THE Analytics_Service SHALL expose a `GET /districts/:id/gap-analysis` endpoint that returns the gap analysis result for a specific District including Access_Tier breakdown.
3. THE Analytics_Service SHALL expose a `GET /gap-zones` endpoint that returns all Districts classified as Gap_Zones, sorted by Premium_Access Coverage_Ratio ascending.
4. THE Analytics_Service SHALL expose a `GET /collection-points` endpoint that returns all normalized Collection_Points with Access_Tier, accepting optional `tier` query parameter to filter by "basic" or "premium".
5. THE Analytics_Service SHALL expose a `GET /collection-points/search` endpoint accepting `lat`, `lng`, and `radius` query parameters and returning nearby Collection_Points annotated with Access_Tier and distance.
6. THE Analytics_Service SHALL expose a `GET /trends/materials` endpoint returning annual Material_Recovery_Rate for all materials, accepting optional `material` and `startYear`/`endYear` query parameters.
7. THE Analytics_Service SHALL expose a `GET /facilities` endpoint returning all normalized Waste_Management_Facility records with facility type and coordinates.
8. THE Analytics_Service SHALL expose a `GET /health` endpoint returning service status and the connectivity state of each of the seven External_APIs.
9. WHEN any endpoint receives a request with invalid or missing required parameters, THE Analytics_Service SHALL return a 400 status with a JSON body describing the specific validation error.
10. WHEN any endpoint returns a successful response, THE Analytics_Service SHALL include a `dataAsOf` timestamp indicating when the underlying datasets were last fetched.

---

### Requirement 7: Caching

**User Story:** As a backend developer, I want External_API responses cached, so that the service remains responsive under repeated queries during the hackathon demo without exhausting rate limits.

#### Acceptance Criteria

1. WHEN an External_API response is successfully retrieved, THE Analytics_Service SHALL cache the response with a configurable time-to-live (TTL).
2. WHEN a cached response exists and has not expired, THE Analytics_Service SHALL serve the cached data without making a new External_API call.
3. WHEN a cached response has expired, THE Analytics_Service SHALL fetch fresh data from the External_API and update the cache.
4. THE Analytics_Service SHALL support a default cache TTL of 300 seconds, overridable per dataset via environment variable.
5. IF the cache store is unavailable, THEN THE Analytics_Service SHALL fall back to direct External_API calls and log a warning.

---

### Requirement 8: Error Handling and Observability

**User Story:** As a developer, I want structured logs and consistent error responses, so that I can debug issues quickly during the hackathon.

#### Acceptance Criteria

1. THE Analytics_Service SHALL emit structured JSON logs for every inbound request, including HTTP method, path, status code, and response time in milliseconds.
2. WHEN an unhandled exception occurs, THE Analytics_Service SHALL log the stack trace and return a 500 response with a generic error message that does not expose internal implementation details.
3. THE Analytics_Service SHALL assign a unique request ID to each inbound request and include it in all log entries and error responses for that request.
4. IF a downstream External_API call fails, THEN THE Analytics_Service SHALL log the failure with the dataset name, endpoint URL, and failure reason, and include the affected dataset name in the error response.
5. THE Analytics_Service SHALL support configurable External_API base URLs and authentication credentials via environment variables.
