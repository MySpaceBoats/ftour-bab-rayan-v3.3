# 🗺️ Refactor Roadmap — Ftour Bab Rayan v2

**Statut** : En cours (Phase 3/7 complétée)  
**Dernière mise à jour** : 2026-02-12

---

## ✅ PHASES COMPLÉTÉES

### Phase 1 : Cahier des charges ✅
- [x] Créer DASHBOARD_REFACTOR_SPEC.md
- [x] Définir 3 blocs métier
- [x] Documenter migration routes
- [x] Mapper modules → composants

### Phase 2 : Arborescence & RBAC ✅
- [x] Définir structure 12 modules
- [x] Créer mapping RBAC final
- [x] Documenter redirects

### Phase 3 : Réorganisation Dashboard ✅
- [x] Refactoriser AdminDashboard.tsx
- [x] Implémenter 3 blocs visuels
- [x] Ajouter descriptions blocs
- [x] Filtrer modules par rôle

---

## ⏳ PHASES RESTANTES

### Phase 4 : Consolider Scanner ⏳

**Objectif** : Fusionner 3 scanners en 1 module unique

**Routes actuelles** :
- `/admin/scan-reservation` (restaurant)
- `/admin/scan-product` (goodies/terroir)
- `/scanner` (bénévoles)

**Nouvelle route** :
- `/admin/scanner` (consolidée avec onglets internes)

**Tâches** :
- [ ] Créer AdminScannerConsolidated.tsx
- [ ] Implémenter onglets internes (restaurant, produits, bénévoles)
- [ ] Ajouter logique détection type QR
- [ ] Ajouter historique scan unifié
- [ ] Mettre à jour App.tsx routes
- [ ] Ajouter redirects anciennes routes

**Composants à créer** :
```
client/src/features/ops/admin/
├── AdminScannerConsolidated.tsx (nouveau)
│   ├── Onglet Restaurant
│   ├── Onglet Produits
│   └── Onglet Bénévoles
└── components/
    └── ScannerTabs.tsx (nouveau)
```

**Statut** : 🔨 À faire

---

### Phase 5 : Intégrer Paiements dans Commerce ⏳

**Objectif** : Déplacer Paiements comme onglet dans Commerce

**Routes actuelles** :
- `/admin/payments` (standalone)
- `/admin/commandes` (goodies)
- `/admin/goodies` (catalogue)
- `/admin/terroir/orders` (terroir)
- `/admin/terroir/products` (terroir)
- `/admin/pastries` (pâtisserie)

**Nouvelle route** :
- `/admin/commerce` (consolidée avec onglets)

**Tâches** :
- [ ] Créer AdminCommerceConsolidated.tsx
- [ ] Implémenter onglets internes (goodies, terroir, pâtisserie, paiements)
- [ ] Fusionner logique paiements
- [ ] Mettre à jour App.tsx routes
- [ ] Ajouter redirects anciennes routes

**Composants à créer** :
```
client/src/features/commerce/admin/
├── AdminCommerceConsolidated.tsx (nouveau)
│   ├── Onglet Goodies
│   ├── Onglet Terroir
│   ├── Onglet Pâtisserie
│   └── Onglet Paiements
└── components/
    └── CommerceTabs.tsx (nouveau)
```

**Statut** : 🔨 À faire

---

### Phase 6 : Consolider Réservations ⏳

**Objectif** : Fusionner réservations particuliers/entreprises/groupes

**Routes actuelles** :
- `/admin/restaurant/particuliers`
- `/admin/restaurant/entreprises`
- `/admin/restaurant/groupes`
- `/admin/reservations` (legacy)
- `/admin/restaurant-reservations`

**Nouvelle route** :
- `/admin/reservations` (consolidée avec onglets)

**Tâches** :
- [ ] Créer AdminReservationsConsolidated.tsx
- [ ] Implémenter onglets internes (particuliers, entreprises, groupes)
- [ ] Fusionner logique réservations
- [ ] Mettre à jour App.tsx routes
- [ ] Ajouter redirects anciennes routes

**Composants à créer** :
```
client/src/features/restaurant/admin/
├── AdminReservationsConsolidated.tsx (nouveau)
│   ├── Onglet Particuliers
│   ├── Onglet Entreprises
│   └── Onglet Groupes
└── components/
    └── ReservationsTabs.tsx (nouveau)
```

**Statut** : 🔨 À faire

---

### Phase 7 : Mettre à jour App.tsx ⏳

**Objectif** : Actualiser routes et redirects

**Tâches** :
- [ ] Remplacer routes individuelles par consolidées
- [ ] Ajouter redirects pour anciennes routes
- [ ] Tester navigation
- [ ] Valider RBAC

**Routes à ajouter** :
```tsx
// Nouvelles routes consolidées
<Route path="/admin/reservations" component={AdminReservationsConsolidated} />
<Route path="/admin/commerce" component={AdminCommerceConsolidated} />
<Route path="/admin/scanner" component={AdminScannerConsolidated} />
<Route path="/admin/calendrier" component={AdminCalendar} />

// Redirects anciennes routes
<Route path="/admin/restaurant/particuliers" component={() => <Redirect to="/admin/reservations?tab=particuliers" />} />
<Route path="/admin/restaurant/entreprises" component={() => <Redirect to="/admin/reservations?tab=entreprises" />} />
<Route path="/admin/restaurant/groupes" component={() => <Redirect to="/admin/reservations?tab=groupes" />} />
<Route path="/admin/commandes" component={() => <Redirect to="/admin/commerce?tab=goodies" />} />
<Route path="/admin/goodies" component={() => <Redirect to="/admin/commerce?tab=goodies" />} />
<Route path="/admin/pastries" component={() => <Redirect to="/admin/commerce?tab=patisserie" />} />
<Route path="/admin/terroir/orders" component={() => <Redirect to="/admin/commerce?tab=terroir" />} />
<Route path="/admin/terroir/products" component={() => <Redirect to="/admin/commerce?tab=terroir" />} />
<Route path="/admin/payments" component={() => <Redirect to="/admin/commerce?tab=paiements" />} />
<Route path="/admin/scan-reservation" component={() => <Redirect to="/admin/scanner?tab=restaurant" />} />
<Route path="/admin/scan-product" component={() => <Redirect to="/admin/scanner?tab=produits" />} />
<Route path="/admin/jours" component={() => <Redirect to="/admin/calendrier" />} />
```

**Statut** : 🔨 À faire

---

### Phase 8 : QA & Validation ⏳

**Objectif** : Tester refonte complète

**Scénarios de test** :
- [ ] Tester accès par rôle (chaque rôle ne voit que ses modules)
- [ ] Tester onglets internes (changement onglet charge bonne vue)
- [ ] Tester redirects (anciennes routes redirigent correctement)
- [ ] Tester statistiques (compteurs affichés correctement)
- [ ] Tester navigation (liens fonctionnent)
- [ ] Tester responsive (mobile, tablet, desktop)

**Checklist** :
- [ ] Dashboard principal affiche 3 blocs
- [ ] Bloc 1 : Réservations, Commerce, Dons
- [ ] Bloc 2 : Bénévoles, Scanner, Calendrier
- [ ] Bloc 3 : Utilisateurs, Contenu, Messages
- [ ] Chaque module a description claire
- [ ] Icônes cohérentes par bloc
- [ ] Couleurs cohérentes par bloc
- [ ] Stats affichées correctement
- [ ] Pas d'erreurs TypeScript

**Statut** : 🔨 À faire

---

### Phase 9 : Sauvegarder Checkpoint ⏳

**Objectif** : Créer checkpoint final

**Tâches** :
- [ ] Vérifier tous les fichiers modifiés
- [ ] Vérifier pas d'erreurs TypeScript
- [ ] Vérifier pas d'erreurs runtime
- [ ] Créer checkpoint avec description

**Statut** : 🔨 À faire

---

## 📊 RÉSUMÉ PROGRESSION

| Phase | Titre | Statut | % |
|-------|-------|--------|---|
| 1 | Cahier des charges | ✅ | 100% |
| 2 | Arborescence & RBAC | ✅ | 100% |
| 3 | Réorganisation Dashboard | ✅ | 100% |
| 4 | Consolider Scanner | ⏳ | 0% |
| 5 | Intégrer Paiements | ⏳ | 0% |
| 6 | Consolider Réservations | ⏳ | 0% |
| 7 | Mettre à jour App.tsx | ⏳ | 0% |
| 8 | QA & Validation | ⏳ | 0% |
| 9 | Sauvegarder Checkpoint | ⏳ | 0% |

**Progression globale** : 3/9 = 33%

---

## 🎯 PROCHAINES ÉTAPES

1. **Immédiat** : Consolider Scanner (Phase 4)
   - Créer AdminScannerConsolidated.tsx
   - Implémenter onglets internes
   - Tester navigation

2. **Court terme** : Intégrer Paiements (Phase 5)
   - Créer AdminCommerceConsolidated.tsx
   - Fusionner logique commerce
   - Tester onglets

3. **Moyen terme** : Consolider Réservations (Phase 6)
   - Créer AdminReservationsConsolidated.tsx
   - Fusionner logique réservations
   - Tester onglets

4. **Long terme** : Mettre à jour App.tsx et QA (Phases 7-9)
   - Actualiser routes
   - Tester complet
   - Sauvegarder checkpoint

---

## 📝 NOTES IMPORTANTES

1. **Onglets internes** : Utiliser React tabs (pas de nouvelles routes)
2. **Redirects** : Anciennes routes redirigent avec query params
3. **RBAC** : Chaque rôle ne voit que ses modules
4. **Statistiques** : Afficher sur cartes du dashboard
5. **Responsive** : Tester sur mobile/tablet/desktop

---

## 📞 CONTACTS & ESCALADE

- **Refonte effectuée par** : Claude (Manus AI)
- **Date** : 2026-02-12
- **Durée estimée restante** : 4-6 heures
- **Prochaines étapes** : Consolider Scanner (Phase 4)
