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
// AUTO-MIGRATION: ensure volunteer_slots column exists
// ============================================
let _migrationDone = false;
export let volunteerSlotsColumnExists = false;

export async function ensureVolunteerSlotsColumn(): Promise<void> {
  if (_migrationDone) return;
  _migrationDone = true;

  const client = getSupabaseAdminClient();
  if (!client) {
    console.warn('[Migration] Supabase not configured, skipping volunteer_slots check');
    return;
  }

  try {
    // Check if the column exists by trying a select
    const { error: testError } = await client
      .from('volunteers')
      .select('volunteer_slots')
      .limit(1);

    if (testError && (testError.message?.includes('volunteer_slots') || testError.code === '42703' || testError.code === 'PGRST204')) {
      console.error('='.repeat(70));
      console.error('[MIGRATION REQUIRED] The volunteer_slots column is MISSING');
      console.error('[MIGRATION REQUIRED] Slots will NOT be saved until you run:');
      console.error('');
      console.error("  ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS volunteer_slots JSONB DEFAULT '[]'::jsonb;");
      console.error('');
      console.error('[MIGRATION REQUIRED] Run this in the Supabase SQL Editor:');
      console.error('  https://supabase.com/dashboard → SQL Editor');
      console.error('='.repeat(70));
      volunteerSlotsColumnExists = false;
    } else {
      console.log('[Migration] volunteer_slots column OK');
      volunteerSlotsColumnExists = true;
    }
  } catch (err) {
    console.error('[Migration] Error checking volunteer_slots column:', err);
  }
}

// ============================================
// AUTO-MIGRATION: ensure pastries table exists
// ============================================
let _pastriesMigrationDone = false;
export let pastriesTableExists = false;

export async function ensurePastriesTable(): Promise<void> {
  if (_pastriesMigrationDone) return;
  _pastriesMigrationDone = true;

  const client = getSupabaseAdminClient();
  if (!client) {
    console.warn('[Migration] Supabase not configured, skipping pastries table check');
    return;
  }

  try {
    const { error: testError } = await client
      .from('pastries')
      .select('id')
      .limit(1);

    if (testError && (testError.code === 'PGRST204' || testError.code === '42P01' || testError.message?.includes('schema cache') || testError.message?.includes('does not exist'))) {
      console.error('='.repeat(70));
      console.error('[MIGRATION REQUIRED] The "pastries" table is MISSING from the database');
      console.error('[MIGRATION REQUIRED] Pastry features will NOT work until you run the migration.');
      console.error('');
      console.error('[MIGRATION REQUIRED] Run this file in the Supabase SQL Editor:');
      console.error('  supabase/migrations/add_pastry_and_qr_tables.sql');
      console.error('');
      console.error('[MIGRATION REQUIRED] Or run this SQL directly:');
      console.error('  CREATE TABLE IF NOT EXISTS pastries (');
      console.error('    id SERIAL PRIMARY KEY,');
      console.error('    name VARCHAR(255) NOT NULL,');
      console.error('    description TEXT,');
      console.error('    price DECIMAL(10,2) NOT NULL,');
      console.error('    image_url TEXT,');
      console.error('    category VARCHAR(100),');
      console.error('    active BOOLEAN NOT NULL DEFAULT true,');
      console.error('    sort_order INTEGER NOT NULL DEFAULT 0,');
      console.error('    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),');
      console.error('    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      console.error('  );');
      console.error('');
      console.error('[MIGRATION REQUIRED] Then reload the PostgREST schema cache:');
      console.error("  NOTIFY pgrst, 'reload schema';");
      console.error('='.repeat(70));
      pastriesTableExists = false;
    } else {
      console.log('[Migration] pastries table OK');
      pastriesTableExists = true;
    }
  } catch (err) {
    console.error('[Migration] Error checking pastries table:', err);
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
          role: 'user' | 'admin' | 'super_admin' | 'admin_ops' | 'admin_boutique' | 'admin_dons' | 'scanner' | 'admin_restaurant' | 'admin_patisserie' | 'admin_terroir' | 'admin_contenu' | 'admin_messages';
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
          confirmed_at: string | null;
          scanned_at: string | null;
          scanned_by: number | null;
          volunteer_slots: string[] | null;
          accepted_terms: boolean;
          email_sent: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['volunteers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['volunteers']['Insert']>;
      };
      volunteer_group_requests: {
        Row: {
          id: number;
          group_name: string;
          responsible_name: string;
          responsible_email: string;
          responsible_phone: string;
          estimated_size: number | null;
          day_id: number;
          volunteer_slots: string[];
          file_name: string;
          file_base64: string;
          status: 'pending' | 'validated' | 'refused';
          rejection_reason: string | null;
          reviewed_by: number | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['volunteer_group_requests']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['volunteer_group_requests']['Insert']>;
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
          stock: number;
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
          delivery_mode: string;
          delivery_fee: string;
          delivery_address: string | null;
          delivery_phone: string | null;
          delivery_instructions: string | null;
          delivered_at: string | null;
          payment_method: string | null;
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
