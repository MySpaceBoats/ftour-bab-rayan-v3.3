/** Shared test helpers: an in-memory SQLite exposed as a D1Like, preloaded with the hub + pro schemas. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
export type Sqlite = InstanceType<typeof DatabaseSync>;

export function fakeD1(sqlite: Sqlite): D1Like {
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as any[])) as any[] }),
    first: async () => ((sqlite.prepare(sql).get(...(params as any[])) as any) ?? null),
    run: async () => sqlite.prepare(sql).run(...(params as any[])),
  });
  return {
    prepare: sql => stmt(sql),
    batch: async s => {
      sqlite.exec("BEGIN");
      try { for (const x of s) await x.run(); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
      return [];
    },
  };
}

/** Fresh database: t_volunteers stub + hub.sql + pro.sql. */
export function openDb(): Sqlite {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  for (const f of ["hub.sql", "pro.sql"]) sqlite.exec(readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8"));
  return sqlite;
}
