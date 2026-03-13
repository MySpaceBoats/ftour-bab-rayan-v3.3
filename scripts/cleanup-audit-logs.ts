import { getSupabaseAdminClient } from "../server/supabase";

async function main() {
  const client = getSupabaseAdminClient();
  if (!client) {
    console.error("Supabase non configuré");
    process.exit(1);
  }

  const { data, error } = await client.rpc("cleanup_old_audit_logs");
  if (error) {
    console.error("Erreur nettoyage audit logs:", error.message);
    process.exit(1);
  }

  console.log(`[Audit] Logs supprimés (>12 mois): ${Number(data ?? 0)}`);
}

main();
