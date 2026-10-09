// Media (R2) is served by the Worker at <api origin>/media/…; the static site may live on another origin.
const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "/api/trpc";
const origin = new URL(apiBase, window.location.origin).origin;

/** URL of a file stored in R2 (path as in the bucket, e.g. "RIB/file.pdf"). */
export const mediaUrl = (path: string) => `${origin}/media/${path.split("/").map(encodeURIComponent).join("/")}`;
