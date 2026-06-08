import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const token = authHeader.split(" ")[1];

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    // 1. Verify the requester's JWT using anon client
    const tempClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    
    const { data: { user: requester }, error: authError } = await tempClient.auth.getUser(token);
    if (authError || !requester) {
      return res.status(401).json({ error: "Unauthorized: Invalid session" });
    }

    // 2. Initialize admin client with service role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 3. Verify requester is actually a Super Admin in public.users
    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("is_super_admin")
      .eq("id", requester.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_super_admin) {
      return res.status(403).json({ error: "Forbidden: Super Admin access required" });
    }

    const { userId, email, displayName, password, role } = req.body;
    if (!userId || !email || !displayName || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const isSuperAdmin = role === "super_admin";
    const isAdmin = role === "admin" || role === "super_admin";

    // 4. Update the user in Supabase Auth
    const authUpdatePayload: any = {
      email: email.toLowerCase(),
      user_metadata: {
        full_name: displayName
      }
    };
    if (password && password.trim() !== "") {
      authUpdatePayload.password = password;
    }

    const { data: updatedUser, error: authUpdateError } = await adminClient.auth.admin.updateUserById(
      userId,
      authUpdatePayload
    );

    if (authUpdateError) {
      throw authUpdateError;
    }

    // 5. Update profile in public.users table
    const { error: dbError } = await adminClient
      .from("users")
      .update({
        email: email.toLowerCase(),
        display_name: displayName,
        is_admin: isAdmin,
        is_super_admin: isSuperAdmin,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (dbError) throw dbError;

    return res.status(200).json({ message: "Admin account updated successfully" });
  } catch (err: any) {
    console.error("Admin update endpoint error:", err);
    return res.status(500).json({ error: err.message || "Failed to update admin account" });
  }
}
