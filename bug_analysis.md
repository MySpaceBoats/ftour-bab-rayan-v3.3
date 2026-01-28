# Analyse des bugs 7 et 8

## Bug 7: Produit disparaît du catalogue même s'il reste en stock
- La page goodies affiche seulement 1 produit (T-shirt Ftour Bab Rayan)
- Il y a 3 commandes dans l'admin
- Le problème pourrait être lié à la gestion du stock ou au filtre isActive

## Bug 8: Produit commandé n'apparaît pas parmi les commandes
- Les commandes apparaissent bien dans l'admin (3 commandes visibles)
- Ce bug semble résolu ou concerne un cas spécifique

## Actions à vérifier:
1. Vérifier si d'autres produits existent dans la base de données
2. Vérifier le champ isActive des produits
3. Vérifier si le stock est correctement géré
