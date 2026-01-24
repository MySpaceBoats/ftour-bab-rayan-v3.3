import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgnzhrlumlydmseusnbo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdmin() {
  // Créer l'utilisateur dans Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'rsebbani@myspace.boats',
    password: '#10Love8Joy3Harmony',
    email_confirm: true
  });
  
  if (authError) {
    console.log('Auth error:', authError.message);
    return;
  }
  
  console.log('Auth user created:', authData.user.id);
  
  // Créer l'entrée dans la table users avec le rôle super_admin
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email: 'rsebbani@myspace.boats',
      name: 'Admin Bab Rayan',
      role: 'super_admin'
    })
    .select()
    .single();
    
  if (userError) {
    console.log('User table error:', userError.message);
    return;
  }
  
  console.log('User created in table:', userData);
}

createAdmin().catch(console.error);
