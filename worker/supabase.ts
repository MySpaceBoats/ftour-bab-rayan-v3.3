/**
 * Supabase client for Cloudflare Workers
 * Creates clients with environment variables passed at runtime
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './index';
import { createD1Rest } from './d1-postgrest';
import { META } from './d1-meta.generated';
import { d1TableSet } from './d1-tables';
import { db as d1Binding } from './gallery-d1';

/**
 * Create Supabase admin client with service role key
 * BYPASSES Row Level Security - use only on server side
 */
export function createSupabaseAdmin(env: Env): SupabaseClient {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return routeToD1(sb, env);
}

/**
 * Tables listed in d1-tables.ts are served from D1 through a PostgREST-compatible adapter;
 * everything else (other tables, auth, storage, rpc) still goes to Supabase.
 */
function routeToD1(sb: SupabaseClient, env: Env): SupabaseClient {
  const tables = d1TableSet(env);
  if (tables.size === 0) return sb;
  const rest = createD1Rest(d1Binding(env), META, { isD1: t => tables.has(t) && t in META });
  return new Proxy(sb, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => (tables.has(table) && table in META ? rest.from(table) : target.from(table));
      }
      const v = Reflect.get(target, prop, target);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

/**
 * Create Supabase public client with anon key
 * Respects Row Level Security
 */
export function createSupabasePublic(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
