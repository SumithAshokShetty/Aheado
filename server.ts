import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

dotenv.config();

// Lazy initialization for Gemini API.
let genAI: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined in the environment. AI features will run in mock demonstration mode.");
      return null;
    }
    genAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAI;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Helper to generate a highly dynamic, relevant evaluation response
  const generateDynamicEvaluation = (scenario: string, tasks: any[]) => {
    const textLower = (scenario || "").toLowerCase();
    
    // Detect Calendar Event Name & Email Clash
    let eventAName = "Pediatric Doctor Checkup";
    let eventBName = "Technical Interview";
    
    const isMusicClass = textLower.includes("music") || textLower.includes("raju") || textLower.includes("sunday") || textLower.includes("hackathon");

    // Check calendar events in scenario
    if (isMusicClass) {
      eventAName = "Unstop How to win a hackathon";
      eventBName = "Music class";
    } else if (textLower.includes("sunil")) {
      eventAName = "Appointment with Dr Sunil";
    } else if (textLower.includes("birthday")) {
      eventAName = "Raju uncle's birthday";
    } else if (textLower.includes("hackathon")) {
      eventAName = "Unstop How to win a hackathon";
    } else if (textLower.includes("doctor") || textLower.includes("pediatric")) {
      eventAName = "Pediatric Doctor Checkup";
    }
    
    // Check emails in scenario
    if (isMusicClass) {
      eventBName = "Music class";
    } else if (textLower.includes("interview") || textLower.includes("interviewer")) {
      eventBName = "Technical Interview";
    } else if (textLower.includes("supabase")) {
      eventBName = "Your Supabase Project status";
    } else if (textLower.includes("verification")) {
      eventBName = "2-Step Verification Security";
    }

    // Check if calendar conflict/clash keywords are in scenario
    const hasCalendarConflict = textLower.includes("conflict") || textLower.includes("clash") || textLower.includes("overlap") || textLower.includes("dr sunil") || textLower.includes("pediatric") || textLower.includes("interview") || isMusicClass;

    const hasBillDue = textLower.match(/(bill|invoice|pay|charge|fee|cost|price|credit|pge|energy|tuition)/);
    const hasAssignmentDeadline = textLower.match(/(deadline|hour|submit|assignment|test|school|project|exam|midterm|report|study)/) || (tasks && tasks.length > 0);

    const intercepts: any[] = [];

    // Generate Calendar Reschedule Options if conflict detected
    if (hasCalendarConflict) {
      const urgencyVal = isMusicClass ? "HIGH" : "HIGH";
      const importanceA = isMusicClass ? 88 : 72;
      const importanceB = isMusicClass ? 75 : 95;
      const descA = isMusicClass
        ? `Aheado detected a schedule overlap: "${eventAName}" (11:00 AM - 3:00 PM) clashes with your proposed "${eventBName}" this Sunday at 1:00 PM. Resolve by rescheduling the calendar appointment "${eventAName}" to Sunday at 3:30 PM (after the hackathon) so you can attend both.`
        : `Aheado detected a schedule overlap: "${eventAName}" clashes with "${eventBName}" tomorrow at 2:30 PM. Resolve by rescheduling the calendar appointment "${eventAName}" to tomorrow at 4:30 PM (a safe slot) so you can attend the high-priority interview.`;
      
      const descB = isMusicClass
        ? `Aheado detected a schedule overlap: "${eventAName}" clashes with "${eventBName}" on Sunday at 1:00 PM. Resolve by rescheduling the proposed "${eventBName}" to Sunday at 3:30 PM or Saturday at 1:00 PM (safe slots) to attend the Unstop hackathon live.`
        : `Aheado detected a schedule overlap: "${eventAName}" clashes with "${eventBName}" tomorrow at 2:30 PM. Resolve by rescheduling the proposed "${eventBName}" to tomorrow at 4:00 PM or Monday at 11:00 AM (safe slots) to preserve your medical checkup.`;

      const draftA = isMusicClass
        ? `Subject: Rescheduling Request: Unstop Hackathon Team Sync - Sumith Shetty\n\nDear Hackathon Team,\n\nI am writing to request a shift for our "Unstop How to win a hackathon" team check-in session scheduled for Sunday at 1:00 PM.\n\nDue to an unavoidable music class overlap, could we reschedule our sync to Sunday at 3:30 PM, or Saturday afternoon instead?\n\nThank you for your flexibility.\n\nSincerely,\nSumith Shetty (via Aheado Proactive Agent)`
        : `Subject: Rescheduling Request: ${eventAName} - Sumith Shetty\n\nDear Office Coordinator,\n\nI am writing to request a shift for my appointment ("${eventAName}") scheduled for tomorrow at 2:30 PM.\n\nDue to an unavoidable last-minute scheduling overlap, could we reschedule this to tomorrow at 4:30 PM, or Monday at 10:00 AM instead?\n\nThank you for your kindness and flexibility.\n\nSincerely,\nSumith Shetty (via Aheado Proactive Agent)`;

      const draftB = isMusicClass
        ? `Subject: Rescheduling Request: Music Class - Sumith Shetty\n\nDear Raju,\n\nThank you for scheduling the music class. I have a live "Unstop How to win a hackathon" event this Sunday between 11:00 AM and 3:00 PM that I must attend.\n\nCould we reschedule our music class session to Sunday at 3:30 PM, or Saturday at 1:00 PM instead?\n\nThank you for your understanding and guidance.\n\nSincerely,\nSumith Shetty (via Aheado Proactive Agent)`
        : `Subject: Rescheduling Request: Final Interview - Sumith Shetty\n\nDear Jessica,\n\nThank you for reaching out regarding the technical interview. I have a pre-existing medical commitment tomorrow at 2:30 PM that I cannot defer.\n\nCould we reschedule our session to tomorrow at 4:00 PM, or Monday at 11:00 AM instead?\n\nThank you for your flexibility and understanding.\n\nSincerely,\nSumith Shetty (via Aheado Proactive Agent)`;

      const recB = isMusicClass ? "sumi020905@gmail.com" : "jessica.recruiting@hightech.com";

      // Option A: Reschedule Event A (Calendar Event - Dr Sunil Checkup or Hackathon)
      intercepts.push({
        id: "int-calendar-option-a",
        title: `Option A: Reschedule Calendar Event "${eventAName}"`,
        description: descA,
        category: "calendar",
        urgency: urgencyVal,
        actionTaken: `Drafted rescheduling proposal for "${eventAName}".`,
        outputDraft: draftA,
        isConflictOption: true,
        conflictGroupId: "grp-calendar-clash",
        eventName: eventAName,
        eventImportance: importanceA,
        alternativeEventName: eventBName,
        alternativeEventImportance: importanceB,
        resolutionTarget: "A",
        recipientEmail: isMusicClass ? "hackathon-leads@unstop.com" : "clinic-coordinator@clinicsunil.com"
      });

      // Option B: Reschedule Event B (Email-Proposed Interview or Music Class)
      intercepts.push({
        id: "int-calendar-option-b",
        title: `Option B: Reschedule Proposed Meeting/Lesson "${eventBName}"`,
        description: descB,
        category: "calendar",
        urgency: "CRITICAL",
        actionTaken: `Drafted rescheduling proposal for "${eventBName}".`,
        outputDraft: draftB,
        isConflictOption: true,
        conflictGroupId: "grp-calendar-clash",
        eventName: eventBName,
        eventImportance: importanceB,
        alternativeEventName: eventAName,
        alternativeEventImportance: importanceA,
        resolutionTarget: "B",
        recipientEmail: recB
      });
    }

    // Include Portal Deadline Shield ONLY if there are academic assignments/tasks
    if (hasAssignmentDeadline) {
      // Find matching tasks
      const criticalTask = tasks && tasks.find((t: any) => t.urgency === "CRITICAL" || t.category === "Assignment");
      const taskTitle = criticalTask ? criticalTask.title : "Emergency Study Plan";
      
      intercepts.push({
        id: "int-portal-shield",
        title: `Portal Deadline Shield: ${taskTitle}`,
        description: "Scans Canvas / Blackboard LMS, identifies assignment files, and drafts pre-solved conceptual outlines before submission portals close.",
        category: "assignment",
        urgency: "CRITICAL",
        actionTaken: "Aheado drafted a 4-step framework study guide & thesis proposal structure.",
        outputDraft: `📚 EMERGENCY STUDY SLATE:\n\n1. Thesis: Propose a hybrid agentic micro-task queue to address portal deadlines.\n2. Key Argument: Staggered local agents avoid the late-submission window penalty.\n3. Action Plan: Deploying automated checker and draft loader.\n4. Complete outline ready. Click 'Insert Draft' to export.`,
        recipientEmail: "admissions-registrar@canvaslms.edu"
      });
    }

    // Include Bill Stream Late-Fee Interceptor ONLY if there is a bill/payment keywords
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

    // Default fallback if absolutely nothing was generated to prevent an empty screen
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

    // Calculate dynamic risk score based on what is present
    let riskScore = 15;
    if (hasCalendarConflict) riskScore += 55;
    if (hasAssignmentDeadline) riskScore += 20;
    if (hasBillDue) riskScore += 10;
    if (riskScore > 100) riskScore = 98;

    let summary = "System scans indicate your connected workspace is balanced and secure.";
    if (hasCalendarConflict) {
      summary = `CRITICAL SCHEDULING CLASH DETECTED: Aheado intercepted a direct collision tomorrow at 2:30 PM between calendar event "${eventAName}" and the email proposal for "${eventBName}".`;
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
      You are the backend AI brain of "Aheado" - a proactive workspace helper.
      Your job is to analyze a user's scenario and list of tasks, and identify intercepts that correspond strictly to actual conflicts, dues, or deadlines in the scenario.
      
      CRITICAL SCANNING & FILTERING GUIDELINES:
      - If there is NO bill or payment mentioned in the scenario, do NOT generate any bill/payment intercepts.
      - If there is NO school assignment, test, or study plan mentioned in the scenario, do NOT generate any assignment/LMS intercepts.
      
      CRITICAL SCHEDULING CONFLICTS GUIDELINES:
      If there is a calendar clash or scheduling conflict between two events (e.g. a medical checkup and a job interview, or a Sunday hackathon clashing with a proposed music class):
      1. You MUST generate TWO distinct, mutually exclusive rescheduling option intercepts in the "intercepts" array so the user can choose which strategy to execute based on importance scores.
      2. These options must be:
         - Option A: Reschedule Calendar Event (e.g. Pediatric Doctor Checkup, Appointment with Dr Sunil, or Unstop How to win a hackathon)
         - Option B: Reschedule Proposed Email Meeting/Interview/Lesson (e.g. Technical Interview, or Music class)
      3. For Option A, set:
         - "isConflictOption": true
         - "conflictGroupId": "grp-calendar-clash"
         - "eventName": name of the calendar event to reschedule
         - "eventImportance": score from 0 to 100 representing how critical it is (e.g. 72 for medical, 88 for hackathon)
         - "alternativeEventName": name of the other conflicting event
         - "alternativeEventImportance": score of other event (e.g. 95 for interview, 75 for music class)
         - "resolutionTarget": "A"
         - "outputDraft": Rescheduling email/message draft. The draft MUST NOT propose rescheduling to the conflicting slot. Propose safe alternative times (e.g. tomorrow at 4:30 PM, or Sunday at 3:30 PM after the hackathon).
         - "recipientEmail": Extract or generate the correct email (e.g. clinic-coordinator@clinicsunil.com or hackathon-leads@unstop.com)
      4. For Option B, set:
         - "isConflictOption": true
         - "conflictGroupId": "grp-calendar-clash"
         - "eventName": name of the proposed meeting/interview/lesson to reschedule
         - "eventImportance": score from 0 to 100 representing how critical it is (e.g. 95 for interview, 75 for music class)
         - "alternativeEventName": name of the other calendar event
         - "alternativeEventImportance": score of other event (e.g. 72 or 88)
         - "resolutionTarget": "B"
         - "outputDraft": Rescheduling email draft. The draft MUST NOT propose rescheduling to the conflicting slot. Propose safe alternative times (e.g. tomorrow at 4:00 PM, Sunday at 3:30 PM, or Saturday at 1:00 PM).
         - "recipientEmail": Extract or generate the recipient email (e.g. jessica.recruiting@hightech.com, sumi020905@gmail.com, or raju.music@gmail.com)
      
      User's Scenario: "${scenario || 'No specific scenario provided, evaluate general productivity hazards'}"
      Provided Tasks: ${JSON.stringify(tasks || [])}
      
      Provide a highly creative, actionable response in JSON format matching the schema.
      `;

      // Implement a resilient, multi-model fallback with a longer timeout (15s) to handle high-demand 503 errors or latency spikes
      const runWithTimeout = async (modelName: string, timeoutMs = 15000) => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini call timed out for model: ${modelName}`)), timeoutMs)
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
        return JSON.parse(responseText.trim());
      };

      try {
        let parsedData: any;
        try {
          console.log("[Evaluate Route] Attempting Gemini call using 'gemini-2.5-flash'...");
          parsedData = await runWithTimeout("gemini-2.5-flash", 10000);
          console.log("[Evaluate Route] Successfully retrieved analysis using 'gemini-2.5-flash'.");
        } catch (firstError: any) {
          console.warn(`[Evaluate Route] 'gemini-2.5-flash' failed or timed out: ${firstError.message}. Retrying with highly available fallback 'gemini-1.5-flash'...`);
          try {
            parsedData = await runWithTimeout("gemini-1.5-flash", 10000);
            console.log("[Evaluate Route] Successfully retrieved analysis using fallback 'gemini-1.5-flash'.");
          } catch (secondError: any) {
            console.warn(`[Evaluate Route] Fallback model 'gemini-1.5-flash' also failed: ${secondError.message}. Retrying with secondary backup 'gemini-2.5-pro'...`);
            parsedData = await runWithTimeout("gemini-2.5-pro", 10000);
            console.log("[Evaluate Route] Successfully retrieved analysis using secondary backup 'gemini-2.5-pro'.");
          }
        }
        return res.json({ success: true, isDemo: false, ...parsedData });
      } catch (innerError: any) {
        console.warn("[Evaluate Route] All live Gemini API model attempts failed or timed out. Switching to high-quality fallback demo response.", innerError.message || innerError);
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
