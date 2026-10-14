import { describe, expect, it } from "vitest";
import { notifySupport, SUPPORT_NOTIFY_DEFAULT } from "./support-notify";

const env = { RESEND_API_KEY: "k" };
const mk = () => {
  const sent: any[] = [];
  return { sent, send: (async (o: any) => { sent.push(o); return { success: true }; }) as any };
};

describe("notifySupport", () => {
  it("sends to the default support address with the event title and lines", async () => {
    const { sent, send } = mk();
    await notifySupport(env, { kind: "don", title: "Nouveau don", lines: [["Montant", "100 MAD"], ["Email", "a@x.ma"]] }, send);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(SUPPORT_NOTIFY_DEFAULT);
    expect(sent[0].subject).toBe("[Ftour] Nouveau don");
    expect(sent[0].html).toContain("100 MAD");
    expect(sent[0].apiKey).toBe("k");
  });
  it("honours SUPPORT_NOTIFY_EMAIL", async () => {
    const { sent, send } = mk();
    await notifySupport({ ...env, SUPPORT_NOTIFY_EMAIL: "ops@x.ma" }, { kind: "k", title: "t", lines: [] }, send);
    expect(sent[0].to).toBe("ops@x.ma");
  });
  it("escapes visitor-supplied values", async () => {
    const { sent, send } = mk();
    await notifySupport(env, { kind: "k", title: "t", lines: [["Nom", "<script>alert(1)</script>"]] }, send);
    expect(sent[0].html).not.toContain("<script>");
    expect(sent[0].html).toContain("&lt;script&gt;");
  });
  it("never throws when the mail provider fails", async () => {
    await expect(notifySupport(env, { kind: "k", title: "t", lines: [] }, (async () => { throw new Error("down"); }) as any)).resolves.toBeUndefined();
  });
});
