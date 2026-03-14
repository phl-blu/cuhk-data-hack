-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Districts (seeded from government spatial boundary datasets)
CREATE TABLE IF NOT EXISTS districts (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  code        TEXT NOT NULL UNIQUE,
  area_km2    DOUBLE PRECISION NOT NULL,
  centroid    GEOMETRY(Point, 4326) NOT NULL,
  boundary    GEOMETRY(MultiPolygon, 4326) NOT NULL
);

-- Collection Points
CREATE TABLE IF NOT EXISTS collection_points (
  id            SERIAL PRIMARY KEY,
  source_id     TEXT NOT NULL UNIQUE,
  source        TEXT NOT NULL,
  name          TEXT NOT NULL,
  access_tier   TEXT NOT NULL CHECK (access_tier IN ('basic', 'premium')),
  materials     TEXT[] NOT NULL DEFAULT '{}',
  location      GEOMETRY(Point, 4326) NOT NULL,
  district_id   INTEGER REFERENCES districts(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cp_location ON collection_points USING GIST (location);

-- Residential Areas (housing estate clusters for building-level points)
CREATE TABLE IF NOT EXISTS residential_areas (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  district_id INTEGER REFERENCES districts(id),
  location    GEOMETRY(Point, 4326),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Building Points Aggregate (per residential area)
CREATE TABLE IF NOT EXISTS building_points (
  residential_area_id INTEGER PRIMARY KEY REFERENCES residential_areas(id),
  total_points        BIGINT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Residents
CREATE TABLE IF NOT EXISTS residents (
  id                  TEXT PRIMARY KEY,
  display_name        TEXT NOT NULL,
  district_id         INTEGER REFERENCES districts(id),
  residential_area_id INTEGER REFERENCES residential_areas(id),
  total_points        INTEGER NOT NULL DEFAULT 0,
  checkin_count       INTEGER NOT NULL DEFAULT 0,
  report_count        INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Points Transactions
CREATE TABLE IF NOT EXISTS points_transactions (
  id                  SERIAL PRIMARY KEY,
  resident_id         TEXT NOT NULL REFERENCES residents(id),
  points              INTEGER NOT NULL,
  individual_points   INTEGER NOT NULL DEFAULT 0,
  building_points     INTEGER NOT NULL DEFAULT 0,
  transaction_type    TEXT NOT NULL CHECK (transaction_type IN ('checkin', 'garbage_report')),
  reference_id        TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pt_resident ON points_transactions (resident_id, created_at DESC);

-- District Points Aggregate
CREATE TABLE IF NOT EXISTS district_points (
  district_id   INTEGER PRIMARY KEY REFERENCES districts(id),
  total_points  BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Check-In Records
CREATE TABLE IF NOT EXISTS checkins (
  id                  SERIAL PRIMARY KEY,
  resident_id         TEXT NOT NULL REFERENCES residents(id),
  collection_point_id INTEGER NOT NULL REFERENCES collection_points(id),
  resident_lat        DOUBLE PRECISION NOT NULL,
  resident_lng        DOUBLE PRECISION NOT NULL,
  points_awarded      INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checkin_dedup ON checkins (resident_id, collection_point_id, created_at DESC);

-- Garbage Reports
CREATE TABLE IF NOT EXISTS garbage_reports (
  id             SERIAL PRIMARY KEY,
  resident_id    TEXT NOT NULL REFERENCES residents(id),
  district_id    INTEGER REFERENCES districts(id),
  location       GEOMETRY(Point, 4326) NOT NULL,
  photo_url      TEXT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 15,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gr_location ON garbage_reports USING GIST (location);

-- Bin Requests
CREATE TABLE IF NOT EXISTS bin_requests (
  id          SERIAL PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(id),
  district_id INTEGER REFERENCES districts(id),
  location    GEOMETRY(Point, 4326) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Redemptions
CREATE TABLE IF NOT EXISTS redemptions (
  id          SERIAL PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(id),
  tier        TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  hkd_value   DOUBLE PRECISION NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dataset Ingestion Status
CREATE TABLE IF NOT EXISTS dataset_ingestion_status (
  dataset_name  TEXT PRIMARY KEY,
  last_ingested TIMESTAMPTZ,
  record_count  INTEGER,
  status        TEXT NOT NULL DEFAULT 'pending'
);

-- Public Housing Estates
CREATE TABLE IF NOT EXISTS housing_estates (
  id          SERIAL PRIMARY KEY,
  source_id   TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  district_id INTEGER REFERENCES districts(id),
  location    GEOMETRY(Point, 4326) NOT NULL
);
