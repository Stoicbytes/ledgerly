/** Request handling for market-refresh (see index.ts). */
import { strFromU8, unzipSync } from "npm:fflate@0.8.2";
import {
  chunk,
  indiaToday,
  minusDays,
  originAllowed,
  parseAmfi,
  parseBhavcopy,
  parseMfapiHistory,
  recentWeekdays,
  safeEqual,
} from "./parse.ts";

/** Settings from the function's environment (read per request, so tests can set them). */
function settings() {
  return {
    url: Deno.env.get("SUPABASE_URL") ?? "",
    key: serviceKey(),
    secret: Deno.env.get("MARKET_REFRESH_SECRET") ?? "",
    // Add Vercel preview deployments through the secret, e.g.
    // "https://ledgerly-*-<team>.vercel.app" ("*" matches one label).
    origins: (
      Deno.env.get("ALLOWED_ORIGINS") ?? "https://ledgerly.vercel.app,http://localhost:8081"
    ).split(",").map((origin) => origin.trim()).filter(Boolean),
  };
}

const USER_AGENT = "Mozilla/5.0 (compatible; Ledgerly/1.0; StoicBytes)";
const AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt";
const nseUrl = (ymd: string) =>
  `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${ymd}_F_0000.csv.zip`;
const bseUrl = (ymd: string) =>
  `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${ymd}_F_0000.CSV`;
const mfapiUrl = (code: number) => `https://api.mfapi.in/mf/${code}`;

const USER_MIN_INTERVAL_MS = 30 * 60_000;
const BACKFILL_LIMIT = 8;

type Caller = { kind: "schedule" } | { kind: "user"; id: string };
type Source = "amfi" | "nse" | "bse" | "mfapi";
type RunStatus = {
  status: string;
  started_at: string;
  finished_at: string | null;
  data_date: string | null;
};
type Outcome = {
  status: "ok" | "failed" | "current";
  rows?: number;
  dataDate?: string | null;
  message?: string;
};

/** The service key: the new secret key when present, else the legacy service-role key. */
function serviceKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    const key = keys.default ?? Object.values(keys)[0];
    if (key) return key;
  } catch {
    // Not set: fall back below.
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function cors(origin: string | null): Record<string, string> {
  const { origins } = settings();
  const allowed = origin && originAllowed(origin, origins) ? origin : origins[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const reply = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function keyHeaders(): Record<string, string> {
  const { key } = settings();
  const headers: Record<string, string> = { apikey: key };
  // Legacy keys are JWTs and also go in Authorization; new secret keys do not.
  if (key.split(".").length === 3) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${settings().url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...keyHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`database ${name} ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function authenticate(request: Request): Promise<Caller | null> {
  const config = settings();
  const secret = request.headers.get("x-refresh-secret");
  if (secret) {
    return config.secret.length >= 24 && safeEqual(secret, config.secret)
      ? { kind: "schedule" }
      : null;
  }
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string };
  return user.id ? { kind: "user", id: user.id } : null;
}

async function download(url: string, timeoutMs = 30_000): Promise<Response> {
  return await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** Runs one source and records it in market_refresh_runs (status and a short message). */
async function recorded(
  source: Source,
  caller: Caller,
  work: () => Promise<Outcome>,
): Promise<Outcome> {
  const id = await rpc<number>("market_run_start", {
    p_source: source,
    p_triggered_by: caller.kind,
  });
  let outcome: Outcome;
  try {
    outcome = await work();
  } catch (error) {
    outcome = { status: "failed", message: error instanceof Error ? error.message : "failed" };
  }
  await rpc("market_run_finish", {
    p_id: id,
    p_status: outcome.status === "failed" ? "failed" : "ok",
    p_rows: outcome.rows ?? 0,
    p_data_date: outcome.dataDate ?? null,
    p_message: (outcome.message ?? "").slice(0, 300),
  });
  return outcome;
}

async function refreshNavs(): Promise<Outcome> {
  const response = await download(AMFI_URL);
  if (!response.ok) return { status: "failed", message: `AMFI responded ${response.status}` };
  const { rows, latestDate } = parseAmfi(await response.text());
  if (rows.length < 1000) {
    return {
      status: "failed",
      message: `AMFI file had ${rows.length} schemes; format may have changed`,
    };
  }
  let stored = 0;
  for (const part of chunk(rows, 2500)) {
    stored += await rpc<number>("market_ingest_schemes", { p_rows: part });
  }
  return { status: "ok", rows: stored, dataDate: latestDate, message: "NAVs updated" };
}

async function exchangeFile(exchange: "NSE" | "BSE", ymd: string): Promise<string | null> {
  const response = await download(exchange === "NSE" ? nseUrl(ymd) : bseUrl(ymd));
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  if (exchange === "BSE") return await response.text();
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const name = Object.keys(files).find((file) => file.toLowerCase().endsWith(".csv"));
  return name ? strFromU8(files[name]) : null;
}

/** The latest end-of-day file from the last few weekdays (holidays have none). */
async function refreshPrices(exchange: "NSE" | "BSE", today: string): Promise<Outcome> {
  for (const day of recentWeekdays(today, 6)) {
    const csv = await exchangeFile(exchange, day.replaceAll("-", ""));
    if (!csv) continue;
    const { rows, tradeDate } = parseBhavcopy(csv, exchange);
    if (rows.length < 500) {
      return {
        status: "failed",
        message: `${exchange} file had ${rows.length} shares; format may have changed`,
      };
    }
    const date = tradeDate ?? day;
    let stored = 0;
    for (const part of chunk(rows, 2500)) {
      stored += await rpc<number>("market_ingest_prices", {
        p_rows: part,
        p_exchange: exchange,
        p_date: date,
      });
    }
    return { status: "ok", rows: stored, dataDate: date, message: `${exchange} closing prices` };
  }
  return { status: "failed", message: `No ${exchange} end-of-day file in the last 6 weekdays` };
}

type HeldScheme = {
  scheme_code: number;
  user_ids: string[];
  first_nav_date: string | null;
  first_trade_date: string | null;
};

/** Held schemes whose stored history starts after the first purchase. */
async function schemesNeedingHistory(caller: Caller): Promise<HeldScheme[]> {
  const held = await rpc<HeldScheme[]>("market_held_schemes");
  return held
    .filter((item) => caller.kind === "schedule" || item.user_ids.includes(caller.id))
    .filter((item) =>
      item.first_trade_date && (!item.first_nav_date || item.first_nav_date > item.first_trade_date)
    )
    .slice(0, BACKFILL_LIMIT);
}

/** Older NAVs for charts, from mfapi.in. */
async function backfill(needed: HeldScheme[]): Promise<Outcome> {
  let stored = 0;
  let failed = 0;
  for (const item of needed) {
    try {
      const response = await download(mfapiUrl(item.scheme_code), 20_000);
      if (!response.ok) {
        failed += 1;
        await response.body?.cancel();
        continue;
      }
      const points = parseMfapiHistory(
        await response.json(),
        minusDays(item.first_trade_date!, 10),
      );
      for (const part of chunk(points, 4000)) {
        stored += await rpc<number>("market_ingest_nav_history", {
          p_scheme_code: item.scheme_code,
          p_points: part,
        });
      }
    } catch {
      failed += 1;
    }
  }
  return {
    status: failed === needed.length ? "failed" : "ok",
    rows: stored,
    message: `History for ${needed.length - failed} of ${needed.length} schemes`,
  };
}

const isCurrent = (run: RunStatus | undefined, today: string, now: number) =>
  !!run && run.status === "ok" &&
  (run.data_date === today ||
    now - Date.parse(run.finished_at ?? run.started_at) < USER_MIN_INTERVAL_MS);

async function refresh(caller: Caller) {
  const now = Date.now();
  const today = indiaToday(new Date(now));
  const status = await rpc<Record<string, RunStatus>>("market_status");
  const running = Object.values(status).some((run) =>
    run.status === "running" && now - Date.parse(run.started_at) < 5 * 60_000
  );
  if (running) return { navs: { status: "current" }, prices: { status: "current" }, busy: true };
  const force = caller.kind === "schedule";

  const navs = !force && isCurrent(status.amfi, today, now)
    ? { status: "current" as const }
    : await recorded("amfi", caller, refreshNavs);

  let prices: Outcome;
  if (!force && (isCurrent(status.nse, today, now) || isCurrent(status.bse, today, now))) {
    prices = { status: "current" };
  } else {
    prices = await recorded("nse", caller, () => refreshPrices("NSE", today));
    if (prices.status === "failed") {
      prices = await recorded("bse", caller, () => refreshPrices("BSE", today));
    }
  }

  const needed = await schemesNeedingHistory(caller);
  const history = needed.length
    ? await recorded("mfapi", caller, () => backfill(needed))
    : { status: "current" as const };
  return { navs, prices, history };
}

/** The HTTP entry point (index.ts serves it). */
export async function handle(request: Request): Promise<Response> {
  const headers = cors(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405, headers);
  const { url, key } = settings();
  if (!url || !key) return reply({ error: "not_configured" }, 500, headers);
  try {
    const caller = await authenticate(request);
    if (!caller) return reply({ error: "unauthorized" }, 401, headers);
    return reply(await refresh(caller), 200, headers);
  } catch (error) {
    console.error("market-refresh failed:", error instanceof Error ? error.message : "unknown");
    return reply({ error: "refresh_failed" }, 500, headers);
  }
}
