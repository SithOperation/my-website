-- Sentinel additive intelligence model.
-- Apply after the existing events/news_articles/collector_health schema.
-- No existing rows are altered or deleted by this migration.

CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT PRIMARY KEY,
  publisher TEXT NOT NULL,
  source_type TEXT NOT NULL,
  official_source INTEGER NOT NULL DEFAULT 0 CHECK (official_source IN (0, 1)),
  independence_group TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject_category TEXT NOT NULL,
  information_type TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'UNKNOWN',
  lifecycle TEXT NOT NULL,
  occurrence_at TEXT,
  latitude REAL,
  longitude REAL,
  location_confidence TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE TABLE IF NOT EXISTS incident_sources (
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  article_id TEXT,
  relationship TEXT NOT NULL CHECK (relationship IN ('reported', 'corroborates', 'contradicts', 'official_confirmation')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (incident_id, source_id, relationship)
);

CREATE TABLE IF NOT EXISTS claims (
  claim_id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incidents(incident_id) ON DELETE SET NULL,
  article_id TEXT,
  claim_text TEXT NOT NULL,
  claim_status TEXT NOT NULL,
  extracted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  evidence_id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(source_id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL,
  url TEXT,
  detail TEXT,
  supports_claim INTEGER NOT NULL CHECK (supports_claim IN (0, 1)),
  observed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS article_intelligence (
  article_id TEXT PRIMARY KEY,
  information_type TEXT NOT NULL,
  subject_category TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  occurrence_at TEXT,
  geographic_relevance_json TEXT NOT NULL DEFAULT '{}',
  corroboration_json TEXT NOT NULL DEFAULT '{}',
  classification_version TEXT NOT NULL DEFAULT '1.0',
  classified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classification_history (
  history_id TEXT PRIMARY KEY,
  article_id TEXT,
  incident_id TEXT,
  previous_classification_json TEXT,
  new_classification_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_lifecycle ON incidents(lifecycle, occurrence_at);
CREATE INDEX IF NOT EXISTS idx_incidents_subject ON incidents(subject_category, verification_status);
CREATE INDEX IF NOT EXISTS idx_incident_sources_source ON incident_sources(source_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_claims_article ON claims(article_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence(claim_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_article_intelligence_type ON article_intelligence(information_type, lifecycle);
CREATE INDEX IF NOT EXISTS idx_classification_history_article ON classification_history(article_id, changed_at);
