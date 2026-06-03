import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Employee } from "./useEmployees";
import { LogEntry, ScanStatus } from "../components/ScannerTab";
import { subDays } from "date-fns";

export function useScanLogs() {
  const [scanLog, setScanLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to map Supabase database rows to LogEntry frontend interface
  const mapRowToLogEntry = useCallback((row: any): LogEntry => ({
    id: String(row.id),
    status: row.status as ScanStatus,
    employee: row.employee ? {
      id: String(row.employee.id),
      employeeCode: String(row.employee.employee_code),
      name: String(row.employee.name),
      designation: String(row.employee.designation),
      establishment: String(row.employee.establishment ?? "Fashion Depot"),
      expiryDate: String(row.employee.expiry_date),
      isActive: Boolean(row.employee.is_active),
    } : undefined,
    scannedToken: row.scanned_token || undefined,
    timestamp: new Date(row.created_at),
  }), []);

  // Fetch scan logs from the last 7 days
  const loadLogs = useCallback(async () => {
    try {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data, error: fetchError } = await supabase
        .from("scan_logs")
        .select(`
          id,
          status,
          scanned_token,
          created_at,
          employee:employees(
            id,
            employee_code,
            name,
            designation,
            establishment,
            expiry_date,
            is_active
          )
        `)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const mappedLogs = (data ?? []).map((row) => mapRowToLogEntry(row));
      setScanLog(mappedLogs);
      setError(null);
    } catch (err) {
      console.error("Failed to load scan logs from Supabase:", err);
      setError(err instanceof Error ? err.message : "Failed to load scan logs.");
    } finally {
      setLoading(false);
    }
  }, [mapRowToLogEntry]);

  // Realtime subscription setup
  useEffect(() => {
    void loadLogs();

    const channel = supabase
      .channel("scan-logs-realtime-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scan_logs" },
        () => {
          void loadLogs();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadLogs]);

  // Push new log to Supabase
  const pushLog = useCallback(async (entry: Omit<LogEntry, "id" | "timestamp">) => {
    try {
      const { error: insertError } = await supabase
        .from("scan_logs")
        .insert({
          status: entry.status,
          employee_id: entry.employee?.id || null,
          scanned_token: entry.scannedToken || null,
        });

      if (insertError) {
        throw insertError;
      }
    } catch (err) {
      console.error("Failed to push scan log to Supabase:", err);
      throw err;
    }
  }, []);

  // Clear all scan logs from the database
  const clearLogs = useCallback(async () => {
    try {
      const { error: deleteError } = await supabase
        .from("scan_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Standard filter-friendly delete all

      if (deleteError) {
        throw deleteError;
      }
    } catch (err) {
      console.error("Failed to clear scan logs in Supabase:", err);
      throw err;
    }
  }, []);

  return {
    scanLog,
    loading,
    error,
    pushLog,
    clearLogs,
    refresh: loadLogs,
  };
}
