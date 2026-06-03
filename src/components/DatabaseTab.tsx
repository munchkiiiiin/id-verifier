import { useState, useMemo, type FormEvent, type ReactNode } from "react";
import { useEmployees, Employee } from "../hooks/useEmployees";
import { useAuth } from "../hooks/useAuth";
import { QRCodeCanvas } from "qrcode.react";
import { format, parseISO, isBefore, startOfDay, addYears } from "date-fns";
import { cn } from "../lib/utils";
import { buildEmployeeQrValue } from "../lib/qr";
import {
  Users, Plus, Trash2, QrCode, X,
  LogIn, LogOut, Edit2, Shield, Wifi, Eye, EyeOff, Lock, Mail, Sun, Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const EMPLOYEE_CODE_START = 520601;

function normalizeEmployeeCode(value: string): string {
  return value.replace(/\D/g, "");
}

function getNextEmployeeCode(employees: Employee[]): string {
  const usedCodes = new Set(
    employees
      .map((employee) => Number.parseInt(employee.employeeCode, 10))
      .filter((code) => Number.isFinite(code))
  );

  let candidate = EMPLOYEE_CODE_START;

  while (usedCodes.has(candidate)) {
    candidate += 1;
  }

  return String(candidate);
}

function isEmployeeCodeInUse(employees: Employee[], employeeCode: string, currentId?: string): boolean {
  return employees.some(
    (employee) => employee.employeeCode === employeeCode && employee.id !== currentId
  );
}

/* ─── DatabaseTab ───────────────────────────────────────────────── */
export function DatabaseTab({
  theme,
  onToggleTheme
}: {
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}) {
  const { employees, addEmployee, removeEmployee, updateEmployee, accessDenied, errorMessage } = useEmployees();
  const { user, loginWithEmail, logout, loading, authLoading, error: authError } = useAuth();
  const [showQRFor,   setShowQRFor]   = useState<string | null>(null);
  const [showFormFor, setShowFormFor] = useState<Employee | "new" | null>(null);
  const [showDetailsFor, setShowDetailsFor] = useState<Employee | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  type SortOption = "name" | "employeeCode" | "designation" | "expiryDate";
  type StatusFilterOption = "all" | "valid" | "expired";

  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterStatus, setFilterStatus] = useState<StatusFilterOption>("all");
  const [filterDesignation, setFilterDesignation] = useState<string>("all");

  const uniqueDesignations = Array.from(
    new Set(employees.map((e) => e.designation).filter(Boolean))
  ).sort();

  const filteredEmployees = employees
    .filter((emp) => {
      if (filterDesignation !== "all" && emp.designation !== filterDesignation) {
        return false;
      }
      if (filterStatus !== "all") {
        const isExpired = isBefore(startOfDay(parseISO(emp.expiryDate)), startOfDay(new Date()));
        if (filterStatus === "valid" && isExpired) return false;
        if (filterStatus === "expired" && !isExpired) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "employeeCode") {
        const numA = parseInt(a.employeeCode, 10) || 0;
        const numB = parseInt(b.employeeCode, 10) || 0;
        return numA - numB;
      }
      if (sortBy === "designation") {
        return a.designation.localeCompare(b.designation);
      }
      if (sortBy === "expiryDate") {
        return a.expiryDate.localeCompare(b.expiryDate);
      }
      return 0;
    });

  const openNewForm = () => {
    setFormError(null);
    setShowFormFor("new");
  };

  const openEditForm = (employee: Employee) => {
    setFormError(null);
    setShowFormFor(employee);
  };

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
              onClick={onToggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="btn-icon hover:text-white cursor-pointer"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={openNewForm}
              className="flex items-center gap-1.5 glass glass-hover active:scale-95 transition-all rounded-xl px-3 py-2 text-white/70 hover:text-amber-300 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="text-fluid-xs font-semibold uppercase tracking-wider">Add</span>
            </button>
            <button
              onClick={logout}
              title="Logout"
              className="btn-icon hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status indicator & sorting/filtering */}
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 glass rounded-full px-3 py-1 border border-emerald-500/20">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="text-fluid-xs text-emerald-400 font-medium">Cloud Active</span>
            </span>
            <span className="text-fluid-xs text-white/25">
              {filteredEmployees.length === employees.length ? (
                `${employees.length} ${employees.length === 1 ? "record" : "records"}`
              ) : (
                `${filteredEmployees.length} of ${employees.length} records (filtered)`
              )}
            </span>
          </div>

          {/* Controls toolbar */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* Sort */}
            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-1 font-bold font-mono">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="input-base py-1.5 px-2 bg-black/40 border-white/06 text-fluid-xs rounded-xl focus:border-amber-500/40"
                style={{ colorScheme: "dark" }}
              >
                <option value="name">Name (A-Z)</option>
                <option value="employeeCode">Employee ID</option>
                <option value="designation">Designation</option>
                <option value="expiryDate">Expiry Date</option>
              </select>
            </div>

            {/* Filter Status */}
            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-1 font-bold font-mono">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatusFilterOption)}
                className="input-base py-1.5 px-2 bg-black/40 border-white/06 text-fluid-xs rounded-xl focus:border-amber-500/40"
                style={{ colorScheme: "dark" }}
              >
                <option value="all">All</option>
                <option value="valid">Valid Only</option>
                <option value="expired">Expired Only</option>
              </select>
            </div>

            {/* Filter Designation */}
            <div className="flex flex-col">
              <label className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-1 font-bold font-mono">Designation</label>
              <select
                value={filterDesignation}
                onChange={(e) => setFilterDesignation(e.target.value)}
                className="input-base py-1.5 px-2 bg-black/40 border-white/06 text-fluid-xs rounded-xl focus:border-amber-500/40"
                style={{ colorScheme: "dark" }}
              >
                <option value="all">All</option>
                {uniqueDesignations.map((des) => (
                  <option key={des} value={des}>{des}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable employee list */}
      <div className="flex-1 scroll-smooth-y px-5 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-max content-start">

        {employees.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 border border-white/06 rounded-3xl border-dashed text-white/25 gap-3 col-span-full"
          >
            <Users className="w-9 h-9 opacity-40" />
            <p className="text-fluid-sm">No records yet</p>
            <button
              onClick={openNewForm}
              className="text-fluid-xs text-amber-300/60 hover:text-amber-300 transition-colors uppercase tracking-wider"
            >
              + Add first record
            </button>
          </motion.div>
        ) : filteredEmployees.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 border border-white/06 rounded-3xl border-dashed text-white/25 gap-3 col-span-full text-center"
          >
            <Users className="w-9 h-9 opacity-40" />
            <p className="text-fluid-sm">No matching records found</p>
            <button
              onClick={() => {
                setFilterStatus("all");
                setFilterDesignation("all");
              }}
              className="text-fluid-xs text-amber-300/60 hover:text-amber-300 transition-colors uppercase tracking-wider"
            >
              Clear Filters
            </button>
          </motion.div>
        ) : (
          <AnimatePresence>
            {filteredEmployees.map((emp, i) => (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.04 }}
              >
                <EmployeeCard
                  employee={emp}
                  onEdit={() => openEditForm(emp)}
                  onDelete={() => removeEmployee(emp.id)}
                  onShowQR={() => setShowQRFor(emp.id)}
                  onShowDetails={() => setShowDetailsFor(emp)}
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
            employees={employees}
            employee={showFormFor === "new" ? null : showFormFor}
            onClose={() => setShowFormFor(null)}
            errorMessage={formError}
            onSave={async (emp) => {
              try {
                if (showFormFor === "new") await addEmployee(emp);
                else await updateEmployee(emp);
                setFormError(null);
                setShowFormFor(null);
              } catch (error) {
                setFormError(error instanceof Error ? error.message : "Failed to save employee record.");
              }
            }}
          />
        )}
        {showDetailsFor && (
          <EmployeeDetailModal
            employee={showDetailsFor}
            onClose={() => setShowDetailsFor(null)}
            onEdit={() => openEditForm(showDetailsFor)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Employee Card ─────────────────────────────────────────────── */
function EmployeeCard({
  employee, onEdit, onDelete, onShowQR, onShowDetails
}: {
  employee: Employee;
  onEdit: () => void;
  onDelete: () => void;
  onShowQR: () => void;
  onShowDetails: () => void;
  key?: string;
}) {
  const isExpired = isBefore(startOfDay(parseISO(employee.expiryDate)), startOfDay(new Date()));

  return (
    <div
      onClick={onShowDetails}
      className="glass rounded-2xl p-4 flex items-center gap-3 border border-white/06 hover:border-white/10 hover:bg-white/05 active:scale-[0.99] cursor-pointer transition-all text-left"
    >
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
          <span className="text-fluid-xs text-white/30">{employee.designation}</span>
        </div>
        <p className="text-fluid-xs text-white/20 mt-1">
          Expires {format(parseISO(employee.expiryDate), "MMM d, yyyy")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowQR();
          }}
          className="btn-icon hover:text-amber-300 hover:bg-amber-200/10 hover:border-amber-200/20 cursor-pointer"
          title="Show QR"
        >
          <QrCode className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="btn-icon cursor-pointer"
          title="Edit"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="btn-icon hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 cursor-pointer"
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
  employee, employees, onClose, onSave, errorMessage
}: {
  employee: Employee | null; onClose: () => void; onSave: (e: Employee) => void;
  employees: Employee[]; errorMessage: string | null;
}) {
  const [employeeCode, setEmployeeCode] = useState(
    employee?.employeeCode || getNextEmployeeCode(employees)
  );
  const [name,       setName]       = useState(employee?.name || "");
  const [designation, setDesignation] = useState(employee?.designation || "");
  const [expiryDate, setExpiryDate] = useState(
    employee?.expiryDate || format(addYears(new Date(), 1), "yyyy-MM-dd")
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const uniqueDesignations = useMemo(() => {
    return Array.from(
      new Set(employees.map((e) => e.designation).filter(Boolean))
    ).sort();
  }, [employees]);

  const [isCustomDesignation, setIsCustomDesignation] = useState(
    () => !employee || !uniqueDesignations.includes(employee.designation)
  );

  const currentError = errorMessage ?? localError;

  const handleSave = () => {
    const normalizedEmployeeCode = normalizeEmployeeCode(employeeCode);

    if (!normalizedEmployeeCode) {
      setLocalError("Employee ID is required.");
      return;
    }

    if (!/^\d+$/.test(normalizedEmployeeCode)) {
      setLocalError("Employee ID must contain numbers only.");
      return;
    }

    if (isEmployeeCodeInUse(employees, normalizedEmployeeCode, employee?.id)) {
      setLocalError("That employee ID is already in use. Please use the suggested available ID.");
      return;
    }

    if (!name || !designation || !expiryDate) {
      setLocalError("Please complete all required fields.");
      return;
    }

    setLocalError(null);
    onSave({ id: employee?.id || crypto.randomUUID(), employeeCode: normalizedEmployeeCode, name, designation, expiryDate, isActive: true });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        key="form-modal"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        className="glass rounded-[2rem] p-6 w-full max-w-sm border border-white/10 relative mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute top-5 right-5 btn-icon">
          <X className="w-4 h-4" />
        </button>

        <h3 className="serif italic text-fluid-xl text-white mb-5">
          {employee ? "Edit Record" : "New Record"}
        </h3>

        <div className="space-y-3 mb-5">
          {/* Employee ID */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Employee ID
            </label>
            <input
              value={employeeCode}
              onChange={(e) => {
                setEmployeeCode(normalizeEmployeeCode(e.target.value));
                setLocalError(null);
              }}
              placeholder="5206XX"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input-base tabular-nums"
              required
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Full Name
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setLocalError(null);
              }}
              placeholder="John Doe"
              className="input-base"
              required
            />
          </div>

          {/* Designation */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-fluid-xs text-white/35 uppercase tracking-widest">
                Designation
              </label>
              {isCustomDesignation && uniqueDesignations.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDesignation(false);
                    if (uniqueDesignations.length > 0) {
                      setDesignation(uniqueDesignations[0]);
                    }
                  }}
                  className="text-[10px] text-amber-300/80 hover:text-amber-300 uppercase tracking-wider cursor-pointer"
                >
                  Choose Existing
                </button>
              )}
            </div>

            {isCustomDesignation ? (
              <input
                value={designation}
                onChange={(e) => {
                  setDesignation(e.target.value);
                  setLocalError(null);
                }}
                placeholder="Sales Associate"
                className="input-base"
                required
              />
            ) : (
              <select
                value={designation}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setIsCustomDesignation(true);
                    setDesignation("");
                  } else {
                    setDesignation(e.target.value);
                  }
                  setLocalError(null);
                }}
                className="input-base py-3"
                style={{ colorScheme: "dark" }}
              >
                <option value="" disabled>Select Designation...</option>
                {uniqueDesignations.map((des) => (
                  <option key={des} value={des}>
                    {des}
                  </option>
                ))}
                <option value="__new__" className="text-amber-300 font-semibold">
                  + Add Custom Designation...
                </option>
              </select>
            )}
          </div>

          {/* Expiry Date */}
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
              required
            />
          </div>
        </div>

        {currentError && (
          <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
            <p className="text-rose-300 text-xs leading-relaxed">{currentError}</p>
          </div>
        )}

        <button type="submit" className="btn-primary w-full">
          {employee ? "Save Changes" : "Create Record"}
        </button>
      </motion.form>
    </ModalBackdrop>
  );
}

/* ─── Employee Detail Modal ─────────────────────────────────────── */
function EmployeeDetailModal({
  employee, onClose, onEdit
}: {
  employee: Employee; onClose: () => void; onEdit: () => void;
}) {
  const isExpired = isBefore(startOfDay(parseISO(employee.expiryDate)), startOfDay(new Date()));

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div
        key="detail-modal"
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
          Employee Details
        </h3>

        <div className="space-y-4 mb-6">
          <div className="border-b border-white/05 pb-3">
            <span className="text-[10px] uppercase tracking-widest text-white/30 block font-mono mb-1">Full Name</span>
            <span className="text-fluid-base font-semibold text-white/90">{employee.name}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-white/05 pb-3">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-white/30 block font-mono mb-1">Employee ID</span>
              <span className="text-fluid-sm font-semibold text-white/90 font-mono">{employee.employeeCode}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-white/30 block font-mono mb-1">Status</span>
              <span className={cn(
                "inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                isExpired ? "status-expired" : "status-valid"
              )}>
                {isExpired ? "Expired" : "Valid"}
              </span>
            </div>
          </div>

          <div className="border-b border-white/05 pb-3">
            <span className="text-[10px] uppercase tracking-widest text-white/30 block font-mono mb-1">Designation</span>
            <span className="text-fluid-sm font-semibold text-white/90">{employee.designation}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-widest text-white/30 block font-mono mb-1">Expiry Date</span>
            <span className={cn("text-fluid-sm font-semibold", isExpired ? "text-rose-400" : "text-emerald-400")}>
              {format(parseISO(employee.expiryDate), "MMMM d, yyyy")}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4 opacity-75" />
            Edit Record
          </button>
        </div>
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
            value={buildEmployeeQrValue(employee.id)}
            size={Math.min(180, window.innerWidth * 0.45)}
            level="M"
          />
        </div>

        <p className="text-center text-xs text-white/35 leading-relaxed mb-5">
          Scan with your phone camera to open the verification page in a browser.
        </p>

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
