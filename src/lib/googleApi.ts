// Google Workspace API Client for Gmail and Google Calendar
// Powered by Firebase Google Auth and Google Workspace API Core

import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google OAuth Provider with Workspace Scopes
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/gmail.send");
provider.addScope("https://www.googleapis.com/auth/gmail.readonly");
provider.addScope("https://www.googleapis.com/auth/gmail.compose");
provider.addScope("https://www.googleapis.com/auth/calendar.events");
provider.addScope("https://www.googleapis.com/auth/classroom.courses.readonly");
provider.addScope("https://www.googleapis.com/auth/classroom.coursework.me.readonly");

export interface GoogleUserProfile {
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleConnectionState {
  isConnected: boolean;
  accessToken: string | null;
  userProfile: GoogleUserProfile | null;
}

// In-memory cache for the Google Access Token (mandated security constraint)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Initialize Firebase Auth state listener and restore active session
 */
export function initAuth(
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess(user, cachedAccessToken);
      } else {
        // If logged in but token is not in cache, we require a silent refresh or a re-login
        // In simple apps, we can keep the local connection state or prompt sign-in
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure();
    }
  });
}

/**
 * Trigger Firebase Google Auth popup for Multi-User Sign-In / Sign-Up
 */
export async function googleSignIn(): Promise<{ user: User; accessToken: string } | null> {
  if (isSigningIn) return null;
  
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Workspace OAuth access token from Google Sign-In.");
    }

    cachedAccessToken = credential.accessToken;
    
    // Save user info and access token in localStorage for persistence across refreshes
    const userProfile: GoogleUserProfile = {
      email: result.user.email || "",
      name: result.user.displayName || "Google User",
      picture: result.user.photoURL || undefined
    };
    
    localStorage.setItem("aheado_google_profile", JSON.stringify(userProfile));
    localStorage.setItem("aheado_google_access_token", credential.accessToken);
    
    return { 
      user: result.user, 
      accessToken: cachedAccessToken 
    };
  } catch (error: any) {
    console.error("Google Workspace sign-in failed:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Safe logout and cache clean-up
 */
export async function googleSignOut() {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem("aheado_google_profile");
  localStorage.removeItem("aheado_google_access_token");
}

/**
 * Synchronous state fetcher
 */
export function loadConnectionState(): GoogleConnectionState {
  const profileStr = localStorage.getItem("aheado_google_profile");
  let userProfile: GoogleUserProfile | null = null;
  
  if (profileStr) {
    try {
      userProfile = JSON.parse(profileStr);
    } catch {
      // ignore
    }
  }

  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem("aheado_google_access_token");
  }

  return {
    isConnected: !!cachedAccessToken && !!userProfile,
    accessToken: cachedAccessToken,
    userProfile
  };
}

/**
 * Supports manual override developer tokens for immediate preview testing
 */
export function applyManualDeveloperToken(token: string, profile: GoogleUserProfile) {
  cachedAccessToken = token;
  localStorage.setItem("aheado_google_profile", JSON.stringify(profile));
  localStorage.setItem("aheado_google_access_token", token);
}

/**
 * Fetch Google User Profile using Access Token (used for validation)
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch user info: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    email: data.email,
    name: data.name,
    picture: data.picture
  };
}

/**
 * Helper to Base64url encode a standard email message for Gmail raw send API
 */
function buildRawEmail(to: string, subject: string, bodyText: string): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
    ``,
    bodyText
  ];
  
  const emailString = emailLines.join("\n");
  
  // Standard btoa encoding with base64url replacements
  const base64 = btoa(unescape(encodeURIComponent(emailString)));
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Send real email using Gmail API
 */
export async function sendGmailEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id: string; threadId: string }> {
  const raw = buildRawEmail(to, subject, body);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || response.statusText;
    throw new Error(`Gmail API error: ${message}`);
  }

  return response.json();
}

/**
 * Create a draft email in the user's Gmail drafts
 */
export async function createGmailDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id: string; message: { id: string; threadId: string } }> {
  const raw = buildRawEmail(to, subject, body);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: { raw }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || response.statusText;
    throw new Error(`Gmail Draft API error: ${message}`);
  }

  return response.json();
}

/**
 * Create a real calendar event in Google Calendar primary calendar
 */
export async function createCalendarEvent(
  accessToken: string,
  summary: string,
  description: string,
  startTimeIso: string,
  endTimeIso: string
): Promise<any> {
  const event = {
    summary,
    description: `${description}\n\n[Triggered via Aheado Proactive Agent Core]`,
    start: {
      dateTime: startTimeIso,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    },
    end: {
      dateTime: endTimeIso,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    },
    reminders: {
      useDefault: true
    }
  };

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || response.statusText;
    throw new Error(`Google Calendar API error: ${message}`);
  }

  return response.json();
}

/**
 * Delete a calendar event from primary calendar
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<any> {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || response.statusText;
    throw new Error(`Google Calendar API delete error: ${message}`);
  }

  return response.text();
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  summary: string,
  description: string,
  startTimeIso: string,
  endTimeIso: string
): Promise<any> {
  const event = {
    summary,
    description: `${description}\n\n[Triggered via Aheado Proactive Agent Core]`,
    start: {
      dateTime: startTimeIso,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    },
    end: {
      dateTime: endTimeIso,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    }
  };

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || response.statusText;
    throw new Error(`Google Calendar API error: ${message}`);
  }

  return response.json();
}

export interface SimpleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
}

export interface SimpleGmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

/**
 * Fetch calendar events for the next 7 days from the user's primary calendar
 */
export async function fetchCalendarEvents(accessToken: string): Promise<SimpleCalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ahead

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=20`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || response.statusText;
    throw new Error(`Google Calendar API error: ${message}`);
  }

  const data = await response.json();
  const items = data.items || [];

  return items.map((item: any) => ({
    id: item.id,
    summary: item.summary || "(No Title)",
    description: item.description || "",
    start: item.start?.dateTime || item.start?.date || "",
    end: item.end?.dateTime || item.end?.date || ""
  }));
}

/**
 * Fetch the 5 most recent Gmail messages from the user's primary inbox
 */
export async function fetchLatestEmails(accessToken: string): Promise<SimpleGmailMessage[]> {
  const listUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=category:primary";
  
  const response = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || response.statusText;
    throw new Error(`Gmail list error: ${message}`);
  }

  const listData = await response.json();
  const messages = listData.messages || [];
  
  const results: SimpleGmailMessage[] = [];

  for (const msg of messages) {
    try {
      const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
      const detailRes = await fetch(detailUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!detailRes.ok) continue;

      const detailData = await detailRes.json();
      
      // Parse headers
      const headers = detailData.payload?.headers || [];
      const fromHeader = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "Unknown";
      const subjectHeader = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "(No Subject)";
      const dateHeader = headers.find((h: any) => h.name?.toLowerCase() === "date")?.value || "";

      results.push({
        id: msg.id,
        from: fromHeader,
        subject: subjectHeader,
        date: dateHeader,
        snippet: detailData.snippet || ""
      });
    } catch (e) {
      console.error(`Failed to fetch email detail for msg ${msg.id}`, e);
    }
  }

  return results;
}

export interface ClassroomDeadline {
  id: string;
  courseName: string;
  title: string;
  description?: string;
  dueDate?: string;
  dueDateTime?: string;
  alternateLink?: string;
}

export async function fetchClassroomDeadlines(accessToken: string): Promise<ClassroomDeadline[]> {
  const response = await fetch("https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || response.statusText;
    throw new Error(`Google Classroom API courses fetch error: ${message}`);
  }

  const coursesData = await response.json();
  const courses = coursesData.courses || [];
  const deadlines: ClassroomDeadline[] = [];

  for (const course of courses) {
    try {
      const cwRes = await fetch(`https://classroom.googleapis.com/v1/courses/${course.id}/courseWork`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });
      if (!cwRes.ok) continue;

      const cwData = await cwRes.json();
      const courseWorks = cwData.courseWork || [];

      for (const cw of courseWorks) {
        let dueDateStr = "";
        let dueDateTimeStr = "";
        if (cw.dueDate) {
          const { year, month, day } = cw.dueDate;
          const monthStr = String(month).padStart(2, '0');
          const dayStr = String(day).padStart(2, '0');
          dueDateStr = `${year}-${monthStr}-${dayStr}`;

          if (cw.dueTime) {
            const { hours, minutes } = cw.dueTime;
            const hrStr = String(hours || 0).padStart(2, '0');
            const minStr = String(minutes || 0).padStart(2, '0');
            dueDateTimeStr = `${dueDateStr}T${hrStr}:${minStr}:00Z`;
          } else {
            dueDateTimeStr = `${dueDateStr}T23:59:59Z`;
          }
        }

        deadlines.push({
          id: cw.id,
          courseName: course.name,
          title: cw.title,
          description: cw.description || "",
          dueDate: dueDateStr,
          dueDateTime: dueDateTimeStr,
          alternateLink: cw.alternateLink || ""
        });
      }
    } catch (e) {
      console.error(`Failed to fetch coursework for course ${course.id}`, e);
    }
  }

  // Sort by dueDateTime
  deadlines.sort((a, b) => {
    if (!a.dueDateTime) return 1;
    if (!b.dueDateTime) return -1;
    return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime();
  });

  return deadlines;
}

