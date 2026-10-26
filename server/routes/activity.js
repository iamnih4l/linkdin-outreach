import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { limit = 50, offset = 0, status, action } = req.query;

  const conditions = [];
  const params = {};

  if (status) {
    conditions.push('status = @status');
    params.status = status;
  }
  if (action) {
    conditions.push('action = @action');
    params.action = action;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) as count FROM activity_log ${where}`).get(params).count;
  const entries = db.prepare(`
    SELECT * FROM activity_log ${where}
    ORDER BY timestamp DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: Number(limit), offset: Number(offset) });

  res.json({ entries, total });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { action, details, candidate_name, candidate_id, status } = req.body;

  if (!action) {
    return res.status(400).json({ error: { message: 'action is required' } });
  }

  const result = db.prepare(`
    INSERT INTO activity_log (action, details, candidate_name, candidate_id, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(action, details || null, candidate_name || null, candidate_id || null, status || 'info');

  const entry = db.prepare('SELECT * FROM activity_log WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ entry });
});

router.delete('/clear', (_req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM activity_log').run();
  res.json({ cleared: true });
});

export default router;
