import { getSupabaseAdminClient } from './supabase';
import { normalizeUserRole } from './supabase-services';

// Get the admin client
const getAdminClient = () => {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error('Supabase admin client not configured');
  }
  return client;
};

// Types pour l'authentification
export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin' | 'scanner' | 'admin_ops' | 'admin_boutique' | 'admin_dons';
  name?: string;
  phone?: string;
  createdAt: Date;
}

export interface SignUpData {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// Inscription d'un nouvel utilisateur
export async function signUpUser(data: SignUpData): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    const supabaseAdmin = getAdminClient();
    
    // Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        name: data.name,
        phone: data.phone
      }
    });

    if (authError) {
      console.error('[Supabase Auth] Sign up error:', authError);
      return { user: null, error: authError.message };
    }

    if (!authData.user) {
      return { user: null, error: 'Erreur lors de la création du compte' };
    }

    // Créer l'entrée dans la table users
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        open_id: authData.user.id,
        email: data.email,
        name: data.name || null,
        phone: data.phone || null,
        role: 'user'
      });

    if (dbError) {
      console.error('[Supabase Auth] DB insert error:', dbError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return { user: null, error: 'Erreur lors de la création du profil' };
    }

    return {
      user: {
        id: authData.user.id,
        email: data.email,
        role: 'user',
        name: data.name,
        phone: data.phone,
        createdAt: new Date()
      },
      error: null
    };
  } catch (err) {
    console.error('[Supabase Auth] Unexpected error:', err);
    return { user: null, error: 'Erreur inattendue' };
  }
}

// Connexion d'un utilisateur
export async function signInUser(data: SignInData): Promise<{ user: AuthUser | null; session: string | null; error: string | null }> {
  try {
    const supabaseAdmin = getAdminClient();
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: data.email,
      password: data.password
    });

    if (authError) {
      console.error('[Supabase Auth] Sign in error:', authError);
      if (authError.message.includes('Invalid login credentials')) {
        return { user: null, session: null, error: 'Email ou mot de passe incorrect' };
      }
      return { user: null, session: null, error: authError.message };
    }

    if (!authData.user || !authData.session) {
      return { user: null, session: null, error: 'Erreur de connexion' };
    }

    // Récupérer les informations de l'utilisateur depuis la table users
    const { data: userData, error: dbError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('open_id', authData.user.id)
      .single();

    if (dbError || !userData) {
      // Si l'utilisateur n'existe pas dans la table users, le créer
      await supabaseAdmin
        .from('users')
        .insert({
          open_id: authData.user.id,
          email: data.email,
          name: authData.user.user_metadata?.name || null,
          phone: authData.user.user_metadata?.phone || null,
          role: 'user'
        });

      return {
        user: {
          id: authData.user.id,
          email: data.email,
          role: 'user',
          name: authData.user.user_metadata?.name,
          createdAt: new Date()
        },
        session: authData.session.access_token,
        error: null
      };
    }

    return {
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        name: userData.name,
        phone: userData.phone,
        createdAt: new Date(userData.created_at)
      },
      session: authData.session.access_token,
      error: null
    };
  } catch (err) {
    console.error('[Supabase Auth] Unexpected error:', err);
    return { user: null, session: null, error: 'Erreur inattendue' };
  }
}

// Déconnexion
export async function signOutUser(): Promise<{ error: string | null }> {
  try {
    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin.auth.signOut();
    if (error) {
      console.error('[Supabase Auth] Sign out error:', error);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    console.error('[Supabase Auth] Unexpected error:', err);
    return { error: 'Erreur inattendue' };
  }
}

// Récupérer l'utilisateur depuis le token
export async function getUserFromToken(accessToken: string): Promise<AuthUser | null> {
  try {
    const supabaseAdmin = getAdminClient();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    
    if (error || !user) {
      return null;
    }

    // Récupérer les informations complètes depuis la table users
    const { data: userData, error: dbError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('open_id', user.id)
      .single();

    if (dbError || !userData) {
      return {
        id: user.id,
        email: user.email || '',
        role: 'user',
        name: user.user_metadata?.name,
        createdAt: new Date(user.created_at)
      };
    }

    return {
      id: userData.open_id,
      email: userData.email,
      role: userData.role,
      name: userData.name,
      phone: userData.phone,
      createdAt: new Date(userData.created_at)
    };
  } catch (err) {
    console.error('[Supabase Auth] Get user error:', err);
    return null;
  }
}

// Créer un administrateur
export async function createAdmin(email: string, password: string, name?: string): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    const supabaseAdmin = getAdminClient();
    
    // Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) {
      console.error('[Supabase Auth] Create admin error:', authError);
      return { user: null, error: authError.message };
    }

    if (!authData.user) {
      return { user: null, error: 'Erreur lors de la création du compte admin' };
    }

    // Créer l'entrée dans la table users avec le rôle super_admin
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        open_id: authData.user.id,
        email,
        name: name || null,
        role: 'super_admin'
      });

    if (dbError) {
      console.error('[Supabase Auth] DB insert error:', dbError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return { user: null, error: 'Erreur lors de la création du profil admin' };
    }

    return {
      user: {
        id: authData.user.id,
        email,
        role: 'super_admin',
        name,
        createdAt: new Date()
      },
      error: null
    };
  } catch (err) {
    console.error('[Supabase Auth] Unexpected error:', err);
    return { user: null, error: 'Erreur inattendue' };
  }
}

// Mettre à jour le rôle d'un utilisateur
export async function updateUserRole(userId: string, role: AuthUser['role']): Promise<{ error: string | null }> {
  try {
    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from('users')
      .update({ role: normalizeUserRole(role) ?? role })
      .eq('open_id', userId);

    if (error) {
      console.error('[Supabase Auth] Update role error:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    console.error('[Supabase Auth] Unexpected error:', err);
    return { error: 'Erreur inattendue' };
  }
}

// Lister tous les utilisateurs
export async function listUsers(): Promise<{ users: AuthUser[]; error: string | null }> {
  try {
    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase Auth] List users error:', error);
      return { users: [], error: error.message };
    }

    interface UserRow {
      id: string;
      email: string;
      role: AuthUser['role'];
      name?: string;
      phone?: string;
      created_at: string;
    }

    return {
      users: (data || []).map((u: UserRow) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        name: u.name,
        phone: u.phone,
        createdAt: new Date(u.created_at)
      })),
      error: null
    };
  } catch (err) {
    console.error('[Supabase Auth] Unexpected error:', err);
    return { users: [], error: 'Erreur inattendue' };
  }
}
