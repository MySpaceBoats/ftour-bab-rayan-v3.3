/** Shared hermetic harness for hub route tests: in-memory SQLite as D1, fake mail, controllable clock. No network. */
import { handleHubRequest, type HubDeps, type HubEnv } from "./hub";
import { GALLERY_SCHEMA, fakeD1, openDb } from "./test-d1";

const CORS = { "Access-Control-Allow-Origin": "https://www.ftourbabrayan.ma" };
export const T0 = Date.parse("2026-10-09T12:00:00.000Z");

export interface CallOptions { token?: string; admin?: string; site?: string; body?: unknown; ip?: string }

export function createHubHarness() {
  const sqlite = openDb();
  sqlite.exec("ALTER TABLE t_volunteers ADD COLUMN day_id INTEGER;");
  sqlite.exec(GALLERY_SCHEMA);
  sqlite.exec("CREATE TABLE t_ramadan_days (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, iftar_time TEXT);");
  const d = fakeD1(sqlite);
  const env: HubEnv = { DB: d, JWT_SECRET: "test-secret", MEDIA_BASE_URL: "https://m.test", PUBLIC_APP_URL: "https://site.test" };
  const mails: { to: string; subject: string; html: string }[] = [];
  const state = { clock: T0 };

  const deps = (): HubDeps => ({
    now: () => state.clock,
    sendMail: async (to, subject, html) => { mails.push({ to, subject, html }); },
    adminUser: async req => {
      const site = req.headers.get("x-site");
      if (site) return { role: "user", email: site };
      const r = req.headers.get("x-admin");
      return r ? { role: r, isDemo: false } : null;
    },
  });

  async function call(method: string, path: string, o: CallOptions = {}) {
    const headers: Record<string, string> = {};
    if (o.site) headers["x-site"] = o.site;
    if (o.token) headers.authorization = `Bearer ${o.token}`;
    if (o.admin) headers["x-admin"] = o.admin;
    if (o.ip) headers["cf-connecting-ip"] = o.ip;
    if (o.body !== undefined) headers["content-type"] = "application/json";
    const res = await handleHubRequest(
      new Request(`https://w.test${path}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }),
      env, CORS, deps(),
    );
    return res!;
  }

  /** Inserts a volunteer row (default confirmed) and returns its id. */
  function vol(email: string, status = "confirmed", dayId?: number): number {
    const r = sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status,day_id) VALUES ('Amina','Benali',?,?,?)").run(email, status, dayId ?? null);
    return Number(r.lastInsertRowid);
  }

  /** Last 64-hex value of `?param=` found in the most recent mail. */
  function lastLink(param: "token" | "reset" | "recovery"): string {
    const html = mails[mails.length - 1]?.html ?? "";
    const m = new RegExp(`[?&]${param}=([a-f0-9]{64})`).exec(html);
    if (!m) throw new Error(`no ${param} link in last mail`);
    return m[1];
  }

  /** Magic-link sign-in; adds a confirmed volunteer when the email has none. */
  async function signIn(email: string) {
    if (!sqlite.prepare("SELECT 1 AS ok FROM t_volunteers WHERE lower(email) = ?").get(email.toLowerCase())) vol(email);
    await call("POST", "/hub/login", { body: { email } });
    const v = await call("POST", "/hub/verify", { body: { token: lastLink("token") } });
    return (await v.json()) as { session: string; member: { id: number } };
  }

  return {
    sqlite, d, env, mails, call, vol, signIn, lastLink,
    get clock() { return state.clock; },
    set clock(v: number) { state.clock = v; },
  };
}

export type HubHarness = ReturnType<typeof createHubHarness>;
