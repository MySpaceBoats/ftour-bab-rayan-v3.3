import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Runs client/public/sw.js against a minimal fake service-worker scope and returns its listeners. */
function loadSw() {
  const listeners: Record<string, (e: any) => void> = {};
  const cache = { puts: [] as string[], deleted: [] as string[], keys: [] as { url: string }[] };
  const caches = {
    open: async () => ({
      addAll: async () => undefined,
      put: async (r: { url: string }) => { cache.puts.push(r.url); },
      keys: async () => cache.keys,
      delete: async (r: { url: string }) => { cache.deleted.push(r.url); return true; },
    }),
    keys: async () => [],
    match: async () => undefined,
  };
  const fetched: string[] = [];
  const fetchFn = async (r: { url: string }) => { fetched.push(r.url); return { clone: () => ({}) } as unknown as Response; };
  const self = { addEventListener: (t: string, fn: (e: any) => void) => { listeners[t] = fn; }, skipWaiting: () => undefined, clients: { claim: () => undefined } };
  new Function("self", "caches", "fetch", "URL", readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"))(self, caches, fetchFn, URL);
  const request = async (url: string) => {
    let handled = false;
    listeners.fetch({ request: { method: "GET", url }, respondWith: () => { handled = true; } });
    await new Promise(r => setTimeout(r, 0));
    return handled;
  };
  return { request, fetched, cache, listeners };
}

describe("service worker", () => {
  it("leaves private hub data and signed media alone (no interception, no cache copy)", async () => {
    const sw = loadSw();
    expect(await sw.request("https://api.test/hub/feed")).toBe(false);
    expect(await sw.request("https://w.test/media-signed/private/hub/1/a.jpg?exp=1&sig=2")).toBe(false);
    expect(await sw.request("https://w.test/media/gallery/original/x.jpg")).toBe(false);
    expect(sw.fetched).toEqual([]);
    expect(sw.cache.puts).toEqual([]);
  });
  it("still serves the app shell network-first with a cache copy", async () => {
    const sw = loadSw();
    expect(await sw.request("https://site.test/scanner")).toBe(true);
    await new Promise(r => setTimeout(r, 0));
    expect(sw.fetched).toEqual(["https://site.test/scanner"]);
  });
});
