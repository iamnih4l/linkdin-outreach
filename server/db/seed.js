import { getDb } from './index.js';

const DEMO_CANDIDATES = [
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-sarah-chen',
    name: 'Sarah Chen',
    title: 'Senior Technical Recruiter',
    company: 'Google',
    industry: 'Technology',
    role_category: 'recruiter',
    seniority: 'senior',
    profile_summary: 'Senior Technical Recruiter at Google specializing in AI/ML engineering roles. Previously recruited for DeepMind and Google Brain. Active in university recruiting programs and early-career talent pipelines. Regularly posts about emerging AI talent and internship opportunities.',
    relevance_reason: 'Actively recruits for AI/ML engineering positions at Google, including internship programs. Strong alignment with AI engineering background.',
    recommended_objective: 'Express interest in Google AI/ML internship programs and learn about upcoming recruiting cycles.',
    relevance_score: 92,
    score_explanation: 'Very high relevance: Recruits specifically for AI/ML roles at Google, active in university programs, and has posted about internship pipelines. Direct path to internship opportunities.',
    confidence_level: 'high',
    missing_info: null,
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-marcus-johnson',
    name: 'Marcus Johnson',
    title: 'Talent Acquisition Partner — AI & Data',
    company: 'Microsoft',
    industry: 'Technology',
    role_category: 'recruiter',
    seniority: 'mid',
    profile_summary: 'Talent Acquisition Partner at Microsoft focused on AI, Data Science, and Cloud Engineering roles. Manages early-career and experienced hire pipelines. Previously at Amazon recruiting for AWS. Advocates for diverse talent in tech.',
    relevance_reason: 'Specializes in AI and data hiring at Microsoft with experience in early-career pipelines.',
    recommended_objective: 'Inquire about AI engineering internship and early-career opportunities at Microsoft.',
    relevance_score: 88,
    score_explanation: 'High relevance: AI-focused recruiter at a top tech company with early-career pipeline experience. Slightly lower than Sarah due to less visible university recruiting activity.',
    confidence_level: 'high',
    missing_info: null,
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-priya-sharma',
    name: 'Priya Sharma',
    title: 'Co-founder & CEO',
    company: 'NeuralPath AI',
    industry: 'Artificial Intelligence',
    role_category: 'founder',
    seniority: 'founder',
    profile_summary: 'Co-founder and CEO of NeuralPath AI, a Series A startup building enterprise AI agents for workflow automation. Former ML engineer at Meta. Y Combinator W24 batch. Actively hiring for engineering and AI research roles. Speaks regularly at AI conferences about the future of autonomous agents.',
    relevance_reason: 'AI startup founder building agent systems — directly aligned with AI engineering interests. Startup is actively hiring and growing.',
    recommended_objective: 'Network about shared interest in AI agents, explore potential collaboration or early-stage role.',
    relevance_score: 95,
    score_explanation: 'Highest relevance: Founder of an AI agent startup that is hiring, YC-backed, and aligned with AI engineering + startup interests. Multiple outreach angles available.',
    confidence_level: 'high',
    missing_info: null,
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-james-wilson',
    name: 'James Wilson',
    title: 'CTO',
    company: 'DataVentures',
    industry: 'Data Analytics',
    role_category: 'cto',
    seniority: 'c_level',
    profile_summary: 'CTO at DataVentures, a mid-stage analytics startup. Oversees engineering team of 40+ and is expanding the ML infrastructure team. Former principal engineer at Stripe. Passionate about developer tools and ML pipelines. Open-source contributor.',
    relevance_reason: 'CTO expanding ML team at a growing startup. Engineering leadership connection with potential hiring authority.',
    recommended_objective: 'Connect about ML infrastructure work, learn about team growth and potential opportunities.',
    relevance_score: 82,
    score_explanation: 'High relevance: CTO with hiring authority expanding ML team. Good startup + technical alignment. Slightly less direct than AI-focused roles.',
    confidence_level: 'medium',
    missing_info: 'Unclear if they have internship programs or only full-time roles.',
    status: 'reviewed',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-aisha-patel',
    name: 'Dr. Aisha Patel',
    title: 'AI/ML Research Lead',
    company: 'DeepMind',
    industry: 'Artificial Intelligence',
    role_category: 'ai_ml_lead',
    seniority: 'senior',
    profile_summary: 'AI/ML Research Lead at DeepMind working on large language models and multi-agent systems. PhD in Machine Learning from Stanford. Published 30+ papers in NeurIPS, ICML, and ICLR. Mentors PhD students and early-career AI researchers. Advocates for responsible AI development.',
    relevance_reason: 'Leading AI researcher at DeepMind with mentorship focus. Strong alignment with AI engineering studies and research interests.',
    recommended_objective: 'Seek mentorship and research insights, learn about research internship opportunities at DeepMind.',
    relevance_score: 87,
    score_explanation: 'High relevance: Top AI researcher with mentorship track record. Research internship potential. Research-heavy profile may be more academic than industry-aligned.',
    confidence_level: 'medium',
    missing_info: 'Unclear if she manages internship hiring directly or refers candidates to recruiting.',
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-robert-kim',
    name: 'Robert Kim',
    title: 'Engineering Manager — AI Platform',
    company: 'Meta',
    industry: 'Technology',
    role_category: 'engineering_leader',
    seniority: 'senior',
    profile_summary: 'Engineering Manager at Meta leading the AI Platform team. Manages 12 engineers building ML infrastructure for recommendation systems. Previously at Uber ATG working on autonomous vehicle ML pipelines. Active on LinkedIn sharing engineering leadership content.',
    relevance_reason: 'Engineering manager at Meta with AI platform focus. Potential hiring manager for AI engineering roles.',
    recommended_objective: 'Connect about AI platform engineering work and learn about team opportunities.',
    relevance_score: 79,
    score_explanation: 'Good relevance: AI platform hiring manager at Meta. However, large company EM may have less direct hiring control for interns compared to recruiters.',
    confidence_level: 'medium',
    missing_info: 'No visible indication of current intern hiring for his specific team.',
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-elena-rodriguez',
    name: 'Elena Rodriguez',
    title: 'HR Director',
    company: 'Stripe',
    industry: 'Financial Technology',
    role_category: 'hr',
    seniority: 'director',
    profile_summary: 'HR Director at Stripe overseeing talent strategy for engineering and product teams. Led development of Stripe\'s engineering career ladder. Previously VP People at a fintech startup. Focuses on building inclusive engineering cultures.',
    relevance_reason: 'HR Director at a top fintech company with engineering talent oversight. Strategic connection for understanding company culture and opportunities.',
    recommended_objective: 'Learn about Stripe\'s engineering culture and early-career programs.',
    relevance_score: 74,
    score_explanation: 'Moderate-high relevance: HR Director with engineering talent oversight, but may be less hands-on with individual hiring than recruiters.',
    confidence_level: 'medium',
    missing_info: 'No direct evidence of intern program involvement.',
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-david-thompson',
    name: 'David Thompson',
    title: 'Founder & Managing Director',
    company: 'Venture Labs',
    industry: 'Venture Capital',
    role_category: 'founder',
    seniority: 'founder',
    profile_summary: 'Founder and Managing Director of Venture Labs, an early-stage VC fund focused on AI and deep tech startups. Previously co-founded two B2B SaaS companies (one acquired). Angel investor in 15+ startups. Regularly mentors student founders and runs a startup accelerator program.',
    relevance_reason: 'VC founder investing in AI startups who mentors student founders. Strong alignment with both startup co-founder and AI engineering interests.',
    recommended_objective: 'Connect as a student founder in AI, seek mentorship and learn about the accelerator program.',
    relevance_score: 85,
    score_explanation: 'High relevance: AI-focused VC who mentors students and runs an accelerator. Not a direct hiring connection but high value for startup networking.',
    confidence_level: 'high',
    missing_info: null,
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-lisa-wang',
    name: 'Lisa Wang',
    title: 'Product Manager — AI Products',
    company: 'OpenAI',
    industry: 'Artificial Intelligence',
    role_category: 'product_manager',
    seniority: 'mid',
    profile_summary: 'Product Manager at OpenAI working on developer-facing AI products and APIs. Previously PM at Notion leading AI features. Background in computer science with experience bridging technical AI capabilities and user-facing product design.',
    relevance_reason: 'PM at OpenAI building AI developer products. Strong alignment with AI product development interests.',
    recommended_objective: 'Network about AI product development, learn about the intersection of engineering and product at OpenAI.',
    relevance_score: 76,
    score_explanation: 'Good relevance: AI product role at a leading company. Good networking connection but PMs typically don\'t make engineering hiring decisions.',
    confidence_level: 'medium',
    missing_info: 'Unclear if OpenAI has PM internship tracks.',
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-michael-obrien',
    name: 'Michael O\'Brien',
    title: 'University Recruiter — Technical',
    company: 'Amazon',
    industry: 'Technology',
    role_category: 'recruiter',
    seniority: 'mid',
    profile_summary: 'University Recruiter at Amazon specializing in technical internship and new grad placements. Covers computer science, AI/ML, and data engineering roles. Visits 20+ universities per year for recruiting events. Active in promoting Amazon\'s intern conversion program.',
    relevance_reason: 'University recruiter specifically handling technical internships at Amazon. Direct path to internship placement.',
    recommended_objective: 'Express interest in Amazon AI/ML internship programs and upcoming campus recruiting events.',
    relevance_score: 91,
    score_explanation: 'Very high relevance: University recruiter specializing in exactly the type of technical internship role being sought. Direct hiring pipeline.',
    confidence_level: 'high',
    missing_info: null,
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-anna-chen',
    name: 'Anna Chen',
    title: 'Head of Engineering',
    company: 'Anthropic',
    industry: 'Artificial Intelligence',
    role_category: 'engineering_leader',
    seniority: 'director',
    profile_summary: 'Head of Engineering at Anthropic leading the systems engineering team responsible for model serving infrastructure. Former senior engineer at Google Brain. Active in the AI safety research community and mentors early-career engineers.',
    relevance_reason: 'Engineering leader at a leading AI safety company who mentors early-career engineers.',
    recommended_objective: 'Connect about AI safety engineering and explore mentorship or internship possibilities.',
    relevance_score: 84,
    score_explanation: 'High relevance: Engineering leader at a top AI company with mentorship interest. AI safety alignment with cutting-edge AI work.',
    confidence_level: 'medium',
    missing_info: 'No direct evidence of current intern openings on her team.',
    status: 'new',
  },
  {
    linkedin_url: 'https://www.linkedin.com/in/demo-raj-patel',
    name: 'Raj Patel',
    title: 'Co-founder & CTO',
    company: 'BuildFast AI',
    industry: 'Developer Tools',
    role_category: 'cto',
    seniority: 'founder',
    profile_summary: 'Co-founder and CTO of BuildFast AI, a seed-stage startup building AI-powered developer tools. Former tech lead at Vercel. Open-source contributor to several popular JS/TS projects. Actively building the founding engineering team.',
    relevance_reason: 'Co-founder CTO of an early-stage AI dev tools startup, actively hiring founding engineers. Strong alignment with both startup and AI interests.',
    recommended_objective: 'Connect as a fellow startup co-founder in AI, explore collaboration or founding team opportunity.',
    relevance_score: 90,
    score_explanation: 'Very high relevance: Startup CTO actively building founding team in AI dev tools. Fellow founder connection + hiring alignment + AI focus.',
    confidence_level: 'high',
    missing_info: null,
    status: 'new',
  },
];

const DEMO_MESSAGES = [
  {
    candidate_name: 'Sarah Chen',
    message_type: 'internship',
    message_text: `Hi Sarah,\n\nI noticed you recruit for AI/ML engineering roles at Google, including university programs. I'm an AI engineering student and startup co-founder working on agent systems and applied ML.\n\nI'd love to learn about Google's AI internship programs and what you look for in candidates. Would you be open to a brief conversation about the upcoming recruiting cycle?\n\nThank you for your time!`,
    personalization_evidence: 'Recruits for AI/ML roles at Google; active in university recruiting programs.',
    status: 'draft',
  },
  {
    candidate_name: 'Priya Sharma',
    message_type: 'networking',
    message_text: `Hi Priya,\n\nI've been following NeuralPath AI's work on enterprise AI agents — it's exciting to see a YC-backed team tackling workflow automation with agent architectures.\n\nI'm an AI engineering student and startup co-founder also building in the agent space. I'd love to hear how you're thinking about multi-agent coordination in enterprise settings.\n\nWould you be open to a short conversation about your approach?`,
    personalization_evidence: 'CEO of NeuralPath AI (YC W24), building enterprise AI agents. Fellow startup founder working in AI agents.',
    status: 'draft',
  },
  {
    candidate_name: 'Priya Sharma',
    message_type: 'collaboration',
    message_text: `Hi Priya,\n\nAs a fellow startup founder building in the AI agent space, I've been impressed by NeuralPath AI's approach to enterprise workflow automation.\n\nI'm co-founding a startup focused on [specific AI application] and I think there could be interesting technical overlap between our approaches. Would you be interested in exchanging notes on agent architecture challenges?\n\nWould love to connect if you have a few minutes.`,
    personalization_evidence: 'Fellow YC founder building AI agents. Shared interest in agent architecture and enterprise AI.',
    status: 'draft',
  },
  {
    candidate_name: 'David Thompson',
    message_type: 'networking',
    message_text: `Hi David,\n\nI came across your work at Venture Labs and your focus on early-stage AI and deep tech investments. As a student founder building in the AI space, I'd really value your perspective on what you're seeing in the early-stage AI landscape.\n\nI noticed you mentor student founders through your accelerator program — I'd love to learn more about how that works and what you look for in founding teams.\n\nWould you be open to a brief chat?`,
    personalization_evidence: 'VC investing in AI/deep tech, mentors student founders, runs accelerator program.',
    status: 'draft',
  },
  {
    candidate_name: 'Raj Patel',
    message_type: 'collaboration',
    message_text: `Hi Raj,\n\nReally cool to see what you're building at BuildFast AI — AI-powered dev tools is a space I'm very interested in as both an AI engineering student and startup co-founder.\n\nAs a fellow founder and someone who's worked with JS/TS tooling, I'd love to hear how you're approaching the AI integration layer in developer workflows. I'm also curious about your experience building a founding team at the seed stage.\n\nWould you have time for a quick conversation?`,
    personalization_evidence: 'Fellow startup co-founder/CTO building AI dev tools, actively hiring founding team. Shared interest in AI + developer tools.',
    status: 'draft',
  },
];

const DEMO_ACTIVITY = [
  { action: 'system_start', details: 'LinkedIn Outreach Agent initialized with demo data', status: 'info' },
  { action: 'scan_complete', details: 'Demo scan completed: 12 candidates discovered', status: 'success' },
  { action: 'candidate_scored', details: 'All demo candidates scored and ranked', candidate_name: null, status: 'info' },
  { action: 'message_generated', details: 'Draft message generated for internship outreach', candidate_name: 'Sarah Chen', status: 'success' },
  { action: 'message_generated', details: 'Draft messages generated (networking + collaboration)', candidate_name: 'Priya Sharma', status: 'success' },
  { action: 'message_generated', details: 'Draft message generated for VC networking', candidate_name: 'David Thompson', status: 'success' },
  { action: 'message_generated', details: 'Draft message generated for founder collaboration', candidate_name: 'Raj Patel', status: 'success' },
];

export function seedDemoData(resetFirst = false) {
  const db = getDb();

  if (resetFirst) {
    db.exec('DELETE FROM activity_log');
    db.exec('DELETE FROM messages');
    db.exec('DELETE FROM candidates');
    db.exec("DELETE FROM agent_state");
    console.log('[seed] Cleared existing data.');
  }

  const existingCount = db.prepare('SELECT COUNT(*) as count FROM candidates WHERE is_demo = 1').get().count;
  if (existingCount > 0 && !resetFirst) {
    console.log(`[seed] ${existingCount} demo candidates already exist. Use --reset to re-seed.`);
    return;
  }

  const insertCandidate = db.prepare(`
    INSERT OR IGNORE INTO candidates
      (linkedin_url, name, title, company, industry, role_category, seniority,
       profile_summary, relevance_reason, recommended_objective,
       relevance_score, score_explanation, confidence_level, missing_info,
       status, is_demo)
    VALUES
      (@linkedin_url, @name, @title, @company, @industry, @role_category, @seniority,
       @profile_summary, @relevance_reason, @recommended_objective,
       @relevance_score, @score_explanation, @confidence_level, @missing_info,
       @status, 1)
  `);

  const insertMessage = db.prepare(`
    INSERT INTO messages
      (candidate_id, message_type, message_text, personalization_evidence, status)
    VALUES
      (@candidate_id, @message_type, @message_text, @personalization_evidence, @status)
  `);

  const insertActivity = db.prepare(`
    INSERT INTO activity_log (action, details, candidate_name, status)
    VALUES (@action, @details, @candidate_name, @status)
  `);

  const seedAll = db.transaction(() => {
    for (const candidate of DEMO_CANDIDATES) {
      insertCandidate.run(candidate);
    }

    for (const msg of DEMO_MESSAGES) {
      const candidate = db.prepare('SELECT id FROM candidates WHERE name = ?').get(msg.candidate_name);
      if (candidate) {
        insertMessage.run({
          candidate_id: candidate.id,
          message_type: msg.message_type,
          message_text: msg.message_text,
          personalization_evidence: msg.personalization_evidence,
          status: msg.status,
        });
      }
    }

    for (const activity of DEMO_ACTIVITY) {
      insertActivity.run({
        action: activity.action,
        details: activity.details,
        candidate_name: activity.candidate_name || null,
        status: activity.status,
      });
    }

    db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('scan_status', 'idle')").run();
    db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('total_scanned', '0')").run();
    db.prepare("INSERT OR REPLACE INTO agent_state (key, value) VALUES ('data_source', 'demo')").run();
  });

  seedAll();
  console.log(`[seed] Inserted ${DEMO_CANDIDATES.length} demo candidates, ${DEMO_MESSAGES.length} messages, ${DEMO_ACTIVITY.length} activity entries.`);
}

const isDirectRun = process.argv[1]?.endsWith('seed.js');
if (isDirectRun) {
  const reset = process.argv.includes('--reset');
  seedDemoData(reset);
  process.exit(0);
}
