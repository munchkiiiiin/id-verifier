import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export type Employee = {
  id: string; // The Document ID (secure UUID token)
  employeeCode: string; // The explicit display ID (e.g. EMP-1234)
  name: string;
  department: string;
  expiryDate: string; // YYYY-MM-DD
  isActive: boolean;
};

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();

  const mapRowToEmployee = (row: Record<string, unknown>): Employee => ({
    id: String(row.id ?? ""),
    employeeCode: String(row.employee_code ?? ""),
    name: String(row.name ?? ""),
    department: String(row.department ?? ""),
    expiryDate: String(row.expiry_date ?? ""),
    isActive: Boolean(row.is_active),
  });

  const sortEmployees = (items: Employee[]) =>
    [...items].sort((left, right) => left.name.localeCompare(right.name));

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_code, name, department, expiry_date, is_active")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => mapRowToEmployee(row as Record<string, unknown>));
  };

  useEffect(() => {
    if (!user) {
      setEmployees([]);
      setIsLoaded(true);
      setAccessDenied(false);
      setErrorMessage(null);
      return;
    }

    if (!isAdmin) {
      setEmployees([]);
      setIsLoaded(true);
      setAccessDenied(true);
      setErrorMessage("This account is signed in, but it is not marked as an admin in Supabase.");
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        const data = await loadEmployees();
        if (isCancelled) return;
        setEmployees(data);
        setAccessDenied(false);
        setErrorMessage(null);
      } catch (error) {
        if (isCancelled) return;
        setAccessDenied(false);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load employee records.");
      } finally {
        if (!isCancelled) {
          setIsLoaded(true);
        }
      }
    })();

    const channel = supabase
      .channel("employees-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => {
        void loadEmployees()
          .then((data) => {
            if (!isCancelled) {
              setEmployees(data);
            }
          })
          .catch((error) => {
            if (!isCancelled) {
              setErrorMessage(error instanceof Error ? error.message : "Failed to refresh employee records.");
            }
          });
      })
      .subscribe();

    return () => {
      isCancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  const addEmployee = async (employee: Employee) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("employees").insert({
      id: employee.id,
      employee_code: employee.employeeCode,
      name: employee.name,
      department: employee.department,
      expiry_date: employee.expiryDate,
      is_active: employee.isActive,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      throw error;
    }

    setEmployees((current) => sortEmployees([...current, employee]));
  };

  const removeEmployee = async (id: string) => {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) {
      throw error;
    }

    setEmployees((current) => current.filter((employee) => employee.id !== id));
  };

  const updateEmployee = async (employee: Employee) => {
    const { error } = await supabase
      .from("employees")
      .update({
        employee_code: employee.employeeCode,
        name: employee.name,
        department: employee.department,
        expiry_date: employee.expiryDate,
        is_active: employee.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", employee.id);

    if (error) {
      throw error;
    }

    setEmployees((current) =>
      sortEmployees(
        current.map((existing) =>
          existing.id === employee.id
            ? employee
            : existing
        )
      )
    );
  };

  const getEmployee = (id: string): Employee | undefined => {
    return employees.find((e) => e.id === id);
  };

  // For the scanner, fetch online directly by token (which is the document ID)
  const fetchEmployeeByToken = async (token: string): Promise<Employee | null> => {
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_code, name, department, expiry_date, is_active")
      .eq("id", token)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch employee token:", error.message);
      return null;
    }

    if (!data) return null;
    return mapRowToEmployee(data as Record<string, unknown>);
  };

  return {
    employees,
    isLoaded,
    addEmployee,
    removeEmployee,
    updateEmployee,
    getEmployee,
    fetchEmployeeByToken,
    accessDenied,
    errorMessage,
  };
}
