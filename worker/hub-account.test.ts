import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./hub-auth-d1";
import { createHubHarness, type HubHarness } from "./test-hub";

let h: HubHarness;
beforeEach(() => { h = createHubHarness(); });

const PW = "correct-horse-1";
const MIN = 60 * 1000;

async function withPassword(email = "a@x.ma", password = PW) {
  const s = await h.signIn(email);
  const r = await h.call("PUT", "/hub/me/password", { token: s.session, body: { password } });
  expect(r.status).toBe(200);
  return s;
}
const loginPw = (email: string, password: string, ip?: string) => h.call("POST", "/hub/login/password", { body: { email, password }, ip });

describe("password hashing", () => {
  it("uses a self-describing PBKDF2 format with a per-hash salt", { timeout: 20_000 }, async () => {
    const a = await hashPassword(PW);
    const b = await hashPassword(PW);
    expect(a).toMatch(/^pbkdf2-sha256\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword(PW, a)).toBe(true);
    expect(await verifyPassword("wrong-password", a)).toBe(false);
    expect(await verifyPassword("", a)).toBe(false);
    expect(await verifyPassword(PW, "garbage")).toBe(false);
    expect(await verifyPassword(PW, a.replace("$100000$", "$100001$"))).toBe(false);
  });
});

describe("set password + password login (D-01 tracer)", () => {
  it("requires a session and a 8..128 chars password", async () => {
    expect((await h.call("PUT", "/hub/me/password", { body: { password: PW } })).status).toBe(401);
    const s = await h.signIn("a@x.ma");
    expect((await h.call("PUT", "/hub/me/password", { token: s.session, body: { password: "1234567" } })).status).toBe(400);
    expect((await h.call("PUT", "/hub/me/password", { token: s.session, body: { password: "x".repeat(129) } })).status).toBe(400);
  });

  it("security reflects the password; set -> login/password -> me works end to end", { timeout: 20_000 }, async () => {
    const s = await h.signIn("a@x.ma");
    const before = await h.call("GET", "/hub/me/security", { token: s.session });
    expect(await before.json()).toEqual({ has_password: false, recovery_email: null });
    expect((await h.call("PUT", "/hub/me/password", { token: s.session, body: { password: PW } })).status).toBe(200);
    expect(((await (await h.call("GET", "/hub/me/security", { token: s.session })).json()) as any).has_password).toBe(true);

    const r = await loginPw("A@X.ma", PW); // case-insensitive
    expect(r.status).toBe(200);
    const body = (await r.json()) as { session: string; member: { id: number } };
    expect(body.member.id).toBe(s.member.id);
    const me = await h.call("GET", "/hub/me", { token: body.session });
    expect(me.status).toBe(200);
  });

  it("wrong password and unknown email give identical 401 bodies; bad email format is 400", { timeout: 20_000 }, async () => {
    await withPassword();
    const wrong = await loginPw("a@x.ma", "not-the-password");
    const unknown = await loginPw("nobody@x.ma", "not-the-password");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.text()).toBe(await unknown.text());
    expect((await loginPw("not-an-email", "whatever1")).status).toBe(400);
  });

  it("rate limit per email: 5 failures lock even the right password, unknown emails too; unlocks after 15 min", { timeout: 30_000 }, async () => {
    await withPassword();
    for (let i = 0; i < 5; i++) expect((await loginPw("a@x.ma", "bad-password-" + i)).status).toBe(401);
    expect((await loginPw("a@x.ma", PW)).status).toBe(429);
    for (let i = 0; i < 5; i++) expect((await loginPw("ghost@x.ma", "bad-password-" + i)).status).toBe(401);
    expect((await loginPw("ghost@x.ma", "bad-password-x")).status).toBe(429);
    h.clock += 16 * MIN;
    expect((await loginPw("a@x.ma", PW)).status).toBe(200);
  });

  it("rate limit per IP: 20 failures across emails block that IP only", { timeout: 60_000 }, async () => {
    await withPassword();
    for (let i = 0; i < 20; i++) expect((await loginPw(`u${i}@x.ma`, "bad-password-1", "9.9.9.9")).status).toBe(401);
    expect((await loginPw("fresh@x.ma", "bad-password-1", "9.9.9.9")).status).toBe(429);
    expect((await loginPw("a@x.ma", PW, "8.8.8.8")).status).toBe(200);
  });

  it("changing the password needs the current one (400, session kept) and revokes the other sessions", { timeout: 30_000 }, async () => {
    const s1 = await withPassword();
    const s2 = await h.signIn("a@x.ma");
    const bad = await h.call("PUT", "/hub/me/password", { token: s1.session, body: { password: "new-password-2" } });
    expect(bad.status).toBe(400);
    expect((await h.call("PUT", "/hub/me/password", { token: s1.session, body: { password: "new-password-2", current: "nope-nope-1" } })).status).toBe(400);
    expect((await h.call("GET", "/hub/me", { token: s1.session })).status).toBe(200);

    const ok = await h.call("PUT", "/hub/me/password", { token: s1.session, body: { password: "new-password-2", current: PW } });
    expect(ok.status).toBe(200);
    expect((await h.call("GET", "/hub/me", { token: s2.session })).status).toBe(401);
    expect((await h.call("GET", "/hub/me", { token: s1.session })).status).toBe(200);
    expect((await loginPw("a@x.ma", PW)).status).toBe(401);
    expect((await loginPw("a@x.ma", "new-password-2")).status).toBe(200);
    const last = h.mails[h.mails.length - 1];
    expect(last.to).toBe("a@x.ma");
    expect(last.subject).toContain("mot de passe a été modifié");
  });

  it("ineligible volunteer or suspended member cannot log in with the right password", { timeout: 20_000 }, async () => {
    const s = await withPassword();
    h.sqlite.prepare("UPDATE t_volunteers SET status = 'registered' WHERE lower(email) = 'a@x.ma'").run();
    expect((await loginPw("a@x.ma", PW)).status).toBe(403);
    h.sqlite.prepare("UPDATE t_volunteers SET status = 'confirmed' WHERE lower(email) = 'a@x.ma'").run();
    h.sqlite.prepare("UPDATE hub_members SET status = 'suspended' WHERE id = ?").run(s.member.id);
    expect((await loginPw("a@x.ma", PW)).status).toBe(403);
  });
});
