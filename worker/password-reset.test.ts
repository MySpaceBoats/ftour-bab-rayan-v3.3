import { describe, expect, it, vi } from "vitest";
import { completePasswordReset, requestPasswordReset } from "./password-reset";

const env = { PUBLIC_APP_URL: "https://site.test", RESEND_API_KEY: "k" };

function fakeSupabase(over: { link?: any; verify?: any; update?: any } = {}) {
  const generateLink = vi.fn().mockResolvedValue(over.link ?? { data: { properties: { hashed_token: "HASH" } }, error: null });
  const verifyOtp = vi.fn().mockResolvedValue(over.verify ?? { data: { user: { id: "u1" } }, error: null });
  const updateUserById = vi.fn().mockResolvedValue(over.update ?? { data: {}, error: null });
  return { sb: { auth: { verifyOtp, admin: { generateLink, updateUserById } } } as any, generateLink, verifyOtp, updateUserById };
}

describe("requestPasswordReset", () => {
  it("mails a link carrying the recovery token hash, in the requested language", async () => {
    const { sb, generateLink } = fakeSupabase();
    const send = vi.fn().mockResolvedValue({ success: true });
    await requestPasswordReset(sb, env, "a@b.ma", "en", send);
    expect(generateLink).toHaveBeenCalledWith({ type: "recovery", email: "a@b.ma" });
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe("a@b.ma");
    expect(mail.apiKey).toBe("k");
    expect(mail.html).toContain("https://site.test/en/reinitialiser-mot-de-passe?token_hash=HASH");
  });
  it("falls back to fr for an unknown language", async () => {
    const { sb } = fakeSupabase();
    const send = vi.fn().mockResolvedValue({ success: true });
    await requestPasswordReset(sb, env, "a@b.ma", "xx", send);
    expect(send.mock.calls[0][0].html).toContain("/fr/reinitialiser-mot-de-passe?");
  });
  it("sends nothing and does not throw for an unknown address (no account enumeration)", async () => {
    const { sb } = fakeSupabase({ link: { data: null, error: { message: "User not found" } } });
    const send = vi.fn();
    await expect(requestPasswordReset(sb, env, "x@b.ma", "fr", send)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
  it("does not throw when the mail provider fails", async () => {
    const { sb } = fakeSupabase();
    const send = vi.fn().mockRejectedValue(new Error("down"));
    await expect(requestPasswordReset(sb, env, "a@b.ma", "fr", send)).resolves.toBeUndefined();
  });
});

describe("completePasswordReset", () => {
  it("verifies the token then sets the password", async () => {
    const { sb, verifyOtp, updateUserById } = fakeSupabase();
    await completePasswordReset(sb, "HASH", "NewPass#1");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "HASH", type: "recovery" });
    expect(updateUserById).toHaveBeenCalledWith("u1", { password: "NewPass#1" });
  });
  it("rejects an invalid or expired token without touching the password", async () => {
    const { sb, updateUserById } = fakeSupabase({ verify: { data: { user: null }, error: { message: "expired" } } });
    await expect(completePasswordReset(sb, "BAD", "NewPass#1")).rejects.toThrow(/invalide ou expiré/);
    expect(updateUserById).not.toHaveBeenCalled();
  });
  it("surfaces a password update failure", async () => {
    const { sb } = fakeSupabase({ update: { data: null, error: { message: "Password too weak" } } });
    await expect(completePasswordReset(sb, "HASH", "x")).rejects.toThrow(/Password too weak/);
  });
});
