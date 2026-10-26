import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/candidate/:candidateId', (req, res) => {
  const db = getDb();
  const messages = db.prepare('SELECT * FROM messages WHERE candidate_id = ? ORDER BY created_at DESC')
    .all(req.params.candidateId);
  res.json({ messages });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { candidate_id, message_type, message_text, personalization_evidence } = req.body;

  if (!candidate_id || !message_text) {
    return res.status(400).json({ error: { message: 'candidate_id and message_text are required' } });
  }

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidate_id);
  if (!candidate) return res.status(404).json({ error: { message: 'Candidate not found' } });

  const result = db.prepare(`
    INSERT INTO messages (candidate_id, message_type, message_text, personalization_evidence, status)
    VALUES (?, ?, ?, ?, 'draft')
  `).run(candidate_id, message_type || 'networking', message_text, personalization_evidence || null);

  db.prepare('INSERT INTO activity_log (action, details, candidate_name, candidate_id, status) VALUES (?, ?, ?, ?, ?)')
    .run('message_created', `New ${message_type || 'networking'} message drafted`, candidate.name, candidate.id, 'success');

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message });
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { message_text, status } = req.body;
  const existing = db.prepare('SELECT m.*, c.name as candidate_name FROM messages m JOIN candidates c ON c.id = m.candidate_id WHERE m.id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: { message: 'Message not found' } });

  if (message_text !== undefined) {
    db.prepare('UPDATE messages SET message_text = ? WHERE id = ?').run(message_text, req.params.id);
  }

  if (status) {
    const validStatuses = ['draft', 'approved', 'sent', 'failed', 'skipped'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } });
    }
    db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, req.params.id);

    if (status === 'approved') {
      db.prepare('INSERT INTO activity_log (action, details, candidate_name, candidate_id, status) VALUES (?, ?, ?, ?, ?)')
        .run('message_approved', 'Message approved for sending', existing.candidate_name, existing.candidate_id, 'success');
    } else if (status === 'sent') {
      db.prepare("UPDATE messages SET sent_at = datetime('now') WHERE id = ?").run(req.params.id);
      db.prepare("UPDATE candidates SET status = 'contacted', updated_at = datetime('now') WHERE id = ?").run(existing.candidate_id);
      db.prepare('INSERT INTO activity_log (action, details, candidate_name, candidate_id, status) VALUES (?, ?, ?, ?, ?)')
        .run('message_sent', 'Message marked as sent', existing.candidate_name, existing.candidate_id, 'success');
    }
  }

  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  res.json({ message: updated });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: { message: 'Message not found' } });

  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

export default router;
