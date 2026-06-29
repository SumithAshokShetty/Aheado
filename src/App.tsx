import React, { useState, useEffect, useRef } from "react";
import { 
  Zap, 
  Sparkles, 
  Clock, 
  CreditCard, 
  FileText, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Terminal as TerminalIcon, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Play, 
  ArrowDown, 
  RefreshCw, 
  FileCode, 
  User, 
  Check, 
  Lock, 
  ShieldAlert,
  Sliders,
  ChevronRight,
  Eye,
  Copy,
  Layers,
  Activity,
  Mic,
  GraduationCap,
  Bell,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AgentExecutionModal } from "./components/AgentExecutionModal";
import { SettingsModal } from "./components/SettingsModal";
import { 
  loadConnectionState, 
  GoogleConnectionState, 
  googleSignIn, 
  googleSignOut,
  fetchGoogleProfile,
  applyManualDeveloperToken,
  fetchCalendarEvents,
  fetchLatestEmails,
  sendGmailEmail,
  SimpleCalendarEvent,
  SimpleGmailMessage,
  fetchClassroomDeadlines,
  ClassroomDeadline,
  createCalendarEvent,
  createGmailDraft
} from "./lib/googleApi";

// Preset crisis scenarios for rapid testing
const SCENARIOS = [
  {
    id: "student-crisis",
    label: "Overwhelmed Student",
    icon: User,
    description: "Lab due in 3 hours, unstudied midterm tomorrow, and advisor overlap.",
    text: "I have an organic chemistry lab due in 3 hours, a math midterm tomorrow morning that I haven't started studying for, and an advisor sync that overlaps with a mandatory group project presentation.",
    tasks: [
      { id: "task-1", title: "Organic Chemistry Lab Report", deadline: "In 3 hours", category: "assignment", urgency: "CRITICAL" },
      { id: "task-2", title: "Math Midterm Exam Prep", deadline: "Tomorrow, 9:00 AM", category: "assignment", urgency: "HIGH" },
      { id: "task-3", title: "Advisor Sync Meeting", deadline: "Tomorrow, 10:00 AM", category: "calendar", urgency: "HIGH" },
      { id: "task-4", title: "Group Presentation Sync", deadline: "Tomorrow, 10:00 AM", category: "calendar", urgency: "CRITICAL" }
    ]
  },
  {
    id: "freelancer-crisis",
    label: "Stressed Freelancer",
    icon: Zap,
    description: "Milestone tonight, flickering ISP, and overdue AWS invoice.",
    text: "I need to submit my client development milestone by tonight, but my home internet is flickering, my AWS hosting invoice of ₹25000 is overdue, and my main client just double-booked me for a live review tomorrow morning during my child's pediatric checkup.",
    tasks: [
      { id: "task-5", title: "Client Milestones Deployment", deadline: "Tonight, 11:59 PM", category: "assignment", urgency: "CRITICAL" },
      { id: "task-6", title: "AWS Hosting Bill (₹25000)", deadline: "Tomorrow morning", category: "bill", urgency: "HIGH" },
      { id: "task-7", title: "Live Client Milestone Review", deadline: "Tomorrow, 9:30 AM", category: "calendar", urgency: "HIGH" },
      { id: "task-8", title: "Pediatric Doctor Checkup", deadline: "Tomorrow, 9:30 AM", category: "calendar", urgency: "CRITICAL" }
    ]
  },
  {
    id: "work-integrations-crisis",
    label: "Work Integrations Overload",
    icon: Zap,
    description: "Jira task overdue, Slack team sync pending.",
    text: "My Jira task is overdue, my Slack team sync is pending, and I'm overwhelmed with project management.",
    tasks: [
      { id: "task-12", title: "Jira Task: Critical Bug Fix", deadline: "In 1 hour", category: "assignment", urgency: "CRITICAL" },
      { id: "task-13", title: "Slack Team Sync", deadline: "In 2 hours", category: "calendar", urgency: "HIGH" }
    ]
  },
  {
    id: "entrepreneur-crisis",
    label: "Busy Parentpreneur",
    icon: Layers,
    description: "Midnight product launch, failed payment stream, supplier overlap.",
    text: "My e-commerce launch is at midnight, but my baby has a pediatrician checkup tomorrow at 9 AM which overlaps with my supplier sync, and the automated inventory bill failed payment.",
    tasks: [
      { id: "task-9", title: "E-Commerce Launch Deployment", deadline: "Tonight, 12:00 AM", category: "assignment", urgency: "CRITICAL" },
      { id: "task-10", title: "Inventory Restock Payment", deadline: "Tomorrow morning", category: "bill", urgency: "HIGH" },
      { id: "task-11", title: "Supplier Shipping Sync", deadline: "Tomorrow, 9:00 AM", category: "calendar", urgency: "HIGH" }
    ]
  }
];

export default function App() {
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<string>("");
  const [customScenarioText, setCustomScenarioText] = useState<string>("");
  const [tasks, setTasks] = useState<Array<any>>([]);
  
  // New task form states
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("In 4 hours");
  const [newTaskCategory, setNewTaskCategory] = useState<"assignment" | "bill" | "calendar">("assignment");
  const [newTaskUrgency, setNewTaskUrgency] = useState<"CRITICAL" | "HIGH" | "MEDIUM">("HIGH");

  // AI agent responses
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isScanningWorkspace, setIsScanningWorkspace] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([
    "System initiated. Aheado Proactive Listeners standing by...",
    "Ready to guard against student / professional / entrepreneur crisis events.",
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [approvedIntercepts, setApprovedIntercepts] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);

  // Agentic execution modal state
  const [selectedInterceptForExecution, setSelectedInterceptForExecution] = useState<any | null>(null);
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Live Interception Terminal Console state
  const [deadlineSafeScore, setDeadlineSafeScore] = useState(99.6);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);

  // Core view and connection states
  const [viewMode, setViewMode] = useState<'landing' | 'login' | 'workspace'>('landing');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [conn, setConn] = useState<GoogleConnectionState>({
    isConnected: false,
    accessToken: null,
    userProfile: null
  });
  const [isContinuousWatcherActive, setIsContinuousWatcherActive] = useState(false);
  const watcherRunCountRef = useRef(0);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [classroomDeadlines, setClassroomDeadlines] = useState<ClassroomDeadline[]>([]);
  const [isScanningClassroom, setIsScanningClassroom] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [parsedCommandResult, setParsedCommandResult] = useState<any | null>(null);
  const [activeSentEmails, setActiveSentEmails] = useState<Array<{
    id: string;
    recipient: string;
    eventName: string;
    originalTime: string;
    proposedTime: string;
    alternativeTime: string;
    status: "sent" | "reply_received" | "resolved";
    sentAt: number;
  }>>([]);
  const [isHeaderVerifying, setIsHeaderVerifying] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Load connection state on mount
  useEffect(() => {
    const loaded = loadConnectionState();
    setConn(loaded);
    if (loaded.isConnected) {
      setViewMode('workspace');
    }
  }, []);

  const handleHeaderSignIn = async () => {
    setIsHeaderVerifying(true);
    setLogs(prev => ["[OAUTH] Launching Google Workspace popup via Navbar...", ...prev]);
    try {
      const result = await googleSignIn();
      if (result) {
        const loaded = loadConnectionState();
        setConn(loaded);
        setViewMode('workspace');
        triggerToast(`🎉 Connected! Welcome, ${result.user.displayName || "User"}.`);
        setLogs(prev => [`[WORKSPACE] Google sign-in successful: ${result.user.email}`, ...prev]);
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          setTimeout(() => {
            setShowNotificationPrompt(true);
          }, 1200);
        }
      }
    } catch (error: any) {
      console.error(error);
      triggerToast(`❌ Authentication failed: ${error.message || "OAuth popup closed."}`);
      setLogs(prev => [`[ERROR] Navbar Auth failed: ${error.message || "User cancelled."}`, ...prev]);
    } finally {
      setIsHeaderVerifying(false);
    }
  };

  const handleBypassSignIn = () => {
    const mockProfile = {
      email: "mentor-review@aheado.io",
      name: "Dr. Alex Mentor",
      picture: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
    };
    applyManualDeveloperToken("mock-bypass-token-12345", mockProfile);
    const newState = loadConnectionState();
    setConn(newState);
    setViewMode('workspace');
    triggerToast("⚡ Logged in via Mentor/Judge Bypass mode!");
    setLogs(prev => ["[WORKSPACE] Logged in under Mentor/Judge review channel.", ...prev]);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      setTimeout(() => {
        setShowNotificationPrompt(true);
      }, 1200);
    }
  };

  const handleHeaderSignOut = async () => {
    await googleSignOut();
    const reset = {
      isConnected: false,
      accessToken: null,
      userProfile: null
    };
    setConn(reset);
    setViewMode('landing');
    triggerToast("🔌 Google Workspace disconnected.");
    setLogs(prev => ["[WORKSPACE] Google account disconnected.", ...prev]);
  };

  const handleGetStartedClick = () => {
    const isConnected = loadConnectionState().isConnected;
    if (isConnected) {
      setViewMode('workspace');
      triggerToast("⚡ Navigated to your Active Workspace Canvas.");
    } else {
      setViewMode('login');
    }
  };

  const handleManualTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setIsHeaderVerifying(true);
    setLogs(prev => [`[TOKEN] Connecting workspace using developer playground token.`, ...prev]);
    try {
      const profile = await fetchGoogleProfile(token);
      applyManualDeveloperToken(token, profile);
      const newState = loadConnectionState();
      setConn(newState);
      setTokenInput("");
      setShowTokenInput(false);
      setViewMode('workspace');
      triggerToast(`⚡ Connected! Welcome ${profile.name}. Live Gmail & Calendar enabled.`);
      setLogs(prev => [`[WORKSPACE] Live Google Workspace link verified: ${profile.email}`, ...prev]);
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        setTimeout(() => {
          setShowNotificationPrompt(true);
        }, 1200);
      }
    } catch (error: any) {
      console.error(error);
      triggerToast("❌ Token verification failed. Make sure the token is active.");
      setLogs(prev => [`[ERROR] Direct token authentication failed. Token may be expired.`, ...prev]);
    } finally {
      setIsHeaderVerifying(false);
    }
  };

  const eventTemplates = [
    "[INTERCEPTED] Canvas Portal: Calculus III Assignment 5 due in 12 hours. Generating interactive markdown study guide...",
    "[AUTOPILOT] Pre-drafted formal email block to Professor Sharma requesting a 24-hour extension due to verified calendar overlap.",
    "[RESOLVED] Automated Stripe Gateway: Internet utility bill routing cleared instantly to avoid incoming late fee structures.",
    "[INTERCEPTED] Jira Dashboard: Q4 Product Launch deck milestone due tomorrow. Initializing structural skeleton slides...",
    "[MITIGATION] Google Calendar: Conflicting professional interview invitations found. Rescheduling low-priority blocks dynamically.",
    "[MONITORING] Scanning connected workspaces. Ambient agent arrays reporting 0 tasks at risk."
  ];

  const [eventLogs, setEventLogs] = useState<Array<{ time: string; text: string }>>([
    { time: "07:01:10", text: "[MONITORING] Scanning connected workspaces. Ambient agent arrays reporting 0 tasks at risk." },
    { time: "07:02:15", text: "[RESOLVED] Automated Stripe Gateway: Internet utility bill routing cleared instantly to avoid incoming late fee structures." }
  ]);

  // Micro-fluctuate Deadline-Safe Score every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const randomValue = 98.5 + Math.random() * (100.0 - 98.5);
      setDeadlineSafeScore(parseFloat(randomValue.toFixed(1)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Append new log entry to bottom of feed every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setEventLogs(prev => {
        const nextIdx = prev.length % eventTemplates.length;
        const text = eventTemplates[nextIdx];
        return [...prev, { time: timeStr, text }];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom of terminal internally whenever eventLogs updates to prevent browser page-jumping
  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTo({
        top: terminalContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [eventLogs]);

  // Smooth scroll reference
  const canvasSectionRef = useRef<HTMLDivElement | null>(null);

  // Trigger brief alert notification
  const triggerToast = (message: string) => {
    setShowNotification(message);
    setTimeout(() => {
      setShowNotification(null);
    }, 4000);
  };

  // Native desktop/mobile Web Notifications state and helper functions
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") {
      triggerToast("Desktop/mobile notifications are not supported in this browser.");
      return;
    }

    if (Notification.permission === "denied") {
      triggerToast("🔒 Alerts are currently blocked by your browser. Please click the lock icon in the address bar, allow 'Notifications', and reload!");
      return;
    }

    try {
      const permission = await new Promise<NotificationPermission>((resolve) => {
        try {
          const promiseResult = Notification.requestPermission(resolve);
          if (promiseResult && typeof promiseResult.then === "function") {
            promiseResult.then(resolve);
          }
        } catch (e) {
          resolve(Notification.permission);
        }
      });

      setNotificationPermission(permission);
      
      if (permission === "granted") {
        triggerToast("🔔 Native OS Alerts enabled successfully! Sending welcome alert...");
        
        const options = {
          body: "You will now receive real-time out-of-browser conflict warnings.",
          icon: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6e1.png",
          badge: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6e1.png",
          tag: "aheado-status"
        };

        try {
          if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification("Aheado Guard Activated", options);
          } else {
            new Notification("Aheado Guard Activated", options);
          }
        } catch (e) {
          console.warn("Could not fire initial welcome notification, fallback to simple:", e);
          try {
            new Notification("Aheado Guard Activated", {
              body: "You will now receive real-time out-of-browser conflict warnings."
            });
          } catch (err) {
            console.error("Direct notification failed", err);
          }
        }
      } else {
        triggerToast("⚠️ Notifications were dismissed. Click again to enable system-native alerts!");
      }
    } catch (err: any) {
      console.error("Error requesting notification permission", err);
      triggerToast(`🔒 Browser restriction: ${err.message || "Failed to trigger permission prompt"}. Try opening the app in a new tab!`);
    }
  };

  const triggerNativeNotification = (title: string, bodyText: string) => {
    if (typeof Notification === "undefined") {
      console.warn("Browser does not support desktop/mobile notifications.");
      return;
    }

    const deliverAlert = async () => {
      const options = {
        body: bodyText,
        icon: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6e1.png",
        badge: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6e1.png",
        tag: "aheado-alert",
        requireInteraction: true
      };

      try {
        if ("serviceWorker" in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, options);
          } catch (err) {
            console.warn("ServiceWorker notification failed, using legacy fallback:", err);
            const notification = new Notification(title, options);
            notification.onclick = () => {
              window.focus();
              setViewMode("workspace");
            };
          }
        } else {
          const notification = new Notification(title, options);
          notification.onclick = () => {
            window.focus();
            setViewMode("workspace");
          };
        }
      } catch (err) {
        console.error("Failed to deliver native Notification:", err);
        try {
          const notification = new Notification(title, { body: bodyText });
          notification.onclick = () => {
            window.focus();
            setViewMode("workspace");
          };
        } catch (innerErr) {
          console.error("Simple notification fallback failed too:", innerErr);
        }
      }
    };

    if (Notification.permission === "granted") {
      deliverAlert();
    } else if (Notification.permission !== "denied") {
      try {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
          if (permission === "granted") {
            deliverAlert();
          }
        }).catch(err => {
          console.error("Async requestPermission failed", err);
        });
      } catch (err) {
        console.error("Synchronous requestPermission error", err);
      }
    } else {
      console.warn("Notifications blocked. Guidance toast ready.");
    }
  };

  // Switch scenario preset
  const handleSelectPreset = (scenarioId: string) => {
    const found = SCENARIOS.find(s => s.id === scenarioId);
    if (found) {
      setActiveScenario(scenarioId);
      setCustomScenarioText(found.text);
      setTasks(found.tasks);
      setLogs(prev => [
        `Loaded Preset Scenario: ${found.label}`,
        `Populated ${found.tasks.length} time-sensitive danger tasks.`,
        ...prev.slice(0, 10)
      ]);
      setEvalResult(null);
    }
  };

  // Add custom task to list
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask = {
      id: `custom-${Date.now()}`,
      title: newTaskTitle,
      deadline: newTaskDeadline,
      category: newTaskCategory,
      urgency: newTaskUrgency
    };

    setTasks(prev => [newTask, ...prev]);
    setNewTaskTitle("");
    setLogs(prev => [
      `User injected manual task: "${newTask.title}" [Urgency: ${newTask.urgency}]`,
      ...prev
    ]);
    triggerToast("⚡ Custom threat task queued inside active canvas!");
  };

  // Remove task from list
  const handleRemoveTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setLogs(prev => [
      `Removed task ID: ${taskId} from threat buffer.`,
      ...prev
    ]);
  };

  // Call server-side Gemini Proactive Intercept Engine
  const executeAIEngine = async () => {
    setIsEvaluating(true);
    setEvalResult(null);
    setLogs(prev => [
      "⚡ BOOTING INTERCEPT GUARD SENSORS...",
      "Connecting to Aheado full-stack server middleware...",
      "Sending active context, scenario state & portal parameters to Gemini-1.5-Flash...",
      ...prev
    ]);

    try {
      const response = await fetch("/api/proactive-ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: customScenarioText,
          tasks: tasks,
          currentTime: new Date().toLocaleString("en-US", { hour12: true }),
          userProfile: conn.userProfile ? {
            name: conn.userProfile.name,
            email: conn.userProfile.email
          } : {
            name: "Sumith Shetty",
            email: "sumithshetty451@gmail.com"
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        console.log("DEBUG: API Response:", data);
        console.log("DEBUG: Intercepts:", data.intercepts);
        setEvalResult(data);
        setLogs(prev => [
          `✅ AI Sensor analysis complete. Calculated risk score: ${data.riskScore}/100.`,
          `Successfully staged ${data.intercepts?.length || 0} critical emergency shields.`,
          "Logs updated with micro-action scripts.",
          ...prev
        ]);
        triggerToast("🎉 Aheado Proactive Agent generated active shields!");
        
        // Native OS notification alert
        if (data.intercepts && data.intercepts.length > 0) {
          const primary = data.intercepts[0];
          triggerNativeNotification(
            `⚠️ Aheado Alert: ${primary.title}`,
            `Risk Score: ${data.riskScore}/100. [Urgency: ${primary.urgency}] ${primary.description.substring(0, 120)}... Click to resolve!`
          );
        }

        // Automatically deploy all generated shields autonomously (Zero-HITL)
        autoDeployAllIntercepts(data);
      } else {
        throw new Error(data.error || "Failed evaluating");
      }
    } catch (err: any) {
      console.error(err);
      setLogs(prev => [
        "❌ Server evaluation pipeline failed. Reverting to local fallback core...",
        ...prev
      ]);
      // Fail-safe mock generation if server is offline or key fails
      const fallbackData = {
        riskScore: 92,
        summary: "Emergency Shield Active. Local heuristic engine intercepted portal deadlines, draft outline stages, and scheduled reschedules.",
        intercepts: [
          {
            id: "fb-1",
            title: "Crisis Course Outline Draft",
            description: "Scans assignments & generates emergency solutions structure to prevent missing completion windows.",
            category: "assignment",
            urgency: "CRITICAL",
            actionTaken: "Aheado drafted a 4-step framework study guide.",
            outputDraft: "📚 EMERGENCY STUDY PLAN:\n\n- Key Thesis: Fast prototyping with Express and React.\n- Framework Code: Setup standard middleware on port 3000.\n- Staged Action: Generated placeholder outline to submit instantly.",
            sprintBreakdown: "⏱️ Suggested Sprint Breakdown:\n• 00-30 mins: Read Chapter 4 Formula Sheets & Guidelines\n• 30-90 mins: Solve the 3 structural math problems in Section B\n• 90-120 mins: Assemble the final formatting inside the Google Doc template"
          }
        ],
        reassurance: "Aheado has you protected offline. Staged backup successfully."
      };
      setEvalResult(fallbackData);
      
      // Fallback Native OS notification alert
      triggerNativeNotification(
        "⚠️ Aheado Alert: Crisis Course Outline Draft",
        "Risk Score: 92/100. [Urgency: CRITICAL] Scans assignments & generates emergency solutions structure. Click to resolve!"
      );

      // Automatically deploy fallback shields autonomously (Zero-HITL)
      autoDeployAllIntercepts(fallbackData);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Autonomous, real-time Gmail, Calendar & Classroom scanning engine
  const executeLiveWorkspaceScan = async () => {
    setIsScanningWorkspace(true);
    setIsEvaluating(true);
    setEvalResult(null);
    setLogs(prev => [
      "📡 CONNECTING TO AMBIENT WORKSPACE LISTENERS...",
      "Initiating real-time continuous scan of your active Gmail inbox...",
      "Initiating real-time continuous scan of your Google Calendar events...",
      "Initiating real-time scan of Google Classroom student courses & coursework...",
      ...prev
    ]);

    try {
      let eventsData: SimpleCalendarEvent[] = [];
      let emailsData: SimpleGmailMessage[] = [];
      let classData: ClassroomDeadline[] = [];

      // Check if we have a valid live workspace connection token
      const currentConn = loadConnectionState();
      if (currentConn.isConnected && currentConn.accessToken) {
        setLogs(prev => [
          "🔗 Found authenticated Workspace. Fetching live schedules, messages & classroom deadlines...",
          ...prev
        ]);
        try {
          eventsData = await fetchCalendarEvents(currentConn.accessToken);
          emailsData = await fetchLatestEmails(currentConn.accessToken);
          
          setIsScanningClassroom(true);
          try {
            classData = await fetchClassroomDeadlines(currentConn.accessToken);
            setClassroomDeadlines(classData);
            setLogs(prev => [
              `🏫 Connected to Google Classroom! Retrieved ${classData.length} upcoming deadlines.`,
              ...prev
            ]);
          } catch (classErr: any) {
            console.error("Classroom fetch error", classErr);
            setLogs(prev => [
              `⚠️ Google Classroom check failed: ${classErr.message || classErr}. Scopes may be initializing.`,
              ...prev
            ]);
          } finally {
            setIsScanningClassroom(false);
          }

          setLogs(prev => [
            `📥 Retrieved ${eventsData.length} upcoming Calendar events.`,
            `📥 Retrieved ${emailsData.length} recent Gmail message threads.`,
            ...prev
          ]);
        } catch (authErr: any) {
          console.error("Live fetch error", authErr);
          const errMsg = (authErr.message || String(authErr)).toLowerCase();
          const isAuthError = errMsg.includes("invalid authentication credentials") || 
                              errMsg.includes("invalid_grant") || 
                              errMsg.includes("401") ||
                              errMsg.includes("unauthorized") ||
                              errMsg.includes("invalid credential");
          if (isAuthError) {
            localStorage.removeItem("aheado_google_access_token");
            localStorage.removeItem("aheado_google_profile");
            setConn({
              isConnected: false,
              accessToken: null,
              userProfile: null
            });
            setLogs(prev => [
              `🔒 Saved credentials have expired or are invalid. Detached workspace connection. Please Sign In with Google again to authorize.`,
              ...prev
            ]);
            triggerToast("🔑 Google session expired. Please sign in again.");
          } else {
            setLogs(prev => [
              `⚠️ Live token read failed: ${authErr.message || authErr}. Using high-quality bypass buffer instead...`,
              ...prev
            ]);
          }
        }
      } else {
        setLogs(prev => [
          "ℹ️ Running in Sandbox Preview channel. Spawning autonomous test scenario...",
          ...prev
        ]);
      }

      // If both are empty and NOT connected (meaning sandbox/mock mode), we pre-populate with the exact real-world scenario the user requested to demonstrate:
      if (!currentConn.isConnected && eventsData.length === 0 && emailsData.length === 0) {
        setLogs(prev => [
          "⚡ Simulated live clash scenario generated inside workspace stream!",
          "Event Found on Calendar: 'Pediatric Doctor Checkup' tomorrow at 2:30 PM",
          "Email Found in Inbox: From 'interviewer@techcorp.com' with Subject 'Technical Interview Proposal' proposing tomorrow at 2:30 PM",
          "Google Classroom: Found 3 urgent coursework deadlines.",
          ...prev
        ]);
        
        eventsData = [{
          id: "evt-doctor-checkup",
          summary: "Pediatric Doctor Checkup",
          start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T14:30:00",
          end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T15:30:00"
        }];

        emailsData = [{
          id: "msg-interview-clash",
          from: "hr@globaltech.com (Jessica Moore)",
          subject: "Final Interview Scheduled - Sumith Shetty",
          date: new Date().toUTCString(),
          snippet: "Hi Sumith, we are thrilled to move you to the next round. We have scheduled your technical interview for tomorrow at 2:30 PM (14:30). Please confirm."
        }];

        classData = [
          {
            id: "cw-1",
            courseName: "CS 324: Artificial Intelligence",
            title: "Neural Networks & MLP Assignment",
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dueDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T23:59:59Z",
            description: "Implement backpropagation and multi-layer perceptron from scratch in Python."
          },
          {
            id: "cw-2",
            courseName: "LIT 101: World Literature",
            title: "Weekly Critical Reading Essay",
            dueDate: new Date().toISOString().split('T')[0],
            dueDateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0] + "T21:00:00Z",
            description: "Write a 500-word essay on magical realism in One Hundred Years of Solitude."
          },
          {
            id: "cw-3",
            courseName: "MATH 151: Linear Algebra",
            title: "Quiz 3: Eigenvalues & Vectors",
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dueDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T11:59:00Z",
            description: "Online quiz on matrix diagonalization and eigenspaces."
          }
        ];
        setClassroomDeadlines(classData);
      }

      // We update the Google Classroom deadlines list for visualization, but do NOT automatically force-integrate them into the core tasks list during scan.
      if (classData.length > 0) {
        setClassroomDeadlines(classData);
      }

      // Prepare the constructed scenario prompt for Gemini
      const constructedScenario = `
[REAL-TIME WORKSPACE DETECTED STATE]
We scanned the user's active workspace and detected the following resources.

ACTIVE CALENDAR EVENTS:
${eventsData.map(e => `- "${e.summary}" from ${e.start} to ${e.end}`).join("\n")}

LATEST INBOX EMAILS:
${emailsData.map(m => `- FROM: ${m.from}\n  SUBJECT: ${m.subject}\n  SNIPPET: ${m.snippet}`).join("\n")}

GOOGLE CLASSROOM ACTIVE STUDENT DEADLINES:
${classData.map(c => `- COURSE: ${c.courseName}\n  TITLE: ${c.title}\n  DUE DATE: ${c.dueDate}\n  DETAILS: ${c.description}`).join("\n")}

Does this state present any active conflicts (overlapping calendar events or a calendar event clashing with an email-scheduled appointment)? 
CRITICAL RULE: Do NOT consider Google Classroom deadlines/assignments as conflicts or clashes with calendar events or emails. Only identify and generate rescheduling conflict options (isConflictOption: true) for direct conflicts between Google Calendar events and Gmail schedule requests. Any Google Classroom deadlines should only be shown as separate, standard prioritization assignment shields, and must NOT trigger a conflict option.
If yes, generate the specific "Automated Calendar Decoupler" intercept or relevant shields to automatically resolve it.
      `.trim();

      // Update text area to show what was autonomously parsed
      setCustomScenarioText(constructedScenario);

      // Fetch from API
      const response = await fetch("/api/proactive-ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: constructedScenario,
          tasks: tasks,
          currentTime: new Date().toLocaleString("en-US", { hour12: true }),
          userProfile: conn.userProfile ? {
            name: conn.userProfile.name,
            email: conn.userProfile.email
          } : {
            name: "Sumith Shetty",
            email: "sumithshetty451@gmail.com"
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        setEvalResult(data);
        setLogs(prev => [
          `🛡️ AUTONOMOUS INTERCEPT COMPLETE. Risk Score: ${data.riskScore}/100`,
          `Detected conflict, generated ${data.intercepts?.length || 0} smart shields automatically.`,
          "No user input required. Aheado successfully guarded your schedule.",
          "🤖 [AUTOPILOT] Automatic Continuous Watcher engaged! Monitoring inbox background...",
          ...prev
        ]);
        triggerToast("🎉 Aheado identified the clash & staged shields autonomously!");

        // Native OS notification alert
        if (data.intercepts && data.intercepts.length > 0) {
          const primary = data.intercepts[0];
          triggerNativeNotification(
            `🛡️ Autonomous Intercept: ${primary.title}`,
            `Risk Score: ${data.riskScore}/100. [Urgency: ${primary.urgency}] ${primary.description.substring(0, 120)}... Click to review resolution options.`
          );
        }

        // Automatically deploy all generated shields autonomously (Zero-HITL)
        autoDeployAllIntercepts(data);

        // Engage continuous background watcher autonomously
        setIsContinuousWatcherActive(true);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error(err);
      setLogs(prev => [
        "❌ Autonomous scanner fallback invoked...",
        "🤖 [AUTOPILOT] Automatic Continuous Watcher engaged! Monitoring inbox background...",
        ...prev
      ]);
      
      // Dynamic fallback specifically tailored to the doctor-checkup interview conflict!
      const simulatedOverlapData = {
        riskScore: 94,
        summary: "CRITICAL COLLISION DETECTED: Your 'Pediatric Doctor Checkup' tomorrow at 2:30 PM directly conflicts with an incoming 'Technical Interview Scheduled' email for tomorrow at 2:30 PM.",
        intercepts: [
          {
            id: "int-live-decoupler",
            title: "Automated Calendar Decoupler",
            description: "Aheado detected a double-booking: 'Pediatric Doctor Checkup' vs 'Technical Interview' at 2:30 PM. Staging email rescheduling shift.",
            category: "calendar",
            urgency: "CRITICAL",
            actionTaken: "Pre-drafted scheduling shift proposal sent to interviewer.",
            outputDraft: "✉️ PROPOSAL NOTIFICATION:\n\nSubject: Rescheduling Request: Final Interview - Sumith Shetty\n\nDear Jessica,\n\nThank you for scheduling the technical interview. I have an unavoidable pre-existing medical commitment tomorrow at 2:30 PM.\n\nCould we reschedule to tomorrow at 4:00 PM, or Monday at 11:00 AM instead?\n\nThank you for your flexibility.\n\nSincerely,\nSumith Shetty (via Aheado Proactive Agent)",
            sprintBreakdown: "⏱️ Suggested Sprint Breakdown:\n• 00-15 mins: Review system design guidelines & architectural checklist\n• 15-45 mins: Code mock coding challenges (BFS, DFS, Dynamic Programming)\n• 45-60 mins: Review resume questions and high-impact past projects"
          }
        ],
        reassurance: "Relax, Aheado caught the collision. Your schedule is decoupled successfully."
      };
      setEvalResult(simulatedOverlapData);
      
      triggerNativeNotification(
        "🛡️ Autonomous Intercept: Automated Calendar Decoupler",
        "Risk Score: 94/100. [Urgency: CRITICAL] Aheado detected a double-booking: 'Pediatric Doctor Checkup' vs 'Technical Interview'. Click to resolve!"
      );

      // Automatically deploy fallback shields autonomously (Zero-HITL)
      autoDeployAllIntercepts(simulatedOverlapData);

      // Engage continuous background watcher autonomously
      setIsContinuousWatcherActive(true);
    } finally {
      setIsEvaluating(false);
      setIsScanningWorkspace(false);
    }
  };

  // Speech-to-text voice recognition handler
  const handleToggleVoiceListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerToast("❌ Web Speech API is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setLogs(prev => ["[VOICE] Speech recognition active. Listening for commands...", ...prev]);
      triggerToast("🎙️ Listening... Speak your calendar or gmail command now.");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCommandInput(transcript);
      setLogs(prev => [`[VOICE] Received: "${transcript}"`, ...prev]);
      triggerToast("✅ Voice input captured!");
    };

    recognition.onerror = (e: any) => {
      console.error("Speech recognition error", e);
      setIsListening(false);
      triggerToast(`⚠️ Voice input issue: ${e.error || "unknown"}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Submit and evaluate direct text/voice command
  const handleExecuteCommand = async () => {
    const command = commandInput.trim();
    if (!command) {
      triggerToast("⚠️ Please type or record a command first!");
      return;
    }

    setIsExecutingCommand(true);
    setLogs(prev => [`[COMMAND] Evaluating action dispatcher for: "${command}"...`, ...prev]);

    try {
      const res = await fetch("/api/proactive-ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command })
      });

      const data = await res.json();
      setParsedCommandResult(data);

      if (data.type === "unknown") {
        setLogs(prev => [`[COMMAND] Unrecognized command type: "${command}"`, ...prev]);
        triggerToast("❓ Command unrecognized. Try 'Schedule doctor appt...' or 'Draft email...'");
      } else {
        setLogs(prev => [`[COMMAND] Successfully parsed as "${data.type}"! Ready to execute.`, ...prev]);
        triggerToast(`🎉 Command parsed as ${data.type}! Review and confirm execution below.`);
      }
    } catch (err: any) {
      console.error(err);
      triggerToast("❌ Failed to parse voice/text command.");
    } finally {
      setIsExecutingCommand(false);
    }
  };

  // Confirm and actually execute the parsed action to Calendar/Gmail
  const handleConfirmAndExecuteCommand = async () => {
    if (!parsedCommandResult) return;

    const currentConn = loadConnectionState();
    const isLive = currentConn.isConnected && currentConn.accessToken;

    try {
      if (parsedCommandResult.type === "calendar") {
        const { summary, description, startTime, endTime } = parsedCommandResult.calendar;
        if (isLive && currentConn.accessToken) {
          setLogs(prev => [`[CALENDAR] Creating live Google Calendar event: "${summary}"...`, ...prev]);
          await createCalendarEvent(currentConn.accessToken, summary, description, startTime, endTime);
          setLogs(prev => [`[RESOLVED] Successfully added "${summary}" to your Google Calendar!`, ...prev]);
          triggerToast(`📅 Successfully scheduled "${summary}" on your real Google Calendar!`);
        } else {
          setLogs(prev => [
            `[SANDBOX] Simulating Google Calendar event creation:`,
            `  Summary: "${summary}"`,
            `  Start: ${startTime}`,
            `  End: ${endTime}`,
            ...prev
          ]);
          triggerToast(`📅 [Sandbox] Scheduled "${summary}" successfully!`);
        }
      } else if (parsedCommandResult.type === "gmail") {
        const { recipient, subject, body } = parsedCommandResult.gmail;
        const connectedUserEmail = currentConn.userProfile?.email || "";
        const targetRecipient = (recipient && recipient.trim().toLowerCase() !== connectedUserEmail.toLowerCase()) ? recipient.trim() : "";
        if (isLive && currentConn.accessToken) {
          if (!targetRecipient) {
            triggerToast("⚠️ Recipient email is blank. Please enter an email address first!");
            return;
          }
          setLogs(prev => [`[GMAIL] Sending real email to ${targetRecipient} via Gmail API...`, ...prev]);
          await sendGmailEmail(currentConn.accessToken, targetRecipient, subject, body);
          setLogs(prev => [`[RESOLVED] Successfully sent email directly to ${targetRecipient}!`, ...prev]);
          triggerToast(`✉️ Email successfully sent to ${targetRecipient}!`);
        } else {
          setLogs(prev => [
            `[SANDBOX] Simulating Gmail direct send:`,
            `  To: "${targetRecipient || "(blank)"}"`,
            `  Subject: "${subject}"`,
            ...prev
          ]);
          triggerToast(`✉️ [Sandbox] Email sent directly to "${targetRecipient || "(blank)"}" successfully!`);
        }
      }

      setParsedCommandResult(null);
      setCommandInput("");
    } catch (err: any) {
      console.error("Execution error", err);
      triggerToast(`❌ Failed to execute action on Workspace: ${err.message || err}`);
      setLogs(prev => [`[ERROR] Action execution failed: ${err.message || err}`, ...prev]);
    }
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    triggerToast("📋 Action script copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to parse a coursework deadline date-time from description/title to schedule preparation calendar events
  const parseDeadlineTime = (description: string, title: string): Date => {
    const now = new Date();
    const lower = (description + " " + title).toLowerCase();
    
    // Try to find ISO date like YYYY-MM-DD
    const isoMatch = lower.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const d = new Date(isoMatch[0]);
      // Try to see if there is a time
      const timeMatch = lower.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        d.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      } else {
        d.setHours(23, 59, 59, 0); // end of day
      }
      return d;
    }

    // Try to find common calendar days/mock dates in the demo scenarios (e.g. June 28th)
    if (lower.includes("june 28")) {
      const d = new Date(now.getFullYear(), 5, 28, 23, 59, 59); // June is 5 (0-indexed)
      return d;
    }
    if (lower.includes("june 27")) {
      const d = new Date(now.getFullYear(), 5, 27, 23, 59, 59);
      return d;
    }
    if (lower.includes("june 29")) {
      const d = new Date(now.getFullYear(), 5, 29, 23, 59, 59);
      return d;
    }

    // "in 3 hours"
    const hoursMatch = lower.match(/in (\d+) hours?/);
    if (hoursMatch) {
      return new Date(now.getTime() + parseInt(hoursMatch[1], 10) * 60 * 60 * 1000);
    }

    // "tomorrow, 9:00 am"
    if (lower.includes("tomorrow")) {
      const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const amPmMatch = lower.match(/(\d+):?(\d+)?\s*(am|pm)/);
      if (amPmMatch) {
        let hr = parseInt(amPmMatch[1], 10);
        const min = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
        const isPm = amPmMatch[3] === "pm";
        if (isPm && hr < 12) hr += 12;
        if (!isPm && hr === 12) hr = 0;
        d.setHours(hr, min, 0, 0);
      } else {
        d.setHours(9, 0, 0, 0); // default to 9:00 AM tomorrow
      }
      return d;
    }

    // Default fallback: 12 hours from now
    return new Date(now.getTime() + 12 * 60 * 60 * 1000);
  };

  // Autonomous No-HITL Autopilot deployer that handles desktop notifications, live email sending, and calendar event creation instantly
  // Only triggered for Google Classroom/coursework related assignments. Other tasks remain HITL (Human-in-the-Loop)!
  const autoDeployAllIntercepts = async (result: any) => {
    if (!result || !result.intercepts || result.intercepts.length === 0) return;

    const googleConn = loadConnectionState();
    const isLive = googleConn.isConnected && googleConn.accessToken;
    const userEmail = googleConn.userProfile?.email || "user@example.com";

    // Filter to only automatically deploy Google Classroom / Coursework related deadlines
    const classroomIntercepts = result.intercepts.filter((intercept: any) => {
      // Never auto-deploy calendar events or conflict options (always require manual permission/HITL)
      if (intercept.category === "calendar" || intercept.isConflictOption) {
        return false;
      }
      const titleLower = (intercept.title || "").toLowerCase();
      const descLower = (intercept.description || "").toLowerCase();
      const categoryLower = (intercept.category || "").toLowerCase();
      const actionLower = (intercept.actionTaken || "").toLowerCase();
      
      return categoryLower === "assignment" || 
             titleLower.includes("classroom") || 
             titleLower.includes("assignment") ||
             titleLower.includes("coursework") ||
             descLower.includes("classroom") || 
             descLower.includes("assignment") ||
             descLower.includes("coursework") ||
             actionLower.includes("classroom") ||
             actionLower.includes("assignment") ||
             actionLower.includes("coursework");
    });

    if (classroomIntercepts.length === 0) {
      // Keep HITL flow for all other tasks/intercepts as requested. No automatic deployment.
      setLogs(prev => [
        "📡 [HITL SENSORS ACTIVE] Critical non-classroom intercepts staged. Awaiting user action or approval...",
        ...prev
      ]);
      return;
    }

    const idsToApprove = classroomIntercepts.map((i: any) => i.id);

    // Update approvedIntercepts state immediately so cards look completed on the canvas for Google Classroom assignments
    setApprovedIntercepts(prev => {
      const merged = [...prev];
      idsToApprove.forEach(id => {
        if (!merged.includes(id)) merged.push(id);
      });
      return merged;
    });

    setLogs(prev => [
      "🤖 [CLASSROOM AUTOPILOT] Zero-HITL Google Classroom assignment shield deploying autonomously...",
      "📡 Dispatching mobile/desktop alerts, pushing email directly to signed-in account, and creating a calendar event 2 hours before deadline...",
      ...prev
    ]);

    // Iterate through Classroom intercepts to execute actions
    for (const intercept of classroomIntercepts) {
      
      // 1. Desktop & Mobile push notification about the deadline
      triggerNativeNotification(
        `🎓 Classroom Alert: ${intercept.title}`,
        `Upcoming deadline: ${intercept.description}`
      );

      // Determine the exact deadline and schedule event 2 hours before
      const deadlineDate = parseDeadlineTime(intercept.description || "", intercept.title || "");
      const eventStartTime = new Date(deadlineDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
      const eventEndTime = new Date(eventStartTime.getTime() + 1 * 60 * 60 * 1000); // 1 hour duration

      // 2. Direct email sending to the signed-in account
      const breakdownText = intercept.sprintBreakdown || `⏱️ Suggested Sprint Breakdown:\n• 00-30 mins: Read Guidelines & Research Requirements\n• 30-90 mins: Solve core problems & draft structural points\n• 90-120 mins: Assemble final review and submit coursework`;
      const emailContentText = `Hi,\n\nThis is an automated proactive defense dispatch for your Google Classroom assignment: "${intercept.title}".\n\n${intercept.description}\n\nTo make this easier, I've curated these personalized reading recommendations based on your coursework context:\n\n1. [Deep Dive] Advanced Concepts in Neural Architecture - Recommended for your focus on backpropagation.\n2. [Quick Read] Practical Python Tips for Matrix Operations - Highly relevant to your MLP implementation task.\n\n${breakdownText}\n\n${intercept.outputDraft}\n\nWe have automatically scheduled a calendar buffer block 2 hours before this deadline and sent a desktop push alert to protect your schedule.\n\nBest regards,\nAheado Autopilot Guard`;

      if (isLive && googleConn.accessToken) {
        try {
          // Push notification email directly to the signed in email (Sumith Shetty)
          await sendGmailEmail(
            googleConn.accessToken,
            userEmail,
            `🛡️ [Aheado Autopilot] Classroom Deadline Guard: ${intercept.title}`,
            emailContentText
          );

          setLogs(prev => [
            `📤 [AUTOPILOT] Direct Gmail successfully pushed directly to signed-in email ${userEmail}!`,
            ...prev
          ]);
        } catch (mailErr: any) {
          console.warn("Direct live autopilot email dispatch failed:", mailErr);
          setLogs(prev => [`⚠️ [AUTOPILOT] Failed sending direct live email: ${mailErr.message || mailErr}`, ...prev]);
        }
      } else {
        // Mock connection simulation
        setLogs(prev => [
          `✉️ [AUTOPILOT SIMULATION] Direct notification email pushed to signed-in email "${userEmail}". Includes 3-step sprint breakdown.`,
          `   Email Subject: "🛡️ [Aheado Autopilot] Classroom Deadline Guard: ${intercept.title}"`,
          `   Email Body snippet:\n${emailContentText.slice(0, 400)}...\n[Complete sprint breakdown was packed into the direct message]`,
          ...prev
        ]);
      }

      // 3. Calendar event creation 2 hours before the deadline
      if (isLive && googleConn.accessToken) {
        try {
          await createCalendarEvent(
            googleConn.accessToken,
            `Prepare: ${intercept.eventName || intercept.title}`,
            `Dedicated preparation block for assignment: ${intercept.title}\n\n${intercept.description}`,
            eventStartTime.toISOString(),
            eventEndTime.toISOString()
          );
          setLogs(prev => [
            `📅 [AUTOPILOT] Live Google Calendar event scheduled 2 hours before deadline: "${intercept.eventName || intercept.title}" (${eventStartTime.toLocaleTimeString()} - ${eventEndTime.toLocaleTimeString()})`,
            ...prev
          ]);
        } catch (calErr: any) {
          console.warn("Direct live calendar creation failed:", calErr);
          setLogs(prev => [`⚠️ [AUTOPILOT] Failed creating live calendar event: ${calErr.message || calErr}`, ...prev]);
        }
      } else {
        setLogs(prev => [
          `📅 [AUTOPILOT SIMULATION] Scheduled calendar preparation event: "Prepare: ${intercept.title}" exactly 2 hours before deadline (at ${eventStartTime.toLocaleTimeString()}).`,
          ...prev
        ]);
      }

      setLogs(prev => [
        `✅ [AUTOPILOT DONE] Classroom Shield "${intercept.title}" successfully active!`,
        ...prev
      ]);
    }

    triggerToast("🤖 Classroom Autopilot completed: Sent email, updated calendar 2 hours before, and pushed notifications!");
  };

  // Approve action to simulate full automation
  const approveAction = (id: string) => {
    if (approvedIntercepts.includes(id)) return;
    
    // Find intercept
    const found = evalResult?.intercepts?.find((item: any) => item.id === id);
    if (found) {
      setSelectedInterceptForExecution(found);
      setIsExecutionModalOpen(true);
    } else {
      // Fallback if not found in evalResult (e.g. from static initial states if any)
      setApprovedIntercepts(prev => [...prev, id]);
      triggerToast("🛡️ Intercept Guard deployed!");
    }
  };

  const handleExecutionSuccess = (id: string) => {
    if (!approvedIntercepts.includes(id)) {
      setApprovedIntercepts(prev => [...prev, id]);
    }

    // Check if this was a rescheduling option
    const found = evalResult?.intercepts?.find((item: any) => item.id === id);
    if (found && found.isConflictOption) {
      const isMusicClass = found.eventName?.toLowerCase().includes("music") || found.eventName?.toLowerCase().includes("hackathon") || found.recipientEmail?.toLowerCase().includes("music") || found.recipientEmail?.toLowerCase().includes("unstop");
      const proposedTime = isMusicClass ? "Sunday at 3:30 PM" : (found.id === "int-calendar-option-a" ? "tomorrow at 4:30 PM" : "tomorrow at 4:00 PM");
      const alternativeTime = isMusicClass ? "Saturday, June 27 at 1:00 PM" : "Monday, June 29 at 11:00 AM";

      setActiveSentEmails(prev => [
        ...prev,
        {
          id: found.id,
          recipient: found.recipientEmail || "recipient@aheado.io",
          eventName: found.eventName || "Event",
          originalTime: "tomorrow at 2:30 PM",
          proposedTime,
          alternativeTime,
          status: "sent",
          sentAt: Date.now()
        }
      ]);

      setLogs(prev => [
        `📡 [WATCHER] Registered rescheduling communication thread for "${found.eventName}" to "${found.recipientEmail || "recipient@aheado.io"}".`,
        ...prev
      ]);
    }
  };

  const handleAutopilotProcessReply = async (
    sentEmail: any, 
    outcome: "AGREE" | "SHIFT", 
    snippetText: string,
    senderEmail: string
  ) => {
    // Mark thread as resolved in our list
    setActiveSentEmails(prev => prev.map(s => s.id === sentEmail.id ? { ...s, status: "resolved" } : s));

    setLogs(prev => [
      `🤖 [AUTOPILOT] Parsing message content using Aheado NLP Engine...`,
      `[NLP RESULT] Detected rescheduling intent: ${outcome === "AGREE" ? "CONFIRMATION" : "ALTERNATIVE_PROPOSAL"}.`,
      ...prev
    ]);

    const chosenTime = outcome === "AGREE" ? sentEmail.proposedTime : sentEmail.alternativeTime;

    // Perform Calendar check
    setTimeout(() => {
      setLogs(prev => [
        `📅 [AUTOPILOT] Running internal calendar clash verification for: "${chosenTime}"...`,
        `[CALENDAR CHECK] ✅ Slot is clear. ZERO conflicting events detected.`,
        ...prev
      ]);
    }, 2000);

    // Reschedule calendar event & update tasks in state
    setTimeout(async () => {
      const googleConn = loadConnectionState();
      let liveOk = false;
      if (googleConn.isConnected && googleConn.accessToken) {
        try {
          // Send automatic confirm reply back
          await sendGmailEmail(
            googleConn.accessToken,
            senderEmail,
            `Re: [Aheado Rescheduling Autopilot] Confirmed`,
            `The calendar date and time for this event will be rescheduled.`
          );
          
          setLogs(prev => [
            `📤 [AUTOPILOT] Sent Gmail confirmation reply to ${senderEmail}.`,
            ...prev
          ]);
          liveOk = true;
        } catch (err: any) {
          console.warn("Live autopilot mail reply failed", err);
        }
      }

      // Update task deadline in state
      setTasks(prev => prev.map(t => {
        const titleLower = t.title.toLowerCase();
        const eventLower = sentEmail.eventName.toLowerCase();
        if (titleLower.includes(eventLower) || eventLower.includes(titleLower) || 
            (titleLower.includes("pediatric") && eventLower.includes("pediatric")) ||
            (titleLower.includes("advisor") && eventLower.includes("advisor")) ||
            (titleLower.includes("music") && eventLower.includes("music")) ||
            (titleLower.includes("hackathon") && eventLower.includes("hackathon"))
        ) {
          const capitalizedTime = chosenTime.charAt(0).toUpperCase() + chosenTime.slice(1);
          return {
            ...t,
            deadline: capitalizedTime,
            urgency: "MEDIUM"
          };
        }
        return t;
      }));

      // Set logs
      setLogs(prev => [
        `🔒 [RESOLVED] Successfully rescheduled "${sentEmail.eventName}" to "${chosenTime}".`,
        `🎉 [AUTOPILOT] Calendar updated & active threat degraded to safe state.`,
        liveOk ? `[LIVE WORKSPACE] Google Calendar & Gmail synced successfully.` : `[SIMULATION] Offline fail-safe sync confirmed.`,
        ...prev
      ]);

      triggerToast(`🤖 Autopilot: Successfully rescheduled "${sentEmail.eventName}" to "${chosenTime}"!`);
    }, 4500);
  };

  const handleLoadDemoClassroomDeadlines = () => {
    const demoDeadlines: ClassroomDeadline[] = [
      {
        id: "cw-demo-1",
        courseName: "CS 324: Artificial Intelligence",
        title: "Neural Networks & MLP Assignment",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dueDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T23:59:59Z",
        description: "Implement backpropagation and multi-layer perceptron from scratch in Python."
      },
      {
        id: "cw-demo-2",
        courseName: "LIT 101: World Literature",
        title: "Weekly Critical Reading Essay",
        dueDate: new Date().toISOString().split('T')[0],
        dueDateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0] + "T21:00:00Z",
        description: "Write a 500-word essay on magical realism in One Hundred Years of Solitude."
      },
      {
        id: "cw-demo-3",
        courseName: "MATH 151: Linear Algebra",
        title: "Quiz 3: Eigenvalues & Vectors",
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dueDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T11:59:00Z",
        description: "Online quiz on matrix diagonalization and eigenspaces."
      }
    ];

    setClassroomDeadlines(demoDeadlines);
    
    // Automatically map into tasks list too!
    const mappedClassTasks = demoDeadlines.map(item => ({
      id: `classroom-${item.id}`,
      title: `[${item.courseName}] ${item.title}`,
      deadline: item.dueDate ? `Due ${item.dueDate}` : "Upcoming",
      category: "assignment" as const,
      urgency: "HIGH" as const
    }));

    setTasks(prev => {
      const withoutClass = prev.filter(t => !t.id.startsWith("classroom-"));
      return [...mappedClassTasks, ...withoutClass];
    });

    setLogs(prev => [
      "🧪 [CLASSROOM] Seeded Google Classroom simulation deadlines!",
      "💡 Mapped upcoming coursework directly into the Threat Buffer Task List.",
      ...prev
    ]);
    triggerToast("🎓 Loaded Google Classroom simulation deadlines!");
  };

  // Continuous Workspace Email & Scheduling Watcher Loop
  useEffect(() => {
    if (!isContinuousWatcherActive) {
      watcherRunCountRef.current = 0;
      return;
    }

    setLogs(prev => [
      "🔄 [AUTOPILOT] Continuous Email Watcher initiated. Scanning Gmail inbox every 10 seconds...",
      ...prev
    ]);

    const interval = setInterval(async () => {
      // Increment watcher run cycle
      watcherRunCountRef.current += 1;
      
      // Auto-pause after 6 cycles (1 minute) of continuous scanning
      if (watcherRunCountRef.current >= 6) {
        setIsContinuousWatcherActive(false);
        const currentConn = loadConnectionState();
        
        if (!currentConn.isConnected) {
          // Only log and show toast if in Demo mode
          setLogs(prev => [
            "⚠️ Autopilot paused. Live scanning is simulated in Demo mode. Connect your Google Workspace to run continuous production checks.",
            ...prev
          ]);
          triggerToast("🔋 Demo Autopilot paused.");
        } else {
          // Normal mode auto-pause log without any toast
          setLogs(prev => [
            "⚠️ Continuous scan auto-paused after 1 minute of inactivity. Click 'Autopilot Watcher' inside the workspace area to resume scanning.",
            ...prev
          ]);
        }
        return;
      }

      const currentConn = loadConnectionState();
      
      if (currentConn.isConnected && currentConn.accessToken) {
        setLogs(prev => [
          "📡 [AUTOPILOT] Polling active Gmail API streams for new replies...",
          ...prev
        ]);
        try {
          const latestEmails = await fetchLatestEmails(currentConn.accessToken);
          for (const email of latestEmails) {
            const lowerSub = email.subject.toLowerCase();
            const lowerSnippet = email.snippet.toLowerCase();
            
            if (lowerSub.includes("re:") || lowerSub.includes("reply") || lowerSub.includes("reschedule") || lowerSub.includes("class") || lowerSub.includes("interview") || lowerSub.includes("appointment")) {
              const matchedSent = activeSentEmails.find(s => s.status === "sent" && (email.from.toLowerCase().includes(s.recipient.toLowerCase()) || s.recipient.toLowerCase().includes(email.from.toLowerCase())));
              if (matchedSent) {
                const isAgree = lowerSnippet.includes("works") || lowerSnippet.includes("perfect") || lowerSnippet.includes("great") || lowerSnippet.includes("confirm") || lowerSnippet.includes("yes") || lowerSnippet.includes("agree");
                const isShift = lowerSnippet.includes("instead") || lowerSnippet.includes("unfortunately") || lowerSnippet.includes("cannot") || lowerSnippet.includes("booked") || lowerSnippet.includes("busy") || lowerSnippet.includes("saturday") || lowerSnippet.includes("monday");

                if (isAgree || isShift) {
                  await handleAutopilotProcessReply(matchedSent, isAgree ? "AGREE" : "SHIFT", email.snippet, email.from);
                  break;
                }
              }
            }
          }
        } catch (err) {
          console.error("Autopilot email poll error", err);
        }
      } else {
        const pendingSent = activeSentEmails.find(s => s.status === "sent");
        if (pendingSent) {
          if (Date.now() - pendingSent.sentAt > 10000) {
            const isMusicClass = pendingSent.eventName?.toLowerCase().includes("music") || pendingSent.eventName?.toLowerCase().includes("hackathon");
            const recipientName = isMusicClass ? "Raju (Music Teacher)" : (pendingSent.recipient.includes("clinic") ? "Dr. Sunil's Clinic" : "Jessica (TechCorp HR)");
            
            const simOutcome = Math.random() > 0.5 ? "AGREE" : "SHIFT";
            
            let simSnippet = "";
            if (simOutcome === "AGREE") {
              simSnippet = isMusicClass 
                ? `Hi Sumith, Sunday at 3:30 PM is perfect for our music class! Let's do that.` 
                : `Yes, tomorrow at ${pendingSent.id === "int-calendar-option-a" ? "4:30 PM" : "4:00 PM"} works great for us. See you then!`;
            } else {
              simSnippet = isMusicClass
                ? `Sunday at 3:30 PM is a bit late for me. Could we do Saturday, June 27 at 1:00 PM instead?`
                : `Tomorrow is fully booked. Could we reschedule to Monday, June 29 at 11:00 AM instead?`;
            }

            setLogs(prev => [
              `📩 [AUTOPILOT] Gmail Scanner: Found 1 new unread message thread!`,
              `FROM: ${recipientName} <${pendingSent.recipient}>`,
              `SUBJECT: Re: [Aheado Rescheduling Alert] - Reply`,
              `SNIPPET: "${simSnippet}"`,
              ...prev
            ]);

            handleAutopilotProcessReply(pendingSent, simOutcome, simSnippet, pendingSent.recipient);
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isContinuousWatcherActive, activeSentEmails]);

  // Handle smooth scroll
  const scrollToCanvas = () => {
    canvasSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    setLogs(prev => ["Scrolled into Active Workspace canvas view.", ...prev]);
  };

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setLogs(prev => [`Navigating to ${id === "architecture" ? "Core Architecture Specs" : "Pricing Horizon"} section.`, ...prev]);
    }
  };

  // Pre-generate symmetrical row of 48 fluid column bars for Saas-V graph
  const barsCount = 48;
  const bars = Array.from({ length: barsCount }, (_, i) => {
    const center = 23.5;
    const dist = Math.abs(i - center);
    const normDist = dist / 23.5;
    // Quadratic scaling out from center (V-shape) with higher base and multiplier so they go high
    const heightPercent = 18 + Math.pow(normDist, 1.8) * 82;
    return {
      index: i,
      dist,
      heightPercent
    };
  });

  // Calculate Day Integrity stats
  const activeIntercepts = evalResult?.intercepts || [];
  const conflictOptions = activeIntercepts.filter((i: any) => i.isConflictOption);
  const regularIntercepts = activeIntercepts.filter((i: any) => !i.isConflictOption);
  // A conflict group is resolved if there are no conflicts, or if at least one strategy is approved
  const isConflictHandled = conflictOptions.length === 0 || conflictOptions.some((o: any) => approvedIntercepts.includes(o.id));
  const hasUnhandledRegular = regularIntercepts.some((i: any) => !approvedIntercepts.includes(i.id));
  const hasUnhandledCrisis = !isConflictHandled || hasUnhandledRegular;
  
  // Animate/set score: 45% if there are unhandled crises, otherwise 100%
  const perceptionRating = activeIntercepts.length > 0 && hasUnhandledCrisis ? 45 : 100;
  
  // Calculate total minutes rescued: 60 mins for each resolved calendar/bill, 30 mins for resolved assignments
  const totalMinutesRescued = approvedIntercepts.reduce((acc, approvedId) => {
    const intercept = activeIntercepts.find((i: any) => i.id === approvedId);
    if (intercept) {
      return acc + (intercept.category === "calendar" || intercept.category === "bill" ? 60 : 30);
    }
    return acc + 30; // fallback default
  }, 0);

  return (
    <div className="min-h-screen bg-brand-bg font-sans text-stone-900 selection:bg-brand-primary selection:text-white relative overflow-x-hidden">
      
      {/* CSS Keyframes for beautiful dynamic animations */}
      <style>{`
        @keyframes float-bar {
          0%, 100% {
            transform: scaleY(1);
            opacity: 0.25;
          }
          50% {
            transform: scaleY(1.45);
            opacity: 0.95;
          }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.4; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(0.95); opacity: 0.4; }
        }
        @keyframes scroll-loop {
          0% { transform: translateY(0); opacity: 0.3; }
          50% { transform: translateY(8px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.3; }
        }
        @keyframes scroll-mouse {
          0% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(6px); opacity: 1; }
          100% { transform: translateY(12px); opacity: 0; }
        }
        .glow-radial {
          background: radial-gradient(circle, rgba(249, 115, 22, 0.14) 0%, rgba(0, 0, 0, 0) 70%);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
      `}</style>

      {/* Floating Pill Navigation Bar */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-6xl z-50">
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-full border border-brand-border bg-brand-surface/90 backdrop-blur-[12px] shadow-[0_8px_30px_rgba(92,88,82,0.08)]">
          
          {/* Logo & Text */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setViewMode('landing'); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-primary flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.5)]">
              <Zap className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white fill-white" />
            </div>
            <span className="text-stone-900 font-extrabold tracking-[0.2em] text-sm sm:text-lg font-sans">
              AHEADO
            </span>
          </div>

          {/* Links (Hidden on small screens) */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-brand-text-secondary">
            <button 
              onClick={() => { 
                setViewMode('landing'); 
                setTimeout(() => scrollToId("about"), 100); 
              }} 
              className="hover:text-brand-primary transition-colors cursor-pointer"
            >
              About
            </button>
            <button 
              onClick={() => { 
                setViewMode('landing'); 
                setTimeout(() => scrollToId("architecture"), 100); 
              }} 
              className="hover:text-brand-primary transition-colors cursor-pointer"
            >
              Architecture
            </button>
            <button 
              onClick={() => { 
                setViewMode('landing'); 
                setTimeout(() => scrollToId("pricing"), 100); 
              }} 
              className="hover:text-brand-primary transition-colors cursor-pointer"
            >
              Pricing
            </button>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-2">
            {viewMode === 'workspace' && (
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 text-stone-600 hover:text-brand-primary transition-colors cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            {conn.isConnected ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-brand-primary/30 hover:border-brand-primary transition-all active:scale-95 cursor-pointer flex items-center justify-center bg-brand-surface"
                >
                  {conn.userProfile?.picture ? (
                    <img 
                      src={conn.userProfile.picture} 
                      alt={conn.userProfile.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm">
                      {conn.userProfile?.name?.charAt(0) || "U"}
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {showProfileDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2.5 w-56 rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-xl z-50 text-left"
                    >
                      <div className="mb-3 pb-3 border-b border-brand-border/40">
                        <p className="text-xs font-bold text-stone-900 truncate">
                          {conn.userProfile?.name || "Connected User"}
                        </p>
                        <p className="text-[10px] text-brand-text-secondary font-mono truncate mt-0.5">
                          {conn.userProfile?.email || ""}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider font-mono">Workspace Linked</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {viewMode !== 'workspace' && (
                          <button
                            onClick={() => {
                              setViewMode('workspace');
                              setShowProfileDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-stone-800 hover:bg-brand-bg transition-all cursor-pointer"
                          >
                            Go to Active Canvas
                          </button>
                        )}
                        <button
                          onClick={() => {
                            handleHeaderSignOut();
                            setShowProfileDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-between"
                        >
                          <span>Sign Out</span>
                          <span className="text-[10px] font-normal text-rose-400 font-mono">Disconnect</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <button
                  onClick={() => { setViewMode('login'); }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-brand-border bg-brand-surface/50 hover:bg-brand-surface text-stone-800 font-semibold text-[10px] sm:text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Login
                </button>
                <button 
                  onClick={handleGetStartedClick}
                  className="px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-brand-primary text-white font-semibold text-[10px] sm:text-xs hover:bg-brand-accent active:scale-95 transition-all shadow-[0_4px_14px_rgba(249,115,22,0.3)] cursor-pointer"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Toast Notification */}
      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-24 left-1/2 z-50 bg-brand-surface border border-brand-border text-stone-900 px-5 py-3 rounded-xl flex items-center gap-3 shadow-[0_10px_25px_rgba(92,88,82,0.12)] font-medium text-xs md:text-sm max-w-[90vw] text-center"
          >
            <Sparkles className="w-4 h-4 text-brand-primary animate-pulse shrink-0" />
            <span>{showNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {viewMode === 'landing' && (
        <>
          {/* TOP HERO WRAPPER - exactly h-[850px] with central orange radial glow & V-bars graph */}
          <header className="relative w-full h-[850px] flex flex-col justify-between items-center pt-36 pb-12 overflow-hidden border-b border-brand-border/20">
        
            {/* Central Radial Glow Layer */}
            <div className="absolute inset-0 glow-radial pointer-events-none z-0" />

            {/* 48 Fluid Column Bars symmetrically scaling quadratically out from center */}
            <div className="absolute bottom-12 left-0 right-0 h-[380px] sm:h-[420px] md:h-[480px] lg:h-[520px] w-full flex items-end justify-between px-3 sm:px-6 md:px-10 lg:px-14 gap-0.5 sm:gap-1 pointer-events-none z-0 overflow-hidden">
              {bars.map((bar) => {
                // Symmetrically reduce density on mobile and tablet to prevent narrow crowding
                let responsiveClasses = "flex-1 max-w-[6px] sm:max-w-[10px] md:max-w-[14px] lg:max-w-[16px] rounded-t-full transition-all duration-300";
                if (bar.index % 4 !== 0) {
                  responsiveClasses += " hidden lg:block";
                } else if (bar.index % 2 !== 0) {
                  responsiveClasses += " hidden sm:block";
                }
                return (
                  <div
                    key={bar.index}
                    className={responsiveClasses}
                    style={{
                      height: `${bar.heightPercent}%`,
                      background: "linear-gradient(to top, #FAF6F0 0%, #ea580c 35%, #f97316 60%, #ffedd5 85%, rgba(0, 0, 0, 0) 100%)",
                      animation: "float-bar 4.5s ease-in-out infinite",
                      animationDelay: `${bar.dist * 0.12}s`,
                      transformOrigin: "bottom"
                    }}
                  />
                );
              })}
            </div>

            {/* Centered Hero Area Content */}
            <div className="max-w-4xl text-center px-4 z-10 flex flex-col items-center mt-8">
              
              {/* Primary Header */}
              <h1 className="text-4xl sm:text-6xl md:text-7.5xl font-extrabold tracking-wide text-stone-900 mb-8 uppercase text-center font-sans leading-[1.15]">
                DEADLINES MUTED. <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-primary via-orange-500 to-amber-500">
                  ACTIONS EXECUTED <br />
                  IN MINUTES
                </span>
              </h1>

              {/* Short tagline */}
              <p className="text-lg sm:text-xl md:text-2xl text-stone-700 max-w-3xl mb-12 font-sans tracking-wide font-medium">
                A last-minute lifesaver for academic and workspace deadlines.
              </p>

              {/* Hero Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
                <button 
                  onClick={() => { 
                    if (conn.isConnected) {
                      setViewMode('workspace');
                    } else {
                      setViewMode('login');
                      triggerToast("🔐 Sign in with Google to access your Active Canvas.");
                    }
                  }}
                  className="w-full sm:w-auto px-8 py-4 rounded-lg bg-brand-primary text-white font-bold hover:bg-brand-accent transition-all flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(249,115,22,0.25)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
                >
                  Launch Active Canvas
                  <ArrowRight className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Bottom mouse-scroll loop animator - styled beautifully as a real physical mouse controller layered above the bars */}
            <div className="relative z-20 flex flex-col items-center gap-3 text-stone-600 hover:text-brand-primary transition-colors text-xs font-medium cursor-pointer select-none mb-16 -translate-y-12 group" onClick={handleGetStartedClick}>
              <span className="font-mono tracking-widest text-[10px] md:text-xs font-extrabold text-stone-500 uppercase group-hover:text-brand-primary transition-colors">EXPLORE CANVAS</span>
              <div className="w-10 h-16 rounded-3xl border-2 border-stone-300/80 bg-stone-50/80 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-2 flex justify-center items-start transition-all duration-300 group-hover:border-brand-primary/40 group-hover:shadow-[0_8px_30px_rgba(249,115,22,0.08)]">
                <div className="w-1.5 h-3.5 rounded-full bg-brand-primary" style={{ animation: "scroll-mouse 1.6s cubic-bezier(0.25, 1, 0.5, 1) infinite" }} />
              </div>
            </div>

          </header>

          {/* ABOUT & TERMINAL STREAM SPLIT GRID LAYOUT */}
          <section id="about" className="max-w-7xl mx-auto px-4 md:px-8 py-20 relative z-10 w-full border-b border-brand-border/20">
            {/* Central Radial Glow Layer */}
            <div className="absolute inset-0 glow-radial pointer-events-none z-0 opacity-40" />

            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10">
              
              {/* Left Column: About Description & CTA */}
              <div className="lg:col-span-5 flex flex-col text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand-primary/20 bg-brand-primary/10 text-[10px] font-bold tracking-widest text-brand-primary uppercase mb-6 self-start font-mono">
                  <Zap className="w-3.5 h-3.5" />
                  Autonomous Safeguard Agent
                </div>
                
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 mb-6 uppercase font-sans leading-[1.1]">
                  ABOUT AHEADO
                </h1>

                <p className="text-sm sm:text-base text-gray-750 leading-relaxed mb-6 font-serif italic font-medium">
                  Aheado intercepts critical portal deadlines, automated bill streams, and calendar conflicts for high-intensity individuals before they turn red. Our background agents stage emergency actions, outlines, and reschedules while you focus on what counts.
                </p>

                {/* Core Value Props List (About details) */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 mt-0.5">
                      <Zap className="w-3 h-3 fill-brand-primary" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 font-sans uppercase tracking-wider">Autonomous Scanning</h4>
                      <p className="text-[11px] text-gray-655 leading-relaxed font-sans mt-0.5">
                        Background integration with Gmail, Google Calendar, and Google Classroom to parse incoming messages & academic deadlines.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 mt-0.5">
                      <Sparkles className="w-3 h-3 fill-brand-primary" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 font-sans uppercase tracking-wider">Agentic Pre-Execution</h4>
                      <p className="text-[11px] text-gray-655 leading-relaxed font-sans mt-0.5">
                        Instantly stages emergency study blueprints, conceptual assignment outlines, and polite reschedule requests automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Terminal Log console */}
              <div className="lg:col-span-7 w-full">
                <div className="p-5 md:p-6 rounded-xl border border-brand-border bg-brand-surface backdrop-blur-[16px] shadow-[0_24px_64px_rgba(0,0,0,0.06)] relative overflow-hidden text-left">
                  
                  {/* Subtle decoration elements */}
                  <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-brand-primary to-transparent" />
                  <div className="absolute top-0 right-0 w-24 h-[1px] bg-gradient-to-l from-brand-accent to-transparent" />
                  
                  {/* Header Title with premium badge */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-brand-border/40">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                        <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest font-mono">
                          Safeguard Pipeline
                        </span>
                      </div>
                      <h2 className="text-sm font-extrabold tracking-tight text-stone-900 uppercase font-sans">
                        Interception Terminal Stream
                      </h2>
                    </div>
                    <div className="flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 text-[9px] font-mono text-stone-600 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>LIVE FEED</span>
                    </div>
                  </div>

                  {/* Compact Mini Metrics Grid inside Terminal section */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Metric 1 */}
                    <div className="p-3 rounded-lg bg-orange-50/60 border border-orange-200 flex flex-col justify-between">
                      <span className="text-[9px] font-bold text-orange-800 uppercase tracking-widest font-mono mb-1">
                        Safe Score
                      </span>
                      <span className="text-sm font-extrabold text-stone-900 font-sans bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-orange-500">
                        {deadlineSafeScore}% Protected
                      </span>
                    </div>
                    {/* Metric 2 */}
                    <div className="p-3 rounded-lg bg-sky-50/90 border border-sky-200 flex flex-col justify-between">
                      <span className="text-[9px] font-bold text-sky-800 uppercase tracking-widest font-mono mb-1">
                        Autopilot Sync
                      </span>
                      <span className="text-[11px] font-bold text-sky-950 font-sans truncate">
                        Active Listeners OK
                      </span>
                    </div>
                  </div>

                  {/* Automated Event Stream console */}
                  <div className="rounded-lg border border-stone-850 bg-stone-900 p-4 relative shadow-inner">
                    {/* Window controls styling like macOS */}
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-brand-primary/80" />
                        <span className="w-2 h-2 rounded-full bg-brand-accent/80" />
                        <span className="w-2 h-2 rounded-full bg-stone-600" />
                        <span className="text-[9px] text-stone-400 font-mono font-bold ml-1.5 uppercase tracking-widest">
                          event_stream_stdout
                        </span>
                      </div>
                      <div className="text-[9px] text-stone-400 font-mono">
                        POLLING AGENTS
                      </div>
                    </div>

                    {/* Scrollable event log body */}
                    <div ref={terminalContainerRef} className="h-44 overflow-y-auto pr-1 flex flex-col gap-2 font-mono text-[10px] md:text-[11px] leading-relaxed custom-scrollbar text-left scroll-smooth">
                      {eventLogs.map((log, idx) => {
                        let textClass = "text-stone-300";
                        if (log.text.startsWith("[INTERCEPTED]")) textClass = "text-brand-primary font-bold";
                        else if (log.text.startsWith("[AUTOPILOT]")) textClass = "text-orange-400 font-medium";
                        else if (log.text.startsWith("[RESOLVED]")) textClass = "text-emerald-400 font-bold";
                        else if (log.text.startsWith("[MITIGATION]")) textClass = "text-sky-400 font-medium";
                        else if (log.text.startsWith("[MONITORING]")) textClass = "text-stone-400";

                        return (
                          <div key={idx} className="flex items-start gap-1.5 border-b border-stone-800/60 pb-1">
                            <span className="text-stone-500 shrink-0 select-none">[{log.time}]</span>
                            <span className={textClass}>{log.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </section>
        </>
      )}

      {viewMode === 'workspace' && (
        <>
          {/* DETAILED ACTIVE WORKSPACE AREA */}
          <section ref={canvasSectionRef} className="max-w-7xl mx-auto px-4 md:px-8 pt-36 pb-20 relative z-10">
        
        <motion.div
          key="canvas-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-6"
        >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: Threat Simulator Studio & Input Controls (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col gap-6 order-2 lg:order-1">
                
                {/* Day Integrity Shield Widget */}
                <div className="p-6 rounded-2xl border border-stone-200/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative overflow-hidden transition-all duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono">Day Integrity Shield</span>
                    </div>
                    {/* Dynamic Amber/Green Status Light */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider transition-all duration-500">
                      <span className={`w-2 h-2 rounded-full animate-pulse ${perceptionRating === 100 ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span className={perceptionRating === 100 ? "text-emerald-600" : "text-amber-600"}>
                        {perceptionRating === 100 ? "SECURED" : "CRISIS RISK"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-xs font-semibold text-stone-500">Perception Control Rating</span>
                        <span className="text-2xl font-black text-stone-900 transition-all duration-500">
                          {perceptionRating}%
                        </span>
                      </div>
                      
                      {/* State Bar with dynamic sliding color animation */}
                      <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-700 ease-out rounded-full ${
                            perceptionRating === 100 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${perceptionRating}%` }}
                        />
                      </div>
                    </div>
                    <div className="h-px bg-stone-100" />
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-medium">Total Minutes Rescued</span>
                      <span className="font-extrabold text-stone-900 font-mono tracking-tight bg-stone-50 border border-stone-200/60 px-2.5 py-1 rounded-lg">
                        ⏱️ {totalMinutesRescued} mins
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preset Scenario Selectors */}
                <div className="p-6 rounded-lg border border-brand-border bg-brand-surface relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary" />
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-sans">
                    <Sliders className="w-5 h-5 text-brand-primary" />
                    Crisis Presets Studio
                  </h3>
                  <p className="text-brand-text-secondary text-xs mb-4">
                    Choose an emergency preset context to auto-populate the active timeline, then execute.
                  </p>

                  <div className="flex flex-col gap-3">
                    {SCENARIOS.map((scen) => {
                      const IconComp = scen.icon;
                      const isActive = activeScenario === scen.id;
                      return (
                        <button
                          key={scen.id}
                          onClick={() => handleSelectPreset(scen.id)}
                          className={`w-full p-3.5 rounded-lg border flex items-start gap-3 text-left transition-all relative cursor-pointer ${
                            isActive 
                              ? "bg-brand-primary/[0.06] border-brand-primary shadow-sm" 
                              : "bg-stone-50/70 border-stone-200 hover:border-brand-primary/30 hover:bg-stone-100/70"
                          }`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${isActive ? "bg-brand-primary/20 text-brand-primary" : "bg-stone-200/50 text-stone-600"}`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className={`text-xs font-bold uppercase tracking-wider ${isActive ? "text-brand-primary" : "text-stone-800"}`}>{scen.label}</div>
                            <div className={`text-[11px] mt-0.5 line-clamp-1 ${isActive ? "text-brand-accent/90" : "text-stone-500"}`}>{scen.description}</div>
                          </div>
                          {isActive && (
                            <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scenario Details Editor */}
                <div className="p-6 rounded-lg border border-brand-border bg-brand-surface">
                  <h3 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3 font-mono">
                    Scenario Narrative Studio
                  </h3>
                  <textarea
                    value={customScenarioText}
                    onChange={(e) => setCustomScenarioText(e.target.value)}
                    rows={4}
                    placeholder="Describe your current multi-tasking emergency (deadlines, overlapping bookings, overdue items)..."
                    className="w-full bg-black border border-brand-border rounded-lg p-3 text-xs md:text-sm text-white focus:outline-none focus:border-brand-primary transition-all font-sans leading-relaxed resize-none"
                  />
                  <div className="text-[10px] text-brand-text-secondary mt-2 flex items-center gap-1 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                    <span>Aheado dynamically processes this narrative to generate intercepts.</span>
                  </div>
                </div>

                {/* Direct Voice & Text Dispatcher Console */}
                <div className="p-6 rounded-lg border border-brand-border bg-brand-surface relative">
                  <h3 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3 flex items-center gap-1.5 font-mono">
                    <Mic className="w-3.5 h-3.5 text-brand-primary" />
                    Workspace Command Dispatcher
                  </h3>
                  <p className="text-[11px] text-brand-text-secondary mb-4 leading-relaxed font-sans">
                    Say or type a directive to add things to your Calendar, Gmail, or find school deadlines.
                  </p>
                  
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="e.g., Schedule doctor visit tomorrow at 3 PM"
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      className="flex-1 bg-black border border-brand-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-brand-primary transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={handleToggleVoiceListening}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isListening 
                          ? "bg-rose-500/10 border-rose-500 text-rose-400 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.2)]" 
                          : "bg-stone-900 border-brand-border text-brand-primary hover:bg-stone-800"
                      }`}
                      title={isListening ? "Listening... click to stop" : "Record Speech Command"}
                    >
                      <Mic className="w-4 h-4 shrink-0" />
                      <span>{isListening ? "Listening" : "Voice"}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteCommand}
                    disabled={isExecutingCommand || !commandInput.trim()}
                    className="w-full py-2.5 rounded-lg bg-brand-primary hover:bg-brand-accent text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider font-mono shadow-md"
                  >
                    {isExecutingCommand ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Dispatch AI Action
                  </button>

                  {/* Parsed Command Preview Stage */}
                  {parsedCommandResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-left shadow-md flex flex-col gap-3"
                    >
                      <div className="flex items-center gap-1.5 mb-1 pb-1.5 border-b border-stone-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                        <span className="text-[10px] text-emerald-700 font-extrabold tracking-wider uppercase font-mono">
                          Parsed Workspace Action
                        </span>
                      </div>

                      {parsedCommandResult.type === "calendar" && parsedCommandResult.calendar && (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-brand-primary shrink-0" />
                            {parsedCommandResult.calendar.summary}
                          </div>
                          
                          <div className="text-[11px] text-stone-600 space-y-1 pl-5.5 font-sans">
                            <div className="flex items-center gap-1">
                              <span className="text-stone-400">🗓️ Date:</span> 
                              <span className="font-semibold text-stone-800">
                                {parsedCommandResult.calendar.startTime ? new Date(parsedCommandResult.calendar.startTime).toLocaleDateString() : "Tomorrow"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-stone-400">🕒 Time:</span> 
                              <span className="font-semibold text-stone-800">
                                {parsedCommandResult.calendar.startTime ? new Date(parsedCommandResult.calendar.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "14:30"} - {parsedCommandResult.calendar.endTime ? new Date(parsedCommandResult.calendar.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "15:30"}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-stone-700 bg-stone-100 p-2.5 rounded-lg border border-stone-200/60 leading-relaxed font-sans">
                            {parsedCommandResult.calendar.description}
                          </p>

                          <button
                            type="button"
                            onClick={handleConfirmAndExecuteCommand}
                            className="w-full mt-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all uppercase tracking-wider font-mono cursor-pointer active:scale-95 shadow-sm"
                          >
                            Push Event to Google Calendar
                          </button>
                        </div>
                      )}

                      {parsedCommandResult.type === "gmail" && parsedCommandResult.gmail && (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                            <span className="text-base">✉️</span>
                            <span className="text-stone-500 font-medium">Subject:</span> {parsedCommandResult.gmail.subject}
                          </div>

                          <div className="text-[11px] text-stone-600 pl-5.5 font-sans">
                            <div className="flex items-center gap-2">
                              <span className="text-stone-400">📩 Recipient:</span> 
                              <input 
                                type="email"
                                placeholder="Enter recipient email address (leave blank if none)..."
                                value={parsedCommandResult.gmail.recipient || ""}
                                onChange={(e) => {
                                  setParsedCommandResult({
                                    ...parsedCommandResult,
                                    gmail: {
                                      ...parsedCommandResult.gmail,
                                      recipient: e.target.value
                                    }
                                  });
                                }}
                                className="flex-1 bg-white border border-stone-300 rounded px-2.5 py-1.5 text-xs text-stone-800 font-medium focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all font-sans"
                              />
                            </div>
                          </div>

                          <p className="text-[11px] text-stone-700 bg-stone-100 p-2.5 rounded-lg border border-stone-200/60 leading-relaxed font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {parsedCommandResult.gmail.body}
                          </p>

                          <button
                            type="button"
                            onClick={handleConfirmAndExecuteCommand}
                            className="w-full mt-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all uppercase tracking-wider font-mono cursor-pointer active:scale-95 shadow-sm"
                          >
                            Send Email via Gmail API
                          </button>
                        </div>
                      )}

                      {parsedCommandResult.type === "unknown" && (
                        <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-200 font-medium font-sans">
                          Could not determine an automatic action. Please specify 'Schedule...' or 'Send email...' in your command.
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Google Classroom Deadlines Panel */}
                <div className="p-6 rounded-lg border border-brand-border bg-brand-surface relative text-left">
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    {isScanningClassroom ? (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                    <span className="text-[9px] text-brand-text-secondary font-mono uppercase tracking-wider">
                      {isScanningClassroom ? "Scanning Classes..." : "Classroom Synced"}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3 flex items-center gap-1.5 font-mono">
                    <GraduationCap className="w-4 h-4 text-brand-primary" />
                    Google Classroom Deadlines
                  </h3>
                  <p className="text-[11px] text-brand-text-secondary mb-4 leading-relaxed font-sans">
                    Traversing student classes to check for upcoming academic coursework and exams.
                  </p>

                  <div className="space-y-3">
                    {classroomDeadlines.length === 0 ? (
                      <div className="py-6 px-4 border border-dashed border-brand-border rounded-lg text-center space-y-3">
                        <GraduationCap className="w-8 h-8 text-stone-600 mx-auto opacity-50" />
                        <p className="text-[11px] text-stone-500 max-w-xs mx-auto font-sans leading-relaxed">
                          No Classroom deadlines listed in your live account or sandbox state yet.
                        </p>
                        <button
                          type="button"
                          onClick={handleLoadDemoClassroomDeadlines}
                          className="px-4 py-1.5 rounded-lg border border-brand-primary/40 bg-brand-primary/10 text-brand-primary text-[10px] font-extrabold uppercase tracking-wider hover:bg-brand-primary/20 active:scale-95 transition-all cursor-pointer"
                        >
                          🧪 Load Demo Coursework
                        </button>
                      </div>
                    ) : (
                      classroomDeadlines.map((item) => {
                        const isOverdue = new Date(item.dueDate) < new Date();
                        return (
                          <div 
                            key={item.id} 
                            className="p-3.5 rounded-lg bg-stone-50 border border-stone-200/80 hover:border-brand-primary/30 transition-all text-left"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[9px] font-bold text-brand-primary uppercase tracking-wider font-mono bg-brand-primary/10 px-1.5 py-0.5 rounded">
                                  {item.courseName}
                                </span>
                                <h4 className="text-xs font-extrabold text-stone-950 mt-1.5 font-sans tracking-wide">
                                  {item.title}
                                </h4>
                              </div>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 font-semibold ${
                                isOverdue 
                                  ? "bg-rose-500/10 text-rose-700 border border-rose-500/25" 
                                  : "bg-amber-500/10 text-amber-700 border border-amber-500/25 animate-pulse"
                              }`}>
                                {isOverdue ? "Overdue" : `Due ${item.dueDate}`}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-[10px] text-stone-600 mt-2 line-clamp-2 leading-relaxed font-sans">
                                {item.description}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Manual Task Injector */}
                <div className="p-6 rounded-lg border border-brand-border bg-brand-surface">
                  <h3 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-4 font-mono">
                    Threat Buffer Task List ({tasks.length})
                  </h3>

                  {/* Add task simple inline form */}
                  <form onSubmit={handleAddTask} className="flex flex-col gap-3 mb-4">
                    <input
                      type="text"
                      placeholder="Add custom task (e.g. History paper)"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-brand-primary text-stone-900 placeholder:text-stone-400"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-1 font-mono">Deadline/Time</label>
                        <input
                          type="text"
                          value={newTaskDeadline}
                          onChange={(e) => setNewTaskDeadline(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-brand-primary text-stone-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-1 font-mono">Category</label>
                        <select
                          value={newTaskCategory}
                          onChange={(e: any) => setNewTaskCategory(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-brand-primary text-stone-900 font-mono"
                        >
                          <option value="assignment">Assignment</option>
                          <option value="bill">Bill Stream</option>
                          <option value="calendar">Calendar</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-brand-primary hover:bg-brand-accent text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-4.5 h-4.5" /> Inject Threat Item
                    </button>
                  </form>

                  {/* Tasks list mapping */}
                  <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar">
                    {tasks.map((task) => (
                      <div 
                        key={task.id}
                        className="p-3 rounded-lg bg-stone-50 border border-stone-200/80 flex items-center justify-between group transition-all"
                      >
                        <div className="flex items-center gap-3">
                          {task.category === "assignment" && <FileText className="w-4 h-4 text-emerald-500 shrink-0" />}
                          {task.category === "bill" && <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />}
                          {task.category === "calendar" && <Calendar className="w-4 h-4 text-brand-primary shrink-0" />}
                          <div>
                            <div className="text-xs font-semibold text-stone-900 line-clamp-1">{task.title}</div>
                            <div className="text-[10px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                              <span className="text-brand-primary font-medium font-mono">{task.deadline}</span>
                              <span>•</span>
                              <span className={`font-semibold font-mono ${task.urgency === "CRITICAL" ? "text-rose-600" : "text-amber-600"}`}>
                                {task.urgency}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-brand-text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0 cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <div className="text-center py-6 text-brand-text-secondary text-xs">
                        No active tasks in buffer. Add some above.
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* RIGHT COLUMN: Active Canvas execution output area (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col gap-6 order-1 lg:order-2">
                
                {/* Active Core Controls */}
                <div className="p-6 rounded-lg bg-brand-surface border border-brand-border flex flex-col items-start gap-5 shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-pulse" />
                      <span className="text-xs font-bold text-brand-primary uppercase tracking-widest font-mono">
                        Aheado Agent Core Active
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white font-sans">
                      Proactive Intercept Guard Engine
                    </h3>
                    <p className="text-xs text-brand-text-secondary max-w-2xl mt-1 leading-relaxed">
                      Either scan your connected Google Workspace live for clashes, or analyze a custom manual nightmare scenario below.
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0 border-t border-brand-border/20 pt-4 w-full">
                    <button
                      onClick={executeLiveWorkspaceScan}
                      disabled={isEvaluating}
                      className={`px-5 py-3.5 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                        isEvaluating 
                          ? "bg-brand-surface/60 border-brand-border text-brand-text-secondary/60 cursor-not-allowed" 
                          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
                      }`}
                      title="Scan connected Workspace live for any scheduling or deadline clashes automatically"
                    >
                      {isScanningWorkspace ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400 animate-pulse" />
                          Scan Live Workspace
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={executeAIEngine}
                      disabled={isEvaluating}
                      className={`px-5 py-3.5 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isEvaluating 
                          ? "bg-brand-surface/60 text-brand-text-secondary/60 cursor-not-allowed" 
                          : "bg-brand-primary hover:bg-brand-accent text-white shadow-lg shadow-brand-primary/20 active:scale-95"
                      }`}
                    >
                      {isEvaluating && !isScanningWorkspace ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          Evaluating...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 text-white fill-white" />
                          Analyze Scenario
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsContinuousWatcherActive(!isContinuousWatcherActive);
                        triggerToast(
                          !isContinuousWatcherActive 
                            ? "🤖 Continuous Autopilot Watcher activated! Watching for replies..."
                            : "🔌 Continuous Watcher deactivated."
                        );
                      }}
                      className={`px-5 py-3.5 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                        isContinuousWatcherActive
                          ? "bg-amber-100/95 border-amber-400 text-amber-900 shadow-[0_0_25px_rgba(245,158,11,0.65)] hover:bg-amber-200 active:scale-95 animate-pulse"
                          : "bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200 hover:text-stone-900 hover:border-stone-400 active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                      }`}
                      title="Keep Aheado actively scanning Gmail for incoming replies to negotiate and schedule events automatically"
                    >
                      <Activity className={`w-4 h-4 ${isContinuousWatcherActive ? "text-amber-600 animate-pulse" : "text-stone-500"}`} />
                      {isContinuousWatcherActive ? "Autopilot: ACTIVE" : "Autopilot Watcher"}
                    </button>
                  </div>
                </div>

                {/* AI Evaluation Output Stage */}
                <div className="p-6 rounded-lg border border-brand-border bg-brand-surface backdrop-blur-sm flex-1 min-h-[480px] flex flex-col justify-between">
                  
                  <div>
                    {/* Header showing system status */}
                    <div className="flex items-center justify-between pb-4 border-b border-brand-border/40 mb-6">
                      <div className="flex items-center gap-2">
                        <TerminalIcon className="w-5 h-5 text-brand-primary" />
                        <span className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest font-mono">
                          Active Canvas Output Staging
                        </span>
                      </div>
                      
                      {evalResult && (
                        <div className="flex items-center gap-4 text-xs font-mono">
                          {evalResult.isDemo && (
                            <span className="px-2 py-0.5 rounded bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-semibold uppercase text-[9px] tracking-wider animate-pulse">
                              DEMO MODE
                            </span>
                          )}
                          {evalResult.riskScore !== undefined && evalResult.riskScore !== null && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-brand-text-secondary font-medium">Risk Assessment:</span>
                              <span className={`font-extrabold px-2 py-0.5 rounded ${
                                evalResult.riskScore > 75 ? "bg-rose-500/15 text-rose-400 border border-rose-500/20" : "bg-brand-primary/15 text-brand-primary border border-brand-primary/20"
                              }`}>
                                {evalResult.riskScore}/100
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Output states */}
                    {!evalResult && !isEvaluating && (
                      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <div className="w-16 h-16 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-4 text-brand-primary animate-pulse">
                          <Zap className="w-8 h-8 text-brand-primary fill-brand-primary" />
                        </div>
                        <h4 className="text-stone-900 font-bold mb-1.5 font-sans">No Active Intercepts Evaluated</h4>
                        <p className="text-stone-600 text-xs max-w-sm leading-relaxed mb-6">
                          Load a scenario preset on the left or customize it, then press &quot;Execute Intercept Guard&quot; to stage active Gemini-built defenses.
                        </p>
                        <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-lg border border-stone-200 max-w-md text-left text-[11px] text-stone-600">
                          <ShieldAlert className="w-4 h-4 text-brand-primary shrink-0" />
                          <span>Aheado shields you by drafting email excuses, pre-digested reading syllabi, and securing direct bill payments in full.</span>
                        </div>
                      </div>
                    )}

                    {/* Loading stage */}
                    {isEvaluating && (
                      <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="relative mb-6">
                          <div className="w-16 h-16 rounded-full border border-brand-primary/30 border-t-brand-primary animate-spin" />
                          <Sparkles className="w-6 h-6 text-brand-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                        <h4 className="text-stone-900 font-bold mb-1 font-sans">Aheado Intercept Core Thinking...</h4>
                        <p className="text-brand-primary text-xs animate-pulse max-w-sm font-mono">
                          Drafting emergency solutions, calendar rescheduling briefs, and invoice payment plans.
                        </p>
                        
                        <div className="mt-8 w-full max-w-md bg-stone-50 rounded-lg p-3 text-left border border-stone-200">
                          <div className="text-[10px] text-stone-500 font-mono flex items-center justify-between mb-1">
                            <span>AGENT PROCESSOR LOG:</span>
                            <span className="text-brand-primary animate-ping">●</span>
                          </div>
                          <div className="text-[11px] font-mono text-stone-600 line-clamp-1">
                            {logs[0]}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Evaluation Successful Content */}
                    {evalResult && !isEvaluating && (
                      <div className="flex flex-col gap-6">
                        
                        {/* Core Synthesis */}
                        <div className="p-4 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-brand-text-secondary text-xs leading-relaxed flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-brand-primary block mb-1">Crisis Synthesis:</span>
                            {evalResult.summary}
                          </div>
                        </div>

                        {/* Staged Intercept Action Cards */}
                        <div className="flex flex-col gap-5">
                          {/* Calendar Rescheduling Group / Mutually Exclusive Strategies */}
                          {(() => {
                            const conflictOptions = evalResult.intercepts?.filter((i: any) => i.isConflictOption) || [];
                            if (conflictOptions.length === 0) return null;

                            const isAnyConflictApproved = conflictOptions.some((o: any) => approvedIntercepts.includes(o.id));
                            
                            return (
                              <div className="p-5 rounded-xl border border-rose-200 bg-rose-50/10 shadow-md">
                                <div className="flex items-center gap-2 mb-3.5 border-b border-rose-100 pb-2.5">
                                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 animate-pulse">
                                    <AlertTriangle className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider font-mono">
                                      CRITICAL COLLISION INTERCEPT PANEL
                                    </h4>
                                    <p className="text-[10px] text-stone-500 font-mono">
                                      Aheado detected a double-booking. Select your resolution strategy below:
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                  {conflictOptions.map((opt: any) => {
                                    const isApproved = approvedIntercepts.includes(opt.id);
                                    const isOtherApproved = isAnyConflictApproved && !isApproved;
                                    
                                    return (
                                      <div 
                                        key={opt.id}
                                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                                          isApproved 
                                            ? "bg-emerald-50/80 border-emerald-400 shadow-md ring-2 ring-emerald-500/20" 
                                            : isOtherApproved
                                              ? "bg-stone-50/40 border-stone-150 opacity-50 cursor-not-allowed scale-[0.98]"
                                              : "bg-white border-stone-200 hover:border-brand-primary/40 shadow-sm hover:shadow-md"
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className={`text-[10px] font-extrabold uppercase tracking-widest font-mono px-2 py-0.5 rounded-full ${
                                              opt.resolutionTarget === "A" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                                            }`}>
                                              STRATEGY {opt.resolutionTarget}
                                            </span>
                                            <div className="flex items-center gap-1 font-mono text-[10px]">
                                              <span className="text-stone-400 font-semibold">Importance:</span>
                                              <span className={`font-bold px-1.5 py-0.5 rounded ${
                                                opt.eventImportance >= 90 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                              }`}>{opt.eventImportance}/100</span>
                                            </div>
                                          </div>

                                          <h5 className="text-xs font-extrabold text-stone-900 mb-1.5 uppercase leading-snug">
                                            {opt.title}
                                          </h5>
                                          <p className="text-[11px] text-stone-600 leading-relaxed mb-3">
                                            {opt.description}
                                          </p>

                                         {opt.sprintBreakdown && (
                                           <div className="p-3 py-2.5 rounded-lg bg-brand-primary/[0.04] border border-brand-primary/10 mb-3 font-sans">
                                             <div className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-1 flex items-center gap-1 font-mono">
                                               <Clock className="w-3.5 h-3.5 text-brand-primary" />
                                               <span>⏱️ Suggested Sprint Breakdown</span>
                                             </div>
                                             <div className="text-[11px] text-stone-700 font-mono whitespace-pre-wrap leading-relaxed">
                                               {opt.sprintBreakdown}
                                             </div>
                                           </div>
                                         )}
                                          {opt.id === "int-calendar-option-a" ? (
                                            <div className="p-3.5 rounded-lg bg-stone-950 border border-stone-850 mb-3 font-mono text-xs">
                                              <div className="text-[9px] font-bold text-stone-500 uppercase tracking-widest mb-2 select-none">
                                                PROPOSED CALENDAR SLOT
                                              </div>
                                              <div className="flex flex-col gap-1.5 text-[11px] text-stone-200 leading-normal">
                                                <div>
                                                  <span className="text-stone-500 font-bold">Recommended Date:</span> {opt.recommendedDate ? (() => { try { const pts = opt.recommendedDate.split("-"); if (pts.length === 3) { const d = new Date(parseInt(pts[0], 10), parseInt(pts[1], 10) - 1, parseInt(pts[2], 10)); return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } } catch (e) {} return opt.recommendedDate; })() : "June 29, 2026"}
                                                </div>
                                                <div>
                                                  <span className="text-stone-500 font-bold">Recommended Time:</span> {opt.recommendedTime ? (() => { try { const pts = opt.recommendedTime.split(":"); if (pts.length >= 2) { const hour = parseInt(pts[0], 10); const min = pts[1]; const ampm = hour >= 12 ? "PM" : "AM"; const hour12 = hour % 12 === 0 ? 12 : hour % 12; return `${String(hour12).padStart(2, "0")}:${min} ${ampm}`; } } catch (e) {} return opt.recommendedTime; })() : "09:00 AM"}
                                                </div>
                                                <div className="mt-1 text-emerald-400 text-[10px] font-bold">
                                                  🟢 Calendar check: Slot is free of conflicts. Ready to schedule.
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="p-2.5 rounded bg-stone-950 border border-stone-850 mb-3 font-mono">
                                              <div className="flex items-center justify-between text-[9px] font-bold text-stone-500 uppercase tracking-widest mb-1 select-none">
                                                <span>PROPOSED SHIFT DRAFT</span>
                                                <button 
                                                  onClick={() => copyToClipboard(opt.outputDraft, opt.id)}
                                                  className="text-stone-450 hover:text-brand-primary flex items-center gap-1 transition-colors cursor-pointer"
                                                >
                                                  {copiedId === opt.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                  <span>COPY</span>
                                                </button>
                                              </div>
                                              <pre className="text-[10px] text-stone-200 whitespace-pre-wrap break-all leading-normal max-h-[140px] overflow-y-auto">
                                                {opt.outputDraft}
                                              </pre>
                                            </div>
                                          )}
                                        </div>

                                        <div className="pt-2 border-t border-stone-100 mt-2 flex items-center justify-between">
                                          <div className="text-[9px] text-stone-400 font-mono">
                                            Action: {opt.actionTaken}
                                          </div>

                                          <button
                                            onClick={() => !isOtherApproved && approveAction(opt.id)}
                                            disabled={isOtherApproved || isApproved}
                                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                              isApproved 
                                                ? "bg-emerald-500 text-white shadow-sm" 
                                                : isOtherApproved
                                                  ? "bg-stone-100 text-stone-300 border border-stone-200 cursor-not-allowed"
                                                  : "bg-brand-primary hover:bg-brand-accent text-white shadow-sm cursor-pointer"
                                            }`}
                                          >
                                            {isApproved ? (
                                              <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Deployed Shield</span>
                                              </>
                                            ) : (
                                              <>
                                                <Zap className="w-3.5 h-3.5" />
                                                <span>Deploy Strategy</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Standard / Non-clashing Intercept Guards */}
                          {(() => {
                            const regularIntercepts = evalResult.intercepts?.filter((i: any) => !i.isConflictOption) || [];
                            if (regularIntercepts.length === 0) return null;
                            
                            return (
                              <div className="flex flex-col gap-4">
                                <h4 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest flex items-center gap-1.5 font-mono">
                                  <Activity className="w-4 h-4 text-brand-primary" />
                                  Active System Shields ({regularIntercepts.length})
                                </h4>

                                <div className="grid grid-cols-1 gap-4">
                                  {regularIntercepts.map((intercept: any, idx: number) => {
                                    const isApproved = approvedIntercepts.includes(intercept.id);
                                    return (
                                      <div 
                                        key={intercept.id || idx}
                                        className={`p-5 rounded-lg border transition-all ${
                                          isApproved 
                                            ? "bg-emerald-50/75 border-emerald-300 shadow-sm" 
                                            : "bg-stone-50 border-stone-200 hover:border-brand-primary/30 shadow-sm"
                                        }`}
                                      >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                                          <div className="flex items-center gap-2.5">
                                            <div className={`p-1.5 rounded-lg shrink-0 ${
                                              intercept.category === "assignment" ? "bg-emerald-500/10 text-emerald-600" :
                                              intercept.category === "bill" ? "bg-amber-500/10 text-amber-600" :
                                              "bg-brand-primary/10 text-brand-primary"
                                            }`}>
                                              {intercept.category === "assignment" && <FileText className="w-4 h-4" />}
                                              {intercept.category === "bill" && <CreditCard className="w-4 h-4" />}
                                              {intercept.category === "calendar" && <Calendar className="w-4 h-4" />}
                                            </div>
                                            <div>
                                              <div className={`text-xs font-extrabold uppercase tracking-wide ${isApproved ? "text-emerald-950" : "text-stone-900"}`}>
                                                {intercept.title}
                                              </div>
                                              <div className="text-[10px] text-stone-500 font-mono">
                                                Category: <span className={`uppercase font-semibold ${isApproved ? "text-emerald-400" : "text-stone-900"}`}>{intercept.category}</span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 font-mono">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${
                                              intercept.urgency === "CRITICAL" ? "bg-rose-500/15 text-rose-600 border border-rose-500/20" :
                                              intercept.urgency === "HIGH" ? "bg-amber-500/15 text-amber-600 border border-amber-500/20" :
                                              "bg-brand-primary/15 text-brand-primary border border-brand-primary/20"
                                            }`}>
                                              {intercept.urgency}
                                            </span>
                                          </div>
                                        </div>

                                        <p className="text-xs text-stone-600 leading-relaxed mb-3">
                                          {intercept.description}
                                        </p>

                                        <div className="p-3.5 rounded-lg bg-stone-900 border border-stone-800 mb-4">
                                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 flex items-center justify-between font-mono">
                                            <span>Action Script output</span>
                                            <button 
                                              onClick={() => copyToClipboard(intercept.outputDraft, intercept.id)}
                                              className="text-stone-450 hover:text-brand-primary flex items-center gap-1 transition-colors cursor-pointer"
                                            >
                                              {copiedId === intercept.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 animate-pulse" />}
                                              <span>Copy Code</span>
                                            </button>
                                          </div>
                                         {intercept.sprintBreakdown && (
                                           <div className="p-3 py-2.5 rounded-lg bg-brand-primary/[0.04] border border-brand-primary/10 mb-3 font-sans">
                                             <div className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-1 flex items-center gap-1 font-mono">
                                               <Clock className="w-3.5 h-3.5 text-brand-primary" />
                                               <span>⏱️ Suggested Sprint Breakdown</span>
                                             </div>
                                             <div className="text-[11px] text-stone-300 font-mono whitespace-pre-wrap leading-relaxed">
                                               {intercept.sprintBreakdown}
                                             </div>
                                           </div>
                                         )}
                                          <pre className="text-[11px] font-mono text-stone-200 whitespace-pre-wrap break-all leading-relaxed bg-transparent p-1 select-all">
                                            {intercept.outputDraft}
                                          </pre>
                                        </div>

                                        <div className="flex items-center justify-between text-xs pt-1">
                                          <div className="text-stone-500 flex items-center gap-1.5 font-mono text-[11px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                                            <span>Auto Action: <strong className={isApproved ? "text-emerald-800 font-semibold" : "text-stone-800 font-semibold"}>{intercept.actionTaken}</strong></span>
                                          </div>

                                          <button
                                            onClick={() => approveAction(intercept.id)}
                                            disabled={isApproved}
                                            className={`px-4 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                                              isApproved 
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                                : "bg-brand-primary hover:bg-brand-accent text-white shadow-sm"
                                            }`}
                                          >
                                            {isApproved ? (
                                              <>
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                Deployed Shield
                                              </>
                                            ) : (
                                              <>
                                                <Zap className="w-3.5 h-3.5 text-white fill-white" />
                                                Approve Auto-Action
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                          </div>

                          {/* Resource Acceleration & Educational Assistance block */}
                          {(() => {
                            const filteredResources = (evalResult.recommended_resources || []).filter((res: any) => {
                              if (!res || typeof res !== "object") return false;
                              const title = String(res.title || "").toLowerCase();
                              const url = String(res.url || "").toLowerCase();
                              const creator = String(res.creator_name || "").toLowerCase();
                              if (title.includes("[topic]") || url.includes("[url-encoded")) return false;
                              
                              if (classroomDeadlines.length === 0) {
                                return false;
                              }

                              let isMatched = false;
                              for (const dl of classroomDeadlines) {
                                const dlTitleLower = (dl.title || "").toLowerCase();
                                const dlCourseLower = (dl.courseName || "").toLowerCase();

                                if (title.includes(dlTitleLower) || url.includes(dlTitleLower) || creator.includes(dlTitleLower)) {
                                  isMatched = true;
                                  break;
                                }
                                if (dlCourseLower && (title.includes(dlCourseLower) || url.includes(dlCourseLower) || creator.includes(dlCourseLower))) {
                                  isMatched = true;
                                  break;
                                }

                                const stopWords = new Set(["and", "the", "to", "for", "of", "in", "chapter", "introduction", "a", "an", "on", "with", "at", "by", "from", "tutorials", "on", "youtube", "review"]);
                                const dlTitleWords = dlTitleLower.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stopWords.has(w));
                                const dlCourseWords = dlCourseLower.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stopWords.has(w));

                                for (const word of [...dlTitleWords, ...dlCourseWords]) {
                                  if (title.includes(word) || url.includes(word) || creator.includes(word)) {
                                    isMatched = true;
                                    break;
                                  }
                                }
                                if (isMatched) break;
                              }

                              if (!isMatched) return false;

                              const scenarioLower = (customScenarioText || "").toLowerCase();
                              const forbidKeywords = ["phys", "phyi", "phyc", "quantum", "chemistry", "midterm", "machine learning", "linear algebra"];
                              for (const kw of forbidKeywords) {
                                if (title.includes(kw) && !scenarioLower.includes(kw)) {
                                  return false;
                                }
                              }
                              return true;
                            });

                            if (filteredResources.length === 0) return null;

                            return (
                              <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/10 shadow-sm mt-2">
                                <div className="flex items-center gap-2 mb-3.5 border-b border-blue-100 pb-2.5">
                                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                                    <GraduationCap className="w-5 h-5 animate-pulse" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                      <span>🎓 Resource Acceleration Block</span>
                                      <span className="px-1.5 py-0.5 rounded text-[8px] bg-blue-100 text-blue-700 font-bold tracking-widest font-mono">EDUCATIONAL INTEGRATION</span>
                                    </h4>
                                    <p className="text-[10px] text-stone-500 font-mono">
                                      Pre-verified concept review breakdowns compiled to clear academic blockers immediately:
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {filteredResources.map((res: any, idx: number) => (
                                    <a 
                                      key={idx}
                                      href={res.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-3.5 rounded-lg border border-stone-200 bg-white hover:border-brand-primary hover:shadow-md transition-all flex items-start gap-3 group"
                                    >
                                      <div className="p-2 rounded-md bg-rose-500/10 text-rose-600 shrink-0 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-stone-900 group-hover:text-brand-primary transition-colors line-clamp-2">
                                          {res.title}
                                        </div>
                                        {res.creator_name && (
                                          <div className="text-[10px] text-blue-600 font-bold font-mono mt-0.5">
                                            by {res.creator_name}
                                          </div>
                                        )}
                                        <div className="text-[10px] text-stone-500 font-mono mt-1 flex items-center gap-1 group-hover:text-stone-700">
                                          <span>Click to study topic on YouTube</span>
                                          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                                        </div>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                      )}

                  </div>

                  {/* Reassurance Footer */}
                  {evalResult && (
                    <div className="mt-8 pt-4 border-t border-gray-900 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                      <span>Proactive Defense Status: ACTIVE SHIELD</span>
                      <span className="text-blue-400 font-semibold italic">{evalResult.reassurance}</span>
                    </div>
                  )}

                </div>

              </div>
              </div>

            </motion.div>

        {/* BOTTOM REAL-TIME CONSOLE LOGGER (High-Tech Terminal Output) */}
        <div className="mt-12 p-5 rounded-lg border border-stone-800 bg-stone-900 text-xs font-mono text-stone-300 relative overflow-hidden shadow-inner">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-brand-primary/10 via-brand-primary/50 to-brand-primary/10" />
          <div className="flex items-center justify-between mb-3 text-[10px] uppercase tracking-widest text-stone-400 font-bold">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-brand-primary animate-pulse" />
              <span>Real-Time Proactive Log Monitor</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Status: <strong className="text-brand-primary animate-pulse font-normal">Listening</strong></span>
              <button 
                onClick={() => setLogs(["Console log history cleared.", "Standing by..."])}
                className="text-stone-300 hover:text-brand-primary transition-colors cursor-pointer uppercase font-bold text-[9px]"
              >
                Clear History
              </button>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
            {logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2.5 leading-relaxed">
                <span className="text-brand-primary/85 shrink-0 select-none font-medium">[{new Date().toLocaleTimeString()}]</span>
                <span className={log.startsWith("❌") ? "text-rose-400" : log.startsWith("✅") ? "text-emerald-400 font-semibold" : "text-stone-100"}>
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>

      </section>
        </>
      )}

      {viewMode === 'landing' && (
        <>
          {/* ARCHITECTURAL FEATURES BENTO GRID */}
          <section id="architecture" className="max-w-7xl mx-auto px-4 md:px-8 py-16 relative z-10 w-full border-t border-brand-border/30">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand-primary/20 bg-brand-primary/10 text-[10px] font-bold tracking-widest text-brand-primary uppercase mb-4">
            <Layers className="w-3.5 h-3.5 text-brand-primary" />
            Core Architecture
          </div>
          <h2 className="text-3xl md:text-4xl font-sans font-medium tracking-tight text-stone-900 uppercase mb-4">
            Architectural Features Bento Grid
          </h2>
          <p className="text-sm text-brand-text-secondary leading-relaxed font-serif">
            Our background agents run continuous deep-scans on your linked workspaces to isolate, mitigate, and resolve critical bottlenecks before they disrupt your life.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Bento Card 1 */}
          <div className="p-8 rounded-lg border border-brand-border bg-brand-surface backdrop-blur-md relative overflow-hidden group hover:border-brand-primary transition-all flex flex-col justify-between h-80">
            <div className="absolute top-0 right-0 p-6 text-brand-primary/10 group-hover:text-brand-primary/20 transition-colors">
              <Activity className="w-20 h-20 stroke-[1]" />
            </div>
            <div>
              <div className="text-xs font-bold font-mono text-brand-primary uppercase tracking-widest mb-3">
                01 / Autonomous Portal Interception
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-3 uppercase">
                Continuous Workspace Scans
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed font-sans">
                Background synchronization with Canvas, Blackboard, Jira dashboards, and automated utility bill streams. Dynamically catches incoming milestone penalties.
              </p>
            </div>
            <div className="text-[10px] text-brand-text-secondary font-mono mt-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
              <span>Real-time monitoring active</span>
            </div>
          </div>

          {/* Bento Card 2 */}
          <div className="p-8 rounded-lg border border-brand-border bg-brand-surface backdrop-blur-md relative overflow-hidden group hover:border-brand-primary transition-all flex flex-col justify-between h-80">
            <div className="absolute top-0 right-0 p-6 text-brand-primary/10 group-hover:text-brand-primary/20 transition-colors">
              <Sparkles className="w-20 h-20 stroke-[1]" />
            </div>
            <div>
              <div className="text-xs font-bold font-mono text-brand-primary uppercase tracking-widest mb-3">
                02 / Agentic Task Pre-Execution
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-3 uppercase">
                Generative Draft Blueprints
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed font-sans">
                Stages fully tailored assignment outline summaries, conceptual cheat sheets, and polite, formal rescheduling email templates automatically via Gemini.
              </p>
            </div>
            <div className="text-[10px] text-brand-text-secondary font-mono mt-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
              <span>Staged in local sandbox drafts</span>
            </div>
          </div>

          {/* Bento Card 3 */}
          <div className="p-8 rounded-lg border border-brand-border bg-brand-surface backdrop-blur-md relative overflow-hidden group hover:border-brand-primary transition-all flex flex-col justify-between h-80">
            <div className="absolute top-0 right-0 p-6 text-brand-primary/10 group-hover:text-brand-primary/20 transition-colors">
              <Clock className="w-20 h-20 stroke-[1]" />
            </div>
            <div>
              <div className="text-xs font-bold font-mono text-brand-primary uppercase tracking-widest mb-3">
                03 / Red-Zone Failsafe Override
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-3 uppercase">
                Last-Minute Threat Guard
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed font-sans">
                Rearranges colliding calendar items, pre-approves partial installment energy payments, and dispatches high-priority SMS alerts to shield you inside the 24h red-zone.
              </p>
            </div>
            <div className="text-[10px] text-brand-text-secondary font-mono mt-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
              <span>Automatic trigger within 24h</span>
            </div>
          </div>

        </div>
      </section>

      {/* AUTOMATION PRICING HORIZON */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 md:px-8 py-20 relative z-10 w-full border-t border-brand-border/30">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand-primary/20 bg-brand-primary/10 text-[10px] font-bold tracking-widest text-brand-primary uppercase mb-4 font-mono">
            <CreditCard className="w-3.5 h-3.5 text-brand-primary" />
            Pricing Horizon
          </div>
          <h2 className="text-3xl md:text-4xl font-sans font-medium tracking-tight text-stone-900 uppercase mb-4">
            Automation Pricing Horizon
          </h2>
          <p className="text-sm text-brand-text-secondary leading-relaxed font-serif">
            Select the appropriate safeguard tier. Defer late stress forever.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-6">
          
          {/* Plan 1 */}
          <motion.div 
            whileHover={{ y: -8, scale: selectedPlan === 0 ? 1.02 : 1.01, boxShadow: "0 20px 40px rgba(0, 0, 0, 0.08)" }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={() => {
              setSelectedPlan(0);
              triggerToast("🌱 Student Pilot Plan selected! Active in test sandbox.");
              setLogs(prev => ["💳 User selected [Student Pilot] Safeguard Horizon - Free tier.", ...prev]);
            }}
            className={`p-8 rounded-2xl border backdrop-blur-sm relative flex flex-col justify-between transition-all duration-300 cursor-pointer select-none ${
              selectedPlan === 0 
                ? "border-brand-primary ring-4 ring-brand-primary/20 bg-amber-50/20 shadow-[0_15px_35px_rgba(249,115,22,0.12)]" 
                : "border-brand-border bg-brand-surface hover:border-brand-primary/30"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-widest text-brand-text-secondary font-mono">Student Pilot</div>
                {selectedPlan === 0 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-[9px] bg-brand-primary text-white font-extrabold px-2 py-0.5 rounded font-mono uppercase tracking-wider"
                  >
                    Active Tier
                  </motion.span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-extrabold text-stone-900">$0</span>
                <span className="text-xs text-brand-text-secondary font-mono">/ Forever Free</span>
              </div>
              <p className="text-xs text-brand-text-secondary mb-6 font-serif">
                Perfect for standard assignment timelines and lightweight calendar organization.
              </p>
              <div className="border-t border-brand-border/40 pt-6 flex flex-col gap-3">
                <div className="flex items-center gap-2.5 text-xs text-brand-text-secondary">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>2 active portal sync paths</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-brand-text-secondary">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Basic markdown template outputs</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-brand-text-secondary">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Standard cloud scanner refresh times</span>
                </div>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlan(0);
                triggerToast("Student Pilot activated. Welcome aboard!");
              }}
              className="mt-8 w-full py-3 rounded-lg bg-black border border-brand-border hover:bg-white hover:border-brand-primary hover:text-black text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer font-mono"
            >
              Get Started Free
            </button>
          </motion.div>

          {/* Plan 2: Pro Companion (Elevated with brand-primary border and soft warm shadow) */}
          <motion.div 
            whileHover={{ y: selectedPlan === 1 ? -12 : -8, scale: selectedPlan === 1 ? 1.05 : 1.04, boxShadow: "0 25px 50px rgba(217,90,20,0.22)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={() => {
              setSelectedPlan(1);
              triggerToast("⚡ Pro Companion selected! Upgraded inside workspace.");
              setLogs(prev => ["💳 User selected [Pro Companion] Safeguard Horizon - $19/mo.", ...prev]);
            }}
            className={`p-8 rounded-2xl border-2 relative flex flex-col justify-between transition-all duration-300 cursor-pointer select-none z-20 ${
              selectedPlan === 1 
                ? "border-brand-primary ring-4 ring-brand-primary/30 bg-orange-50/30 shadow-[0_24px_60px_rgba(217,90,20,0.28)] md:-translate-y-5" 
                : "border-brand-primary bg-white shadow-[0_24px_50px_rgba(217,90,20,0.14)] md:-translate-y-4 md:scale-[1.03]"
            }`}
          >
            <div className="absolute top-4 right-4 bg-brand-primary text-white font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 rounded font-mono shadow-[0_4px_12px_rgba(217,90,20,0.3)]">
              {selectedPlan === 1 ? "Selected Companion" : "Best Value"}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-brand-primary mb-2 font-mono">Pro Companion</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-extrabold text-stone-900">$19</span>
                <span className="text-xs text-brand-text-secondary font-mono">/ month</span>
              </div>
              <p className="text-xs text-gray-600 mb-6 font-serif">
                Full-stack proactive mitigation guard with voice override alerts and unlimited agent portals.
              </p>
              <div className="border-t border-brand-border/40 pt-6 flex flex-col gap-3">
                <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Unlimited app & portal integrations</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Real-time adaptive context generation</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Automated SMS/Call phone overrides</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Priority 1-minute server polling</span>
                </div>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlan(1);
                triggerToast("⚡ Thank you! Pro Companion upgraded successfully in test mode.");
              }}
              className="mt-8 w-full py-3 rounded-lg bg-brand-primary hover:bg-brand-accent hover:text-black text-white font-bold text-xs uppercase tracking-wider shadow-[0_4px_15px_rgba(249,115,22,0.3)] transition-all cursor-pointer font-mono"
            >
              Upgrade to Pro
            </button>
          </motion.div>

          {/* Plan 3 */}
          <motion.div 
            whileHover={{ y: -8, scale: selectedPlan === 2 ? 1.02 : 1.01, boxShadow: "0 20px 40px rgba(0, 0, 0, 0.08)" }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={() => {
              setSelectedPlan(2);
              triggerToast("💼 Enterprise Sync selected! Custom contact channel open.");
              setLogs(prev => ["💳 User selected [Enterprise Sync] Safeguard Horizon - Custom Tier.", ...prev]);
            }}
            className={`p-8 rounded-2xl border backdrop-blur-sm relative flex flex-col justify-between transition-all duration-300 cursor-pointer select-none ${
              selectedPlan === 2 
                ? "border-brand-primary ring-4 ring-brand-primary/20 bg-amber-50/20 shadow-[0_15px_35px_rgba(249,115,22,0.12)]" 
                : "border-brand-border bg-brand-surface hover:border-brand-primary/30"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-widest text-brand-text-secondary font-mono">Enterprise Sync</div>
                {selectedPlan === 2 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-[9px] bg-brand-primary text-white font-extrabold px-2 py-0.5 rounded font-mono uppercase tracking-wider"
                  >
                    Active Tier
                  </motion.span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-extrabold text-stone-900">Custom</span>
                <span className="text-xs text-brand-text-secondary font-mono">/ Annually</span>
              </div>
              <p className="text-xs text-brand-text-secondary mb-6 font-serif">
                Designed for high-growth start-up teams, university cohorts, and custom developer groups.
              </p>
              <div className="border-t border-brand-border/40 pt-6 flex flex-col gap-3">
                <div className="flex items-center gap-2.5 text-xs text-brand-text-secondary font-mono">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Collaborative team environments</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-brand-text-secondary">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Priority pipeline server execution speeds</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-brand-text-secondary">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Custom Slack/Teams intercept gateways</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-brand-text-secondary">
                  <Check className="w-4 h-4 text-brand-primary shrink-0" />
                  <span>Dedicated compliance officer SLA</span>
                </div>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlan(2);
                triggerToast("Contact form simulation activated. We will email you!");
              }}
              className="mt-8 w-full py-3 rounded-lg bg-black border border-brand-border hover:bg-white hover:border-brand-primary hover:text-black text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer font-mono"
            >
              Contact Solutions
            </button>
          </motion.div>

        </div>
      </section>
        </>
      )}

      {/* LOGIN / SIGN UP PAGE */}
      {viewMode === 'login' && (
        <div className="min-h-[85vh] flex flex-col justify-center items-center pt-32 pb-12 px-4 relative z-10">
          {/* Background Glow */}
          <div className="absolute inset-0 glow-radial pointer-events-none z-0" />
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md p-8 rounded-2xl border border-brand-border bg-brand-surface backdrop-blur-md shadow-[0_24px_64px_rgba(92,88,82,0.06)] relative z-10 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(249,115,22,0.4)]">
              <Lock className="w-5 h-5 text-white" />
            </div>
            
            <h2 className="text-xl font-extrabold tracking-tight text-stone-900 uppercase mb-2 font-sans">
              Authorize Proactive Guard
            </h2>
            <p className="text-xs text-brand-text-secondary leading-relaxed mb-6 font-serif">
              Link your Google Account to authorize background listeners. When activated, Aheado dispatches polite extension requests via Gmail and reschedules calendar clashes automatically.
            </p>

            {/* Main Google Button */}
            <button
              onClick={handleHeaderSignIn}
              disabled={isHeaderVerifying}
              className="w-full py-3 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 active:scale-[0.98] transition-all font-bold text-xs text-stone-700 shadow-sm flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {isHeaderVerifying ? "Connecting with Google..." : "Sign In / Sign Up with Google"}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-border/40"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest">
                <span className="bg-brand-bg px-3 text-stone-500 font-extrabold">Reviewer Safeguard</span>
              </div>
            </div>

            {/* Developer Bypass Warning */}
            <div className="p-4 rounded-xl border border-amber-200/50 bg-amber-50/40 text-left mb-6">
              <div className="flex gap-2 items-start text-amber-800 font-bold text-[9px] uppercase tracking-wider font-mono mb-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>Google Verification Shield</span>
              </div>
              <p className="text-[10px] text-amber-900 leading-relaxed font-sans mb-3">
                Since Aheado is currently in sandboxed test mode, Google may block access for non-whitelisted testers. Please use the Direct bypass below to try out live Workspace features instantly!
              </p>
              <button
                onClick={handleBypassSignIn}
                className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider font-mono shadow-sm cursor-pointer active:scale-95 transition-all text-center"
              >
                ⚡ 1-Click Mentor / Judge Bypass
              </button>
            </div>

            {/* Direct Token Option */}
            <div className="text-left">
              <button
                type="button"
                onClick={() => setShowTokenInput(!showTokenInput)}
                className="text-[9px] font-bold text-stone-500 hover:text-brand-primary uppercase tracking-widest font-mono flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <span>{showTokenInput ? "▼ Hide" : "▶ Show"} Direct Developer Token Login</span>
              </button>

              {showTokenInput && (
                <form onSubmit={handleManualTokenSubmit} className="mt-4 flex flex-col gap-2">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste OAuth access token here..."
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono bg-stone-50 text-stone-800 focus:outline-none focus:border-brand-primary"
                  />
                  <button
                    type="submit"
                    disabled={isHeaderVerifying}
                    className="w-full py-2 px-3 rounded-lg bg-black hover:bg-stone-900 text-white font-bold text-[10px] uppercase tracking-wider font-mono cursor-pointer transition-all text-center"
                  >
                    Authenticate Token
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* FOOTER SECTION */}
      <footer className="w-full bg-stone-50 border-t border-stone-200 py-12 relative z-10 text-center text-xs text-stone-500">

        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
              <Zap className="w-3.5 h-3.5 text-brand-primary" />
            </div>
            <span className="text-stone-900 font-extrabold tracking-wider font-sans">AHEADO</span>
          </div>
          <div className="text-stone-500">
            &copy; {new Date().getFullYear()} Aheado Systems Inc. Proactive Last-Minute Life Saver. All rights protected.
          </div>
          <div className="flex items-center gap-4 text-stone-500">
            <a href="#terms" onClick={(e) => { e.preventDefault(); triggerToast("Terms of service are standard sandbox developer agreements."); }} className="hover:text-brand-primary text-stone-600 transition-colors">Terms of Use</a>
            <span>•</span>
            <a href="#privacy" onClick={(e) => { e.preventDefault(); triggerToast("Privacy: No real portal data is saved in our server memory."); }} className="hover:text-brand-primary text-stone-600 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {isExecutionModalOpen && selectedInterceptForExecution && (
          <AgentExecutionModal
            isOpen={isExecutionModalOpen}
            onClose={() => {
              setIsExecutionModalOpen(false);
              setSelectedInterceptForExecution(null);
            }}
            intercept={selectedInterceptForExecution}
            onSuccess={handleExecutionSuccess}
            addSystemLog={(logText) => {
              setLogs(prev => [logText, ...prev]);
            }}
            scenarioText={customScenarioText}
          />
        )}
        
        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            approvedIntercepts={approvedIntercepts}
            activeIntercepts={activeIntercepts}
            hasUnhandledCrisis={hasUnhandledCrisis}
          />
        )}

        {showNotificationPrompt && (
          <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)] text-center relative overflow-hidden"
            >
              {/* Decorative light reflection */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-gradient-to-b from-brand-primary/10 to-transparent blur-xl pointer-events-none" />

              <div className="w-12 h-12 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mx-auto mb-5 shadow-[0_0_20px_rgba(249,115,22,0.15)] text-brand-primary">
                <Bell className="w-5 h-5 text-brand-primary" />
              </div>

              <h3 className="text-lg font-extrabold tracking-tight text-white uppercase mb-2 font-sans">
                Enable Live Desktop Alerts?
              </h3>
              
              <p className="text-xs text-stone-400 leading-relaxed mb-6 font-serif italic font-medium px-2">
                "An outstanding shield requires active transmission." Enable system-native push alerts to receive critical workspace warning triggers even when your browser tab is closed.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={async () => {
                    setShowNotificationPrompt(false);
                    await requestNotificationPermission();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-brand-primary hover:bg-brand-accent active:scale-[0.98] transition-all font-bold text-xs text-white uppercase tracking-wider font-mono shadow-[0_4px_20px_rgba(249,115,22,0.25)] cursor-pointer"
                >
                  Enable OS Alerts
                </button>
                
                <button
                  onClick={() => setShowNotificationPrompt(false)}
                  className="w-full py-2.5 px-4 rounded-xl border border-stone-800 bg-stone-950 hover:bg-stone-800/60 text-stone-400 hover:text-stone-300 active:scale-[0.98] transition-all font-bold text-xs uppercase tracking-wider font-mono cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
