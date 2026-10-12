# Vidéo dans les fils d'actualité Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publier une vidéo (mp4/webm/mov, 50 Mo max) dans le Fil d'actualité et le fil Pro.

**Architecture:** Aucun changement de schéma : le type d'un média se déduit de l'extension de sa clé R2. Le Worker accepte l'envoi vidéo en flux, la lecture par plages (Range) et une règle « 1 vidéo seule ou jusqu'à 4 photos ». Le client réutilise un composant `MediaGrid` pour afficher photos ou vidéo.

**Tech Stack:** TypeScript 5.9, Cloudflare Workers + R2 + D1, vitest + `node:sqlite`, React 19, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-10-12-feed-video-design.md`

## Global Constraints

- Types vidéo : `video/mp4` (.mp4), `video/webm` (.webm), `video/quicktime` (.mov). Taille max 50 Mo (`50 * 1024 * 1024`). Images inchangées : 8 Mo.
- Une publication = 0 à 4 images, OU exactement 1 vidéo et rien d'autre. Chemins : uniquement `"<memberId>/<fichier>"` du membre.
- Pas de migration SQL, pas de nouvelle dépendance. Temps toujours via `nowMs`. Erreurs via `HubError("invalid", …)`.
- Baseline avant travail : relever `pnpm check` (nombre d'erreurs) et `pnpm vitest run` (échecs). Ils ne doivent pas augmenter.

## Review Focus

- Vidéo envoyée sans `Content-Length`, ou avec un `Content-Length` mensonger : refusée (413), jamais lue en mémoire.
- Clé `.jpg` avec `Content-Type: video/mp4` (et inversement) : 415 ; pas de contournement du plafond 8 Mo des images en renommant.
- En-tête `Range` invalide (`bytes=abc`, `bytes=5-2`, `bytes=99-` hors fichier) : jamais d'erreur 500 ; 200 complet ou 416.
- Un membre ne peut pas attacher la vidéo d'un autre membre à sa publication (chemin d'autrui) : 400.
- Une vidéo ne doit apparaître ni dans « Mes photos » ni pouvoir être proposée à la galerie.
- Safari/iOS : `<video playsInline>` + réponses 206 ; vidéo d'une publication masquée non accessible (URL signée seulement via l'API).

---

### Task 1: R2 — envoi vidéo en flux et lecture par plages

**Files:**
- Modify: `worker/gallery-d1.ts` (interface `R2Like`), `worker/media-r2.ts`
- Test: `worker/media-r2.test.ts`

**Interfaces:**
- Produces (`media-r2.ts`): `MAX_VIDEO_BYTES = 50 * 1024 * 1024`, `VIDEO_TYPES: Record<string, string>` (`mp4`→`video/mp4`, `webm`→`video/webm`, `mov`→`video/quicktime`), `isVideoKey(key: string): boolean`.
- `R2Like` devient : `put(key, value: ArrayBuffer | Uint8Array | ReadableStream, opts?)`, `get(key, opts?: { range?: { offset: number; length: number } })`, `head?(key): Promise<{ size: number } | null>` (optionnel pour ne pas casser les autres fakes), `delete`.

- [ ] **Step 1: Failing tests** — dans `worker/media-r2.test.ts` : remplacer le `fakeR2()` par la version ci-dessous et ajouter les tests.

```ts
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
```

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run worker/media-r2.test.ts`
Expected: FAIL (video PUT rejected with 415, no 206/416, TS errors on `head`/`size`).

- [ ] **Step 3: Implement** — `worker/gallery-d1.ts`, interface `R2Like` :

```ts
export interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array | ReadableStream, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string, opts?: { range?: { offset: number; length: number } }): Promise<{ body: ReadableStream; httpEtag: string; size?: number; httpMetadata?: { contentType?: string } } | null>;
  head?(key: string): Promise<{ size: number } | null>;
  delete(keys: string | string[]): Promise<void>;
}
```

`worker/media-r2.ts` — après `UPLOAD_TYPES` ajouter :

```ts
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const VIDEO_TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const extOf = (key: string) => /\.([a-z0-9]+)$/i.exec(key)?.[1].toLowerCase() ?? "";
export const isVideoKey = (key: string) => Object.hasOwn(VIDEO_TYPES, extOf(key));
```

Dans `handleMediaRequest`, remplacer la branche `/media-signed/` GET par :

```ts
  if (route === "/media-signed/" && request.method === "GET") {
    if (!(await verifyMedia(secret, "get", key, exp, sig, now))) return new Response("Forbidden", { status: 403, headers: cors });
    const range = /^bytes=(\d*)-(\d*)$/.exec((request.headers.get("range") ?? "").trim());
    if (range && (range[1] || range[2]) && env.GALLERY_MEDIA.head) {
      const head = await env.GALLERY_MEDIA.head(key);
      if (!head) return notFound();
      const size = head.size;
      const start = range[1] === "" ? Math.max(0, size - Number(range[2])) : Number(range[1]);
      const end = range[1] === "" || range[2] === "" ? size - 1 : Math.min(Number(range[2]), size - 1);
      if (size === 0 || start >= size || start > end) return new Response(null, { status: 416, headers: { ...cors, "Content-Range": `bytes */${size}` } });
      const part = await env.GALLERY_MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
      if (!part) return notFound();
      return new Response(part.body, {
        status: 206,
        headers: {
          ...cors, "Content-Type": part.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", ETag: part.httpEtag,
          "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1),
        },
      });
    }
    const obj = await env.GALLERY_MEDIA.get(key);
    if (!obj) return notFound();
    return new Response(obj.body, {
      headers: { ...cors, "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", ETag: obj.httpEtag, "Accept-Ranges": "bytes" },
    });
  }
```

et la branche PUT par :

```ts
  if (route === "/media-upload/" && request.method === "PUT") {
    if (!(await verifyMedia(secret, "put", key, exp, sig, now))) return new Response("Forbidden", { status: 403, headers: cors });
    const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (isVideoKey(key)) {
      if (type !== VIDEO_TYPES[extOf(key)]) return new Response("Unsupported media type", { status: 415, headers: cors });
      // streamed to R2 (never buffered): the declared length must be present and bounded, R2 enforces that the body matches it
      if (!(declared > 0) || declared > MAX_VIDEO_BYTES || !request.body) return new Response("Invalid size", { status: 413, headers: cors });
      await env.GALLERY_MEDIA.put(key, request.body, { httpMetadata: { contentType: type } });
      return new Response(JSON.stringify({ Key: key }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!UPLOAD_TYPES.has(type)) return new Response("Unsupported media type", { status: 415, headers: cors });
    if (declared > MAX_UPLOAD_BYTES) return new Response("Payload too large", { status: 413, headers: cors });
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) return new Response("Invalid size", { status: 413, headers: cors });
    await env.GALLERY_MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
    return new Response(JSON.stringify({ Key: key }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run worker/media-r2.test.ts worker/gallery-d1.test.ts && pnpm check 2>&1 | grep -c "error TS"`
Expected: tests PASS ; compte d'erreurs TS = baseline.

- [ ] **Step 5: Commit**

```bash
git add worker/gallery-d1.ts worker/media-r2.ts worker/media-r2.test.ts
git commit -m "feat(video): streamed video upload and Range reads on signed media"
```

---

### Task 2: Règle de publication, « Mes photos » et galerie

**Files:**
- Modify: `worker/hub-d1.ts` (`checkMedia`, `createPost`, `memberPhotos`, `proposeToGallery`), `worker/pro-d1.ts` (`createPost`)
- Test: `worker/feed-video.test.ts` (nouveau)

**Interfaces:**
- Consumes: `isVideoKey` de Task 1.
- Produces: `checkMedia(memberId: number, media: string[], maxImages: number): void` exporté par `hub-d1` (lève `HubError("invalid")`).

- [ ] **Step 1: Failing test** — `worker/feed-video.test.ts`

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { D1Like } from "./gallery-d1";
import { fakeD1, openDb, type Sqlite } from "./test-d1";
import * as h from "./hub-d1";
import * as pro from "./pro-d1";

const T0 = Date.parse("2026-10-12T12:00:00.000Z");
let sqlite: Sqlite;
let d: D1Like;

async function member(email: string) {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('Amina','Benali',?,'confirmed')").run(email);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  return (await h.getSession(d, session, T0 + 1))!;
}
beforeEach(() => { sqlite = openDb(); d = fakeD1(sqlite); });

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run worker/feed-video.test.ts`
Expected: FAIL (mix accepted / video listed in photos).

- [ ] **Step 3: Implement**

`worker/hub-d1.ts` : `import { isVideoKey } from "./media-r2";` en tête, puis après `isOwnPath` :

```ts
/** A post carries 0..maxImages images, OR exactly one video and nothing else. Every path must be the member's own. */
export function checkMedia(memberId: number, media: string[], maxImages: number): void {
  if (!media.every(p => isOwnPath(memberId, p))) throw new HubError("invalid", "Médias invalides");
  const videos = media.filter(isVideoKey).length;
  if (videos > 0 && media.length > 1) throw new HubError("invalid", "Une vidéo se publie seule (sans autre média)");
  if (videos === 0 && media.length > maxImages) throw new HubError("invalid", `Photos invalides (${maxImages} max)`);
}
```

Dans `createPost` (hub-d1) remplacer
`if (media.length > LIMITS.media || !media.every(p => isOwnPath(member.id, p))) throw new HubError("invalid", "Photos invalides (4 max)");`
par `checkMedia(member.id, media, LIMITS.media);`.

Dans `memberPhotos`, ajouter dans le `WHERE` : `AND pm.r2_key NOT LIKE '%.mp4' AND pm.r2_key NOT LIKE '%.webm' AND pm.r2_key NOT LIKE '%.mov'`.

Dans `proposeToGallery`, la première ligne devient :
`if (!isOwnPath(member.id, path) || isVideoKey(path)) throw new HubError("invalid", "Photo invalide");`

`worker/pro-d1.ts` : ajouter `checkMedia` à l'import de `./hub-d1` et remplacer la ligne équivalente dans `createPost` par `checkMedia(member.id, media, PRO_LIMITS.media);`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run worker/feed-video.test.ts worker/hub-d1.test.ts worker/pro-d1.test.ts worker/pro.test.ts worker/hub.test.ts`
Expected: PASS (les tests existants sur « Photos invalides » restent verts : même code `invalid`).

- [ ] **Step 5: Commit**

```bash
git add worker/hub-d1.ts worker/pro-d1.ts worker/feed-video.test.ts
git commit -m "feat(video): one-video-or-photos rule, videos hidden from Mes photos and gallery"
```

---

### Task 3: Route d'envoi `/hub/media` accepte les vidéos

**Files:**
- Modify: `worker/hub.ts`
- Test: `worker/feed-video.test.ts` (ajout)

**Interfaces:** Consumes Task 2 (règle) ; produit : `POST /hub/media {contentType:"video/mp4"|"video/webm"|"video/quicktime"}` → `{path: "<id>/<uuid>.mp4|webm|mov", uploadUrl}`.

- [ ] **Step 1: Failing test** — ajouter à `worker/feed-video.test.ts` :

```ts
import { createHubHarness } from "./test-hub";

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run worker/feed-video.test.ts -t "hub routes"`
Expected: FAIL (400 sur `video/mp4`).

- [ ] **Step 3: Implement** — `worker/hub.ts`, après la constante `EXT` ajouter `const VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };` puis dans la route `media` :

(le corps de la requête n'est lu qu'une fois) :

```ts
      const ct = str((await readJson(request)).contentType);
      const ext = EXT[ct] ?? VIDEO_EXT[ct];
      if (!ext) throw new H.HubError("invalid", "Format non supporté (photos jpeg, png, webp, gif ; vidéos mp4, webm, mov)");
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run worker/ 2>&1 | grep -E "Test Files|Tests "`
Expected: seuls les échecs de baseline.

- [ ] **Step 5: Commit**

```bash
git add worker/hub.ts worker/feed-video.test.ts
git commit -m "feat(video): /hub/media signs video uploads"
```

---

### Task 4: Client — helpers, `MediaGrid`, cartes

**Files:**
- Create: `client/src/features/hub/media.ts`, `client/src/features/hub/media.test.ts`, `client/src/features/hub/components/MediaGrid.tsx`, `client/src/features/hub/components/MediaGrid.test.ts`
- Modify: `client/src/features/hub/components/PostCard.tsx`, `client/src/features/hub/pro/components/ProPostCard.tsx`, `client/src/features/hub/api.ts`

**Interfaces:**
- Produces (`media.ts`): `MAX_VIDEO_BYTES`, `VIDEO_TYPES: string[]`, `isVideoUrl(u: string): boolean`, `pickMedia(current: File[], picked: File[], maxPhotos?: number): { files: File[]; error?: string; info?: string }`. `MediaGrid({ media, wideFirstOfThree? })`. `api.ts` : `uploadMedia(file: File): Promise<string>`.
- Prérequis config de test : si `vitest.config.ts` n'inclut pas `client/src/**/*.test.ts`, l'ajouter à `include`, ajouter `esbuild: { jsx: "automatic" }` à la config racine, et `server: { deps: { inline: [/streamdown/, /katex/] } }` dans `test` (nécessaire pour importer les composants du chat). Vérifier avec `grep -n "client/src" vitest.config.ts`.

- [ ] **Step 1: Failing tests**

`client/src/features/hub/media.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { MAX_VIDEO_BYTES, isVideoUrl, pickMedia } from "./media";

const f = (name: string, type: string, size = 10) => ({ name, type, size }) as File;

describe("isVideoUrl", () => {
  it("detects videos in signed URLs, not images", () => {
    expect(isVideoUrl("https://w.test/media-signed/private/hub/1/a-b.mp4?exp=1&sig=2")).toBe(true);
    expect(isVideoUrl("https://w.test/media-signed/private/hub/1/a.MOV?exp=1")).toBe(true);
    expect(isVideoUrl("https://w.test/media-signed/private/hub/1/a.jpg?exp=1&sig=mp4")).toBe(false);
  });
});

describe("pickMedia", () => {
  it("a video replaces the photos; a photo replaces the video", () => {
    const photos = [f("a.jpg", "image/jpeg")];
    expect(pickMedia(photos, [f("v.mp4", "video/mp4")]).files.map(x => x.name)).toEqual(["v.mp4"]);
    expect(pickMedia([f("v.mp4", "video/mp4")], [f("b.jpg", "image/jpeg")]).files.map(x => x.name)).toEqual(["b.jpg"]);
  });
  it("keeps at most 4 photos with an info, ignores unsupported files", () => {
    const five = Array.from({ length: 5 }, (_, i) => f(`${i}.jpg`, "image/jpeg"));
    const r = pickMedia([], five);
    expect(r.files).toHaveLength(4);
    expect(r.info).toMatch(/4 photos/);
    expect(pickMedia([], [f("x.pdf", "application/pdf")]).files).toEqual([]);
  });
  it("rejects a video over 50 Mo and keeps the current selection", () => {
    const cur = [f("a.jpg", "image/jpeg")];
    const r = pickMedia(cur, [f("big.mp4", "video/mp4", MAX_VIDEO_BYTES + 1)]);
    expect(r.error).toMatch(/50 Mo/);
    expect(r.files).toBe(cur);
  });
});
```

`client/src/features/hub/components/MediaGrid.test.ts` :

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MediaGrid from "./MediaGrid";

const html = (media: (string | null)[]) => renderToStaticMarkup(createElement(MediaGrid, { media }));

describe("MediaGrid", () => {
  it("renders a controlled inline video for a video URL", () => {
    const out = html(["https://w.test/media-signed/private/hub/1/a.mp4?exp=1&sig=2"]);
    expect(out).toContain("<video");
    expect(out).toContain("controls");
    expect(out).toMatch(/playsinline/i);
    expect(out).not.toContain("<img");
  });
  it("renders images as before, skips null urls, renders nothing when empty", () => {
    const out = html(["https://w.test/a.jpg", null, "https://w.test/b.jpg"]);
    expect(out.match(/<img/g)).toHaveLength(2);
    expect(out).not.toContain("<video");
    expect(html([null])).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run client/src/features/hub`
Expected: FAIL (modules introuvables).

- [ ] **Step 3: Implement**

`client/src/features/hub/media.ts` :

```ts
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
/** Signed media URLs keep the file extension in their path, which is how a video is told from a photo. */
export const isVideoUrl = (u: string) => /\.(mp4|webm|mov)(\?|$)/i.test(u);

/**
 * Selection rule of the composers: a video is alone (it replaces the photos), a photo drops a selected video, 4 photos max.
 * Returns the new selection; `error` (blocking) or `info` (hint) are for a toast.
 */
export function pickMedia(current: File[], picked: File[], maxPhotos = 4): { files: File[]; error?: string; info?: string } {
  const video = picked.find(f => VIDEO_TYPES.includes(f.type));
  if (video) {
    if (video.size > MAX_VIDEO_BYTES) return { files: current, error: "Vidéo trop lourde (50 Mo max)." };
    return { files: [video] };
  }
  const all = [...current.filter(f => f.type.startsWith("image/")), ...picked].filter(f => f.type.startsWith("image/"));
  return { files: all.slice(0, maxPhotos), ...(all.length > maxPhotos ? { info: `${maxPhotos} photos maximum` } : {}) };
}
```

`client/src/features/hub/components/MediaGrid.tsx` :

```tsx
import { isVideoUrl } from "../media";

/** Media of a publication: one inline video, or the photo grid. */
export default function MediaGrid({ media, wideFirstOfThree = false }: { media: (string | null)[]; wideFirstOfThree?: boolean }) {
  const urls = media.filter((u): u is string => !!u);
  if (urls.length === 0) return null;
  const video = urls.find(isVideoUrl);
  if (video) return <video src={video} controls playsInline preload="metadata" aria-label="Vidéo" className="max-h-[28rem] w-full bg-black" />;
  return (
    <div className={`grid gap-0.5 ${urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {urls.map((u, i) => (
        <img key={u} src={u} alt="" loading="lazy" className={`w-full object-cover ${urls.length === 1 ? "max-h-[28rem]" : "aspect-square"} ${wideFirstOfThree && urls.length === 3 && i === 0 ? "col-span-2 !aspect-video" : ""}`} />
      ))}
    </div>
  );
}
```

`PostCard.tsx` : importer `MediaGrid from "./MediaGrid"`, supprimer `const photos = post.media.filter(...)` (ligne ~32), et remplacer le bloc `{photos.length > 0 && ( <div className=… grid …> … </div> )}` par `<MediaGrid media={post.media} wideFirstOfThree />`.
`ProPostCard.tsx` : importer `MediaGrid from "../../components/MediaGrid"`, supprimer `const photos = …` (ligne ~25) et remplacer le bloc équivalent par `<MediaGrid media={post.media} />`.

`api.ts` : après `uploadImage` ajouter `export const uploadMedia = (file: File): Promise<string> => upload(file, false);` ; en tête de `upload()` remplacer le contrôle de taille par :

```ts
  const video = file.type.startsWith("video/");
  if (file.size > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) throw new HubApiError(0, "too_large", video ? "Vidéo trop lourde (50 Mo max)." : "Image trop lourde (8 Mo max).");
```
et le message d'échec : `"Envoi du fichier impossible."`. Ajouter `import { MAX_VIDEO_BYTES } from "./media";`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run client/src/features/hub && pnpm check 2>&1 | grep -c "error TS"`
Expected: PASS ; erreurs TS = baseline.

- [ ] **Step 5: Commit**

```bash
git add client vitest.config.ts
git commit -m "feat(video): media helpers, MediaGrid with inline video, cards use it"
```

---

### Task 5: Client — compositeurs Fil et Pro

**Files:**
- Modify: `client/src/features/hub/components/Composer.tsx`, `client/src/features/hub/pro/components/ProComposer.tsx`

**Interfaces:** Consumes `pickMedia`, `VIDEO_TYPES`, `hub.uploadMedia` de Task 4. (Pas de test unitaire de composant : la logique testable est `pickMedia`, déjà couverte ; vérification par `pnpm check` et passage manuel.)

- [ ] **Step 1: Composer du Fil** — dans `Composer.tsx` : importer `{ VIDEO_TYPES, pickMedia } from "../media"` ; remplacer `pick` par :

```tsx
  const pick = (list: FileList | null) => {
    if (!list) return;
    const r = pickMedia(files, Array.from(list), MAX_PHOTOS);
    if (r.error) toast.error(r.error);
    else if (r.info) toast.info(r.info);
    setFiles(r.files);
    if (fileRef.current) fileRef.current.value = "";
  };
```
`submit` : `files.map(hub.uploadImage)` → `files.map(hub.uploadMedia)`. Aperçus : dans le `files.map(...)` d'aperçu, afficher une vidéo si le fichier en est une :

```tsx
{f.type.startsWith("video/")
  ? <video src={previews[i]} muted playsInline className="h-20 w-28 rounded-lg bg-black object-cover" />
  : <img src={previews[i]} alt="" className="h-20 w-20 rounded-lg object-cover" />}
```
(conteneur `h-20 w-20` → `h-20` + `w-auto` pour la vidéo : remplacer la classe du conteneur par `relative h-20`), et le libellé du bouton retrait : `aria-label="Retirer le média"`. Input fichier : `accept={`image/jpeg,image/png,image/webp,image/gif,${VIDEO_TYPES.join(",")}`}` ; bouton : `<ImagePlus … /> Photo / vidéo{files.length > 0 ? \` (${files.length})\` : ""}` ; `disabled` = `files.length >= MAX_PHOTOS || files.some(f => f.type.startsWith("video/"))`.

- [ ] **Step 2: Composer Pro** — mêmes changements dans `ProComposer.tsx` (`pick` via `pickMedia`, `hub.uploadMedia`, aperçu vidéo, `accept`, libellé « Photo / vidéo », `disabled` identique).

- [ ] **Step 3: Verify**

Run: `pnpm check 2>&1 | grep -E "error TS" | grep -E "Composer|MediaGrid|media.ts|PostCard|api.ts"; pnpm check 2>&1 | grep -c "error TS"`
Expected: aucune erreur dans ces fichiers ; total = baseline.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/hub/components/Composer.tsx client/src/features/hub/pro/components/ProComposer.tsx
git commit -m "feat(video): composers accept one video (Fil and Pro)"
```

---

### Task 6: Vérification d'ensemble

**Files:** aucun.

- [ ] **Step 1: Suite complète et build**

Run: `pnpm vitest run 2>&1 | grep -E "Test Files|Tests "; pnpm check 2>&1 | grep -c "error TS"; pnpm build:worker 2>&1 | tail -1; pnpm build:cloudflare 2>&1 | tail -2`
Expected: échecs = baseline uniquement (liste par nom si différents), erreurs TS = baseline, builds OK.

- [ ] **Step 2: Message final** — rulings, minors différés, et étapes utilisateur : aucun SQL ; `pnpm build:cloudflare && npx wrangler deploy` puis `pnpm deploy:cloudflare` ; test manuel : publier une vidéo mp4 ≤ 50 Mo depuis un ordinateur et un iPhone (lecture + avance dans la vidéo), un fichier > 50 Mo refusé, une vidéo dans le fil Pro.
