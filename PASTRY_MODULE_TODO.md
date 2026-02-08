# Module Pâtisserie Solidaire - TODO

## Phase 1 : Schéma BDD
- [ ] Ajouter table `pastries` (id, name, description, price, imageUrl, active, sortOrder)
- [ ] Ajouter table `pastry_orders` (id, reference, customer_name, phone, email, items JSON, payment_method, payment_status, order_status, created_at)
- [ ] Ajouter table `qr_tokens` (token, scope='pastry', entity_id, status, max_uses=1, created_at)
- [ ] Ajouter table `qr_scans` (token, scope, entity_id, validation_action, validated_by, scanned_at)
- [ ] Migrer avec `pnpm db:push`

## Phase 2 : Services Supabase
- [ ] Créer `getPastriesSupabase()`
- [ ] Créer `createPastryOrderSupabase()`
- [ ] Créer `getPastryOrderByReferenceSupabase()`
- [ ] Créer `generateQRTokenSupabase()`
- [ ] Créer `validateQRTokenSupabase()`
- [ ] Créer `getPastryOrdersSupabase()`

## Phase 3 : Procédures tRPC
- [ ] Créer router `pastries` avec endpoints: list, create, update, delete
- [ ] Créer router `pastryOrders` avec endpoints: create, getByReference, list, stats
- [ ] Créer router `qr` avec endpoints: generate, validate

## Phase 4 : Traductions Multilingues
- [ ] Ajouter section `pastries` dans fr.ts
- [ ] Ajouter section `pastries` dans ar.ts
- [ ] Ajouter section `pastries` dans amz.ts
- [ ] Ajouter section `pastries` dans en.ts

## Phase 5 : Page Publique Pastries
- [ ] Créer `Pastries.tsx` avec liste des pâtisseries
- [ ] Ajouter panier (réutiliser logique Goodies)
- [ ] Créer checkout avec: nom, téléphone, email, méthode paiement
- [ ] Générer référence de commande
- [ ] Créer page de confirmation `PastriesConfirmation.tsx`

## Phase 6 : QR Codes
- [ ] Générer QR pour pré-réservations
- [ ] Créer QR générique "achat sur place"
- [ ] Implémenter anti-doublon strict
- [ ] Ajouter audit (qui/quand/quoi)

## Phase 7 : Achat Express (Vente sur place)
- [ ] Créer page `PastryQuickBuy.tsx`
- [ ] Sélection pâtisserie + quantité
- [ ] Enregistrement vente en BDD
- [ ] Générer référence

## Phase 8 : Intégration /admin/scan
- [ ] Ajouter scope 'pastry' dans Scanner.tsx
- [ ] Actions: marquer "payé cash", "remis"
- [ ] Mettre à jour BDD automatiquement
- [ ] Journaliser les scans

## Phase 9 : Dashboard AdminPastries
- [ ] Créer `AdminPastries.tsx`
- [ ] Lister commandes pré-réservations et ventes sur place
- [ ] Filtres: date, statut, méthode paiement
- [ ] Actions: payé/remis/annulé
- [ ] Export CSV

## Phase 10 : Emails Transactionnels
- [ ] Créer templates pâtisserie dans `email-templates.ts`
- [ ] Confirmation pré-réservation
- [ ] Confirmation paiement reçu
- [ ] Confirmation remise
- [ ] Support multilingue

## Phase 11 : Navigation
- [ ] Ajouter import `Pastries` dans App.tsx
- [ ] Ajouter route `/pastries` dans App.tsx
- [ ] Ajouter onglet "Pâtisserie solidaire" au menu principal
- [ ] Positionner après "Goodies solidaires"

## Phase 12 : Tests & Livraison
- [ ] Tester flux complet: pré-réservation → checkout → confirmation
- [ ] Tester QR code scan
- [ ] Tester achat express
- [ ] Tester dashboard admin
- [ ] Vérifier emails multilingues
- [ ] Checkpoint final
