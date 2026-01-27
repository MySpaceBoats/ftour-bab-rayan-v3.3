import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgnzhrlumlydmseusnbo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function listAndFixGoodies() {
  console.log('=== Liste des produits dans Supabase ===');
  
  // Lister tous les produits
  const { data: goodies, error } = await supabase
    .from('goodies')
    .select('*')
    .order('id');
  
  if (error) {
    console.error('Erreur:', error.message);
    return;
  }
  
  console.log(`Nombre de produits: ${goodies?.length || 0}`);
  
  if (goodies && goodies.length > 0) {
    goodies.forEach(g => {
      console.log(`- ID: ${g.id}, Nom: ${g.name}, Actif: ${g.is_active}, Prix: ${g.price}`);
    });
  }
  
  // Identifier les produits fantômes (ceux qui n'ont pas de nom ou sont vides)
  const phantomGoodies = goodies?.filter(g => !g.name || g.name.trim() === '') || [];
  
  if (phantomGoodies.length > 0) {
    console.log(`\n=== Suppression de ${phantomGoodies.length} produit(s) fantôme(s) ===`);
    
    for (const phantom of phantomGoodies) {
      console.log(`Suppression du produit ID: ${phantom.id}`);
      
      // Supprimer les variantes associées
      await supabase.from('goodie_variants').delete().eq('goodie_id', phantom.id);
      
      // Supprimer le produit
      const { error: deleteError } = await supabase.from('goodies').delete().eq('id', phantom.id);
      
      if (deleteError) {
        console.error(`Erreur suppression ID ${phantom.id}:`, deleteError.message);
      } else {
        console.log(`✅ Produit ID ${phantom.id} supprimé`);
      }
    }
  } else {
    console.log('\nAucun produit fantôme détecté (sans nom).');
    console.log('Veuillez indiquer les IDs des produits à supprimer si nécessaire.');
  }
}

listAndFixGoodies().catch(console.error);
