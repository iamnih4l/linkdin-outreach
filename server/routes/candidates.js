import { Router } from 'express';
import { getDb } from '../db/index.js';
import { browserAgent } from '../agents/browser-agent.js';
import { parseProfileText } from '../agents/profile-analyzer.js';
import { generateCandidateMessages } from '../agents/message-generator.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const {
    status,
    role_category,
    industry,
    company,
    min_score,
    max_score,
    search,
    sort = 'relevance_score',
    order = 'DESC',
    limit = 50,
    offset = 0,
  } = req.query;

  const conditions = [];
  const params = {};

  if (status) {
    conditions.push('c.status = @status');
    params.status = status;
  }
  if (role_category) {
    conditions.push('c.role_category = @role_category');
    params.role_category = role_category;
  }
  if (industry) {
    conditions.push('c.industry = @industry');
    params.industry = industry;
  }
  if (company) {
    conditions.push('c.company LIKE @company');
    params.company = `%${company}%`;
  }
  if (min_score) {
    conditions.push('c.relevance_score >= @min_score');
    params.min_score = Number(min_score);
  }
  if (max_score) {
    conditions.push('c.relevance_score <= @max_score');
    params.max_score = Number(max_score);
  }
  if (search) {
    conditions.push('(c.name LIKE @search OR c.title LIKE @search OR c.company LIKE @search)');
    params.search = `%${search}%`;
  }

  const allowedSorts = ['relevance_score', 'name', 'company', 'discovered_at', 'status'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'relevance_score';
  const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM candidates c ${where}`).get(params);

  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM messages m WHERE m.candidate_id = c.id) as message_count
    FROM candidates c
    ${where}
    ORDER BY c.${safeSort} ${safeOrder}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: Number(limit), offset: Number(offset) });

  res.json({ candidates: rows, total: countRow.total, limit: Number(limit), offset: Number(offset) });
});

router.get('/stats', (_req, res) => {
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM candidates').get().count;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM candidates GROUP BY status').all();
  const byRole = db.prepare('SELECT role_category, COUNT(*) as count FROM candidates GROUP BY role_category').all();
  const avgScore = db.prepare('SELECT AVG(relevance_score) as avg FROM candidates WHERE relevance_score IS NOT NULL').get().avg;
  const topScorers = db.prepare('SELECT name, relevance_score, company, title FROM candidates ORDER BY relevance_score DESC LIMIT 5').all();
  const messageStats = db.prepare('SELECT status, COUNT(*) as count FROM messages GROUP BY status').all();

  res.json({
    total,
    byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
    byRole: Object.fromEntries(byRole.map(r => [r.role_category, r.count])),
    avgScore: Math.round(avgScore || 0),
    topScorers,
    messageStats: Object.fromEntries(messageStats.map(r => [r.status, r.count])),
  });
});

router.get('/filters', (_req, res) => {
  const db = getDb();
  const industries = db.prepare('SELECT DISTINCT industry FROM candidates WHERE industry IS NOT NULL ORDER BY industry').all();
  const companies = db.prepare('SELECT DISTINCT company FROM candidates WHERE company IS NOT NULL ORDER BY company').all();
  const roles = db.prepare('SELECT DISTINCT role_category FROM candidates WHERE role_category IS NOT NULL ORDER BY role_category').all();

  res.json({
    industries: industries.map(r => r.industry),
    companies: companies.map(r => r.company),
    roles: roles.map(r => r.role_category),
  });
});

/**
 * Manual override / import endpoint
 * Accepts URL, raw profile text, or structured fields, then scores & drafts messages
 */
router.post('/manual', async (req, res) => {
  try {
    const { name, title, company, industry, linkedin_url, about, raw_text } = req.body;

    let profileData;
    if (raw_text && !name) {
      profileData = parseProfileText(raw_text, linkedin_url);
    } else {
      profileData = {
        name: name || 'LinkedIn Contact',
        title: title || '',
        company: company || '',
        industry: industry || 'Technology',
        linkedin_url: linkedin_url || null,
        about: about || '',
        raw_data: raw_text || null,
      };
    }

    const result = await browserAgent.ingestCandidate(profileData, 'manual');
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!candidate) return res.status(404).json({ error: { message: 'Candidate not found' } });

  const messages = db.prepare('SELECT * FROM messages WHERE candidate_id = ? ORDER BY created_at DESC').all(req.params.id);

  res.json({ candidate, messages });
});

router.patch('/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  const validStatuses = ['new', 'reviewed', 'approved', 'skipped', 'contacted', 'failed'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } });
  }

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!candidate) return res.status(404).json({ error: { message: 'Candidate not found' } });

  db.prepare("UPDATE candidates SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);

  db.prepare('INSERT INTO activity_log (action, details, candidate_name, candidate_id, status) VALUES (?, ?, ?, ?, ?)')
    .run('status_change', `Status changed to "${status}"`, candidate.name, candidate.id, 'info');

  const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  res.json({ candidate: updated });
});

/**
 * Re-generate messages for candidate with custom objective or prompt
 */
router.post('/:id/generate-messages', async (req, res) => {
  const db = getDb();
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!candidate) return res.status(404).json({ error: { message: 'Candidate not found' } });

  const { objective, instructions } = req.body;

  try {
    const variations = await generateCandidateMessages(candidate, objective, instructions);
    const newMessages = [];

    for (const v of variations) {
      const result = db.prepare(`
        INSERT INTO messages (candidate_id, message_type, message_text, personalization_evidence, status)
        VALUES (?, ?, ?, ?, 'draft')
      `).run(candidate.id, v.message_type || objective || candidate.recommended_objective, v.message_text, v.personalization_evidence);

      newMessages.push(db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid));
    }

    db.prepare('INSERT INTO activity_log (action, details, candidate_name, candidate_id, status) VALUES (?, ?, ?, ?, ?)')
      .run('messages_generated', `Generated ${variations.length} new message variations`, candidate.name, candidate.id, 'success');

    res.json({ messages: newMessages });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

/**
 * Prepare message for LinkedIn staging
 */
router.post('/:id/prepare-linkedin', (req, res) => {
  const { messageId } = req.body;
  try {
    const staging = browserAgent.prepareLinkedInMessage(req.params.id, messageId);
    res.json(staging);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.get('/:id/export', (req, res) => {
  const db = getDb();
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!candidate) return res.status(404).json({ error: { message: 'Candidate not found' } });

  const csvRows = [
    ['Name', 'Title', 'Company', 'Industry', 'Role', 'Score', 'Status', 'Relevance Reason'].join(','),
    [
      `"${candidate.name}"`, `"${candidate.title}"`, `"${candidate.company}"`,
      `"${candidate.industry}"`, `"${candidate.role_category}"`,
      candidate.relevance_score, candidate.status, `"${(candidate.relevance_reason || '').replace(/"/g, '""')}"`,
    ].join(','),
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${candidate.name.replace(/\s/g, '_')}_profile.csv"`);
  res.send(csvRows.join('\n'));
});

router.get('/export/all', (_req, res) => {
  const db = getDb();
  const candidates = db.prepare('SELECT * FROM candidates ORDER BY relevance_score DESC').all();

  const header = ['Name', 'Title', 'Company', 'Industry', 'Role Category', 'Seniority', 'Score', 'Status', 'Relevance Reason', 'LinkedIn URL'].join(',');
  const rows = candidates.map(c =>
    [
      `"${c.name}"`, `"${c.title || ''}"`, `"${c.company || ''}"`,
      `"${c.industry || ''}"`, `"${c.role_category || ''}"`, `"${c.seniority || ''}"`,
      c.relevance_score || '', c.status,
      `"${(c.relevance_reason || '').replace(/"/g, '""')}"`,
      `"${c.linkedin_url || ''}"`,
    ].join(',')
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="linkedin_candidates_export.csv"');
  res.send([header, ...rows].join('\n'));
});

export default router;
