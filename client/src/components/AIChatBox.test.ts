import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AIChatBox } from "./AIChatBox";

const render = (content: string) =>
  renderToStaticMarkup(createElement(AIChatBox, { messages: [{ role: "assistant", content }], onSendMessage: () => undefined }));

describe("AIChatBox assistant messages", () => {
  it("never renders raw HTML from model output (iframe/form/img stay inert text)", () => {
    const html = render(`<iframe srcdoc="<script>alert(1)</script>"></iframe><form action="https://evil.test"><input type="password"></form><img src="https://evil.test/x.png">`);
    expect(html).not.toMatch(/<(iframe|img|script)\b/i);
    expect(html).not.toMatch(/evil\.test"|type="password"/);
    expect(html).toContain("&lt;iframe");
  });
  it("keeps newlines and plain text", () => {
    expect(render("ligne 1\nligne 2")).toContain("ligne 1\nligne 2");
  });
});
