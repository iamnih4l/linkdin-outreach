const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS candidates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  linkedin_url  TEXT UNIQUE,
  name          TEXT NOT NULL,
  title         TEXT,
  company       TEXT,
  industry      TEXT,
  role_category TEXT CHECK(role_category IN (
    'recruiter','hr','founder','cto','engineering_leader',
    'ai_ml_lead','product_manager','hiring_manager','other'
  )),
  seniority     TEXT CHECK(seniority IN (
    'entry','mid','senior','director','vp','c_level','founder'
  )),
  profile_summary      TEXT,
  relevance_reason     TEXT,
  recommended_objective TEXT,
  relevance_score      INTEGER CHECK(relevance_score BETWEEN 0 AND 100),
  score_explanation    TEXT,
  confidence_level     TEXT CHECK(confidence_level IN ('high','medium','low')),
  missing_info         TEXT,
  raw_data             TEXT,
  status               TEXT DEFAULT 'new' CHECK(status IN (
    'new','reviewed','approved','skipped','contacted','failed'
  )),
  is_demo              INTEGER DEFAULT 0,
  discovered_at        DATETIME DEFAULT (datetime('now')),
  updated_at           DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id           INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  message_type           TEXT CHECK(message_type IN (
    'networking','internship','collaboration','technical'
  )),
  message_text           TEXT NOT NULL,
  personalization_evidence TEXT,
  status                 TEXT DEFAULT 'draft' CHECK(status IN (
    'draft','approved','sent','failed','skipped'
  )),
  created_at             DATETIME DEFAULT (datetime('now')),
  sent_at                DATETIME
);

CREATE TABLE IF NOT EXISTS activity_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  action         TEXT NOT NULL,
  details        TEXT,
  candidate_name TEXT,
  candidate_id   INTEGER REFERENCES candidates(id) ON DELETE SET NULL,
  status         TEXT DEFAULT 'info' CHECK(status IN (
    'info','success','warning','error'
  )),
  timestamp      DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_state (
  key   TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_role ON candidates(role_category);
CREATE INDEX IF NOT EXISTS idx_messages_candidate ON messages(candidate_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp DESC);
`;

export default SCHEMA_SQL;
