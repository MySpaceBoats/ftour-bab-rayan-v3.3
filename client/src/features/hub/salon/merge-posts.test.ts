import { describe, expect, it } from "vitest";
import { appendOlder, mergeFirstPage } from "./merge-posts";

const ids = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => ({ id: from - i }));
const toIds = (l: { id: number }[]) => l.map(p => p.id);

describe("mergeFirstPage", () => {
  it("empty list takes the page as is", () => {
    expect(mergeFirstPage([], null, ids(3, 1), null)).toEqual({ posts: ids(3, 1), next: null });
  });

  it("I1: one new post on a fully loaded 30-post salon keeps the end of history (no phantom cursor, no duplicate)", () => {
    const r = mergeFirstPage(ids(30, 1), null, ids(31, 2), "2");
    expect(toIds(r.posts)).toEqual(Array.from({ length: 31 }, (_, i) => 31 - i));
    expect(r.next).toBeNull();
  });

  it("contiguous poll keeps older pages already loaded and their cursor", () => {
    const r = mergeFirstPage(ids(60, 31), "31", ids(62, 33), "33");
    expect(toIds(r.posts)).toEqual(Array.from({ length: 32 }, (_, i) => 62 - i));
    expect(r.next).toBe("31");
  });

  it("I2: a gap (more than a page of new posts) replaces the list and restarts the cursor", () => {
    const r = mergeFirstPage(ids(30, 1), null, ids(100, 71), "71");
    expect(toIds(r.posts)).toEqual(toIds(ids(100, 71)));
    expect(r.next).toBe("71");
  });

  it("page that covers all loaded posts takes the page cursor", () => {
    const r = mergeFirstPage(ids(5, 3), "3", ids(8, 1), "1");
    expect(toIds(r.posts)).toEqual(toIds(ids(8, 1)));
    expect(r.next).toBe("1");
  });

  it("a deleted post is dropped when the page no longer has it", () => {
    const r = mergeFirstPage(ids(5, 1), null, [{ id: 5 }, { id: 3 }, { id: 2 }, { id: 1 }], null);
    expect(toIds(r.posts)).toEqual([5, 3, 2, 1]);
  });
});

describe("appendOlder", () => {
  it("never duplicates an id already shown", () => {
    expect(toIds(appendOlder(ids(5, 2), [{ id: 2 }, { id: 1 }]))).toEqual([5, 4, 3, 2, 1]);
  });
});
