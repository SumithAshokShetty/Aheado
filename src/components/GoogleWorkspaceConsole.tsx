import React, { useState, useEffect } from "react";
import { 
  loadConnectionState, 
  googleSignIn,
  googleSignOut,
  applyManualDeveloperToken,
  fetchGoogleProfile, 
  GoogleConnectionState 
} from "../lib/googleApi";
import { 
  Shield, 
  LogOut, 
  Sparkles, 
  Key, 
  Mail, 
  Calendar, 
  RefreshCw
} from "lucide-react";

interface GoogleWorkspaceConsoleProps {
  onConnectionChange?: (state: GoogleConnectionState) => void;
  triggerToast: (msg: string) => void;
  addSystemLog: (log: string) => void;
}

export function GoogleWorkspaceConsole({
  onConnectionChange,
  triggerToast,
  addSystemLog
}: GoogleWorkspaceConsoleProps) {
  const [conn, setConn] = useState<GoogleConnectionState>({
    isConnected: false,
    accessToken: null,
    userProfile: null
  });

  const [tokenInput, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Load state on mount
  useEffect(() => {
    const loaded = loadConnectionState();
    setConn(loaded);
    if (onConnectionChange) {
      onConnectionChange(loaded);
    }
  }, []);

  const handleConnectOauth = async () => {
    setIsVerifying(true);
    addSystemLog(`[OAUTH] Launching secure Google Workspace Authorization popup...`);
    try {
      const result = await googleSignIn();
      if (result) {
        const newState = loadConnectionState();
        setConn(newState);
        if (onConnectionChange) onConnectionChange(newState);
        triggerToast(`🎉 Workspace connected! Welcome, ${result.user.displayName || "User"}.`);
        addSystemLog(`[WORKSPACE] Google sign-in successful: ${result.user.email}`);
      }
    } catch (error: any) {
      console.error(error);
      triggerToast(`❌ Google authentication failed: ${error.message || "User cancelled or blocked."}`);
      addSystemLog(`[ERROR] Auth failed: ${error.message || "OAuth popup closed before completion."}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setIsVerifying(true);
    addSystemLog(`[TOKEN] Connecting workspace using developer playground token.`);
    try {
      const profile = await fetchGoogleProfile(token);
      applyManualDeveloperToken(token, profile);
      const newState = loadConnectionState();
      setConn(newState);
      if (onConnectionChange) onConnectionChange(newState);
      setTokenInput("");
      setShowTokenInput(false);
      triggerToast(`⚡ Connected! Welcome ${profile.name}. Live Gmail & Calendar enabled.`);
      addSystemLog(`[WORKSPACE] Live Google Workspace link verified: ${profile.email}`);
    } catch (error: any) {
      console.error(error);
      triggerToast("❌ Token verification failed. Make sure the token is active and valid.");
      addSystemLog(`[ERROR] Direct token authentication failed. Token may be expired.`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    await googleSignOut();
    const reset = {
      isConnected: false,
      accessToken: null,
      userProfile: null
    };
    setConn(reset);
    if (onConnectionChange) onConnectionChange(reset);
    triggerToast("🔌 Google Workspace connection detached safely.");
    addSystemLog("[WORKSPACE] User Google account disconnected.");
  };

  return (
    <div className="w-full rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-xl relative overflow-hidden mb-6">
      {/* Decorative state indicator */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${conn.isConnected ? "bg-emerald-500" : "bg-brand-primary animate-pulse"}`} />
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left Section: Info and Status */}
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center relative">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${conn.isConnected ? "bg-emerald-400 animate-ping" : "bg-brand-primary animate-ping"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${conn.isConnected ? "bg-emerald-500" : "bg-brand-primary"}`} />
            </div>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono">
              Workspace Core: {conn.isConnected ? "LIVE INTEGRATION ACTIVE" : "STANDBY DETACHED"}
            </span>
          </div>

          <h3 className="text-lg font-bold text-white font-sans flex items-center gap-2">
            <Shield className={`w-5 h-5 ${conn.isConnected ? "text-emerald-400" : "text-brand-primary"}`} />
            Google Workspace Integration Console
          </h3>
          <p className="text-xs text-brand-text-secondary mt-1 max-w-2xl leading-relaxed">
            Link your Google Account to authorize Aheado background agents. When activated, approvals will execute real-world actions like sending live extension requests via **Gmail** and rescheduling overlaps on your **Google Calendar** dynamically.
          </p>
        </div>

        {/* Right Section: Connections Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {conn.isConnected && conn.userProfile ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-black/30 border border-brand-border/40 p-3 rounded-xl">
              {/* User Identity Display */}
              <div className="flex items-center gap-3">
                {conn.userProfile.picture ? (
                  <img 
                    src={conn.userProfile.picture} 
                    alt={conn.userProfile.name} 
                    className="w-10 h-10 rounded-full border border-emerald-500/30 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    {conn.userProfile.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                    {conn.userProfile.name}
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono leading-none mt-0.5">{conn.userProfile.email}</div>
                  <div className="flex gap-2.5 mt-1.5 text-[9px] font-bold uppercase font-mono tracking-wider">
                    <span className="text-emerald-400 flex items-center gap-0.5"><Mail className="w-3 h-3 shrink-0" /> Gmail active</span>
                    <span className="text-emerald-400 flex items-center gap-0.5"><Calendar className="w-3 h-3 shrink-0" /> Calendar active</span>
                  </div>
                </div>
              </div>

              {/* Detach Account Button */}
              <button
                onClick={handleDisconnect}
                className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="Disconnect Account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {/* Official styled custom Google Sign-In / Sign-Up Button */}
                <button
                  onClick={handleConnectOauth}
                  disabled={isVerifying}
                  className="px-5 py-3 rounded-lg bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 cursor-pointer border border-stone-200 shadow-md transition-all active:scale-95 duration-150 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-brand-primary" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        <path fill="none" d="M0 0h48v48H0z" />
                      </svg>
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>

                {/* Developer token key option */}
                <button
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    showTokenInput 
                      ? "border-brand-primary bg-brand-primary/10 text-brand-primary" 
                      : "border-brand-border hover:border-brand-primary/30 text-stone-300 hover:bg-black/20"
                  }`}
                  title="Developer token playground mode"
                >
                  <Key className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Developer Token Paste Form (Collapsible) */}
      {showTokenInput && !conn.isConnected && (
        <div className="mt-4 pt-4 border-t border-brand-border/40 bg-black/20 p-4 rounded-xl">
          <form onSubmit={handleManualTokenSubmit} className="flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-brand-primary animate-pulse" />
                  Instant Developer Playground Token
                </label>
                <a 
                  href="https://developers.google.com/oauthplayground/" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[10px] text-brand-primary hover:underline font-mono"
                >
                  Open Google OAuth Playground &rarr;
                </a>
              </div>
              <p className="text-[11px] text-stone-400 mb-2 leading-relaxed">
                Want to test real actions instantly without setting up Google Cloud? Open the Google OAuth Playground, select Gmail Send & Calendar Event scopes, authorize, exchange codes, and paste the resulting <strong className="text-stone-300">Access Token</strong> below. Enjoy 60 minutes of fully live proactive protection!
              </p>
              
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste Google OAuth Access Token (ya29.a0A...)"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="flex-1 bg-black/60 border border-brand-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-stone-600 focus:outline-none focus:border-brand-primary font-mono"
                />
                <button
                  type="submit"
                  disabled={isVerifying || !tokenInput}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-950 disabled:text-emerald-800 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer shrink-0"
                >
                  {isVerifying ? "Verifying..." : "Apply Token"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
