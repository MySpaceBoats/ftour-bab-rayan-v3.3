import { describe, expect, it, vi } from "vitest";
import { ensureAccount, ensureVolunteerAccount } from "./auto-account";

const env = { PUBLIC_APP_URL: "https://site.test", RESEND_API_KEY: "k" };
const vol = { firstName: "Amina", lastName: "Benali", email: "Amina@X.ma ", phone: "0600000000" };

function fakeSb(o: { existingUser?: boolean; createError?: string; insertError?: string } = {}) {
  const createUser = vi.fn().mockResolvedValue(o.createError ? { data: { user: null }, error: { message: o.createError } } : { data: { user: { id: "u1" } }, error: null });
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  const generateLink = vi.fn().mockResolvedValue({ data: { properties: { hashed_token: "HASH" } }, error: null });
  const insert = vi.fn().mockResolvedValue({ error: o.insertError ? { message: o.insertError } : null });
  const ilike = vi.fn().mockReturnValue({ maybeSingle: async () => ({ data: o.existingUser ? { id: 1 } : null }) });
  const from = vi.fn().mockReturnValue({ select: () => ({ ilike }), insert });
  return { sb: { auth: { admin: { createUser, deleteUser, generateLink } }, from } as any, createUser, deleteUser, generateLink, insert };
}

describe("ensureVolunteerAccount", () => {
  it("creates a password-less account and mails a set-password link", async () => {
    const { sb, createUser, insert } = fakeSb();
    const send = vi.fn().mockResolvedValue({ success: true });
    expect(await ensureVolunteerAccount(sb, env, vol, "fr", send)).toBe("created");
    expect(createUser).toHaveBeenCalledWith({ email: "amina@x.ma", email_confirm: true, user_metadata: { name: "Amina Benali", phone: "0600000000" } });
    expect(insert).toHaveBeenCalledWith({ open_id: "u1", email: "amina@x.ma", name: "Amina Benali", phone: "0600000000", role: "user" });
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe("amina@x.ma");
    expect(mail.subject).toMatch(/compte/i);
    expect(mail.html).toContain("https://site.test/fr/reinitialiser-mot-de-passe?token_hash=HASH");
  });
  it("does nothing when the site already has an account for that email", async () => {
    const { sb, createUser } = fakeSb({ existingUser: true });
    const send = vi.fn();
    expect(await ensureVolunteerAccount(sb, env, vol, "fr", send)).toBe("exists");
    expect(createUser).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("treats an email already registered in Auth as existing, without mail", async () => {
    const { sb } = fakeSb({ createError: "A user with this email address has already been registered" });
    const send = vi.fn();
    expect(await ensureVolunteerAccount(sb, env, vol, "fr", send)).toBe("exists");
    expect(send).not.toHaveBeenCalled();
  });
  it("rolls the Auth user back when the profile row cannot be written", async () => {
    const { sb, deleteUser } = fakeSb({ insertError: "boom" });
    const send = vi.fn();
    expect(await ensureVolunteerAccount(sb, env, vol, "fr", send)).toBe("failed");
    expect(deleteUser).toHaveBeenCalledWith("u1");
    expect(send).not.toHaveBeenCalled();
  });
  it("never throws, even when Supabase or the mailer blow up", async () => {
    const { sb } = fakeSb();
    sb.from = () => { throw new Error("db down"); };
    expect(await ensureVolunteerAccount(sb, env, vol, "fr", vi.fn())).toBe("failed");
    const ok = fakeSb();
    const send = vi.fn().mockRejectedValue(new Error("mail down"));
    expect(await ensureVolunteerAccount(ok.sb, env, vol, "fr", send)).toBe("created");
  });
});

describe("ensureAccount (self sign-up by link)", () => {
  it("works without a phone and uses the given mail copy", async () => {
    const { sb, createUser, insert } = fakeSb();
    const send = vi.fn().mockResolvedValue({ success: true });
    const copy = { subject: "Activez votre compte", intro: "Cliquez pour choisir votre mot de passe :" };
    expect(await ensureAccount(sb, env, { firstName: "Amina", lastName: "Benali", email: "a@x.ma" }, "en", send, copy)).toBe("created");
    expect(createUser).toHaveBeenCalledWith({ email: "a@x.ma", email_confirm: true, user_metadata: { name: "Amina Benali", phone: null } });
    expect(insert).toHaveBeenCalledWith({ open_id: "u1", email: "a@x.ma", name: "Amina Benali", phone: null, role: "user" });
    const mail = send.mock.calls[0][0];
    expect(mail.subject).toBe("Activez votre compte");
    expect(mail.html).toContain("/en/reinitialiser-mot-de-passe?token_hash=HASH");
  });
});
