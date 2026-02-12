# ✅ QA Checklist — Refonte Dashboard Admin

**Date** : 2026-02-12  
**Objectif** : Valider refonte complète (17→12 modules, 3 blocs métier, consolidation)

---

## 📋 CHECKLIST GLOBALE

### Dashboard Principal
- [ ] Page `/admin` affiche 3 blocs (Revenus, Exécution, Administration)
- [ ] Chaque bloc a titre, description, et couleur cohérente
- [ ] Statistiques affichées correctement (Bénévoles, Commandes, Dons, Jours)
- [ ] Aucun module orphelin ou cassé
- [ ] Responsive sur mobile/tablet/desktop

### Bloc 1 : Revenus & Réservations 🔴
- [ ] **Réservations** : Route `/admin/reservations` fonctionne
  - [ ] Onglet Particuliers accessible
  - [ ] Onglet Entreprises accessible
  - [ ] Onglet Groupes accessible
  - [ ] Compteurs affichés (Total, En attente, Confirmées, Refusées)
  - [ ] Pas d'erreurs TypeScript/runtime

- [ ] **Commerce** : Route `/admin/commerce` fonctionne
  - [ ] Onglet Goodies accessible
  - [ ] Onglet Terroir accessible
  - [ ] Onglet Pâtisserie accessible
  - [ ] Onglet Paiements accessible (nouveau)
  - [ ] Pas d'erreurs TypeScript/runtime

- [ ] **Dons** : Route `/admin/dons` fonctionne
  - [ ] Liste dons affichée
  - [ ] Statuts corrects
  - [ ] Pas d'erreurs

### Bloc 2 : Exécution Terrain 🟢
- [ ] **Bénévoles** : Route `/admin/benevoles` fonctionne
  - [ ] Liste bénévoles affichée
  - [ ] Filtres par jour fonctionnels
  - [ ] Pas d'erreurs

- [ ] **Scanner** : Route `/admin/scanner` fonctionne
  - [ ] Onglet Restaurant accessible
  - [ ] Onglet Produits accessible
  - [ ] Onglet Bénévoles accessible
  - [ ] Input QR fonctionne
  - [ ] Pas d'erreurs TypeScript/runtime

- [ ] **Calendrier** : Route `/admin/calendrier` fonctionne
  - [ ] Liste jours affichée
  - [ ] Édition possible
  - [ ] Pas d'erreurs

### Bloc 3 : Administration 🟣
- [ ] **Utilisateurs** : Route `/admin/utilisateurs` fonctionne
  - [ ] Liste utilisateurs affichée
  - [ ] Gestion rôles possible
  - [ ] Pas d'erreurs

- [ ] **Contenu** : Route `/admin/contenu` fonctionne
  - [ ] Gestion FAQ possible
  - [ ] Gestion partenaires possible
  - [ ] Pas d'erreurs

- [ ] **Messages** : Route `/admin/messages` fonctionne
  - [ ] Liste messages affichée
  - [ ] Lecture messages possible
  - [ ] Pas d'erreurs

---

## 🔐 CHECKLIST RBAC (Rôles & Permissions)

### Rôle : user
- [ ] Accès `/admin` → Redirection login
- [ ] Pas d'accès aux modules admin

### Rôle : admin_restaurant_particuliers
- [ ] Accès `/admin/reservations` (onglet Particuliers)
- [ ] Pas d'accès autres onglets Réservations
- [ ] Pas d'accès Commerce, Dons, Bénévoles, etc.

### Rôle : admin_restaurant_entreprises
- [ ] Accès `/admin/reservations` (onglet Entreprises)
- [ ] Pas d'accès autres onglets Réservations

### Rôle : admin_restaurant_groupes
- [ ] Accès `/admin/reservations` (onglet Groupes)
- [ ] Pas d'accès autres onglets Réservations

### Rôle : admin_boutique
- [ ] Accès `/admin/commerce` (tous onglets)
- [ ] Pas d'accès Réservations, Dons, Bénévoles

### Rôle : admin_patisserie
- [ ] Accès `/admin/commerce` (onglet Pâtisserie)
- [ ] Pas d'accès autres onglets Commerce

### Rôle : admin_terroir
- [ ] Accès `/admin/commerce` (onglet Terroir)
- [ ] Pas d'accès autres onglets Commerce

### Rôle : admin_dons
- [ ] Accès `/admin/dons`
- [ ] Pas d'accès autres modules

### Rôle : admin_ops
- [ ] Accès `/admin/benevoles`
- [ ] Accès `/admin/scanner`
- [ ] Accès `/admin/calendrier`
- [ ] Pas d'accès Réservations, Commerce, Dons

### Rôle : scanner
- [ ] Accès `/admin/scanner`
- [ ] Pas d'accès autres modules

### Rôle : admin
- [ ] Accès tous modules (sauf gestion utilisateurs)
- [ ] Pas d'accès `/admin/utilisateurs`

### Rôle : super_admin
- [ ] Accès tous modules (y compris `/admin/utilisateurs`)

---

## 🔗 CHECKLIST ROUTES & REDIRECTS

### Routes consolidées (nouvelles)
- [ ] `/admin/reservations` → AdminReservationsConsolidated
- [ ] `/admin/commerce` → AdminCommerceConsolidated
- [ ] `/admin/scanner` → AdminScannerConsolidated
- [ ] `/admin/calendrier` → AdminJours (renommé)

### Routes legacy (maintenues pour compatibilité)
- [ ] `/admin/restaurant/particuliers` → AdminRestaurantParticuliers
- [ ] `/admin/restaurant/entreprises` → AdminRestaurantEntreprises
- [ ] `/admin/restaurant/groupes` → AdminRestaurantGroupes
- [ ] `/admin/goodies` → AdminGoodies
- [ ] `/admin/commandes` → AdminCommandes
- [ ] `/admin/patisserie` → AdminPastries
- [ ] `/admin/terroir/products` → AdminTerroirProducts
- [ ] `/admin/terroir/orders` → AdminTerroirOrders
- [ ] `/admin/scan-product` → AdminScanProduct
- [ ] `/admin/payments` → AdminPayments
- [ ] `/admin/jours` → AdminJours

### Routes supprimées (à vérifier)
- [ ] `/admin/company-bookings` → Supprimée (legacy)
- [ ] `/admin/scan` → Supprimée (legacy)
- [ ] `/admin/reservations` (legacy) → Remplacée par consolidée

---

## 🎨 CHECKLIST DESIGN & UX

### Dashboard Principal
- [ ] Titre "Administration" visible
- [ ] Sous-titre "Ftour Bab Rayan — Dashboard Simplifié" visible
- [ ] 3 blocs visuellement distincts (couleurs, icônes)
- [ ] Statistiques affichées en haut (4 cartes)
- [ ] Boutons "Gérer" / "Ouvrir" cohérents
- [ ] Icônes cohérentes par bloc

### Bloc 1 : Revenus & Réservations 🔴
- [ ] Titre avec emoji 🔴
- [ ] Description "Tout ce qui génère des flux financiers directs"
- [ ] 3 cartes : Réservations, Commerce, Dons
- [ ] Couleurs cohérentes (rouges/ambrés)

### Bloc 2 : Exécution Terrain 🟢
- [ ] Titre avec emoji 🟢
- [ ] Description "Pilotage opérationnel du Ramadan"
- [ ] 3 cartes : Bénévoles, Scanner, Calendrier
- [ ] Couleurs cohérentes (verts)

### Bloc 3 : Administration 🟣
- [ ] Titre avec emoji 🟣
- [ ] Description "Gestion interne et configuration"
- [ ] 3 cartes : Utilisateurs, Contenu, Messages
- [ ] Couleurs cohérentes (pourpres)

### Onglets internes (Réservations, Commerce, Scanner)
- [ ] Onglets affichés correctement
- [ ] Changement d'onglet fonctionne
- [ ] Contenu onglet change correctement
- [ ] Pas de scintillement ou lag
- [ ] Responsive sur mobile (onglets empilés ou scrollables)

---

## 🔍 CHECKLIST ERREURS & EDGE CASES

### TypeScript & Compilation
- [ ] Pas d'erreurs TypeScript (sauf traductions manquantes)
- [ ] Imports corrects
- [ ] Pas de `any` type inutile
- [ ] Props typées correctement

### Runtime
- [ ] Pas d'erreurs console
- [ ] Pas de warnings non-critiques
- [ ] Pas de memory leaks
- [ ] Pas de re-renders infinis

### Navigation
- [ ] Clic sur module → Ouverture correcte
- [ ] Retour arrière fonctionne
- [ ] Scroll vers haut au changement page
- [ ] URL correcte dans barre adresse

### Responsive
- [ ] Mobile (320px) : Onglets empilés, texte lisible
- [ ] Tablet (768px) : Layout 2 colonnes
- [ ] Desktop (1024px+) : Layout 3 colonnes
- [ ] Pas de débordement horizontal

---

## 📊 CHECKLIST STATISTIQUES

### Bloc 1 : Revenus
- [ ] Compteur Bénévoles affiche nombre correct
- [ ] Compteur Commandes affiche montant correct
- [ ] Compteur Dons affiche montant reçu correct
- [ ] Compteur Jours affiche nombre correct

### Bloc 2 : Exécution
- [ ] Stats Bénévoles (total, présents) correctes
- [ ] Stats Scanner (scans, taux) correctes
- [ ] Stats Calendrier (jours, capacité) correctes

### Bloc 3 : Administration
- [ ] Stats Utilisateurs (total, par rôle) correctes
- [ ] Stats Contenu (FAQ, partenaires) correctes
- [ ] Stats Messages (non lus, total) correctes

---

## 🚀 CHECKLIST PERFORMANCE

- [ ] Temps chargement page < 2s
- [ ] Pas de jank lors du scroll
- [ ] Pas de lag lors du changement onglet
- [ ] Pas de memory leak en navigation répétée
- [ ] Images optimisées (si présentes)

---

## 📝 NOTES DE TEST

**Environnement de test** :
- Browser : Chrome/Firefox/Safari
- Résolution : 1920x1080 (desktop), 375x812 (mobile)
- Connexion : Normale (pas de throttling)

**Utilisateurs de test** :
- super_admin (accès complet)
- admin (accès sauf utilisateurs)
- admin_ops (accès Bénévoles, Scanner, Calendrier)
- admin_restaurant_particuliers (accès Réservations particuliers)
- admin_boutique (accès Commerce)

**Scénarios critiques** :
1. Super admin accède à tous les modules
2. Admin_ops accède uniquement à Bénévoles, Scanner, Calendrier
3. Admin_restaurant_particuliers accède uniquement à Réservations particuliers
4. Changement onglet dans Réservations charge bon contenu
5. Changement onglet dans Commerce charge bon contenu
6. Changement onglet dans Scanner charge bon contenu
7. Retour à dashboard depuis module fonctionne
8. Responsive design fonctionne sur mobile

---

## ✅ VALIDATION FINALE

- [ ] Tous les tests passent
- [ ] Pas d'erreurs TypeScript (sauf traductions)
- [ ] Pas d'erreurs runtime
- [ ] Responsive design validé
- [ ] RBAC validé
- [ ] Routes validées
- [ ] Performance acceptable
- [ ] Prêt pour production

---

## 📞 SIGN-OFF

**Testé par** : [À remplir]  
**Date** : [À remplir]  
**Résultat** : ✅ PASS / ❌ FAIL  
**Notes** : [À remplir]
