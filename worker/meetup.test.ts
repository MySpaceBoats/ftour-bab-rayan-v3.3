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

const who = (email: string, first: string) => {
  h.sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,'confirmed')").run(first, "Benali", email);
  return h.signIn(email);
};
const get = async <T>(path: string, token: string, admin?: string) => (await h.call("GET", path, { token, admin })).json() as Promise<T>;
const bad = async (method: string, path: string, o: Parameters<typeof h.call>[2], status: number, error: string) => {
  const r = await h.call(method, path, o);
  expect(r.status, `${method} ${path}`).toBe(status);
  expect(((await r.json()) as { error?: string }).error).toBe(error);
};

describe("meetup http journey", () => {
  it("creates, joins with a waiting list, promotes on leave, edits and cancels", async () => {
    const org = await who("org@x.ma", "Olivia");
    const a = await who("a@x.ma", "Alice");
    const b = await who("b@x.ma", "Bob");
    const { id } = (await (await h.call("POST", "/hub/meetup/meetups", { token: org.session, body: meetup({ capacity: 1 }) })).json()) as { id: number };

    // organizer cannot join; a goes, b waits
    await bad("POST", `/hub/meetup/meetups/${id}/join`, { token: org.session }, 400, "invalid");
    expect(await (await h.call("POST", `/hub/meetup/meetups/${id}/join`, { token: a.session })).json()).toEqual({ status: "going" });
    expect(await (await h.call("POST", `/hub/meetup/meetups/${id}/join`, { token: b.session })).json()).toEqual({ status: "waitlist" });
    await bad("POST", `/hub/meetup/meetups/${id}/join`, { token: b.session }, 400, "invalid");

    // the organizer sees the waiting name, a plain member does not
    const asOrg = await get<{ meetup: any }>(`/hub/meetup/meetups/${id}`, org.session);
    expect(asOrg.meetup).toMatchObject({ mine: true, spots_left: 0, going_count: 1, waitlist_count: 1, organizer: { display_name: "Olivia B." } });
    expect(asOrg.meetup.waitlist.map((p: any) => p.display_name)).toEqual(["Bob B."]);
    const asB = await get<{ meetup: any }>(`/hub/meetup/meetups/${id}`, b.session);
    expect(asB.meetup).toMatchObject({ mine: false, my_status: "waitlist", waitlist: [], waitlist_count: 1 });
    expect(asB.meetup.participants.map((p: any) => p.display_name)).toEqual(["Alice B."]);
    expect(asB.meetup.photo_key).toBeUndefined();
    expect(JSON.stringify([asOrg, asB])).not.toContain("@x.ma");

    // Mes meetups
    expect((await get<{ meetups: any[] }>("/hub/meetup/mine", org.session)).meetups.map(x => x.id)).toEqual([id]);
    const joined = await get<{ meetups: any[] }>("/hub/meetup/mine?role=joined", b.session);
    expect(joined.meetups[0]).toMatchObject({ id, my_status: "waitlist" });

    // a leaves: b is promoted
    expect(await (await h.call("POST", `/hub/meetup/meetups/${id}/leave`, { token: a.session })).json()).toEqual({ ok: true });
    expect((await get<{ meetup: any }>(`/hub/meetup/meetups/${id}`, b.session)).meetup).toMatchObject({ my_status: "going", waitlist_count: 0 });
    await bad("POST", `/hub/meetup/meetups/${id}/leave`, { token: a.session }, 404, "not_found");

    // edit by the organizer only; raising the capacity keeps b going
    await bad("PUT", `/hub/meetup/meetups/${id}`, { token: a.session, body: meetup() }, 403, "forbidden");
    await bad("PUT", `/hub/meetup/meetups/${id}`, { token: org.session, body: meetup({ capacity: 0 }) }, 400, "invalid");
    expect((await h.call("PUT", `/hub/meetup/meetups/${id}`, { token: org.session, body: meetup({ title: "Renommé", capacity: 3 }) })).status).toBe(200);
    expect((await get<{ meetup: any }>(`/hub/meetup/meetups/${id}`, a.session)).meetup).toMatchObject({ title: "Renommé", capacity: 3, spots_left: 2 });

    // cancel: owner only, once; joining is refused afterwards
    await bad("POST", `/hub/meetup/meetups/${id}/cancel`, { token: a.session }, 403, "forbidden");
    expect((await h.call("POST", `/hub/meetup/meetups/${id}/cancel`, { token: org.session })).status).toBe(200);
    await bad("POST", `/hub/meetup/meetups/${id}/cancel`, { token: org.session }, 400, "invalid");
    await bad("POST", `/hub/meetup/meetups/${id}/join`, { token: a.session }, 400, "invalid");
    expect((await get<{ meetup: any }>(`/hub/meetup/meetups/${id}`, a.session)).meetup.status).toBe("cancelled");
    expect((await get<{ meetups: any[] }>("/hub/meetup/meetups", a.session)).meetups).toEqual([]);
  });

  it("serves the owner's photo key only to the owner, filters and places", async () => {
    const org = await who("org@x.ma", "Olivia");
    const v = await who("v@x.ma", "Victor");
    const up = (await (await h.call("POST", "/hub/media", { token: org.session, body: { contentType: "image/jpeg" } })).json()) as { path: string };
    const { id } = (await (await h.call("POST", "/hub/meetup/meetups", { token: org.session, body: meetup({ photo: up.path }) })).json()) as { id: number };
    await h.call("POST", "/hub/meetup/meetups", { token: org.session, body: meetup({ country: "France", city: "Lyon", category: "evenement", startsAt: "2026-11-05T18:00", endsAt: "2026-11-05T20:00" }) });

    expect((await get<{ meetup: any }>(`/hub/meetup/meetups/${id}`, org.session)).meetup.photo_key).toBe(up.path);
    const asV = (await get<{ meetup: any }>(`/hub/meetup/meetups/${id}`, v.session)).meetup;
    expect(asV.photo_key).toBeUndefined();
    expect(asV.photo).toContain(`https://m.test/media-signed/private/hub/${up.path}?exp=`);

    expect(await get("/hub/meetup/places", v.session)).toEqual({ countries: [{ country: "France", cities: ["Lyon"] }, { country: "Maroc", cities: ["Casablanca"] }] });
    const titles = async (qs: string) => (await get<{ meetups: any[] }>(`/hub/meetup/meetups${qs}`, v.session)).meetups.map(x => x.country);
    expect(await titles("?country=france")).toEqual(["France"]);
    expect(await titles("?city=CASABLANCA&category=sortie")).toEqual(["Maroc"]);
    expect(await titles("?from=2026-11-01")).toEqual(["France"]);
    expect(await titles("?to=2026-10-31")).toEqual(["Maroc"]);
    await bad("GET", "/hub/meetup/places", {}, 401, "unauthorized");
  });

  it("maps every domain error to its HTTP status", async () => {
    const org = await who("org@x.ma", "Olivia");
    const v = await who("v@x.ma", "Victor");
    const { id } = (await (await h.call("POST", "/hub/meetup/meetups", { token: org.session, body: meetup() })).json()) as { id: number };
    await bad("POST", "/hub/meetup/meetups", { token: org.session, body: "{nope" as any }, 400, "invalid");
    await bad("GET", "/hub/meetup/meetups?category=fete", { token: v.session }, 400, "invalid");
    await bad("GET", "/hub/meetup/meetups?from=2026-11-10&to=2026-11-01", { token: v.session }, 400, "invalid");
    await bad("GET", "/hub/meetup/meetups?cursor=garbage", { token: v.session }, 400, "invalid");
    await bad("GET", "/hub/meetup/mine?role=all", { token: v.session }, 400, "invalid");
    await bad("GET", "/hub/meetup/meetups/9999", { token: v.session }, 404, "not_found");
    await bad("GET", "/hub/meetup/meetups/nope", { token: v.session }, 404, "not_found");
    await bad("POST", "/hub/meetup/meetups/9999/join", { token: v.session }, 404, "not_found");
    await bad("PUT", `/hub/meetup/meetups/${id}`, { token: v.session, body: meetup() }, 403, "forbidden");
    // 6th creation within a day
    for (let i = 0; i < 4; i++) await h.call("POST", "/hub/meetup/meetups", { token: org.session, body: meetup() });
    await bad("POST", "/hub/meetup/meetups", { token: org.session, body: meetup() }, 429, "rate_limited");
  });

  it("restricts the admin surface to admin roles and lets them hide then delete", async () => {
    const org = await who("org@x.ma", "Olivia");
    const v = await who("v@x.ma", "Victor");
    const { id } = (await (await h.call("POST", "/hub/meetup/meetups", { token: org.session, body: meetup() })).json()) as { id: number };
    await h.call("POST", `/hub/meetup/meetups/${id}/join`, { token: v.session });

    for (const [method, path, body] of [["GET", "/hub/meetup/admin/meetups", undefined], ["POST", "/hub/meetup/admin/hide", { id }], ["POST", "/hub/meetup/admin/delete", { id }]] as const) {
      for (const admin of [undefined, "member", "user"]) {
        expect((await h.call(method, path, { token: v.session, admin, body })).status, `${method} ${path} ${admin}`).toBe(403);
      }
    }
    const list = await get<{ meetups: any[] }>("/hub/meetup/admin/meetups", v.session, "admin_ops");
    expect(list.meetups[0]).toMatchObject({ id, title: "Sortie plage", organizer: "Olivia B.", going_count: 1, status: "active" });
    expect(JSON.stringify(list)).not.toContain("@x.ma");

    expect((await h.call("POST", "/hub/meetup/admin/hide", { token: v.session, admin: "admin", body: { id } })).status).toBe(200);
    expect((await get<{ meetups: any[] }>("/hub/meetup/meetups", v.session)).meetups).toEqual([]);
    await bad("GET", `/hub/meetup/meetups/${id}`, { token: v.session }, 404, "not_found");
    expect((await get<{ meetups: any[] }>("/hub/meetup/admin/meetups", v.session, "super_admin")).meetups[0].status).toBe("hidden");

    expect((await h.call("POST", "/hub/meetup/admin/delete", { token: v.session, admin: "admin", body: { id } })).status).toBe(200);
    expect((await get<{ meetups: any[] }>("/hub/meetup/admin/meetups", v.session, "admin")).meetups).toEqual([]);
    expect((h.sqlite.prepare("SELECT COUNT(*) AS n FROM mt_participants").get() as { n: number }).n).toBe(0);
    await bad("POST", "/hub/meetup/admin/delete", { token: v.session, admin: "admin", body: { id } }, 404, "not_found");
    await bad("POST", "/hub/meetup/admin/hide", { token: v.session, admin: "admin", body: {} }, 400, "invalid");
  });
});
