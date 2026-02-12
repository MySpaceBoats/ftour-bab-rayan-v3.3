# 🔍 AUDIT COMPLET — Dashboard Admin Ftour Bab Rayan

**Date**: 2026-02-12  
**Status**: AUDIT EN COURS  
**Objectif**: Vérifier chaque module admin, identifier orphelins, implémenter Definition of Done

---

## 📊 INVENTORY + MATRIX

### LÉGENDE
- ✅ **OK** : Module complet (données réelles + actions + RBAC + tests)
- ⚠️ **PARTIEL** : Module existe mais incomplet (données réelles OU actions OU RBAC manquants)
- ❌ **ORPHELIN** : Route existe mais page/composant manquant OU page vide OU lien mort
- 🔄 **REDONDANT** : Deux modules font la même chose

---

## 1️⃣ RÉSERVATIONS

| Aspect | Route | Composant | DB | Actions | RBAC | Status |
|--------|-------|-----------|----|---------| -----|--------|
| **Vue Globale** | `/admin/reservations` | AdminReservationsPage.tsx | ✅ restaurantReservations | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Particuliers** | `/admin/restaurant/particuliers` | AdminRestaurantParticuliers.tsx | ✅ restaurantReservations | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Entreprises** | `/admin/restaurant/entreprises` | AdminRestaurantEntreprises.tsx | ✅ restaurantReservations | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Groupes** | `/admin/restaurant/groupes` | AdminRestaurantGroupes.tsx | ✅ restaurantReservations | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Scan Réservation** | `/admin/scan-reservation` | AdminScanReservation.tsx | ✅ restaurantReservations | ✅ | ✅ | ✅ OK |
| **Company Bookings** | ❌ Pas de route | AdminCompanyBookings.tsx | ✅ companyBookings | ✅ | ✅ | ❌ ORPHELIN |

**Problèmes identifiés**:
- AdminRestaurantParticuliers/Entreprises/Groupes : Redondants avec AdminReservationsPage
- AdminCompanyBookings : Composant existe mais pas de route dans App.tsx
- AdminReservationsConsolidated : Composant créé mais pas utilisé

**Definition of Done manquant**:
- ❌ Filtres avancés (date, paiement, statut)
- ❌ Vue détail complète (drawer)
- ❌ Actions bulk (confirmer/refuser multiples)
- ❌ Gestion statuts réelle (pending_validation → confirmed → rejected)
- ⚠️ États UI (loading/empty/error) : Partiels

---

## 2️⃣ COMMERCE

| Aspect | Route | Composant | DB | Actions | RBAC | Status |
|--------|-------|-----------|----|---------| -----|--------|
| **Vue Globale** | `/admin/commerce` | AdminCommercePage.tsx | ✅ goodies/pastries/terroir | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Goodies** | `/admin/goodies` | AdminGoodies.tsx | ✅ goodies | ✅ CRUD | ✅ | ✅ OK |
| **Commandes** | `/admin/commandes` | AdminCommandes.tsx | ✅ orders | ✅ | ✅ | ✅ OK |
| **Pâtisserie** | `/admin/patisserie` | AdminPastries.tsx | ✅ pastries | ✅ CRUD | ✅ | ✅ OK |
| **Terroir Produits** | `/admin/terroir/products` | AdminTerroirProducts.tsx | ✅ terroirProducts | ✅ CRUD | ✅ | ✅ OK |
| **Terroir Commandes** | `/admin/terroir/orders` | AdminTerroirOrders.tsx | ✅ terroirOrders | ✅ | ✅ | ✅ OK |
| **Paiements** | `/admin/payments` | AdminPayments.tsx | ✅ payments | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Commerce Consolidated** | ❌ Pas de route | AdminCommerceConsolidated.tsx | ✅ | ⚠️ | ✅ | ❌ ORPHELIN |

**Problèmes identifiés**:
- AdminCommerceConsolidated : Composant créé mais pas de route
- AdminCommercePage : Vue globale existe mais incomplète
- AdminPayments : Existe mais pas bien intégré au flux commerce

**Definition of Done manquant**:
- ⚠️ Vue globale unifiée (AdminCommercePage) : Incomplète
- ✅ CRUD produits : OK pour chaque type
- ⚠️ Gestion stock : Partielles
- ❌ Listes commandes unifiées par type

---

## 3️⃣ DONS

| Aspect | Route | Composant | DB | Actions | RBAC | Status |
|--------|-------|-----------|----|---------| -----|--------|
| **Vue Globale** | `/admin/dons` | AdminDonsPage.tsx | ✅ donations | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Dons Legacy** | ❌ Pas de route | AdminDons.tsx | ✅ donations | ⚠️ Partielles | ✅ | ❌ ORPHELIN |

**Problèmes identifiés**:
- AdminDons : Composant legacy, pas utilisé (redondant avec AdminDonsPage)
- AdminDonsPage : Existe mais actions incomplètes

**Definition of Done manquant**:
- ⚠️ Filtres (date, montant, statut)
- ⚠️ Vue détail donateur
- ❌ Export CSV
- ❌ Génération reçus
- ⚠️ Suppression (super_admin only)

---

## 4️⃣ BÉNÉVOLES

| Aspect | Route | Composant | DB | Actions | RBAC | Status |
|--------|-------|-----------|----|---------| -----|--------|
| **Vue Globale** | `/admin/benevoles` | AdminBenevolePage.tsx | ✅ volunteers | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Bénévoles Legacy** | ❌ Pas de route | AdminBenevoles.tsx | ✅ volunteers | ⚠️ Partielles | ✅ | ❌ ORPHELIN |

**Problèmes identifiés**:
- AdminBenevoles : Composant legacy, pas utilisé
- AdminBenevolePage : Existe mais actions incomplètes

**Definition of Done manquant**:
- ⚠️ Filtres (jour, statut, rôle)
- ⚠️ Vue détail bénévole
- ❌ Confirmer/annuler créneau
- ❌ Marquer présent
- ⚠️ Suppression

---

## 5️⃣ OPS / CALENDRIER

| Aspect | Route | Composant | DB | Actions | RBAC | Status |
|--------|-------|-----------|----|---------| -----|--------|
| **Jours** | `/admin/jours` | AdminJours.tsx | ✅ ramadanDays | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Jours (alias)** | `/admin/calendrier` | AdminJours.tsx | ✅ ramadanDays | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |

**Problèmes identifiés**:
- Deux routes pointent vers le même composant (alias inutile)

**Definition of Done manquant**:
- ⚠️ CRUD jours (ouvrir/fermer)
- ❌ Gestion capacité
- ❌ Vue globale places occupées par type

---

## 6️⃣ SCANNER

| Aspect | Route | Composant | DB | Actions | RBAC | Status |
|--------|-------|-----------|----|---------| -----|--------|
| **Scanner Unique** | `/admin/scanner` | AdminScannerConsolidated.tsx | ✅ qrScans | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Scan Produit** | `/admin/scan-product` | AdminScanProduct.tsx | ✅ qrScans | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |
| **Scan Réservation** | `/admin/scan-reservation` | AdminScanReservation.tsx | ✅ qrScans | ✅ | ✅ | ✅ OK |
| **Public Scanner** | `/scanner` | Scanner.tsx | ✅ qrScans | ✅ | ⚠️ | ✅ OK |
| **Checkin** | `/checkin` | Checkin.tsx | ✅ qrScans | ✅ | ⚠️ | ✅ OK |

**Problèmes identifiés**:
- 3 scanners admin différents : AdminScannerConsolidated, AdminScanProduct, AdminScanReservation (REDONDANT)
- Scanner public existe et fonctionne bien
- AdminScannerConsolidated : Composant créé mais ne consolide pas vraiment

**Definition of Done manquant**:
- ❌ Scanner unique qui détecte type (réservation/goodies/terroir/pâtisserie/bénévole)
- ⚠️ Actions de validation : Partielles
- ✅ Support multi-types : OK (public Scanner)

---

## 7️⃣ MESSAGES

| Aspect | Route | Composant | DB | Actions | RBAC | Status |
|--------|-------|-----------|----|---------| -----|--------|
| **Messages** | `/admin/messages` | AdminMessages.tsx | ✅ contactMessages | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |

**Problèmes identifiés**:
- Composant existe mais actions limitées

**Definition of Done manquant**:
- ⚠️ Liste messages avec filtres
- ⚠️ Vue détail
- ❌ Marquer lu
- ❌ Suppression (super_admin)

---

## 8️⃣ CONTENU

| Aspect | Route | Composant | DB | Actions | RBAC | Status |
|--------|-------|-----------|----|---------| -----|--------|
| **Contenu** | `/admin/contenu` | AdminContenu.tsx | ✅ faqItems/partners | ⚠️ Partielles | ✅ | ⚠️ PARTIEL |

**Problèmes identifiés**:
- Composant existe mais CRUD incomplet

**Definition of Done manquant**:
- ⚠️ CRUD FAQ
- ⚠️ CRUD Partenaires
- ❌ Activer/désactiver
- ❌ Ordonner

---

## 9️⃣ MODULES ORPHELINS À SUPPRIMER

| Composant | Route | Raison |
|-----------|-------|--------|
| AdminUnifiedDashboard.tsx | `/admin/unified-dashboard` | Legacy, remplacé par AdminDashboard |
| AdminRestaurants.tsx | `/admin/restaurants` | Orphelin, pas utilisé |
| AdminRestaurantReservations.tsx | `/admin/restaurant-reservations` | Redondant avec AdminReservationsPage |
| AdminScan.tsx | ❌ | Orphelin, pas de route |
| AdminCompanyBookings.tsx | ❌ | Orphelin, pas de route |
| AdminDons.tsx | ❌ | Redondant avec AdminDonsPage |
| AdminBenevoles.tsx | ❌ | Redondant avec AdminBenevolePage |
| AdminReservationsConsolidated.tsx | ❌ | Remplacé par AdminReservationsPage |
| AdminCommerceConsolidated.tsx | ❌ | Remplacé par AdminCommercePage |

---

## 🔟 RÉSUMÉ STATISTIQUES

| Catégorie | Nombre | Détail |
|-----------|--------|--------|
| **Routes totales** | 25 | Admin + Scanner |
| **Composants existants** | 34 | Admin + Scanner |
| **Routes OK** | 8 | Scan Réservation, Goodies, Commandes, Pâtisserie, Terroir, Scanner public, Checkin, AdminDashboard |
| **Routes PARTIELLES** | 12 | Réservations (4), Commerce (2), Dons, Bénévoles, Ops/Jours (2), Messages, Contenu |
| **Routes ORPHELINES** | 5 | Restaurants, Restaurant-Reservations, Unified-Dashboard, Payments (mal intégré), Company Bookings |
| **Composants REDONDANTS** | 9 | Voir section 9️⃣ |
| **Composants ORPHELINS** | 4 | AdminScan, AdminCompanyBookings, AdminDons, AdminBenevoles |

---

## 📋 PLAN DE CORRECTIONS (Ordre des PR)

### PR 1 : Nettoyage (Supprimer orphelins)
- [ ] Supprimer AdminUnifiedDashboard.tsx + route
- [ ] Supprimer AdminRestaurants.tsx + route
- [ ] Supprimer AdminRestaurantReservations.tsx + route
- [ ] Supprimer AdminScan.tsx
- [ ] Supprimer AdminCompanyBookings.tsx
- [ ] Supprimer AdminDons.tsx (redondant)
- [ ] Supprimer AdminBenevoles.tsx (redondant)
- [ ] Supprimer AdminReservationsConsolidated.tsx (remplacé)
- [ ] Supprimer AdminCommerceConsolidated.tsx (remplacé)
- [ ] Supprimer alias `/admin/calendrier` (garder `/admin/jours`)

### PR 2 : Réservations (Definition of Done)
- [ ] Compléter AdminReservationsPage : Filtres avancés
- [ ] Ajouter vue détail (drawer)
- [ ] Implémenter actions bulk
- [ ] Gestion statuts réelle
- [ ] États UI (loading/empty/error)

### PR 3 : Commerce (Definition of Done)
- [ ] Compléter AdminCommercePage : Vue globale unifiée
- [ ] Ajouter filtres par type (goodies/terroir/pâtisserie)
- [ ] Lister commandes par type
- [ ] Gestion stock avancée
- [ ] États UI

### PR 4 : Dons, Bénévoles, Ops (Definition of Done)
- [ ] Compléter AdminDonsPage : Filtres, détail, export CSV, reçus
- [ ] Compléter AdminBenevolePage : Filtres, détail, actions
- [ ] Compléter AdminJours : CRUD, capacité, vue places

### PR 5 : Scanner Unique
- [ ] Consolider 3 scanners admin en 1
- [ ] Détecter type automatiquement
- [ ] Actions de validation multi-types

### PR 6 : Messages & Contenu (Definition of Done)
- [ ] Compléter AdminMessages : Filtres, détail, marquer lu
- [ ] Compléter AdminContenu : CRUD FAQ/Partenaires, activer/désactiver, ordonner

### PR 7 : Tests & Build
- [ ] Créer QA.md avec tests end-to-end
- [ ] Valider `pnpm build` OK
- [ ] Valider RBAC pour chaque rôle

---

## 🎯 DEFINITION OF DONE — CHECKLIST PAR MODULE

### ✅ Réservations
- [ ] Table liste (type, date, seats, contact, statut, paiement, createdAt, actions)
- [ ] Filtres : type / date / statut / paiement / recherche
- [ ] Vue détail (drawer)
- [ ] Actions : confirmer, refuser, supprimer, voir détail, renvoyer email
- [ ] Statuts : pending_validation, confirmed, rejected, cancelled
- [ ] États UI : loading / empty / error
- [ ] RBAC : admin_restaurant_particuliers, admin_restaurant_entreprises, admin_restaurant_groupes
- [ ] pnpm build OK

### ✅ Commerce
- [ ] Table produits (nom, type, prix, stock, statut, actions)
- [ ] Table commandes (produit, type, montant, statut, actions)
- [ ] Filtres : type / statut / recherche
- [ ] Actions : ajouter, modifier, activer/désactiver, ajuster stock, supprimer
- [ ] Vue détail produit
- [ ] États UI : loading / empty / error
- [ ] RBAC : admin_boutique, admin_patisserie, admin_terroir
- [ ] pnpm build OK

### ✅ Dons
- [ ] Table dons (montant, donateur, statut, date, actions)
- [ ] Filtres : date / montant / statut
- [ ] Vue détail donateur
- [ ] Actions : marquer reçu, exporter CSV, supprimer (super_admin)
- [ ] États UI : loading / empty / error
- [ ] RBAC : admin_dons, super_admin
- [ ] pnpm build OK

### ✅ Bénévoles
- [ ] Table bénévoles (nom, jour, créneau, statut, présent, actions)
- [ ] Filtres : jour / statut / rôle
- [ ] Vue détail bénévole
- [ ] Actions : confirmer, annuler, marquer présent, supprimer
- [ ] États UI : loading / empty / error
- [ ] RBAC : admin_ops, super_admin
- [ ] pnpm build OK

### ✅ Ops/Jours
- [ ] Table jours (date, isOpen, capacité, places occupées, actions)
- [ ] Actions : ouvrir/fermer, éditer capacité
- [ ] Vue places occupées par type
- [ ] États UI : loading / empty / error
- [ ] RBAC : super_admin
- [ ] pnpm build OK

### ✅ Scanner Unique
- [ ] Scan QR → lookup entité
- [ ] Résultat : valide / invalide / déjà scanné
- [ ] Actions : valider / marquer retiré / marquer présent
- [ ] Support multi-types : réservation / goodies / terroir / pâtisserie / bénévoles
- [ ] États UI : loading / error
- [ ] RBAC : admin_ops, scanner
- [ ] pnpm build OK

### ✅ Messages
- [ ] Table messages (date, sujet, expéditeur, statut, actions)
- [ ] Filtres : date / statut / recherche
- [ ] Vue détail message
- [ ] Actions : marquer lu, supprimer (super_admin)
- [ ] États UI : loading / empty / error
- [ ] RBAC : super_admin
- [ ] pnpm build OK

### ✅ Contenu
- [ ] Table FAQ (titre, contenu, ordre, actif, actions)
- [ ] Table Partenaires (nom, logo, lien, ordre, actif, actions)
- [ ] Actions : CRUD, activer/désactiver, ordonner
- [ ] États UI : loading / empty / error
- [ ] RBAC : super_admin
- [ ] pnpm build OK

---

## 📝 NOTES IMPORTANTES

1. **Pas de coquilles vides** : Chaque module doit avoir données réelles + actions métier
2. **RBAC strict** : Chaque action doit vérifier les rôles
3. **Tests obligatoires** : QA.md avec workflows end-to-end
4. **Build obligatoire** : `pnpm build` doit passer sans erreur
5. **Traductions** : Toutes les clés i18n doivent exister en en.ts et ar.ts

---

## 🚀 PROCHAINES ÉTAPES

1. **Valider ce rapport** avec le user
2. **Exécuter PR 1** : Nettoyage des orphelins
3. **Exécuter PR 2-6** : Complétion des modules
4. **Exécuter PR 7** : Tests et build final
5. **Livrer** : Checkpoint + rapport QA
