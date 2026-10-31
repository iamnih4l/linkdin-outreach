/**
 * Candidate Relevance Scorer & Categorizer
 * Evaluates LinkedIn profiles against the user's background:
 * - AI engineering student & startup co-founder
 * - Objectives: Recruiters (internships/jobs), Founders/CTOs (networking/collab),
 *   Engineering Leaders (hiring/mentorship), AI Peers (collaboration).
 */

export const ROLE_CATEGORIES = {
  UAE_PROFESSOR: 'uae_professor',
  UAE_STUDENT: 'uae_student',
  PROFESSOR: 'professor',
  STUDENT: 'student',
  RECRUITER: 'recruiter',
  HR: 'hr',
  FOUNDER: 'founder',
  CTO: 'cto',
  ENGINEERING_LEADER: 'engineering_leader',
  AI_ML_LEAD: 'ai_ml_lead',
  PRODUCT_MANAGER: 'product_manager',
  HIRING_MANAGER: 'hiring_manager',
  OTHER: 'other',
};

export const SENIORITY_LEVELS = {
  FOUNDER: 'founder',
  C_LEVEL: 'c_level',
  VP: 'vp',
  DIRECTOR: 'director',
  SENIOR: 'senior',
  MID: 'mid',
  ENTRY: 'entry',
};

/**
 * Categorize role from title and headline
 */
export function categorizeRole(title = '', headline = '', company = '') {
  const text = `${title} ${headline} ${company}`.toLowerCase();

  const isUAE = /\b(uae|united arab emirates|dubai|abu dhabi|sharjah|mbzuai|khalifa university|mohamed bin zayed|nyu abu dhabi|nyuad|american university of sharjah|aus|heriot-watt|birmingham dubai|uowd|ajman|al ain|al-ain|uaeu|ku|adu|middlesex university dubai)\b/i.test(text);

  const isProf = /\b(prof|professor|dean|provost|faculty|lecturer|postdoctoral|post doctoral|postdoc|chair|research scientist|lab director|academic success)\b/i.test(text);

  const isStudent = /\b(student|scholar|master's|masters|msc|undergrad|graduate|candidate|student ambassador|alumni|alumnus|peer tutor)\b/i.test(text);

  // UAE Academic Focus
  if (isUAE && isProf) {
    return ROLE_CATEGORIES.UAE_PROFESSOR;
  }
  if (isUAE && isStudent) {
    return ROLE_CATEGORIES.UAE_STUDENT;
  }

  // General Academia
  if (isProf) {
    return ROLE_CATEGORIES.PROFESSOR;
  }
  if (isStudent) {
    return ROLE_CATEGORIES.STUDENT;
  }

  // Recruiters & HR
  if (/\b(recruiter|talent acquisition|technical recruiter|university recruiter|sourcer|headhunter)\b/.test(text)) {
    return ROLE_CATEGORIES.RECRUITER;
  }
  if (/\b(people operations|human resources|hr manager|hr lead|head of people|talent lead|chief people officer)\b/.test(text)) {
    return ROLE_CATEGORIES.HR;
  }

  // Founders, Managing Directors, Partners & C-level
  if (/\b(co-founder|cofounder|founder|ceo|chief executive|managing director|managing partner|partner at)\b/.test(text)) {
    return ROLE_CATEGORIES.FOUNDER;
  }
  if (/\b(cto|chief technology officer|chief technical officer)\b/.test(text)) {
    return ROLE_CATEGORIES.CTO;
  }

  // AI & ML Leads, Engineers, Researchers, Builders
  if (/\b(ai lead|ml lead|head of ai|head of machine learning|director of ai|ai architect|principal ai|research scientist|machine learning engineer|ml engineer|ai engineer|ai developer|agentic ai|genai|llm|deep learning)\b/.test(text)) {
    return ROLE_CATEGORIES.AI_ML_LEAD;
  }

  // Engineering Leaders / Hiring Managers
  if (/\b(engineering manager|vp of engineering|vice president engineering|director of engineering|tech lead manager|head of engineering|engineering lead)\b/.test(text)) {
    return ROLE_CATEGORIES.ENGINEERING_LEADER;
  }
  if (/\b(hiring manager)\b/.test(text)) {
    return ROLE_CATEGORIES.HIRING_MANAGER;
  }

  // Product Managers
  if (/\b(product manager|group product manager|director of product|vp product|head of product|pm)\b/.test(text)) {
    return ROLE_CATEGORIES.PRODUCT_MANAGER;
  }

  return ROLE_CATEGORIES.OTHER;
}

/**
 * Determine seniority level
 */
export function determineSeniority(title = '') {
  const text = title.toLowerCase();

  if (/\b(founder|co-founder)\b/.test(text)) return SENIORITY_LEVELS.FOUNDER;
  if (/\b(chief|c-level|ceo|cto|cpo|coo)\b/.test(text)) return SENIORITY_LEVELS.C_LEVEL;
  if (/\b(vp|vice president)\b/.test(text)) return SENIORITY_LEVELS.VP;
  if (/\b(director|head of)\b/.test(text)) return SENIORITY_LEVELS.DIRECTOR;
  if (/\b(senior|sr\.?|lead|staff|principal)\b/.test(text)) return SENIORITY_LEVELS.SENIOR;
  if (/\b(junior|jr\.?|intern|associate|entry)\b/.test(text)) return SENIORITY_LEVELS.ENTRY;

  return SENIORITY_LEVELS.MID;
}

/**
 * Score relevance 0-100 and produce detailed explanation
 */
export function scoreCandidate(profile) {
  const {
    name = '',
    title = '',
    company = '',
    industry = '',
    profile_summary = '',
    about = '',
    skills = [],
    experience = [],
  } = profile;

  const role = profile.role_category || categorizeRole(title);
  const seniority = profile.seniority || determineSeniority(title);

  let score = 50; // base score
  const breakdown = [];
  let recommendedObjective = 'peer_connection';

  const combinedText = `${name} ${title} ${company} ${industry} ${profile_summary} ${about} ${skills.join(' ')}`.toLowerCase();

  // 1. Role alignment (+15 to +40)
  if (role === ROLE_CATEGORIES.UAE_PROFESSOR) {
    score += 40;
    breakdown.push('UAE Academic Leader / Professor / Researcher (+40)');
    recommendedObjective = 'uae_scholarship_research';
  } else if (role === ROLE_CATEGORIES.UAE_STUDENT) {
    score += 35;
    breakdown.push('UAE University Student / Scholar / Ambassador (+35)');
    recommendedObjective = 'uae_admissions_guidance';
  } else if (role === ROLE_CATEGORIES.PROFESSOR) {
    score += 25;
    breakdown.push('Academic Professor / Researcher (+25)');
    recommendedObjective = 'academic_research';
  } else if (role === ROLE_CATEGORIES.STUDENT) {
    score += 15;
    breakdown.push('University Student / Peer (+15)');
    recommendedObjective = 'peer_connection';
  } else if (role === ROLE_CATEGORIES.RECRUITER) {
    if (/tech|technical|ai|engineering|software|university|campus/.test(title.toLowerCase())) {
      score += 35;
      breakdown.push('Direct technical/university recruiter (+35)');
    } else {
      score += 25;
      breakdown.push('General recruiter / talent acquisition (+25)');
    }
    recommendedObjective = 'internship';
  } else if (role === ROLE_CATEGORIES.HR) {
    score += 20;
    breakdown.push('People & HR professional (+20)');
    recommendedObjective = 'internship';
  } else if (role === ROLE_CATEGORIES.FOUNDER) {
    score += 35;
    breakdown.push('Startup Founder / CEO (+35)');
    recommendedObjective = 'founder_networking';
  } else if (role === ROLE_CATEGORIES.CTO) {
    score += 35;
    breakdown.push('CTO / Technical Visionary (+35)');
    recommendedObjective = 'technical_collaboration';
  } else if (role === ROLE_CATEGORIES.AI_ML_LEAD) {
    score += 30;
    breakdown.push('AI/ML Lead or Research Scientist (+30)');
    recommendedObjective = 'technical_collaboration';
  } else if (role === ROLE_CATEGORIES.ENGINEERING_LEADER) {
    score += 25;
    breakdown.push('Engineering Leader / Manager (+25)');
    recommendedObjective = 'internship';
  } else if (role === ROLE_CATEGORIES.PRODUCT_MANAGER) {
    score += 15;
    breakdown.push('Product Manager (+15)');
    recommendedObjective = 'founder_networking';
  }

  // 2. Industry & AI Keywords (+10 to +25)
  const isAIFocused = /\b(ai|artificial intelligence|machine learning|deep learning|llm|generative ai|genai|nlp|computer vision|transformers|neural)\b/.test(combinedText);
  if (isAIFocused) {
    score += 20;
    breakdown.push('Strong AI/ML domain focus (+20)');
  }

  const isStartupFocused = /\b(startup|stealth|series a|series b|seed|yc|y combinator|venture-backed|early-stage)\b/.test(combinedText);
  if (isStartupFocused) {
    score += 15;
    breakdown.push('Startup ecosystem / venture presence (+15)');
  }

  // 3. Top-tier Tech / Enterprise / Lab (+10)
  const isTopTier = /\b(google|microsoft|amazon|meta|apple|netflix|openai|anthropic|databricks|deepmind|nvidia|hugging face|scale ai|stripe)\b/.test(combinedText);
  if (isTopTier) {
    score += 10;
    breakdown.push('Tier-1 AI / Tech organization (+10)');
  }

  // 4. Hiring / Opportunity indicators (+10)
  if (/\b(hiring|we're hiring|join us|looking for|intern|interns|internship|growth)\b/.test(combinedText)) {
    score += 10;
    breakdown.push('Active hiring indicators detected (+10)');
  }

  // Bound score between 0 and 100
  score = Math.min(100, Math.max(10, score));

  // Determine confidence
  let confidenceLevel = 'medium';
  if (title && company && (about || profile_summary)) {
    confidenceLevel = 'high';
  } else if (!title || !company) {
    confidenceLevel = 'low';
  }

  // Missing info check
  const missing = [];
  if (!company) missing.push('Company');
  if (!title) missing.push('Current Title');
  if (!about && !profile_summary) missing.push('About section / Summary');
  const missingInfo = missing.length > 0 ? `Missing: ${missing.join(', ')}` : null;

  // Synthesize relevance reason
  let relevanceReason = '';
  if (role === ROLE_CATEGORIES.UAE_PROFESSOR) {
    relevanceReason = `Academic faculty / researcher at ${company || 'UAE university'}. Ideal contact for Master's research opportunities, thesis advising, and fully-funded UAE scholarships (e.g. MBZUAI / Khalifa University fellowships).`;
  } else if (role === ROLE_CATEGORIES.UAE_STUDENT) {
    relevanceReason = `Student / Scholar at ${company || 'UAE university'}. Invaluable peer contact for Master's admissions guidance, application strategy, SOP insights, and firsthand campus experience.`;
  } else if (role === ROLE_CATEGORIES.RECRUITER) {
    relevanceReason = `Key talent contact at ${company || 'their organization'}, ideal for exploring AI engineering internships and graduate technical roles.`;
  } else if (role === ROLE_CATEGORIES.FOUNDER) {
    relevanceReason = `Founder of ${company || 'innovative venture'} working in ${industry || 'technology'}. High-value connection for startup collaboration, founder insights, and early-stage opportunities.`;
  } else if (role === ROLE_CATEGORIES.CTO || role === ROLE_CATEGORIES.AI_ML_LEAD) {
    relevanceReason = `Technical leader at ${company || 'industry leader'} specializing in ${isAIFocused ? 'AI/ML systems' : 'software engineering'}. Great touchpoint for technical collaboration and architecture discussions.`;
  } else if (role === ROLE_CATEGORIES.ENGINEERING_LEADER) {
    relevanceReason = `Engineering leader at ${company || 'tech team'} who likely makes hiring decisions for engineering and AI talent.`;
  } else {
    relevanceReason = `Relevant technology professional in ${industry || 'the tech industry'} at ${company || 'their company'}.`;
  }

  return {
    relevance_score: score,
    role_category: role,
    seniority,
    score_explanation: breakdown.join('; '),
    relevance_reason: relevanceReason,
    recommended_objective: recommendedObjective,
    confidence_level: confidenceLevel,
    missing_info: missingInfo,
  };
}
