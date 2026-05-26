const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApiResponse = {
  employee: Record<string, unknown> | null;
  error?: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ employee: null, error: "Method not allowed" } satisfies ApiResponse);
  }

  const rawToken = Array.isArray(req.query?.token) ? req.query.token[0] : req.query?.token;
  const token = String(rawToken ?? "").trim();

  if (!UUID_PATTERN.test(token)) {
    return res.status(400).json({ employee: null, error: "Invalid token" } satisfies ApiResponse);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ employee: null, error: "Server not configured" } satisfies ApiResponse);
  }

  const query = new URLSearchParams({
    select: "id,employee_code,name,department,expiry_date,is_active",
    id: `eq.${token}`,
    limit: "1",
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/employees?${query.toString()}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    return res.status(502).json({ employee: null, error: "Verification query failed" } satisfies ApiResponse);
  }

  const rows = (await response.json()) as Record<string, unknown>[];
  const employee = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  return res.status(employee ? 200 : 404).json({ employee } satisfies ApiResponse);
}