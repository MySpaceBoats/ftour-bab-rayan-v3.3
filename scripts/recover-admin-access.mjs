import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

function parseArgs(argv) {
  const args = {
    emails: [],
    role: 'super_admin',
    name: null,
    resetPasswords: false,
    createMissing: false,
    allUsers: false,
    forceRole: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === '--emails' && next) {
      args.emails = next
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      i += 1;
      continue;
    }

    if (current === '--role' && next) {
      args.role = next.trim();
      i += 1;
      continue;
    }

    if (current === '--name' && next) {
      args.name = next.trim();
      i += 1;
      continue;
    }

    if (current === '--reset-passwords') {
      args.resetPasswords = true;
      continue;
    }

    if (current === '--create-missing') {
      args.createMissing = true;
      continue;
    }

    if (current === '--all-users') {
      args.allUsers = true;
      continue;
    }

    if (current === '--force-role') {
      args.forceRole = true;
      continue;
    }

    if (current === '--dry-run') {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

function printUsage() {
  console.log(`\nUsage:\n  node scripts/recover-admin-access.mjs --emails "rsebbani@myspace.boats,user2@myspace.boats" [options]\n  node scripts/recover-admin-access.mjs --all-users [options]\n\nOptions:\n  --role <role>            Role used for newly-created users rows (default: super_admin)\n  --force-role             Also update role for existing rows to --role\n  --name <name>            Name to set when creating missing user rows\n  --reset-passwords        Generate and set temporary passwords in Supabase Auth\n  --create-missing         Create Auth + users rows when account is missing\n  --all-users              Run reconciliation for all Supabase Auth users\n  --dry-run                Print planned actions only\n\nRequired env vars:\n  SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY\n`);
}

async function getAllAuthUsers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const current = data?.users ?? [];
    users.push(...current);

    if (current.length < perPage) break;
    page += 1;
  }

  return users;
}

function buildTemporaryPassword() {
  return `Tmp-${crypto.randomBytes(9).toString('base64url')}!`;
}

async function ensureUserRow({ supabase, authUser, email, role, name, dryRun, forceRole }) {
  const { data: existingUserRow, error: selectError } = await supabase
    .from('users')
    .select('id, open_id, role, email, name')
    .eq('open_id', authUser.id)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existingUserRow) {
    const payload = { email };

    if (forceRole) {
      payload.role = role;
    }

    if (name) payload.name = name;

    if (dryRun) {
      console.log(`[DRY-RUN] update users row for ${email} (open_id=${authUser.id})`, payload);
      return;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(payload)
      .eq('open_id', authUser.id);

    if (updateError) throw updateError;
    console.log(`✅ users row updated for ${email} => role=${role}`);
    return;
  }

  const payload = {
    open_id: authUser.id,
    email,
    role,
    name: name || authUser.user_metadata?.name || null,
  };

  if (dryRun) {
    console.log(`[DRY-RUN] insert users row for ${email}`, payload);
    return;
  }

  const { error: insertError } = await supabase.from('users').insert(payload);
  if (insertError) throw insertError;

  console.log(`✅ users row created for ${email} => role=${role}`);
}

async function run() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  if (args.emails.length === 0 && !args.allUsers) {
    printUsage();
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authUsers = await getAllAuthUsers(supabase);
  const authUsersByEmail = new Map(
    authUsers
      .filter((u) => u.email)
      .map((u) => [u.email.toLowerCase(), u]),
  );

  const generatedPasswords = [];
  const emailsToProcess = args.allUsers
    ? Array.from(new Set(authUsers.map((u) => (u.email || '').toLowerCase()).filter(Boolean)))
    : args.emails;

  for (const email of emailsToProcess) {
    let authUser = authUsersByEmail.get(email);

    if (!authUser && args.createMissing) {
      const newPassword = buildTemporaryPassword();
      const payload = {
        email,
        password: newPassword,
        email_confirm: true,
        user_metadata: args.name ? { name: args.name } : undefined,
      };

      if (args.dryRun) {
        console.log(`[DRY-RUN] create auth user for ${email}`);
      } else {
        const { data, error } = await supabase.auth.admin.createUser(payload);
        if (error) throw error;
        authUser = data.user;
        generatedPasswords.push({ email, password: newPassword, reason: 'account_created' });
        console.log(`✅ auth user created for ${email}`);
      }
    }

    if (!authUser) {
      console.log(`⚠️ account not found in Supabase Auth: ${email}`);
      continue;
    }

    if (args.resetPasswords) {
      const temporaryPassword = buildTemporaryPassword();

      if (args.dryRun) {
        console.log(`[DRY-RUN] reset password for ${email}`);
      } else {
        const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
          password: temporaryPassword,
        });
        if (error) throw error;
        generatedPasswords.push({ email, password: temporaryPassword, reason: 'password_reset' });
        console.log(`✅ temporary password generated for ${email}`);
      }
    }

    await ensureUserRow({
      supabase,
      authUser,
      email,
      role: args.role,
      name: args.name,
      dryRun: args.dryRun,
      forceRole: args.forceRole,
    });
  }

  if (generatedPasswords.length > 0) {
    console.log('\n🔐 Temporary credentials (share securely):');
    for (const item of generatedPasswords) {
      console.log(`- ${item.email} (${item.reason}): ${item.password}`);
    }
  }

  console.log('\nDone.');
}

run().catch((error) => {
  console.error('Recovery failed:', error?.message || error);
  process.exit(1);
});
