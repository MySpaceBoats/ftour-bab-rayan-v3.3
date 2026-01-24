import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables validation
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.warn('[Supabase] SUPABASE_URL is not set');
}

if (!SUPABASE_ANON_KEY) {
  console.warn('[Supabase] SUPABASE_ANON_KEY is not set');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Supabase] SUPABASE_SERVICE_ROLE_KEY is not set');
}

// ============================================
// PUBLIC CLIENT (for RLS-protected operations)
// Uses anon key - respects Row Level Security
// ============================================
let _supabasePublic: SupabaseClient | null = null;

export function getSupabasePublicClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  
  if (!_supabasePublic) {
    _supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  
  return _supabasePublic;
}

// ============================================
// ADMIN CLIENT (for server-side operations)
// Uses service_role key - BYPASSES Row Level Security
// NEVER expose this to the client/browser!
// ============================================
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  
  return _supabaseAdmin;
}

// ============================================
// CONNECTION TEST
// ============================================
export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseAdminClient();
  
  if (!client) {
    return { success: false, error: 'Supabase client not configured' };
  }
  
  try {
    // Test connection by querying the schema
    const { error } = await client.from('volunteers').select('id').limit(1);
    
    // If table doesn't exist yet, that's expected during setup
    // PGRST205 = table not found in schema cache (Supabase/PostgREST)
    // 42P01 = undefined_table (Postgres)
    if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
      return { success: true }; // Table doesn't exist yet, but connection works
    }
    
    // PGRST116 = no rows returned (also OK)
    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================
// DATABASE TYPES (generated from schema)
// ============================================
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          open_id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          login_method: string | null;
          role: 'user' | 'admin' | 'super_admin' | 'admin_operations' | 'admin_boutique' | 'admin_dons' | 'scanner';
          created_at: string;
          updated_at: string;
          last_signed_in: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      ramadan_days: {
        Row: {
          id: number;
          day_number: number;
          date: string;
          hijri_date: string | null;
          capacity: number;
          registered_count: number;
          is_open: boolean;
          iftar_time: string | null;
          location: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ramadan_days']['Row'], 'id' | 'created_at' | 'updated_at' | 'registered_count'>;
        Update: Partial<Database['public']['Tables']['ramadan_days']['Insert']>;
      };
      volunteers: {
        Row: {
          id: number;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          city: string | null;
          day_id: number;
          qr_token: string;
          qr_status: 'generated' | 'validated' | 'expired' | 'invalid';
          status: 'registered' | 'confirmed' | 'present' | 'absent' | 'cancelled';
          scanned_at: string | null;
          scanned_by: number | null;
          accepted_terms: boolean;
          email_sent: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['volunteers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['volunteers']['Insert']>;
      };
      checkins: {
        Row: {
          id: number;
          volunteer_id: number;
          token: string;
          scanned_at: string;
          validated_by: number | null;
          validation_mode: 'scan' | 'manual';
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['checkins']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['checkins']['Insert']>;
      };
      goodies: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          price: string;
          image_url: string | null;
          category: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['goodies']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['goodies']['Insert']>;
      };
      goodie_variants: {
        Row: {
          id: number;
          goodie_id: number;
          size: string | null;
          color: string | null;
          stock: number;
          price_modifier: string;
          is_available: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['goodie_variants']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['goodie_variants']['Insert']>;
      };
      orders: {
        Row: {
          id: number;
          order_reference: string;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          total_amount: string;
          status: 'reserved' | 'confirmed' | 'paid' | 'delivered' | 'cancelled';
          pickup_date: string | null;
          pickup_location: string | null;
          notes: string | null;
          processed_by: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      order_items: {
        Row: {
          id: number;
          order_id: number;
          goodie_id: number;
          variant_id: number | null;
          quantity: number;
          unit_price: string;
          total_price: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };
      donations: {
        Row: {
          id: number;
          donation_reference: string;
          donor_name: string;
          donor_email: string;
          donor_phone: string | null;
          amount: string;
          payment_method: 'transfer' | 'on_site';
          status: 'promised' | 'pending' | 'received' | 'cancelled';
          message: string | null;
          is_anonymous: boolean;
          accepts_updates: boolean;
          processed_by: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['donations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['donations']['Insert']>;
      };
      contact_messages: {
        Row: {
          id: number;
          name: string;
          email: string;
          phone: string | null;
          subject: string | null;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['contact_messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['contact_messages']['Insert']>;
      };
    };
  };
}
