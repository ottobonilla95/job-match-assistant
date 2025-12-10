// Background service worker - handles OpenAI API calls
try {
  importScripts("/config.js");
} catch (e) {
  console.error(
    "Job Match: config.js not found. Copy config.example.js to config.js and add your API key."
  );
}
console.log("Job Match: Service worker loaded");

const OPENAI_API_KEY =
  typeof CONFIG !== "undefined" ? CONFIG.OPENAI_API_KEY : null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Job Match: Received message", request.type);
  if (request.type === "ANALYZE_JOB") {
    analyzeJob(request.jobText).then(sendResponse);
    return true;
  }

  if (request.type === "PARSE_CV") {
    parseCV(request.cvText).then(sendResponse);
    return true;
  }

  if (request.type === "CHECK_READY") {
    checkReady()
      .then(sendResponse)
      .catch(() => sendResponse({ ready: false }));
    return true;
  }

  if (request.type === "GENERATE_COVER_LETTER") {
    generateCoverLetter(request.jobText, request.jobTitle).then(sendResponse);
    return true;
  }

  if (request.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    return false;
  }
});

async function getSettings() {
  const result = await chrome.storage.sync.get(["profile"]);
  return { ...result, apiKey: OPENAI_API_KEY };
}

async function checkReady() {
  const { profile } = await getSettings();
  return {
    ready: !!profile && !!OPENAI_API_KEY,
    hasApiKey: !!OPENAI_API_KEY,
    hasProfile: !!profile,
  };
}

async function parseCV(cvText) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Analyze if this document is a CV/resume. If it IS a CV, extract profile info. If it is NOT a CV (e.g. invoice, receipt, random document), set is_valid_cv to false.

Return JSON only:
{
  "is_valid_cv": true/false,
  "name": "string or null",
  "title": "string (current/target job title) or null",
  "years_experience": number or 0,
  "skills": ["skill1", "skill2", ...] or [],
  "summary": "1-2 sentence summary or null"
}`,
          },
          {
            role: "user",
            content: cvText,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.error?.message || `API error: ${response.status}`
      );
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [
      null,
      content,
    ];
    const profile = JSON.parse(jsonMatch[1].trim());

    // Check if it's a valid CV
    if (!profile.is_valid_cv) {
      return { error: "This doesn't look like a CV. Please upload your resume/CV." };
    }

    // Validate we got meaningful data
    if (!profile.name || profile.name === "null" || !profile.skills || profile.skills.length === 0) {
      return { error: "Couldn't extract profile info. Please upload a clearer CV." };
    }

    // Remove the is_valid_cv flag before saving
    delete profile.is_valid_cv;

    // Save profile
    await chrome.storage.sync.set({ profile });

    return { success: true, profile };
  } catch (err) {
    console.error("parseCV error:", err);
    return { error: err.message || "Failed to parse CV" };
  }
}

async function analyzeJob(jobText) {
  try {
    const { profile } = await getSettings();

    if (!profile) {
      return { error: "No profile. Upload your CV in Settings first." };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Analyze the JOB POSTING. Extract information accurately from the text.

Return JSON:
{
  "title": "exact job title",
  "role": "Frontend|Backend|Fullstack|Cloud|Data|DevOps|Mobile|AI/ML|Security|Other",
  "location": "location as written in job",
  "work_mode": "Remote|Hybrid|On-site",
  "required_years": number or 0,
  "seniority": "Junior|Mid|Senior|Lead|Staff|Principal|Founding",
  "required_skills": ["Technologies from job: languages, frameworks, tools, databases"],
  "matching_skills": ["CAREFULLY check candidate skills list above. If job requires 'AWS' and candidate has 'AWS', it's a match. If job requires 'PostgreSQL' and candidate has 'PostgreSQL', it's a match. Be thorough."],
  "missing_skills": ["Only list skills job requires that candidate does NOT have in their skills list"],
  "match_percent": 0-100,
  "offered_salary": "from job or 'Not listed'",
  "suggested_salary": "MUST include currency code! Format: 'COP 10-15M/month' or 'USD 80-100K/year' or 'EUR 60-80K/year'. Estimate based on job country/city market rates. Use local currency unless job says otherwise.",
  "should_apply": true/false,
  "analysis": "2-3 sentences about skill match and gaps"
}

IMPORTANT: For matching_skills, carefully compare each required_skill with the candidate's skills list. The candidate's skills are listed above - check each one!`,
          },
          {
            role: "user",
            content: `CANDIDATE PROFILE:
Name: ${profile.name}
Title: ${profile.title}
Experience: ${profile.years_experience} years
Skills (CHECK THESE FOR MATCHING): ${profile.skills.join(", ")}

JOB POSTING:
${jobText}`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.error?.message || `API error: ${response.status}`
      );
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON from response
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [
      null,
      content,
    ];
    const analysis = JSON.parse(jsonMatch[1].trim());

    return { success: true, analysis };
  } catch (err) {
    console.error("analyzeJob error:", err);
    return { error: err.message || "Failed to analyze job" };
  }
}

async function generateCoverLetter(jobText, jobTitle) {
  try {
    const { profile } = await getSettings();

    if (!profile) {
      return { error: "No profile. Upload your CV in Settings first." };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Write a SHORT cover letter (3-4 paragraphs max, ~150-200 words). Be concise, professional, and genuine.

Structure:
1. Brief intro + enthusiasm for the role
2. 2-3 key relevant skills/experiences that match the job
3. Quick closer with call to action

Style: Confident but not arrogant. Specific but brief. No fluff or generic phrases like "I am writing to express my interest..." - get straight to the point.`,
          },
          {
            role: "user",
            content: `Write a cover letter for this position:

JOB: ${jobTitle}

JOB DESCRIPTION:
${jobText.substring(0, 4000)}

CANDIDATE:
Name: ${profile.name}
Title: ${profile.title}
Experience: ${profile.years_experience} years
Skills: ${profile.skills.join(", ")}
Background: ${profile.summary}`,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.error?.message || `API error: ${response.status}`
      );
    }

    const data = await response.json();
    const coverLetter = data.choices[0].message.content;

    return { success: true, coverLetter };
  } catch (err) {
    console.error("generateCoverLetter error:", err);
    return { error: err.message || "Failed to generate cover letter" };
  }
}

// Open settings on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});
