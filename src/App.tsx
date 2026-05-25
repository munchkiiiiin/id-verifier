import { useState, type FC } from "react";
import { ScanLine, Database, ShieldCheck } from "lucide-react";
import { ScannerTab } from "./components/ScannerTab";
import { DatabaseTab } from "./components/DatabaseTab";
import { cn } from "./lib/utils";
import { motion } from "motion/react";

type Tab = "scanner" | "database";

const tabs: { id: Tab; icon: FC<{ className?: string }>; label: string }[] = [
  { id: "scanner",  icon: ScanLine,  label: "Scan"  },
  { id: "database", icon: Database,  label: "Admin" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("scanner");

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
        {tabs.map(({ id }) => (
          <div
            key={id}
            className={cn(
              "absolute inset-0 transition-opacity duration-300",
              activeTab === id ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
            )}
          >
            {activeTab === id && (
              id === "scanner" ? <ScannerTab /> : <DatabaseTab />
            )}
          </div>
        ))}
      </main>

      {/* ── Bottom nav bar ──────────────────────────────────────── */}
      <nav
        className="relative z-20 glass border-t border-brand-border flex justify-around items-center pb-safe"
        style={{ paddingTop: "0.65rem", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
      >
        {tabs.map(({ id, icon: Icon, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-8 py-1 rounded-2xl transition-colors",
                active ? "text-accent" : "text-white/35 hover:text-white/60"
              )}
              style={{ minWidth: "4.5rem" }}
            >
              {active && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: "rgba(246,190,90,0.08)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-0.5">
                <Icon className="w-5 h-5" />
                <span
                  className="font-semibold uppercase tracking-widest"
                  style={{ fontSize: "clamp(0.55rem, 1.6vw, 0.65rem)" }}
                >
                  {label}
                </span>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
