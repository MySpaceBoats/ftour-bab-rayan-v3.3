/**
 * Minimal PostgREST/supabase-js query-builder compatible layer over Cloudflare D1.
 * Lets the existing `supabase.from("t").select().eq()...` code run unchanged against
 * D1 tables (named `t_<table>`, schema generated from Supabase by scripts/gen-d1-from-supabase.mjs).
 *
 * Supported: select (columns, embedded relations, count/head), insert, update, upsert, delete
 * (with ON DELETE CASCADE emulation), eq/neq/gt/gte/lt/lte/like/ilike/is/in/not/filter/or/contains,
 * order/limit/range, single/maybeSingle. Results: { data, error, count } like supabase-js.
 * Pure: no tRPC / Supabase imports, testable with a fake D1.
 */
import type { D1Like, D1Stmt } from "./gallery-d1";

export type ColKind = "int" | "num" | "bool" | "json" | "text";
export interface TableMeta {
  cols: Record<string, ColKind>;
  pk: string[];
  fks: { col: string; ref: string; refCol: string }[];
  cascade: Record<string, string>;
  hasUpdatedAt: boolean;
}
export type MetaMap = Record<string, TableMeta>;
export interface RestError { message: string; code?: string; details?: string | null; hint?: string | null }
export interface RestResult<T = any> { data: T; error: RestError | null; count: number | null; status: number; statusText: string }

const MAX_VARS = 90; // D1 allows 100 bound parameters per statement
const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

type Cond =
  | { col: string; op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike"; val: unknown; neg?: boolean }
  | { col: string; op: "is"; val: null | boolean; neg?: boolean }
  | { col: string; op: "in"; val: unknown[]; neg?: boolean }
  | { col: string; op: "cs"; val: unknown[]; neg?: boolean }
  | { or: Cond[] };

interface SelectNode {
  cols: string[]; // "*" or names
  rels: { name: string; alias: string; inner: boolean; sub: SelectNode }[];
}

class RestFail extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

export function parseSelect(sel: string): SelectNode {
  const node: SelectNode = { cols: [], rels: [] };
  for (const item of splitTop(sel || "*")) {
    const m = item.match(/^(?:([A-Za-z_]+):)?([A-Za-z_]+)(!inner|![A-Za-z_]+)?\(([\s\S]*)\)$/);
    if (m) {
      node.rels.push({ alias: m[1] ?? m[2], name: m[2], inner: m[3] === "!inner", sub: parseSelect(m[4]) });
    } else {
      node.cols.push(item.replace(/\s+/g, ""));
    }
  }
  if (node.cols.length === 0) node.cols.push("*");
  return node;
}

export interface RestOpts {
  /** true when `table` is served by D1 (embedded relations must be too). */
  isD1: (table: string) => boolean;
}

export function createD1Rest(d: D1Like, meta: MetaMap, opts: RestOpts) {
  return { from: (table: string) => new Query(d, meta, opts, table) };
}

class Query implements PromiseLike<RestResult> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any;
  private conds: Cond[] = [];
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private limitN?: number;
  private offsetN?: number;
  private selectStr = "*";
  private countMode = false;
  private head = false;
  private returning = false;
  private singleMode: "single" | "maybe" | null = null;
  private onConflict?: string;

  constructor(private d: D1Like, private meta: MetaMap, private opts: RestOpts, private table: string) {
    if (!meta[table] || !opts.isD1(table)) throw new RestFail(`Table "${table}" is not served by D1`);
  }

  // ---- builder -----------------------------------------------------------
  select(cols = "*", o?: { count?: string; head?: boolean }) {
    if (this.op === "select") { this.selectStr = cols; } else { this.returning = true; this.selectStr = cols; }
    if (o?.count) this.countMode = true;
    if (o?.head) this.head = true;
    return this;
  }
  insert(rows: any) { this.op = "insert"; this.payload = rows; return this; }
  update(patch: any) { this.op = "update"; this.payload = patch; return this; }
  upsert(rows: any, o?: { onConflict?: string }) { this.op = "upsert"; this.payload = rows; this.onConflict = o?.onConflict; return this; }
  delete() { this.op = "delete"; return this; }

  eq(col: string, val: unknown) { this.conds.push({ col, op: "eq", val }); return this; }
  neq(col: string, val: unknown) { this.conds.push({ col, op: "neq", val }); return this; }
  gt(col: string, val: unknown) { this.conds.push({ col, op: "gt", val }); return this; }
  gte(col: string, val: unknown) { this.conds.push({ col, op: "gte", val }); return this; }
  lt(col: string, val: unknown) { this.conds.push({ col, op: "lt", val }); return this; }
  lte(col: string, val: unknown) { this.conds.push({ col, op: "lte", val }); return this; }
  like(col: string, val: string) { this.conds.push({ col, op: "like", val }); return this; }
  ilike(col: string, val: string) { this.conds.push({ col, op: "ilike", val }); return this; }
  is(col: string, val: null | boolean) { this.conds.push({ col, op: "is", val }); return this; }
  in(col: string, val: unknown[]) { this.conds.push({ col, op: "in", val }); return this; }
  contains(col: string, val: unknown[]) { this.conds.push({ col, op: "cs", val }); return this; }
  not(col: string, op: string, val: unknown) { this.conds.push(this.parseCond(col, op, val, true)); return this; }
  filter(col: string, op: string, val: unknown) { this.conds.push(this.parseCond(col, op, val)); return this; }
  or(expr: string) {
    this.conds.push({ or: splitTop(expr).map(part => {
      const m = part.match(/^([A-Za-z_]+)\.(not\.)?([a-z]+)\.([\s\S]*)$/);
      if (!m) throw new RestFail(`Unsupported or() expression: ${part}`);
      return this.parseCond(m[1], m[3], m[4], !!m[2]);
    }) });
    return this;
  }
  order(col: string, o?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ col, asc: o?.ascending !== false, nullsFirst: o?.nullsFirst });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.offsetN = from; this.limitN = to - from + 1; return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  returns() { return this; }

  private parseCond(col: string, op: string, raw: unknown, neg = false): Cond {
    const s = String(raw);
    switch (op) {
      case "eq": case "neq": case "gt": case "gte": case "lt": case "lte": case "like": case "ilike":
        return { col, op, val: raw, neg };
      case "is": return { col, op: "is", val: s === "null" ? null : s === "true", neg };
      case "in": {
        const inner = s.startsWith("(") ? s.slice(1, -1) : s;
        return { col, op: "in", val: inner.split(",").map(x => x.trim().replace(/^"|"$/g, "")), neg };
      }
      default: throw new RestFail(`Unsupported filter operator: ${op}`);
    }
  }

  // ---- execution ---------------------------------------------------------
  then<A = RestResult, B = never>(f?: ((v: RestResult) => A | PromiseLike<A>) | null, r?: ((e: any) => B | PromiseLike<B>) | null) {
    return this.exec().then(f, r);
  }

  private async exec(): Promise<RestResult> {
    try {
      const { rows, count } = await this.run();
      let data: any = rows;
      if (this.head) data = null;
      else if (this.singleMode) {
        if (rows.length === 1) data = rows[0];
        else if (rows.length === 0 && this.singleMode === "maybe") data = null;
        else {
          return {
            data: null, count, status: 406, statusText: "Not Acceptable",
            error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116", details: `The result contains ${rows.length} rows`, hint: null },
          };
        }
      } else if ((this.op === "insert" || this.op === "update" || this.op === "upsert" || this.op === "delete") && !this.returning) {
        data = null;
      }
      if (this.returning && this.op !== "select" && this.selectStr.trim() !== "*") {
        const keep = parseSelect(this.selectStr).cols;
        const pick = (r: any) => Object.fromEntries(Object.entries(r).filter(([k]) => keep.includes(k)));
        if (Array.isArray(data)) data = data.map(pick); else if (data) data = pick(data);
      }
      return { data, error: null, count, status: this.op === "insert" ? 201 : 200, statusText: "OK" };
    } catch (e) {
      const err = e as Error & { code?: string };
      const msg = err.message ?? String(e);
      const code = /UNIQUE constraint failed/i.test(msg) ? "23505" : /NOT NULL constraint failed/i.test(msg) ? "23502" : /CHECK constraint failed/i.test(msg) ? "23514" : /FOREIGN KEY/i.test(msg) ? "23503" : /^(PGRST|\d{5}$)/.test(err.code ?? "") ? err.code : undefined;
      return { data: null, count: null, status: 400, statusText: "Bad Request", error: { message: msg, code, details: null, hint: null } };
    }
  }

  private t(table = this.table) { return `"t_${table}"`; }

  private col(col: string, table = this.table) {
    if (!this.meta[table]?.cols[col]) throw new RestFail(`Unknown column "${col}" on "${table}"`);
    return `"${col}"`;
  }

  private bindVal(table: string, col: string, v: unknown): unknown {
    if (v === undefined) return null;
    if (v === null) return null;
    const kind = this.meta[table].cols[col];
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v instanceof Date) return v.toISOString();
    if (kind === "json" && typeof v !== "string") return JSON.stringify(v);
    if (kind === "json" && typeof v === "string") { try { JSON.parse(v); return v; } catch { return JSON.stringify(v); } }
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  }

  private condSql(c: Cond, table: string, params: unknown[]): string {
    if ("or" in c) return `(${c.or.map(x => this.condSql(x, table, params)).join(" OR ")})`;
    const col = this.col(c.col, table);
    const wrap = (s: string) => (c.neg ? `NOT (${s})` : s);
    switch (c.op) {
      case "is":
        return wrap(c.val === null ? `${col} IS NULL` : `${col} = ${c.val ? 1 : 0}`);
      case "in": {
        params.push(JSON.stringify(c.val.map(v => (typeof v === "boolean" ? (v ? 1 : 0) : v))));
        return wrap(`${col} IN (SELECT value FROM json_each(?))`);
      }
      case "cs": {
        params.push(JSON.stringify(c.val));
        return wrap(`NOT EXISTS (SELECT 1 FROM json_each(?) j WHERE j.value NOT IN (SELECT value FROM json_each(${col})))`);
      }
      case "eq":
        if (c.val === null) return wrap(`${col} IS NULL`);
        params.push(this.bindVal(table, c.col, c.val)); return wrap(`${col} = ?`);
      case "neq":
        if (c.val === null) return wrap(`${col} IS NOT NULL`);
        params.push(this.bindVal(table, c.col, c.val)); return wrap(`${col} != ?`);
      case "gt": params.push(this.bindVal(table, c.col, c.val)); return wrap(`${col} > ?`);
      case "gte": params.push(this.bindVal(table, c.col, c.val)); return wrap(`${col} >= ?`);
      case "lt": params.push(this.bindVal(table, c.col, c.val)); return wrap(`${col} < ?`);
      case "lte": params.push(this.bindVal(table, c.col, c.val)); return wrap(`${col} <= ?`);
      case "like": case "ilike":
        params.push(String(c.val)); return wrap(`${col} LIKE ? ESCAPE '\\'`);
    }
  }

  private whereSql(table: string, params: unknown[]) {
    if (!this.conds.length) return "";
    return " WHERE " + this.conds.map(c => this.condSql(c, table, params)).join(" AND ");
  }

  private orderSql() {
    if (!this.orders.length) return "";
    return " ORDER BY " + this.orders.map(o => {
      const col = this.col(o.col);
      // PostgREST default: NULLS LAST for ASC, NULLS FIRST for DESC
      const nullsFirst = o.nullsFirst ?? !o.asc;
      return `(${col} IS NULL) ${nullsFirst ? "DESC" : "ASC"}, ${col} ${o.asc ? "ASC" : "DESC"}`;
    }).join(", ");
  }

  private readRow(table: string, row: Record<string, any>) {
    const m = this.meta[table].cols;
    for (const [k, v] of Object.entries(row)) {
      const kind = m[k];
      if (v === null || v === undefined || !kind) continue;
      if (kind === "bool") row[k] = Boolean(Number(v));
      else if (kind === "json" && typeof v === "string") { try { row[k] = JSON.parse(v); } catch { /* keep raw */ } }
    }
    return row;
  }

  private async run(): Promise<{ rows: any[]; count: number | null }> {
    switch (this.op) {
      case "select": return this.runSelect();
      case "insert": case "upsert": return this.runInsert();
      case "update": return this.runUpdate();
      case "delete": return this.runDelete();
    }
  }

  // ---- select ------------------------------------------------------------
  private async runSelect(): Promise<{ rows: any[]; count: number | null }> {
    const tree = parseSelect(this.selectStr);
    const params: unknown[] = [];
    const where = this.whereSql(this.table, params);
    let count: number | null = null;
    if (this.countMode) {
      const r = await this.d.prepare(`SELECT COUNT(*) AS n FROM ${this.t()}${where}`).bind(...params).first<{ n: number }>();
      count = r?.n ?? 0;
    }
    if (this.head) return { rows: [], count };
    const rows = await this.fetchRows(tree, where, params, this.orderSql(), this.limitN, this.offsetN);
    return { rows, count };
  }

  private async fetchRows(tree: SelectNode, where: string, params: unknown[], order: string, limit?: number, offset?: number) {
    const m = this.meta[this.table];
    const wantAll = tree.cols.includes("*");
    const requested = wantAll ? null : tree.cols.map(c => c.split(/::|:/)[0]);
    // join keys needed by embedded relations even when not requested
    const need = new Set<string>(requested ?? []);
    const relPlans = tree.rels.map(rel => this.planRel(rel));
    for (const p of relPlans) need.add(p.parentCol);
    const colSql = wantAll ? "*" : [...need].map(c => this.col(c)).join(", ");
    let sql = `SELECT ${colSql} FROM ${this.t()}${where}${order}`;
    const p = [...params];
    if (limit !== undefined) { sql += " LIMIT ?"; p.push(limit); if (offset) { sql += " OFFSET ?"; p.push(offset); } }
    else if (offset) { sql += " LIMIT -1 OFFSET ?"; p.push(offset); }
    const { results } = await this.d.prepare(sql).bind(...p).all<Record<string, any>>();
    let rows = results.map(r => this.readRow(this.table, r));

    for (const plan of relPlans) {
      const keys = [...new Set(rows.map(r => r[plan.parentCol]).filter(v => v !== null && v !== undefined))];
      const child = new Query(this.d, this.meta, this.opts, plan.rel.name);
      const subTree = plan.rel.sub;
      let childRows: any[] = [];
      if (keys.length) {
        const cp: unknown[] = [JSON.stringify(keys)];
        const cw = ` WHERE ${child.col(plan.childCol, plan.rel.name)} IN (SELECT value FROM json_each(?))`;
        // join key must be fetched to group children, then dropped if not requested
        const sub: SelectNode = subTree.cols.includes("*") ? subTree : { ...subTree, cols: [...new Set([...subTree.cols, plan.childCol])] };
        childRows = await child.fetchRows(sub, cw, cp, "", undefined, undefined);
        if (!subTree.cols.includes("*") && !subTree.cols.includes(plan.childCol)) {
          // strip the helper join column after grouping (done below)
        }
      }
      const groups = new Map<unknown, any[]>();
      for (const c of childRows) {
        const k = c[plan.childCol];
        (groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
      }
      const strip = !subTree.cols.includes("*") && !subTree.cols.includes(plan.childCol);
      const clean = (c: any) => { if (strip) { const { [plan.childCol]: _, ...rest } = c; return rest; } return c; };
      for (const r of rows) {
        const matches = groups.get(r[plan.parentCol]) ?? [];
        r[plan.rel.alias] = plan.many ? matches.map(clean) : matches[0] ? clean(matches[0]) : null;
      }
      if (plan.rel.inner) rows = rows.filter(r => (plan.many ? r[plan.rel.alias].length > 0 : r[plan.rel.alias] !== null));
    }
    if (requested) {
      const keep = new Set(requested);
      const relAliases = new Set(tree.rels.map(r => r.alias));
      for (const r of rows) for (const k of Object.keys(r)) if (!keep.has(k) && !relAliases.has(k)) delete r[k];
    }
    return rows;
  }

  private planRel(rel: SelectNode["rels"][number]) {
    if (!this.meta[rel.name] || !this.opts.isD1(rel.name)) {
      throw new RestFail(`Embedded table "${rel.name}" is not served by D1 (migrate it together with "${this.table}")`);
    }
    const toOne = this.meta[this.table].fks.find(f => f.ref === rel.name);
    if (toOne) return { rel, many: false, parentCol: toOne.col, childCol: toOne.refCol };
    const toMany = this.meta[rel.name].fks.find(f => f.ref === this.table);
    if (toMany) return { rel, many: true, parentCol: toMany.refCol, childCol: toMany.col };
    throw new RestFail(`No relationship between "${this.table}" and "${rel.name}"`);
  }

  // ---- writes ------------------------------------------------------------
  private rowStmt(row: Record<string, any>, upsert: boolean): D1Stmt {
    const keys = Object.keys(row).filter(k => row[k] !== undefined);
    for (const k of keys) this.col(k);
    const vals = keys.map(k => this.bindVal(this.table, k, row[k]));
    let sql = keys.length
      ? `INSERT INTO ${this.t()} (${keys.map(k => `"${k}"`).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`
      : `INSERT INTO ${this.t()} DEFAULT VALUES`;
    if (upsert) {
      const target = (this.onConflict ? this.onConflict.split(",").map(s => s.trim()) : this.meta[this.table].pk);
      const upd = keys.filter(k => !target.includes(k));
      sql += ` ON CONFLICT (${target.map(k => this.col(k)).join(", ")}) ` + (upd.length
        ? `DO UPDATE SET ${upd.map(k => `"${k}" = excluded."${k}"`).join(", ")}${this.meta[this.table].hasUpdatedAt && !keys.includes("updated_at") ? `, "updated_at" = ${NOW_SQL}` : ""}`
        : "DO NOTHING");
    }
    return this.d.prepare(sql + " RETURNING *").bind(...vals);
  }

  private async runInsert() {
    const list: Record<string, any>[] = Array.isArray(this.payload) ? this.payload : [this.payload];
    if (list.length === 0) return { rows: [], count: null };
    const stmts = list.map(r => this.rowStmt(r, this.op === "upsert"));
    let results: any[][];
    if (stmts.length === 1) results = [(await stmts[0].all()).results];
    else results = ((await this.d.batch(stmts)) as any[]).map(r => r.results ?? []);
    return { rows: results.flat().map(r => this.readRow(this.table, r)), count: null };
  }

  private async runUpdate() {
    const patch = this.payload as Record<string, any>;
    const keys = Object.keys(patch).filter(k => patch[k] !== undefined);
    for (const k of keys) this.col(k);
    const sets = keys.map(k => `"${k}" = ?`);
    const params: unknown[] = keys.map(k => this.bindVal(this.table, k, patch[k]));
    if (this.meta[this.table].hasUpdatedAt && !keys.includes("updated_at")) sets.push(`"updated_at" = ${NOW_SQL}`);
    if (!sets.length) return { rows: [], count: null };
    const where = this.whereSql(this.table, params);
    const { results } = await this.d.prepare(`UPDATE ${this.t()} SET ${sets.join(", ")}${where} RETURNING *`).bind(...params).all<Record<string, any>>();
    return { rows: results.map(r => this.readRow(this.table, r)), count: null };
  }

  private async runDelete() {
    const params: unknown[] = [];
    const where = this.whereSql(this.table, params);
    // Each statement contains the parent's WHERE exactly once (nested in sub-selects), so params are reused as-is.
    const build = (table: string, w: string, returning: boolean): D1Stmt[] => {
      const out: D1Stmt[] = [];
      for (const [child, cm] of Object.entries(this.meta)) {
        for (const [col, parent] of Object.entries(cm.cascade)) {
          if (parent !== table || !this.opts.isD1(child)) continue;
          const fk = cm.fks.find(f => f.col === col && f.ref === table);
          out.push(...build(child, ` WHERE "${col}" IN (SELECT "${fk?.refCol ?? "id"}" FROM "t_${table}"${w})`, false));
        }
      }
      out.push(this.d.prepare(`DELETE FROM "t_${table}"${w}${returning ? " RETURNING *" : ""}`).bind(...params));
      return out;
    };
    const res = (await this.d.batch(build(this.table, where, true))) as any[];
    const last = res[res.length - 1];
    return { rows: (last?.results ?? []).map((r: any) => this.readRow(this.table, r)), count: null };
  }
}

export { RestFail };
