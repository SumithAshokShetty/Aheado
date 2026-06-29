import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
dotenv.config();

const app = express();
app.use(express.json());

// Multi-project Gemini API Key Rotation Array setup using all 8 keys in the Secrets panel
const keysPool = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8
].filter(Boolean) as string[];

let currentKeyIndex = 0;

// Initialize GoogleGenAI instances for each active key in the pool
const clientsPool = keysPool.map((key) => new GoogleGenAI({
  apiKey: key,
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
}));

function getGeminiClient() {
  if (clientsPool.length === 0) return null;
  return clientsPool[currentKeyIndex % clientsPool.length];
}

// 1. Natural Language Command Interface Endpoint with Active Key Rotation & Fallback
app.post("/api/proactive-ai/command", async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: "Command is required" });

  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const currentDateStr = now.toLocaleDateString('en-US', options); 
  const currentIsoStr = now.toISOString().split('T')[0];

  const promptText = `
  Analyze the user's workspace command: "${command}".
  Determine if this is a request to schedule a calendar event ("calendar") or send an email ("gmail"). If neither can be determined, classify as "unknown".
  Respond with strict raw JSON (no markdown wrapping) matching the following schema:
  {
    "type": "calendar" | "gmail" | "unknown",
    "calendar": {
      "summary": "Title of the calendar event",
      "description": "Details/notes for the event",
      "startTime": "ISO date-time string (use the current date ${currentIsoStr} as reference if relative words like 'tomorrow' or weekdays like 'tuesday' are used)",
      "endTime": "ISO date-time string (1 hour after startTime)"
    },
    "gmail": {
      "recipient": "recipient email address if provided (e.g., client@example.com), otherwise leave empty",
      "subject": "Appropriate subject line for the email",
      "body": "The text/body content of the email"
    }
  }
  Notes for date parsing:
  - Current local time context is: ${currentDateStr}.
  - If user says 'tomorrow at 3 PM', calculate the start time relative to ${currentIsoStr}.
  `;

  const totalKeys = keysPool.length;
  const maxAttempts = totalKeys > 0 ? totalKeys : 1;
  let lastError: any = null;

  // Active Key Rotation Loop
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const activeKey = keysPool.length > 0 ? keysPool[currentKeyIndex % keysPool.length] : (process.env.GEMINI_API_KEY || "");
      currentKeyIndex++; // Increment for key rotation on next call/attempt

      if (!activeKey) {
        throw new Error("No API keys found in pool or env");
      }

      const client = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const response = await client.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: promptText,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text?.trim() || "{}");
      return res.json({ ...parsed, isDemo: false }); // Success response

    } catch (err: any) {
      lastError = err;
      console.warn(`Command parsing failed on key attempt ${attempt + 1}/${maxAttempts}:`, err.message || err);
      // Loop continues to try the next key in the pool
    }
  }

  // Fallback to offline Regex parser if all API keys in the rotation pool are exhausted
  console.warn("All keys exhausted or rate-limited. Falling back to offline Regex parser.");
  try {
    const text = command.toLowerCase();
    const emailMatch = command.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    
    if (text.includes("email") || text.includes("mail") || emailMatch) {
      const recipient = emailMatch ? emailMatch[0] : "";
      return res.json({
        type: "gmail",
        gmail: {
          recipient: recipient,
          subject: "Command Dispatch Draft",
          body: `This is a pre-drafted message parsed from command: "${command}"`
        },
        isDemo: true
      });
    } else if (text.includes("schedule") || text.includes("calendar") || text.includes("book") || text.includes("meeting") || text.includes("appt")) {
      return res.json({
        type: "calendar",
        calendar: {
          summary: command.replace(/schedule|book|meeting|appointment|appt/gi, "").trim() || "New Event",
          description: `Scheduled via command: "${command}"`,
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T15:00:00",
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T16:00:00"
        },
        isDemo: true
      });
    }
    
    return res.json({ type: "unknown", message: "Fallback activated.", isDemo: true });
  } catch (fallbackErr) {
    return res.json({ type: "unknown", message: "Fallback failure.", isDemo: true });
  }
});

function getActualClassroomDeadlines(scenarioText: string): { title: string; course: string }[] {
  const deadlines: { title: string; course: string }[] = [];
  const lines = scenarioText.split("\n");
  let inClassroom = false;
  let currentCourse = "";
  let currentTitle = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes("GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES:")) {
      inClassroom = true;
      continue;
    }
    if (inClassroom && (trimmed.startsWith("LATEST CALENDAR EVENTS:") || trimmed.startsWith("LATEST INBOX EMAILS:") || trimmed.startsWith("Does this state present"))) {
      inClassroom = false;
    }

    if (inClassroom) {
      if (trimmed.startsWith("- COURSE:")) {
        if (currentTitle) {
          deadlines.push({ title: currentTitle, course: currentCourse });
        }
        currentCourse = trimmed.replace("- COURSE:", "").trim();
        currentTitle = "";
      } else if (trimmed.startsWith("TITLE:")) {
        currentTitle = trimmed.replace("TITLE:", "").trim();
      } else if (trimmed.startsWith("- TITLE:")) {
        currentTitle = trimmed.replace("- TITLE:", "").trim();
      } else if (trimmed.startsWith("-")) {
        const match = trimmed.match(/- "([^"]+)"| - ([^"]+)/);
        if (match) {
          const val = match[1] || match[2];
          if (val && !val.toLowerCase().startsWith("course:") && !val.toLowerCase().startsWith("title:")) {
            deadlines.push({ title: val, course: "" });
          }
        }
      }
    }
  }
  if (currentTitle) {
    deadlines.push({ title: currentTitle, course: currentCourse });
  }
  return deadlines;
}

function sanitizeResultResources(result: any, scenarioText: string) {
  if (result && Array.isArray(result.recommended_resources)) {
    const actualDeadlines = getActualClassroomDeadlines(scenarioText);
    const sanitized: any[] = [];

    for (const res of result.recommended_resources) {
      if (!res || typeof res !== "object") continue;
      const title = String(res.title || "");
      const url = String(res.url || "");
      const creator = String(res.creator_name || "");
      if (!title || !url || title.toLowerCase().includes("[topic]") || url.toLowerCase().includes("[url-encoded")) {
        continue;
      }

      const titleLower = title.toLowerCase();
      const urlLower = url.toLowerCase();
      const creatorLower = creator.toLowerCase();

      // Ensure the resource matches at least one of the actual classroom deadlines
      if (actualDeadlines.length === 0) {
        // If there are no dynamic classroom deadlines, we do not show any academic resources
        continue;
      }

      let isMatched = false;
      for (const dl of actualDeadlines) {
        const dlTitleLower = dl.title.toLowerCase();
        const dlCourseLower = dl.course.toLowerCase();

        // Direct matching
        if (titleLower.includes(dlTitleLower) || urlLower.includes(dlTitleLower) || creatorLower.includes(dlTitleLower)) {
          isMatched = true;
          break;
        }
        if (dlCourseLower && (titleLower.includes(dlCourseLower) || urlLower.includes(dlCourseLower) || creatorLower.includes(dlCourseLower))) {
          isMatched = true;
          break;
        }

        // Word/keyword matching
        const stopWords = new Set(["and", "the", "to", "for", "of", "in", "chapter", "introduction", "a", "an", "on", "with", "at", "by", "from", "tutorials", "on", "youtube", "review"]);
        const dlTitleWords = dlTitleLower.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stopWords.has(w));
        const dlCourseWords = dlCourseLower.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stopWords.has(w));

        for (const word of [...dlTitleWords, ...dlCourseWords]) {
          if (titleLower.includes(word) || urlLower.includes(word) || creatorLower.includes(word)) {
            isMatched = true;
            break;
          }
        }
        if (isMatched) break;
      }

      if (!isMatched) {
        continue;
      }

      // Also filter out standard template forbidden keywords if they do not match
      let isHallucinated = false;
      const forbidKeywords = ["phys", "phyi", "phyc", "quantum", "chemistry", "midterm", "machine learning", "linear algebra"];
      for (const kw of forbidKeywords) {
        if (titleLower.includes(kw) && !scenarioText.toLowerCase().includes(kw)) {
          isHallucinated = true;
          break;
        }
      }
      if (isHallucinated) continue;

      sanitized.push(res);
    }

    result.recommended_resources = sanitized;
  }
}

function sanitizeResultIntercepts(result: any, scenarioText: string) {
  if (result && Array.isArray(result.intercepts)) {
    const scenarioLower = scenarioText.toLowerCase();
    const actualDeadlines = getActualClassroomDeadlines(scenarioText);

    const sanitized: any[] = [];
    for (const intercept of result.intercepts) {
      if (!intercept || typeof intercept !== "object") continue;
      let title = String(intercept.title || "");
      let desc = String(intercept.description || "");
      const isConflict = !!intercept.isConflictOption;

      const titleLower = title.toLowerCase();
      const descLower = desc.toLowerCase();
      const categoryLower = (intercept.category || "").toLowerCase();
      const actionLower = (intercept.actionTaken || "").toLowerCase();

      // Identify coursework/assignment-related intercepts
      const isCoursework = categoryLower === "assignment" || 
                           titleLower.includes("classroom") || 
                           titleLower.includes("assignment") ||
                           titleLower.includes("coursework") ||
                           descLower.includes("classroom") || 
                           descLower.includes("assignment") ||
                           descLower.includes("coursework") ||
                           actionLower.includes("classroom") ||
                           actionLower.includes("assignment") ||
                           actionLower.includes("coursework");

      if (isCoursework) {
        if (actualDeadlines.length === 0) {
          // No dynamic assignments present, so drop all coursework shields!
          continue;
        }

        let isMatched = false;
        for (const dl of actualDeadlines) {
          const dlTitleLower = dl.title.toLowerCase();
          const dlCourseLower = dl.course.toLowerCase();

          if (titleLower.includes(dlTitleLower) || descLower.includes(dlTitleLower)) {
            isMatched = true;
            break;
          }
          if (dlCourseLower && (titleLower.includes(dlCourseLower) || descLower.includes(dlCourseLower))) {
            isMatched = true;
            break;
          }

          // Keyword matches
          const stopWords = new Set(["and", "the", "to", "for", "of", "in", "chapter", "introduction", "a", "an", "on", "with", "at", "by", "from"]);
          const dlTitleWords = dlTitleLower.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stopWords.has(w));
          const dlCourseWords = dlCourseLower.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stopWords.has(w));

          for (const word of [...dlTitleWords, ...dlCourseWords]) {
            if (titleLower.includes(word) || descLower.includes(word)) {
              isMatched = true;
              break;
            }
          }
          if (isMatched) break;
        }

        if (!isMatched) {
          // Drop hallucinated or non-dynamic coursework shields
          continue;
        }
      }

      // Rename calendar conflicts if they contain hallucinated keywords
      const forbidKws = ["phys", "phyi", "phyc", "quantum", "chemistry", "midterm"];
      const hasForbid = forbidKws.some(kw => titleLower.includes(kw));

      if (hasForbid) {
        const actualMention = forbidKws.some(kw => scenarioLower.includes(kw));
        if (!actualMention) {
          if (isConflict) {
            intercept.title = title.replace(/phys|phyi|phyc|quantum|chemistry|midterm/gi, "Workspace Event");
            intercept.description = desc.replace(/phys|phyi|phyc|quantum|chemistry|midterm/gi, "Workspace Event");
          } else {
            // Coursework shield that didn't match: map to first available dynamic deadline if it somehow got through
            if (actualDeadlines.length > 0) {
              const firstDl = actualDeadlines[0].title;
              intercept.title = `PRIORITIZE ${firstDl.toUpperCase()}`;
              intercept.description = `${firstDl} is due. A focus block is scheduled to maximize preparation.`;
              if (intercept.outputDraft) {
                intercept.outputDraft = intercept.outputDraft.replace(/phys|phyi|phyc|quantum|chemistry|midterm/gi, firstDl);
              }
            } else {
              continue;
            }
          }
        }
      }
      sanitized.push(intercept);
    }
    result.intercepts = sanitized;
  }
}

// 2. Multi-Agent Orchestration Proxy Endpoint (Calls your Python ADK Core)
app.post("/api/proactive-ai/evaluate", async (req, res) => {
  const { scenario, currentTime, userProfile } = req.body;
  if (!scenario) return res.status(400).json({ success: false, error: "Scenario is required" });

  const systemTimestamp = currentTime || new Date().toLocaleString("en-US", { hour12: true });

  try {
    // Select the next API key from the rotation pool
    const rotatedKey = keysPool.length > 0 ? keysPool[currentKeyIndex % keysPool.length] : (process.env.GEMINI_API_KEY || "");
    currentKeyIndex++; // Increment rotation counter

    // Forward the context directly to the Google ADK Multi-Agent pipeline
    const { stdout } = await execPromise("python3 python_core/orchestrator.py", {
      env: { 
        ...process.env, 
        AHEADO_CRISIS_INPUT: scenario,
        CURRENT_SYSTEM_TIMESTAMP: systemTimestamp,
        AHEADO_USER_PROFILE: JSON.stringify(userProfile || { name: "Sumith Shetty", email: "sumithshetty451@gmail.com" }),
        GEMINI_API_KEYS: keysPool.join(','),
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        GOOGLE_APPLICATION_CREDENTIALS: path.join(process.cwd(), 'python_core/credentials/service-account.json')
      },
      timeout: 60000
    });
    
    const result = JSON.parse(stdout.trim());
    console.log("DEBUG: Python result:", result);
    
    // Transform Python result to include intercepts if verification_card exists and intercepts is not already provided
    if (result.verification_card && !result.intercepts) {
        result.intercepts = (result.verification_card.actions || []).map((action: any) => ({
            id: action.event_id || "generated_intercept",
            isConflictOption: true,
            title: action.label || "Action Required",
            description: result.summary || "Action staged for review.",
            category: "calendar",
            resolutionTarget: "A",
            eventImportance: 95,
            action_type: action.action_type || "APPROVE"
        }));
    }
    
    // Sanitize recommended_resources to remove prompt template hallucinations
    sanitizeResultResources(result, scenario);
    sanitizeResultIntercepts(result, scenario);
    
    return res.json({ success: true, isPythonEngine: true, ...result });
  } catch (error: any) {
    console.error("[Gateway Alert] Python ADK pipeline failed/crashed:", error.message || error);
    if (error.stderr) console.error("[Gateway Alert] Python ADK stderr:", error.stderr);
    if (error.stdout) console.error("[Gateway Alert] Python ADK stdout:", error.stdout);
    
    // Attempt robust, dynamic Node-side Gemini fallback parsing to run the agents directly in the Node.js layer
    try {
      console.log("[Gateway] Attempting robust Node-side Gemini fallback parser...");
      
      const totalKeys = keysPool.length;
      const maxAttempts = totalKeys > 0 ? totalKeys : 1;
      let nodeResult: any = null;

      // Try running the pipeline directly inside Node.js using our Gemini clients pool
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const activeKey = keysPool.length > 0 ? keysPool[currentKeyIndex % keysPool.length] : (process.env.GEMINI_API_KEY || "");
          currentKeyIndex++;

          if (!activeKey) {
            throw new Error("No API keys found in pool or env");
          }

          const client = new GoogleGenAI({
            apiKey: activeKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });

          // 1. Predict optimal route
          const routePrompt = `
          Analyze the following crisis scenario and route it to the appropriate skill:
          Scenario: ${scenario}
          
          Available skills:
          - "deadline_negotiator": For managing deadlines, overlaps, and extension requests.
          - "bill_autopilot": For managing payments, invoices, and financial thresholds.
          
          Respond with strict raw JSON matching the required parameters:
          {
              "selected_skill": "deadline_negotiator" | "bill_autopilot",
              "confidence_score": 1.0,
              "justification": "string",
              "arguments": {}
          }
          `;

          const routeResponse = await client.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: routePrompt,
            config: { responseMimeType: "application/json" }
          });

          const routeData = JSON.parse(routeResponse.text?.trim() || "{}");
          const selectedSkill = routeData.selected_skill || "deadline_negotiator";

          if (selectedSkill === "bill_autopilot") {
            // 2. Parse bill info
            const billPrompt = `
            Extract the bill details from the scenario: "${scenario}".
            Respond with strict raw JSON matching the required parameters:
            {
                "bill_title": "string (name of the bill provider, e.g., 'AWS Hosting')",
                "amount": float (total bill amount in Rupees),
                "due_date": "string (due date or timeframe)"
            }
            `;

            const billResponse = await client.models.generateContent({
              model: "gemini-2.5-flash-lite",
              contents: billPrompt,
              config: { responseMimeType: "application/json" }
            });

            const billData = JSON.parse(billResponse.text?.trim() || "{}");
            const amount = parseFloat(billData.amount || "0");
            const bill_title = billData.bill_title || "Subscription Provider";
            const due_date = billData.due_date || "Soon";
            const spend_cap = 5000.0;
            const event_id = `evt_bill_settle_${Math.random().toString(36).substring(2, 10)}`;
            
            // Simpler, robust token emulation without complex library deps
            const ap2_token = Array.from(event_id + amount.toString())
              .reduce((acc, char) => acc + char.charCodeAt(0), 0)
              .toString(16)
              .padEnd(16, "f")
              .substring(0, 16);

            if (amount > spend_cap) {
              nodeResult = {
                status: "AP2_BLOCKED",
                message: `Transaction amount of ₹${amount.toFixed(2)} exceeds your standard AP2 Token Gate safety threshold of ₹${spend_cap.toFixed(2)}.`,
                requires_hitl: true,
                verification_card: {
                  ui_component: "TokenGateModal",
                  title: `💳 AP2 Limit Warning: Blocked payment to '${bill_title}'`,
                  severity: "CRITICAL",
                  bill_title,
                  amount,
                  ap2_token,
                  warning_message: `The requested charge of ₹${amount.toFixed(2)} violates the standard Aheado automated spending safety boundary.`,
                  actions: [
                    { label: "Bypass & Process Payment", event_id, action_type: "APPROVE" }
                  ]
                }
              };
            } else {
              nodeResult = {
                status: "APPROVED",
                message: `Transaction of ₹${amount.toFixed(2)} to '${bill_title}' approved under safety threshold.`,
                requires_hitl: false,
                ap2_token
              };
            }
          } else {
            const profile = userProfile || { name: "Sumith Shetty", email: "sumithshetty451@gmail.com" };
            const uName = profile.name || "Sumith Shetty";
            const uEmail = profile.email || "sumithshetty451@gmail.com";

            // 3. Run deadline negotiator skill directly
            const negotiatorPrompt = `
            You are Aheado Proactive Agent Core. Analyze the following user crisis scenario:
            "${scenario}"
            
            CURRENT SYSTEM TIMESTAMP (Unified Date & Time Anchor Floor):
            "${systemTimestamp}"

            GLOBAL USER IDENTITY CONTEXT:
            - User Name: ${uName}
            - User Email: ${uEmail}

            STRUCTURAL FIELD SYNCHRONIZATION AND DATA EXTRACTION CONSTRAINTS:
            1. DYNAMIC INBOUND METADATA BINDING:
               - You MUST actively inspect the header metadata attributes of the incoming alert or communication string provided in the execution context payload.
               - Locate the explicit source identity parameter (e.g., the sender or author identifier/email) from the primary ingestion stream.
               - Extract that exact original sender identity string and map it directly into the "recipientEmail" (the "To:" recipient destination field) for all generated strategy configurations, ensuring emails are addressed to the true origin party. Do NOT leave dummy text or placeholder variables in "recipientEmail".
            2. LOGICAL CROSS-FIELD TEXT INJECTION:
               - You are STRICTLY PROHIBITED from generating bracketed text placeholders (e.g., [EVENT NAME A], [EVENT NAME B], [TIME A], [TIME B], [Recipient], [Your Name], etc.) or dummy variables anywhere inside the human-readable email body string "outputDraft" or any other field.
               - You must dynamically read the exact date and time value tokens resolved by your calendar checking layer for the active strategy track (the recommendedDate and recommendedTime).
               - Inject those identical resolved date and time variable strings seamlessly into the corresponding text segments within the generated email body message block ("outputDraft"). All events and recipients MUST be fully resolved to real values matching the scenario text.
            3. DYNAMIC PROFILE SIGN-OFF:
               - You MUST read the global user identity variables (User Name: ${uName}, User Email: ${uEmail}) injected into the runtime environment context to sign off the message body ("outputDraft") naturally, entirely eliminating placeholder sign-off brackets like [Your Name] or [Your Name/Email].

            TEMPORAL CHRONOLOGY & DATE-TIME BOUNDARY CONSTRAINTS:
            1. UNIFIED DATETIME CHRONOLOGY ENFORCEMENT:
               - You MUST treat the "CURRENT SYSTEM TIMESTAMP" as a strict chronological floor boundary (representing BOTH date and time together).
               - Every proposed alternative slot (including "recommendedDate" and "recommendedTime" in conflict option A/B) MUST evaluate as strictly greater than (in the future of) this system timestamp anchor. Proposing a past time on a current date or an entirely past date is a critical system failure. Do NOT make slots in the past.
            2. BOUNDARY ROLLOVER LOGIC:
               - You MUST perform real calendar and clock math: If the current system time is near or past the end of the standard business day (5:00 PM) on the current date, you MUST automatically increment the date calendar forward to the next logical business day or future target week.
               - Proposing an alternative slot requires calculating forward vectors along a true chronological timeline where both date progression and hourly progression change dynamically based on the input context.
               - Ensure that the suggested rescheduled date is always in the format "YYYY-MM-DD" and the time is in the format "HH:MM" (24-hour) or standard "HH:MM AM/PM" format, and must represent a logical future moment.

            CRITICAL RULE FOR ASSIGNMENTS & DEADLINES:
            1. Do NOT consider Google Classroom deadlines, assignments, or coursework as conflicts or clashes with calendar events or emails. 
            2. Only identify and generate rescheduling conflict options (with "isConflictOption": true, e.g. option a/b) for direct conflicts between Google Calendar events and Gmail schedule requests.
            3. If and only if there are actual Google Classroom deadlines or coursework assignments listed in the "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES" section of the scenario text, you MUST append a coursework assignment shield object (with "isConflictOption": false) for EACH real coursework assignment to the "intercepts" array.
            4. You MUST ONLY extract and use the exact title, course name, and due date of the coursework assignments found under the "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES" section of the scenario text. Do NOT invent, make up, or hallucinate any coursework titles or details that are not explicitly present under that section.
            5. If there are no coursework assignments listed under the "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES" section, the intercepts list must ONLY contain the calendar conflict options, with exactly ZERO assignment shields.
            6. STRICT NEGATIVE DIRECTIVE: You are strictly forbidden from creating a mock or hallucinated coursework assignment shields. If there are no assignments under the "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES" section, you MUST NOT generate any assignment shield. Do NOT make up, invent, prefill, or reference any default or mock subjects (like physics, math, or chemistry) unless they are explicitly present in the incoming student deadlines.
            
            STUDY OUTLINE STEP DECOUPLING RULES:
            1. You are strictly forbidden from copy-pasting the exact coursework title for both Step 1 and Step 2 of the "outputDraft" study outline.
            2. Instead, you MUST dynamically generate 2-3 distinct, logical, and practical sequential milestone tasks/sub-tasks customized for the specific assignment's subject matter (e.g., 'Step 1: Outlining and core concepts review', 'Step 2: Practical implementation and problem-solving', 'Step 3: Verification and final compilation').

            RESOURCE ACCELERATION & EDUCATIONAL ASSISTANCE RULES:
            1. DYNAMIC TOP-TIER CREATOR EXTRACTION:
               - Analyze the parsed domain, metadata, and core subject of the incoming assignment or workspace crisis (e.g., Machine Learning, Organic Chemistry, Linear Algebra, Project Management, Computer Science, Economics). Do NOT assume, prefill, or reference any default subject if no academic topic or homework is mentioned in the input text.
               - Instead of using a fixed list, dynamically retrieve from your own pre-trained knowledge base the top 2 most authoritative, globally trusted, and highly rated educational creators or channels for that specific technical domain (for example, if Machine Learning, creators like "StatQuest" or "3Blue1Brown"; if Chemistry, creators like "The Organic Chemistry Tutor" or "CrashCourse"; if Project Management, creators like "Adriana Girdler" or "Google Career Certificates").
            2. STRUCTURED LINK CONFIGURATION SCHEMA:
               - For each of the top 2 extracted creators, format a tightly scoped, URL-encoded YouTube search query string focusing on the specific chapter or topic title combined with the creator's name.
               - Format: \`https://www.youtube.com/results?search_query=[URL-encoded+Topic+Name]+[URL-encoded+Dynamically+Extracted+Creator+Name]\`
            3. TRANSACTIONAL STATE SYNC:
               - You MUST output these exact dynamic resources consistently across both payload outputs:
                 A. Within the "recommended_resources" JSON array as objects containing "title", "creator_name", and "url".
                 B. Appended cleanly as a matching postscript at the very bottom of the generated email body string "outputDraft" (in BOTH conflict options and coursework assignment shields if they relate to academic tasks):
                    "PS: To clear this blocker quickly, review these highly rated concept breakdowns on YouTube:
                    - [Topic Title] by [Creator A Name]: [Link A]
                    - [Topic Title] by [Creator B Name]: [Link B]"
            4. If there are NO academic tasks, coursework assignments, or project crises in the scenario (i.e., only professional meetings/emails with no educational content), generate an empty array \`[]\` for "recommended_resources".

            We need to generate a structured recovery payload to decouple the user's schedule. 
            Your response must be strict JSON matching this schema:
            {
                "status": "DRAFT_STAGED",
                "summary": "A detailed synthesis paragraph describing the user's high-pressure situation, assignments due, and the specific calendar conflicts detected.",
                "intercepts": [
                    {
                        "id": "int-calendar-option-a",
                        "isConflictOption": true,
                        "title": "RESCHEDULE [EVENT NAME A] (OPTION A)",
                        "description": "Your [EVENT NAME A] at [TIME A] directly conflicts with [EVENT NAME B]. This option proposes rescheduling [EVENT NAME A].",
                        "category": "calendar",
                        "resolutionTarget": "A",
                        "eventImportance": 60,
                        "action_type": "APPROVE",
                        "eventName": "EVENT NAME A",
                        "recipientEmail": "Extract the actual email of the sender of the conflicting/rescheduling email from the scenario text (e.g., hr@globaltech.com or interviewer@techcorp.com). If no email is mentioned in the text, use a realistic one like advisor@aheado.io or similar, but NEVER use a generic placeholder like recruiting@example.com if a real/sender email is present in the scenario text.",
                        "actionTaken": "Drafted an email to propose rescheduling the event.",
                        "outputDraft": "Subject: Request to Reschedule [EVENT NAME A] - [Your Name]\\n\\nDear [Recipient],\\n\\nI have a conflict due to [EVENT NAME B]... Could we reschedule?\\n\\nBest,\\n[Your Name]",
                        "recommendedDate": "YYYY-MM-DD (must be dynamically calculated logical future date strictly > CURRENT SYSTEM TIMESTAMP)",
                        "recommendedTime": "HH:MM (must be dynamically calculated logical future time strictly > CURRENT SYSTEM TIMESTAMP)"
                    },
                    {
                        "id": "int-calendar-option-b",
                        "isConflictOption": true,
                        "title": "RESCHEDULE [EVENT NAME B] (OPTION B)",
                        "description": "Your [EVENT NAME B] at [TIME B] directly conflicts with [EVENT NAME A]. This option proposes rescheduling [EVENT NAME B].",
                        "category": "calendar",
                        "resolutionTarget": "B",
                        "eventImportance": 98,
                        "action_type": "APPROVE",
                        "eventName": "EVENT NAME B",
                        "recipientEmail": "Extract the actual email of the sender of the conflicting/rescheduling email from the scenario text (e.g., hr@globaltech.com or interviewer@techcorp.com). If no email is mentioned in the text, use a realistic one like team@aheado.io or similar, but NEVER use a generic placeholder like recruiting@example.com if a real/sender email is present in the scenario text.",
                        "actionTaken": "Drafted an email to propose rescheduling the event.",
                        "outputDraft": "Subject: Request to Reschedule [EVENT NAME B] - [Your Name]\\n\\nDear [Recipient],\\n\\nI have a conflict due to [EVENT NAME A]... Could we reschedule?\\n\\nBest,\\n[Your Name]",
                        "recommendedDate": "YYYY-MM-DD (must be dynamically calculated logical future date strictly > CURRENT SYSTEM TIMESTAMP)",
                        "recommendedTime": "HH:MM (must be dynamically calculated logical future time strictly > CURRENT SYSTEM TIMESTAMP)"
                    }
                ],
                "recommended_resources": [
                    {
                        "title": "Review [TOPIC] Tutorials on YouTube",
                        "creator_name": "Dynamically Extracted Creator Name",
                        "url": "https://www.youtube.com/results?search_query=[URL-Encoded+Topic]+[URL-Encoded+Creator+Name]"
                    }
                ],
                "verification_card": {
                    "ui_component": "DraftApprovalCard",
                    "title": "🛡️ Calendar Decoupling Options Generated",
                    "severity": "CRITICAL",
                    "actions": [
                        {"label": "Approve Rescheduling Option A", "event_id": "int-calendar-option-a", "action_type": "APPROVE"},
                        {"label": "Approve Rescheduling Option B", "event_id": "int-calendar-option-b", "action_type": "APPROVE"}
                    ]
                }
            }

            If there are coursework assignments in "GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES", append them to the "intercepts" array using this exact format structure:
            {
                "id": "shield-assignment-[unique-slug-or-id]",
                "isConflictOption": false,
                "title": "PRIORITIZE [EXACT COURSEWORK TITLE FROM SCENARIO]",
                "category": "assignment",
                "urgency": "CRITICAL",
                "description": "[EXACT COURSEWORK TITLE FROM SCENARIO] is due at [DUE TIME FROM SCENARIO]. A focus block is scheduled to maximize preparation.",
                "actionTaken": "Blocked a focus session and drafted a reminder.",
                "outputDraft": "📚 STUDY OUTLINE:\\n- [Logical, distinct, practical Step 1 customized to coursework subject, e.g. Outlining and resource assembly]\\n- [Logical, distinct, practical Step 2 customized to coursework subject, e.g. Core content creation and problem solving]\\n- [Logical, distinct, practical Step 3 customized to coursework subject, e.g. Verification, review and submission]\\n\\nPS: To clear this blocker quickly, review these highly rated concept breakdowns on YouTube:\\n- [EXACT COURSEWORK TITLE] by [Creator A Name]: [URL-Encoded Link A]\\n- [EXACT COURSEWORK TITLE] by [Creator B Name]: [URL-Encoded Link B]",
                "sprintBreakdown": "⏱️ Suggested Sprint Breakdown:\\n• 00-30 mins: Read Guidelines & Research Requirements\\n• 30-90 mins: Solve core problems & draft structural points\\n• 90-120 mins: Assemble final review and submit coursework"
            }

            Ensure all fields are dynamically populated and specifically customized for the input scenario text. Do not wrap in markdown or add notes outside the JSON block. Return valid JSON only.
            `;

            const negotiatorResponse = await client.models.generateContent({
              model: "gemini-2.5-flash-lite",
              contents: negotiatorPrompt,
              config: { responseMimeType: "application/json" }
            });

            nodeResult = JSON.parse(negotiatorResponse.text?.trim() || "{}");
          }

          if (nodeResult) {
            // Transform nodeResult to include intercepts if verification_card exists and intercepts is not already provided
            if (nodeResult.verification_card && !nodeResult.intercepts) {
              nodeResult.intercepts = (nodeResult.verification_card.actions || []).map((action: any) => ({
                id: action.event_id || "generated_intercept",
                isConflictOption: true,
                title: action.label || "Action Required",
                description: nodeResult.summary || "Action staged for review.",
                category: selectedSkill === "bill_autopilot" ? "bill" : "calendar",
                resolutionTarget: "A",
                eventImportance: 95,
                action_type: action.action_type || "APPROVE"
              }));
            }

            // Sanitize recommended_resources to remove prompt template hallucinations
            sanitizeResultResources(nodeResult, scenario);
            sanitizeResultIntercepts(nodeResult, scenario);

            console.log("[Gateway] Node fallback pipeline successfully evaluated the scenario!");
            return res.json({ success: true, isPythonEngine: false, isNodeGeminiFallback: true, ...nodeResult });
          }
        } catch (nodeErr: any) {
          console.warn(`Node fallback key attempt ${attempt + 1}/${maxAttempts} failed:`, nodeErr.message || nodeErr);
        }
      }
    } catch (fallbackPipelineErr: any) {
      console.error("[Gateway] Robust Node fallback pipeline itself failed:", fallbackPipelineErr.message || fallbackPipelineErr);
    }

    // Tertiary Aligned Resilient Fallback Middleware (Offline Rupee-compliant AP2 and A2UI standards)
    const textLower = scenario.toLowerCase();
    const isBill = textLower.match(/(bill|invoice|pay|charge|fee|cost)/);
    
    return res.json({
      success: true,
      isPythonEngine: false,
      status: "RECOVERY_MODE",
      riskScore: 95,
      summary: isBill ? "Aheado AP2 autopilot has staged a payment threshold check." : "Aheado deadline negotiator has prepared a draft extension email.",
      intercepts: [
        {
          id: "recovery_intercept_1",
          isConflictOption: true,
          title: isBill ? "Process Payment" : "Propose New Deadline",
          description: isBill ? "AP2 has flagged a payment threshold violation." : "Deadline negotiator has prepared a draft extension request.",
          category: isBill ? "bill" : "calendar",
          resolutionTarget: "A",
          eventImportance: 95,
          action_type: "APPROVE"
        }
      ],
      routing: { selected_skill: isBill ? "bill_autopilot" : "deadline_negotiator" },
      execution: {
        requires_hitl: true,
        verification_card: {
          ui_component: isBill ? "TokenGateModal" : "DraftApprovalCard",
          title: isBill ? "💳 AP2 Protocol: Critical Threshold Check" : "🛡️ Deadline Negotiation Required",
          severity: "CRITICAL",
          actions: isBill 
            ? [
                { label: "Authorize AP2 ₹5000+ Payment", event_id: "hitl_approve_recovery", action_type: "APPROVE" },
                { label: "Cancel Stream", event_id: "hitl_cancel_recovery", action_type: "CANCEL" }
              ]
            : [
                { label: "Approve Deadline Draft", event_id: "hitl_approve_draft", action_type: "APPROVE" },
                { label: "Modify Content", event_id: "hitl_edit_draft", action_type: "EDIT" }
              ]
        }
      }
    });
  }
});

// Serve static assets and connect Vite middleware
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Aheado Gateway Server] Running smoothly on port ${PORT}`);
  });
}

setupFrontend();
