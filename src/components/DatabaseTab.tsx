import React, { useState, useMemo, useRef, useEffect, type FormEvent, type ReactNode } from "react";
import { useEmployees, Employee } from "../hooks/useEmployees";
import { useAuth } from "../hooks/useAuth";
import { supabase, createTempAuthClient } from "../lib/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { format, parseISO, isBefore, startOfDay, addYears } from "date-fns";
import { cn } from "../lib/utils";
import { buildEmployeeQrValue } from "../lib/qr";
import {
  Users, Plus, Trash2, QrCode, X,
  LogIn, LogOut, Edit2, Shield, Wifi, Eye, EyeOff, Lock, Mail, Sun, Moon, ChevronDown,
  CheckSquare, Check, AlertTriangle, Loader2, Settings
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

/* ─── Custom Select Component ───────────────────────────────────── */
interface CustomSelectOption {
  value: string;
  label: string | ReactNode;
  className?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}

function CustomSelect({
  value,
  onChange,
  options,
  className,
  triggerClassName,
  placeholder = "Select..."
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between input-base text-left cursor-pointer transition-all hover:bg-white/[0.03]",
          triggerClassName
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 ml-1.5 opacity-40 transition-transform duration-200 flex-shrink-0", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute z-50 w-full mt-1 bg-brand-bg-dark border border-brand-border rounded-2xl shadow-2xl py-1 max-h-60 overflow-y-auto backdrop-blur-[20px]"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3.5 py-2 text-fluid-xs transition-colors flex items-center justify-between cursor-pointer",
                  opt.value === value
                    ? "bg-amber-500/15 text-amber-300 font-semibold hover:bg-amber-500/20"
                    : "text-white/80 hover:text-white hover:bg-white/[0.06] dark:text-white/80 dark:hover:text-white dark:hover:bg-white/[0.06] light:text-slate-800 light:hover:text-slate-950 light:hover:bg-black/[0.05]",
                  opt.className
                )}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── DatabaseTab ───────────────────────────────────────────────── */
export function DatabaseTab({
  theme,
  onOpenSettings
}: {
  theme?: "dark" | "light";
  onOpenSettings: () => void;
}) {
  const { employees, addEmployee, removeEmployee, removeEmployees, updateEmployee, bulkUpdateEmployees, accessDenied, errorMessage } = useEmployees();
  const { user, loginWithEmail, logout, loading, authLoading, error: authError, isSuperAdmin } = useAuth();
  
  // Multi-Select & Custom Modal states
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [confirmDeleteConfig, setConfirmDeleteConfig] = useState<{
    type: "employee" | "admin" | "bulk_employees";
    targetId?: string;
    targetIds?: string[];
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  // Super Admin states
  const [subTab, setSubTab] = useState<"employees" | "admins">("employees");
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showEditAdminFor, setShowEditAdminFor] = useState<any | null>(null);

  const [showQRFor,   setShowQRFor]   = useState<string | null>(null);
  const [showFormFor, setShowFormFor] = useState<Employee | "new" | null>(null);
  const [showDetailsFor, setShowDetailsFor] = useState<Employee | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Load admins when subTab is admins
  useEffect(() => {
    if (user && isSuperAdmin && subTab === "admins") {
      void fetchAdminUsers();
    }
  }, [user, isSuperAdmin, subTab]);

  const fetchAdminUsers = async () => {
    setLoadingAdmins(true);
    setAdminError(null);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, display_name, is_admin, is_super_admin, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAdminUsers(data || []);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Failed to load admin accounts.");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleAddAdmin = async (email: string, displayName: string, password: string, role: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No active session found.");

      const response = await fetch("/api/create-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email, displayName, password, role })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create admin account.");
      }

      await fetchAdminUsers();
      setShowAddAdminModal(false);
    } catch (err) {
      console.error("Error creating admin account:", err);
      throw err;
    }
  };

  const handleUpdateAdmin = async (userId: string, email: string, displayName: string, password?: string, role?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No active session found.");

      const response = await fetch("/api/update-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, email, displayName, password, role })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update admin account.");
      }

      await fetchAdminUsers();
      setShowEditAdminFor(null);
    } catch (err) {
      console.error("Error updating admin account:", err);
      throw err;
    }
  };

  const handleDeleteAdmin = (adminId: string, email: string) => {
    const isSelf = adminId === user?.id;
    const confirmTitle = isSelf ? "Delete Your Own Account" : "Delete Admin Account";
    const confirmMsg = isSelf 
      ? "WARNING: You are deleting your own account! You will be signed out and lose access immediately. Are you sure you want to continue?" 
      : `Are you sure you want to revoke admin access and fully delete the account for ${email}?`;

    setConfirmDeleteConfig({
      type: "admin",
      targetId: adminId,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) throw new Error("No active session found.");

        const response = await fetch("/api/delete-admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ userId: adminId })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to delete admin account.");
        }

        if (isSelf) {
          await logout();
        } else {
          await fetchAdminUsers();
        }
      }
    });
  };

  const handleDeleteEmployee = (emp: Employee) => {
    setConfirmDeleteConfig({
      type: "employee",
      targetId: emp.id,
      title: "Delete Employee Record",
      message: `Are you sure you want to delete the record for ${emp.name}? This action cannot be undone.`,
      onConfirm: async () => {
        await removeEmployee(emp.id);
      }
    });
  };

  type SortOption = "name" | "employeeCode" | "designation" | "establishment" | "expiryDate";
  type StatusFilterOption = "all" | "valid" | "expired";

  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterStatus, setFilterStatus] = useState<StatusFilterOption>("all");
  const [filterDesignation, setFilterDesignation] = useState<string>("all");
  const [filterEstablishment, setFilterEstablishment] = useState<string>("all");

  const uniqueDesignations = Array.from(
    new Set(employees.map((e) => e.designation).filter(Boolean))
  ).sort();

  const defaultEstablishments = useMemo(() => ["Fashion Depot", "Thrifter's Haven", "Finders Runway"], []);
  const uniqueEstablishments = useMemo(() => {
    const list = Array.from(
      new Set(employees.map((e) => e.establishment).filter(Boolean))
    );
    defaultEstablishments.forEach((est) => {
      if (!list.includes(est)) list.push(est);
    });
    return list.sort();
  }, [employees, defaultEstablishments]);

  const filteredEmployees = employees
    .filter((emp) => {
      if (filterDesignation !== "all" && emp.designation !== filterDesignation) {
        return false;
      }
      if (filterEstablishment !== "all" && emp.establishment !== filterEstablishment) {
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
      if (sortBy === "establishment") {
        return a.establishment.localeCompare(b.establishment);
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
              onClick={onOpenSettings}
              title="Open Settings"
              className="btn-icon hover:text-white cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            {subTab === "employees" && employees.length > 0 && (
              <button
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  setSelectedEmployeeIds(new Set());
                }}
                className={cn(
                  "flex items-center gap-1.5 glass glass-hover active:scale-95 transition-all rounded-xl px-3 py-2 cursor-pointer",
                  isSelectMode
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    : "text-white/70 hover:text-amber-300"
                )}
              >
                <CheckSquare className="w-4 h-4" />
                <span className="text-fluid-xs font-semibold uppercase tracking-wider">
                  {isSelectMode ? "Cancel Select" : "Select"}
                </span>
              </button>
            )}
            <button
              onClick={subTab === "admins" ? () => setShowAddAdminModal(true) : openNewForm}
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

        {/* Tab switcher for Super Admin */}
        {isSuperAdmin && (
          <div className="flex gap-1.5 p-1 glass rounded-2xl border border-white/06 w-fit mb-3 mt-1">
            <button
              onClick={() => {
                setSubTab("employees");
                setIsSelectMode(false);
                setSelectedEmployeeIds(new Set());
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-fluid-xs font-semibold uppercase tracking-wider transition-all cursor-pointer",
                subTab === "employees"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-white/40 hover:text-white/70 border border-transparent"
              )}
            >
              Employees
            </button>
            <button
              onClick={() => {
                setSubTab("admins");
                setIsSelectMode(false);
                setSelectedEmployeeIds(new Set());
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-fluid-xs font-semibold uppercase tracking-wider transition-all cursor-pointer",
                subTab === "admins"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-white/40 hover:text-white/70 border border-transparent"
              )}
            >
              Admin Accounts
            </button>
          </div>
        )}

        {/* Status indicator & sorting/filtering */}
        <div className="flex flex-col gap-3 mt-3">
          {subTab === "employees" ? (
            <>
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
              <div className="grid grid-cols-4 gap-2 pt-1">
                {/* Sort */}
                <div className="flex flex-col bg-transparent">
                  <label className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-1 font-bold font-mono">Sort By</label>
                  <CustomSelect
                    value={sortBy}
                    onChange={(val) => setSortBy(val as SortOption)}
                    options={[
                      { value: "name", label: "Name (A-Z)" },
                      { value: "employeeCode", label: "Employee ID" },
                      { value: "designation", label: "Designation" },
                      { value: "establishment", label: "Establishment" },
                      { value: "expiryDate", label: "Expiry Date" },
                    ]}
                    className="text-fluid-xs"
                    triggerClassName="py-1.5 px-2 bg-black/40 border-white/06 text-fluid-xs rounded-xl focus:border-amber-500/40"
                  />
                </div>

                {/* Filter Status */}
                <div className="flex flex-col bg-transparent">
                  <label className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-1 font-bold font-mono">Status</label>
                  <CustomSelect
                    value={filterStatus}
                    onChange={(val) => setFilterStatus(val as StatusFilterOption)}
                    options={[
                      { value: "all", label: "All" },
                      { value: "valid", label: "Valid Only" },
                      { value: "expired", label: "Expired Only" },
                    ]}
                    className="text-fluid-xs"
                    triggerClassName="py-1.5 px-2 bg-black/40 border-white/06 text-fluid-xs rounded-xl focus:border-amber-500/40"
                  />
                </div>

                {/* Filter Designation */}
                <div className="flex flex-col bg-transparent">
                  <label className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-1 font-bold font-mono">Designation</label>
                  <CustomSelect
                    value={filterDesignation}
                    onChange={(val) => setFilterDesignation(val)}
                    options={[
                      { value: "all", label: "All" },
                      ...uniqueDesignations.map((des) => ({ value: des as string, label: des as string })),
                    ]}
                    className="text-fluid-xs"
                    triggerClassName="py-1.5 px-2 bg-black/40 border-white/06 text-fluid-xs rounded-xl focus:border-amber-500/40"
                  />
                </div>

                {/* Filter Establishment */}
                <div className="flex flex-col bg-transparent">
                  <label className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-1 font-bold font-mono">Establishment</label>
                  <CustomSelect
                    value={filterEstablishment}
                    onChange={(val) => setFilterEstablishment(val)}
                    options={[
                      { value: "all", label: "All" },
                      ...uniqueEstablishments.map((est) => ({ value: est as string, label: est as string })),
                    ]}
                    className="text-fluid-xs"
                    triggerClassName="py-1.5 px-2 bg-black/40 border-white/06 text-fluid-xs rounded-xl focus:border-amber-500/40"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 glass rounded-full px-3 py-1 border border-emerald-500/20">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span className="text-fluid-xs text-emerald-400 font-medium">Secure Role Access</span>
              </span>
              <span className="text-fluid-xs text-white/25">
                {adminUsers.length} admin {adminUsers.length === 1 ? "account" : "accounts"}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Scrollable list */}
      <div className="flex-1 scroll-smooth-y px-5 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-max content-start">
        {subTab === "employees" ? (
          employees.length === 0 ? (
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
                  setFilterEstablishment("all");
                }}
                className="text-fluid-xs text-amber-300/60 hover:text-amber-300 transition-colors uppercase tracking-wider"
              >
                Clear Filters
              </button>
            </motion.div>
          ) : (
            <AnimatePresence>
              {filteredEmployees.map((emp, i) => {
                const isSelected = selectedEmployeeIds.has(emp.id);
                return (
                  <motion.div
                    key={emp.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <EmployeeCard
                      employee={emp}
                      isSelectMode={isSelectMode}
                      isSelected={isSelected}
                      onToggleSelect={() => {
                        const next = new Set(selectedEmployeeIds);
                        if (next.has(emp.id)) {
                          next.delete(emp.id);
                        } else {
                          next.add(emp.id);
                        }
                        setSelectedEmployeeIds(next);
                      }}
                      onEdit={() => openEditForm(emp)}
                      onDelete={() => handleDeleteEmployee(emp)}
                      onShowQR={() => setShowQRFor(emp.id)}
                      onShowDetails={() => setShowDetailsFor(emp)}
                    />
                  </motion.div>
                );
              })}
              {isSelectMode && selectedEmployeeIds.size > 0 && (
                <motion.div
                  key="bulk-spacer"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 112 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="col-span-full"
                  aria-hidden="true"
                />
              )}
            </AnimatePresence>
          )
        ) : (
          loadingAdmins ? (
            <div className="flex justify-center items-center py-16 col-span-full">
              <div className="w-8 h-8 border-2 border-amber-200/20 border-t-amber-300 rounded-full animate-spin" />
            </div>
          ) : adminUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-white/06 rounded-3xl border-dashed text-white/25 gap-3 col-span-full">
              <Shield className="w-9 h-9 opacity-40" />
              <p className="text-fluid-sm">No admin accounts found</p>
            </div>
          ) : (
            <AnimatePresence>
              {adminUsers.map((admin, i) => (
                <motion.div
                  key={admin.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <AdminCard
                    admin={admin}
                    currentUser={user}
                    onEdit={() => setShowEditAdminFor(admin)}
                    onDelete={() => handleDeleteAdmin(admin.id, admin.email)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )
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
        {showAddAdminModal && (
          <AddAdminModal
            onClose={() => setShowAddAdminModal(false)}
            onSave={handleAddAdmin}
          />
        )}
        {showEditAdminFor && (
          <EditAdminModal
            admin={showEditAdminFor}
            onClose={() => setShowEditAdminFor(null)}
            onSave={handleUpdateAdmin}
          />
        )}
        {confirmDeleteConfig && (
          <ConfirmationModal
            title={confirmDeleteConfig.title}
            message={confirmDeleteConfig.message}
            onConfirm={confirmDeleteConfig.onConfirm}
            onClose={() => setConfirmDeleteConfig(null)}
          />
        )}
        {showBulkEditModal && (
          <BulkEditModal
            selectedCount={selectedEmployeeIds.size}
            employees={employees}
            onClose={() => setShowBulkEditModal(false)}
            onSave={async (updates) => {
              await bulkUpdateEmployees(Array.from(selectedEmployeeIds), updates);
              setSelectedEmployeeIds(new Set());
              setIsSelectMode(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {isSelectMode && selectedEmployeeIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2.5rem)] max-w-lg glass rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl bg-brand-bg-dark/95 backdrop-blur-[20px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(246,190,90,0.15)]"
          >
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-fluid-xs font-mono uppercase tracking-widest text-amber-300 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                {selectedEmployeeIds.size} Selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const allIds = filteredEmployees.map((e) => e.id);
                    const allSelected = allIds.every((id) => selectedEmployeeIds.has(id));
                    if (allSelected) {
                      const next = new Set(selectedEmployeeIds);
                      allIds.forEach((id) => next.delete(id));
                      setSelectedEmployeeIds(next);
                    } else {
                      const next = new Set(selectedEmployeeIds);
                      allIds.forEach((id) => next.add(id));
                      setSelectedEmployeeIds(next);
                    }
                  }}
                  className="text-[10px] text-white/50 hover:text-white uppercase tracking-wider font-semibold px-2 py-1 transition-colors cursor-pointer"
                >
                  {filteredEmployees.map((e) => e.id).every((id) => selectedEmployeeIds.has(id))
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider text-amber-300 hover:text-amber-200 border border-amber-500/20 bg-amber-500/05 hover:bg-amber-500/10 transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Bulk Edit
              </button>
              <button
                onClick={() => {
                  const selectedCount = selectedEmployeeIds.size;
                  setConfirmDeleteConfig({
                    type: "bulk_employees",
                    targetIds: Array.from(selectedEmployeeIds),
                    title: "Delete Multiple Records",
                    message: `Are you sure you want to delete the ${selectedCount} selected employee records? This action cannot be undone.`,
                    onConfirm: async () => {
                      await removeEmployees(Array.from(selectedEmployeeIds));
                      setSelectedEmployeeIds(new Set());
                      setIsSelectMode(false);
                    }
                  });
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 border border-rose-500/20 bg-rose-500/05 hover:bg-rose-500/10 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
              <button
                onClick={() => {
                  setSelectedEmployeeIds(new Set());
                  setIsSelectMode(false);
                }}
                className="btn-icon w-9 h-9 border-white/10 text-white/50 hover:text-white hover:bg-white/05 cursor-pointer"
                title="Cancel Select"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Employee Card ─────────────────────────────────────────────── */
function EmployeeCard({
  employee, onEdit, onDelete, onShowQR, onShowDetails, isSelectMode = false, isSelected = false, onToggleSelect
}: {
  employee: Employee;
  onEdit: () => void;
  onDelete: () => void;
  onShowQR: () => void;
  onShowDetails: () => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  key?: string;
}) {
  const isExpired = isBefore(startOfDay(parseISO(employee.expiryDate)), startOfDay(new Date()));

  const handleClick = (e: React.MouseEvent) => {
    if (isSelectMode && onToggleSelect) {
      e.stopPropagation();
      onToggleSelect();
    } else {
      onShowDetails();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "glass rounded-2xl p-4 flex items-center gap-3 border border-white/06 hover:border-white/10 hover:bg-white/05 active:scale-[0.99] cursor-pointer transition-all text-left",
        isSelected && "border-amber-500/30 bg-amber-500/03"
      )}
    >
      {/* Selection Checkbox */}
      {isSelectMode && (
        <div className="flex-shrink-0 mr-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleSelect}
            className="w-5 h-5 rounded-lg border border-white/20 flex items-center justify-center transition-colors cursor-pointer hover:bg-white/05"
          >
            {isSelected ? (
              <Check className="w-3.5 h-3.5 text-amber-300" />
            ) : null}
          </button>
        </div>
      )}

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
          <span className="text-white/20 text-[10px]">•</span>
          <span className="text-fluid-xs text-white/25">{employee.establishment}</span>
        </div>
        <p className="text-fluid-xs text-white/20 mt-1">
          Expires {format(parseISO(employee.expiryDate), "MMM d, yyyy")}
        </p>
      </div>

      {/* Actions */}
      {!isSelectMode && (
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
      )}
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
  const [establishment, setEstablishment] = useState(employee?.establishment || "Fashion Depot");
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

  const defaultEstablishments = useMemo(() => ["Fashion Depot", "Thrifter's Haven", "Finders Runway"], []);
  const uniqueEstablishments = useMemo(() => {
    const list = Array.from(
      new Set(employees.map((e) => e.establishment).filter(Boolean))
    );
    defaultEstablishments.forEach((est) => {
      if (!list.includes(est)) list.push(est);
    });
    return list.sort();
  }, [employees, defaultEstablishments]);

  const [isCustomEstablishment, setIsCustomEstablishment] = useState(
    () => !employee || !uniqueEstablishments.includes(employee.establishment)
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

    if (!name || !designation || !establishment || !expiryDate) {
      setLocalError("Please complete all required fields.");
      return;
    }

    setLocalError(null);
    onSave({ id: employee?.id || crypto.randomUUID(), employeeCode: normalizedEmployeeCode, name, designation, establishment, expiryDate, isActive: true });
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
              <CustomSelect
                value={designation}
                onChange={(val) => {
                  if (val === "__new__") {
                    setIsCustomDesignation(true);
                    setDesignation("");
                  } else {
                    setDesignation(val);
                  }
                  setLocalError(null);
                }}
                options={[
                  ...uniqueDesignations.map((des) => ({ value: des as string, label: des as string })),
                  { value: "__new__", label: "+ Add Custom Designation...", className: "text-amber-300 font-semibold border-t border-white/05 mt-1 pt-2" }
                ]}
                placeholder="Select Designation..."
                triggerClassName="py-3"
              />
            )}
          </div>

          {/* Establishment */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-fluid-xs text-white/35 uppercase tracking-widest">
                Establishment
              </label>
              {isCustomEstablishment && uniqueEstablishments.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomEstablishment(false);
                    if (uniqueEstablishments.length > 0) {
                      setEstablishment(uniqueEstablishments[0]);
                    }
                  }}
                  className="text-[10px] text-amber-300/80 hover:text-amber-300 uppercase tracking-wider cursor-pointer"
                >
                  Choose Existing
                </button>
              )}
            </div>

            {isCustomEstablishment ? (
              <input
                value={establishment}
                onChange={(e) => {
                  setEstablishment(e.target.value);
                  setLocalError(null);
                }}
                placeholder="Fashion Depot"
                className="input-base"
                required
              />
            ) : (
              <CustomSelect
                value={establishment}
                onChange={(val) => {
                  if (val === "__new__") {
                    setIsCustomEstablishment(true);
                    setEstablishment("");
                  } else {
                    setEstablishment(val);
                  }
                  setLocalError(null);
                }}
                options={[
                  ...uniqueEstablishments.map((est) => ({ value: est as string, label: est as string })),
                  { value: "__new__", label: "+ Add Custom Establishment...", className: "text-amber-300 font-semibold border-t border-white/05 mt-1 pt-2" }
                ]}
                placeholder="Select Establishment..."
                triggerClassName="py-3"
              />
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
              className="input-base scheme-dark"
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

          <div className="border-b border-white/05 pb-3">
            <span className="text-[10px] uppercase tracking-widest text-white/30 block font-mono mb-1">Establishment</span>
            <span className="text-fluid-sm font-semibold text-white/90">{employee.establishment}</span>
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
          className="bg-white p-4 rounded-2xl shadow-[0_0_40px_rgba(246,190,90,0.15)] mb-5"
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
            className="rounded-3xl glass flex items-center justify-center mb-5 border border-white/10 w-[4.5rem] h-[4.5rem] shadow-[0_0_40px_rgba(246,190,90,0.10)]"
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

/* ─── Admin Card ────────────────────────────────────────────────── */
function AdminCard({
  admin,
  currentUser,
  onEdit,
  onDelete
}: {
  admin: {
    id: string;
    email: string;
    display_name?: string;
    is_admin: boolean;
    is_super_admin: boolean;
    created_at: string;
  };
  currentUser: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isMe = admin.id === currentUser?.id;
  const roleName = admin.is_super_admin ? "Super Admin" : admin.is_admin ? "Admin" : "User";
  const dateStr = admin.created_at ? format(parseISO(admin.created_at), "MMM d, yyyy") : "";

  return (
    <div
      className={cn(
        "glass rounded-2xl p-4 flex items-center gap-3 border border-white/06 hover:border-white/10 hover:bg-white/05 transition-all text-left",
        isMe && "border-amber-500/20 bg-amber-500/02"
      )}
    >
      {/* Icon representing user role */}
      <div className="flex-shrink-0">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center border",
          admin.is_super_admin
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-white/10 bg-white/05 text-white/70"
        )}>
          <Shield className="w-5 h-5" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-fluid-sm font-semibold text-white/90 truncate">
            {admin.display_name || "Unnamed Account"}
          </p>
          {isMe && (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-white/10 text-white/70 px-1.5 py-0.5 rounded">
              You
            </span>
          )}
        </div>
        <p className="text-fluid-xs text-white/40 truncate font-mono mt-0.5">{admin.email}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded",
            admin.is_super_admin
              ? "bg-amber-500/15 text-amber-300"
              : "bg-emerald-500/15 text-emerald-400"
          )}>
            {roleName}
          </span>
          {dateStr && (
            <>
              <span className="text-white/20 text-[10px]">•</span>
              <span className="text-[10px] text-white/30 font-medium">Created {dateStr}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="btn-icon cursor-pointer"
          title="Edit Admin"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="btn-icon hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 cursor-pointer"
          title={isMe ? "Delete Your Account" : "Revoke Admin Access"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Add Admin Modal ───────────────────────────────────────────── */
function AddAdminModal({
  onClose,
  onSave
}: {
  onClose: () => void;
  onSave: (email: string, displayName: string, password: string, role: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await onSave(email.trim(), displayName.trim(), password, role);
    } catch (err: any) {
      setError(err?.message || "Failed to create admin account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.form
        onSubmit={handleSubmit}
        key="add-admin-modal"
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
          New Admin Account
        </h3>

        <div className="space-y-3 mb-5">
          {/* Full Name */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Full Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Admin Name"
              className="input-base"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="input-base"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="input-base pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Role
            </label>
            <CustomSelect
              value={role}
              onChange={(val) => setRole(val)}
              options={[
                { value: "admin", label: "Admin" },
                { value: "super_admin", label: "Super Admin" }
              ]}
              triggerClassName="py-3"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
            <p className="text-rose-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Creating Account…
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Create Admin
            </>
          )}
        </button>
      </motion.form>
    </ModalBackdrop>
  );
}

/* ─── Edit Admin Modal ───────────────────────────────────────────── */
function EditAdminModal({
  admin,
  onClose,
  onSave
}: {
  admin: {
    id: string;
    email: string;
    display_name?: string;
    is_admin: boolean;
    is_super_admin: boolean;
  };
  onClose: () => void;
  onSave: (userId: string, email: string, displayName: string, password?: string, role?: string) => Promise<void>;
}) {
  const [email, setEmail] = useState(admin.email);
  const [displayName, setDisplayName] = useState(admin.display_name || "");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState(() => {
    if (admin.is_super_admin) return "super_admin";
    if (admin.is_admin) return "admin";
    return "user";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSave(admin.id, email.trim(), displayName.trim(), password || undefined, role);
    } catch (err: any) {
      setError(err?.message || "Failed to update admin account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.form
        onSubmit={handleSubmit}
        key="edit-admin-modal"
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
          Edit Admin Account
        </h3>

        <div className="space-y-3 mb-5">
          {/* Full Name */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Full Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Admin Name"
              className="input-base"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="input-base"
              required
            />
          </div>

          {/* Password (Optional) */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Password (leave blank to keep unchanged)
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New Password (optional)"
                className="input-base pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-fluid-xs text-white/35 uppercase tracking-widest mb-1.5">
              Role
            </label>
            <CustomSelect
              value={role}
              onChange={(val) => setRole(val)}
              options={[
                { value: "admin", label: "Admin" },
                { value: "super_admin", label: "Super Admin" },
                { value: "user", label: "Revoke Access (Regular User)" }
              ]}
              triggerClassName="py-3"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
            <p className="text-rose-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Saving Changes…
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4 opacity-70" />
              Save Changes
            </>
          )}
        </button>
      </motion.form>
    </ModalBackdrop>
  );
}

/* ─── Confirmation Modal ────────────────────────────────────────── */
interface ConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

function ConfirmationModal({ title, message, onConfirm, onClose }: ConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Operation failed.");
      setLoading(false);
    }
  };

  return (
    <ModalBackdrop onClose={loading ? () => {} : onClose}>
      <motion.div
        key="confirm-modal"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        className="glass rounded-[2rem] p-6 w-full max-w-sm border border-rose-500/20 relative mx-4 bg-brand-bg-dark/95"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 btn-icon disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3.5 mb-4 mt-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-rose-500/30 bg-rose-500/10 text-rose-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <h3 className="serif italic text-fluid-lg text-white font-semibold leading-tight">
            {title}
          </h3>
        </div>

        <p className="text-fluid-xs text-white/70 leading-relaxed mb-6">
          {message}
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
            <p className="text-rose-400 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 btn-primary py-2.5 disabled:opacity-50 bg-white/03 border-white/05 hover:bg-white/06 text-white/70"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-fluid-xs font-bold uppercase tracking-wider text-rose-300 border border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              "Confirm Delete"
            )}
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

/* ─── Bulk Edit Modal ───────────────────────────────────────────── */
interface BulkEditModalProps {
  selectedCount: number;
  employees: Employee[];
  onClose: () => void;
  onSave: (updates: { designation?: string; establishment?: string; expiryDate?: string }) => Promise<void>;
}

function BulkEditModal({ selectedCount, employees, onClose, onSave }: BulkEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [designation, setDesignation] = useState("");
  const [establishment, setEstablishment] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const uniqueDesignations = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.designation).filter(Boolean))).sort();
  }, [employees]);

  const defaultEstablishments = useMemo(() => ["Fashion Depot", "Thrifter's Haven", "Finders Runway"], []);
  const uniqueEstablishments = useMemo(() => {
    const list = Array.from(new Set(employees.map((e) => e.establishment).filter(Boolean)));
    defaultEstablishments.forEach((est) => {
      if (!list.includes(est)) list.push(est);
    });
    return list.sort();
  }, [employees, defaultEstablishments]);

  const [isCustomDesignation, setIsCustomDesignation] = useState(true);
  const [isCustomEstablishment, setIsCustomEstablishment] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const isDesignationEntered = designation.trim() !== "";
    const isEstablishmentEntered = establishment.trim() !== "";
    const isExpiryDateEntered = expiryDate !== "";

    if (!isDesignationEntered && !isEstablishmentEntered && !isExpiryDateEntered) {
      setError("Please edit at least one field to apply changes.");
      return;
    }

    const payload: { designation?: string; establishment?: string; expiryDate?: string } = {};

    if (isDesignationEntered) {
      payload.designation = designation.trim();
    }
    if (isEstablishmentEntered) {
      payload.establishment = establishment.trim();
    }
    if (isExpiryDateEntered) {
      payload.expiryDate = expiryDate;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to perform bulk update.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBackdrop onClose={loading ? () => {} : onClose}>
      <motion.form
        onSubmit={handleSubmit}
        key="bulk-edit-modal"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        className="glass rounded-[2rem] p-6 w-full max-w-sm border border-white/10 relative mx-4 bg-brand-bg-dark/95"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 btn-icon disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="serif italic text-fluid-xl text-white mb-1">
          Bulk Edit Records
        </h3>
        <p className="text-fluid-xs text-white/45 mb-5 font-mono">
          Updating {selectedCount} selected {selectedCount === 1 ? "record" : "records"}
        </p>

        <div className="space-y-4 mb-6">
          {/* Designation */}
          <div className="rounded-2xl border border-white/05 bg-black/10 p-3.5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-fluid-xs font-semibold uppercase tracking-wider text-white/80">
                Designation
              </span>
              <div className="flex gap-2.5 items-center">
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
                {!isCustomDesignation && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDesignation(true);
                      setDesignation("");
                    }}
                    className="text-[10px] text-amber-300/80 hover:text-amber-300 uppercase tracking-wider cursor-pointer"
                  >
                    Custom
                  </button>
                )}
                {designation && (
                  <button
                    type="button"
                    onClick={() => setDesignation("")}
                    className="text-[10px] text-rose-400 hover:text-rose-300 uppercase tracking-wider cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-1">
              {isCustomDesignation ? (
                <input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Sales Associate (Leave blank to keep unchanged)"
                  className="input-base"
                />
              ) : (
                <CustomSelect
                  value={designation}
                  onChange={(val) => {
                    if (val === "__new__") {
                      setIsCustomDesignation(true);
                      setDesignation("");
                    } else {
                      setDesignation(val);
                    }
                  }}
                  options={[
                    { value: "", label: "— Leave Unchanged —", className: "text-white/40 italic font-normal" },
                    ...uniqueDesignations.map((des) => ({ value: des as string, label: des as string })),
                    { value: "__new__", label: "+ Add Custom Designation...", className: "text-amber-300 font-semibold border-t border-white/05 mt-1 pt-2" }
                  ]}
                  placeholder="Select Designation... (Unchanged)"
                  triggerClassName="py-3"
                />
              )}
            </div>
          </div>

          {/* Establishment */}
          <div className="rounded-2xl border border-white/05 bg-black/10 p-3.5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-fluid-xs font-semibold uppercase tracking-wider text-white/80">
                Establishment
              </span>
              <div className="flex gap-2.5 items-center">
                {isCustomEstablishment && uniqueEstablishments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomEstablishment(false);
                      if (uniqueEstablishments.length > 0) {
                        setEstablishment(uniqueEstablishments[0]);
                      }
                    }}
                    className="text-[10px] text-amber-300/80 hover:text-amber-300 uppercase tracking-wider cursor-pointer"
                  >
                    Choose Existing
                  </button>
                )}
                {!isCustomEstablishment && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomEstablishment(true);
                      setEstablishment("");
                    }}
                    className="text-[10px] text-amber-300/80 hover:text-amber-300 uppercase tracking-wider cursor-pointer"
                  >
                    Custom
                  </button>
                )}
                {establishment && (
                  <button
                    type="button"
                    onClick={() => setEstablishment("")}
                    className="text-[10px] text-rose-400 hover:text-rose-300 uppercase tracking-wider cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-1">
              {isCustomEstablishment ? (
                <input
                  value={establishment}
                  onChange={(e) => setEstablishment(e.target.value)}
                  placeholder="e.g. Fashion Depot (Leave blank to keep unchanged)"
                  className="input-base"
                />
              ) : (
                <CustomSelect
                  value={establishment}
                  onChange={(val) => {
                    if (val === "__new__") {
                      setIsCustomEstablishment(true);
                      setEstablishment("");
                    } else {
                      setEstablishment(val);
                    }
                  }}
                  options={[
                    { value: "", label: "— Leave Unchanged —", className: "text-white/40 italic font-normal" },
                    ...uniqueEstablishments.map((est) => ({ value: est as string, label: est as string })),
                    { value: "__new__", label: "+ Add Custom Establishment...", className: "text-amber-300 font-semibold border-t border-white/05 mt-1 pt-2" }
                  ]}
                  placeholder="Select Establishment... (Unchanged)"
                  triggerClassName="py-3"
                />
              )}
            </div>
          </div>

          {/* Expiry Date */}
          <div className="rounded-2xl border border-white/05 bg-black/10 p-3.5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-fluid-xs font-semibold uppercase tracking-wider text-white/80">
                Expiry Date
              </span>
              {expiryDate && (
                <button
                  type="button"
                  onClick={() => setExpiryDate("")}
                  className="text-[10px] text-rose-400 hover:text-rose-300 uppercase tracking-wider cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-1">
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="input-base scheme-dark"
                placeholder="dd/mm/yyyy (Leave blank to keep unchanged)"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
            <p className="text-rose-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Updating Records…
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Apply Changes
            </>
          )}
        </button>
      </motion.form>
    </ModalBackdrop>
  );
}
