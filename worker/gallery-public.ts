/** Anonymous gallery upload (photos land as drafts for admin moderation): payload validation and a per-IP hourly quota. */
import { TRPCError } from "@trpc/server";
import type { D1Like } from "./gallery-d1";
import { getSession } from "./hub-d1";

export const PUBLIC_PER_HOUR = 30;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };

const bad = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

const kindOf = (b: Uint8Array): "jpg" | "png" | "webp" | null => {
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
};

/** The bytes must really be the image type announced: a renamed HTML or script file is refused. */
export function decodePublicPhoto(photo: { fileType: string; fileData: string }): { ext: string; buffer: Uint8Array } {
  if (!EXT[photo.fileType]) throw bad("Format non supporté. JPEG, PNG, WebP uniquement.");
  let buffer: Uint8Array;
  try {
    buffer = Uint8Array.from(atob(photo.fileData.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")), c => c.charCodeAt(0));
  } catch {
    throw bad("Contenu de fichier invalide.");
  }
  // The client re-encodes WebP to JPEG but keeps the announced type: the real bytes decide the extension.
  const real = kindOf(buffer);
  if (!real) throw bad("Contenu de fichier invalide.");
  if (buffer.length > MAX_FILE_BYTES) throw bad("Fichier trop volumineux (max 8MB).");
  return { ext: real, buffer };
}

/** Counts this IP's uploads over the last hour (uploaded_by holds the IP for anonymous uploads). */
export async function checkPublicQuota(d: D1Like, ip: string, incoming: number): Promise<void> {
  const r = await d
    .prepare("SELECT COUNT(*) AS n FROM gallery_photos WHERE uploaded_by = ? AND created_at >= datetime('now','-1 hour')")
    .bind(ip)
    .first<{ n: number }>();
  if ((r?.n ?? 0) + incoming > PUBLIC_PER_HOUR) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de photos envoyées. Réessayez plus tard." });
}

/** A connected volunteer (valid hub session, still a confirmed volunteer) publishes straight away; anyone else lands as a draft for admin moderation. */
export async function resolveUploader(d: D1Like, hubToken: string | null, ip: string, nowMs: number): Promise<{ status: "published" | "draft"; uploadedBy: string }> {
  const member = hubToken ? await getSession(d, hubToken, nowMs) : null;
  return member ? { status: "published", uploadedBy: `member:${member.id}` } : { status: "draft", uploadedBy: ip };
}
