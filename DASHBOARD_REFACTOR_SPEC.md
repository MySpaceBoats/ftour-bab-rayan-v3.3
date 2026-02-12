# 📊 Dashboard Refactor Specification — Ftour Bab Rayan v2

**Date** : 2026-02-12  
**Objectif** : Refonte Dashboard Admin — Simplification 17→12 modules, consolidation scanner, intégration paiements

---

## 🎯 VISION

**Avant** : 17 modules dispersés, 3 scanners redondants, paiements isolé, logique non-métier  
**Après** : 12 modules logiques, 1 scanner central, paiements intégré, organisation par valeur métier

---

## 📊 STRUCTURE V1 SIMPLIFIÉE

### Bloc 1 : 🔴 REVENUS & RÉSERVATIONS

Tout ce qui génère des flux financiers directs.

#### 1.1 Réservations
- **Route** : `/admin/reservations` (nouvelle, consolidée)
- **Sous-modules** :
  - Particuliers (1-12 places)
  - Entreprises (10-120 places)
  - Groupes (1-120 places)
- **Tables** : `restaurant_reservations` (type: particulier|entreprise|groupe)
- **Statuts** : pending_validation → validated_pending_payment → paid_confirmed | refused
- **Rôles** : admin_restaurant_particuliers, admin_restaurant_entreprises, admin_restaurant_groupes, admin, super_admin
- **Actions** : Lister, Détail, Valider, Refuser, Exporter
- **Statistiques** : Total, En attente, Confirmées, Refusées, Participants

#### 1.2 Commerce
- **Route** : `/admin/commerce` (nouvelle, consolidée)
- **Sous-modules** :
  - Goodies (catalogue + commandes)
  - Terroir (catalogue + commandes)
  - Pâtisserie (catalogue + commandes)
  - **[INTÉGRÉ]** Paiements (onglet transversal)
- **Tables** : `goodies`, `goodie_variants`, `orders`, `terroir_products`, `terroir_product_variants`, `terroir_orders`, `pastries`, `pastry_orders`, `payments`, `payment_logs`
- **Statuts** : reserved → pending → confirmed → delivered | cancelled
- **Rôles** : admin_boutique, admin_patisserie, admin_terroir, admin, super_admin
- **Actions** : Lister, Détail, Filtrer, Exporter, Marquer comme livré
- **Statistiques** : Commandes par produit, CA, Paiements reçus, Paiements en attente

#### 1.3 Dons
- **Route** : `/admin/dons` (inchangé)
- **Tables** : `donations`
- **Statuts** : promised → pending → received → handed → checked_in | cancelled
- **Rôles** : admin_dons, admin, super_admin
- **Actions** : Lister, Détail, Marquer comme reçu, Exporter
- **Statistiques** : Promesses, Reçus, Montant total

---

### Bloc 2 : 🟢 EXÉCUTION TERRAIN

Pilotage opérationnel du Ramadan.

#### 2.1 Bénévoles
- **Route** : `/admin/benevoles` (inchangé)
- **Tables** : `volunteers`, `scan_history`
- **Statuts** : registered → confirmed → present | absent | cancelled
- **Rôles** : admin_ops, admin, super_admin
- **Actions** : Lister, Détail, Filtrer par jour, Marquer présent/absent
- **Statistiques** : Total inscrits, Présents, Absents, Par jour

#### 2.2 Scanner (Unique)
- **Route** : `/admin/scanner` (consolidée)
- **Sous-modules** (onglets internes) :
  - Restaurant (validation réservations)
  - Goodies/Terroir/Pâtisserie (validation produits)
  - Bénévoles (validation présence)
- **Tables** : `qr_tokens`, `qr_scans`, `scan_history`
- **Types QR** : volunteer, reservation, product
- **Rôles** : admin_ops, scanner, admin, super_admin
- **Actions** : Scanner, Valider, Historique
- **Statistiques** : Scans par type, Taux validation

#### 2.3 Calendrier / Jours
- **Route** : `/admin/calendrier` (renommé de `/admin/jours`)
- **Tables** : `ramadan_days`
- **Rôles** : super_admin
- **Actions** : Lister, Éditer jour, Configurer capacités, Fermer créneau
- **Statistiques** : Jours configurés, Capacité restante

---

### Bloc 3 : 🟣 ADMINISTRATION SYSTÈME

Gestion interne, configuration, support.

#### 3.1 Utilisateurs
- **Route** : `/admin/utilisateurs` (inchangé)
- **Tables** : `users`
- **Rôles** : super_admin
- **Actions** : Lister, Créer, Éditer rôle, Supprimer
- **Statistiques** : Total utilisateurs, Par rôle

#### 3.2 Contenu
- **Route** : `/admin/contenu` (inchangé)
- **Tables** : `partners`, `testimonials`, `faq_items`, `media_gallery`, `site_settings`
- **Rôles** : super_admin
- **Actions** : Gérer FAQ, Partenaires, Témoignages, Galerie
- **Statistiques** : Nombre FAQ, Partenaires, Témoignages

#### 3.3 Messages
- **Route** : `/admin/messages` (inchangé)
- **Tables** : `contact_messages`
- **Rôles** : super_admin
- **Actions** : Lister, Lire, Marquer comme lu, Répondre
- **Statistiques** : Messages non lus, Total

---

## 🗺️ ARBORESCENCE ROUTES

### Avant (17 routes)
```
/admin
├── /admin/restaurant/particuliers
├── /admin/restaurant/entreprises
├── /admin/restaurant/groupes
├── /admin/restaurants
├── /admin/restaurant-reservations
├── /admin/reservations (legacy)
├── /admin/company-bookings (legacy)
├── /admin/scan-reservation
├── /admin/commandes
├── /admin/goodies
├── /admin/pastries
├── /admin/terroir/products
├── /admin/terroir/orders
├── /admin/dons
├── /admin/benevoles
├── /admin/jours
├── /admin/scan
├── /admin/scan-product
├── /admin/payments
├── /admin/utilisateurs
├── /admin/contenu
├── /admin/messages
├── /admin/unified-dashboard
```

### Après (12 routes)
```
/admin
├── /admin/reservations (consolidée)
│   ├── particuliers (onglet)
│   ├── entreprises (onglet)
│   └── groupes (onglet)
├── /admin/commerce (consolidée)
│   ├── goodies (onglet)
│   ├── terroir (onglet)
│   ├── patisserie (onglet)
│   └── paiements (onglet)
├── /admin/dons
├── /admin/benevoles
├── /admin/scanner (consolidée)
│   ├── restaurant (onglet)
│   ├── produits (onglet)
│   └── benevoles (onglet)
├── /admin/calendrier (renommé)
├── /admin/utilisateurs
├── /admin/contenu
└── /admin/messages
```

---

## 🔄 MIGRATION ROUTES

| Ancienne route | Nouvelle route | Statut |
|---|---|---|
| `/admin/restaurant/particuliers` | `/admin/reservations?tab=particuliers` | Redirect |
| `/admin/restaurant/entreprises` | `/admin/reservations?tab=entreprises` | Redirect |
| `/admin/restaurant/groupes` | `/admin/reservations?tab=groupes` | Redirect |
| `/admin/restaurant-reservations` | `/admin/reservations` | Merge |
| `/admin/reservations` (legacy) | `/admin/reservations` | Merge |
| `/admin/company-bookings` | `/admin/reservations?tab=entreprises` | Redirect |
| `/admin/commandes` | `/admin/commerce?tab=goodies` | Redirect |
| `/admin/goodies` | `/admin/commerce?tab=goodies` | Redirect |
| `/admin/pastries` | `/admin/commerce?tab=patisserie` | Redirect |
| `/admin/terroir/products` | `/admin/commerce?tab=terroir` | Redirect |
| `/admin/terroir/orders` | `/admin/commerce?tab=terroir` | Redirect |
| `/admin/payments` | `/admin/commerce?tab=paiements` | Redirect |
| `/admin/scan-reservation` | `/admin/scanner?tab=restaurant` | Redirect |
| `/admin/scan` | `/admin/scanner?tab=benevoles` | Redirect |
| `/admin/scan-product` | `/admin/scanner?tab=produits` | Redirect |
| `/admin/jours` | `/admin/calendrier` | Redirect |
| `/admin/restaurants` | `/admin/calendrier` | Merge (config) |
| `/admin/unified-dashboard` | `/admin` (dashboard principal) | Merge |

---

## 📋 MAPPING MODULES → COMPOSANTS

### Bloc 1 : Revenus & Réservations

| Module | Composant | Route | État |
|--------|-----------|-------|------|
| Réservations | AdminReservationsConsolidated | `/admin/reservations` | 🔨 Nouveau |
| Commerce | AdminCommerceConsolidated | `/admin/commerce` | 🔨 Nouveau |
| Dons | AdminDons | `/admin/dons` | ✅ Existant |

### Bloc 2 : Exécution Terrain

| Module | Composant | Route | État |
|--------|-----------|-------|------|
| Bénévoles | AdminBenevoles | `/admin/benevoles` | ✅ Existant |
| Scanner | AdminScannerConsolidated | `/admin/scanner` | 🔨 Nouveau |
| Calendrier | AdminCalendar | `/admin/calendrier` | 🔄 Renommé |

### Bloc 3 : Administration

| Module | Composant | Route | État |
|--------|-----------|-------|------|
| Utilisateurs | AdminUtilisateurs | `/admin/utilisateurs` | ✅ Existant |
| Contenu | AdminContenu | `/admin/contenu` | ✅ Existant |
| Messages | AdminMessages | `/admin/messages` | ✅ Existant |

---

## 🔐 MAPPING RBAC FINAL

| Rôle | Bloc 1 | Bloc 2 | Bloc 3 |
|------|--------|--------|--------|
| `user` | ❌ | ❌ | ❌ |
| `admin` | ✅ All | ✅ All | ✅ All |
| `super_admin` | ✅ All | ✅ All | ✅ All |
| `admin_restaurant_particuliers` | ✅ Réservations (particuliers) | ❌ | ❌ |
| `admin_restaurant_entreprises` | ✅ Réservations (entreprises) | ❌ | ❌ |
| `admin_restaurant_groupes` | ✅ Réservations (groupes) | ❌ | ❌ |
| `admin_boutique` | ✅ Commerce | ❌ | ❌ |
| `admin_patisserie` | ✅ Commerce (pâtisserie) | ❌ | ❌ |
| `admin_terroir` | ✅ Commerce (terroir) | ❌ | ❌ |
| `admin_dons` | ✅ Dons | ❌ | ❌ |
| `admin_ops` | ❌ | ✅ All | ❌ |
| `scanner` | ❌ | ✅ Scanner | ❌ |

---

## 🎨 DASHBOARD PRINCIPAL (AdminDashboard.tsx)

### Structure

```
AdminDashboard
├── Header (Navigation, User, Logout)
├── SectionGroup "Revenus & Réservations"
│   ├── ModuleCard "Réservations" → /admin/reservations
│   ├── ModuleCard "Commerce" → /admin/commerce
│   └── ModuleCard "Dons" → /admin/dons
├── SectionGroup "Exécution Terrain"
│   ├── ModuleCard "Bénévoles" → /admin/benevoles
│   ├── ModuleCard "Scanner" → /admin/scanner
│   └── ModuleCard "Calendrier" → /admin/calendrier
└── SectionGroup "Administration"
    ├── ModuleCard "Utilisateurs" → /admin/utilisateurs
    ├── ModuleCard "Contenu" → /admin/contenu
    └── ModuleCard "Messages" → /admin/messages
```

### ModuleCard Props

```typescript
type ModuleCard = {
  label: string;
  description: string;
  route: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  allowedRoles: string[];
  stats?: {
    label: string;
    value: number | string;
    color: string;
  }[];
  variant?: 'default' | 'primary' | 'accent';
};
```

---

## 📊 STATISTIQUES DASHBOARD

### Bloc 1 : Revenus & Réservations

**Réservations** :
- Total réservations
- En attente de validation
- Confirmées
- Refusées

**Commerce** :
- Commandes en attente
- Commandes confirmées
- Paiements reçus
- Paiements en attente

**Dons** :
- Promesses
- Reçus
- Montant total

### Bloc 2 : Exécution Terrain

**Bénévoles** :
- Total inscrits
- Présents
- Absents

**Scanner** :
- Scans aujourd'hui
- Taux validation

**Calendrier** :
- Jours configurés
- Capacité restante

---

## 🔄 PLAN IMPLÉMENTATION

### Phase 1 : Préparation
- [x] Audit complet (Inventory.md, Matrix.md)
- [x] Nettoyage code (suppression legacy)
- [ ] Créer spec refonte (ce document)

### Phase 2 : Implémentation
- [ ] Créer AdminReservationsConsolidated
- [ ] Créer AdminCommerceConsolidated
- [ ] Créer AdminScannerConsolidated
- [ ] Renommer AdminJours → AdminCalendar
- [ ] Refactoriser AdminDashboard.tsx

### Phase 3 : Routing
- [ ] Mettre à jour App.tsx routes
- [ ] Ajouter redirects pour anciennes routes
- [ ] Tester navigation

### Phase 4 : QA
- [ ] Tester accès par rôle
- [ ] Tester onglets internes
- [ ] Tester statistiques
- [ ] Tester redirects

---

## 📝 NOTES IMPORTANTES

1. **Consolidation ≠ Suppression** : Les données restent, seule la présentation change
2. **Onglets internes** : Utiliser React tabs pour sous-modules (pas de nouvelles routes)
3. **Redirects** : Anciennes routes redirigent vers nouvelles avec query params
4. **RBAC** : Chaque rôle ne voit que ses modules (filtrer au niveau du dashboard)
5. **Statistiques** : Afficher sur les cartes du dashboard pour aperçu rapide

---

## 🎯 RÉSULTAT ATTENDU

**Avant** : Dashboard chaotique, 17 entrées, logique technique  
**Après** : Dashboard clair, 12 entrées, logique métier, 3 blocs cohérents

**Impact** :
- ✅ Meilleure UX pour admins
- ✅ Moins de confusion
- ✅ Plus facile à maintenir
- ✅ Scalable pour futures fonctionnalités
