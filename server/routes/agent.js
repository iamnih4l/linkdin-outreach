import { Router } from 'express';
import { browserAgent } from '../agents/browser-agent.js';
import { chromeBridge } from '../agents/cdp-client.js';
import { EXTRACTOR_SCRIPT, LINKEDIN_CONNECTIONS_URL } from '../agents/linkedin-scraper.js';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/script', (_req, res) => {
  res.json({
    targetUrl: LINKEDIN_CONNECTIONS_URL,
    script: EXTRACTOR_SCRIPT,
  });
});

router.get('/status', (_req, res) => {
  res.json(browserAgent.getStatus());
});

/**
 * Check if user's Chrome browser is reachable and has LinkedIn open
 */
router.get('/chrome-status', async (_req, res) => {
  const isConnected = await chromeBridge.isChromeConnected();
  let tab = null;
  if (isConnected) {
    tab = await chromeBridge.getLinkedInTab();
  }

  res.json({
    chromeRunning: isConnected,
    hasLinkedInTab: Boolean(tab),
    tabTitle: tab?.title || null,
    tabUrl: tab?.url || null,
  });
});

/**
 * Trigger live connection scan directly from user's Chrome LinkedIn tab
 */
router.post('/scan-chrome', async (req, res) => {
  try {
    const { maxCount = 25 } = req.body;
    const result = await chromeBridge.extractConnectionsFromChrome(maxCount);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

/**
 * Stage message into active conversation in user's Chrome tab
 */
router.post('/stage-chrome', async (req, res) => {
  try {
    const { messageText } = req.body;
    if (!messageText) return res.status(400).json({ error: { message: 'messageText is required' } });

    const result = await chromeBridge.stageMessageInChrome(messageText);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

router.post('/start', async (_req, res) => {
  try {
    const result = await browserAgent.startScan();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.post('/pause', (_req, res) => {
  try {
    const result = browserAgent.pauseScan();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.post('/stop', (req, res) => {
  const isEmergency = Boolean(req.body?.emergency);
  const result = browserAgent.stopScan(isEmergency);
  res.json(result);
});

router.post('/ingest', async (req, res) => {
  try {
    const { profileData, source = 'manual' } = req.body;
    if (!profileData || !profileData.name) {
      return res.status(400).json({ error: { message: 'Candidate profile data with name is required.' } });
    }

    const result = await browserAgent.ingestCandidate(profileData, source);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

router.post('/reset', (_req, res) => {
  browserAgent.stopScan(false);
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('scan_status', 'idle')").run();
  db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('total_scanned', '0')").run();
  res.json({ status: 'reset', message: 'Agent state reset.' });
});

export default router;
