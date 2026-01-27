import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgnzhrlumlydmseusnbo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function deleteGoodies() {
  const idsToDelete = [1, 2];
  
  console.log('=== Suppression des produits ===');
  
  for (const id of idsToDelete) {
    // Supprimer les order_items associés
    await supabase.from('order_items').delete().eq('goodie_id', id);
    
    // Supprimer les variantes associées
    await supabase.from('goodie_variants').delete().eq('goodie_id', id);
    
    // Supprimer le produit
    const { error } = await supabase.from('goodies').delete().eq('id', id);
    
    if (error) {
      console.error(`Erreur suppression ID ${id}:`, error.message);
    } else {
      console.log(`✅ Produit ID ${id} supprimé`);
    }
  }
  
  // Vérifier
  const { data: remaining } = await supabase.from('goodies').select('id, name');
  console.log(`\nProduits restants: ${remaining?.length || 0}`);
}

deleteGoodies().catch(console.error);
