import { useState, type FormEvent, type ReactNode } from "react";
import { useEmployees, Employee } from "../hooks/useEmployees";
import { useAuth } from "../hooks/useAuth";
import { QRCodeCanvas } from "qrcode.react";
import { format, parseISO, isBefore, startOfDay, addYears } from "date-fns";
import { cn } from "../lib/utils";
import {
  Users, Plus, Trash2, QrCode, X,
  LogIn, LogOut, Edit2, Shield, Wifi, Eye, EyeOff, Lock, Mail
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/* ─── DatabaseTab ───────────────────────────────────────────────── */
export function DatabaseTab() {
  const { employees, addEmployee, removeEmployee, updateEmployee, accessDenied, errorMessage } = useEmployees();
  const { user, loginWithEmail, logout, loading, authLoading, error: authError } = useAuth();
  const [showQRFor,   setShowQRFor]   = useState<string | null>(null);
  const [showFormFor, setShowFormFor] = useState<Employee | "new" | null>(null);

  /* Loading state */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-amber-200/20 border-t-amber-300 rounded-full animate-spin" />
      </div>
    );
  }

  /* Login wall */
  if (!user) {
    return (
      <LoginForm
        onEmailLogin={loginWithEmail}
        loading={authLoading}
        error={authError}
      />
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 text-center">
        <div className="w-full max-w-md glass rounded-3xl border border-amber-500/20 p-6">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-amber-500/30 bg-amber-500/10">
            <Shield className="w-7 h-7 text-amber-300" />
          </div>

          <h2 className="serif italic text-2xl text-amber-100/95 mb-2">Admin Approval Required</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            {errorMessage ?? "Your account can sign in, but it does not have permission to access admin employee records yet."}
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-left space-y-1.5">
            <p className="text-xs uppercase tracking-widest text-white/35">Account Email</p>
            <p className="text-xs text-white/80 break-all font-mono">{user.email ?? "(no email)"}</p>
            <p className="text-xs uppercase tracking-widest text-white/35 pt-2">Account UID</p>
            <p className="text-xs text-white/80 break-all font-mono">{user.id}</p>
          </div>

          <p className="text-xs text-white/40 mt-4 leading-relaxed">
            This account can sign in, but your Supabase row-level security policy is blocking admin employee queries.
          </p>

          <button
            onClick={logout}
            className="mt-5 btn-primary flex w-full items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 opacity-70" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  /* Main admin view */
  return (
    <div className="flex flex-col h-full text-white overflow-hidden">

      {/* Header */}
      <header className="pt-safe flex-shrink-0 px-5 pt-5 pb-4 border-b border-brand-border">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="serif italic text-fluid-xl text-amber-100/90 leading-none">Admin Panel</h1>
            <p className="text-fluid-xs text-white/30 uppercase tracking-widest mt-1 font-mono">
              {user.email}
            </p>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFormFor("new")}
              className="flex items-center gap-1.5 glass glass-hover active:scale-95 transition-all rounded-xl px-3 py-2 text-white/70 hover:text-amber-300"
            >
              <Plus className="w-4 h-4" />
              <span className="text-fluid-xs font-semibold uppercase tracking-wider">Add</span>
            </button>
            <button
              onClick={logout}
              title="Logout"
              className="btn-icon hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 glass rounded-full px-3 py-1 border border-emerald-500/20">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-fluid-xs text-emerald-400 font-medium">Cloud Active</span>
          </span>
          <span className="text-fluid-xs text-white/25">
            {employees.length} {employees.length === 1 ? "record" : "records"}
          </span>
        </div>
      </header>

      {/* Scrollable employee list */}
      <div className="flex-1 scroll-smooth-y px-5 py-4 space-y-3">

        {employees.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 border border-white/06 rounded-3xl border-dashed text-white/25 gap-3"
          >
            <Users className="w-9 h-9 opacity-40" />
            <p className="text-fluid-sm">No records yet</p>
            <button
              onClick={() => setShowFormFor("new")}
              className="text-fluid-xs text-amber-300/60 hover:text-amber-300 transition-colors uppercase tracking-wider"
            >
              + Add first record
            </button>
          </motion.div>
        ) : (
          <AnimatePresence>
            {employees.map((emp, i) => (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.04 }}
              >
                <EmployeeCard
                  employee={emp}
                  onEdit={() => setShowFormFor(emp)}
                  onDelete={() => removeEmployee(emp.id)}
                  onShowQR={() => setShowQRFor(emp.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showQRFor && (
          <QRModal
            employee={employees.find((e) => e.id === showQRFor)!}
            onClose={() => setShowQRFor(null)}
          />
        )}
        {showFormFor && (
          <EmployeeFormModal
            employee={showFormFor === "new" ? null : showFormFor}
            onClose={() => setShowFormFor(null)}
            onSave={async (emp) => {
              if (showFormFor === "new") await addEmployee(emp);
              else await updateEmployee(emp);
              setShowFormFor(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Employee Card ─────────────────────────────────────────────── */
function EmployeeCard({
  employee, onEdit, onDelete, onShowQR
}: {
  employee: Employee; onEdit: () => void; onDelete: () => void; onShowQR: () => void; key?: string
}) {
  const isExpired = isBefore(startOfDay(parseISO(employee.expiryDate)), startOfDay(new Date()));

  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-white/06 hover:border-white/10 transition-colors">

      {/* Status dot */}
      <div className="flex-shrink-0">
        <div className={cn(
          "w-2.5 h-2.5 rounded-full",
          isExpired
            ? "bg-rose-500 shadow-[0_0_8px_rgba(248,113,113,0.8)]"
            : "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
        )} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-fluid-sm font-semibold text-white/90 truncate">{employee.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={cn(
            "text-fluid-xs font-bold uppercase tracking-wide",
            isExpired ? "text-rose-400" : "text-emerald-400"
          )}>
            {isExpired ? "Expired" : "Valid"}
          </span>
          <span className="text-white/20 text-[10px]">•</span>
          <span className="text-fluid-xs text-white/35 font-mono">{employee.employeeCode}</span>
          <span className="text-white/20 text-[10px]">•</span>
          <span className="text-fluid-xs text-white/30">{employee.department}</span>
        </div>
        <p className="text-fluid-xs text-white/20 mt-1">
          Expires {format(parseISO(employee.expiryDate), "MMM d, yyyy")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onShowQR}
          className="btn-icon hover:text-amber-300 hover:bg-amber-200/10 hover:border-amber-200/20"
          title="Show QR"
        >
          <QrCode className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onEdit}
          className="btn-icon"
          title="Edit"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="btn-icon hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Employee Form Modal ───────────────────────────────────────── */
function EmployeeFormModal({
  employee, onClose, onSave
}: {
  employee: Employee | null; onClose: () => void; onSave: (e: Employee) => void;
}) {
  const [employeeCode, setEmployeeCode] = useState(
    employee?.employeeCode || `EMP-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`
  );
  const [name,       setName]       = useState(employee?.name || "");
  const [department, setDepartment] = useState(employee?.department || "");
  const [expiryDate, setExpiryDate] = useState(
    employee?.expiryDate || format(addYears(new Date(), 1), "yyyy-MM-dd")
  );

  const handleSave = () => {
    if (!name || !department || !expiryDate || !employeeCode) return;
    onSave({ id: employee?.id || crypto.randomUUID(), employeeCode, name, department, expiryDate, isActive: true });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div
        key="form-modal"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        className="glass rounded-[2rem] p-6 w-full max-w-sm border border-white/10 relative mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-5 right-5 btn-icon">
          <X className="w-4 h-4" />
        </button>

        <h3 className="serif italic text-fluid-xl text-white mb-5">
          {employee ? "Edit Record" : "New Record"}
        </h3>

        <div className="space-y-3 mb-5">
          {[
            { label: "Employee ID", value: employeeCode, set: setEmployeeCode, placeholder: "EMP-1234", upper: true },
            { label: "Full Name",   value: name,         set: setName,         placeholder: "John Doe"             },
            { label: "Department",  value: department,   set: setDepartment,   placeholder: "Engineering"          },
          ].map(({ label, value, set, placeholder, upper }) => (
            <div key={label}>
              <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
                {label}
              </label>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className={cn("input-base", upper && "uppercase")}
              />
            </div>
          ))}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Expiry Date
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="input-base"
              style={{ colorScheme: "dark" }}
            />
          </div>
        </div>

        <button onClick={handleSave} className="btn-primary">
          {employee ? "Save Changes" : "Create Record"}
        </button>
      </motion.div>
    </ModalBackdrop>
  );
}

/* ─── QR Modal ──────────────────────────────────────────────────── */
function QRModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const handleDownload = () => {
    const canvas = document.getElementById("qr-code-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${employee.employeeCode}_QRCode.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isExpired = isBefore(startOfDay(parseISO(employee.expiryDate)), startOfDay(new Date()));

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div
        key="qr-modal"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        className="glass rounded-[2rem] p-6 w-full max-w-xs border border-white/10 relative flex flex-col items-center mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-5 right-5 btn-icon">
          <X className="w-4 h-4" />
        </button>

        {/* Employee info */}
        <div className="text-center mb-5 mt-2">
          <h3 className="serif italic text-fluid-xl text-white">{employee.name}</h3>
          <p className="text-fluid-xs uppercase tracking-widest text-white/35 mt-1 font-mono">
            {employee.employeeCode}
          </p>
          <span className={cn(
            "inline-block mt-2 px-3 py-0.5 rounded-full text-fluid-xs font-bold uppercase tracking-wide",
            isExpired ? "status-expired" : "status-valid"
          )}>
            {isExpired ? "Expired" : "Valid"}
          </span>
        </div>

        {/* QR code */}
        <div
          className="bg-white p-4 rounded-2xl shadow-2xl mb-5"
          style={{ boxShadow: "0 0 40px rgba(246,190,90,0.15)" }}
        >
          <QRCodeCanvas
            id="qr-code-canvas"
            value={employee.id}
            size={Math.min(180, window.innerWidth * 0.45)}
            level="M"
          />
        </div>

        {/* Expiry */}
        <p className="text-fluid-xs text-white/30 mb-5">
          Expires {format(parseISO(employee.expiryDate), "MMMM d, yyyy")}
        </p>

        <button onClick={handleDownload} className="btn-primary flex items-center justify-center gap-2">
          <QrCode className="w-4 h-4 opacity-70" />
          Download QR Code
        </button>
      </motion.div>
    </ModalBackdrop>
  );
}

/* ─── Shared modal backdrop ─────────────────────────────────────── */
function ModalBackdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      {children}
    </motion.div>
  );
}

/* ─── Login Form ────────────────────────────────────────────────── */
function LoginForm({
  onEmailLogin,
  loading,
  error,
}: {
  onEmailLogin: (email: string, password: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    onEmailLogin(email.trim(), password);
  };

  return (
    <div className="flex flex-col h-full items-center justify-center px-6 scroll-smooth-y">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xs py-6"
      >
        {/* Icon + title */}
        <div className="flex flex-col items-center mb-7">
          <div
            className="rounded-3xl glass flex items-center justify-center mb-5 border border-white/10"
            style={{ width: "4.5rem", height: "4.5rem", boxShadow: "0 0 40px rgba(246,190,90,0.10)" }}
          >
            <Shield className="w-8 h-8 text-amber-300/80" />
          </div>
          <h1 className="serif italic text-3xl text-amber-100/90 mb-1">Admin Access</h1>
          <p className="text-xs text-white/35 uppercase tracking-widest">Sentinel Security Portal</p>
        </div>

        {/* ── Email / Password form ───────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className="input-base pl-11 text-sm"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="input-base pl-11 pr-11 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3"
              >
                <p className="text-rose-400 text-xs leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 opacity-70" />
                Sign In with Email
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-white/18 mt-6 leading-relaxed px-4">
          Admin credentials only. Contact your system administrator for access.
        </p>
      </motion.div>
    </div>
  );
}
