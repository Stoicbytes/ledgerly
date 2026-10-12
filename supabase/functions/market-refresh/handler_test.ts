import { deepStrictEqual, strictEqual } from "node:assert";
import { strToU8, zipSync } from "npm:fflate@0.8.2";
import { handle } from "./handler.ts";

// End-to-end runs of the handler with the network and database replaced by fakes.

const SECRET = "test-refresh-secret-0123456789";
Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "header.payload.signature");
Deno.env.set("MARKET_REFRESH_SECRET", SECRET);
Deno.env.set("ALLOWED_ORIGINS", "https://app.example");

const amfiFile = () => {
  const lines = [
    "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date",
    "Open Ended Schemes(Equity Scheme - Large Cap Fund)",
    "Horizon Mutual Fund",
  ];
  for (let code = 100000; code < 101200; code += 1) {
    lines.push(
      `${code};-;-;Fund ${code} - Direct - Growth;${(code / 1000).toFixed(4)};07-Oct-2026`,
    );
  }
  return lines.join("\n");
};

const nseZip = () => {
  const rows = ["TradDt,FinInstrmTp,ISIN,TckrSymb,SctySrs,FinInstrmNm,ClsPric,PrvsClsgPric"];
  for (let index = 0; index < 600; index += 1) {
    const isin = `INE${String(index).padStart(6, "0")}A1${index % 10}`;
    rows.push(`2026-10-07,STK,${isin},SYM${index},EQ,Company ${index},${100 + index}.50,100`);
  }
  return zipSync({ "BhavCopy.csv": strToU8(rows.join("\n")) });
};

type Call = { url: string; body: unknown };

function fakeNetwork(status: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  const route = (input: string | URL | Request, init?: RequestInit): Response => {
    const url = String(input instanceof Request ? input.url : input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    const json = (value: unknown, code = 200) =>
      new Response(JSON.stringify(value), { status: code });
    if (url.endsWith("/auth/v1/user")) {
      const auth = new Headers(init?.headers).get("authorization");
      return auth === "Bearer good-token" ? json({ id: "user-1" }) : json({}, 401);
    }
    const rpc = /\/rest\/v1\/rpc\/(\w+)$/.exec(url)?.[1];
    if (rpc === "market_status") return json(status);
    if (rpc === "market_run_start") return json(7);
    if (rpc === "market_run_finish") return new Response(null, { status: 204 });
    if (rpc === "market_ingest_schemes" || rpc === "market_ingest_prices") {
      return json((body as { p_rows: unknown[] }).p_rows.length);
    }
    if (rpc === "market_held_schemes") {
      return json([
        {
          scheme_code: 100001,
          user_ids: ["user-1"],
          first_nav_date: null,
          first_trade_date: "2026-01-05",
        },
        {
          scheme_code: 100002,
          user_ids: ["user-2"],
          first_nav_date: null,
          first_trade_date: "2026-01-05",
        },
      ]);
    }
    if (rpc === "market_ingest_nav_history") {
      return json((body as { p_points: unknown[] }).p_points.length);
    }
    if (url.includes("amfiindia.com")) return new Response(amfiFile());
    if (/BhavCopy_NSE_CM_0_0_0_\d{8}/.test(url)) return new Response(nseZip().slice().buffer);
    if (url.includes("nseindia.com") || url.includes("bseindia.com")) {
      return new Response("", { status: 404 });
    }
    if (url.includes("mfapi.in")) {
      return json({
        data: [{ date: "02-01-2026", nav: "10.0" }, { date: "06-01-2026", nav: "10.5" }],
      });
    }
    return new Response("unexpected", { status: 500 });
  };
  globalThis.fetch =
    ((input: string | URL | Request, init?: RequestInit) =>
      Promise.resolve(route(input, init))) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const post = (headers: Record<string, string>) =>
  new Request("https://project.supabase.co/functions/v1/market-refresh", {
    method: "POST",
    headers: { origin: "https://app.example", ...headers },
  });

Deno.test("rejects callers without a valid token or secret", async () => {
  const net = fakeNetwork();
  try {
    strictEqual((await handle(post({}))).status, 401);
    strictEqual((await handle(post({ authorization: "Bearer bad" }))).status, 401);
    strictEqual((await handle(post({ "x-refresh-secret": "wrong" }))).status, 401);
    const preflight = await handle(
      new Request("https://x/", { method: "OPTIONS", headers: { origin: "https://app.example" } }),
    );
    strictEqual(preflight.status, 204);
    strictEqual(preflight.headers.get("access-control-allow-origin"), "https://app.example");
    strictEqual((await handle(new Request("https://x/"))).status, 405);
  } finally {
    net.restore();
  }
});

Deno.test("a signed-in user refreshes NAVs, prices and their own fund history", async () => {
  const net = fakeNetwork();
  try {
    const response = await handle(post({ authorization: "Bearer good-token" }));
    strictEqual(response.status, 200);
    const result = await response.json();
    deepStrictEqual(result.navs, {
      status: "ok",
      rows: 1200,
      dataDate: "2026-10-07",
      message: "NAVs updated",
    });
    strictEqual(result.prices.status, "ok");
    strictEqual(result.prices.rows, 600);
    strictEqual(result.prices.dataDate, "2026-10-07");
    strictEqual(result.history.status, "ok");
    // Only user-1's scheme is backfilled, from 10 days before the first purchase.
    const backfills = net.calls.filter((call) => call.url.includes("mfapi.in"));
    deepStrictEqual(backfills.map((call) => call.url), ["https://api.mfapi.in/mf/100001"]);
    const history = net.calls.find((call) => call.url.endsWith("market_ingest_nav_history"));
    deepStrictEqual((history?.body as { p_points: unknown }).p_points, [
      ["2026-01-02", 10],
      ["2026-01-06", 10.5],
    ]);
    // Each source is logged.
    const starts = net.calls.filter((call) => call.url.endsWith("market_run_start"));
    deepStrictEqual(
      starts.map((call) => (call.body as { p_source: string }).p_source),
      ["amfi", "nse", "mfapi"],
    );
    // Secrets never appear in what is sent to the database.
    strictEqual(JSON.stringify(net.calls.map((call) => call.body)).includes(SECRET), false);
  } finally {
    net.restore();
  }
});

Deno.test("data refreshed in the last 30 minutes is not fetched again for users", async () => {
  const recent = new Date().toISOString();
  const fresh = { status: "ok", started_at: recent, finished_at: recent, data_date: "2026-10-01" };
  const net = fakeNetwork({ amfi: fresh, nse: fresh });
  try {
    const result = await (await handle(post({ authorization: "Bearer good-token" }))).json();
    strictEqual(result.navs.status, "current");
    strictEqual(result.prices.status, "current");
    strictEqual(net.calls.some((call) => call.url.includes("amfiindia")), false);
  } finally {
    net.restore();
  }
});

Deno.test("the schedule always refreshes and backfills every held scheme", async () => {
  const recent = new Date().toISOString();
  const fresh = { status: "ok", started_at: recent, finished_at: recent, data_date: "2026-10-01" };
  const net = fakeNetwork({ amfi: fresh });
  try {
    const result = await (await handle(post({ "x-refresh-secret": SECRET }))).json();
    strictEqual(result.navs.status, "ok");
    strictEqual(net.calls.filter((call) => call.url.includes("mfapi.in")).length, 2);
    const start = net.calls.find((call) => call.url.endsWith("market_run_start"));
    strictEqual((start?.body as { p_triggered_by: string }).p_triggered_by, "schedule");
  } finally {
    net.restore();
  }
});

Deno.test("a run already in progress is not started twice", async () => {
  const net = fakeNetwork({
    amfi: {
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,
      data_date: null,
    },
  });
  try {
    const result = await (await handle(post({ authorization: "Bearer good-token" }))).json();
    strictEqual(result.busy, true);
    strictEqual(net.calls.some((call) => call.url.endsWith("market_run_start")), false);
  } finally {
    net.restore();
  }
});
