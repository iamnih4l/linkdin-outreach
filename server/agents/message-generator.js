/**
 * Hyper-Personalized Message Generator
 * Drafts authentic, context-aware messages tailored to the candidate's exact background.
 * Produces 3 distinct variations per candidate:
 * 1. Concise & Direct (< 75 words, low friction)
 * 2. Value-First & Project Insight (connects AI projects to their work)
 * 3. Conversational & Narrative (student-founder story, warm relationship builder)
 */

import 'dotenv/config';

// User Persona Context
const SENDER_PROFILE = {
  name: 'Nihal',
  role: 'AI Engineering Student & Startup Co-Founder',
  background: 'Hands-on builder focusing on AI agents, LLM pipelines, autonomous systems, and modern full-stack development.',
  goals: {
    internship: 'Summer/Fall AI Engineering internships and junior/associate builder roles.',
    founder: 'Networking with tech founders, exchanging early-stage building lessons, exploring strategic synergy.',
    technical: 'Discussing AI agent architectures, autonomous workflows, and modern production LLM systems.',
    peer: 'Connecting with fellow engineers and builders passionate about high-impact AI.',
  },
};

/**
 * Call OpenAI API if API key is present
 */
async function callOpenAI(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-your-key-here') {
    return null;
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.warn('[message-generator] OpenAI API call failed, falling back to local engine:', err.message);
    return null;
  }
}

/**
 * Local AI Generation Engine — crafted heuristic templates with deep context synthesis
 */
function generateLocalVariations(candidate, customObjective = null) {
  const rawParts = (candidate.name || '').trim().split(/\s+/);
  let name = rawParts[0] || 'there';
  if (/^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?)$/i.test(name) && rawParts.length > 1) {
    name = rawParts[1];
  }
  const fullName = candidate.name;
  const company = candidate.company && !/^(tech industry|unknown|n\/a)$/i.test(candidate.company.trim())
    ? candidate.company.trim()
    : 'your team';
  const title = candidate.title || 'engineering leader';
  const objective = customObjective || candidate.recommended_objective || 'internship';
  const industry = candidate.industry || 'AI & tech';

  const isAI = /ai|machine learning|llm|deep learning|vision/i.test(`${title} ${company} ${candidate.profile_summary || ''}`);

  const variations = [];

  if (objective === 'internship') {
    // 1. Direct & Concise
    variations.push({
      variation_name: 'Concise & Direct',
      message_type: 'internship',
      message_text: `Hi ${name}, hope you're having a great week! I've been following ${company}'s work and wanted to reach out directly. I'm an AI engineering student and startup co-founder actively building LLM agents and autonomous systems. I'm looking for AI engineering internship opportunities where I can ship high-impact code. Would you be open to a brief 10-minute chat or pointing me toward the right hiring contact on your team?`,
      personalization_evidence: `Directly targeted ${name}'s role at ${company}, concisely presenting hands-on AI engineering focus and requesting clear next steps.`,
    });

    // 2. Value-First & Insight
    variations.push({
      variation_name: 'Value-First & Project Insight',
      message_type: 'internship',
      message_text: `Hi ${name}, I really admire what ${company} is building in ${industry}. As an AI engineering student who also co-founded an early-stage venture, I specialize in productionizing LLM pipelines and autonomous browser workflows. Seeing ${company}'s momentum, I'd love to contribute my hands-on shipping experience to your engineering team as an intern. Happy to share a couple of live demos of what I've deployed if you have a quick moment!`,
      personalization_evidence: `Bridged user's startup co-founder and LLM pipeline building background directly with ${company}'s mission in ${industry}.`,
    });

    // 3. Conversational & Story
    variations.push({
      variation_name: 'Conversational & Narrative',
      message_type: 'internship',
      message_text: `Hey ${name}, hope all is well! I noticed your work heading up talent at ${company} and wanted to introduce myself. I'm currently studying AI engineering while building startup products from the ground up. I love working at the intersection of AI research and fast product shipping, and ${company} is high on my radar for engineering internships. Would love to connect and keep in touch as new roles open up!`,
      personalization_evidence: `Personalized student-builder narrative highlighting culture fit and genuine long-term interest in ${company}.`,
    });
  } else if (objective === 'founder_networking') {
    // 1. Direct & Concise
    variations.push({
      variation_name: 'Concise & Direct',
      message_type: 'collaboration',
      message_text: `Hi ${name}, great to connect! As a fellow startup co-founder and AI builder, I've been following ${company}'s progress closely. I love how you've approached scaling in ${industry}. If you ever have 10 minutes for a virtual coffee, I'd love to exchange notes on early-stage building and AI tech stacks. Either way, cheering on ${company}!`,
      personalization_evidence: `Founder-to-founder outreach acknowledging ${company}'s scaling trajectory in ${industry}.`,
    });

    // 2. Value-First & Insight
    variations.push({
      variation_name: 'Value-First & Project Insight',
      message_type: 'collaboration',
      message_text: `Hi ${name}, congratulations on the recent growth with ${company}! As an AI engineer and co-founder building autonomous agents, I'm deeply impressed by how your team is tackling product innovation in ${industry}. We recently tackled similar workflow automation challenges, and I'd love to share our technical takeaways or compare perspectives on agentic architectures whenever you have a breather.`,
      personalization_evidence: `Highlighted shared founder mindset and offered concrete technical workflow insights relevant to ${company}.`,
    });

    // 3. Conversational & Story
    variations.push({
      variation_name: 'Conversational & Narrative',
      message_type: 'networking',
      message_text: `Hey ${name}, always great connecting with other builders creating in the AI ecosystem. Seeing your journey with ${company} has been genuinely inspiring as I navigate co-founding an AI tech startup alongside my engineering studies. Would love to stay connected, follow your milestones, and grab a quick chat down the road if time permits!`,
      personalization_evidence: `Authentic peer admiration and relationship building centered on ${name}'s journey building ${company}.`,
    });
  } else if (objective === 'technical_collaboration') {
    // 1. Direct & Concise
    variations.push({
      variation_name: 'Concise & Direct',
      message_type: 'technical',
      message_text: `Hi ${name}, I've been studying the technical architecture behind ${company}'s systems and really respect your leadership there. As an AI engineering student working deeply on LLM orchestration and agent evaluation, I'd love to ask 1–2 quick questions about how your team approaches reliable AI workflows in production. Would you be open to a brief chat sometime?`,
      personalization_evidence: `Targeted ${title} technical leadership at ${company} around AI workflow reliability.`,
    });

    // 2. Value-First & Insight
    variations.push({
      variation_name: 'Value-First & Project Insight',
      message_type: 'technical',
      message_text: `Hi ${name}, impressive work leading engineering at ${company}. I'm currently researching and building agentic AI architectures with human-in-the-loop verification to prevent hallucination in production. Given your experience in ${industry}, I'd be honored to share some open-source findings from our work and learn how your team tackles similar infrastructure challenges.`,
      personalization_evidence: `Specific technical alignment regarding human-in-the-loop AI systems and architecture.`,
    });

    // 3. Conversational & Story
    variations.push({
      variation_name: 'Conversational & Narrative',
      message_type: 'technical',
      message_text: `Hey ${name}, hope you're having an awesome week. I came across your profile through your work at ${company} and wanted to reach out. I'm an AI engineering student passionate about scalable distributed systems and LLMs. Always keen to learn from seasoned technical leaders like yourself. Look forward to staying in touch and seeing what you build next!`,
      personalization_evidence: `Respectful engineering mentorship and connection inquiry addressing ${name}'s seniority.`,
    });
  } else {
    // Generic peer / networking
    variations.push({
      variation_name: 'Concise & Direct',
      message_type: 'networking',
      message_text: `Hi ${name}, I came across your work at ${company} and wanted to reach out. I'm an AI engineering student and startup builder active in ${industry}. Would love to connect and follow each other's work!`,
      personalization_evidence: `Direct networking outreach noting mutual focus in ${industry}.`,
    });
    variations.push({
      variation_name: 'Value-First & Project Insight',
      message_type: 'networking',
      message_text: `Hi ${name}, great to connect with fellow professionals in ${industry}. I've been building applications in generative AI and workflow automation, and really appreciate what you're doing at ${company}. Wishing you and your team continued success!`,
      personalization_evidence: `Referenced ${company} and shared industry focus.`,
    });
    variations.push({
      variation_name: 'Conversational & Narrative',
      message_type: 'networking',
      message_text: `Hey ${name}, noticed we both share a passion for tech and innovation. As an AI student and builder, I always enjoy connecting with folks doing great work at teams like ${company}. Hope you have a wonderful week ahead!`,
      personalization_evidence: `Casual peer connection message.`,
    });
  }

  return variations;
}

/**
 * Generate 3 personalized message variations for a candidate
 */
export async function generateCandidateMessages(candidate, customObjective = null, customInstructions = '') {
  const objective = customObjective || candidate.recommended_objective || 'internship';

  // Check if OpenAI is configured
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'sk-your-key-here') {
    const systemPrompt = `You are an elite LinkedIn outreach copywriter drafting messages for Nihal, an AI engineering student and startup co-founder.
Rules:
- Never sound like an automated template or bot.
- Be genuine, humble yet confident, and respectful of the recipient's time.
- No buzzword stuffing, no generic flattery like "I hope this email finds you well".
- Return EXACTLY a JSON array of 3 message objects with schema:
[
  {
    "variation_name": "Concise & Direct",
    "message_type": "${objective}",
    "message_text": "text under 75 words with clear low-friction ask",
    "personalization_evidence": "exact explanation of facts used"
  },
  {
    "variation_name": "Value-First & Project Insight",
    "message_type": "${objective}",
    "message_text": "text connecting Nihal's AI projects with their company",
    "personalization_evidence": "exact explanation of facts used"
  },
  {
    "variation_name": "Conversational & Narrative",
    "message_type": "${objective}",
    "message_text": "warm student-founder story",
    "personalization_evidence": "exact explanation of facts used"
  }
]`;

    const userPrompt = `Draft 3 personalized LinkedIn messages for:
Candidate Name: ${candidate.name}
Title: ${candidate.title}
Company: ${candidate.company}
Industry: ${candidate.industry || 'Tech'}
Role Category: ${candidate.role_category}
Relevance Reason: ${candidate.relevance_reason}
Summary: ${candidate.profile_summary || 'N/A'}
Objective: ${objective}
${customInstructions ? `Additional User Instructions: ${customInstructions}` : ''}`;

    const llmResponse = await callOpenAI(systemPrompt, userPrompt);
    if (llmResponse) {
      try {
        const cleaned = llmResponse.replace(/```json\n?|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (err) {
        console.warn('[message-generator] Failed to parse LLM JSON response, using local engine:', err.message);
      }
    }
  }

  // Fallback to high-quality local generation engine
  return generateLocalVariations(candidate, objective);
}
