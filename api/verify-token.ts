/// <reference types="node" />
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

// Clean up in-memory map periodically to prevent memory leaks
if (typeof setInterval !== "undefined") {
  const intervalId = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [ip, record] of ipCounters.entries()) {
      if (now - record.windowStart > RATE_LIMIT_WINDOW_SECONDS) {
        ipCounters.delete(ip);
      }
    }
  }, 10 * 60 * 1000); // every 10 minutes
  if (typeof intervalId.unref === "function") {
    intervalId.unref();
  }
}

function redactToken(t: string) {
  if (!t) return "";
  if (t.length <= 10) return t[0] + "***" + t.slice(-1);
  return `${t.slice(0, 6)}...${t.slice(-4)}`;
}

type ApiResponse = {
  employee: Record<string, unknown> | null;
  error?: string;
};

async function insertScanLog(
  supabaseUrl: string,
  serviceRoleKey: string,
  status: string,
  employeeId: string | null,
  scannedToken: string | null
) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/scan_logs`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        status,
        employee_id: employeeId,
        scanned_token: scannedToken
      })
    });
    if (!response.ok) {
      console.error(`verify-token: failed to insert scan log: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error("verify-token: failed to insert scan log", err);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ employee: null, error: "Method not allowed" } satisfies ApiResponse);
  }

  // Spoof-resistant client IP extraction
  const rawIp = req.headers?.['x-real-ip'] || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();

  let limitExceeded = false;
  let currentTtl = RATE_LIMIT_WINDOW_SECONDS;
  let rateLimitChecked = false;

  if (upstashConfigured()) {
    try {
      const key = `rl:${ip}`;
      const count = await upstashIncr(key);
      if (count === null) throw new Error('upstash_incr_failed');
      if (count === 1) await upstashExpire(key, RATE_LIMIT_WINDOW_SECONDS);
      if (count > RATE_LIMIT_MAX) {
        limitExceeded = true;
        currentTtl = await upstashTtl(key) || RATE_LIMIT_WINDOW_SECONDS;
      }
      rateLimitChecked = true;
    } catch (err) {
      console.warn('verify-token: Upstash limiter failed, falling back to local memory:', err?.message ?? err);
    }
  }

  if (!rateLimitChecked) {
    const now = Math.floor(Date.now() / 1000);
    const record = ipCounters.get(ip);
    if (!record || (now - record.windowStart) > RATE_LIMIT_WINDOW_SECONDS) {
      ipCounters.set(ip, { count: 1, windowStart: now });
    } else {
      record.count += 1;
      if (record.count > RATE_LIMIT_MAX) {
        limitExceeded = true;
        currentTtl = RATE_LIMIT_WINDOW_SECONDS - (now - record.windowStart);
      }
    }
  }

  if (limitExceeded) {
    res.setHeader('Retry-After', String(currentTtl));
    return res.status(429).json({ employee: null, error: 'Rate limit exceeded' } satisfies ApiResponse);
  }

  const rawToken = Array.isArray(req.query?.token) ? req.query.token[0] : req.query?.token;
  const token = String(rawToken ?? "").trim();

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ employee: null, error: "Server not configured" } satisfies ApiResponse);
  }

  if (!UUID_PATTERN.test(token)) {
    console.info(`verify-token: invalid token from ${ip} => ${redactToken(token)}`);
    await insertScanLog(supabaseUrl, serviceRoleKey, "invalid_qr", null, token);
    return res.status(400).json({ employee: null, error: "Invalid token" } satisfies ApiResponse);
  }

  const query = new URLSearchParams({
    select: "id,employee_code,name,designation,expiry_date,is_active,establishment",
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

  // Insert log into scan_logs
  let status: 'valid' | 'expired' | 'not_found' = 'not_found';
  let employeeId: string | null = null;
  if (employee) {
    employeeId = String(employee.id);
    const expiryDate = String(employee.expiry_date);
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const expired = expiryDate < todayStr;
    status = expired ? 'expired' : 'valid';
  }
  await insertScanLog(supabaseUrl, serviceRoleKey, status, employeeId, token);

  // Log outcome without leaking full token
  if (employee) {
    console.info(`verify-token: hit for ${ip} token=${redactToken(token)} -> found`);
  } else {
    console.info(`verify-token: miss for ${ip} token=${redactToken(token)}`);
  }

  return res.status(employee ? 200 : 404).json({ employee } satisfies ApiResponse);
}