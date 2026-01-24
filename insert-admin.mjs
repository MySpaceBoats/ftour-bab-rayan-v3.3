import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgnzhrlumlydmseusnbo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function insertAdmin() {
  // Insérer l'utilisateur dans la table users
  const { data, error } = await supabase
    .from('users')
    .insert({
      open_id: 'dc7fc59d-8691-4532-9d03-529d0b8d7305',
      email: 'rsebbani@myspace.boats',
      name: 'Admin Bab Rayan',
      role: 'super_admin'
    })
    .select()
    .single();
    
  if (error) {
    console.log('Error:', error.message);
    
    // Si l'utilisateur existe déjà, mettre à jour son rôle
    if (error.code === '23505') {
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({ role: 'super_admin', name: 'Admin Bab Rayan' })
        .eq('open_id', 'dc7fc59d-8691-4532-9d03-529d0b8d7305')
        .select()
        .single();
        
      if (updateError) {
        console.log('Update error:', updateError.message);
      } else {
        console.log('User updated:', updateData);
      }
    }
    return;
  }
  
  console.log('User created:', data);
}

insertAdmin().catch(console.error);
