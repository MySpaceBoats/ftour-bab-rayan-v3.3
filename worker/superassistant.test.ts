import { afterEach, describe, expect, it, vi } from "vitest";
import { handleSuperAssistantRequest } from "./superassistant";
import { tools } from "./superassistant-tools";

const CORS = { "Access-Control-Allow-Origin": "https://admin.ftourbabrayan.ma" };
const env = { OPENROUTER_API_KEY: "k" } as any;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://w.test/api/superassistant", { method: "POST", headers: { "x-demo-access": "1", ...headers }, body: JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe("superassistant", () => {
  it("ignore les autres chemins", async () => {
    expect(await handleSuperAssistantRequest(new Request("https://w.test/api/x"), env, CORS)).toBeNull();
  });

  it("refuse sans session, et le mode démo", async () => {
    expect((await handleSuperAssistantRequest(new Request("https://w.test/api/superassistant"), env, CORS))!.status).toBe(403);
    expect((await handleSuperAssistantRequest(post({ messages: [{ role: "user", content: "hi" }] }), env, CORS))!.status).toBe(403);
  });
});

describe("superassistant shell", () => {
  const mk = (allow: boolean) => {
    const calls: { cmd: string; env?: Record<string, string> }[] = [];
    const shell = { exec: async (cmd: string, o?: { env?: Record<string, string> }) => (calls.push({ cmd, env: o?.env }), { stdout: "ok", stderr: "", exitCode: 0 }) };
    return { calls, t: (n: string) => tools({ GITHUB_TOKEN: "tok", CLOUDFLARE_API_TOKEN: "cf" }, allow, shell).find(x => x.name === n)! };
  };

  it("sh : sans allow aucun identifiant, avec allow GH_TOKEN + Cloudflare", async () => {
    const a = mk(false); await a.t("sh").run({ command: "pnpm check" });
    expect(a.calls.at(-1)!.env).toEqual({});
    const b = mk(true); await b.t("sh").run({ command: "pnpm check" });
    expect(b.calls.at(-1)!.env).toMatchObject({ GH_TOKEN: "tok", CLOUDFLARE_API_TOKEN: "cf" });
  });

  it("push_branch : main refusé sans allow, nom de branche validé", async () => {
    const a = mk(false);
    await expect(a.t("push_branch").run({ branch: "main" })).rejects.toThrow(/désactivé/);
    await expect(a.t("push_branch").run({ branch: "x; rm -rf /" })).rejects.toThrow(/invalide/);
    await a.t("push_branch").run({ branch: "ai/fix" });
    expect(a.calls.at(-1)!.cmd).toBe("git push origin HEAD:refs/heads/ai/fix");
  });
});

describe("superassistant query_db", () => {
  const mk = (rows: unknown[] = [{ n: 1 }]) => {
    const sql: string[] = [];
    const DB = { prepare: (q: string) => (sql.push(q), { all: async () => ({ results: rows }) }) } as any;
    return { sql, t: tools({ GITHUB_TOKEN: "t", DB }, false).find(x => x.name === "query_db") };
  };

  it("absent sans DB", () => {
    expect(tools({ GITHUB_TOKEN: "t" }, false).find(x => x.name === "query_db")).toBeUndefined();
  });

  it("n'accepte qu'un SELECT/WITH unique", async () => {
    const { t, sql } = mk();
    await expect(t!.run({ sql: "SELECT SUM(total_amount) FROM t_orders;" })).resolves.toBe('[{"n":1}]');
    await t!.run({ sql: "WITH a AS (SELECT 1) SELECT * FROM a" });
    expect(sql).toEqual(["SELECT SUM(total_amount) FROM t_orders", "WITH a AS (SELECT 1) SELECT * FROM a"]);
    for (const bad of ["DELETE FROM t_orders", "SELECT 1; DROP TABLE t_orders", "PRAGMA table_info(t_orders)", "WITH a AS (SELECT 1) DELETE FROM t_orders", "UPDATE t_orders SET status='x'", ""])
      await expect(t!.run({ sql: bad })).rejects.toThrow(/refusée/);
    expect(sql).toHaveLength(2);
  });

  it("plafonne à 200 lignes", async () => {
    const out = String(await mk(Array.from({ length: 250 }, (_, i) => ({ i }))).t!.run({ sql: "SELECT i FROM x" }));
    expect(JSON.parse(out.split("\n")[0])).toHaveLength(200);
    expect(out).toMatch(/50 lignes de plus/);
  });
});

describe("superassistant tools", () => {
  const find = (name: string, allow: boolean) => tools({ GITHUB_TOKEN: "t" }, allow).find(t => t.name === name);

  it("merge_pr et deploy n'existent qu'avec allow", () => {
    expect(find("merge_pr", false)).toBeUndefined();
    expect(find("deploy", false)).toBeUndefined();
    expect(find("merge_pr", true)).toBeDefined();
    expect(find("deploy", true)).toBeDefined();
  });

  it("refuse commit sur main sans allow, workflows, traversal et .env", async () => {
    const w = (allow: boolean) => find("write_file", allow)!;
    await expect(w(false).run({ path: "a.ts", content: "x", message: "m", branch: "main" })).rejects.toThrow(/désactivé/);
    await expect(w(true).run({ path: ".github/workflows/deploy.yml", content: "x", message: "m", branch: "ai/x" })).rejects.toThrow(/interdite/);
    await expect(w(true).run({ path: "../x", content: "x", message: "m", branch: "ai/x" })).rejects.toThrow(/interdite/);
    await expect(find("read_file", true)!.run({ path: ".env.production.local" })).rejects.toThrow(/illisible/);
  });
});
