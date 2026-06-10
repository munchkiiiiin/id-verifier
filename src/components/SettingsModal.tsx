import { Shield, Sun, Moon, X, Info, Download, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { Capacitor } from "@capacitor/core";

interface SettingsModalProps {
  onClose: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  deferredPrompt: any;
  onClearInstallPrompt: () => void;
}

export function SettingsModal({
  onClose,
  theme,
  onToggleTheme,
  deferredPrompt,
  onClearInstallPrompt
}: SettingsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        key="settings-modal"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        className="glass rounded-[2rem] p-6 w-full max-w-sm border border-white/10 relative mx-4 bg-brand-bg-dark/95 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 btn-icon cursor-pointer"
          title="Close Settings"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6 mt-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-300 flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="serif italic text-fluid-lg text-white font-semibold leading-tight">
              Settings
            </h3>
            <p className="text-[10px] text-white/35 uppercase tracking-widest mt-0.5 font-mono">
              Sentinel ID Verifier
            </p>
          </div>
        </div>

        {/* Settings Content */}
        <div className="space-y-5 mb-6">
          {/* Section 1: Appearance */}
          <div className="rounded-2xl border border-white/05 bg-black/15 p-4">
            <h4 className="text-fluid-xs font-bold uppercase tracking-wider text-white/70 mb-2.5">
              Appearance
            </h4>
            
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/30 border border-white/05 rounded-xl">
              <button
                onClick={() => { if (theme !== "light") onToggleTheme(); }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-fluid-xs font-semibold uppercase tracking-wider transition-all cursor-pointer",
                  theme === "light"
                    ? "bg-white/10 text-amber-300 border border-white/10 shadow-sm"
                    : "text-white/40 hover:text-white/75"
                )}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
              <button
                onClick={() => { if (theme !== "dark") onToggleTheme(); }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-fluid-xs font-semibold uppercase tracking-wider transition-all cursor-pointer",
                  theme === "dark"
                    ? "bg-white/10 text-amber-300 border border-white/10 shadow-sm"
                    : "text-white/40 hover:text-white/75"
                )}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
            </div>
          </div>

          {/* Section: Download & Install */}
          <div className="rounded-2xl border border-white/05 bg-black/15 p-4 space-y-3">
            <h4 className="text-fluid-xs font-bold uppercase tracking-wider text-white/70 mb-1 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 opacity-60" />
              Get the App
            </h4>
            
            <div className="flex flex-col gap-2">
              {deferredPrompt && (
                <button
                  onClick={async () => {
                    if (!deferredPrompt) return;
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                      onClearInstallPrompt();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-fluid-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/15 text-emerald-400 border border-emerald-500/20 shadow-sm transition-all cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Install Web App
                </button>
              )}
              
              <a
                href="https://github.com/munchkiiiiin/id-verifier/releases/latest/download/idverifier.apk"
                onClick={(e) => {
                  const url = "https://github.com/munchkiiiiin/id-verifier/releases/latest/download/idverifier.apk";
                  if (Capacitor.isNativePlatform()) {
                    e.preventDefault();
                    window.open(url, "_system");
                  } else {
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    if (isMobile) {
                      e.preventDefault();
                      window.location.href = url;
                    }
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-fluid-xs font-bold uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 shadow-sm transition-all cursor-pointer text-center"
              >
                <Download className="w-3.5 h-3.5" />
                Download Android APK
              </a>
            </div>
          </div>

          {/* Section 2: App Information */}
          <div className="rounded-2xl border border-white/05 bg-black/15 p-4 space-y-3.5">
            <div>
              <h4 className="text-fluid-xs font-bold uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 opacity-60" />
                System Information
              </h4>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Cloud-synchronized employee credential scanner with offline-first logging and cryptographically secure validation endpoints.
              </p>
            </div>

            <div className="border-t border-white/05 pt-3 flex justify-between items-center text-fluid-xs">
              <span className="text-white/40 font-mono uppercase tracking-wider">Version</span>
              <span className="font-mono text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                v{__APP_VERSION__}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-white/30">
              <span>Environment</span>
              <span>Production (Stable)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="btn-primary w-full py-2.5 flex items-center justify-center"
        >
          Done
        </button>
      </motion.div>
    </div>
  );
}
