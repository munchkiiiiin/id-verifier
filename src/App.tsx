import { useState, useEffect, useCallback } from "react";
import { Home, QrCode, ClipboardList, Database, Camera } from "lucide-react";
import { HomeTab } from "./components/HomeTab";
import { ScannerTab, LogEntry } from "./components/ScannerTab";
import { ReportsTab } from "./components/ReportsTab";
import { DatabaseTab } from "./components/DatabaseTab";
import { cn } from "./lib/utils";
import { motion } from "motion/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

type Tab = "home" | "scanner" | "reports" | "database";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [captureTrigger, setCaptureTrigger] = useState(0);
  const [lastProcessedTrigger, setLastProcessedTrigger] = useState(0);

  // Theme state persisted to localStorage
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("sentinel_theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
    localStorage.setItem("sentinel_theme", theme);
  }, [theme]);

  // Lifted Scan Logs state with localStorage persistence
  const [scanLog, setScanLog] = useState<LogEntry[]>(() => {
    try {
      const stored = localStorage.getItem("sentinel_scan_log");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
    } catch (e) {
      console.error("Failed to load scan log from localStorage:", e);
    }
    return [];
  });

  // Save scan logs to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem("sentinel_scan_log", JSON.stringify(scanLog));
    } catch (e) {
      console.error("Failed to save scan log to localStorage:", e);
    }
  }, [scanLog]);

  const handlePushLog = useCallback((entry: LogEntry) => {
    setScanLog((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  const handleClearLogs = useCallback(() => {
    setScanLog([]);
  }, []);

  const handleCaptureComplete = useCallback((val: number) => {
    setLastProcessedTrigger(val);
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-gradient-to-br from-brand-bg-grad-start to-brand-bg-grad-end relative overflow-hidden">

      {/* ── Ambient background orbs ─────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* top-right warm glow */}
        <div
          className="absolute -top-[20%] -right-[20%] w-[65vw] h-[65vw] max-w-[340px] max-h-[340px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #F6BE5A 0%, transparent 70%)" }}
        />
        {/* bottom-left cool glow */}
        <div
          className="absolute -bottom-[15%] -left-[15%] w-[55vw] h-[55vw] max-w-[280px] max-h-[280px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #818CF8 0%, transparent 70%)" }}
        />
      </div>

      {/* ── Main content area ───────────────────────────────────── */}
      <main className="flex-1 overflow-hidden relative">
        {/* 1. Home Tab */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            activeTab === "home" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
          )}
        >
          {activeTab === "home" && (
            <HomeTab
              onStartScan={() => setActiveTab("scanner")}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            />
          )}
        </div>

        {/* 2. Scanner Tab */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            activeTab === "scanner" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
          )}
        >
          {activeTab === "scanner" && (
            <ScannerTab
              scanLog={scanLog}
              onPushLog={handlePushLog}
              onClearLogs={handleClearLogs}
              captureTrigger={captureTrigger}
              lastProcessedTrigger={lastProcessedTrigger}
              onCaptureComplete={handleCaptureComplete}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            />
          )}
        </div>

        {/* 3. Reports Tab */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            activeTab === "reports" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
          )}
        >
          {activeTab === "reports" && (
            <ReportsTab
              scanLog={scanLog}
              onClearLogs={() => setScanLog([])}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            />
          )}
        </div>

        {/* 4. Admin Database Tab */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            activeTab === "database" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
          )}
        >
          {activeTab === "database" && (
            <DatabaseTab
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            />
          )}
        </div>
      </main>

      {/* ── Bottom nav bar ──────────────────────────────────────── */}
      <nav
        className="relative z-20 glass border-t border-brand-border h-20 flex justify-around items-center px-2 pb-safe"
        style={{ paddingBottom: "max(0.2rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Tab 1: Home */}
        <button
          onClick={() => setActiveTab("home")}
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-all cursor-pointer",
            activeTab === "home" ? "text-accent scale-100 font-bold" : "text-white/35 hover:text-white/60 scale-95"
          )}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-widest font-semibold">Home</span>
        </button>

        {/* Tab 2: Scanner */}
        <button
          onClick={() => setActiveTab("scanner")}
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-all cursor-pointer",
            activeTab === "scanner" ? "text-accent scale-100 font-bold" : "text-white/35 hover:text-white/60 scale-95"
          )}
        >
          <QrCode className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-widest font-semibold">Scanner</span>
        </button>

        {/* Center Button: Elevated Capture Action */}
        <div className="relative w-20 h-full flex justify-center items-center">
          <motion.button
            whileHover={{ scale: 1.08, y: -6 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              setActiveTab("scanner");
              setCaptureTrigger((prev) => prev + 1);
            }}
            className="absolute -top-6 w-16 h-16 bg-[#fd761a] hover:bg-[#e06210] rounded-full flex items-center justify-center text-white shadow-[0_6px_24px_rgba(253,118,26,0.45)] border-4 border-brand-bg-deep cursor-pointer transition-colors duration-200"
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Camera Icon - shifted higher to balance the arched text */}
              <motion.div
                animate={activeTab === "scanner" ? { rotate: [0, -10, 10, 0] } : {}}
                transition={{ repeat: Infinity, repeatDelay: 5, duration: 0.5 }}
                className="absolute top-[18%] flex items-center justify-center"
              >
                <Camera className="w-6.5 h-6.5 text-white" />
              </motion.div>

              {/* Arched text following bottom curve */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
                <path
                  id="textPath-capture"
                  d="M 14,50 A 36,36 0 0,0 86,50"
                  fill="none"
                  stroke="none"
                />
                <text className="fill-white font-bold text-[9px] tracking-[0.28em]">
                  <textPath href="#textPath-capture" startOffset="50%" textAnchor="middle">
                    CAPTURE
                  </textPath>
                </text>
              </svg>
            </div>
          </motion.button>
        </div>

        {/* Tab 3: Reports */}
        <button
          onClick={() => setActiveTab("reports")}
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-all cursor-pointer",
            activeTab === "reports" ? "text-accent scale-100 font-bold" : "text-white/35 hover:text-white/60 scale-95"
          )}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-widest font-semibold">Reports</span>
        </button>

        {/* Tab 4: Admin (Database) */}
        <button
          onClick={() => setActiveTab("database")}
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-all cursor-pointer",
            activeTab === "database" ? "text-accent scale-100 font-bold" : "text-white/35 hover:text-white/60 scale-95"
          )}
        >
          <Database className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-widest font-semibold">Admin</span>
        </button>

      </nav>
      <SpeedInsights />
    </div>
  );
}
