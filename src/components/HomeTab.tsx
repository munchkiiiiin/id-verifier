import { QrCode, Cpu, Award, Lock, ShieldCheck, Sun, Moon } from "lucide-react";
import { motion } from "motion/react";

interface HomeTabProps {
  onStartScan: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

export function HomeTab({ onStartScan, theme, onToggleTheme }: HomeTabProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex justify-between items-center px-6 h-16 w-full bg-black/20 border-b border-brand-border flex-shrink-0">
        <div className="flex items-center gap-2 text-white font-bold">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <span className="font-headline-md tracking-wide">Sentinel</span>
        </div>
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
      </header>

      {/* ── Scrollable Content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-5xl mx-auto w-full flex flex-col gap-6 md:gap-8 pb-32">
        <section className="flex-shrink-0 flex flex-col items-center text-center pt-16 pb-10 md:pt-24 md:pb-16 relative overflow-hidden rounded-3xl glass border border-white/07 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-40 z-0" />
          
          <div className="relative z-10 max-w-xl px-4 flex flex-col items-center gap-4 pt-4">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 font-semibold text-xs mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>System Online & Secure</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold font-headline-md text-white tracking-wide leading-tight">
              Welcome to Sentinel
            </h1>
            
            <p className="text-sm md:text-base text-white/60 max-w-lg leading-relaxed">
              Your trusted partner for fast, secure identity verification. Experience seamless processing with enterprise-grade security.
            </p>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onStartScan}
              className="mt-4 bg-[#fd761a] hover:bg-[#e06210] text-white transition-colors duration-200 px-8 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider shadow-lg flex items-center gap-2.5 border-b border-white/20 cursor-pointer"
            >
              <QrCode className="w-5 h-5" />
              <span>Start Verification</span>
            </motion.button>
          </div>
        </section>

        {/* ── Bento Grid: How it works ─────────────────────────────── */}
        <section className="flex-shrink-0 flex flex-col gap-3">
          <h2 className="text-lg font-bold text-white/90 font-headline-md tracking-wide px-1">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="glass rounded-2xl p-6 border border-white/07 flex flex-col gap-4 relative overflow-hidden group hover:border-white/15 transition-colors duration-300">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/25">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white/95 text-base">1. Scan</h3>
                <p className="text-xs text-white/45 mt-1.5 leading-relaxed">
                  Align the employee ID QR code within the scanner frame. Ensure good lighting and clear visibility.
                </p>
              </div>
              <QrCode className="absolute -right-6 -bottom-6 w-32 h-32 text-indigo-500/[0.03] group-hover:text-indigo-500/[0.05] transition-colors" />
            </div>

            {/* Step 2 */}
            <div className="glass rounded-2xl p-6 border border-white/07 flex flex-col gap-4 relative overflow-hidden group hover:border-white/15 transition-colors duration-300">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-[#fd761a] flex items-center justify-center border border-amber-500/25">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white/95 text-base">2. Verify</h3>
                <p className="text-xs text-white/45 mt-1.5 leading-relaxed">
                  Our secure gateway processes the token and checks verification status against the access database instantly.
                </p>
              </div>
              <Cpu className="absolute -right-6 -bottom-6 w-32 h-32 text-amber-500/[0.03] group-hover:text-amber-500/[0.05] transition-colors" />
            </div>

            {/* Step 3 */}
            <div className="glass rounded-2xl p-6 border border-white/07 flex flex-col gap-4 relative overflow-hidden group hover:border-white/15 transition-colors duration-300">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/25">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white/95 text-base">3. Result</h3>
                <p className="text-xs text-white/45 mt-1.5 leading-relaxed">
                  Get immediate visual feedback (Verified, Expired, Not Found) logged securely with cryptographic proof.
                </p>
              </div>
              <Award className="absolute -right-6 -bottom-6 w-32 h-32 text-emerald-500/[0.03] group-hover:text-emerald-500/[0.05] transition-colors" />
            </div>
          </div>
        </section>

        {/* ── Info Banner: Encryption ──────────────────────────────── */}
        <section className="flex-shrink-0 bg-indigo-950/20 border border-indigo-500/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-2xl text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white/90 text-sm">End-to-End Encryption</h4>
              <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                Your logs are stored strictly on-device. We prioritize data privacy above all else.
              </p>
            </div>
          </div>
          <button 
            onClick={onStartScan}
            className="bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Verify ID
          </button>
        </section>
      </div>
    </div>
  );
}
