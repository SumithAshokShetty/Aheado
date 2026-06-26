import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

dotenv.config();

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
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}));

function repairTruncatedJson(str: string): string {
  let inString = false;
  let isEscaped = false;
  const stack: ("{" | "[")[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        stack.push("{");
      } else if (char === "[") {
        stack.push("[");
      } else if (char === "}") {
        if (stack.length > 0 && stack[stack.length - 1] === "{") {
          stack.pop();
        }
      } else if (char === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === "[") {
          stack.pop();
        }
      }
    }
  }

  let repaired = str;
  if (inString) {
    if (isEscaped) {
      repaired = repaired.slice(0, -1);
    }
    repaired += '"';
  }

  while (stack.length > 0) {
    const last = stack.pop();
    if (last === "{") {
      repaired += "}";
    } else if (last === "[") {
      repaired += "]";
    }
  }

  repaired = repaired.replace(/,\s*([}\]])/g, "$1");
  repaired = repaired.replace(/:\s*([}\]])/g, ": null$1");
  repaired = repaired.trim().replace(/,$/, "");

  return repaired;
}

function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  
  // Strip markdown codeblock wraps if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "");
    cleaned = cleaned.replace(/\n?```$/, "");
    cleaned = cleaned.trim();
  }
  
  // Normalize carriage returns to standard newlines
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Escape literal backslashes that are not already part of valid JSON escapes
  // This matches any backslash that is not followed by ", \, /, b, f, n, r, t, or uXXXX
  cleaned = cleaned.replace(/\\(?!["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
  
  // Self-repair any truncation or unclosed elements in the JSON output
  cleaned = repairTruncatedJson(cleaned);
  
  // Clean up trailing commas in objects and arrays before closing delimiters
  cleaned = cleaned.replace(/,(\s*[\]}])/g, "$1");
  
  return cleaned;
}

function getGeminiClient() {
  if (clientsPool.length === 0) {
    console.warn("No GEMINI_API_KEYS are defined in the environment. AI features will run in mock demonstration mode.");
    return null;
  }
  return clientsPool[currentKeyIndex % clientsPool.length];
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Helper to generate a highly dynamic, relevant evaluation response
  // Helper to generate a highly dynamic, relevant evaluation response without hardcoded pattern-matching
  const generateDynamicEvaluation = (scenario: string, tasks: any[]) => {
    const textLower = (scenario || "").toLowerCase();
    
    let eventAName = "";
    let eventBName = "";
    let hasCalendarConflict = false;
    let eventImportanceA = 70;
    let eventImportanceB = 85;
    let clashingTimeStr = "";
    let recipientEmailA = "colleague@workspace-sync.com";
    let recipientEmailB = "external-contact@workspace-sync.com";
    let draftA = "";
    let draftB = "";

    const parsedEvents: { summary: string; start: string; end: string }[] = [];
    const parsedEmails: { from: string; subject: string; snippet: string }[] = [];

    // Parse workspace lines dynamically
    const lines = scenario.split("\n");
    let inCalendar = false;
    let inEmails = false;
    let currentEmail: any = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toUpperCase().includes("ACTIVE CALENDAR EVENTS:")) {
        inCalendar = true;
        inEmails = false;
        continue;
      }
      if (trimmed.toUpperCase().includes("LATEST INBOX EMAILS:")) {
        inCalendar = false;
        inEmails = true;
        continue;
      }
      if (trimmed.startsWith("Does this state present") || trimmed.startsWith("[")) {
        inCalendar = false;
        inEmails = false;
        continue;
      }

      if (inCalendar && (trimmed.startsWith("-") || trimmed.startsWith("*"))) {
        const match = trimmed.match(/^[-\*]\s*"(.*?)"\s+from\s+(\S+)\s+to\s+(\S+)/i);
        if (match) {
          parsedEvents.push({
            summary: match[1],
            start: match[2].trim(),
            end: match[3].trim()
          });
        }
      }

      if (inEmails) {
        if (trimmed.toUpperCase().startsWith("- FROM:") || trimmed.toUpperCase().startsWith("* FROM:")) {
          if (currentEmail) {
            parsedEmails.push(currentEmail);
          }
          currentEmail = {
            from: trimmed.replace(/^[-\*]\s*FROM:/i, "").trim(),
            subject: "",
            snippet: ""
          };
        } else if (trimmed.toUpperCase().startsWith("SUBJECT:")) {
          if (currentEmail) {
            currentEmail.subject = trimmed.replace(/^SUBJECT:/i, "").trim();
          }
        } else if (trimmed.toUpperCase().startsWith("SNIPPET:")) {
          if (currentEmail) {
            currentEmail.snippet = trimmed.replace(/^SNIPPET:/i, "").trim();
          }
        }
      }
    }
    if (currentEmail) {
      parsedEmails.push(currentEmail);
    }

    // If parsing block failed to find anything, try regex search on entire text
    if (parsedEvents.length === 0) {
      const eventRegex = /[-\*]\s*"(.*?)"\s+from\s+(\S+)\s+to\s+(\S+)/gi;
      let match;
      while ((match = eventRegex.exec(scenario)) !== null) {
        parsedEvents.push({
          summary: match[1],
          start: match[2].trim(),
          end: match[3].trim()
        });
      }
    }

    // Helper to parse time from a string relative to the current local date
    const parseProposedTime = (text: string): Date | null => {
      const textLower = text.toLowerCase();
      const baseDate = new Date(); // Current local time
      let targetDate = new Date(baseDate.getTime());
      
      if (textLower.includes("tomorrow")) {
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (textLower.includes("yesterday")) {
        targetDate.setDate(targetDate.getDate() - 1);
      } else {
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        let foundDayIndex = -1;
        for (let i = 0; i < days.length; i++) {
          if (textLower.includes(days[i])) {
            foundDayIndex = i;
            break;
          }
        }
        if (foundDayIndex !== -1) {
          const currentDay = targetDate.getDay();
          let daysToAdd = foundDayIndex - currentDay;
          if (daysToAdd <= 0) {
            daysToAdd += 7;
          }
          targetDate.setDate(targetDate.getDate() + daysToAdd);
        }
      }

      let hours = 12;
      let minutes = 0;
      let timeFound = false;

      // 24-hour style: e.g. "14:30" or "(14:30)" or "at 14:30"
      const match24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if (match24) {
        hours = parseInt(match24[1], 10);
        minutes = parseInt(match24[2], 10);
        timeFound = true;
      } else {
        // 12-hour style: e.g. "2:30 PM", "5 PM", "11:00 AM"
        const match12 = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
        if (match12) {
          let h = parseInt(match12[1], 10);
          const m = match12[2] ? parseInt(match12[2], 10) : 0;
          const ampm = match12[3].toLowerCase();
          if (ampm === "pm" && h < 12) {
            h += 12;
          } else if (ampm === "am" && h === 12) {
            h = 0;
          }
          hours = h;
          minutes = m;
          timeFound = true;
        }
      }

      if (!timeFound) {
        return null;
      }

      targetDate.setHours(hours, minutes, 0, 0);
      return targetDate;
    };

    // Helper to check for temporal overlaps
    const isOverlapping = (proposedTime: Date, startStr: string, endStr: string) => {
      const proposed = proposedTime.getTime();
      const start = new Date(startStr).getTime();
      const end = new Date(endStr).getTime();
      if (isNaN(proposed) || isNaN(start) || isNaN(end)) return false;
      const proposedEnd = proposed + 60 * 60 * 1000; // Default 1 hour duration
      return Math.max(proposed, start) < Math.min(proposedEnd, end);
    };

    // Evaluate overlaps dynamically
    let foundClash = false;
    for (const email of parsedEmails) {
      const proposedTime = parseProposedTime(email.snippet) || parseProposedTime(email.subject);
      if (!proposedTime) continue;

      for (const evt of parsedEvents) {
        // Skip general reminder-like keywords
        if (evt.summary.toLowerCase().includes("birthday")) {
          continue;
        }

        if (isOverlapping(proposedTime, evt.start, evt.end)) {
          eventAName = evt.summary;
          eventBName = email.subject || "Proposed Meeting";
          hasCalendarConflict = true;
          foundClash = true;

          // Extract email address or default safely
          const emailMatch = email.from.match(/<(.*?)>/);
          recipientEmailB = emailMatch ? emailMatch[1] : email.from;
          if (!recipientEmailB || recipientEmailB.includes("FROM:") || recipientEmailB.includes("@workspace-sync")) {
            recipientEmailB = "external-contact@workspace-sync.com";
          }
          recipientEmailA = "colleague@workspace-sync.com";

          const proposedHour = proposedTime.getHours();
          const ampm = proposedHour >= 12 ? "PM" : "AM";
          const hour12 = proposedHour % 12 || 12;
          const minPart = proposedTime.getMinutes() ? `:${proposedTime.getMinutes().toString().padStart(2, "0")}` : "";
          const dayName = proposedTime.toDateString().split(" ")[0]; // "Sat", "Sun", "Mon" etc.
          
          clashingTimeStr = `this ${dayName} at ${hour12}${minPart} ${ampm}`;

          eventImportanceA = 75; // Pre-existing event
          eventImportanceB = 85; // Proposed email invitation is slightly higher default

          draftA = `Subject: Rescheduling Request: ${eventAName}\n\nDear Team,\n\nI am writing to request a shift for our "${eventAName}" scheduled for ${clashingTimeStr}.\n\nDue to an unavoidable last-minute scheduling overlap, could we reschedule this session to a different slot or Monday instead?\n\nThank you for your flexibility.\n\nSincerely,\nSumith Shetty (via Aheado Proactive Agent)`;
          
          draftB = `Subject: Rescheduling Proposal: ${eventBName}\n\nDear Contact,\n\nThank you for proposing the meeting. I would love to connect, but I have a pre-existing "${eventAName}" scheduled at that exact time.\n\nCould we reschedule our sync to a different time or Monday instead?\n\nThank you for your flexibility and understanding.\n\nSincerely,\nSumith Shetty (via Aheado Proactive Agent)`;
          break;
        }
      }
      if (foundClash) break;
    }

    const hasBillDue = textLower.match(/(bill|invoice|pay|charge|fee|cost|price|credit|pge|energy|tuition)/);
    const hasAssignmentDeadline = textLower.match(/(deadline|hour|submit|assignment|test|school|project|exam|midterm|report|study)/) || (tasks && tasks.length > 0);

    const intercepts: any[] = [];

    if (hasCalendarConflict) {
      intercepts.push({
        id: "int-calendar-option-a",
        title: `Option A: Reschedule Calendar Event "${eventAName}"`,
        description: `Aheado detected a schedule overlap: "${eventAName}" clashes with proposed meeting "${eventBName}" ${clashingTimeStr}. Resolve by rescheduling "${eventAName}" to preserve both.`,
        category: "calendar",
        urgency: "HIGH",
        actionTaken: `Drafted rescheduling proposal for "${eventAName}".`,
        outputDraft: draftA,
        isConflictOption: true,
        conflictGroupId: "grp-calendar-clash",
        eventName: eventAName,
        eventImportance: eventImportanceA,
        alternativeEventName: eventBName,
        alternativeEventImportance: eventImportanceB,
        resolutionTarget: "A",
        recipientEmail: recipientEmailA
      });

      intercepts.push({
        id: "int-calendar-option-b",
        title: `Option B: Reschedule Proposed Meeting "${eventBName}"`,
        description: `Aheado detected a schedule overlap: "${eventAName}" clashes with proposed meeting "${eventBName}" ${clashingTimeStr}. Resolve by rescheduling "${eventBName}" to preserve "${eventAName}".`,
        category: "calendar",
        urgency: "CRITICAL",
        actionTaken: `Drafted rescheduling proposal for "${eventBName}".`,
        outputDraft: draftB,
        isConflictOption: true,
        conflictGroupId: "grp-calendar-clash",
        eventName: eventBName,
        eventImportance: eventImportanceB,
        alternativeEventName: eventAName,
        alternativeEventImportance: eventImportanceA,
        resolutionTarget: "B",
        recipientEmail: recipientEmailB
      });
    }

    if (hasAssignmentDeadline) {
      const criticalTask = tasks && tasks.find((t: any) => t.urgency === "CRITICAL" || t.category === "Assignment");
      const taskTitle = criticalTask ? criticalTask.title : "Emergency Study Plan";
      
      intercepts.push({
        id: "int-portal-shield",
        title: `Portal Deadline Shield: ${taskTitle}`,
        description: "Scans Canvas / Blackboard LMS, identifies assignment files, and drafts pre-solved conceptual outlines before submission portals close.",
        category: "assignment",
        urgency: "CRITICAL",
        actionTaken: "Aheado drafted a 4-step framework study guide & thesis proposal structure.",
        outputDraft: `📚 EMERGENCY STUDY SLATE:\n\n1. Thesis: Propose a hybrid agentic micro-task queue to address portal deadlines.\n2. Key Argument: Staggered local agents avoid late-submission penalties.\n3. Action Plan: Deploying automated checker and draft loader.\n4. Click 'Insert Draft' to export.`,
        recipientEmail: "admissions-registrar@canvaslms.edu"
      });
    }

    if (hasBillDue) {
      intercepts.push({
        id: "int-bill-shield",
        title: "Bill Stream Late-Fee Interceptor",
        description: "Pulls incoming bill metadata from receipts, calculates cash flow buffers, and stages split auto-payments before credit hits.",
        category: "bill",
        urgency: "MEDIUM",
        actionTaken: "Deferred payment split staged for energy / tuition invoice.",
        outputDraft: "💳 BILL STAGING ORDER:\n\nReference: PGE-BILL-6294\nStaged Plan: Split $120 balance into $60 today and $60 next pay-cycle. Pre-approves auto-deferral, bypassing $15 late fee.",
        recipientEmail: "billing@pge-energy-portal.com"
      });
    }

    if (intercepts.length === 0) {
      intercepts.push({
        id: "int-passive-monitoring",
        title: "Passive Monitoring Shield",
        description: "Aheado continues passive background monitoring. No immediate threats, late fees, or deadline collisions were detected in your connected workspace.",
        category: "calendar",
        urgency: "LOW",
        actionTaken: "Established continuous workspace socket telemetry.",
        outputDraft: "📡 STATUS REPORT:\n\nSchedule clear. No double bookings or unpaid invoices detected."
      });
    }

    let riskScore = 15;
    if (hasCalendarConflict) riskScore += 55;
    if (hasAssignmentDeadline) riskScore += 20;
    if (hasBillDue) riskScore += 10;
    if (riskScore > 100) riskScore = 98;

    let summary = "System scans indicate your connected workspace is balanced and secure.";
    if (hasCalendarConflict) {
      summary = `CRITICAL SCHEDULING CLASH DETECTED: Aheado intercepted a direct collision ${clashingTimeStr} between calendar event "${eventAName}" and the email proposal for "${eventBName}".`;
      if (hasAssignmentDeadline) {
        summary += " Additionally, you have high-priority deadlines approaching.";
      }
    } else if (hasAssignmentDeadline) {
      summary = "URGENT DEADLINES DETECTED: You have immediate course assignment portal windows closing soon.";
    }

    return {
      success: true,
      riskScore,
      summary,
      intercepts,
      reassurance: hasCalendarConflict 
        ? "Calm down, Sumith. Aheado detected the conflict. Select your preferred resolution path."
        : "You're all clear. Aheado is watching your schedule."
    };
  };

  // API Endpoints
  app.post("/api/proactive-ai/command", async (req, res) => {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: "Command is required" });
    }

    const client = getGeminiClient();

    const getDemoCommandResponse = () => {
      const lower = command.toLowerCase();
      const isCalendar = lower.includes("calendar") || lower.includes("schedule") || lower.includes("meet") || lower.includes("appointment") || lower.includes("event");
      const isGmail = lower.includes("gmail") || lower.includes("email") || lower.includes("draft") || lower.includes("send");

      if (isCalendar) {
        const summary = command.replace(/(schedule|add to calendar|calendar|meet|appointment|this|tomorrow|at)/gi, "").trim();
        return {
          type: "calendar",
          calendar: {
            summary: summary || "Aheado Scheduled Event",
            description: `Scheduled via Aheado Command: "${command}"`,
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('.')[0] + 'Z',
            endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().split('.')[0] + 'Z',
            recipientEmail: "sumithshetty451@gmail.com"
          },
          isDemo: true
        };
      } else if (isGmail) {
        const recipientMatch = command.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        const recipient = recipientMatch ? recipientMatch[1] : "sumithshetty451@gmail.com";
        const body = `Hi,\n\nThis is a draft generated via Aheado Command based on your request: "${command}"\n\nBest,\nSumith`;
        return {
          type: "gmail",
          gmail: {
            recipient,
            subject: "Aheado Voice Dispatch: Task Alert",
            body
          },
          isDemo: true
        };
      } else {
        return {
          type: "unknown",
          message: `Could not confidently categorize command: "${command}". Try saying 'Schedule meeting...' or 'Draft email...'`,
          isDemo: true
        };
      }
    };

    if (!client) {
      return res.json(getDemoCommandResponse());
    }

    try {
      const promptText = `
      You are the smart natural language interface of Aheado.
      Your job is to parse the user's spoken or typed command into a structured action for either Google Calendar or Gmail.
      
      User Command: "${command}"
      Current Time Reference: ${new Date().toISOString()} (${new Date().toDateString()})
      
      Classify the command as "calendar" (if the user wants to schedule an event, meeting, appointment) or "gmail" (if they want to write, send, or draft an email). If neither, classify as "unknown".
      
      Output MUST be a single, strict, valid JSON object following this JSON schema exactly:
      {
        "type": "calendar" | "gmail" | "unknown",
        "calendar": {
          "summary": "Title of the calendar event",
          "description": "Description of the event, including context",
          "startTime": "ISO 8601 string of the event start time (be smart with relative times like 'tomorrow at 3 PM' using the current time reference)",
          "endTime": "ISO 8601 string of the event end time (default to 1 hour after start time)",
          "recipientEmail": "Extract any email mentioned, or default to sumithshetty451@gmail.com"
        },
        "gmail": {
          "recipient": "Recipient email, extract any email mentioned or default to sumithshetty451@gmail.com",
          "subject": "Clear, professional subject line",
          "body": "Full body of the email. Keep it polite, clean, and helpful."
        }
      }
      
      Respond with ONLY the JSON object. No Markdown code block delimiters, no explanation. Just valid JSON.
      `;

      let textOutput = "";
      try {
        const response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: promptText,
          config: {
            responseMimeType: "application/json"
          }
        });
        textOutput = response.text || "";
      } catch (geminiError) {
        console.error("Gemini model call error in command parser", geminiError);
        return res.json(getDemoCommandResponse());
      }

      if (!textOutput) {
        return res.json(getDemoCommandResponse());
      }

      const parsed = JSON.parse(textOutput.trim());
      return res.json({
        ...parsed,
        isDemo: false
      });
    } catch (error) {
      console.error("Failed to parse command with Gemini", error);
      return res.json(getDemoCommandResponse());
    }
  });

  app.post("/api/proactive-ai/evaluate", async (req, res) => {
    const { scenario, tasks } = req.body;
    
    const client = getGeminiClient();
    
    if (!client) {
      // Return high-quality, relevant response in mock mode to let user preview everything immediately!
      const dynamicResp = generateDynamicEvaluation(scenario, tasks);
      return res.json({
        ...dynamicResp,
        isDemo: true
      });
    }

    const getDemoResponse = () => {
      const dynamicResp = generateDynamicEvaluation(scenario, tasks);
      return {
        ...dynamicResp,
        isDemo: true
      };
    };

    try {
      const promptText = `
      You are the backend AI brain of Aheado. Your core mandate is to analyze the user's scenario and tasks to map them into distinct proactive automated intercepts.
      
      CRITICAL TRUTH & RELEVANCE CONSTRAINT:
      - Do NOT fabricate fictional courses (like "Organic Chemistry Lab Report"), fake medical appointments (like "Doctor Sunil"), or exams unless they are explicitly mentioned in the user's scenario or tasks.
      - If there are real scheduling conflicts, clashing calendar events, or deadlines in the scenario or tasks, map them exactly.
      - If there are NO real calendar clashing events in the user's input, do NOT hallucinate fictional clashes. Instead, fulfill the schema by generating helpful, highly relevant productivity intercepts based directly on the user's actual entered tasks (e.g., preparing a dedicated focus block, suggesting a checklist, or warning about time density for the specific tasks listed). Label these clearly with categories like "Focus Strategy", "Time Allocation", or "Task Prep" rather than inventing external clashes.
      - Always ensure the "intercepts" array is populated with at least 1-2 items to match the layout schema, but base them strictly on the user's actual input or general productivity optimization.

      CRITICAL SCHEDULING CONFLICTS GUIDELINES:
      If there is a real calendar clash or scheduling conflict between two events mentioned in the scenario or calendar:
      1. You MUST generate TWO distinct, mutually exclusive rescheduling option intercepts in the "intercepts" array so the user can choose which strategy to execute based on importance scores.
      2. These options must be:
         - Option A: Reschedule Calendar Event (e.g. Reschedule the calendar event)
         - Option B: Reschedule Proposed Email Meeting/Interview/Lesson (e.g. Reschedule the proposed meeting/email)
      3. For Option A, set:
         - "isConflictOption": true
         - "conflictGroupId": "grp-calendar-clash"
         - "eventName": name of the calendar event to reschedule
         - "eventImportance": score from 0 to 100 representing how critical it is
         - "alternativeEventName": name of the other conflicting event
         - "alternativeEventImportance": score of other event
         - "resolutionTarget": "A"
         - "outputDraft": Rescheduling email/message draft. The draft MUST NOT propose rescheduling to the conflicting slot. Propose safe alternative times.
         - "recipientEmail": Extract or generate the correct email
      4. For Option B, set:
         - "isConflictOption": true
         - "conflictGroupId": "grp-calendar-clash"
         - "eventName": name of the proposed meeting/interview/lesson to reschedule
         - "eventImportance": score from 0 to 100 representing how critical it is
         - "alternativeEventName": name of the other calendar event
         - "alternativeEventImportance": score of other event
         - "resolutionTarget": "B"
         - "outputDraft": Rescheduling email draft. The draft MUST NOT propose rescheduling to the conflicting slot. Propose safe alternative times.
         - "recipientEmail": Extract or generate the recipient email
      
      CURRENT REFERENCE DATE/TIME: ${new Date().toISOString()} (${new Date().toDateString()})
      Use this date/time as "today" to accurately resolve relative date phrases like "tomorrow", "this Sunday", "next Monday", "in 3 hours", etc., so that there are absolutely no date or year extraction blunders or hallucinations.

      User's Scenario: "${scenario || 'No specific scenario provided, evaluate general productivity hazards'}"
      Provided Tasks: ${JSON.stringify(tasks || [])}
      
      Provide a highly creative, actionable response in JSON format matching the schema.
      `;

      // Resilient execution with key rotation AND model fallback
      const executeWithKeyRotationAndFallback = async (timeoutMs = 45000) => {
        const totalKeys = clientsPool.length;
        if (totalKeys === 0) {
          throw new Error("No Gemini API keys configured in pool");
        }

        // Only use gemini-2.5-flash as it is compatible with the provided keys
        const modelsToTry = ["gemini-2.5-flash"];

        for (const modelName of modelsToTry) {
          console.log(`[Evaluate Route] Attempting evaluation sequence with model: ${modelName}`);
          
          let attemptsWithCurrentModel = 0;
          while (attemptsWithCurrentModel < totalKeys) {
            const clientIndex = currentKeyIndex % totalKeys;
            const client = clientsPool[clientIndex];
            const keyDisplayName = `GEMINI_API_KEY${clientIndex === 0 ? "" : "_" + (clientIndex + 1)}`;
            
            console.log(`[Evaluate Route] [Key Rotation] Key: ${keyDisplayName} (Index: ${clientIndex}), Model: ${modelName}`);

            try {
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms for ${modelName}`)), timeoutMs)
              );

              const responsePromise = client.models.generateContent({
                model: modelName,
                contents: promptText,
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      riskScore: { type: Type.INTEGER, description: "A calculated risk score out of 100 representing how severe the last-minute crisis is." },
                      summary: { type: Type.STRING, description: "A high-level synthesis of what is about to go wrong and how Aheado intercepts it." },
                      intercepts: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            category: { type: Type.STRING, description: "Must be assignment, bill, or calendar" },
                            urgency: { type: Type.STRING },
                            actionTaken: { type: Type.STRING },
                            outputDraft: { type: Type.STRING },
                            isConflictOption: { type: Type.BOOLEAN },
                            conflictGroupId: { type: Type.STRING },
                            eventName: { type: Type.STRING },
                            eventImportance: { type: Type.INTEGER },
                            alternativeEventName: { type: Type.STRING },
                            alternativeEventImportance: { type: Type.INTEGER },
                            resolutionTarget: { type: Type.STRING },
                            recipientEmail: { type: Type.STRING, description: "Extract or generate a realistic recipient email address, e.g. jessica.recruiting@hightech.com or billing@pge-energy-portal.com" }
                          },
                          required: ["id", "title", "description", "category", "urgency", "actionTaken", "outputDraft"]
                        }
                      },
                      reassurance: { type: Type.STRING }
                    },
                    required: ["riskScore", "summary", "intercepts", "reassurance"]
                  }
                }
              });

              const response: any = await Promise.race([responsePromise, timeoutPromise]);
              const responseText = response.text;
              if (!responseText) {
                throw new Error("No response text from model");
              }

              const cleanedText = cleanJsonString(responseText);
              const parsed = JSON.parse(cleanedText);
              
              if (!parsed || typeof parsed !== "object") {
                throw new Error("Parsed JSON is not a valid object");
              }
              if (!parsed.intercepts || !Array.isArray(parsed.intercepts) || parsed.intercepts.length === 0) {
                throw new Error("Parsed JSON is missing the intercepts array, or it is empty (severe truncation/repair)");
              }
              
              return { ...parsed, isDemo: false };

            } catch (err: any) {
              const errMsg = err.message || "";
              console.warn(`[Evaluate Route] [Key Rotation Warning] Key ${keyDisplayName} failed with model ${modelName}: ${errMsg}`);
              
              // Always cycle key on failure (429, timeout, parse error, or invalid schema) to ensure max resiliency
              console.warn(`[Evaluate Route] [Key Rotation Action] Cycling from ${keyDisplayName} to the next key to ensure successful generation...`);
              currentKeyIndex = (currentKeyIndex + 1) % totalKeys;
              
              attemptsWithCurrentModel++;
              continue;
            }
          }
          console.warn(`[Evaluate Route] Model ${modelName} failed on all keys in pool. Moving to next model option...`);
        }

        throw new Error("All models and keys failed in rotation pool");
      };

      try {
        const parsedData = await executeWithKeyRotationAndFallback(45000);
        console.log("[Evaluate Route] Successfully completed evaluation using key rotation.");
        return res.json({ success: true, isDemo: parsedData.isDemo === true, ...parsedData });
      } catch (rotationErr: any) {
        console.warn("[Evaluate Route] All live Gemini API model attempts failed or timed out. Switching to high-quality fallback demo response.", rotationErr.message || rotationErr);
        return res.json(getDemoResponse());
      }

    } catch (error: any) {
      console.error("Gemini API Error in evaluate (outer catch):", error);
      return res.json(getDemoResponse());
    }
  });

  // Multi-Agent Orchestration and Tooling Framework Endpoint
  app.post("/api/multi-agent/orchestrate", async (req, res) => {
    const { scenario } = req.body;
    if (!scenario) {
      return res.status(400).json({ success: false, error: "Missing scenario in request body" });
    }

    console.log(`[Multi-Agent Router] Ingesting scenario: "${scenario.substring(0, 80)}..."`);

    try {
      // 1. Attempt to run the Python Core Orchestrator with the environment variable set
      const envWithInput = { ...process.env, AHEADO_CRISIS_INPUT: scenario };
      const { stdout } = await execPromise("python3 python_core/orchestrator.py", {
        env: envWithInput,
        timeout: 10000, // 10 seconds timeout
      });

      try {
        const parsedOutput = JSON.parse(stdout.trim());
        console.log("[Multi-Agent Router] Successfully received response from Python Core Orchestrator.");
        return res.json({ success: true, isPythonEngine: true, ...parsedOutput });
      } catch (parseError) {
        console.warn("[Multi-Agent Router] Python stdout was not valid JSON, falling back to TypeScript parsing.");
        throw new Error("Invalid JSON from Python output");
      }
    } catch (error: any) {
      console.warn(`[Multi-Agent Router] Python core not available or errored: ${error.message || error}. Falling back to TypeScript replication...`);

      // 2. TypeScript replication of the Multi-Agent Core Routing (Zero cost execution / no dependency errors)
      const textLower = scenario.toLowerCase();
      let selectedSkill = "generic_fallback";
      let confidenceScore = 1.0;
      let justification = "Zero direct crisis vectors matched. Safeguarding with default passive monitoring.";
      let args: any = { raw_input_excerpt: scenario.substring(0, 100) };

      if (textLower.match(/(deadline|hour|submit|assignment|test|school|project|exam)/)) {
        selectedSkill = "deadline_negotiator";
        confidenceScore = 0.96;
        justification = "Unstructured alert flags high-urgency academic/LMS portal deadline criteria.";
        let taskName = "Selection Test / Assignment";
        if (textLower.includes("selection test")) {
          taskName = "Selection Test (MLSS Program)";
        }
        args = { task_name: taskName, hours_left: 1.0, professor_or_client: "MLSS Admissions Team" };
      } else if (textLower.match(/(bill|invoice|pay|charge|fee|cost|price|credit)/)) {
        selectedSkill = "bill_autopilot";
        confidenceScore = 0.98;
        justification = "Text flow indicates an invoice statement requiring settlement or payment staging.";
        args = { bill_title: "AWS Cloud Statement", amount: 148.50, due_date: "Next Monday" };
      }

      // 3. Dispatch to Skill Handlers
      let executionResult: any = {};
      if (selectedSkill === "deadline_negotiator") {
        const taskName = args.task_name || "scheduled deliverable";
        const hoursLeft = args.hours_left || 12.0;
        const recipient = args.professor_or_client || "Professor / Manager";
        const draftBody = `Dear ${recipient},\n\nI am writing to respectfully request a brief extension for '${taskName}', which is currently scheduled to be submitted in approximately ${hoursLeft} hours.\n\nDue to complex engineering implementation hurdles and unexpected integration bottlenecks, I want to ensure the final submission is of high professional standard. Would it be possible to submit this by tomorrow evening, or over the weekend?\n\nThank you very much for your time, understanding, and consideration.\n\nSincerely,\n[Your Name] (via Aheado Proactive Agent)`;
        executionResult = {
          status: "DRAFT_STAGED",
          message: "Polite extension request generated successfully.",
          requires_hitl: true,
          verification_card: {
            ui_component: "DraftApprovalCard",
            title: `🛡️ Draft: Extension Request for '${taskName}'`,
            severity: hoursLeft < 12 ? "CRITICAL" : "HIGH",
            recipient: recipient,
            draft_text: draftBody,
            actions: [
              { label: "Approve and Pre-stage Send", event_id: `evt_negotiator_approve_${Math.random().toString(36).substring(7)}`, action_type: "APPROVE" },
              { label: "Edit Draft Manually", event_id: `evt_edit_${Math.random().toString(36).substring(7)}`, action_type: "EDIT" },
              { label: "Dismiss Threat Intercept", event_id: `evt_dismiss_${Math.random().toString(36).substring(7)}`, action_type: "DISMISS" }
            ]
          }
        };
      } else if (selectedSkill === "bill_autopilot") {
        const billTitle = args.bill_title || "Subscription Provider";
        const amount = args.amount || 29.99;
        const dueDate = args.due_date || "Soon";
        const spendCap = 50.00;
        const eventId = `evt_bill_settle_${Math.random().toString(36).substring(7)}`;
        const ap2Token = "ap2_tok_" + Math.random().toString(36).substring(5);

        if (amount > spendCap) {
          executionResult = {
            status: "AP2_BLOCKED",
            message: `Transaction amount of $${amount.toFixed(2)} exceeds your standard AP2 Token Gate safety threshold of $${spendCap.toFixed(2)}.`,
            requires_hitl: true,
            verification_card: {
              ui_component: "TokenGateModal",
              title: `💳 AP2 Limit Warning: Blocked payment to '${billTitle}'`,
              severity: "HIGH",
              bill_title: billTitle,
              amount: amount,
              ap2_token: ap2Token,
              warning_message: `The requested charge of $${amount.toFixed(2)} violates the standard Aheado automated spending safety boundary. We have temporarily staged a split-payment deferral route but require manual cryptographic confirmation to authorize.`,
              actions: [
                { label: `Authorize & Sign AP2 Token (${ap2Token})`, event_id: `hitl_approve_${eventId}`, action_type: "APPROVE" },
                { label: "Stagger Charge (Split 50/50)", event_id: `hitl_stagger_${eventId}`, action_type: "STAGGER" },
                { label: "Cancel Payment Stream", event_id: `hitl_cancel_${eventId}`, action_type: "CANCEL" }
              ]
            }
          };
        } else {
          executionResult = {
            status: "AUTO_PRESTAGED",
            message: `Payment of $${amount.toFixed(2)} to ${billTitle} is within your safety threshold. Auto-route staged.`,
            requires_hitl: false,
            ap2_token: ap2Token,
            payment_proposal: {
              bill_title: billTitle,
              amount: amount,
              optimal_route: "Deferred split sequence: Pay 100% on the day before late-fee penalty triggers.",
              scheduled_date: dueDate,
              savings_estimate: "Bypassed standard $15.00 late-fee penalty."
            }
          };
        }
      } else {
        executionResult = {
          status: "MONITORED_PASSIVE",
          message: "Crisis stream parsed and indexed in Aheado local memory. No safety limits exceeded.",
          requires_hitl: false
        };
      }

      // 4. MCP Mock Bridge Simulation
      const mcpBridgeResult = {
        mcp_connection: "ACTIVE",
        active_sockets: ["google_workspace_gmail", "google_calendar_v3", "slack_webhooks"],
        harvested_metadata: {
          workspace_origin: "Gmail (Inbox Priority Filter)",
          calendar_conflict_detected: selectedSkill === "deadline_negotiator",
          slack_alert_fired: true
        },
        injected_tasks_tree: {
          node: "AheadoRootContainer",
          children: [
            { task: "Evaluate Danger Threshold", complete: true },
            { task: `Map Vector to Skill (${selectedSkill})`, complete: true },
            { task: "Inject Interactive HITL Card", complete: false }
          ]
        }
      };

      return res.json({
        success: true,
        isPythonEngine: false,
        routing: {
          selected_skill: selectedSkill,
          confidence_score: confidenceScore,
          justification: justification,
          arguments: args
        },
        execution: executionResult,
        mcp_bridge: mcpBridgeResult
      });
    }
  });

  // Serve static assets and connect Vite in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Aheado] Server is running on port ${PORT}`);
  });
}

startServer();
