import { describe, expect, it } from "vitest";
import { broadcast, deliver, onlineIds, parseClientEvent, presenceOnClose, presenceOnOpen, type Conn } from "./hub-chat-core";

const conn = (memberId: number, sent: string[] = [], fail = false): Conn => ({ memberId, send: s => { if (fail) throw new Error("closed"); sent.push(s); } });

describe("onlineIds", () => {
  it("returns unique ids ascending", () => {
    expect(onlineIds([conn(3), conn(1), conn(3)])).toEqual([1, 3]);
  });
});

describe("parseClientEvent", () => {
  const ok = JSON.stringify({ type: "typing", to: 7, source: "market", thread_id: 12 });
  it("accepts a valid typing frame", () => {
    expect(parseClientEvent(ok)).toEqual({ type: "typing", to: 7, source: "market", thread_id: 12 });
  });
  it("rejects garbage, wrong types, oversize and non-string frames", () => {
    for (const bad of [
      "not json", "{}", "null", "[]",
      JSON.stringify({ type: "typing", to: "7", source: "pro", thread_id: 1 }),
      JSON.stringify({ type: "typing", to: 7, source: "evil", thread_id: 1 }),
      JSON.stringify({ type: "typing", to: -1, source: "pro", thread_id: 1 }),
      JSON.stringify({ type: "typing", to: 7, source: "pro", thread_id: 1.5 }),
      JSON.stringify({ type: "other", to: 7, source: "pro", thread_id: 1 }),
      ok + " ".repeat(600), new ArrayBuffer(4), 42,
    ]) expect(parseClientEvent(bad)).toBeNull();
  });
});

describe("deliver / broadcast", () => {
  it("sends only to the named member (all their tabs) and counts", () => {
    const a1: string[] = [], a2: string[] = [], b: string[] = [];
    const n = deliver([conn(1, a1), conn(1, a2), conn(2, b)], 1, { type: "message", source: "pro", thread_id: 5 });
    expect(n).toBe(2);
    expect(JSON.parse(a1[0])).toEqual({ type: "message", source: "pro", thread_id: 5 });
    expect(a2).toHaveLength(1);
    expect(b).toEqual([]);
  });
  it("skips a socket that throws", () => {
    const ok: string[] = [];
    expect(deliver([conn(1, [], true), conn(1, ok)], 1, { type: "message", source: "pro", thread_id: 1 })).toBe(1);
    expect(ok).toHaveLength(1);
  });
  it("broadcast reaches everyone and never throws", () => {
    const a: string[] = [], b: string[] = [];
    broadcast([conn(1, a), conn(2, [], true), conn(3, b)], { type: "presence", id: 9, online: true });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });
});

describe("presence transitions", () => {
  it("announces online only for the first connection of a member", () => {
    expect(presenceOnOpen([conn(1), conn(2)], 2)).toEqual({ type: "presence", id: 2, online: true });
    expect(presenceOnOpen([conn(2), conn(2)], 2)).toBeNull();
  });
  it("announces offline only when the last connection closes", () => {
    expect(presenceOnClose([conn(2)], 2)).toBeNull();
    expect(presenceOnClose([conn(1)], 2)).toEqual({ type: "presence", id: 2, online: false });
  });
});
