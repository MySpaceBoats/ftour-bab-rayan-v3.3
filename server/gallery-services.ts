import { getSupabaseAdminClient } from "./supabase";

export const GALLERY_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const GALLERY_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
export const GALLERY_MAX_BATCH = 20;

export type GalleryStatus = "draft" | "published" | "rejected";

export interface GalleryPhotoCreateInput {
  title?: string;
  description?: string;
  eventDate?: string;
  tags?: string[];
  albumId?: string | null;
  sortOrder?: number;
  isFeatured?: boolean;
  status?: GalleryStatus;
  imageOriginalUrl: string;
  imageThumbUrl: string;
  imageMediumUrl?: string;
  storagePath: string;
  thumbStoragePath?: string;
  mediumStoragePath?: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  mimeType: string;
  uploadedBy?: string;
  validationEmail?: string;
  validationToken?: string;
  validationSentAt?: string;
  validatedAt?: string;
}

function normalizeGalleryEventDate(eventDate?: string) {
  if (!eventDate) return null;
  const value = eventDate.trim();
  if (!value) return null;

  if (/^\d{4}$/.test(value)) {
    return `${value}-01-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return null;
}

export async function uploadGalleryAsset(
  path: string,
  bytes: Uint8Array,
  mimeType: string
) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase non configuré");

  const { error } = await client.storage.from("images").upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = client.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteGalleryAsset(path?: string | null) {
  if (!path) return;
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase non configuré");
  await client.storage.from("images").remove([path]);
}

export async function createGalleryPhoto(input: GalleryPhotoCreateInput) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase non configuré");

  const { data, error } = await client
    .from("gallery_photos")
    .insert({
      title: input.title,
      description: input.description,
      event_date: normalizeGalleryEventDate(input.eventDate),
      tags: input.tags ?? [],
      album_id: input.albumId,
      sort_order: input.sortOrder ?? 0,
      is_featured: input.isFeatured ?? false,
      status: input.status ?? "draft",
      image_original_url: input.imageOriginalUrl,
      image_thumb_url: input.imageThumbUrl,
      image_medium_url: input.imageMediumUrl,
      storage_path: input.storagePath,
      thumb_storage_path: input.thumbStoragePath,
      medium_storage_path: input.mediumStoragePath,
      width: input.width,
      height: input.height,
      size_bytes: input.sizeBytes,
      mime_type: input.mimeType,
      uploaded_by: input.uploadedBy,
      validation_email: input.validationEmail,
      validation_token: input.validationToken,
      validation_sent_at: input.validationSentAt,
      validated_at: input.validatedAt,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listGalleryAlbums(publicOnly = false) {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  let query = client
    .from("gallery_albums")
    .select("*")
    .order("sort_order", { ascending: true });
  if (publicOnly) query = query.eq("status", "published");

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function resolveGalleryAssetUrl(
  storagePath?: string | null,
  fallbackUrl?: string | null
): string | null {
  if (!storagePath) return fallbackUrl ?? null;

  const client = getSupabaseAdminClient();
  if (!client) return fallbackUrl ?? null;

  const { data } = client.storage.from("images").getPublicUrl(storagePath);
  return data.publicUrl || fallbackUrl || null;
}
