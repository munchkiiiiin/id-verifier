import React, { useState, useRef, useCallback, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useEmployees, Employee } from "../hooks/useEmployees";
import { format, isBefore, startOfDay, parseISO } from "date-fns";
import { CheckCircle2, XCircle, AlertTriangle, Upload, Camera, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import jsQR from "jsqr";
import { motion, AnimatePresence } from "motion/react";
import { extractTokenFromQrValue } from "../lib/qr";

/* ─── Types ─────────────────────────────────────────────────────── */
type ScanStatus = "valid" | "expired" | "not_found" | "invalid_qr";

interface LogEntry {
  id: string;
  status: ScanStatus;
  employee?: Employee;
  scannedToken?: string;
  timestamp: Date;
}

/* ─── Status config ─────────────────────────────────────────────── */
const STATUS_CONFIG: Record<ScanStatus, {
  icon: React.FC<{ className?: string }>;
  label: string;
  dotColor: string;
  textColor: string;
  badgeCls: string;
}> = {
  valid:      { icon: CheckCircle2,  label: "Verified",   dotColor: "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.9)]",   textColor: "text-emerald-400", badgeCls: "status-valid"   },
  expired:    { icon: XCircle,       label: "Expired",    dotColor: "bg-rose-500 shadow-[0_0_8px_rgba(248,113,113,0.9)]",     textColor: "text-rose-400",    badgeCls: "status-expired" },
  not_found:  { icon: AlertTriangle, label: "Not Found",  dotColor: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]",     textColor: "text-amber-400",   badgeCls: "bg-amber-500/10 text-amber-400 border border-amber-500/30" },
  invalid_qr: { icon: AlertTriangle, label: "Invalid QR", dotColor: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]",     textColor: "text-amber-400",   badgeCls: "bg-amber-500/10 text-amber-400 border border-amber-500/30" },
};

const FLASH_BORDER: Record<ScanStatus, string> = {
  valid:      "border-emerald-400/80 shadow-[0_0_35px_rgba(52,211,153,0.35)]",
  expired:    "border-rose-400/80 shadow-[0_0_35px_rgba(248,113,113,0.35)]",
  not_found:  "border-amber-400/80 shadow-[0_0_35px_rgba(245,158,11,0.35)]",
  invalid_qr: "border-amber-400/80 shadow-[0_0_35px_rgba(245,158,11,0.35)]",
};

/* ─── Main component ────────────────────────────────────────────── */
export function ScannerTab() {
  const { fetchEmployeeByToken, isLoaded } = useEmployees();
  const [isProcessing, setIsProcessing]   = useState(false);
  const [scanLog, setScanLog]             = useState<LogEntry[]>([]);
  const [lastFlash, setLastFlash]         = useState<ScanStatus | null>(null);
  const fileInputRef                      = useRef<HTMLInputElement>(null);
  const scannerRef                        = useRef<HTMLDivElement>(null);
  const lastScannedRef                    = useRef<string>("");
  const debounceRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledInitialTokenRef            = useRef(false);

  /* ── Push result to log ─────────────────────────────────────── */
  const pushLog = (entry: Omit<LogEntry, "id" | "timestamp">) => {
    const newEntry: LogEntry = { ...entry, id: crypto.randomUUID(), timestamp: new Date() };
    setScanLog((prev) => [newEntry, ...prev].slice(0, 50));
    setLastFlash(entry.status);
    setTimeout(() => setLastFlash(null), 900);
  };

  /* ── Resolve token ──────────────────────────────────────────── */
  const resolveToken = useCallback(async (raw: string) => {
    if (!raw || !isLoaded) return;
    let token = extractTokenFromQrValue(raw);
    try { const p = JSON.parse(raw); if (p.token) token = String(p.token).trim(); else if (p.id) token = String(p.id).trim(); } catch {}
    try {
      const employee = await fetchEmployeeByToken(token);
      if (employee) {
        const expired = isBefore(startOfDay(parseISO(employee.expiryDate)), startOfDay(new Date()));
        pushLog({ status: expired ? "expired" : "valid", employee, scannedToken: token });
      } else {
        pushLog({ status: "not_found", scannedToken: token });
      }
    } catch { pushLog({ status: "invalid_qr" }); }
  }, [fetchEmployeeByToken, isLoaded]);

  useEffect(() => {
    if (handledInitialTokenRef.current || typeof window === "undefined") return;

    const initialToken = new URL(window.location.href).searchParams.get("token");
    if (!initialToken) return;

    handledInitialTokenRef.current = true;
    (async () => {
      setIsProcessing(true);
      try {
        await resolveToken(initialToken);
      } finally {
        setIsProcessing(false);
      }
    })();
  }, [resolveToken]);

  /* ── Live camera (debounced) ────────────────────────────────── */
  const handleLiveScan = (raw: string) => {
    if (raw === lastScannedRef.current) return;
    lastScannedRef.current = raw;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { lastScannedRef.current = ""; }, 3000);
    resolveToken(raw);
  };

  /* ── Capture frame ──────────────────────────────────────────── */
  const handleCaptureFrame = () => {
    const video = scannerRef.current?.querySelector("video");
    if (!video) return;
    setIsProcessing(true);
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d");
    if (!ctx) { setIsProcessing(false); return; }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const qr = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    setIsProcessing(false);
    if (qr) resolveToken(qr.data); else pushLog({ status: "invalid_qr" });
  };

  /* ── Image upload ───────────────────────────────────────────── */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx    = canvas.getContext("2d");
        if (!ctx) { setIsProcessing(false); return; }
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const qr = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        setIsProcessing(false);
        if (qr) resolveToken(qr.data); else pushLog({ status: "invalid_qr" });
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="pt-safe flex-shrink-0 flex flex-col items-center px-5 pt-4 pb-2">
        <p className="text-xs uppercase tracking-[0.25em] text-white/30 mb-0.5 font-medium">
          Security Portal
        </p>
        <h1 className="serif italic text-3xl text-amber-100/90 leading-none">
          Sentinel
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"
          />
          <span className="text-xs text-white/40 uppercase tracking-widest font-medium">
            Live — Ready to Scan
          </span>
        </div>
      </header>

      {/* ── Scanner viewport ────────────────────────────────────── */}
      <div className="flex-shrink-0 flex justify-center px-4 pb-3">
        <div
          ref={scannerRef}
          className={cn(
            "relative overflow-hidden rounded-[2rem] border-2 transition-all duration-300",
            lastFlash ? FLASH_BORDER[lastFlash] : "border-white/10"
          )}
          style={{
            width:  "min(84vw, 360px)",
            height: "min(84vw, 360px)",
            boxShadow: lastFlash ? undefined : "0 0 60px rgba(246,190,90,0.06), 0 20px 60px rgba(0,0,0,0.5)",
          }}
        >
          {/* Processing overlay */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                key="proc"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
              >
                <div className="w-10 h-10 border-2 border-amber-200/20 border-t-amber-300 rounded-full animate-spin" />
                <p className="text-xs uppercase tracking-widest text-white/50">Analyzing…</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Camera */}
          {!isProcessing && (
            <Scanner
              onScan={(r) => handleLiveScan(r[0].rawValue)}
              formats={["qr_code"]}
              styles={{ container: { width: "100%", height: "100%" } }}
            />
          )}

          {/* Corner markers + scan line overlay */}
          <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
            <motion.div
              className="absolute inset-0"
              animate={{ boxShadow: ["inset 0 0 30px rgba(246,190,90,0.04)", "inset 0 0 70px rgba(246,190,90,0.13)", "inset 0 0 30px rgba(246,190,90,0.04)"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute inset-0 scanner-gradient opacity-25" />
            {!isProcessing && (
              <div className="relative w-[58%] h-[58%]">
                {[
                  "top-0 left-0 border-t-[5px] border-l-[5px] rounded-tl-xl",
                  "top-0 right-0 border-t-[5px] border-r-[5px] rounded-tr-xl",
                  "bottom-0 left-0 border-b-[5px] border-l-[5px] rounded-bl-xl",
                  "bottom-0 right-0 border-b-[5px] border-r-[5px] rounded-br-xl",
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 border-amber-300/80 ${cls}`} />
                ))}
                <motion.div
                  animate={{ top: ["8%", "92%"], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-[2px] bg-amber-200 shadow-[0_0_14px_rgba(246,190,90,1)]"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Scan Log (1/3 of screen) ─────────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-col px-4"
        style={{ height: "28vh" }}
      >
        {/* Log header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">
              Scan Log
            </span>
            {scanLog.length > 0 && (
              <span className="text-xs text-white/25 font-mono">({scanLog.length})</span>
            )}
          </div>
          {scanLog.length > 0 && (
            <button
              onClick={() => setScanLog([])}
              className="flex items-center gap-1.5 text-xs text-white/25 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Log list */}
        <div className="flex-1 scroll-smooth-y space-y-2 overflow-y-auto">
          <AnimatePresence initial={false}>
            {scanLog.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-center py-4"
              >
                <motion.div
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  <CheckCircle2 className="w-7 h-7 text-white/15 mb-2 mx-auto" />
                </motion.div>
                <p className="text-sm text-white/25 font-medium">No scans yet</p>
                <p className="text-xs text-white/15 mt-1">Point the camera at a QR code</p>
              </motion.div>
            ) : (
              scanLog.map((entry) => (
                <div key={entry.id}>
                  <LogRow entry={entry} />
                </div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Action Buttons (below log) ──────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-3 grid grid-cols-2 gap-3">
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

        {[
          { icon: Upload, label: "Upload QR", action: () => fileInputRef.current?.click() },
          { icon: Camera, label: "Capture",   action: handleCaptureFrame                   },
        ].map(({ icon: Icon, label, action }) => (
          <button
            key={label}
            onClick={action}
            className="glass glass-hover active:scale-95 transition-all rounded-2xl py-4 flex items-center justify-center gap-2.5 group"
          >
            <Icon className="w-5 h-5 text-amber-300/60 group-hover:text-amber-300 transition-colors" />
            <span className="text-sm font-semibold uppercase tracking-wider text-white/55 group-hover:text-white/80 transition-colors">
              {label}
            </span>
          </button>
        ))}
      </div>

    </div>
  );
}

/* ─── Single log row ────────────────────────────────────────────── */
function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const cfg  = STATUS_CONFIG[entry.status];
  const Icon = cfg.icon;
  const emp  = entry.employee;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      layout
    >
      {/* Row */}
      <button
        onClick={() => emp && setExpanded((v) => !v)}
        className={cn(
          "w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 border border-white/07 transition-colors text-left",
          emp ? "hover:border-white/14 active:scale-[0.99] cursor-pointer" : "cursor-default"
        )}
      >
        <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", cfg.dotColor)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-white/90 truncate">
              {emp ? emp.name : cfg.label}
            </p>
            {emp && (
              <span className={cn("flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide", cfg.badgeCls)}>
                {cfg.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {emp && (
              <>
                <span className="text-xs text-white/35 font-mono">{emp.employeeCode}</span>
                <span className="text-white/20 text-[9px]">•</span>
                <span className="text-xs text-white/35">{emp.department}</span>
                <span className="text-white/20 text-[9px]">•</span>
              </>
            )}
            <span className="text-xs text-white/30">{format(entry.timestamp, "h:mm:ss a")}</span>
          </div>
        </div>

        <Icon className={cn("w-4 h-4 flex-shrink-0", cfg.textColor)} />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && emp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-b-2xl -mt-2 pt-5 pb-4 px-4 border border-t-0 border-white/07 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-white/25 uppercase tracking-wider mb-1">Department</p>
                <p className="text-sm text-white/75 font-medium">{emp.department}</p>
              </div>
              <div>
                <p className="text-xs text-white/25 uppercase tracking-wider mb-1">Valid Until</p>
                <p className={cn("text-sm font-semibold", entry.status === "expired" ? "text-rose-400" : "text-emerald-400")}>
                  {format(parseISO(emp.expiryDate), "MMM d, yyyy")}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-white/25 uppercase tracking-wider mb-1">Scanned At</p>
                <p className="text-xs text-white/45 font-mono">{format(entry.timestamp, "MMMM d, yyyy — h:mm:ss a")}</p>
              </div>
              {entry.scannedToken && (
                <div className="col-span-2">
                  <p className="text-xs text-white/25 uppercase tracking-wider mb-1">Token</p>
                  <p className="text-xs text-white/45 font-mono break-all">{entry.scannedToken}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
