# Implémentation Complète : Système Unifié Goodies/Pâtisserie/Dons/Ftour

## Phase 1 : Schéma BDD Unifié
- [ ] Ajouter champs à `orders` : channel (online/on_site_qr/on_site_admin), module_type (goodies/pastry/donation/ftour)
- [ ] Ajouter champs à `orders` : business_status (reserved/confirmed/handed/checked_in/cancelled)
- [ ] Ajouter champs à `pastry_orders` : channel, module_type
- [ ] Ajouter champs à `donations` : channel, module_type, business_status
- [ ] Vérifier cohérence avec `orders` existant
- [ ] Migrer avec `pnpm db:push`

## Phase 2 : Services Supabase Pâtisserie (✅ Complété)
- [x] getPastriesSupabase()
- [x] createPastryOrderSupabase()
- [x] getPastryOrderByReferenceSupabase()
- [x] getPastryOrdersSupabase()
- [x] updatePastryOrderStatusSupabase()
- [x] generateQRTokenSupabase()
- [x] validateQRTokenSupabase()
- [x] logQRScanSupabase()
- [x] getPastryOrderStatsSupabase()

## Phase 3 : Procédures tRPC Pâtisserie
- [ ] Créer router `pastries.list`
- [ ] Créer router `pastries.create`
- [ ] Créer router `pastryOrders.create`
- [ ] Créer router `pastryOrders.getByReference`
- [ ] Créer router `pastryOrders.list` (avec filtres)
- [ ] Créer router `pastryOrders.updateStatus`
- [ ] Créer router `qr.generate` (commande + produit)
- [ ] Créer router `qr.validate`
- [ ] Créer router `qr.scan`

## Phase 4 : Traductions Multilingues Pâtisserie
- [ ] Ajouter section `pastries` dans fr.ts
- [ ] Ajouter section `pastries` dans ar.ts
- [ ] Ajouter section `pastries` dans amz.ts
- [ ] Ajouter section `pastries` dans en.ts
- [ ] Inclure : titre, description, panier, checkout, confirmation, emails

## Phase 5 : Page Publique Pastries
- [ ] Créer `Pastries.tsx` avec liste des pâtisseries
- [ ] Ajouter au panier (réutiliser logique Goodies)
- [ ] Créer checkout avec : nom, téléphone, email, méthode paiement
- [ ] Générer référence de commande
- [ ] Créer page de confirmation `PastriesConfirmation.tsx`

## Phase 6 : QR Codes (Commande + Produit)
- [ ] Générer QR commande (token) pour pré-réservations
- [ ] Générer QR produit (URL stable) pour chaque pâtisserie
- [ ] Ajouter endpoint téléchargement QR (PNG/SVG)
- [ ] Implémenter anti-doublon strict sur QR commande
- [ ] Ajouter audit (qui/quand/quoi)

## Phase 7 : Pages Achat Express
- [ ] Créer `/buy/goodie/{id}` pour Goodies
- [ ] Créer `/buy/pastry/{id}` pour Pâtisseries
- [ ] Sélection produit + quantité + variantes
- [ ] Formulaire client (tel, email optionnel)
- [ ] Choix moyen de paiement
- [ ] Créer commande "on_site_qr"
- [ ] Afficher confirmation avec référence

## Phase 8 : Interface /admin/scan-product
- [ ] Créer page `/admin/scan-product`
- [ ] Scanner QR produit → écran vente rapide
- [ ] Sélection quantité + variante
- [ ] Bouton "Payé cash + Remis"
- [ ] Créer commande "on_site_admin"
- [ ] Mettre à jour statuts automatiquement

## Phase 9 : Intégrer Pâtisserie dans /admin/scan
- [ ] Ajouter scope 'pastry' dans Scanner.tsx
- [ ] Afficher commande pâtisserie + items + statut
- [ ] Actions : marquer "payé cash", "remis", "annulé"
- [ ] Mettre à jour BDD automatiquement
- [ ] Journaliser les scans

## Phase 10 : Dashboard AdminPastries
- [ ] Créer `AdminPastries.tsx`
- [ ] Lister commandes pré-réservations et ventes sur place
- [ ] Filtres : date, statut, méthode paiement, canal
- [ ] Actions : payé/remis/annulé
- [ ] Export CSV

## Phase 11 : Emails Dynamiques Pâtisserie
- [ ] Confirmation pré-réservation (online)
- [ ] Confirmation paiement reçu (PayPal/CMI)
- [ ] Confirmation remise (on-site)
- [ ] Support multilingue FR/AR/AMZ/EN
- [ ] Contenu conditionnel selon paiement/canal

## Phase 12 : Navigation - Ajouter Pâtisserie
- [ ] Ajouter import `Pastries` dans App.tsx
- [ ] Ajouter route `/pastries` dans App.tsx
- [ ] Ajouter onglet "Pâtisserie solidaire" au menu principal
- [ ] Positionner après "Goodies solidaires"

## Phase 13 : Homogénéiser Dons
- [ ] Ajouter champs `channel`, `module_type`, `business_status` à `donations`
- [ ] Créer page `/donate/on-site` pour dons sur place
- [ ] Générer QR produit "Don sur place"
- [ ] Intégrer dans `/admin/scan` avec actions
- [ ] Mettre à jour emails selon canal/paiement

## Phase 14 : Homogénéiser Ftour
- [ ] Ajouter champs `channel`, `module_type`, `business_status` à `reservations`
- [ ] Créer page `/ftour/on-site` pour réservations sur place (optionnel)
- [ ] Générer QR produit "Réserver Ftour"
- [ ] Intégrer dans `/admin/scan` avec check-in
- [ ] Mettre à jour emails selon canal

## Phase 15 : Dashboard Unifié
- [ ] Créer `AdminUnifiedDashboard.tsx`
- [ ] Lister toutes les transactions (Goodies/Pastry/Dons/Ftour)
- [ ] Filtres : module, canal (online/on_site), paiement, date, statut
- [ ] Statistiques globales
- [ ] Export CSV multi-modules
- [ ] Ajouter lien dans menu Admin

## Phase 16 : Tests & Livraison
- [ ] Tester flux complet Pâtisserie : pré-réservation → checkout → confirmation
- [ ] Tester QR code scan (commande + produit)
- [ ] Tester achat express Goodies et Pâtisserie
- [ ] Tester vente rapide staff
- [ ] Tester dashboard admin unifié
- [ ] Vérifier emails multilingues
- [ ] Tester anti-doublon QR commande
- [ ] Vérifier audit qr_scans
- [ ] Checkpoint final
