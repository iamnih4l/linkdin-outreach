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

  for (const p of list) {
    let roleCat = 'other';
    if (p.role_category.includes('Recruiter')) roleCat = 'recruiter';
    else if (p.role_category.includes('Founder') || p.role_category.includes('CEO')) roleCat = 'founder';
    else if (p.role_category.includes('CTO')) roleCat = 'cto';
    else if (p.role_category.includes('AI / ML')) roleCat = 'ai_ml_lead';
    else if (p.role_category.includes('Product')) roleCat = 'product_manager';
    else if (p.role_category.includes('Engineering Leader')) roleCat = 'engineering_leader';

    try {
      const res = insertCandidate.run({
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

      const cid = res.lastInsertRowid || db.prepare('SELECT id FROM candidates WHERE linkedin_url = ?').get(p.linkedin_url)?.id;
      if (cid) {
        db.prepare('DELETE FROM messages WHERE candidate_id = ?').run(cid);
        insertMsg.run(cid, 'internship', p.message_draft_concise, 'Concise & Direct');
        insertMsg.run(cid, 'technical', p.message_draft_value_first, 'Value-First & Project Insight');
        insertMsg.run(cid, 'networking', p.message_draft_conversational, 'Conversational & Narrative');
      }
    } catch (e) {
      // skip individual row errors
    }
  }

  const count = db.prepare('SELECT count(*) as c FROM candidates').get().c;
  console.log(`[clean_data] Database clean and synced! Total real connections in DB: ${count}`);
}
