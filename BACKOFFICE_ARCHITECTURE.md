# 🏗️ Back Office Architecture — Ftour Bab Rayan

**Date** : 2026-02-12  
**Concept** : Vues centralisées unifiées par domaine métier  
**Statut** : En cours d'implémentation

---

## 🎯 Principes Architecturaux

### 1. Une Entité = Une Vue Centrale + Vues Spécialisées

**Avant** (fragmenté) :
- `/admin/restaurant/particuliers` (AdminRestaurantParticuliers.tsx)
- `/admin/restaurant/entreprises` (AdminRestaurantEntreprises.tsx)
- `/admin/restaurant/groupes` (AdminRestaurantGroupes.tsx)
- 3 systèmes différents, 3 logiques différentes, duplication

**Après** (centralisé) :
- `/admin/reservations` (AdminReservationsPage.tsx) — Vue unifiée
  - Filtre `type=particulier` → Particuliers
  - Filtre `type=entreprise` → Entreprises
  - Filtre `type=groupe` → Groupes
- 1 système, 1 logique, 4 vues du même dataset

### 2. Composants Réutilisables

```
components/
├── DataTable.tsx           (table générique)
├── FilterPanel.tsx         (filtres génériques)
├── ActionMenu.tsx          (actions contextuelles)
├── DetailsDrawer.tsx       (détails entité)
└── BulkActions.tsx         (actions en masse)
```

### 3. Permissions Granulaires

**Avant** :
- `admin_restaurant` → accès `/admin/restaurant/*`

**Après** :
- `admin_reservations` → accès `/admin/reservations` (global)
- `admin_restaurant_particuliers` → accès `/admin/reservations?type=particulier`
- `admin_restaurant_entreprises` → accès `/admin/reservations?type=entreprise`
- `admin_restaurant_groupes` → accès `/admin/reservations?type=groupe`
- `super_admin` → accès complet

---

## 📊 Domaines Métier

### 1️⃣ Réservations

**Entité** : `reservations` (table unifiée)

**Champs** :
- `id` : UUID
- `type` : 'particulier' | 'entreprise' | 'groupe'
- `date` : Date réservation
- `places` : Nombre de places
- `contact_name` : Nom contact
- `contact_email` : Email
- `contact_phone` : Téléphone
- `status` : 'pending' | 'confirmed' | 'rejected' | 'cancelled'
- `payment_status` : 'unpaid' | 'paid' | 'refunded'
- `created_at` : Date création
- `updated_at` : Date modification

**Vue Centrale** : AdminReservationsPage.tsx

**Colonnes Table** :
| Type | Date | Places | Contact | Email | Téléphone | Statut | Paiement | Actions |
|------|------|--------|---------|-------|-----------|--------|---------|---------|

**Filtres** :
- Type (Particulier, Entreprise, Groupe)
- Statut (En attente, Confirmée, Refusée, Annulée)
- Paiement (Payé, Non payé)
- Plage de dates

**Actions** :
- 👁 Voir détails
- ✅ Valider
- ❌ Refuser
- 💳 Marquer comme payé
- 📧 Renvoyer email
- 🗑 Supprimer

**Vues Spécialisées** :
- `/admin/reservations?type=particulier` → Particuliers
- `/admin/reservations?type=entreprise` → Entreprises
- `/admin/reservations?type=groupe` → Groupes

---

### 2️⃣ Commerce

**Entités** : `products` (table unifiée)

**Champs** :
- `id` : UUID
- `type` : 'goodie' | 'terroir' | 'pastry'
- `name` : Nom produit
- `price` : Prix
- `stock` : Stock disponible
- `status` : 'active' | 'inactive' | 'discontinued'
- `created_at` : Date création
- `updated_at` : Date modification

**Vue Centrale** : AdminCommercePage.tsx

**Colonnes Table** :
| Produit | Type | Prix | Stock | Statut | Actions |
|---------|------|------|-------|--------|---------|

**Filtres** :
- Type (Goodies, Terroir, Pâtisserie)
- Statut (Actif, Inactif, Discontinué)
- Stock (En stock, Rupture)

**Actions** :
- ✏️ Modifier
- 📦 Gérer stock
- 👁 Voir commandes
- 🔄 Activer/Désactiver
- 🗑 Supprimer

**Vues Spécialisées** :
- `/admin/commerce?type=goodie` → Goodies
- `/admin/commerce?type=terroir` → Terroir
- `/admin/commerce?type=pastry` → Pâtisserie

**Sous-entité** : `orders` (commandes)

**Colonnes Table** :
| Commande ID | Client | Produits | Montant | Statut | Date | Actions |
|-------------|--------|----------|---------|--------|------|---------|

**Actions** :
- 👁 Voir détails
- ✅ Confirmer
- 📦 Marquer comme expédié
- 💳 Voir paiement

---

### 3️⃣ Dons

**Entité** : `donations` (table unifiée)

**Champs** :
- `id` : UUID
- `donor_name` : Nom donateur
- `donor_email` : Email
- `amount` : Montant
- `payment_status` : 'pending' | 'paid' | 'failed'
- `receipt_generated` : Booléen
- `created_at` : Date création

**Vue Centrale** : AdminDonsPage.tsx

**Colonnes Table** :
| Donateur | Montant | Statut Paiement | Reçu ? | Date | Actions |
|----------|---------|-----------------|--------|------|---------|

**Filtres** :
- Statut paiement (Payé, En attente, Échoué)
- Reçu généré (Oui, Non)
- Plage de montants

**Actions** :
- 👁 Voir détails
- 📧 Renvoyer reçu
- 💳 Marquer comme payé
- 🗑 Supprimer

---

### 4️⃣ Bénévoles

**Entité** : `volunteers` (table unifiée)

**Champs** :
- `id` : UUID
- `name` : Nom
- `email` : Email
- `phone` : Téléphone
- `status` : 'active' | 'inactive'
- `created_at` : Date création

**Sous-entité** : `volunteer_shifts` (créneaux)

**Champs** :
- `id` : UUID
- `volunteer_id` : FK volunteers
- `date` : Date créneau
- `shift` : Créneau (matin, midi, soir)
- `confirmed` : Booléen
- `qr_generated` : Booléen
- `present` : Booléen

**Vue Centrale** : AdminBenevoles.tsx

**Colonnes Table** :
| Nom | Email | Téléphone | Créneaux | Confirmé ? | QR ? | Présent ? | Actions |
|-----|-------|-----------|----------|-----------|------|-----------|---------|

**Filtres** :
- Statut (Actif, Inactif)
- Date créneau
- Confirmé (Oui, Non)
- Présent (Oui, Non)

**Actions** :
- 👁 Voir détails
- ✅ Confirmer créneau
- 🔗 Générer QR
- ✔️ Marquer présent
- 📧 Envoyer email
- 🗑 Supprimer

---

## 🏗️ Structure de Fichiers

```
client/src/features/
├── admin/
│   ├── components/
│   │   ├── DataTable.tsx              (table générique)
│   │   ├── FilterPanel.tsx            (filtres génériques)
│   │   ├── ActionMenu.tsx             (actions contextuelles)
│   │   ├── DetailsDrawer.tsx          (détails entité)
│   │   └── BulkActions.tsx            (actions en masse)
│   │
│   ├── pages/
│   │   ├── AdminReservationsPage.tsx  (réservations unifiées)
│   │   ├── AdminCommercePage.tsx      (commerce unifié)
│   │   ├── AdminDonsPage.tsx          (dons)
│   │   └── AdminBenevoles.tsx         (bénévoles)
│   │
│   └── hooks/
│       ├── useReservations.ts         (logique réservations)
│       ├── useCommerce.ts             (logique commerce)
│       ├── useDons.ts                 (logique dons)
│       └── useBenevoles.ts            (logique bénévoles)
```

---

## 🔐 Permissions & RBAC

### Rôles

| Rôle | Réservations | Commerce | Dons | Bénévoles | Utilisateurs |
|------|--------------|----------|------|-----------|--------------|
| `admin_reservations` | ✅ Global | ❌ | ❌ | ❌ | ❌ |
| `admin_restaurant_particuliers` | ✅ Particuliers | ❌ | ❌ | ❌ | ❌ |
| `admin_restaurant_entreprises` | ✅ Entreprises | ❌ | ❌ | ❌ | ❌ |
| `admin_restaurant_groupes` | ✅ Groupes | ❌ | ❌ | ❌ | ❌ |
| `admin_boutique` | ❌ | ✅ Global | ❌ | ❌ | ❌ |
| `admin_goodies` | ❌ | ✅ Goodies | ❌ | ❌ | ❌ |
| `admin_terroir` | ❌ | ✅ Terroir | ❌ | ❌ | ❌ |
| `admin_pastry` | ❌ | ✅ Pâtisserie | ❌ | ❌ | ❌ |
| `admin_dons` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `admin_ops` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `admin` | ✅ Global | ✅ Global | ✅ | ✅ | ❌ |
| `super_admin` | ✅ Global | ✅ Global | ✅ | ✅ | ✅ |

### Implémentation tRPC

```typescript
// server/routers.ts

// Procédure protégée avec permission
const adminReservationsRouter = {
  list: protectedProcedure
    .use(({ ctx, next }) => {
      if (!['admin_reservations', 'admin', 'super_admin'].includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return next({ ctx });
    })
    .input(z.object({
      type: z.enum(['particulier', 'entreprise', 'groupe']).optional(),
      status: z.string().optional(),
      page: z.number().default(1),
    }))
    .query(async ({ input, ctx }) => {
      // Logique requête
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Logique requête
    }),

  update: protectedProcedure
    .use(({ ctx, next }) => {
      if (!['admin_reservations', 'admin', 'super_admin'].includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return next({ ctx });
    })
    .input(z.object({
      id: z.string(),
      status: z.enum(['confirmed', 'rejected', 'cancelled']).optional(),
      payment_status: z.enum(['paid', 'unpaid', 'refunded']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Logique mutation
    }),
};
```

---

## 🎯 Routes

**Réservations** :
```
/admin/reservations                    (global)
/admin/reservations?type=particulier   (particuliers)
/admin/reservations?type=entreprise    (entreprises)
/admin/reservations?type=groupe        (groupes)
/admin/reservations/:id                (détails)
```

**Commerce** :
```
/admin/commerce                        (global)
/admin/commerce?type=goodie            (goodies)
/admin/commerce?type=terroir           (terroir)
/admin/commerce?type=pastry            (pâtisserie)
/admin/commerce/orders                 (commandes)
/admin/commerce/:id                    (détails produit)
```

**Dons** :
```
/admin/dons                            (global)
/admin/dons/:id                        (détails)
```

**Bénévoles** :
```
/admin/benevoles                       (global)
/admin/benevoles/:id                   (détails)
```

---

## 📋 Checklist Implémentation

### Phase 1 : Architecture
- [ ] Créer composants génériques (DataTable, FilterPanel, ActionMenu, DetailsDrawer)
- [ ] Créer hooks personnalisés (useReservations, useCommerce, useDons, useBenevoles)
- [ ] Définir types TypeScript pour chaque entité

### Phase 2 : Réservations
- [ ] Créer AdminReservationsPage.tsx
- [ ] Implémenter table unifiée
- [ ] Implémenter filtres
- [ ] Implémenter actions (voir, valider, refuser, payer, supprimer)
- [ ] Implémenter détails drawer

### Phase 3 : Commerce
- [ ] Créer AdminCommercePage.tsx
- [ ] Implémenter table produits
- [ ] Implémenter table commandes
- [ ] Implémenter filtres
- [ ] Implémenter actions (modifier, stock, commandes, activer/désactiver)

### Phase 4 : Dons & Bénévoles
- [ ] Créer AdminDonsPage.tsx
- [ ] Créer AdminBenevoles.tsx
- [ ] Implémenter tables
- [ ] Implémenter filtres
- [ ] Implémenter actions

### Phase 5 : Routes & Permissions
- [ ] Mettre à jour App.tsx
- [ ] Implémenter filtrage par query params
- [ ] Implémenter RBAC côté frontend
- [ ] Tester permissions

### Phase 6 : QA & Validation
- [ ] Tester chaque vue
- [ ] Tester filtres
- [ ] Tester actions
- [ ] Tester permissions
- [ ] Tester responsive

---

## 🚀 Bénéfices

| Avant | Après |
|-------|-------|
| 3 systèmes séparés | 1 système unifié |
| Duplication code | Code réutilisable |
| Actions dispersées | Actions centralisées |
| Vision fragmentée | Vue 360° |
| Maintenance complexe | Maintenance simplifiée |
| Bugs répétés | Bugs corrigés une fois |

---

## 📞 Notes

- Chaque vue spécialisée est juste un filtre appliqué à la vue centrale
- Les composants génériques (DataTable, FilterPanel) sont réutilisables
- Les permissions sont vérifiées côté serveur (tRPC) et côté client (UI)
- Les routes utilisent query params pour filtrer (pas de routes séparées)
