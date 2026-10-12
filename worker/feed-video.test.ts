import { beforeEach, describe, expect, it } from "vitest";
import type { D1Like } from "./gallery-d1";
import { GALLERY_SCHEMA, fakeD1, openDb, type Sqlite } from "./test-d1";
import * as h from "./hub-d1";
import * as pro from "./pro-d1";
import { createHubHarness } from "./test-hub";


const T0 = Date.parse("2026-10-12T12:00:00.000Z");
let sqlite: Sqlite;
let d: D1Like;

async function member(email: string) {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('Amina','Benali',?,'confirmed')").run(email);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  return (await h.getSession(d, session, T0 + 1))!;
}
beforeEach(() => { sqlite = openDb(); sqlite.exec(GALLERY_SCHEMA); d = fakeD1(sqlite); }); // memberPhotos joins gallery_photos

describe("publication media rule (Fil and Pro)", () => {
  it("accepts one video alone, or up to 4 images; refuses every other mix", async () => {
    const a = await member("a@x.ma");
    const v = (n: number) => `${a.id}/v${n}.mp4`;
    const i = (n: number) => `${a.id}/i${n}.jpg`;
    for (const create of [
      (media: string[], at: number) => h.createPost(d, a, { body: "x", mediaPaths: media }, T0 + at),
      (media: string[], at: number) => pro.createPost(d, a, { body: "x", mediaPaths: media }, T0 + at),
    ]) {
      await expect(create([v(1)], 1)).resolves.toBeTruthy();
      await expect(create([i(1), i(2), i(3), i(4)], 2)).resolves.toBeTruthy();
      await expect(create([v(1), v(2)], 3)).rejects.toMatchObject({ code: "invalid" });
      await expect(create([v(1), i(1)], 4)).rejects.toMatchObject({ code: "invalid" });
      await expect(create([i(1), v(1)], 5)).rejects.toMatchObject({ code: "invalid" });
      await expect(create([i(1), i(2), i(3), i(4), i(5)], 6)).rejects.toMatchObject({ code: "invalid" });
    }
  });
  it("refuses a video path that belongs to another member or climbs out", async () => {
    const a = await member("a@x.ma"), b = await member("b@x.ma");
    await expect(h.createPost(d, a, { body: "x", mediaPaths: [`${b.id}/v.mp4`] }, T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.createPost(d, a, { body: "x", mediaPaths: [`${a.id}/../v.mp4`] }, T0)).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("videos stay out of photos and gallery", () => {
  it("memberPhotos lists images only, and a video cannot be proposed to the gallery", async () => {
    const a = await member("a@x.ma");
    await h.createPost(d, a, { body: "photo", mediaPaths: [`${a.id}/p.jpg`] }, T0);
    await h.createPost(d, a, { body: "film", mediaPaths: [`${a.id}/f.mp4`] }, T0 + 1);
    expect((await h.memberPhotos(d, a.id)).map(p => p.path)).toEqual([`${a.id}/p.jpg`]);
    await expect(h.proposeToGallery(d, a, `${a.id}/f.mp4`, T0 + 2, async () => "g1")).rejects.toMatchObject({ code: "invalid" });
  });
});


describe("hub routes", () => {
  it("signs a video upload, publishes it alone in the Fil and the Pro feed, and serves a signed URL", async () => {
    const h = createHubHarness();
    const a = await h.signIn("a@x.ma");
    const up = await h.call("POST", "/hub/media", { token: a.session, body: { contentType: "video/mp4" } });
    expect(up.status).toBe(200);
    const { path, uploadUrl } = (await up.json()) as { path: string; uploadUrl: string };
    expect(path).toMatch(new RegExp(`^${a.member.id}/[0-9a-f-]{36}\\.mp4$`));
    expect(uploadUrl).toContain(`/media-upload/private/hub/${path}?exp=`);
    expect((await h.call("POST", "/hub/media", { token: a.session, body: { contentType: "video/x-msvideo" } })).status).toBe(400);

    expect((await h.call("POST", "/hub/posts", { token: a.session, body: { body: "film", media: [path] } })).status).toBe(200);
    expect((await h.call("POST", "/hub/pro/posts", { token: a.session, body: { body: "film pro", media: [path] } })).status).toBe(200);
    const img = ((await (await h.call("POST", "/hub/media", { token: a.session, body: { contentType: "image/jpeg" } })).json()) as { path: string }).path;
    expect((await h.call("POST", "/hub/posts", { token: a.session, body: { body: "mix", media: [path, img] } })).status).toBe(400);

    const feed = (await (await h.call("GET", "/hub/feed", { token: a.session })).json()) as { posts: { media: string[] }[] };
    expect(feed.posts[0].media[0]).toMatch(/\.mp4\?exp=/);
    const proFeed = (await (await h.call("GET", "/hub/pro/feed", { token: a.session })).json()) as { posts: { media: string[] }[] };
    expect(proFeed.posts[0].media[0]).toMatch(/\.mp4\?exp=/);
  });
});
