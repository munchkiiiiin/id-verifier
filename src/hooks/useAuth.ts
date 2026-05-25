import { useState, useEffect } from "react";
import type { AuthError, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    "invalid_credentials": "Incorrect email or password.",
    "email_not_confirmed": "Please confirm your email before signing in.",
    "over_email_send_rate_limit": "Too many attempts. Please try again later.",
    "email_address_invalid": "Invalid email address.",
    "weak_password": "Password is too weak.",
    "signup_disabled": "Registration is currently disabled.",
  };
  return map[code] ?? "Login failed. Please try again.";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const authError = err as AuthError & { code?: string };
    if (authError.code) {
      return friendlyError(authError.code);
    }
    return err.message;
  }

  return "Login failed. Please try again.";
}

async function syncUserProfile(user: User) {
  const now = new Date().toISOString();
  const payload = {
    id: user.id,
    email: user.email ?? "",
    display_name: (user.user_metadata?.full_name as string | undefined) ?? "",
    updated_at: now,
  };

  const { error } = await supabase
    .from("users")
    .upsert({
      ...payload,
      created_at: now,
    }, { onConflict: "id" });

  if (error) {
    console.error("Profile sync failed:", error.message);
  }
}

async function loadUserAdminState(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Profile lookup failed:", error.message);
    return false;
  }

  return Boolean(data?.is_admin);
}

export function useAuth() {
  const [user,        setUser]        = useState<User | null>(null);
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const applySessionUser = async (currentUser: User | null) => {
    setUser(currentUser);
    if (!currentUser) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    await syncUserProfile(currentUser);
    setIsAdmin(await loadUserAdminState(currentUser.id));
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      void applySessionUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySessionUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /* ── Email / Password ───────────────────────────────────────── */
  const loginWithEmail = async (email: string, password: string) => {
    setError(null);
    setAuthLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        throw signInError;
      }
      if (data.user) {
        await syncUserProfile(data.user);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const registerWithEmail = async (email: string, password: string) => {
    setError(null);
    setAuthLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        throw signUpError;
      }
      if (data.user) {
        await syncUserProfile(data.user);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  /* ── Logout ─────────────────────────────────────────────────── */
  const logout = async () => {
    try { await supabase.auth.signOut(); }
    catch (err) { console.error("Logout failed:", err); }
  };

  return {
    user,
    isAdmin,
    loading,
    authLoading,
    loginWithEmail,
    logout,
    error,
  };
}
