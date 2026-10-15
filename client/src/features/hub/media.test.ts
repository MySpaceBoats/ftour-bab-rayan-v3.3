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
