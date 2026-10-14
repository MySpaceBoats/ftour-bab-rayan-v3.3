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
