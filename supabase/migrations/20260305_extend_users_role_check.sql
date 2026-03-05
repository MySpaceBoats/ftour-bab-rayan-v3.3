ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (
    role IN (
      'user',
      'admin',
      'super_admin',
      'admin_ops',
      'admin_boutique',
      'admin_dons',
      'scanner',
      'admin_restaurant',
      'admin_patisserie',
      'admin_terroir',
      'admin_contenu',
      'admin_messages',
      'vue_restaurant',
      'manager_restaurant',
      'admin_operations'
    )
  );
