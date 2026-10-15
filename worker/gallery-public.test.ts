import { describe, expect, it } from "vitest";
import { GALLERY_SCHEMA, fakeD1, openDb } from "./test-d1";
import { checkPublicQuota, decodePublicPhoto, PUBLIC_PER_HOUR, resolveUploader } from "./gallery-public";
import { createSession, upsertMember } from "./hub-d1";

const b64 = (bytes: number[], pad = 0) => btoa(String.fromCharCode(...bytes) + "\0".repeat(pad));
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const photo = (over: Record<string, unknown> = {}) => ({ fileName: "a.jpg", fileType: "image/jpeg", fileData: b64(JPEG, 20), ...over });

describe("decodePublicPhoto", () => {
  it("accepts a real JPEG and strips a data: prefix", () => {
    const r = decodePublicPhoto(photo({ fileData: `data:image/jpeg;base64,${b64(JPEG, 20)}` }));
    expect(r.ext).toBe("jpg");
    expect(r.buffer[0]).toBe(0xff);
  });
  it("accepts PNG and WebP by their magic bytes", () => {
    expect(decodePublicPhoto(photo({ fileType: "image/png", fileData: b64(PNG, 20) })).ext).toBe("png");
    const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    expect(decodePublicPhoto(photo({ fileType: "image/webp", fileData: b64(webp, 4) })).ext).toBe("webp");
  });
  it("rejects an unsupported type", () => {
    expect(() => decodePublicPhoto(photo({ fileType: "image/gif" }))).toThrow(/Format non supporté/);
  });
  it("rejects a file whose bytes do not match an image (fake extension)", () => {
    expect(() => decodePublicPhoto(photo({ fileData: btoa("<html>pas une image</html>") }))).toThrow(/invalide/);
  });
  it("trusts the real bytes over the declared type (client re-encodes WebP to JPEG)", () => {
    expect(decodePublicPhoto(photo({ fileType: "image/webp" })).ext).toBe("jpg");
    expect(decodePublicPhoto(photo({ fileType: "image/png" })).ext).toBe("jpg");
  });
  it("rejects invalid base64 with a clean error", () => {
    expect(() => decodePublicPhoto(photo({ fileData: "%%%not base64%%%" }))).toThrow(/invalide/);
  });
  it("rejects files over 8MB", () => {
    expect(() => decodePublicPhoto(photo({ fileData: b64(JPEG, 8 * 1024 * 1024) }))).toThrow(/volumineux/);
  });
});

describe("checkPublicQuota", () => {
  const setup = () => {
    const sqlite = openDb();
    sqlite.exec(GALLERY_SCHEMA);
    return { sqlite, d: fakeD1(sqlite) };
  };
  const seed = (sqlite: ReturnType<typeof openDb>, ip: string, n: number, createdAt = "now") => {
    for (let i = 0; i < n; i++)
      sqlite.prepare(`INSERT INTO gallery_photos (id, image_original_url, image_thumb_url, storage_path, size_bytes, mime_type, uploaded_by, created_at)
        VALUES (?, 'u', 'u', 'p', 1, 'image/jpeg', ?, ${createdAt === "now" ? "CURRENT_TIMESTAMP" : "'2000-01-01 00:00:00'"})`).run(`${ip}-${i}-${createdAt}`, ip);
  };
  it("lets an IP upload up to the hourly cap", async () => {
    const { sqlite, d } = setup();
    seed(sqlite, "1.1.1.1", PUBLIC_PER_HOUR - 3);
    await expect(checkPublicQuota(d, "1.1.1.1", 3)).resolves.toBeUndefined();
  });
  it("refuses beyond the cap", async () => {
    const { sqlite, d } = setup();
    seed(sqlite, "1.1.1.1", PUBLIC_PER_HOUR - 3);
    await expect(checkPublicQuota(d, "1.1.1.1", 4)).rejects.toThrow(/Trop de photos/);
  });
  it("ignores old uploads and other IPs", async () => {
    const { sqlite, d } = setup();
    seed(sqlite, "1.1.1.1", PUBLIC_PER_HOUR, "old");
    seed(sqlite, "2.2.2.2", PUBLIC_PER_HOUR);
    await expect(checkPublicQuota(d, "1.1.1.1", 5)).resolves.toBeUndefined();
  });
});

describe("resolveUploader", () => {
  const NOW = Date.parse("2026-10-14T12:00:00.000Z");
  const setup = async (volStatus = "confirmed") => {
    const sqlite = openDb();
    sqlite.exec(GALLERY_SCHEMA);
    const d = fakeD1(sqlite);
    sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('A','B','amina@x.ma',?)").run(volStatus);
    const member = await upsertMember(d, "amina@x.ma");
    const { session } = await createSession(d, member, NOW);
    return { sqlite, d, member, session };
  };
  it("publishes directly for a connected volunteer and records the member", async () => {
    const { d, member, session } = await setup();
    expect(await resolveUploader(d, session, "1.2.3.4", NOW)).toEqual({ status: "published", uploadedBy: `member:${member.id}` });
  });
  it("keeps anonymous visitors as drafts, recorded by IP", async () => {
    const { d } = await setup();
    expect(await resolveUploader(d, null, "1.2.3.4", NOW)).toEqual({ status: "draft", uploadedBy: "1.2.3.4" });
  });
  it("treats an unknown or forged token as anonymous", async () => {
    const { d } = await setup();
    expect(await resolveUploader(d, "f".repeat(64), "1.2.3.4", NOW)).toEqual({ status: "draft", uploadedBy: "1.2.3.4" });
  });
  it("treats a member whose volunteer registration is no longer confirmed as anonymous", async () => {
    const { d, session } = await setup("cancelled");
    expect((await resolveUploader(d, session, "1.2.3.4", NOW)).status).toBe("draft");
  });
});
