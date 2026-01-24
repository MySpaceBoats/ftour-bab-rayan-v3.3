import { describe, expect, it } from 'vitest';
import { getSupabaseAdminClient, getSupabasePublicClient, testSupabaseConnection } from './supabase';

describe('Supabase Configuration', () => {
  it('should have SUPABASE_URL configured', () => {
    expect(process.env.SUPABASE_URL).toBeDefined();
    expect(process.env.SUPABASE_URL).toContain('supabase.co');
  });

  it('should have SUPABASE_ANON_KEY configured', () => {
    expect(process.env.SUPABASE_ANON_KEY).toBeDefined();
    expect(process.env.SUPABASE_ANON_KEY!.length).toBeGreaterThan(20);
  });

  it('should have SUPABASE_SERVICE_ROLE_KEY configured', () => {
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY!.length).toBeGreaterThan(20);
  });

  it('should create public client successfully', () => {
    const client = getSupabasePublicClient();
    expect(client).not.toBeNull();
  });

  it('should create admin client successfully', () => {
    const client = getSupabaseAdminClient();
    expect(client).not.toBeNull();
  });

  it('should connect to Supabase successfully', async () => {
    const result = await testSupabaseConnection();
    // Connection is successful even if tables don't exist yet (PGRST205)
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Supabase connection error:', result.error);
    }
  });
});
