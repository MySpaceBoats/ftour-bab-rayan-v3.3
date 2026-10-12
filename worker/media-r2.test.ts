import { beforeEach, describe, expect, it } from "vitest";
import type { R2Like } from "./gallery-d1";
import { createR2Storage, handleMediaRequest, objectKey, signMedia, verifyMedia } from "./media-r2";

function fakeR2() {
  const store = new Map<string, { bytes: Uint8Array; type?: string }>();
  const r2: R2Like = {
    async put(key, value, opts) {
      const bytes = value instanceof ReadableStream ? new Uint8Array(await new Response(value).arrayBuffer()) : new Uint8Array(value as ArrayBuffer);
      store.set(key, { bytes, type: opts?.httpMetadata?.contentType });
      return null;
    },
    async get(key, opts) {
      const o = store.get(key);
      if (!o) return null;
      const r = opts?.range;
      const bytes = r ? o.bytes.slice(r.offset, r.offset + r.length) : o.bytes;
      return { body: new Response(bytes).body!, httpEtag: '"e"', size: o.bytes.length, httpMetadata: { contentType: o.type } };
    },
    async head(key) { const o = store.get(key); return o ? { size: o.bytes.length } : null; },
    async delete(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k); },
  };
  return { r2, store };
}

let env: { GALLERY_MEDIA: R2Like; JWT_SECRET: string; MEDIA_BASE_URL: string };
let store: Map<string, any>;
beforeEach(() => {
  const f = fakeR2();
  store = f.store;
  env = { GALLERY_MEDIA: f.r2, JWT_SECRET: "s3cret", MEDIA_BASE_URL: "https://site.test/" };
});
const req = (path: string, init?: RequestInit) => new Request(`https://site.test${path}`, init);
const T = 1_800_000_000_000;

describe("media-r2", () => {
  it("maps buckets to keys: images raw, public prefixed, others private", () => {
    expect(objectKey("images", "team/a.jpg")).toBe("team/a.jpg");
    expect(objectKey("RIB", "x.pdf")).toBe("RIB/x.pdf");
    expect(objectKey("reservation-payment-proofs", "r/1.png")).toBe("private/reservation-payment-proofs/r/1.png");
    expect(() => objectKey("images", "../x")).toThrow();
  });

  it("upload + public URL round-trips through GET /media", async () => {
    const st = createR2Storage(env);
    const up = await st.from("images").upload("goodies/1700000000000-a.jpg", new Uint8Array([1, 2, 3]), { contentType: "image/jpeg" });
    expect(up.error).toBeNull();
    const { publicUrl } = st.from("images").getPublicUrl("goodies/1700000000000-a.jpg").data;
    expect(publicUrl).toBe("https://site.test/media/goodies/1700000000000-a.jpg");
    const res = await handleMediaRequest(req("/media/goodies/1700000000000-a.jpg"), env, {});
    expect(res!.status).toBe(200);
    expect(res!.headers.get("content-type")).toBe("image/jpeg");
    expect(res!.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await res!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("private objects are never served by /media but open with a valid signed URL", async () => {
    const st = createR2Storage(env, () => T);
    await st.from("reservation-payment-proofs").upload("r/1.png", new Uint8Array([9]), { contentType: "image/png" });
    expect((await handleMediaRequest(req("/media/private/reservation-payment-proofs/r/1.png"), env, {}))!.status).toBe(404);
    const { signedUrl } = (await st.from("reservation-payment-proofs").createSignedUrl("r/1.png", 3600)).data!;
    const u = new URL(signedUrl);
    const ok = await handleMediaRequest(req(u.pathname + u.search), env, {}, T + 1000);
    expect(ok!.status).toBe(200);
    expect(ok!.headers.get("cache-control")).toBe("private, no-store");
    const expired = await handleMediaRequest(req(u.pathname + u.search), env, {}, T + 3601 * 1000);
    expect(expired!.status).toBe(403);
    const tampered = await handleMediaRequest(req(u.pathname + "?exp=" + (Number(u.searchParams.get("exp")) + 999) + "&sig=" + u.searchParams.get("sig")), env, {}, T + 1000);
    expect(tampered!.status).toBe(403);
  });

  it("signed upload accepts images only, bounded size, and one purpose per signature", async () => {
    const st = createR2Storage(env, () => T);
    const { signedUrl } = (await st.from("manager-candidates").createSignedUploadUrl("u/1.jpg")).data!;
    const u = new URL(signedUrl);
    const put = (body: BodyInit, type: string, now = T + 1000) =>
      handleMediaRequest(req(u.pathname + u.search, { method: "PUT", body, headers: { "content-type": type } }), env, {}, now);
    expect((await put(new Uint8Array([1]), "text/html"))!.status).toBe(415);
    expect((await put(new Uint8Array(0), "image/jpeg"))!.status).toBe(413);
    expect((await put(new Uint8Array(9 * 1024 * 1024), "image/jpeg"))!.status).toBe(413);
    expect((await put(new Uint8Array([1, 2]), "image/jpeg", T + 3 * 3600 * 1000))!.status).toBe(403);
    expect((await put(new Uint8Array([1, 2]), "image/jpeg"))!.status).toBe(200);
    expect(store.has("manager-candidates/u/1.jpg")).toBe(true);
    // a "put" signature must not open a GET
    const get = await handleMediaRequest(req(u.pathname.replace("/media-upload/", "/media-signed/") + u.search), env, {}, T + 1000);
    expect(get!.status).toBe(403);
  });

  it("download param sets Content-Disposition; traversal and unknown routes are rejected", async () => {
    await createR2Storage(env).from("RIB").upload("RIB.pdf", new Uint8Array([1]), { contentType: "application/pdf" });
    const res = await handleMediaRequest(req("/media/RIB/RIB.pdf?download=RIBBABRAYAN.pdf"), env, {});
    expect(res!.headers.get("content-disposition")).toContain('filename="RIBBABRAYAN.pdf"');
    expect(res!.headers.get("cache-control")).toBe("public, max-age=3600");
    // the URL parser already resolves %2e%2e, so the request never matches a media route (and can't reach R2)
    expect(await handleMediaRequest(req("/media/%2e%2e/secret"), env, {})).toBeNull();
    expect((await handleMediaRequest(req("/media/a%2F..%2Fb"), env, {}))!.status).toBe(404);
    expect(await handleMediaRequest(req("/api/trpc/x"), env, {})).toBeNull();
  });

  it("verifyMedia rejects wrong secret and wrong key", async () => {
    const sig = await signMedia("a", "get", "k", T / 1000 + 10);
    expect(await verifyMedia("a", "get", "k", T / 1000 + 10, sig, T)).toBe(true);
    expect(await verifyMedia("b", "get", "k", T / 1000 + 10, sig, T)).toBe(false);
    expect(await verifyMedia("a", "get", "k2", T / 1000 + 10, sig, T)).toBe(false);
  });
});

describe("media-r2 video", () => {
  const signedPut = async (path: string) => {
    const { signedUrl } = (await createR2Storage(env, () => T).from("hub").createSignedUploadUrl(path)).data!;
    return new URL(signedUrl);
  };
  const putVideo = async (path: string, body: Uint8Array, type: string, headers: Record<string, string> = { "content-length": String(body.length) }) => {
    const u = await signedPut(path);
    return handleMediaRequest(req(u.pathname + u.search, { method: "PUT", body, headers: { "content-type": type, ...headers } }), env, {}, T + 1000);
  };

  it("accepts a video with a declared length and stores the bytes under the private hub key", async () => {
    expect((await putVideo("1/a.mp4", new Uint8Array([1, 2, 3]), "video/mp4"))!.status).toBe(200);
    expect([...store.get("private/hub/1/a.mp4").bytes]).toEqual([1, 2, 3]);
    expect((await putVideo("1/b.mov", new Uint8Array([9]), "video/quicktime"))!.status).toBe(200);
    expect((await putVideo("1/c.webm", new Uint8Array([9]), "video/webm"))!.status).toBe(200);
  });
  it("rejects mismatched types, a missing or oversized length", async () => {
    expect((await putVideo("1/a.mp4", new Uint8Array([1]), "image/jpeg"))!.status).toBe(415);
    expect((await putVideo("1/a.jpg", new Uint8Array([1]), "video/mp4"))!.status).toBe(415);
    expect((await putVideo("1/a.mp4", new Uint8Array([1]), "video/webm"))!.status).toBe(415);
    expect((await putVideo("1/a.mp4", new Uint8Array([1]), "video/mp4", {}))!.status).toBe(413);
    expect((await putVideo("1/a.mp4", new Uint8Array([1]), "video/mp4", { "content-length": String(50 * 1024 * 1024 + 1) }))!.status).toBe(413);
    expect((await putVideo("1/a.mp4", new Uint8Array(0), "video/mp4", { "content-length": "0" }))!.status).toBe(413);
    expect(store.size).toBe(0);
  });

  it("only the private hub bucket takes videos: a video key elsewhere (public bucket) is refused", async () => {
    const { signedUrl } = (await createR2Storage(env, () => T).from("manager-candidates").createSignedUploadUrl("u/1.mp4")).data!;
    const u = new URL(signedUrl);
    const body = new Uint8Array([1, 2, 3]);
    const res = await handleMediaRequest(req(u.pathname + u.search, { method: "PUT", body, headers: { "content-type": "video/mp4", "content-length": "3" } }), env, {}, T + 1000);
    expect(res!.status).toBe(415);
    expect(store.size).toBe(0);
  });

  describe("range requests", () => {
    const get = async (range?: string) => {
      await env.GALLERY_MEDIA.put("private/hub/1/v.mp4", new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), { httpMetadata: { contentType: "video/mp4" } });
      const { signedUrl } = (await createR2Storage(env, () => T).from("hub").createSignedUrl("1/v.mp4", 3600)).data!;
      const u = new URL(signedUrl);
      return handleMediaRequest(req(u.pathname + u.search, range ? { headers: { range } } : undefined), env, {}, T + 1000);
    };
    const bytes = async (r: Response) => [...new Uint8Array(await r.arrayBuffer())];

    it("full response advertises Accept-Ranges", async () => {
      const r = (await get())!;
      expect(r.status).toBe(200);
      expect(r.headers.get("accept-ranges")).toBe("bytes");
      expect(await bytes(r)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
    it("serves bytes=a-b, open-ended and suffix ranges as 206", async () => {
      const r = (await get("bytes=2-5"))!;
      expect(r.status).toBe(206);
      expect(r.headers.get("content-range")).toBe("bytes 2-5/10");
      expect(r.headers.get("content-length")).toBe("4");
      expect(await bytes(r)).toEqual([2, 3, 4, 5]);
      const open = (await get("bytes=7-"))!;
      expect(open.headers.get("content-range")).toBe("bytes 7-9/10");
      expect(await bytes(open)).toEqual([7, 8, 9]);
      const suffix = (await get("bytes=-3"))!;
      expect(suffix.headers.get("content-range")).toBe("bytes 7-9/10");
      expect((await get("bytes=0-99"))!.headers.get("content-range")).toBe("bytes 0-9/10");
    });
    it("416 when unsatisfiable, full 200 when the header is not a valid range", async () => {
      const bad = (await get("bytes=20-30"))!;
      expect(bad.status).toBe(416);
      expect(bad.headers.get("content-range")).toBe("bytes */10");
      expect((await get("bytes=5-2"))!.status).toBe(416);
      expect((await get("bytes=abc"))!.status).toBe(200);
      expect((await get("items=0-1"))!.status).toBe(200);
    });
  });
});
