import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Avatar from "./Avatar";

describe("Avatar", () => {
  it("loads the photo lazily and decodes it off the main thread", () => {
    const html = renderToStaticMarkup(createElement(Avatar, { name: "Yasmine Alaoui", src: "https://w.test/a.png", size: 36 }));
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });
  it("falls back to initials without a photo", () => {
    expect(renderToStaticMarkup(createElement(Avatar, { name: "Yasmine Alaoui" }))).toContain(">YA<");
  });
});
