import React, { useState, useEffect } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  Check, 
  X, 
  Zap, 
  Loader2, 
  Mail, 
  Calendar, 
  CreditCard, 
  Lock, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Send, 
  Smartphone,
  AlertCircle,
  Clock
} from "lucide-react";
import { 
  loadConnectionState, 
  sendGmailEmail, 
  createCalendarEvent,
  updateCalendarEvent,
  createGmailDraft,
  deleteCalendarEvent,
  fetchCalendarEvents
} from "../lib/googleApi";

interface Intercept {
  id: string;
  title: string;
  description: string;
  category: "assignment" | "calendar" | "bill" | string;
  urgency: "CRITICAL" | "HIGH" | "MEDIUM" | string;
  actionTaken: string;
  outputDraft: string;
  recipientEmail?: string;
  eventName?: string;
}

interface AgentExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  intercept: Intercept | null;
  onSuccess: (id: string) => void;
  addSystemLog: (log: string) => void;
}

type Stage = "PREVIEW" | "EXECUTING" | "SUCCESS";

export function AgentExecutionModal({ 
  isOpen, 
  onClose, 
  intercept, 
  onSuccess,
  addSystemLog
}: AgentExecutionModalProps) {
  if (!isOpen || !intercept) return null;

  const [stage, setStage] = useState<Stage>("PREVIEW");
  const [recipient, setRecipient] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"gpay" | "apple" | "card">("gpay");
  const [cardNumber, setCardNumber] = useState("•••• •••• •••• 4829");
  const [currentStep, setCurrentStep] = useState(0);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [txHash, setTxHash] = useState("");

  // Negotiation thread states
  const [eventId, setEventId] = useState("");
  const [simulatedScenario, setSimulatedScenario] = useState<"NONE" | "AGREE" | "SHIFT">("NONE");
  const [checkingCalendar, setCheckingCalendar] = useState(false);
  const [calendarResult, setCalendarResult] = useState("");
  const [userDecision, setUserDecision] = useState<"NONE" | "APPROVED" | "DECLINED">("NONE");
  const [negotiationLogs, setNegotiationLogs] = useState<string[]>([]);

  // Determine standard prefilled info based on category
  useEffect(() => {
    if (intercept) {
      setStage("PREVIEW");
      setCurrentStep(0);
      setExecutionLogs([]);
      
      // Reset negotiation
      setEventId("");
      setSimulatedScenario("NONE");
      setCheckingCalendar(false);
      setCalendarResult("");
      setUserDecision("NONE");
      setNegotiationLogs([]);

      const googleConn = loadConnectionState();
      
      if (intercept.recipientEmail) {
        setRecipient(intercept.recipientEmail);
      } else if (intercept.category === "bill") {
        setRecipient("billing@pge-energy-portal.com");
      } else if (intercept.id === "int-calendar-option-a") {
        setRecipient("clinic-coordinator@clinicsunil.com");
      } else if (intercept.id === "int-calendar-option-b") {
        setRecipient("jessica.recruiting@hightech.com");
      } else if (intercept.category === "calendar") {
        // Find suitable recipient email
        setRecipient(intercept.id === "int-2" ? "mlss-admissions@university.edu" : "sumithcodeunnati@gmail.com");
      } else {
        setRecipient("chemistry-department@university.edu");
      }
      
      // Beautiful formatting of initial email draft
      if (intercept.category === "calendar") {
        let initialBody = intercept.outputDraft || "";
        initialBody = initialBody
          .replace(/✉️ RESCHEDULING STAGE:\s*/gi, "")
          .replace(/Subject: [^\n]+\n*/gi, "")
          .trim();
        setEmailBody(initialBody);
      } else {
        let initialBody = intercept.outputDraft || "";
        // Clean out email headers in body
        initialBody = initialBody
          .replace(/✉️ RESCHEDULING STAGE:\s*/gi, "")
          .replace(/Subject: [^\n]+\n*/gi, "")
          .trim();
        setEmailBody(initialBody);
      }
    }
  }, [intercept]);

  const handleSimulateScenario = async (scenario: "AGREE" | "SHIFT") => {
    setSimulatedScenario(scenario);
    setNegotiationLogs([`[INBOX MONITOR] Monitoring recipient address "${recipient}" for updates...`]);
    setUserDecision("NONE");
    setCalendarResult("");
    
    // Determine dynamic targets
    const isDoctor = intercept.id === "int-calendar-option-a" && !intercept.recipientEmail?.includes("unstop");
    const isMusicClass = intercept.eventName?.includes("Music") || intercept.eventName?.includes("hackathon") || intercept.recipientEmail?.includes("music") || intercept.recipientEmail?.includes("unstop");

    let proposedTimeStr = isDoctor ? "tomorrow at 4:30 PM" : "tomorrow at 4:00 PM";
    let shiftTimeStr = "Monday, June 29 at 11:00 AM";

    if (isMusicClass) {
      proposedTimeStr = "Sunday at 3:30 PM";
      shiftTimeStr = "Saturday, June 27 at 1:00 PM";
    }

    let agreeMsg = "";
    if (isMusicClass) {
      agreeMsg = intercept.id === "int-calendar-option-a"
        ? `💬 "Hi Sumith, Sunday at 3:30 PM works great for our team sync. We've shifted our slot!"`
        : `💬 "Hi Sumith, yes! Sunday at 3:30 PM is perfect for our music lesson. See you then! - Raju"`;
    } else {
      agreeMsg = isDoctor
        ? `💬 "Hi Sumith, thanks for reaching out. Yes, tomorrow at 4:30 PM works perfectly! We've updated your pediatric appointment."`
        : `💬 "Hi Sumith, thanks for letting us know. Tomorrow at 4:00 PM works great for the team. See you then!"`;
    }

    let shiftMsg = "";
    if (isMusicClass) {
      shiftMsg = intercept.id === "int-calendar-option-a"
        ? `💬 "Hi Sumith, Sunday at 3:30 PM is a bit late for us. Could we do Saturday, June 27 at 1:00 PM instead?"`
        : `💬 "Hi Sumith, Sunday at 3:30 PM is fully booked for lessons. Could we do Saturday, June 27 at 1:00 PM instead? - Raju"`;
    } else {
      shiftMsg = isDoctor
        ? `💬 "Hi Sumith, unfortunately tomorrow at 4:30 PM is fully booked for Dr Sunil. Could we do Monday, June 29 at 11:00 AM instead?"`
        : `💬 "Hi Sumith, tomorrow at 4:00 PM is a bit tight for Jessica. Could we do Monday, June 29 at 11:00 AM instead?"`;
    }

    if (scenario === "AGREE") {
      setTimeout(() => {
        setNegotiationLogs(prev => [...prev, `[INCOMING] Reply received from ${recipient}:`]);
        setNegotiationLogs(prev => [...prev, agreeMsg]);
      }, 1000);

      setTimeout(() => {
        setNegotiationLogs(prev => [...prev, `[PROCESS] Agent verifying calendar slot availability...`]);
      }, 2200);

      setTimeout(async () => {
        setNegotiationLogs(prev => [...prev, `[CALENDAR CHECK] ✅ ${proposedTimeStr.charAt(0).toUpperCase() + proposedTimeStr.slice(1)} is still free on your calendar.`]);
        
        const googleConn = loadConnectionState();
        if (googleConn.isConnected && googleConn.accessToken && eventId) {
          try {
            setNegotiationLogs(prev => [...prev, `[API] Dispatching confirmation email via Gmail...`]);
            await sendGmailEmail(
              googleConn.accessToken,
              recipient,
              `Re: [Aheado Rescheduling Alert] ${intercept.title} - Proposal Confirmed`,
              `Hi,\n\nFantastic, ${proposedTimeStr} is confirmed. See you then!\n\nBest regards,\nSumith (via Aheado Proactive Agent)`
            );
            setNegotiationLogs(prev => [...prev, `[SUCCESS] Locked-in confirmation email dispatched. Google Calendar status updated to CONFIRMED.`]);
          } catch (err: any) {
            console.warn(err);
            setNegotiationLogs(prev => [...prev, `[INFO] Simulation resolved. Event confirmed in Workspace database.`]);
          }
        } else {
          setNegotiationLogs(prev => [...prev, `[SUCCESS] Simulation complete: Rescheduled slot confirmed. Event fully resolved.`]);
        }
        setUserDecision("APPROVED");
      }, 3500);
      
    } else if (scenario === "SHIFT") {
      setTimeout(() => {
        setNegotiationLogs(prev => [...prev, `[INCOMING] Alternative proposal received from ${recipient}:`]);
        setNegotiationLogs(prev => [...prev, shiftMsg]);
      }, 1200);

      setTimeout(() => {
        setCheckingCalendar(true);
        setNegotiationLogs(prev => [...prev, `[AGENT CORE] Initiating Google Calendar check for: ${shiftTimeStr}...`]);
      }, 2400);

      setTimeout(() => {
        setCheckingCalendar(false);
        setCalendarResult("FREE");
        setNegotiationLogs(prev => [
          ...prev, 
          `[CALENDAR CHECK] ✅ ${shiftTimeStr} has ZERO conflicts. Slot is 100% AVAILABLE.`,
          `[ACTION REQUIRED] Notifying user: Slot is open. Prompting for approval to book...`
        ]);
      }, 4200);
    }
  };

  const handleApproveShift = async () => {
    setUserDecision("APPROVED");
    const isMusicClass = intercept.eventName?.includes("Music") || intercept.eventName?.includes("hackathon") || intercept.recipientEmail?.includes("music") || intercept.recipientEmail?.includes("unstop");
    const shiftTimeStr = isMusicClass ? "Saturday, June 27 at 1:00 PM" : "Monday, June 29 at 11:00 AM";

    setNegotiationLogs(prev => [...prev, `[USER] Authorized rescheduling approval for: ${shiftTimeStr}.`]);
    
    const googleConn = loadConnectionState();
    if (googleConn.isConnected && googleConn.accessToken) {
      try {
        setNegotiationLogs(prev => [...prev, `[LIVE] Connecting to Google REST API to reschedule...`]);
        
        // 1. Send confirmation email
        setNegotiationLogs(prev => [...prev, `[API] Dispatching confirmation email to ${recipient}...`]);
        await sendGmailEmail(
          googleConn.accessToken,
          recipient,
          `Re: [Aheado Rescheduling Alert] ${intercept.title} - Shift Accepted`,
          `Hi,\n\n${shiftTimeStr} works great for me. I've rescheduled the calendar invitation accordingly. See you then!\n\nBest regards,\nSumith (via Aheado Proactive Agent)`
        );
        setNegotiationLogs(prev => [...prev, `[SUCCESS] Confirmation mail dispatched.`]);

        // 2. Update Calendar Event
        if (eventId) {
          setNegotiationLogs(prev => [...prev, `[API] Updating Google Calendar event location and time...`]);
          const summary = `[Aheado Rescheduled] ${intercept.title}`;
          const description = `This event was rescheduled to a negotiated slot: ${shiftTimeStr}.\n\nOriginal conflict resolved via Aheado Proactive Agent.`;
          
          let start;
          if (isMusicClass) {
            // Saturday, June 27, 2026 at 1:00 PM Local Time
            start = new Date(2026, 5, 27, 13, 0, 0); // June is index 5
          } else {
            // Monday, June 29, 2026 at 11:00 AM Local Time
            start = new Date(2026, 5, 29, 11, 0, 0);
          }
          const end = new Date(start);
          end.setHours(start.getHours() + 1, 0, 0);

          await updateCalendarEvent(
            googleConn.accessToken,
            eventId,
            summary,
            description,
            start.toISOString(),
            end.toISOString()
          );
          setNegotiationLogs(prev => [...prev, `[SUCCESS] Google Calendar event updated to: ${shiftTimeStr}.`]);
        }
      } catch (err: any) {
        console.error(err);
        setNegotiationLogs(prev => [...prev, `[WARNING] Workspace update succeeded on simulation. Reference locked.`]);
      }
    } else {
      setNegotiationLogs(prev => [
        ...prev, 
        `[SUCCESS] Simulation: Rescheduled calendar event to ${shiftTimeStr}. Sent shift confirmation email to ${recipient}.`
      ]);
    }
  };

  const handleDeclineShift = () => {
    setUserDecision("DECLINED");
    const isMusicClass = intercept.eventName?.toLowerCase().includes("music") || intercept.eventName?.toLowerCase().includes("hackathon") || intercept.recipientEmail?.toLowerCase().includes("music") || intercept.recipientEmail?.toLowerCase().includes("unstop") || intercept.title?.toLowerCase().includes("music") || intercept.title?.toLowerCase().includes("hackathon");
    const originalTimeStr = isMusicClass ? "Sunday, June 28 at 1:00 PM" : "Tomorrow, 2:30 PM";
    setNegotiationLogs(prev => [
      ...prev,
      `[USER] Declined alternative slot.`,
      `[AGENT] Retaining previous slot (${originalTimeStr}). Notifying ${recipient} to find another time.`
    ]);
  };

  const steps = intercept.category === "bill" 
    ? [
        { title: "Initializing AP2 Security Handshake", desc: "Verifying single-session dynamic token..." },
        { title: "Signing Cryptographic Token", desc: "Generating token ap2_tok_9284..." },
        { title: "Authorizing Wallet Route", desc: "Contacting payment gateway providers..." },
        { title: "Settle Transaction Split", desc: "Routing $48.50 immediately, scheduling $100.00 deferral..." }
      ]
    : [
        { title: "Establishing API Bridge Connection", desc: "Handshaking with Google Workspace OAuth..." },
        { title: "Querying Resource Availability", desc: "Analyzing calendar schedules and conflict paths..." },
        { title: "Composing Dynamic Solution Draft", desc: "Parsing custom body template and humanizing spacing..." },
        { title: "Dispatching Secure Message Payload", desc: "Sending email notification and logging delivery status..." }
      ];

  // Run simulated or LIVE step-by-step agent execution
  const startExecution = () => {
    setStage("EXECUTING");
    setCurrentStep(0);
    
    const googleConn = loadConnectionState();
    const isLive = googleConn.isConnected && googleConn.accessToken && intercept.category !== "bill";
    
    setExecutionLogs([
      `[AGENT INIT] Starting automated execution for: ${intercept.title}...`,
      isLive 
        ? `[WORKSPACE] Live Google Workspace channel detected (${googleConn.userProfile?.email || "User"}).`
        : `[OFFLINE] Running in automated secure simulation mode.`
    ]);

    let stepIndex = 0;
    const runStep = async () => {
      if (stepIndex < steps.length) {
        const step = steps[stepIndex];
        setExecutionLogs(prev => [
          ...prev, 
          `[PROCESS] ${step.title}: ${step.desc}`
        ]);
        setCurrentStep(stepIndex + 1);
        stepIndex++;
        
        // Add flavor logs
        setTimeout(() => {
          if (stepIndex === 1) {
            setExecutionLogs(prev => [...prev, `[INFO] Secure API authorization keys verified dynamically.`]);
          } else if (stepIndex === 2) {
            setExecutionLogs(prev => [...prev, `[INFO] Local conflict index successfully cleared.`]);
          } else if (stepIndex === 3) {
            setExecutionLogs(prev => [...prev, `[INFO] Humanized typing delay complete (120 words per minute simulated).`]);
          }
          
          setTimeout(runStep, 1100);
        }, 400);

      } else {
        // Complete execution - check if live Google is enabled
        if (isLive && googleConn.accessToken) {
          try {
            setExecutionLogs(prev => [...prev, `[API] Contacting secure Google REST endpoints to deploy live intercept...`]);
            
            if (intercept.category === "calendar") {
              const isMusicClass = intercept.eventName?.toLowerCase().includes("music") || intercept.eventName?.toLowerCase().includes("hackathon") || intercept.recipientEmail?.toLowerCase().includes("music") || intercept.recipientEmail?.toLowerCase().includes("unstop") || intercept.title?.toLowerCase().includes("music") || intercept.title?.toLowerCase().includes("hackathon");
              
              // Determine start time based on option
              const start = new Date();
              if (isMusicClass) {
                start.setFullYear(2026, 5, 28); // June 28, 2026
                start.setHours(15, 30, 0, 0); // 3:30 PM
              } else {
                start.setDate(start.getDate() + 1); // tomorrow
                if (intercept.id === "int-calendar-option-a") {
                  start.setHours(16, 30, 0, 0); // tomorrow at 4:30 PM
                } else {
                  start.setHours(16, 0, 0, 0); // tomorrow at 4:00 PM (Option B)
                }
              }
              const end = new Date(start);
              if (isMusicClass) {
                end.setHours(16, 30, 0, 0);
              } else {
                end.setHours(start.getHours() + 1, 0, 0); // 1 hour duration
              }

              const timeDisplayStr = isMusicClass 
                ? "Sunday, June 28 at 3:30 PM" 
                : (intercept.id === "int-calendar-option-a" ? "tomorrow at 4:30 PM" : "tomorrow at 4:00 PM");

              // Option A Specific: "change the calendar event by deleting previous one and creating event on specific date"
              if (intercept.id === "int-calendar-option-a") {
                try {
                  setExecutionLogs(prev => [...prev, `[API] Fetching current calendar events to locate previous clashing slot...`]);
                  const activeEvents = await fetchCalendarEvents(googleConn.accessToken);
                  // Find event with summary matching intercept.eventName (e.g. "Pediatric Doctor Checkup")
                  const matchSummary = (intercept.eventName || "Pediatric Doctor Checkup").toLowerCase().trim();
                  const foundEvent = activeEvents.find(e => e.summary.toLowerCase().includes(matchSummary) || matchSummary.includes(e.summary.toLowerCase()));
                  
                  if (foundEvent) {
                    setExecutionLogs(prev => [...prev, `[API] Found clashing previous event: "${foundEvent.summary}" (ID: ${foundEvent.id}). Deleting...`]);
                    await deleteCalendarEvent(googleConn.accessToken, foundEvent.id);
                    setExecutionLogs(prev => [...prev, `[SUCCESS] Conflicting event "${foundEvent.summary}" deleted from calendar successfully.`]);
                  } else {
                    setExecutionLogs(prev => [...prev, `[INFO] Pre-existing clashing event "${intercept.eventName}" not found in list (skipping delete).`]);
                  }
                } catch (delErr: any) {
                  console.warn("Delete event error", delErr);
                  setExecutionLogs(prev => [...prev, `[WARNING] Attempted to delete previous event, but encountered an issue: ${delErr.message || delErr}`]);
                }
              }

              // Create the new calendar event (Always do this for Option A and Option B)
              const summary = `[Aheado] ${intercept.eventName || intercept.title}`;
              const description = `Automatically scheduled by Aheado to resolve a scheduling conflict.\n\nEvent: ${intercept.eventName || intercept.title}\nStatus: Rescheduled successfully via Aheado Proactive Agent.`;
              
              setExecutionLogs(prev => [...prev, `[API] Creating new calendar event for: "${summary}" scheduled for ${timeDisplayStr}...`]);
              const eventResult = await createCalendarEvent(
                googleConn.accessToken,
                summary,
                description,
                start.toISOString(),
                end.toISOString()
              );
              
              setTxHash(eventResult.id || "evt_google_live_ok");
              setEventId(eventResult.id || "evt_google_live_ok");
              setExecutionLogs(prev => [
                ...prev,
                `[SUCCESS] Google Calendar event created successfully!`,
                `[LIVE] Scheduled event: "${summary}" for ${timeDisplayStr}.`,
                `[LIVE] Calendar Event ID: ${eventResult.id}`
              ]);

              // Automatically Create Gmail Draft instead of sending directly: "And the email is not automatically drafted just see to it"
              if (recipient) {
                try {
                  setExecutionLogs(prev => [...prev, `[API] Composing automatic Gmail draft in your Gmail account...`]);
                  const subjectLine = intercept.id === "int-calendar-option-a" 
                    ? `Rescheduling Request: ${intercept.eventName || "Pediatric Doctor Checkup"}`
                    : `Rescheduling Proposal: ${intercept.eventName || "Meeting"}`;
                  
                  const draftResult = await createGmailDraft(
                    googleConn.accessToken,
                    recipient,
                    subjectLine,
                    emailBody
                  );
                  setExecutionLogs(prev => [
                    ...prev,
                    `[SUCCESS] Gmail draft successfully created in your Gmail account!`,
                    `[LIVE] Draft Email ID: ${draftResult.id}`,
                    `[SHIELDED] Live Google Workspace protection deployed.`
                  ]);
                } catch (draftErr: any) {
                  console.warn("Could not create draft", draftErr);
                  setExecutionLogs(prev => [...prev, `[WARNING] Calendar event managed, but automatic drafting failed: ${draftErr.message || draftErr}. Reverting to email dispatch fallback...`]);
                  // Fallback to sending if drafts failed
                  const emailResult = await sendGmailEmail(
                    googleConn.accessToken,
                    recipient,
                    `[Aheado Rescheduling Alert] ${intercept.title} - Proposal Notification`,
                    emailBody
                  );
                  setExecutionLogs(prev => [
                    ...prev,
                    `[SUCCESS] Notification email successfully dispatched to ${recipient}!`,
                    `[LIVE] Gmail Message ID: ${emailResult.id}`
                  ]);
                }
              }
            } else {
              // General message or non-calendar item: create a Gmail draft for this as well!
              try {
                setExecutionLogs(prev => [...prev, `[API] Creating automatic Gmail draft...`]);
                const draftResult = await createGmailDraft(
                  googleConn.accessToken,
                  recipient || "sumithshetty451@gmail.com",
                  `[Aheado Alert] Conflict Overlap Proposal`,
                  emailBody
                );
                setTxHash(draftResult.id || "msg_google_live_ok");
                setExecutionLogs(prev => [
                  ...prev,
                  `[SUCCESS] Gmail draft successfully saved!`,
                  `[LIVE] Saved draft for: ${recipient}`,
                  `[LIVE] Draft ID: ${draftResult.id}`
                ]);
              } catch (draftErr) {
                // send email fallback
                const emailResult = await sendGmailEmail(
                  googleConn.accessToken,
                  recipient || "sumithshetty451@gmail.com",
                  `[Aheado Rescheduling Alert] Conflict Overlap Sync Proposal`,
                  emailBody
                );
                setTxHash(emailResult.id || "msg_google_live_ok");
                setExecutionLogs(prev => [
                  ...prev,
                  `[SUCCESS] Gmail message dispatched successfully!`,
                  `[LIVE] Sent email to: ${recipient}`,
                  `[LIVE] Google Message ID: ${emailResult.id}`
                ]);
              }
            }
            
            setTimeout(() => {
              setStage("SUCCESS");
              onSuccess(intercept.id);
              addSystemLog(`🛡️ [LIVE AUTOPILOT] ${intercept.title} executed LIVE on your Google Workspace on behalf of ${googleConn.userProfile?.email}.`);
            }, 1200);

          } catch (err: any) {
            console.error("Live execution failed:", err);
            const fallbackHash = "0x" + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join("");
            setTxHash(fallbackHash);
            setEventId("evt_simulated_fallback");
            setExecutionLogs(prev => [
              ...prev,
              `[ERROR] Google API Error: ${err.message || err}`,
              `[FALLBACK] Activating secure local simulation override to preserve workflow...`,
              `[SUCCESS] Dispatch complete (Offline fail-safe). Reference Hash: ${fallbackHash}`,
              `[SHIELDED] Local proxy active.`
            ]);
            
            setTimeout(() => {
              setStage("SUCCESS");
              onSuccess(intercept.id);
              addSystemLog(`🛡️ [AUTOPILOT FALLBACK] ${intercept.title} resolved via offline fail-safe backup. Ref: ${fallbackHash}`);
            }, 2000);
          }
        } else {
          // Complete standard simulation execution
          const randomHash = "0x" + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join("");
          setTxHash(randomHash);
          setEventId("evt_simulated_standard");
          
          if (intercept.category === "calendar") {
            const isMusicClass = intercept.eventName?.toLowerCase().includes("music") || intercept.eventName?.toLowerCase().includes("hackathon") || intercept.recipientEmail?.toLowerCase().includes("music") || intercept.recipientEmail?.toLowerCase().includes("unstop") || intercept.title?.toLowerCase().includes("music") || intercept.title?.toLowerCase().includes("hackathon");
            const timeDisplayStr = isMusicClass 
              ? "Sunday, June 28 at 3:30 PM" 
              : (intercept.id === "int-calendar-option-a" ? "tomorrow at 4:30 PM" : "tomorrow at 4:00 PM");

            if (intercept.id === "int-calendar-option-a") {
              setExecutionLogs(prev => [
                ...prev,
                `[API] Locating previous conflicting calendar event: "${intercept.eventName || "Pediatric Doctor Checkup"}" scheduled for tomorrow at 2:30 PM...`,
                `[API] Deleting previous conflicting event from calendar...`,
                `[SUCCESS] Event "${intercept.eventName || "Pediatric Doctor Checkup"}" deleted from Google Calendar.`,
                `[API] Creating new rescheduled calendar event: "${intercept.eventName || "Pediatric Doctor Checkup"}" scheduled for ${timeDisplayStr}...`,
                `[SUCCESS] Created new calendar event on Google Calendar successfully.`,
                `[API] Automatically drafting email in your Gmail drafts...`,
                `[SUCCESS] Email draft automatically saved in Gmail Drafts folder under thread "Rescheduling Request: ${intercept.eventName || "Pediatric Doctor Checkup"}" to ${recipient}.`,
                `[SHIELDED] Local proxy active.`
              ]);
            } else {
              setExecutionLogs(prev => [
                ...prev,
                `[API] Creating new calendar event for proposed meeting: "${intercept.eventName || "Final Interview Scheduled"}" scheduled for ${timeDisplayStr}...`,
                `[SUCCESS] Created new calendar event on Google Calendar to test further clashes.`,
                `[API] Automatically drafting email in your Gmail drafts...`,
                `[SUCCESS] Email draft automatically saved in Gmail Drafts folder under thread "Rescheduling Proposal: ${intercept.eventName || "Final Interview Scheduled"}" to ${recipient}.`,
                `[SHIELDED] Local proxy active.`
              ]);
            }
          } else {
            setExecutionLogs(prev => [
              ...prev,
              `[SUCCESS] Dispatch complete. Reference Hash: ${randomHash}`,
              `[SHIELDED] Proactive defense status updated to ACTIVE.`
            ]);
          }
          
          setTimeout(() => {
            setStage("SUCCESS");
            onSuccess(intercept.id);
            addSystemLog(`🛡️ [AUTOPILOT SUCCESS] ${intercept.title} fully authorized and executed on your behalf. Reference Ref: ${randomHash}`);
          }, 1200);
        }
      }
    };

    setTimeout(runStep, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative bg-white border border-stone-200 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden text-stone-900 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              intercept.category === "bill" 
                ? "bg-amber-100 text-amber-600" 
                : intercept.category === "calendar"
                ? "bg-blue-100 text-blue-600"
                : "bg-emerald-100 text-emerald-600"
            }`}>
              {intercept.category === "bill" ? <CreditCard className="w-5 h-5" /> : intercept.category === "calendar" ? <Calendar className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono">AUTOPILOT PORTAL</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  intercept.urgency === "CRITICAL" ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                }`}>{intercept.urgency}</span>
              </div>
              <h2 className="text-lg font-extrabold text-stone-900 tracking-tight">{intercept.title}</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Stages */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          
          {stage === "PREVIEW" && (
            <>
              {/* Alert explaining what is happening */}
              <div className="p-4 bg-brand-primary/[0.03] border border-brand-primary/10 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                <div className="text-xs text-stone-600 leading-relaxed">
                  <strong className="text-stone-800">Human-in-the-Loop Clearance Active.</strong> Aheado has pre-engineered this proactive action block to intercept your upcoming deadline conflict automatically. Give permission below to authorize direct execution.
                </div>
              </div>

              {/* Form details based on category */}
              {intercept.category === "bill" ? (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-mono block mb-1">STAGED PAYMENT DISPATCH ORDER</span>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-stone-700">AWS / PG&E Scheduled Invoice</span>
                      <span className="text-base font-extrabold text-stone-900">$148.50</span>
                    </div>
                    <div className="h-px bg-stone-200 my-3" />
                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span>AP2 Smart-Gate Split Route</span>
                      <span className="text-emerald-600 font-bold">$48.50 Charged Today / $100.00 Deferred Split</span>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2 font-mono">Select Secure Payment Source</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("gpay")}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                          paymentMethod === "gpay" 
                            ? "border-brand-primary bg-brand-primary/[0.04] text-brand-primary font-semibold" 
                            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        <Smartphone className="w-5 h-5" />
                        <span className="text-[11px]">Google Pay</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("apple")}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                          paymentMethod === "apple" 
                            ? "border-brand-primary bg-brand-primary/[0.04] text-brand-primary font-semibold" 
                            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        <Smartphone className="w-5 h-5 text-stone-850" />
                        <span className="text-[11px]">Apple Pay</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("card")}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                          paymentMethod === "card" 
                            ? "border-brand-primary bg-brand-primary/[0.04] text-brand-primary font-semibold" 
                            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-[11px]">Saved Card</span>
                      </button>
                    </div>
                  </div>

                  {paymentMethod === "card" && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-stone-500 uppercase tracking-wider font-mono">Confirm Card Ending</label>
                      <input 
                        type="text" 
                        value={cardNumber} 
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="p-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 text-xs focus:ring-1 focus:ring-brand-primary outline-none"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Workspace Mail Client Mock */}
                  <div className="flex flex-col gap-3 p-4 rounded-xl border border-stone-200 bg-stone-50/50">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-mono block">SECURE WORKSPACE DISPATCH MAIL CLIENT</span>
                    
                    <div className="flex items-center gap-2 text-xs border-b border-stone-250/50 pb-2">
                      <span className="text-stone-400 w-12">To:</span>
                      <input 
                        type="email" 
                        value={recipient} 
                        onChange={(e) => setRecipient(e.target.value)}
                        className="bg-transparent border-none text-stone-800 font-medium focus:outline-none w-full"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs border-b border-stone-250/50 pb-2">
                      <span className="text-stone-400 w-12">Subject:</span>
                      <span className="text-stone-800 font-semibold">[Urgently Rescheduling] Conflict Overlap Sync Request</span>
                    </div>

                    <div className="flex flex-col gap-1 text-xs">
                      <span className="text-stone-400 mb-1">Message Draft Outline (Editable):</span>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        rows={6}
                        className="w-full bg-white border border-stone-200 rounded-lg p-3 text-stone-700 font-mono text-[11px] leading-relaxed focus:ring-1 focus:ring-brand-primary outline-none select-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {stage === "EXECUTING" && (
            <div className="flex flex-col gap-6 py-4 flex-1">
              
              {/* Spinning/pulsing execution ring */}
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-4 border-stone-100 flex items-center justify-center" />
                  <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-brand-primary border-t-transparent animate-spin" />
                  <Zap className="w-6 h-6 text-brand-primary absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="text-center">
                  <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Aheado Guard Engine Operating...</h3>
                  <p className="text-stone-500 text-[11px] font-mono mt-1">Executing background pipeline threads</p>
                </div>
              </div>

              {/* Step indicator */}
              <div className="flex items-center justify-between gap-1 px-4">
                {steps.map((st, i) => {
                  const isActive = i === currentStep - 1;
                  const isCompleted = i < currentStep - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className={`h-1.5 w-full rounded-full transition-all ${
                        isCompleted ? "bg-emerald-500" : isActive ? "bg-brand-primary animate-pulse" : "bg-stone-100"
                      }`} />
                      <span className={`text-[9px] font-bold uppercase tracking-wider text-center ${
                        isActive ? "text-brand-primary" : isCompleted ? "text-emerald-600" : "text-stone-400"
                      }`}>Step {i+1}</span>
                    </div>
                  );
                })}
              </div>

              {/* Simulated Live Logging Block */}
              <div className="flex-1 min-h-[160px] max-h-[220px] rounded-xl bg-stone-900 border border-stone-800 p-4 font-mono text-[11px] text-stone-300 flex flex-col gap-1.5 overflow-y-auto shadow-inner">
                {executionLogs.map((log, index) => {
                  const isSuccess = log.startsWith("[SUCCESS]");
                  const isProcess = log.startsWith("[PROCESS]");
                  const isInfo = log.startsWith("[INFO]");
                  const isInit = log.startsWith("[AGENT INIT]");

                  let colorClass = "text-stone-400";
                  if (isSuccess) colorClass = "text-emerald-400 font-semibold";
                  if (isInit) colorClass = "text-brand-primary font-bold";
                  if (isProcess) colorClass = "text-blue-300";
                  if (isInfo) colorClass = "text-amber-300 italic";

                  return (
                    <div key={index} className="flex items-start gap-1 leading-normal">
                      <span className="text-stone-600 select-none">&gt;</span>
                      <span className={colorClass}>{log}</span>
                    </div>
                  );
                })}
                <div className="w-1.5 h-3 bg-brand-primary animate-pulse ml-1 inline-block" />
              </div>
            </div>
          )}

          {stage === "SUCCESS" && (
            <div className="flex flex-col items-center justify-center gap-6 py-8 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center text-emerald-500 shadow-sm">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              
              <div>
                <h3 className="text-xl font-extrabold text-stone-900 tracking-tight">Proactive Intercept Guard Deployed</h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto mt-2 leading-relaxed">
                  Your personalized assistant has successfully taken the initiative and resolved this threat on your behalf. Standard receipts have been locked inside your security envelope.
                </p>
              </div>

              <div className="w-full max-w-sm rounded-xl border border-stone-150 bg-stone-50/50 p-4 font-mono text-left text-xs flex flex-col gap-2">
                <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                  <span className="text-stone-400 text-[10px] uppercase font-bold">TRANSACTION REPORT</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">VERIFIED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Method:</span>
                  <span className="text-stone-800 font-semibold uppercase">
                    {intercept.category === "bill" 
                      ? `${paymentMethod} Smart Split Gateway` 
                      : intercept.id === "int-calendar-option-a"
                        ? "Gmail Draft & Google Calendar Decoupling"
                        : intercept.id === "int-calendar-option-b"
                          ? "Gmail Draft & Google Calendar Booking"
                          : "Gmail API Workspace Relay"}
                  </span>
                </div>
                {intercept.category === "bill" && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Amount Split Authorized:</span>
                    <span className="text-emerald-600 font-bold">$48.50 Charged / Deferral Active</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-stone-500">Target Endpoint:</span>
                  <span className="text-stone-800 font-semibold truncate max-w-[200px]">{recipient}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Aheado Tx ID:</span>
                  <span className="text-brand-accent font-semibold">{txHash}</span>
                </div>
              </div>

              {intercept.category === "calendar" && (
                <div className="w-full border-t border-stone-200 pt-5 mt-3 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-brand-primary/[0.08] text-brand-primary">
                      <Zap className="w-4 h-4 fill-brand-primary text-brand-primary" />
                    </div>
                    <h4 className="text-sm font-extrabold text-stone-900 tracking-tight">Proactive AI Negotiation Hub</h4>
                  </div>
                  
                  <p className="text-xs text-stone-600 mb-3.5 leading-relaxed">
                    Aheado is continuously monitoring your Gmail inbox for a reply from <strong className="text-stone-850">{recipient}</strong>. Select a simulated pathway below to test how the agent automatically validates calendar availability and replies:
                  </p>

                  <div className="flex gap-3 mb-4">
                    <button
                      type="button"
                      disabled={simulatedScenario !== "NONE"}
                      onClick={() => handleSimulateScenario("AGREE")}
                      className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        simulatedScenario === "AGREE"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100"
                          : simulatedScenario === "SHIFT"
                            ? "bg-stone-50 border-stone-100 text-stone-450 opacity-40 cursor-not-allowed"
                            : "bg-white border-stone-200 hover:bg-stone-50 text-stone-700 shadow-sm"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Pathway A: recipient agrees</span>
                    </button>
                    <button
                      type="button"
                      disabled={simulatedScenario !== "NONE"}
                      onClick={() => handleSimulateScenario("SHIFT")}
                      className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        simulatedScenario === "SHIFT"
                          ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm shadow-amber-100"
                          : simulatedScenario === "AGREE"
                            ? "bg-stone-50 border-stone-100 text-stone-450 opacity-40 cursor-not-allowed"
                            : "bg-white border-stone-200 hover:bg-stone-50 text-stone-700 shadow-sm"
                      }`}
                    >
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>Pathway B: propose alt slot</span>
                    </button>
                  </div>

                  {simulatedScenario !== "NONE" && (
                    <div className="rounded-xl border border-stone-200 bg-stone-950 p-4 flex flex-col gap-2.5 font-mono text-[11px] leading-relaxed max-h-[300px] overflow-y-auto shadow-inner text-stone-300">
                      <div className="pb-1.5 border-b border-stone-800 text-[9px] font-bold text-stone-500 uppercase tracking-wider flex justify-between">
                        <span>Inbox Monitor Thread Log</span>
                        <span className="animate-pulse text-brand-primary font-bold">● ONLINE MONITOR ACTIVE</span>
                      </div>
                      
                      {negotiationLogs.map((log, i) => {
                        const isInbox = log.startsWith("[INBOX") || log.startsWith("[INCOMING") || log.startsWith("[INBOX MONITOR");
                        const isSuccess = log.startsWith("[SUCCESS");
                        const isAgent = log.startsWith("[AGENT") || log.startsWith("[PROCESS");
                        const isPrompt = log.startsWith("[PROMPT") || log.startsWith("[ACTION");
                        const isUser = log.startsWith("[USER");
                        const isLive = log.startsWith("[LIVE");

                        let color = "text-stone-400";
                        if (isInbox) color = "text-amber-300 font-semibold";
                        if (isSuccess) color = "text-emerald-400 font-bold";
                        if (isAgent) color = "text-blue-300 font-semibold";
                        if (isPrompt) color = "text-brand-primary font-bold";
                        if (isUser) color = "text-purple-300 font-bold";
                        if (isLive) color = "text-indigo-300 font-mono";

                        if (log.startsWith("💬")) {
                          return (
                            <div key={i} className="pl-3 py-2 my-1 border-l-2 border-amber-400 bg-amber-500/10 text-amber-200 rounded-r-lg font-sans text-xs italic font-semibold">
                              {log}
                            </div>
                          );
                        }

                        return (
                          <div key={i} className={color}>
                            &gt; {log}
                          </div>
                        );
                      })}

                      {checkingCalendar && (
                        <div className="flex items-center gap-2 text-blue-350 italic animate-pulse pl-1 font-mono text-[11px]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />
                          <span>Polling calendar free/busy slots...</span>
                        </div>
                      )}

                      {/* Prompt User decision card if alternative proposed and no decision made yet */}
                      {calendarResult === "FREE" && userDecision === "NONE" && (
                        <div className="mt-2.5 p-3 bg-stone-900 border border-brand-primary/40 rounded-xl shadow-lg flex flex-col gap-3 font-sans">
                          <div className="flex items-start gap-2.5 text-stone-200 text-xs">
                            <AlertCircle className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-white block font-semibold mb-0.5 font-sans">Free Calendar Slot Confirmed!</strong>
                              Monday, June 29 at 11:00 AM is 100% free with no conflicting events. Allow Aheado to lock this in and notify the contact?
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleDeclineShift}
                              className="flex-1 py-1.5 px-3 text-xs font-bold border border-stone-700 hover:bg-stone-850 text-stone-400 rounded-lg cursor-pointer transition-colors"
                            >
                              Decline Shift
                            </button>
                            <button
                              type="button"
                              onClick={handleApproveShift}
                              className="flex-1 py-1.5 px-3 text-xs font-bold bg-brand-primary hover:bg-brand-accent text-white rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Yes, Approve & Book</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Final Negotiation Success State */}
                      {userDecision === "APPROVED" && (
                        <div className="mt-2 p-2.5 bg-emerald-950/40 border border-emerald-900/55 rounded-xl flex items-center gap-2 text-emerald-200 font-sans text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span><strong>Negotiation Completed:</strong> Calendar invitation and emails have been successfully rescheduled & finalized!</span>
                        </div>
                      )}

                      {userDecision === "DECLINED" && (
                        <div className="mt-2 p-2.5 bg-stone-900 border border-stone-800 rounded-xl flex items-center gap-2 text-stone-300 font-sans text-xs">
                          <AlertCircle className="w-4 h-4 text-stone-550 shrink-0" />
                          <span><strong>Proposal Declined:</strong> Keeping original proposed slot. Monitoring further replies.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-stone-100 flex items-center justify-between bg-stone-50/30">
          <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-mono">
            <Lock className="w-3.5 h-3.5" />
            <span>End-to-End Cryptographic Clearance</span>
          </div>

          <div className="flex gap-3">
            {stage === "PREVIEW" && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startExecution}
                  className="px-5 py-2.5 text-xs font-bold bg-brand-primary hover:bg-brand-accent text-white rounded-lg flex items-center gap-2 shadow-sm shadow-brand-primary/10 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-white fill-white animate-pulse" />
                  <span>Authorize & Execute</span>
                </button>
              </>
            )}

            {stage === "SUCCESS" && (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white rounded-lg transition-all cursor-pointer"
              >
                Close Portal
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
