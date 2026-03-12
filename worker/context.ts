/**
 * Worker Context for tRPC
 * Creates context from Fetch Request for Cloudflare Workers
 */
import type { Env } from './index';
import { createClient } from '@supabase/supabase-js';

// User type matching the database schema
export interface WorkerUser {
  id: number;
  openId: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: 'user' | 'admin' | 'super_admin' | 'scanner' | 'admin_ops' | 'admin_boutique' | 'admin_dons' | 'admin_restaurant' | 'vue_restaurant' | 'manager_restaurant' | 'admin_patisserie' | 'admin_terroir' | 'admin_contenu' | 'admin_messages';
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

export interface WorkerContext {
  req: Request;
  env: Env;
  user: WorkerUser | null;
}

/**
 * Get user from Supabase token
 */
async function getUserFromToken(token: string, env: Env): Promise<WorkerUser | null> {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    // Get user data from database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('open_id', user.id)
      .single();

    if (dbError || !userData) {
      // Return basic user if not in database
      return {
        id: 0,
        openId: user.id,
        name: user.user_metadata?.name || null,
        email: user.email || '',
        phone: null,
        role: 'user',
        createdAt: new Date(user.created_at),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };
    }

    return {
      id: userData.id,
      openId: userData.open_id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      role: userData.role,
      createdAt: new Date(userData.created_at),
      updatedAt: new Date(userData.updated_at),
      lastSignedIn: new Date(userData.last_signed_in),
    };
  } catch (error) {
    console.error('[Worker Context] Auth error:', error);
    return null;
  }
}

/**
 * Create context from Fetch Request
 */
export async function createWorkerContext(req: Request, env: Env): Promise<WorkerContext> {
  let user: WorkerUser | null = null;

  try {
    // Get Authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = await getUserFromToken(token, env);
    }
  } catch (error) {
    console.error('[Worker Context] Error creating context:', error);
    user = null;
  }

  return { req, env, user };
}
