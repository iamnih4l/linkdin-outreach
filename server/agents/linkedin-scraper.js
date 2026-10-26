/**
 * Client-Side LinkedIn Extractor & Messaging Automation Script
 * Can be executed via Antigravity browser tools or pasted into the browser console
 * while logged into LinkedIn (https://www.linkedin.com/mynetwork/invite-connect/connections/).
 *
 * Safety & Compliance:
 * - Human-like pacing with randomized 3000ms - 7000ms delays
 * - Stops immediately on any verification or rate limit detection
 * - Never auto-sends messages (only drafts into conversation input)
 * - Pushes discovered candidate payloads directly to http://localhost:3000/api/agent/ingest
 */

export const LINKEDIN_CONNECTIONS_URL = 'https://www.linkedin.com/mynetwork/invite-connect/connections/';

export const EXTRACTOR_SCRIPT = `
(async function runLinkedInOutreachCollector() {
  const SERVER_URL = 'http://localhost:3000/api/agent/ingest';
  const MIN_DELAY = 3500;
  const MAX_DELAY = 6500;
  const MAX_ITEMS = 25;

  console.log('%c[LinkedIn Outreach Agent] Initializing connections extractor...', 'color: #00d4aa; font-weight: bold;');

  // Safety check: verify user is on connections page
  if (!window.location.href.includes('/mynetwork/invite-connect/connections')) {
    console.warn('[LinkedIn Outreach Agent] Please navigate to: https://www.linkedin.com/mynetwork/invite-connect/connections/');
    return;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function randomJitter() {
    return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
  }

  function detectCaptchaOrRateLimit() {
    const text = document.body.innerText.toLowerCase();
    if (text.includes('unusual activity') || text.includes('security check') || text.includes('captcha') || text.includes('reached the weekly')) {
      return true;
    }
    return false;
  }

  // Find connection cards in DOM
  const cards = Array.from(document.querySelectorAll('.mn-connection-card, li.mn-connection-card, [data-view-name="profile-card"]'));
  console.log(\`[LinkedIn Outreach Agent] Found \${cards.length} connection cards in DOM.\`);

  let processed = 0;

  for (const card of cards) {
    if (processed >= MAX_ITEMS) break;

    if (detectCaptchaOrRateLimit()) {
      console.error('[LinkedIn Outreach Agent] SECURITY/RATE LIMIT DETECTED. Halting immediately.');
      break;
    }

    const nameEl = card.querySelector('.mn-connection-card__name, [data-anonymize="person-name"], .artdeco-entity-lockup__title');
    const occupationEl = card.querySelector('.mn-connection-card__occupation, .artdeco-entity-lockup__subtitle');
    const linkEl = card.querySelector('a[href*="/in/"]');

    if (!nameEl || !linkEl) continue;

    const name = nameEl.innerText.trim();
    const title = occupationEl ? occupationEl.innerText.trim() : '';
    const linkedin_url = linkEl.href.split('?')[0];

    // Infer company from title
    let company = '';
    const atMatch = title.match(/(?:at|@)\\s+([^·|,]+)/i);
    if (atMatch) {
      company = atMatch[1].trim();
    }

    const payload = {
      profileData: {
        name,
        title,
        company,
        linkedin_url,
        industry: 'Technology'
      },
      source: 'live_session'
    };

    console.log(\`%c[Scraped \${processed + 1}] \${name} — \${title}\`, 'color: #38bdf8;');

    try {
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      console.log(' -> Ingested:', data.candidate?.name, 'Score:', data.candidate?.relevance_score);
      processed++;
    } catch (err) {
      console.error(' -> Ingestion error:', err.message);
    }

    const jitter = randomJitter();
    console.log(\`Waiting \${(jitter / 1000).toFixed(1)}s (human-like pacing)...\`);
    await sleep(jitter);
  }

  console.log(\`%c[LinkedIn Outreach Agent] Finished processing \${processed} connections.\`, 'color: #34d399; font-weight: bold;');
})();
`;

/**
 * Message Stager Script
 * Pastes message into active LinkedIn conversation input without sending
 */
export function getMessageStagingScript(messageText) {
  const safeText = JSON.stringify(messageText);
  return `
(function stageLinkedInDraft() {
  const text = ${safeText};
  const inputEl = document.querySelector('div[role="textbox"][contenteditable="true"], .msg-form__contenteditable');

  if (!inputEl) {
    alert('Please open a messaging conversation with this candidate first!');
    return;
  }

  inputEl.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, text);

  console.log('[LinkedIn Outreach Agent] Draft staged successfully! Please review before clicking Send.');
})();
`;
}
