import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { handleHubRequest } from "./hub";
import { createHubHarness, type HubHarness } from "./test-hub";

let h: HubHarness;

beforeEach(() => {
  h = createHubHarness();
  h.sqlite.exec(readFileSync(new URL("./d1/meetup.sql", import.meta.url).pathname, "utf8"));
});

const meetup = (over: Record<string, unknown> = {}) => ({
  title: "Sortie plage", category: "sortie", description: "Balade et thé à la menthe sur la plage.",
  country: "Maroc", city: "Casablanca", place: "Corniche Ain Diab",
  startsAt: "2026-10-20T19:00", endsAt: "2026-10-20T22:00", capacity: 10, ...over,
});

describe("meetup http", () => {
  it("ignores non-hub paths; unknown meetup path is 404; auth required", async () => {
    const env = h.env;
    expect(await handleHubRequest(new Request("https://w.test/api/trpc"), env, {}, { now: () => h.clock })).toBeNull();
    expect((await h.call("GET", "/hub/meetup/nope")).status).toBe(404);
    expect((await h.call("GET", "/hub/meetup/meetups")).status).toBe(401);
  });

  it("tracer: an organizer creates a meetup, another member sees it in the list", async () => {
    const org = await h.signIn("org@x.ma");
    const other = await h.signIn("other@x.ma");

    const up = await (await h.call("POST", "/hub/media", { token: org.session, body: { contentType: "image/jpeg" } })).json() as { path: string };
    const created = await h.call("POST", "/hub/meetup/meetups", { token: org.session, body: meetup({ photo: up.path }) });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };
    expect(id).toBeGreaterThan(0);

    const res = await h.call("GET", "/hub/meetup/meetups", { token: other.session });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { meetups: any[]; nextCursor: string | null };
    expect(body.nextCursor).toBeNull();
    expect(body.meetups).toHaveLength(1);
    expect(body.meetups[0]).toMatchObject({
      id, title: "Sortie plage", category: "sortie", country: "Maroc", city: "Casablanca", place: "Corniche Ain Diab",
      starts_at: "2026-10-20T19:00", ends_at: "2026-10-20T22:00", capacity: 10,
      going_count: 0, waitlist_count: 0, status: "active", ended: false, my_status: null,
      organizer: { display_name: "Amina B." },
    });
    expect(body.meetups[0].photo).toContain(`https://m.test/media-signed/private/hub/${up.path}?exp=`);
    expect(body.meetups[0].photo_key).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("@x.ma");
  });

  it("rejects invalid payloads with 400 invalid and a French message", async () => {
    const org = await h.signIn("org@x.ma");
    const other = await h.signIn("other@x.ma");
    const cases: Record<string, unknown>[] = [
      { title: "   " },
      { category: "fete" },
      { startsAt: "2026-10-20T19:00", endsAt: "2026-10-20T18:00" },
      { capacity: 0 },
      { photo: `${other.member.id}/x.jpg` },
    ];
    for (const over of cases) {
      const r = await h.call("POST", "/hub/meetup/meetups", { token: org.session, body: meetup(over) });
      expect(r.status).toBe(400);
      const b = (await r.json()) as { error: string; message: string };
      expect(b.error).toBe("invalid");
      expect(b.message).toMatch(/requis|invalide|doit|passé/);
    }
    const missing = await h.call("POST", "/hub/meetup/meetups", { token: org.session, body: {} });
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { message: string }).message).toMatch(/requis|invalide/);
  });
});
