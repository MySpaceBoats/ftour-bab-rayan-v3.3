import { beforeEach, describe, expect, it } from "vitest";
import { createHubHarness, type HubHarness } from "./test-hub";
import type { FetchLike } from "./ai-core";

let h: HubHarness;
beforeEach(() => { h = createHubHarness(); });
const toSupport = () => h.mails.filter(m => m.to === "support@ftourbabrayan.ma");

describe("support notifications from the hub", () => {
  it("mails support once when a member signs up in the community space, not on later logins", async () => {
    await h.signIn("nouvelle@x.ma");
    expect(toSupport().map(m => m.subject)).toEqual(["[Ftour] Nouvel inscrit sur la Community Space"]);
    expect(toSupport()[0].html).toContain("nouvelle@x.ma");
    await h.call("POST", "/hub/login", { body: { email: "nouvelle@x.ma" } });
    await h.call("POST", "/hub/verify", { body: { token: h.lastLink("token") } });
    expect(toSupport()).toHaveLength(1);
  });

  it("mails support once per chatbot conversation, at the first message", async () => {
    const a = await h.signIn("a@x.ma");
    h.mails.length = 0;
    const fetchAi: FetchLike = async () => new Response(JSON.stringify({ choices: [{ message: { content: "Bonjour" } }] }));
    h.aiFetch = fetchAi;
    const first = (await (await h.call("POST", "/hub/ai/chat", { token: a.session, body: { message: "Salut" } })).json()) as { conversation_id: number };
    const subjects = () => toSupport().map(m => m.subject).filter(s => /chatbot/i.test(s));
    expect(subjects()).toHaveLength(1);
    await h.call("POST", "/hub/ai/chat", { token: a.session, body: { message: "Encore", conversation_id: first.conversation_id } });
    expect(subjects()).toHaveLength(1);
  });
});
