import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'node:url';
import fs from 'fs';
import { getDb } from '../db/index.js';
import { chromeBridge } from '../agents/cdp-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// GET all connections with filters
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const {
      category = 'all',
      status = 'all',
      search = '',
      sort = 'score_desc',
      limit = 100,
      offset = 0,
    } = req.query;

    let query = `
      SELECT c.*, 
        (SELECT json_group_array(json_object(
          'id', m.id,
          'message_type', m.message_type,
          'message_text', m.message_text,
          'evidence', m.personalization_evidence
        )) FROM messages m WHERE m.candidate_id = c.id) as messages_json
      FROM candidates c
      WHERE (c.is_demo = 0)
    `;

    const params = [];

    // Filter by category
    if (category && category !== 'all') {
      if (category === 'founder') {
        query += ` AND (c.role_category = 'founder' OR c.title LIKE '%founder%' OR c.title LIKE '%ceo%')`;
      } else if (category === 'hiring') {
        query += ` AND (c.role_category = 'recruiter' OR c.title LIKE '%hiring%' OR c.title LIKE '%talent%' OR c.title LIKE '%recruiter%' OR c.title LIKE '%recruiting%' OR c.title LIKE '%human resources%' OR c.title LIKE '%head of people%' OR c.score_explanation LIKE '%hiring%')`;
      } else if (category === 'recruiter') {
        query += ` AND (c.role_category = 'recruiter' OR c.title LIKE '%recruiter%' OR c.title LIKE '%talent%')`;
      } else if (category === 'cto') {
        query += ` AND (c.role_category = 'cto' OR c.title LIKE '%cto%' OR c.title LIKE '%chief technology officer%')`;
      } else if (category === 'ai_ml_lead') {
        query += ` AND (c.role_category = 'ai_ml_lead' OR c.title LIKE '%ai%' OR c.title LIKE '%machine learning%' OR c.title LIKE '%deep learning%')`;
      } else if (category === 'cfo_coo') {
        query += ` AND (c.title LIKE '%cfo%' OR c.title LIKE '%coo%' OR c.title LIKE '%chief revenue officer%' OR c.title LIKE '%cro%')`;
      } else if (category === 'engineering_leader') {
        query += ` AND (c.role_category = 'engineering_leader' OR c.title LIKE '%engineering manager%' OR c.title LIKE '%director of engineering%')`;
      }
    }

    // Filter by status
    if (status && status !== 'all') {
      if (status === 'starred') {
        query += ` AND c.is_starred = 1`;
      } else {
        query += ` AND c.status = ?`;
        params.push(status);
      }
    }

    // Search query
    if (search && search.trim()) {
      query += ` AND (c.name LIKE ? OR c.company LIKE ? OR c.title LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    // Sorting
    if (sort === 'score_asc') {
      query += ` ORDER BY c.relevance_score ASC, c.name ASC`;
    } else if (sort === 'name_asc') {
      query += ` ORDER BY c.name ASC`;
    } else {
      query += ` ORDER BY c.relevance_score DESC, c.id ASC`;
    }

    // Get total matching count
    const countSql = query.replace(/SELECT c\.\*[\s\S]*?FROM candidates c/, 'SELECT COUNT(*) as count FROM candidates c');
    const totalMatching = db.prepare(countSql).get(...params)?.count || 0;

    // Apply limit & offset
    query += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const rows = db.prepare(query).all(...params);

    // Format output
    const connections = rows.map(r => {
      let messages = [];
      try {
        messages = JSON.parse(r.messages_json || '[]');
      } catch (e) {
        messages = [];
      }

      return {
        id: r.id,
        name: r.name,
        title: r.title,
        company: r.company || '',
        role_category: r.role_category,
        relevance_score: r.relevance_score,
        relevance_reason: r.relevance_reason,
        recommended_objective: r.recommended_objective,
        score_explanation: r.score_explanation,
        linkedin_url: r.linkedin_url,
        status: r.status,
        is_starred: Boolean(r.is_starred),
        messages: {
          concise: messages.find(m => m.evidence?.includes('Concise'))?.message_text || messages[0]?.message_text || '',
          value_first: messages.find(m => m.evidence?.includes('Value-First'))?.message_text || messages[1]?.message_text || '',
          conversational: messages.find(m => m.evidence?.includes('Conversational'))?.message_text || messages[2]?.message_text || ''
        }
      };
    });

    // Compute category counts
    const counts = {
      all: db.prepare("SELECT count(*) as c FROM candidates WHERE is_demo = 0").get().c,
      hiring: db.prepare("SELECT count(*) as c FROM candidates WHERE is_demo = 0 AND (role_category = 'recruiter' OR title LIKE '%hiring%' OR title LIKE '%talent%' OR title LIKE '%recruiter%' OR title LIKE '%recruiting%' OR title LIKE '%human resources%' OR title LIKE '%head of people%' OR score_explanation LIKE '%hiring%')").get().c,
      founder: db.prepare("SELECT count(*) as c FROM candidates WHERE is_demo = 0 AND (role_category = 'founder' OR title LIKE '%founder%' OR title LIKE '%ceo%')").get().c,
      recruiter: db.prepare("SELECT count(*) as c FROM candidates WHERE is_demo = 0 AND (role_category = 'recruiter' OR title LIKE '%recruiter%' OR title LIKE '%talent%')").get().c,
      cto: db.prepare("SELECT count(*) as c FROM candidates WHERE is_demo = 0 AND (role_category = 'cto' OR title LIKE '%cto%' OR title LIKE '%chief technology officer%')").get().c,
      ai_ml_lead: db.prepare("SELECT count(*) as c FROM candidates WHERE is_demo = 0 AND (role_category = 'ai_ml_lead' OR title LIKE '%ai%' OR title LIKE '%machine learning%')").get().c,
      cfo_coo: db.prepare("SELECT count(*) as c FROM candidates WHERE is_demo = 0 AND (title LIKE '%cfo%' OR title LIKE '%coo%' OR title LIKE '%cro%')").get().c,
      starred: db.prepare("SELECT count(*) as c FROM candidates WHERE is_demo = 0 AND is_starred = 1").get().c,
      messaged: db.prepare("SELECT count(*) as c FROM candidates WHERE is_demo = 0 AND status = 'contacted'").get().c,
    };

    res.json({
      total: totalMatching,
      limit: Number(limit),
      offset: Number(offset),
      counts,
      connections,
    });
  } catch (err) {
    console.error('Error fetching connections:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update candidate status (e.g. 'contacted', 'new', 'skipped')
router.post('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body;

    if (!['new', 'contacted', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    db.prepare('UPDATE candidates SET status = ?, updated_at = datetime("now") WHERE id = ?').run(status, id);
    res.json({ success: true, id, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle star / favorite
router.post('/:id/star', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const row = db.prepare('SELECT is_starred FROM candidates WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Candidate not found' });

    const newStarred = row.is_starred ? 0 : 1;
    db.prepare('UPDATE candidates SET is_starred = ?, updated_at = datetime("now") WHERE id = ?').run(newStarred, id);
    res.json({ success: true, id, is_starred: Boolean(newStarred) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stage message into Chrome tab via CDP
router.post('/stage', async (req, res) => {
  try {
    const { message_text } = req.body;
    if (!message_text) return res.status(400).json({ error: 'Message text is required' });

    const result = await chromeBridge.stageMessageInChrome(message_text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check Chrome CDP status
router.get('/chrome-status', async (_req, res) => {
  try {
    const isConnected = await chromeBridge.isChromeConnected();
    const tab = isConnected ? await chromeBridge.getLinkedInTab() : null;
    res.json({
      connected: isConnected,
      port: 9222,
      tabTitle: tab?.title || null,
      tabUrl: tab?.url || null
    });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// Trigger live sync from Chrome
router.post('/sync', async (_req, res) => {
  try {
    const { syncAllConnections } = await import('../scripts/sync-connections.js');
    const result = await syncAllConnections(35);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API] Sync failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download CSV route
router.get('/download-csv', (_req, res) => {
  const csvPath = path.join(__dirname, '..', '..', 'linkedin_connections_prioritized.csv');
  if (fs.existsSync(csvPath)) {
    res.download(csvPath, 'linkedin_connections_prioritized.csv');
  } else {
    res.status(404).json({ error: 'CSV file not found' });
  }
});

export default router;
