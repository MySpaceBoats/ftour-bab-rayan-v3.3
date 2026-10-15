import { beforeEach, describe, expect, it } from "vitest";
import { notifyModeration, notifyRestored, systemMessage, type NotifyDeps } from "./moderation-notify";
import type { ModerationEvent } from "./moderation";
import type { Mailer } from "./hub-notify";
import * as X from "./messenger-d1";
import * as P from "./pro-d1";
import { teamMemberId } from "./hub-d1";
import { createHubHarness, type HubHarness } from "./test-hub";

let h: HubHarness;
beforeEach(() => { h = createHubHarness(); });

const mk = (fail = false): NotifyDeps => ({
  adminEmail: "admin@x.ma",
  mailer: { baseUrl: "https://site.test", sendBatch: async m => { if (fail) throw new Error("resend down"); h.batches.push(m); } } as Mailer,
});
const event = (memberId: number, action: "hidden" | "flagged" = "hidden"): ModerationEvent => ({
  id: 1, type: "post", targetId: 7, memberId, rule: "R1", reason: "insulte", confidence: 0.95, excerpt: "contenu fautif", action,
});
async function world() {
  const author = await h.signIn("auteur@x.ma");
  const mod = await h.signIn("mod@x.ma");
  h.sqlite.prepare("UPDATE hub_members SET role = 'moderator' WHERE id = ?").run(mod.member.id);
  return { author, mod };
}
const bell = async (token: string) => ((await (await h.call("GET", "/hub/notifications", { token })).json()) as any).notifications as any[];
const subjects = () => h.batches.flat().map(m => ({ to: m.to, subject: m.subject }));

describe("notifyModeration", () => {
  it("hidden: author gets bell + mail + messenger thread; moderator and admin address get theirs", async () => {
    const { author, mod } = await world();
    await notifyModeration(h.d, mk(), event(author.member.id), h.clock);

    expect((await bell(author.session))[0]).toMatchObject({ type: "announcement", title: "Votre publication a été masquée" });
    expect((await bell(mod.session))[0].title).toContain("Modération IA");
    const mails = subjects();
    expect(mails.some(m => m.to === "auteur@x.ma")).toBe(true);
    expect(mails.some(m => m.to === "mod@x.ma")).toBe(true);
    expect(mails.some(m => m.to === "admin@x.ma")).toBe(true);

    const inbox = await X.inbox(h.d, author.member.id);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].other.display_name).toBe("Équipe Ftour");
    expect(inbox[0].last_body).toContain("R1");
    expect(inbox[0].unread).toBe(1);
    expect(await X.unreadAll(h.d, author.member.id)).toBe(1);
    expect((await X.inbox(h.d, mod.member.id))).toHaveLength(1);
  });

  it("flagged: only moderators and the admin address are told, never the author", async () => {
    const { author, mod } = await world();
    await notifyModeration(h.d, mk(), event(author.member.id, "flagged"), h.clock);
    expect(await bell(author.session)).toHaveLength(0);
    expect(await X.inbox(h.d, author.member.id)).toHaveLength(0);
    expect((await bell(mod.session))).toHaveLength(1);
    expect(subjects().some(m => m.to === "admin@x.ma")).toBe(true);
    expect(subjects().some(m => m.to === "auteur@x.ma")).toBe(false);
  });

  it("a failing mail channel does not stop bell and messenger", async () => {
    const { author } = await world();
    await notifyModeration(h.d, mk(true), event(author.member.id), h.clock);
    expect(await bell(author.session)).toHaveLength(1);
    expect(await X.inbox(h.d, author.member.id)).toHaveLength(1);
  });

  it("the Équipe thread is read-only: a member can neither open one nor reply in it", async () => {
    const { author } = await world();
    await notifyModeration(h.d, mk(), event(author.member.id), h.clock);
    const team = await teamMemberId(h.d);
    const me = h.sqlite.prepare("SELECT * FROM hub_members WHERE id = ?").get(author.member.id) as any;
    await expect(P.openThread(h.d, me, { to: team }, h.clock)).rejects.toMatchObject({ code: "not_found" });
    const threadId = (await X.inbox(h.d, author.member.id))[0].id;
    await expect(P.sendMessage(h.d, me, threadId, "Je conteste", h.clock)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("notifyRestored", () => {
  it("tells the author the content is back", async () => {
    const { author } = await world();
    await notifyRestored(h.d, mk(), { id: 1, type: "post", memberId: author.member.id, excerpt: "ok" }, h.clock);
    expect((await bell(author.session))[0].title).toBe("Votre publication a été rétablie");
    expect((await X.inbox(h.d, author.member.id))[0].last_body).toContain("rétablie");
  });
});

describe("systemMessage", () => {
  it("reuses one thread per member and appends messages", async () => {
    const { author } = await world();
    const team = await teamMemberId(h.d);
    await systemMessage(h.d, team, author.member.id, "un", h.clock);
    await systemMessage(h.d, team, author.member.id, "deux", h.clock + 1000);
    expect(h.sqlite.prepare("SELECT COUNT(*) AS n FROM pro_threads").get()).toEqual({ n: 1 });
    expect(h.sqlite.prepare("SELECT COUNT(*) AS n FROM pro_messages").get()).toEqual({ n: 2 });
  });
});

describe("I6: lookups failing", () => {
  it("a failing Équipe lookup still lets bell and admin mail through", async () => {
    const { author } = await world();
    const broken = { ...h.d, prepare: (sql: string) => { if (sql.includes("INSERT INTO hub_members")) throw new Error("d1 down"); return h.d.prepare(sql); } };
    await notifyModeration(broken as any, mk(), event(author.member.id), h.clock);
    expect(await bell(author.session)).toHaveLength(1);
    expect(subjects().some(m => m.to === "admin@x.ma")).toBe(true);
  });
});

