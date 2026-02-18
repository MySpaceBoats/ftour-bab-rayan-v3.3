import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgnzhrlumlydmseusnbo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const USERS = [
  { email: 'nayla@ftourbabrayan.ma', name: 'Nayla', role: 'admin' },
  { email: 'hind@ftourbabrayan.ma', name: 'Hind', role: 'admin' },
  { email: 'younes@ftourbabrayan.ma', name: 'Younes', role: 'admin' },
  { email: 'khaoula@ftourbabrayan.ma', name: 'Khaoula', role: 'admin_dons' },
  { email: 'kamal@ftourbabrayan.ma', name: 'Kamal', role: 'admin_restaurant' },
  { email: 'rita@ftourbabrayan.ma', name: 'Rita', role: 'admin_restaurant' },
  { email: 'said@ftourbabrayan.ma', name: 'Said', role: 'admin_patisserie' },
];

const PASSWORD = '#ftourbabrayan';

async function seedUser({ email, name, role }) {
  console.log(`\n--- Creating ${email} (${role}) ---`);

  // 1. Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });

  let userId;

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log(`  Auth: user already exists, looking up...`);

      // Find existing auth user
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find(u => u.email === email);

      if (!existing) {
        console.error(`  ERROR: could not find existing auth user for ${email}`);
        return;
      }

      userId = existing.id;

      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: PASSWORD,
      });
      if (updateError) {
        console.log(`  Warning: could not update password: ${updateError.message}`);
      } else {
        console.log(`  Auth: password updated`);
      }
    } else {
      console.error(`  Auth error: ${authError.message}`);
      return;
    }
  } else {
    userId = authData.user.id;
    console.log(`  Auth: user created (${userId})`);
  }

  // 2. Upsert user in the users table
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('open_id', userId)
    .single();

  if (existingUser) {
    // Update role
    const { error: updateError } = await supabase
      .from('users')
      .update({ role, name })
      .eq('open_id', userId);

    if (updateError) {
      console.error(`  DB update error: ${updateError.message}`);
    } else {
      console.log(`  DB: role updated to ${role}`);
    }
  } else {
    // Insert new user record
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        open_id: userId,
        email,
        name,
        role,
      });

    if (insertError) {
      console.error(`  DB insert error: ${insertError.message}`);
    } else {
      console.log(`  DB: user record created with role ${role}`);
    }
  }

  console.log(`  Done: ${email} -> ${role}`);
}

async function main() {
  console.log('=== Seeding user accounts ===');
  console.log(`Users to create: ${USERS.length}`);
  console.log(`Password: ${PASSWORD}\n`);

  for (const user of USERS) {
    await seedUser(user);
  }

  console.log('\n=== Seeding complete ===');
}

main().catch(console.error);
