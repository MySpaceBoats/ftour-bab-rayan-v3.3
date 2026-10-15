import { describe, expect, it } from "vitest";
import { AiUnavailable, clip, complete, fallbackSummary, parseModels, splitEscalation, type FetchLike } from "./ai-core";

const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const msgs = [{ role: "user" as const, content: "salut" }];

describe("complete", () => {
  it("falls through 429 and empty replies to the next model, sending key and model", async () => {
    const calls: { model: string; auth: string | null }[] = [];
    const f: FetchLike = async (_u, init) => {
      const body = JSON.parse(String(init.body));
      calls.push({ model: body.model, auth: new Headers(init.headers).get("authorization") });
      if (body.model === "m1") return new Response("{}", { status: 429 });
      if (body.model === "m2") return ok("  ");
      return ok(" bonjour ");
    };
    expect(await complete(f, "KEY", ["m1", "m2", "m3"], msgs)).toBe("bonjour");
    expect(calls).toEqual([{ model: "m1", auth: "Bearer KEY" }, { model: "m2", auth: "Bearer KEY" }, { model: "m3", auth: "Bearer KEY" }]);
  });
  it("survives a network error", async () => {
    let n = 0;
    const f: FetchLike = async () => { if (n++ === 0) throw new Error("boom"); return ok("ok"); };
    expect(await complete(f, "K", ["a", "b"], msgs)).toBe("ok");
  });
  it("throws AiUnavailable when every model fails or the key is missing", async () => {
    const bad: FetchLike = async () => new Response("x", { status: 500 });
    await expect(complete(bad, "K", ["a", "b"], msgs)).rejects.toBeInstanceOf(AiUnavailable);
    await expect(complete(bad, undefined, ["a"], msgs)).rejects.toBeInstanceOf(AiUnavailable);
  });
});

describe("helpers", () => {
  it("parseModels splits, trims and defaults", () => {
    expect(parseModels(" a , b ,,")).toEqual(["a", "b"]);
    expect(parseModels(undefined)).toEqual(["openrouter/free"]);
    expect(parseModels("  ")).toEqual(["openrouter/free"]);
  });
  it("splitEscalation strips the marker", () => {
    expect(splitEscalation("Je transmets. [ESCALADE]")).toEqual({ reply: "Je transmets.", escalate: true });
    expect(splitEscalation("Bonjour")).toEqual({ reply: "Bonjour", escalate: false });
    expect(splitEscalation("[ESCALADE]")).toEqual({ reply: "", escalate: true });
  });
  it("clip and fallbackSummary", () => {
    expect(clip("abcdef", 3)).toBe("abc");
    expect(fallbackSummary(["1", "2", "3", "4", "5", "6", "7"])).toBe("2\n3\n4\n5\n6\n7");
  });
});
