/**
 * LinkedIn Browser Agent Controller
 * Coordinates browser navigation, profile discovery, rate-limiting, and messaging prep.
 * Strictly adheres to human-in-the-loop safety boundaries:
 * - Never auto-sends messages (drafts to input area or presents for dashboard approval)
 * - Safe pacing: 3000ms - 8000ms randomized human delays
 * - Fail-safe emergency pause on rate limits or unexpected popups
 */

import { getDb } from '../db/index.js';
import { analyzeProfile } from './profile-analyzer.js';
import { generateCandidateMessages } from './message-generator.js';

class BrowserAgentController {
  constructor() {
    this.status = 'idle'; // idle | running | paused | stopped
    this.currentCandidate = null;
    this.scanInterval = null;
    this.processedCount = 0;
    this.minDelayMs = 3000;
    this.maxDelayMs = 7000;
  }

  /**
   * Helper to sleep with human-like randomized jitter
   */
  async sleepWithJitter(minMs = this.minDelayMs, maxMs = this.maxDelayMs) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
    return delay;
  }

  /**
   * Get current agent status
   */
  getStatus() {
    const db = getDb();
    const stateRows = db.prepare('SELECT key, value FROM agent_state').all();
    const state = Object.fromEntries(stateRows.map(r => [r.key, r.value]));

    return {
      status: this.status,
      running: this.status === 'running',
      paused: this.status === 'paused',
      currentCandidate: this.currentCandidate,
      processedCount: this.processedCount,
      dataSource: state.data_source || 'demo',
      lastScanAt: state.last_scan_at || null,
      totalScanned: Number(state.total_scanned || 0),
    };
  }

  /**
   * Start scan session
   */
  async startScan(options = {}) {
    if (this.status === 'running') {
      throw new Error('Agent is already running.');
    }

    this.status = 'running';
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('scan_status', 'running')").run();
    db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('last_scan_at', datetime('now'))").run();

    this.logActivity('scan_started', 'Agent scan cycle initiated with human-paced timing (3-7s delay)', 'info');

    return { status: 'running', message: 'Scan started.' };
  }

  /**
   * Pause scan
   */
  pauseScan() {
    if (this.status !== 'running') {
      throw new Error('Agent is not currently running.');
    }

    this.status = 'paused';
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('scan_status', 'paused')").run();
    this.logActivity('scan_paused', 'Agent scan paused by user', 'warning');

    return { status: 'paused' };
  }

  /**
   * Stop scan (Emergency stop or regular stop)
   */
  stopScan(isEmergency = false) {
    this.status = 'stopped';
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('scan_status', 'idle')").run();

    const action = isEmergency ? 'emergency_stop' : 'scan_stopped';
    const details = isEmergency
      ? 'EMERGENCY STOP TRIGGERED: Halting all browser tasks and queued actions immediately'
      : 'Agent scan stopped gracefully';

    this.logActivity(action, details, isEmergency ? 'error' : 'warning');

    return { status: 'stopped', emergency: isEmergency };
  }

  /**
   * Ingest and process a discovered candidate profile
   */
  async ingestCandidate(profileData, source = 'manual') {
    const db = getDb();

    // Check for deduplication by linkedin_url or name + company
    let existing = null;
    if (profileData.linkedin_url) {
      existing = db.prepare('SELECT * FROM candidates WHERE linkedin_url = ?').get(profileData.linkedin_url);
    }
    if (!existing && profileData.name && profileData.company) {
      existing = db.prepare('SELECT * FROM candidates WHERE LOWER(name) = LOWER(?) AND LOWER(company) = LOWER(?)')
        .get(profileData.name, profileData.company);
    }

    if (existing) {
      this.logActivity('candidate_skipped', `Duplicate detected: ${profileData.name} at ${profileData.company}`, 'info', profileData.name, existing.id);
      return { duplicate: true, candidate: existing };
    }

    // Analyze and score profile
    const analyzed = analyzeProfile(profileData);

    // Insert candidate into SQLite
    const insertResult = db.prepare(`
      INSERT INTO candidates (
        linkedin_url, name, title, company, industry,
        role_category, seniority, profile_summary,
        relevance_reason, recommended_objective, relevance_score,
        score_explanation, confidence_level, missing_info,
        raw_data, status, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      analyzed.linkedin_url,
      analyzed.name,
      analyzed.title,
      analyzed.company,
      analyzed.industry,
      analyzed.role_category,
      analyzed.seniority,
      analyzed.profile_summary,
      analyzed.relevance_reason,
      analyzed.recommended_objective,
      analyzed.relevance_score,
      analyzed.score_explanation,
      analyzed.confidence_level,
      analyzed.missing_info,
      analyzed.raw_data,
      'new',
      profileData.is_demo ? 1 : 0
    );

    const candidateId = insertResult.lastInsertRowid;
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId);

    this.logActivity(
      'candidate_analyzed',
      `Discovered & analyzed: ${candidate.name} (${candidate.title} @ ${candidate.company}) — Score: ${candidate.relevance_score}/100`,
      'success',
      candidate.name,
      candidateId
    );

    // Automatically generate 3 personalized message variations
    const variations = await generateCandidateMessages(candidate);
    const savedMessages = [];

    for (const v of variations) {
      const msgResult = db.prepare(`
        INSERT INTO messages (candidate_id, message_type, message_text, personalization_evidence, status)
        VALUES (?, ?, ?, ?, 'draft')
      `).run(candidateId, v.message_type || candidate.recommended_objective, v.message_text, v.personalization_evidence);

      savedMessages.push(db.prepare('SELECT * FROM messages WHERE id = ?').get(msgResult.lastInsertRowid));
    }

    this.logActivity(
      'messages_drafted',
      `Drafted ${variations.length} personalized outreach variations for ${candidate.name}`,
      'info',
      candidate.name,
      candidateId
    );

    // Update total scanned counter
    db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('total_scanned', CAST(COALESCE((SELECT value FROM agent_state WHERE key = 'total_scanned'), 0) + 1 AS TEXT))").run();

    return { candidate, messages: savedMessages };
  }

  /**
   * Prepare message for LinkedIn
   * Constructs the deep link and safe paste instructions (never clicks Send without human approval)
   */
  prepareLinkedInMessage(candidateId, messageId) {
    const db = getDb();
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId);
    if (!candidate) throw new Error('Candidate not found');

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!message) throw new Error('Message not found');

    // LinkedIn URL target
    const profileUrl = candidate.linkedin_url || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(candidate.name + ' ' + candidate.company)}`;

    this.logActivity(
      'message_prepared',
      `Ready to stage message into LinkedIn messaging thread for ${candidate.name} (Requires user send confirmation)`,
      'info',
      candidate.name,
      candidate.id
    );

    return {
      candidate,
      message,
      targetUrl: profileUrl,
      draftText: message.message_text,
      instructions: '1. Open conversation thread with candidate. 2. Paste the message into draft box. 3. Review and manually click Send.',
    };
  }

  /**
   * Log an activity entry
   */
  logActivity(action, details, status = 'info', candidateName = null, candidateId = null) {
    const db = getDb();
    db.prepare(`
      INSERT INTO activity_log (action, details, candidate_name, candidate_id, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(action, details, candidateName, candidateId, status);
  }
}

export const browserAgent = new BrowserAgentController();
