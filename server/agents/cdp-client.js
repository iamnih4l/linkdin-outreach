/**
 * Chrome DevTools Protocol (CDP) Bridge
 * Connects directly to the user's running Chrome session on port 9222.
 * Interacts with the authenticated LinkedIn tab to:
 * 1. Find the active LinkedIn Connections tab
 * 2. Extract 1st-degree connection cards (Name, Headline, Company, LinkedIn URL)
 * 3. Ingest, score, and draft personalized messages for each person
 * 4. Stage messages directly into LinkedIn chat when requested
 */

import { browserAgent } from './browser-agent.js';
import { getDb } from '../db/index.js';

const CHROME_DEBUG_PORT = 9222;

export class ChromeLinkedInBridge {
  constructor(port = CHROME_DEBUG_PORT) {
    this.port = port;
  }

  /**
   * Check if Chrome is running with remote debugging on port 9222
   */
  async isChromeConnected() {
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/json/version`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.Browser);
    } catch {
      return false;
    }
  }

  /**
   * Find the open LinkedIn tab in Chrome
   */
  async getLinkedInTab() {
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/json`, { signal: AbortSignal.timeout(3000) });
      const tabs = await res.json();
      return tabs.find(t => t.url && t.url.includes('linkedin.com') && t.type === 'page');
    } catch (err) {
      console.warn('[cdp-bridge] Error finding LinkedIn tab:', err.message);
      return null;
    }
  }

  /**
   * Execute arbitrary JavaScript in a Chrome tab via CDP WebSocket
   */
  async evaluateInTab(webSocketDebuggerUrl, expression) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(webSocketDebuggerUrl);
      const reqId = Math.floor(Math.random() * 100000);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('CDP evaluation timed out after 15s'));
      }, 15000);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: reqId,
          method: 'Runtime.evaluate',
          params: {
            expression,
            returnByValue: true,
            awaitPromise: true,
          },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id === reqId) {
            clearTimeout(timeout);
            ws.close();
            if (msg.error) {
              reject(new Error(msg.error.message || 'CDP Error'));
            } else if (msg.result?.exceptionDetails) {
              reject(new Error(msg.result.exceptionDetails.text || 'Script Exception'));
            } else {
              resolve(msg.result?.result?.value);
            }
          }
        } catch (err) {
          clearTimeout(timeout);
          ws.close();
          reject(err);
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${err.message || 'connection failed'}`));
      };
    });
  }

  /**
   * Discover and extract visible connections from the LinkedIn tab
   */
  async extractConnectionsFromChrome(maxCount = 25, scrollTimes = 2) {
    const tab = await this.getLinkedInTab();
    if (!tab) {
      throw new Error('No open LinkedIn tab found in Chrome. Please make sure LinkedIn is open in your Chrome browser.');
    }

    console.log(`[cdp-bridge] Connected to LinkedIn tab: "${tab.title}" (${tab.url})`);

    // Ensure we are on the connections page
    if (!tab.url.includes('/connections')) {
      console.log('[cdp-bridge] Navigating tab to Connections page...');
      await this.evaluateInTab(tab.webSocketDebuggerUrl, `window.location.href = "https://www.linkedin.com/mynetwork/invite-connect/connections/";`);
      await new Promise(r => setTimeout(r, 4000));
    }

    // Scroll down in main container if requested to trigger infinite scroll for more connections
    for (let s = 0; s < scrollTimes; s++) {
      await this.evaluateInTab(tab.webSocketDebuggerUrl, `
        (() => {
          const main = document.querySelector('main') || document.documentElement;
          main.scrollTop = main.scrollHeight;
          window.scrollTo(0, document.body.scrollHeight);
          return { scrollHeight: main.scrollHeight, scrollTop: main.scrollTop };
        })()
      `);
      await new Promise(r => setTimeout(r, 2200));
    }

    // Extraction expression matching LinkedIn's current DOM
    const extractionCode = `
      (() => {
        const links = Array.from(document.querySelectorAll('a[href*="/in/"]'));
        const seen = new Set();
        const connections = [];

        for (const a of links) {
          const url = a.href.split('?')[0];
          if (!url.includes('/in/') || seen.has(url)) continue;

          const text = (a.innerText || '').trim();
          if (!text || text.length < 3) continue;

          // Split lines into Name and Headline
          const parts = text.split('\\n').map(p => p.trim()).filter(Boolean);
          if (parts.length === 0) continue;

          const name = parts[0];
          // Skip if name is generic
          if (name.toLowerCase().includes('linkedin') || name.toLowerCase().includes('premium')) continue;

          const title = parts.slice(1).join(' · ');

          // Infer company from headline like "at Google", "@ReyfarmerX", "at Minds NXT"
          let company = '';
          const atMatch = title.match(/(?:at|@|\\bat\\b)\\s*([^·|,\\n\\|]+)/i);
          if (atMatch) {
            company = atMatch[1].trim();
          }

          seen.add(url);
          connections.push({
            name,
            title: title || 'Professional',
            company: company || 'Tech Industry',
            linkedin_url: url,
            industry: 'Technology',
            raw_data: text
          });
        }

        return {
          totalLinks: links.length,
          extracted: connections
        };
      })()
    `;

    const data = await this.evaluateInTab(tab.webSocketDebuggerUrl, extractionCode);
    const discovered = data?.extracted || [];
    console.log(`[cdp-bridge] Extracted ${discovered.length} connections from LinkedIn tab.`);

    // Ingest into agent database with scoring and message drafting
    const ingested = [];
    for (const item of discovered.slice(0, maxCount)) {
      try {
        const result = await browserAgent.ingestCandidate(item, 'chrome_live');
        ingested.push(result);
      } catch (err) {
        console.warn(`[cdp-bridge] Ingestion skipped for ${item.name}:`, err.message);
      }
    }

    // Update state to live
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('data_source', 'live')").run();

    return {
      tabTitle: tab.title,
      totalFound: discovered.length,
      ingestedCount: ingested.length,
      candidates: ingested.map(i => i.candidate),
    };
  }

  /**
   * Scroll down the LinkedIn connections page in Chrome to load more
   */
  async scrollConnectionsPage() {
    const tab = await this.getLinkedInTab();
    if (!tab) throw new Error('No LinkedIn tab found');

    const scrollCode = `
      (() => {
        window.scrollBy({ top: 1200, behavior: 'smooth' });
        return { scrollY: window.scrollY, height: document.body.scrollHeight };
      })()
    `;

    return await this.evaluateInTab(tab.webSocketDebuggerUrl, scrollCode);
  }

  /**
   * Stage message into active conversation in Chrome
   */
  async stageMessageInChrome(messageText) {
    const tab = await this.getLinkedInTab();
    if (!tab) throw new Error('No LinkedIn tab found in Chrome');

    const stageCode = `
      (() => {
        const inputEl = document.querySelector('div[role="textbox"][contenteditable="true"], .msg-form__contenteditable');
        if (!inputEl) {
          return { success: false, reason: 'No active message input box found. Please click Message on the candidate profile first.' };
        }

        inputEl.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, ${JSON.stringify(messageText)});

        return { success: true, reason: 'Message staged into conversation draft box successfully.' };
      })()
    `;

    return await this.evaluateInTab(tab.webSocketDebuggerUrl, stageCode);
  }
}

export const chromeBridge = new ChromeLinkedInBridge();
