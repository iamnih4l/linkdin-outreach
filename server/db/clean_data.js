import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { getDb } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadRealConnections() {
  const db = getDb();

  // Clean out any synthetic demo candidates or candidates without real linkedin URL
  db.prepare("DELETE FROM candidates WHERE is_demo = 1 OR linkedin_url LIKE '%demo-%' OR linkedin_url IS NULL OR linkedin_url NOT LIKE '%linkedin.com/in/%'").run();

  // Ensure is_starred column exists
  try {
    db.prepare("ALTER TABLE candidates ADD COLUMN is_starred INTEGER DEFAULT 0").run();
  } catch (e) {
    // Column already exists
  }

  // Ensure schema supports new role categories and message types without CHECK constraint errors
  try {
    db.prepare("INSERT INTO candidates (linkedin_url, name, role_category, is_demo) VALUES ('__test_check__', 'Test', 'uae_professor', 1)").run();
    db.prepare("DELETE FROM candidates WHERE linkedin_url = '__test_check__'").run();
  } catch (err) {
    if (err.message && err.message.includes('CHECK constraint failed')) {
      console.log('[clean_data] Migrating database schema to support UAE categories...');
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE candidates_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          linkedin_url  TEXT UNIQUE,
          name          TEXT NOT NULL,
          title         TEXT,
          company       TEXT,
          industry      TEXT,
          role_category TEXT,
          seniority     TEXT,
          profile_summary      TEXT,
          relevance_reason     TEXT,
          recommended_objective TEXT,
          relevance_score      INTEGER,
          score_explanation    TEXT,
          confidence_level     TEXT,
          missing_info         TEXT,
          raw_data             TEXT,
          status               TEXT DEFAULT 'new',
          is_demo              INTEGER DEFAULT 0,
          discovered_at        DATETIME DEFAULT (datetime('now')),
          updated_at           DATETIME DEFAULT (datetime('now')),
          is_starred           INTEGER DEFAULT 0
        );
        INSERT INTO candidates_new SELECT id, linkedin_url, name, title, company, industry, role_category, seniority, profile_summary, relevance_reason, recommended_objective, relevance_score, score_explanation, confidence_level, missing_info, raw_data, status, is_demo, discovered_at, updated_at, COALESCE(is_starred, 0) FROM candidates;
        DROP TABLE candidates;
        ALTER TABLE candidates_new RENAME TO candidates;

        CREATE TABLE messages_new (
          id                     INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id           INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
          message_type           TEXT,
          message_text           TEXT NOT NULL,
          personalization_evidence TEXT,
          status                 TEXT DEFAULT 'draft',
          created_at             DATETIME DEFAULT (datetime('now')),
          sent_at                DATETIME
        );
        INSERT INTO messages_new SELECT id, candidate_id, message_type, message_text, personalization_evidence, status, created_at, sent_at FROM messages;
        DROP TABLE messages;
        ALTER TABLE messages_new RENAME TO messages;
        PRAGMA foreign_keys = ON;
      `);
    }
  }

  const jsonPath = path.join(__dirname, '..', '..', 'scratch', 'processed_connections.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn('[clean_data] processed_connections.json not found');
    return;
  }

  const list = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`[clean_data] Syncing ${list.length} real LinkedIn connections...`);

  const insertCandidate = db.prepare(`
    INSERT INTO candidates (
      linkedin_url, name, title, company, industry, role_category, seniority,
      relevance_reason, recommended_objective, relevance_score, score_explanation,
      confidence_level, status, is_demo, is_starred
    ) VALUES (
      @linkedin_url, @name, @title, @company, 'Technology', @role_category, 'mid',
      @relevance_reason, @recommended_objective, @relevance_score, @score_explanation,
      'high', 'new', 0, 0
    )
    ON CONFLICT(linkedin_url) DO UPDATE SET
      title = excluded.title,
      company = excluded.company,
      role_category = excluded.role_category,
      relevance_score = excluded.relevance_score,
      relevance_reason = excluded.relevance_reason,
      recommended_objective = excluded.recommended_objective,
      updated_at = datetime('now')
  `);

  const insertMsg = db.prepare(`
    INSERT INTO messages (candidate_id, message_type, message_text, personalization_evidence, status)
    VALUES (?, ?, ?, ?, 'draft')
  `);

  const selectCandidateId = db.prepare('SELECT id FROM candidates WHERE linkedin_url = ?');

  const syncAll = db.transaction((items) => {
    for (const p of items) {
      let roleCat = 'other';
      if (p.role_category.includes('UAE Professor')) roleCat = 'uae_professor';
      else if (p.role_category.includes('UAE Student')) roleCat = 'uae_student';
      else if (p.role_category.includes('Recruiter')) roleCat = 'recruiter';
      else if (p.role_category.includes('Founder') || p.role_category.includes('CEO')) roleCat = 'founder';
      else if (p.role_category.includes('CTO')) roleCat = 'cto';
      else if (p.role_category.includes('AI / ML')) roleCat = 'ai_ml_lead';
      else if (p.role_category.includes('Product')) roleCat = 'product_manager';
      else if (p.role_category.includes('Engineering Leader')) roleCat = 'engineering_leader';

      try {
        insertCandidate.run({
          linkedin_url: p.linkedin_url,
          name: p.name,
          title: p.title,
          company: p.company || '',
          role_category: roleCat,
          relevance_reason: p.relevance_reason,
          recommended_objective: p.recommended_objective,
          relevance_score: p.relevance_score,
          score_explanation: p.score_explanation
        });

        const cid = selectCandidateId.get(p.linkedin_url)?.id;
        if (cid) {
          db.prepare('DELETE FROM messages WHERE candidate_id = ?').run(cid);
          const obj = p.recommended_objective || 'networking';
          insertMsg.run(cid, obj, p.message_draft_concise, 'Concise & Direct');
          insertMsg.run(cid, obj, p.message_draft_value_first, 'Value-First & Project Insight');
          insertMsg.run(cid, obj, p.message_draft_conversational, 'Conversational & Narrative');
        }
      } catch (e) {
        // skip individual row errors
      }
    }
  });

  syncAll(list);

  const count = db.prepare('SELECT count(*) as c FROM candidates').get().c;
  console.log(`[clean_data] Database clean and synced! Total real connections in DB: ${count}`);
}
