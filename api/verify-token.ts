const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Rate limiter configuration
const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute
const RATE_LIMIT_MAX = 10; // requests per IP per window

// Upstash REST helpers (no dependency required)
function upstashConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashIncr(key: string): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const endpoint = `${url.replace(/\/$/, "")}/incr/${encodeURIComponent(key)}`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!resp.ok) return null;
  const payload = await resp.json();
  return typeof payload.result === "number" ? payload.result : Number(payload.result ?? payload);
}

async function upstashExpire(key: string, seconds: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  const endpoint = `${url.replace(/\/$/, "")}/expire/${encodeURIComponent(key)}/${seconds}`;
  const resp = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return false;
  const payload = await resp.json();
  return Boolean(payload.result || payload === 1);
}

async function upstashTtl(key: string): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const endpoint = `${url.replace(/\/$/, "")}/ttl/${encodeURIComponent(key)}`;
  const resp = await fetch(endpoint, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return null;
  const payload = await resp.json();
  return typeof payload.result === "number" ? payload.result : Number(payload.result ?? payload);
}

// In-memory fallback (best-effort)
const ipCounters: Map<string, { count: number; windowStart: number }> = new Map();

function redactToken(t: string) {
  if (!t) return "";
  if (t.length <= 10) return t[0] + "***" + t.slice(-1);
  return `${t.slice(0, 6)}...${t.slice(-4)}`;
}

type ApiResponse = {
  employee: Record<string, unknown> | null;
  error?: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ employee: null, error: "Method not allowed" } satisfies ApiResponse);
  }

  // Simple client IP extraction (Vercel and common reverse proxies set x-forwarded-for)
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (String(forwarded ?? req.socket?.remoteAddress ?? 'unknown'));

  // Prefer Upstash-backed limiter when configured
  // Require Upstash for rate limiting in production; do not fall back to local memory
  if (!upstashConfigured()) {
    console.error('verify-token: Upstash rate limiter not configured');
    return res.status(500).json({ employee: null, error: 'Rate limiter not configured' } satisfies ApiResponse);
  }

  try {
    const key = `rl:${ip}`;
    const count = await upstashIncr(key);
    if (count === null) throw new Error('upstash_incr_failed');
    if (count === 1) await upstashExpire(key, RATE_LIMIT_WINDOW_SECONDS);
    if (count > RATE_LIMIT_MAX) {
      const ttl = await upstashTtl(key) || RATE_LIMIT_WINDOW_SECONDS;
      res.setHeader('Retry-After', String(ttl));
      return res.status(429).json({ employee: null, error: 'Rate limit exceeded' } satisfies ApiResponse);
    }
  } catch (err) {
    console.error('verify-token: Upstash limiter error', err?.message ?? err);
    return res.status(502).json({ employee: null, error: 'Rate limiter error' } satisfies ApiResponse);
  }

  const rawToken = Array.isArray(req.query?.token) ? req.query.token[0] : req.query?.token;
  const token = String(rawToken ?? "").trim();

  if (!UUID_PATTERN.test(token)) {
    console.info(`verify-token: invalid token from ${ip} => ${redactToken(token)}`);
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

  // Use service role key to perform a secure lookup
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

  // Log outcome without leaking full token
  if (employee) {
    console.info(`verify-token: hit for ${ip} token=${redactToken(token)} -> found`);
  } else {
    console.info(`verify-token: miss for ${ip} token=${redactToken(token)}`);
  }

  return res.status(employee ? 200 : 404).json({ employee } satisfies ApiResponse);
}