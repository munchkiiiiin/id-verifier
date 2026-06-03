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

    const { email, displayName, password } = req.body;
    if (!email || !displayName || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let userId: string;

    // Check if user already exists in auth.users
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;

    const usersList = (listData?.users || []) as any[];
    const existingAuthUser = usersList.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingAuthUser) {
      userId = existingAuthUser.id;
    } else {
      // Create new user in Supabase Auth (auto-confirmed email)
      const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: displayName
        }
      });
      if (createError) throw createError;
      if (!newAuthUser.user) throw new Error("Failed to create auth user");
      userId = newAuthUser.user.id;
    }

    // Insert or update profile in public.users with is_admin = true
    const { error: dbError } = await adminClient
      .from("users")
      .upsert({
        id: userId,
        email: email.toLowerCase(),
        display_name: displayName,
        is_admin: true,
        is_super_admin: false,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (dbError) throw dbError;

    return res.status(200).json({ message: "Admin account registered successfully", userId });
  } catch (err: any) {
    console.error("Admin creation endpoint error:", err);
    return res.status(500).json({ error: err.message || "Failed to create admin account" });
  }
}
