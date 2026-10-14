import { describe, expect, it } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./routers";

describe("tRPC error responses", () => {
  it("never include a stack trace", async () => {
    const res = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request("https://w.test/api/trpc/gallery.publicUpload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: {} }),
      }),
      router: appRouter,
      createContext: () => ({ env: {}, req: new Request("https://w.test"), user: null }) as never,
    });
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(text).not.toContain("stack");
    expect(text).not.toContain("worker.js");
  });
});
