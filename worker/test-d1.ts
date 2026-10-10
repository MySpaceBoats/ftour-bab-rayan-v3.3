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

/** gallery_albums + gallery_photos DDL (offline mirror of the D1 gallery schema). */
export const GALLERY_SCHEMA = `
CREATE TABLE gallery_albums (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0, cover_photo_id TEXT,
  status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE gallery_photos (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, title TEXT, description TEXT, event_date TEXT,
  tags TEXT NOT NULL DEFAULT '[]', album_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  is_featured TEXT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft',
  image_original_url TEXT NOT NULL, image_thumb_url TEXT NOT NULL, image_medium_url TEXT,
  storage_path TEXT NOT NULL, thumb_storage_path TEXT, medium_storage_path TEXT,
  width INTEGER, height INTEGER, size_bytes INTEGER NOT NULL, mime_type TEXT NOT NULL, uploaded_by TEXT,
  validation_email TEXT, validation_token TEXT, validation_sent_at TEXT, validated_at TEXT);`;
