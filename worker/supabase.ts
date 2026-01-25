/**
 * Supabase client for Cloudflare Workers
 * Creates clients with environment variables passed at runtime
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './index';

/**
 * Create Supabase admin client with service role key
 * BYPASSES Row Level Security - use only on server side
 */
export function createSupabaseAdmin(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
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
