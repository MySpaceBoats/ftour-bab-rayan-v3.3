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
