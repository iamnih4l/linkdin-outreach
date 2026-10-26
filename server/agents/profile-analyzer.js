/**
 * Profile Analyzer
 * Extracts, parses, and cleans professional details from LinkedIn profiles or raw text.
 * Integrates with scorer.js to produce structured candidate records.
 */

import { categorizeRole, determineSeniority, scoreCandidate } from './scorer.js';

/**
 * Clean whitespace and text artifacts
 */
function cleanText(text = '') {
  return text
    .replace(/\s+/g, ' ')
    .replace(/·\s*/g, '· ')
    .trim();
}

/**
 * Heuristically parse raw LinkedIn profile text or manual input
 */
export function parseProfileText(rawText = '', sourceUrl = '') {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^(\d+ connections|Contact info|Highlights|Activity)$/i.test(l));

  let name = '';
  let title = '';
  let company = '';
  let location = '';
  let about = '';
  let industry = 'Technology';
  const skills = [];
  const experience = [];

  // If first line looks like a name
  if (lines.length > 0) {
    name = lines[0].replace(/\b(He\/Him|She\/Her|They\/Them|1st|2nd|3rd)\b/gi, '').trim();
  }

  // Second line is typically headline / title
  if (lines.length > 1) {
    title = lines[1];
    // Extract company from headline like "Software Engineer at Google" or "Co-founder & CEO @ Acme"
    const atMatch = title.match(/(?:at|@)\s+([^·|,]+)/i);
    if (atMatch) {
      company = atMatch[1].trim();
    }
  }

  // Check subsequent lines for company if not found
  if (!company && lines.length > 2) {
    for (let i = 2; i < Math.min(lines.length, 6); i++) {
      if (lines[i].toLowerCase().includes('company') || lines[i].length < 40) {
        // Potential company
        if (!location && /area|city|united states|india|san francisco|new york|remote|bangalore|london/i.test(lines[i])) {
          location = lines[i];
        }
      }
    }
  }

  // Look for About section
  const aboutIdx = lines.findIndex(l => /^about$/i.test(l));
  if (aboutIdx !== -1 && lines[aboutIdx + 1]) {
    about = lines.slice(aboutIdx + 1, aboutIdx + 4).join(' ');
  }

  // Infer industry
  const fullText = `${title} ${about} ${lines.join(' ')}`.toLowerCase();
  if (/artificial intelligence|machine learning|deep learning|llm|generative ai/i.test(fullText)) {
    industry = 'Artificial Intelligence';
  } else if (/fintech|finance|payments/i.test(fullText)) {
    industry = 'Fintech';
  } else if (/health|biotech|medical/i.test(fullText)) {
    industry = 'HealthTech';
  } else if (/saas|cloud|enterprise software|devops/i.test(fullText)) {
    industry = 'Enterprise Software';
  } else if (/recruiting|talent|staffing/i.test(fullText)) {
    industry = 'Talent & Staffing';
  }

  return analyzeProfile({
    name: name || 'LinkedIn Member',
    title: title || 'Professional',
    company: company || 'Tech Industry',
    industry,
    location,
    about,
    linkedin_url: sourceUrl || null,
    raw_data: rawText,
  });
}

/**
 * Analyze candidate object, score it, and format for DB
 */
export function analyzeProfile(profileInput) {
  const name = cleanText(profileInput.name) || 'Unknown Candidate';
  const title = cleanText(profileInput.title) || '';
  const company = cleanText(profileInput.company) || '';
  const industry = cleanText(profileInput.industry) || 'Technology';
  const about = cleanText(profileInput.about || profileInput.profile_summary || '');
  const linkedinUrl = profileInput.linkedin_url || null;

  const role = profileInput.role_category || categorizeRole(title);
  const seniority = profileInput.seniority || determineSeniority(title);

  // Score candidate
  const scoreResult = scoreCandidate({
    name,
    title,
    company,
    industry,
    about,
    profile_summary: about,
    role_category: role,
    seniority,
  });

  // Construct summary if missing
  let profileSummary = about;
  if (!profileSummary) {
    profileSummary = `${name} is currently ${title}${company ? ` at ${company}` : ''}, specializing in ${industry}. Categorized as ${role.replace(/_/g, ' ')} with ${seniority} seniority.`;
  }

  return {
    name,
    title,
    company,
    industry,
    role_category: role,
    seniority,
    linkedin_url: linkedinUrl,
    profile_summary: profileSummary,
    relevance_score: scoreResult.relevance_score,
    score_explanation: scoreResult.score_explanation,
    relevance_reason: scoreResult.relevance_reason,
    recommended_objective: scoreResult.recommended_objective,
    confidence_level: scoreResult.confidence_level,
    missing_info: scoreResult.missing_info,
    raw_data: typeof profileInput.raw_data === 'string' ? profileInput.raw_data : JSON.stringify(profileInput),
    status: 'new',
  };
}
