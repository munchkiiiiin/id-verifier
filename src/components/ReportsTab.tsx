import { useState, useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { CheckCircle2, XCircle, AlertTriangle, Trash2, Calendar, FileText, ChevronDown, ChevronUp, ClipboardList, Sun, Moon } from "lucide-react";
import { LogEntry, STATUS_CONFIG } from "./ScannerTab";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface ReportsTabProps {
  scanLog: LogEntry[];
  onClearLogs: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

export function ReportsTab({ scanLog, onClearLogs, theme, onToggleTheme }: ReportsTabProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Group logs by date string (e.g. June 2, 2026)
  const groupedLogs = useMemo(() => {
    const groups: { [dateStr: string]: LogEntry[] } = {};
    
    scanLog.forEach((log) => {
      let dateLabel = format(log.timestamp, "MMMM d, yyyy");
      if (isToday(log.timestamp)) {
        dateLabel = "Today";
      } else if (isYesterday(log.timestamp)) {
        dateLabel = "Yesterday";
      }
      
      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(log);
    });
    
    return groups;
  }, [scanLog]);

  // Statistics calculations
  const stats = useMemo(() => {
    const total = scanLog.length;
    if (total === 0) {
      return { total: 0, verified: 0, expired: 0, issues: 0, rate: 0 };
    }
    
    let verified = 0;
    let expired = 0;
    let issues = 0;
    
    scanLog.forEach((log) => {
      if (log.status === "valid") verified++;
      else if (log.status === "expired") expired++;
      else issues++; // not_found and invalid_qr
    });
    
    return {
      total,
      verified,
      expired,
      issues,
      rate: Math.round((verified / total) * 100)
    };
  }, [scanLog]);

  // Ring chart stroke calculation
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (stats.rate / 100) * circumference;

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex justify-between items-center px-6 h-16 w-full bg-black/20 border-b border-brand-border flex-shrink-0">
        <div className="flex items-center gap-2 text-white font-bold">
          <ClipboardList className="w-5 h-5 text-accent" />
          <span className="font-headline-md tracking-wide">Sentinel Reports</span>
        </div>
        <div className="flex items-center gap-3">
          {scanLog.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear all scan history?")) {
                  onClearLogs();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer animate-fade-in"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Logs</span>
            </button>
          )}
          <button
            onClick={onToggleTheme}
            className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* ── Scrollable Content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-5xl mx-auto w-full flex flex-col gap-6 pb-32">
        {/* ── Empty State ────────────────────────────────────────── */}
        {scanLog.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center glass rounded-3xl border border-white/07 p-8">
            <div className="w-16 h-16 rounded-full bg-white/03 border border-white/05 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-base font-bold text-white/70">No Scan Data</h3>
            <p className="text-xs text-white/35 max-w-xs mt-1.5 leading-relaxed">
              There are no scanned records logged on this device yet. Perform a scan in the Scanner tab to view daily reports.
            </p>
          </div>
        ) : (
          <>
            {/* ── Metrics Panel ────────────────────────────────────── */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* SVG Ring Chart Box */}
              <div className="glass rounded-3xl p-6 border border-white/07 flex items-center justify-between gap-6 md:col-span-1">
                <div className="flex flex-col">
                  <span className="text-xs text-white/40 uppercase tracking-widest font-semibold">Success Rate</span>
                  <span className="text-3xl font-extrabold text-white mt-1">{stats.rate}%</span>
                  <span className="text-[10px] text-emerald-400 font-medium mt-1">Verified / Scans Ratio</span>
                </div>
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full transform -rotate-90">
                    {/* Track circle */}
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      className="stroke-white/05 fill-none"
                      strokeWidth="6"
                    />
                    {/* Progress circle */}
                    <motion.circle
                      cx="40"
                      cy="40"
                      r={radius}
                      className="stroke-[#fd761a] fill-none"
                      strokeWidth="6"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: strokeOffset }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white/80">{stats.verified} / {stats.total}</span>
                  </div>
                </div>
              </div>

              {/* Numeric Stats Boxes */}
              <div className="grid grid-cols-3 md:grid-cols-3 gap-4 md:col-span-2">
                <div className="glass rounded-3xl p-4 md:p-6 border border-white/07 flex flex-col justify-between">
                  <span className="text-[10px] md:text-xs text-white/40 uppercase tracking-widest font-semibold">Total Scans</span>
                  <span className="text-2xl md:text-3xl font-extrabold text-white mt-2">{stats.total}</span>
                </div>
                <div className="glass rounded-3xl p-4 md:p-6 border border-white/07 flex flex-col justify-between">
                  <span className="text-[10px] md:text-xs text-white/40 uppercase tracking-widest font-semibold text-emerald-400/80">Verified</span>
                  <span className="text-2xl md:text-3xl font-extrabold text-emerald-400 mt-2">{stats.verified}</span>
                </div>
                <div className="glass rounded-3xl p-4 md:p-6 border border-white/07 flex flex-col justify-between">
                  <span className="text-[10px] md:text-xs text-white/40 uppercase tracking-widest font-semibold text-rose-400/80">Expired</span>
                  <span className="text-2xl md:text-3xl font-extrabold text-rose-400 mt-2">{stats.expired}</span>
                </div>
              </div>
            </section>

            {/* ── Daily Breakdown Logs ──────────────────────────────── */}
            <section className="flex flex-col gap-4">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider px-1">Daily Log Breakdown</h2>
              
              <div className="flex flex-col gap-6">
                {Object.keys(groupedLogs).map((dateLabel) => (
                  <div key={dateLabel} className="flex flex-col gap-2">
                    {/* Date section header */}
                    <div className="flex items-center gap-2 px-1 text-xs text-white/30 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-white/20" />
                      <span>{dateLabel}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                      <span>{groupedLogs[dateLabel].length} scans</span>
                    </div>

                    {/* List of logs for this day */}
                    <div className="flex flex-col gap-2">
                      {groupedLogs[dateLabel].map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        const cfg = STATUS_CONFIG[log.status];
                        const Icon = cfg.icon;
                        const emp = log.employee;

                        return (
                          <div key={log.id} className="flex flex-col">
                            {/* Row container */}
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className={cn(
                                "w-full glass p-4 flex items-center justify-between gap-3 border border-white/05 transition-all text-left",
                                isExpanded ? "rounded-t-2xl border-white/10" : "rounded-2xl hover:border-white/10"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Status Icon */}
                                <div className={cn(
                                  "w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center",
                                  log.status === "valid"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : log.status === "expired"
                                      ? "bg-rose-500/10 text-rose-400"
                                      : "bg-amber-500/10 text-amber-400"
                                )}>
                                  <Icon className="w-4.5 h-4.5" />
                                </div>

                                {/* Info block */}
                                <div className="min-w-0 flex-1">
                                  <span className="font-semibold text-white/90 text-sm truncate block">
                                    {emp ? emp.name : cfg.label}
                                  </span>
                                  <span className="text-xs text-white/30 font-mono mt-0.5 truncate block">
                                    {emp ? `${emp.designation} • ` : ""}
                                    {format(log.timestamp, "h:mm a")}
                                  </span>
                                </div>
                              </div>

                              {/* Badge and chevron */}
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                  cfg.badgeCls
                                )}>
                                  {cfg.label}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-white/35" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-white/35" />
                                )}
                              </div>
                            </button>

                            {/* Expanded Details */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden"
                                >
                                  <div className="glass rounded-b-2xl -mt-px border border-white/10 p-4 grid grid-cols-2 gap-3 text-xs bg-white/[0.01]">
                                    {emp ? (
                                      <>
                                        <div>
                                          <p className="text-white/20 uppercase tracking-widest font-semibold mb-0.5">Employee ID</p>
                                          <p className="text-white/70 font-mono font-medium">{emp.employeeCode}</p>
                                        </div>
                                        <div>
                                          <p className="text-white/20 uppercase tracking-widest font-semibold mb-0.5">Designation</p>
                                          <p className="text-white/70 font-medium">{emp.designation}</p>
                                        </div>
                                        <div>
                                          <p className="text-white/20 uppercase tracking-widest font-semibold mb-0.5">Establishment</p>
                                          <p className="text-white/70 font-medium">{emp.establishment}</p>
                                        </div>
                                        <div>
                                          <p className="text-white/20 uppercase tracking-widest font-semibold mb-0.5">Validity Expiry</p>
                                          <p className={cn("font-bold", log.status === "expired" ? "text-rose-400" : "text-emerald-400")}>
                                            {format(new Date(emp.expiryDate), "MMMM d, yyyy")}
                                          </p>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="col-span-2">
                                        <p className="text-white/20 uppercase tracking-widest font-semibold mb-0.5">Reason</p>
                                        <p className="text-amber-400/80 font-medium">
                                          {log.status === "not_found" ? "Token not found in database records." : "Invalid QR format scanned."}
                                        </p>
                                      </div>
                                    )}
                                    <div className="col-span-2">
                                      <p className="text-white/20 uppercase tracking-widest font-semibold mb-0.5">Scan Exact Time</p>
                                      <p className="text-white/50 font-mono">{format(log.timestamp, "MMMM d, yyyy — hh:mm:ss a")}</p>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
