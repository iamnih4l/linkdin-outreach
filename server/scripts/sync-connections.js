/**
 * Core Connection Discovery, Scoring & Message Sync Engine
 * Connects to user's authenticated Chrome session via CDP (port 9222),
 * discovers 1st-degree connections, categorizes them, scores relevance,
 * drafts personalized messages using user persona, and persists to SQLite & CSV.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { chromeBridge } from '../agents/cdp-client.js';
import { getDb } from '../db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read Persona from environment
const SENDER = {
  name: process.env.USER_NAME || 'Nihal',
  role: process.env.USER_ROLE || 'AI Engineering Student & Startup Co-Founder',
  background: process.env.USER_BACKGROUND || 'Hands-on builder focusing on AI agents, LLM pipelines, autonomous systems, and modern full-stack development.',
};

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function extractFirstName(fullName = '') {
  const parts = fullName.trim().split(/\s+/);
  let first = parts[0] || 'there';
  if (/^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?)$/i.test(first) && parts.length > 1) {
    first = parts[1];
  }
  return first;
}

function refineCompany(title = '', rawCompany = '') {
  let text = title || '';
  let comp = rawCompany || '';

  const patterns = [
    /(?:founder & ceo|co-founder & ceo|ceo & co-founder|co-founder|founder|ceo)\s*(?:of|at|@|,)\s*([A-Za-z0-9&.\- '®]+?)(?=\s*(?:and\b|[·|,\|\n\(\[📌]|—|-|\/|$))/i,
    /(?:talent|recruiter|recruiting|specialist|partner|manager|director|engineer|scientist|lead|head of [a-z]+)\s*(?:at|@)\s*([A-Za-z0-9&.\- '®]+?)(?=\s*[·|,\|\n\(\[📌]|—|\/|$)/i,
    /(?:at|@|\bat\b)\s+([A-Za-z0-9&.\- '®]+?)(?=\s*[·|,\|\n\(\[📌]|—|\/|$)/i
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1].trim().length > 1) {
      comp = m[1].trim();
      break;
    }
  }

  // Clean trailing noise and filler words
  comp = comp.replace(/\s*\(.*?\)/g, '')
             .replace(/[📌®©]/g, '')
             .replace(/\s*(?:we are hiring|we're hiring|hiring)\s*!?/gi, '')
             .trim();

  // Known cleanups
  if (/pinterest/i.test(text)) comp = 'Pinterest';
  if (/lego/i.test(text)) comp = 'The LEGO Group';
  if (/cadillac.*formula/i.test(text)) comp = 'Cadillac Formula 1 Team';
  if (/flowmingo/i.test(text)) comp = 'Flowmingo AI';
  if (/pinscreen/i.test(text)) comp = 'Pinscreen';
  if (/vajra digital/i.test(text)) comp = 'Vajra Digital';
  if (/brainwave innovators/i.test(text)) comp = 'Brainwave Innovators';
  if (/automatee/i.test(text)) comp = 'Automatee';
  if (/skybrain/i.test(text)) comp = 'SkyBrain Neurotech';
  if (/zero trace/i.test(text)) comp = 'Zero Trace';
  if (/nutonium/i.test(text)) comp = 'nutonium.in';
  if (/public sector network/i.test(text)) comp = 'Public Sector Network';
  if (/interpol|world bank|united nations/i.test(text)) comp = 'Global Organizations';

  // Blacklist false positives
  if (/^(tech industry|unknown|n\/a|uae focused|sport|recruiter|professor|speaker|full-time|present|freelance|consultant|student ambassador|research trainer|2× hackathon winner)$/i.test(comp)) {
    comp = '';
  }

  return comp;
}

function categorize(title = '', company = '') {
  const text = `${title} ${company}`.toLowerCase();

  if (/\b(cto|chief technology officer|chief technical officer|chief architect)\b/.test(text)) {
    return {
      category: 'CTO / Technical Visionary',
      tier: 'Tier 1 (Technical Leadership)',
      priorityWeight: 38,
      objective: 'technical_collaboration'
    };
  }

  if (/\b(co-founder|cofounder|founder|ceo|chief executive officer|managing director|managing partner|co-ceo)\b/.test(text)) {
    return {
      category: 'Founder / CEO',
      tier: 'Tier 1 (Executive & Founder)',
      priorityWeight: 36,
      objective: 'founder_networking'
    };
  }

  if (/\b(cfo|chief financial officer|coo|chief operating officer|chief revenue officer|cro)\b/.test(text)) {
    return {
      category: 'CFO / COO / Executive',
      tier: 'Tier 1 (Executive Leadership)',
      priorityWeight: 34,
      objective: 'executive_networking'
    };
  }

  if (/\b(recruiter|talent acquisition|technical recruiter|university recruiter|campus recruiter|sourcer|headhunter|head of people|talent partner|people operations|hr manager|hr lead)\b/.test(text) && !/soccer|video analysis/i.test(text)) {
    return {
      category: 'Recruiter / Talent Acquisition',
      tier: 'Tier 1 (Hiring Gateway)',
      priorityWeight: 35,
      objective: 'internship'
    };
  }

  if (/\b(ai lead|ml lead|head of ai|director of ai|ai architect|research scientist|machine learning engineer|ml engineer|ai engineer|ai developer|genai|llm|agentic ai|deep learning|nlp engineer|computer vision engineer|ai scientist)\b/.test(text)) {
    return {
      category: 'AI / ML Leader & Engineer',
      tier: 'Tier 1 (AI Domain Peer)',
      priorityWeight: 32,
      objective: 'technical_collaboration'
    };
  }

  if (/\b(engineering manager|vp of engineering|director of engineering|head of engineering|tech lead manager|software engineering manager|lead engineer|tech lead)\b/.test(text)) {
    return {
      category: 'Engineering Leader / Manager',
      tier: 'Tier 2 (Engineering Leadership)',
      priorityWeight: 28,
      objective: 'internship'
    };
  }

  if (/\b(product manager|vp product|head of product|director of product|group product manager|principal product)\b/.test(text)) {
    return {
      category: 'Product Leader',
      tier: 'Tier 2 (Product Leadership)',
      priorityWeight: 22,
      objective: 'founder_networking'
    };
  }

  if (/\b(principal engineer|staff engineer|senior software engineer|senior engineer|solutions architect|senior developer)\b/.test(text)) {
    return {
      category: 'Senior / Principal Engineer',
      tier: 'Tier 2 (Senior Builder)',
      priorityWeight: 24,
      objective: 'technical_collaboration'
    };
  }

  if (/\b(software engineer|software developer|developer|frontend|backend|full stack|web developer|data engineer|analyst)\b/.test(text)) {
    return {
      category: 'Software Engineer / Builder',
      tier: 'Tier 3 (Tech Peer)',
      priorityWeight: 15,
      objective: 'peer_connection'
    };
  }

  return {
    category: 'Industry Professional',
    tier: 'Tier 3 (General Professional)',
    priorityWeight: 10,
    objective: 'peer_connection'
  };
}

function scoreAndExplain(person, catInfo) {
  let score = 50 + catInfo.priorityWeight;
  const reasons = [];

  reasons.push(catInfo.category);

  const text = `${person.title} ${person.company}`.toLowerCase();

  if (/\b(ai|artificial intelligence|machine learning|deep learning|llm|agentic|genai)\b/.test(text)) {
    score += 15;
    reasons.push('AI/ML domain focus');
  }

  if (/\b(startup|stealth|series a|series b|seed|yc|y combinator|founder)\b/.test(text)) {
    score += 10;
    reasons.push('Startup ecosystem presence');
  }

  if (/\b(google|microsoft|amazon|meta|apple|netflix|openai|anthropic|databricks|deepmind|nvidia|pinterest|lego)\b/.test(text)) {
    score += 10;
    reasons.push('Top-tier recognized organization');
  }

  if (/\b(hiring|we're hiring|we are hiring|join our team|looking for)\b/.test(text)) {
    score += 10;
    reasons.push('Active hiring indicators');
  }

  score = Math.min(100, Math.max(20, score));

  let relevanceReason = '';
  const comp = person.company || 'their organization';
  if (catInfo.category.includes('Founder') || catInfo.category.includes('CEO')) {
    relevanceReason = `Founder/CEO at ${comp}. Top-tier connection for startup building insights, strategic partnerships, and executive vision.`;
  } else if (catInfo.category.includes('CTO')) {
    relevanceReason = `CTO/Technical Leader at ${comp}. Key decision-maker for engineering architecture, AI tech stacks, and technical hiring.`;
  } else if (catInfo.category.includes('CFO') || catInfo.category.includes('COO')) {
    relevanceReason = `Executive Leader (CFO/COO) at ${comp}. High-level strategic decision-maker across operations, growth, and team scale.`;
  } else if (catInfo.category.includes('Recruiter')) {
    relevanceReason = `Talent & Recruiting lead at ${comp}. Direct gateway for software/AI engineering internships and entry-level technical roles.`;
  } else if (catInfo.category.includes('AI / ML')) {
    relevanceReason = `AI/ML expert at ${comp}. Ideal technical peer for AI agent architectures, model workflows, and engineering collaboration.`;
  } else if (catInfo.category.includes('Engineering Leader')) {
    relevanceReason = `Engineering leader at ${comp} overseeing development teams and technical hiring decisions.`;
  } else {
    relevanceReason = `Technology professional at ${comp} in software and technology.`;
  }

  return {
    score,
    relevanceReason,
    explanation: reasons.join('; ')
  };
}

function craftMessages(person, catInfo) {
  const firstName = extractFirstName(person.name);
  const company = person.company && person.company.trim().length > 1 ? person.company.trim() : 'your team';
  const roleCat = catInfo.category;

  let concise = '';
  let valueFirst = '';
  let conversational = '';

  if (roleCat.includes('Founder') || roleCat.includes('CEO')) {
    concise = `Hi ${firstName}, hope you're having a great week! As a fellow startup co-founder and ${SENDER.role.toLowerCase()} building LLM agents, I've been following your journey with ${company}. Would love to connect and follow your milestones as you scale. Cheering on ${company}!`;
    valueFirst = `Hi ${firstName}, congratulations on the momentum with ${company}! As an AI engineer and startup co-founder, I've been deep in the weeds building autonomous agent workflows and LLM pipelines. If you ever have 10 minutes, I'd love to exchange notes on early-stage building, tech stacks, and navigating AI product development.`;
    conversational = `Hey ${firstName}, great to connect with fellow founders in the ecosystem. Your work leading ${company} is genuinely inspiring as I balance my studies with co-founding an early-stage startup. Would love to stay in touch and exchange notes whenever you have a breather!`;
  } else if (roleCat.includes('CTO')) {
    concise = `Hi ${firstName}, I've been studying the technical architecture behind ${company}'s systems and really respect your leadership there. As an engineering builder working deeply on autonomous agent pipelines, I'd love to connect and learn from your engineering journey.`;
    valueFirst = `Hi ${firstName}, impressive work steering engineering at ${company}. I'm currently researching and building agentic LLM systems with human-in-the-loop verification to eliminate production hallucinations. Given your experience, I'd love to share our technical takeaways or compare perspectives on reliable AI architectures if you have a moment.`;
    conversational = `Hey ${firstName}, hope you're having an awesome week. I came across your engineering leadership at ${company} and wanted to reach out. Always eager to learn from seasoned CTOs and technical visionaries as I build AI systems. Looking forward to staying connected!`;
  } else if (roleCat.includes('CFO') || roleCat.includes('COO')) {
    concise = `Hi ${firstName}, hope you're having a productive week. I've been following ${company}'s growth and wanted to connect directly. As an engineer and startup co-founder, I'm keenly interested in how high-growth tech companies optimize operations and strategic scale.`;
    valueFirst = `Hi ${firstName}, really admire the operational execution at ${company}. As a startup builder developing AI automation systems, I focus on how workflow intelligence drives tangible business efficiency. Would love to stay connected and follow ${company}'s continued milestones!`;
    conversational = `Hey ${firstName}, wanted to reach out and connect! As a student and early-stage co-founder, I have immense respect for executives leading scale and operations at companies like ${company}. Wishing you and the entire team great continued success.`;
  } else if (roleCat.includes('Recruiter')) {
    concise = `Hi ${firstName}, hope you're having a great week! I've been following ${company}'s work and wanted to reach out directly. I'm an ${SENDER.role.toLowerCase()} actively building LLM agents and autonomous systems. I'm looking for AI engineering internship opportunities where I can ship high-impact code. Would you be open to a brief chat or pointing me toward the right hiring contact on your team?`;
    valueFirst = `Hi ${firstName}, I really admire what ${company} is building. As an engineering student who also co-founded an early-stage venture, I specialize in productionizing LLM pipelines and autonomous browser workflows. Seeing ${company}'s growth, I'd love to contribute my hands-on shipping experience to your engineering team as an intern. Happy to share live demos of what I've deployed!`;
    conversational = `Hey ${firstName}, hope all is well! I noticed your work leading talent at ${company} and wanted to introduce myself. I'm currently studying AI engineering while building startup products from the ground up. I love working at the intersection of AI research and fast product shipping, and ${company} is high on my radar for engineering internships. Would love to connect and keep in touch as new roles open up!`;
  } else if (roleCat.includes('AI / ML')) {
    concise = `Hi ${firstName}, loved seeing your work in AI/ML at ${company}. As an engineering builder working on LLM agents and multi-step orchestration, I'd love to connect with fellow builders in the field and follow what you're working on!`;
    valueFirst = `Hi ${firstName}, really impressed by your technical work in AI/ML at ${company}. I'm currently developing autonomous agent workflows with human-in-the-loop validation to ensure reliable production tool-calling. Would love to exchange insights on modern AI infrastructure and challenges you've encountered in production.`;
    conversational = `Hey ${firstName}, always exciting to connect with fellow AI engineers and researchers. I'm studying AI engineering while building autonomous systems and love swapping notes on emerging model architectures. Hope you're having a great week, and look forward to following your work!`;
  } else if (roleCat.includes('Engineering Leader')) {
    concise = `Hi ${firstName}, hope your week is off to a great start. I've been following the engineering team's progress at ${company} and wanted to reach out. As an engineering student and active builder, I'd love to connect and stay in touch regarding engineering opportunities on your team!`;
    valueFirst = `Hi ${firstName}, really respect how you lead engineering at ${company}. As an engineering student who has shipped full-stack autonomous systems and early-stage products, I'm eager to bring hands-on builder energy to a high-performing engineering team as an intern. Would welcome the opportunity to chat if you're ever looking for hungry engineers.`;
    conversational = `Hey ${firstName}, came across your profile and wanted to connect! I'm an AI engineering student passionate about scalable architectures and high-velocity shipping. Great to connect with seasoned engineering leaders like yourself!`;
  } else {
    concise = `Hi ${firstName}, I came across your work at ${company} and wanted to reach out. I'm an AI engineering student and startup builder. Would love to connect and follow each other's journey!`;
    valueFirst = `Hi ${firstName}, great to connect with fellow builders. I've been building applications in generative AI and workflow automation, and really appreciate what you're doing at ${company}. Wishing you and your team continued success!`;
    conversational = `Hey ${firstName}, noticed we share an interest in tech and innovation. As an AI student and startup builder, I always enjoy connecting with folks doing great work. Hope you have a wonderful week ahead!`;
  }

  return { concise, valueFirst, conversational };
}

function parsePerson(rawText, url) {
  const parts = rawText.split('\n').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let name = parts[0] || '';
  if (!name || name.toLowerCase().includes('linkedin') || name.toLowerCase().includes('premium')) {
    return null;
  }
  name = name.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();

  const titleLines = parts.slice(1);
  const fullTitle = titleLines.join(' · ');

  return {
    name,
    title: fullTitle || 'Professional',
    linkedin_url: url
  };
}

/**
 * Execute full sync workflow
 */
export async function syncAllConnections(maxScrollCycles = 45) {
  console.log('\n======================================================');
  console.log('⚡ LinkedIn Outreach Agent — Live Connection Sync');
  console.log('======================================================\n');

  const isConnected = await chromeBridge.isChromeConnected();
  if (!isConnected) {
    throw new Error('Chrome remote debugging is not available on port 9222. Please start Chrome with --remote-debugging-port=9222');
  }

  const tab = await chromeBridge.getLinkedInTab();
  if (!tab) {
    throw new Error('No open LinkedIn tab found in Chrome. Please make sure LinkedIn is open in your Chrome browser.');
  }

  console.log(`[Sync] Connected to Chrome tab: "${tab.title}" (${tab.url})`);

  if (!tab.url.includes('/connections')) {
    console.log('[Sync] Navigating tab to LinkedIn Connections page...');
    await chromeBridge.evaluateInTab(tab.webSocketDebuggerUrl, `window.location.href = "https://www.linkedin.com/mynetwork/invite-connect/connections/";`);
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log(`[Sync] Scrolling to discover connections (up to ${maxScrollCycles} cycles)...`);
  let previousCount = 0;
  let stagnantCycles = 0;

  for (let cycle = 1; cycle <= maxScrollCycles; cycle++) {
    await chromeBridge.evaluateInTab(tab.webSocketDebuggerUrl, `
      (() => {
        const main = document.querySelector('main') || document.documentElement;
        main.scrollTop = main.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
      })()
    `);

    await new Promise(r => setTimeout(r, 1600));

    const checkInfo = await chromeBridge.evaluateInTab(tab.webSocketDebuggerUrl, `
      (() => {
        const links = Array.from(document.querySelectorAll('a[href*="/in/"]'));
        const urls = new Set(links.map(a => a.href.split('?')[0]).filter(u => u.includes('/in/')));
        return urls.size;
      })()
    `);

    console.log(`[Sync] [Cycle ${cycle}/${maxScrollCycles}] Discovered ${checkInfo} unique profile links`);

    if (checkInfo === previousCount) {
      stagnantCycles++;
      await chromeBridge.evaluateInTab(tab.webSocketDebuggerUrl, `
        (() => {
          const main = document.querySelector('main') || document.documentElement;
          main.scrollTop = main.scrollTop - 400;
          setTimeout(() => { main.scrollTop = main.scrollHeight; }, 300);
        })()
      `);
      await new Promise(r => setTimeout(r, 1500));
      if (stagnantCycles >= 4) {
        console.log(`[Sync] Reached the end of available feed.`);
        break;
      }
    } else {
      stagnantCycles = 0;
      previousCount = checkInfo;
    }
  }

  console.log('[Sync] Reading connection details from DOM...');
  const rawCards = await chromeBridge.evaluateInTab(tab.webSocketDebuggerUrl, `
    (() => {
      const links = Array.from(document.querySelectorAll('a[href*="/in/"]'));
      const seen = new Set();
      const results = [];

      for (const a of links) {
        const url = a.href.split('?')[0];
        if (!url.includes('/in/') || seen.has(url)) continue;
        const text = (a.innerText || '').trim();
        if (!text || text.length < 3) continue;

        seen.add(url);
        results.push({ url, text });
      }
      return results;
    })()
  `);

  console.log(`[Sync] Found ${rawCards.length} connection elements.`);

  const db = getDb();
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

  const processed = [];
  const seenUrls = new Set();

  for (const item of rawCards) {
    const person = parsePerson(item.text, item.url);
    if (!person || seenUrls.has(person.linkedin_url)) continue;
    seenUrls.add(person.linkedin_url);

    person.company = refineCompany(person.title, '');
    const catInfo = categorize(person.title, person.company);
    const scoreInfo = scoreAndExplain(person, catInfo);
    const messages = craftMessages(person, catInfo);

    let roleCat = 'other';
    if (catInfo.category.includes('Recruiter')) roleCat = 'recruiter';
    else if (catInfo.category.includes('Founder') || catInfo.category.includes('CEO')) roleCat = 'founder';
    else if (catInfo.category.includes('CTO')) roleCat = 'cto';
    else if (catInfo.category.includes('AI / ML')) roleCat = 'ai_ml_lead';
    else if (catInfo.category.includes('Product')) roleCat = 'product_manager';
    else if (catInfo.category.includes('Engineering Leader')) roleCat = 'engineering_leader';

    try {
      const res = insertCandidate.run({
        linkedin_url: person.linkedin_url,
        name: person.name,
        title: person.title,
        company: person.company,
        role_category: roleCat,
        relevance_reason: scoreInfo.relevanceReason,
        recommended_objective: catInfo.objective,
        relevance_score: scoreInfo.score,
        score_explanation: scoreInfo.explanation
      });

      const cid = res.lastInsertRowid || db.prepare('SELECT id FROM candidates WHERE linkedin_url = ?').get(person.linkedin_url)?.id;
      if (cid) {
        db.prepare('DELETE FROM messages WHERE candidate_id = ?').run(cid);
        insertMsg.run(cid, 'internship', messages.concise, 'Concise & Direct');
        insertMsg.run(cid, 'technical', messages.valueFirst, 'Value-First & Project Insight');
        insertMsg.run(cid, 'networking', messages.conversational, 'Conversational & Narrative');
      }

      processed.push({
        priority_tier: catInfo.tier,
        name: person.name,
        role_category: catInfo.category,
        title: person.title,
        company: person.company,
        relevance_score: scoreInfo.score,
        relevance_reason: scoreInfo.relevanceReason,
        recommended_objective: catInfo.objective,
        message_draft_concise: messages.concise,
        message_draft_value_first: messages.valueFirst,
        message_draft_conversational: messages.conversational,
        linkedin_url: person.linkedin_url
      });
    } catch (e) {
      // skip individual insertion errors
    }
  }

  // Export updated CSV
  processed.sort((a, b) => b.relevance_score - a.relevance_score);

  const csvHeaders = [
    'Priority_Tier',
    'Name',
    'Role_Category',
    'Title',
    'Company',
    'Relevance_Score',
    'Relevance_Reason',
    'Recommended_Objective',
    'Message_Draft_Concise',
    'Message_Draft_Value_First',
    'Message_Draft_Conversational',
    'LinkedIn_URL'
  ];

  const csvRows = [csvHeaders.join(',')];
  for (const row of processed) {
    csvRows.push([
      escapeCsv(row.priority_tier),
      escapeCsv(row.name),
      escapeCsv(row.role_category),
      escapeCsv(row.title),
      escapeCsv(row.company),
      escapeCsv(row.relevance_score),
      escapeCsv(row.relevance_reason),
      escapeCsv(row.recommended_objective),
      escapeCsv(row.message_draft_concise),
      escapeCsv(row.message_draft_value_first),
      escapeCsv(row.message_draft_conversational),
      escapeCsv(row.linkedin_url)
    ].join(','));
  }

  const csvPath = path.resolve(__dirname, '../../linkedin_connections_prioritized.csv');
  fs.writeFileSync(csvPath, csvRows.join('\r\n'), 'utf8');

  console.log(`[Sync] Finished! Synced ${processed.length} connections to SQLite and saved CSV: ${csvPath}`);
  return { count: processed.length, csvPath };
}

// Allow direct CLI invocation: `node server/scripts/sync-connections.js`
if (process.argv[1] && process.argv[1].endsWith('sync-connections.js')) {
  syncAllConnections().then(res => {
    console.log(`[CLI] Sync finished with ${res.count} connections.`);
    process.exit(0);
  }).catch(err => {
    console.error('[CLI] Sync failed:', err.message);
    process.exit(1);
  });
}
