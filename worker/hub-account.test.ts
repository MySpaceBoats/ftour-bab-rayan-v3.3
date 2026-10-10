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
    expect(await before.json()).toEqual({ has_password: false, recovery_email: null, recovery_pending: null });
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

const HOUR = 60 * MIN;
const json = async (r: Response) => (await r.json()) as any;
const sec = async (token: string) => json(await h.call("GET", "/hub/me/security", { token }));

/** Signs A in and verifies `rec` as A's recovery address. */
async function withRecovery(email = "a@x.ma", rec = "rec-a@y.ma") {
  const s = await h.signIn(email);
  expect((await h.call("PUT", "/hub/me/recovery", { token: s.session, body: { email: rec } })).status).toBe(200);
  expect((await h.call("POST", "/hub/recovery/verify", { body: { token: h.lastLink("recovery") } })).status).toBe(200);
  return s;
}

describe("recovery address (D-02)", () => {
  it("must differ from the primary email; verification link goes to the new address; pending until clicked", async () => {
    const s = await h.signIn("a@x.ma");
    expect((await h.call("PUT", "/hub/me/recovery", { token: s.session, body: { email: "A@X.ma" } })).status).toBe(400);
    const r = await h.call("PUT", "/hub/me/recovery", { token: s.session, body: { email: "rec-a@y.ma" } });
    expect(r.status).toBe(200);
    expect(await json(r)).toEqual({ ok: true, pending: "rec-a@y.ma" });
    const mail = h.mails[h.mails.length - 1];
    expect(mail.to).toBe("rec-a@y.ma");
    expect(mail.html).toMatch(/\?recovery=[a-f0-9]{64}/);
    expect(await sec(s.session)).toMatchObject({ recovery_pending: "rec-a@y.ma", recovery_email: null });
  });

  it("verifying activates it, notifies the primary, is single-use and expires after 24 h", async () => {
    const s = await h.signIn("a@x.ma");
    await h.call("PUT", "/hub/me/recovery", { token: s.session, body: { email: "rec-a@y.ma" } });
    const token = h.lastLink("recovery");
    expect((await h.call("POST", "/hub/recovery/verify", { body: { token } })).status).toBe(200);
    expect(await sec(s.session)).toMatchObject({ recovery_email: "rec-a@y.ma", recovery_pending: null });
    const notice = h.mails[h.mails.length - 1];
    expect(notice.to).toBe("a@x.ma");
    expect(notice.html).toContain("rec-a@y.ma");
    expect((await h.call("POST", "/hub/recovery/verify", { body: { token } })).status).toBe(400);

    await h.call("PUT", "/hub/me/recovery", { token: s.session, body: { email: "other@y.ma" } });
    const late = h.lastLink("recovery");
    h.clock += 25 * HOUR;
    expect((await h.call("POST", "/hub/recovery/verify", { body: { token: late } })).status).toBe(400);
  });

  it("caps recovery requests at 3 per hour and can be removed", async () => {
    const s = await h.signIn("a@x.ma");
    for (const e of ["r1@y.ma", "r2@y.ma", "r3@y.ma"]) expect((await h.call("PUT", "/hub/me/recovery", { token: s.session, body: { email: e } })).status).toBe(200);
    expect((await h.call("PUT", "/hub/me/recovery", { token: s.session, body: { email: "r4@y.ma" } })).status).toBe(429);
    h.clock += 2 * HOUR;
    await h.call("PUT", "/hub/me/recovery", { token: s.session, body: { email: "r5@y.ma" } });
    await h.call("POST", "/hub/recovery/verify", { body: { token: h.lastLink("recovery") } });
    expect((await sec(s.session)).recovery_email).toBe("r5@y.ma");
    expect((await h.call("DELETE", "/hub/me/recovery", { token: s.session })).status).toBe(200);
    expect((await sec(s.session)).recovery_email).toBeNull();
  });

  it("an address already verified by, or the primary of, another member is refused", async () => {
    await withRecovery("a@x.ma", "shared@y.ma");
    const b = await h.signIn("b@x.ma");
    await h.call("PUT", "/hub/me/recovery", { token: b.session, body: { email: "shared@y.ma" } });
    expect((await h.call("POST", "/hub/recovery/verify", { body: { token: h.lastLink("recovery") } })).status).toBe(400);
    await h.call("PUT", "/hub/me/recovery", { token: b.session, body: { email: "a@x.ma" } });
    expect((await h.call("POST", "/hub/recovery/verify", { body: { token: h.lastLink("recovery") } })).status).toBe(400);
  });
});

describe("rescue magic link", () => {
  it("a verified recovery address receives a login link that opens the owner's session", async () => {
    const a = await withRecovery("a@x.ma", "rec-a@y.ma");
    const n = h.mails.length;
    const r = await h.call("POST", "/hub/login", { body: { email: "rec-a@y.ma" } });
    expect(await json(r)).toEqual({ ok: true });
    expect(h.mails).toHaveLength(n + 1);
    expect(h.mails[n].to).toBe("rec-a@y.ma");
    const v = await json(await h.call("POST", "/hub/verify", { body: { token: h.lastLink("token") } }));
    expect(v.member.id).toBe(a.member.id);
  });

  it("no mail for a pending recovery address or when the owner is no longer eligible; same body always", async () => {
    const s = await h.signIn("a@x.ma");
    await h.call("PUT", "/hub/me/recovery", { token: s.session, body: { email: "rec-a@y.ma" } });
    let n = h.mails.length;
    expect(await json(await h.call("POST", "/hub/login", { body: { email: "rec-a@y.ma" } }))).toEqual({ ok: true });
    expect(h.mails).toHaveLength(n);
    await h.call("POST", "/hub/recovery/verify", { body: { token: h.lastLink("recovery") } });
    h.sqlite.prepare("UPDATE t_volunteers SET status = 'registered' WHERE lower(email) = 'a@x.ma'").run();
    n = h.mails.length;
    expect(await json(await h.call("POST", "/hub/login", { body: { email: "rec-a@y.ma" } }))).toEqual({ ok: true });
    expect(h.mails).toHaveLength(n);
  });
});

describe("forgot + reset password", () => {
  it("unknown or ineligible address: same 200, no mail", async () => {
    h.vol("new@x.ma", "registered");
    const bodies: string[] = [];
    for (const email of ["nobody@x.ma", "new@x.ma"]) {
      const r = await h.call("POST", "/hub/password/forgot", { body: { email } });
      expect(r.status).toBe(200);
      bodies.push(await r.text());
    }
    expect(h.mails).toHaveLength(0);
    await h.signIn("a@x.ma");
    const n = h.mails.length;
    const ok = await h.call("POST", "/hub/password/forgot", { body: { email: "a@x.ma" } });
    expect(bodies[0]).toBe(await ok.text());
    expect(h.mails).toHaveLength(n + 1);
  });

  it("sends the reset link to the primary or to the verified recovery address; 4th request in 1 h is silent", async () => {
    await withRecovery("a@x.ma", "rec-a@y.ma");
    let n = h.mails.length;
    await h.call("POST", "/hub/password/forgot", { body: { email: "a@x.ma" } });
    expect(h.mails[n].to).toBe("a@x.ma");
    expect(h.mails[n].html).toMatch(/\?reset=[a-f0-9]{64}/);
    n = h.mails.length;
    await h.call("POST", "/hub/password/forgot", { body: { email: "rec-a@y.ma" } });
    expect(h.mails[n].to).toBe("rec-a@y.ma");
    for (let i = 0; i < 2; i++) await h.call("POST", "/hub/password/forgot", { body: { email: "a@x.ma" } });
    n = h.mails.length;
    const r = await h.call("POST", "/hub/password/forgot", { body: { email: "a@x.ma" } });
    expect(r.status).toBe(200);
    expect(await json(r)).toEqual({ ok: true });
    expect(h.mails).toHaveLength(n);
  });

  it("a too-short password is refused without burning the token", { timeout: 20_000 }, async () => {
    await h.signIn("a@x.ma");
    await h.call("POST", "/hub/password/forgot", { body: { email: "a@x.ma" } });
    const token = h.lastLink("reset");
    expect((await h.call("POST", "/hub/password/reset", { body: { token, password: "short" } })).status).toBe(400);
    expect((await h.call("POST", "/hub/password/reset", { body: { token, password: "brand-new-pw-1" } })).status).toBe(200);
  });

  it("reset revokes all sessions and other reset links, is single-use, notifies the primary and sets the new password", { timeout: 30_000 }, async () => {
    const s1 = await withPassword("a@x.ma", PW);
    const s2 = await h.signIn("a@x.ma");
    await h.call("POST", "/hub/password/forgot", { body: { email: "a@x.ma" } });
    const first = h.lastLink("reset");
    await h.call("POST", "/hub/password/forgot", { body: { email: "a@x.ma" } });
    const second = h.lastLink("reset");

    const r = await h.call("POST", "/hub/password/reset", { body: { token: second, password: "brand-new-pw-1" } });
    expect(r.status).toBe(200);
    const body = await json(r);
    expect(body.member.id).toBe(s1.member.id);
    expect((await h.call("GET", "/hub/me", { token: s1.session })).status).toBe(401);
    expect((await h.call("GET", "/hub/me", { token: s2.session })).status).toBe(401);
    expect((await h.call("GET", "/hub/me", { token: body.session })).status).toBe(200);
    expect((await h.call("POST", "/hub/password/reset", { body: { token: first, password: "another-pw-22" } })).status).toBe(400);
    expect((await h.call("POST", "/hub/password/reset", { body: { token: second, password: "another-pw-22" } })).status).toBe(400);
    expect((await loginPw("a@x.ma", PW)).status).toBe(401);
    expect((await loginPw("a@x.ma", "brand-new-pw-1")).status).toBe(200);
    const notice = h.mails.filter(m => m.subject.includes("réinitialisé"));
    expect(notice[notice.length - 1].to).toBe("a@x.ma");
  });

  it("expires after 30 minutes; refuses an ineligible volunteer", { timeout: 20_000 }, async () => {
    await h.signIn("a@x.ma");
    await h.call("POST", "/hub/password/forgot", { body: { email: "a@x.ma" } });
    const token = h.lastLink("reset");
    h.clock += 31 * MIN;
    expect((await h.call("POST", "/hub/password/reset", { body: { token, password: "brand-new-pw-1" } })).status).toBe(400);
    await h.call("POST", "/hub/password/forgot", { body: { email: "a@x.ma" } });
    const t2 = h.lastLink("reset");
    h.sqlite.prepare("UPDATE t_volunteers SET status = 'registered' WHERE lower(email) = 'a@x.ma'").run();
    expect((await h.call("POST", "/hub/password/reset", { body: { token: t2, password: "brand-new-pw-1" } })).status).toBe(403);
  });
});
