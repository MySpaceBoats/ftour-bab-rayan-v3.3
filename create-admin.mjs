import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgnzhrlumlydmseusnbo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdmin() {
  const email = 'admin@ftourbabrayan.ma';
  const password = 'f;a;vKQ.DgGe';
  
  console.log('Creating super admin:', email);
  
  // Créer l'utilisateur dans Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true
  });
  
  if (authError) {
    console.log('Auth error:', authError.message);
    
    // Si l'utilisateur existe déjà, mettre à jour son rôle
    if (authError.message.includes('already been registered')) {
      console.log('User already exists, updating role...');
      
      // Mettre à jour le rôle dans la table users
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'super_admin' })
        .eq('email', email);
      
      if (updateError) {
        console.log('Update error:', updateError.message);
        
        // Si l'utilisateur n'existe pas dans la table users, le créer
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find(u => u.email === email);
        
        if (existingUser) {
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              open_id: existingUser.id,
              email: email,
              name: 'Admin Ftour',
              role: 'super_admin'
            });
          
          if (insertError) {
            console.log('Insert error:', insertError.message);
          } else {
            console.log('✅ User created in users table with super_admin role');
          }
        }
      } else {
        console.log('✅ User role updated to super_admin');
      }
      return;
    }
    return;
  }
  
  console.log('Auth user created:', authData.user.id);
  
  // Créer l'entrée dans la table users avec le rôle super_admin
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      open_id: authData.user.id,
      email: email,
      name: 'Admin Ftour',
      role: 'super_admin'
    })
    .select()
    .single();
    
  if (userError) {
    console.log('User table error:', userError.message);
    return;
  }
  
  console.log('✅ Super admin created successfully!');
  console.log('User:', userData);
}

createAdmin().catch(console.error);
