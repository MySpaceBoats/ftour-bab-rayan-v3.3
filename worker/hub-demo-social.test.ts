/** Hermetic check of the friends/follows demo seed and its cleanup (social.sql applied before the seed). */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { DEMO_DOMAIN, cleanupSql, seedSql } from "../scripts/hub-demo/build";

interface Stmt { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[] }
interface Db { exec(sql: string): void; prepare(sql: string): Stmt }
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Db };

const SCHEMA = ["schema.generated.sql", "hub.sql", "marketplace.sql", "stay.sql", "pro.sql", "meetup.sql", "social.sql", "logic.sql"];
function freshDb(): Db {
  const db = new DatabaseSync(":memory:");
  for (const f of SCHEMA) db.exec(readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8"));
  return db;
}
const n = (db: Db, sql: string) => (db.prepare(sql).get() as { n: number }).n;
const IS_DEMO = (col: string) => `${col} IN (SELECT id FROM hub_members WHERE email LIKE '%@${DEMO_DOMAIN}')`;

describe("hub demo seed: friends and follows", () => {
  it("states social.sql must be applied first", () => {
    expect(seedSql().split("\n")[0]).toMatch(/social\.sql.*AVANT/);
  });

  it("seeds accepted and pending friendships and follows, all among demo members", () => {
    const db = freshDb();
    db.exec(seedSql());
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_friendships WHERE status='accepted'")).toBeGreaterThanOrEqual(8);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_friendships WHERE status='pending'")).toBeGreaterThanOrEqual(2);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_follows WHERE favorite=1")).toBeGreaterThanOrEqual(3);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_friendships WHERE requester_id = addressee_id")).toBe(0);
    expect(n(db, `SELECT COUNT(*) AS n FROM hub_friendships WHERE NOT (${IS_DEMO("requester_id")} AND ${IS_DEMO("addressee_id")})`)).toBe(0);
    expect(n(db, `SELECT COUNT(*) AS n FROM hub_follows WHERE NOT (${IS_DEMO("follower_id")} AND ${IS_DEMO("followee_id")})`)).toBe(0);
    // every accepted friendship implies both follows
    expect(n(db, `SELECT COUNT(*) AS n FROM hub_friendships f WHERE f.status='accepted' AND (
      NOT EXISTS (SELECT 1 FROM hub_follows WHERE follower_id=f.requester_id AND followee_id=f.addressee_id) OR
      NOT EXISTS (SELECT 1 FROM hub_follows WHERE follower_id=f.addressee_id AND followee_id=f.requester_id))`)).toBe(0);
  });

  it("is idempotent when the seed is replayed", () => {
    const db = freshDb();
    db.exec(seedSql());
    const a = [n(db, "SELECT COUNT(*) AS n FROM hub_friendships"), n(db, "SELECT COUNT(*) AS n FROM hub_follows")];
    db.exec(seedSql());
    expect([n(db, "SELECT COUNT(*) AS n FROM hub_friendships"), n(db, "SELECT COUNT(*) AS n FROM hub_follows")]).toEqual(a);
  });

  it("cleanup removes every relation involving a demo member, including with real members, and keeps real-only ones", () => {
    const db = freshDb();
    db.exec(seedSql());
    db.exec(`INSERT INTO hub_members (email, display_name) VALUES ('r1@example.org','R1'),('r2@example.org','R2');`);
    const id = (e: string) => (db.prepare("SELECT id FROM hub_members WHERE email = ?").get(e) as { id: number }).id;
    const [r1, r2, y] = [id("r1@example.org"), id("r2@example.org"), id(`yasmine@${DEMO_DOMAIN}`)];
    db.exec(`INSERT INTO hub_friendships (requester_id,addressee_id,status,created_at) VALUES (${r1},${y},'pending','2026-01-01'),(${r1},${r2},'accepted','2026-01-01');
             INSERT INTO hub_follows (follower_id,followee_id,favorite,created_at) VALUES (${y},${r1},0,'2026-01-01'),(${r1},${y},1,'2026-01-01'),(${r1},${r2},0,'2026-01-01');`);
    db.exec(cleanupSql());
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_friendships")).toBe(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_follows")).toBe(1);
    expect(n(db, `SELECT COUNT(*) AS n FROM hub_members WHERE email LIKE '%@${DEMO_DOMAIN}'`)).toBe(0);
  });
});
