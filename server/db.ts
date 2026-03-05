import { ENV } from './_core/env';
import { upsertUserSupabase, getUserByOpenIdSupabase } from './supabase-services';

// ============================================
// USER HELPERS (Supabase)
// ============================================

export interface InsertUser {
  openId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  loginMethod?: string | null;
  role?: 'user' | 'admin' | 'super_admin' | 'admin_ops' | 'admin_boutique' | 'admin_dons' | 'scanner' | 'admin_restaurant' | 'vue_restaurant' | 'manager_restaurant' | 'admin_patisserie' | 'admin_terroir' | 'admin_contenu' | 'admin_messages';
  lastSignedIn?: Date;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  try {
    // Determine role - owner gets super_admin
    let role = user.role;
    if (!role && user.openId === ENV.ownerOpenId) {
      role = 'super_admin';
    }

    await upsertUserSupabase({
      openId: user.openId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      loginMethod: user.loginMethod,
      role: role,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  return getUserByOpenIdSupabase(openId);
}

// Re-export generateSecureToken for QR code generation
export { generateSecureToken as generateQrToken } from './qrcode';
