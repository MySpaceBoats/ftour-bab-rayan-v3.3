# 📊 Admin-Front-DB Matrix — Ftour Bab Rayan v2

**Dernière mise à jour** : 2026-02-12  
**Objectif** : Matrice de cohérence module-par-module (Front ↔ Admin ↔ DB ↔ Emails)

---

## LÉGENDE

- **État** : ✅ Connecté | ⚠️ Partiel | ❌ Orphelin
- **Décision** : KEEP | FIX | MERGE | REMOVE
- **MVP** : Priorité pour MVP | V2 : Peut attendre

---

## 1. RESTAURANT — PARTICULIERS

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/restaurant/particuliers` |
| **Admin route** | `/admin/restaurant/particuliers` |
| **DB table** | `restaurant_reservations` (type='particulier') |
| **Rôle** | admin_restaurant_particuliers |
| **Statuts** | pending_validation → validated_pending_payment → paid_confirmed \| refused |
| **Emails** | Email 1 (accusé), Email interne, Email 2 (confirmation+QR), Email 3 (refus) |
| **Scanner** | `/admin/scan-reservation` (QR validation) |
| **API/Services** | `restaurantReservations.particulier.create`, `restaurantModule.adminListParticuliers`, `adminUpdateStatus` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Workflow complet, prêt MVP |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 2. RESTAURANT — ENTREPRISES

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/company-booking` |
| **Admin route** | `/admin/restaurant/entreprises` |
| **DB table** | `restaurant_reservations` (type='entreprise') |
| **Rôle** | admin_restaurant_entreprises |
| **Statuts** | pending_validation → validated_pending_payment → paid_confirmed \| refused |
| **Emails** | Email 1 (accusé), Email interne, Email 2 (confirmation+QR), Email 3 (refus) |
| **Scanner** | `/admin/scan-reservation` (QR validation) |
| **API/Services** | `restaurantReservations.entreprise.create`, `restaurantModule.adminListEntreprises`, `adminUpdateStatus` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Workflow complet, prêt MVP |
| **MVP/V2** | MVP |
| **Problèmes** | Routes orphelines: `/company-booking-confirmation/:reference`, `/company-booking-space/:token` (à clarifier) |

---

## 3. RESTAURANT — GROUPES

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/restaurant/groupes` |
| **Admin route** | `/admin/restaurant/groupes` |
| **DB table** | `restaurant_reservations` (type='groupe') |
| **Rôle** | admin_restaurant_groupes |
| **Statuts** | pending_validation → validated_pending_payment → paid_confirmed \| refused |
| **Emails** | Email 1 (accusé), Email interne, Email 2 (confirmation+QR), Email 3 (refus) |
| **Scanner** | `/admin/scan-reservation` (QR validation) |
| **API/Services** | `restaurantReservations.groupe.create`, `restaurantModule.adminListGroupes`, `adminUpdateStatus` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Workflow complet, prêt MVP |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 4. RESTAURANT — RÉSERVATIONS FTOUR (Legacy)

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/reservation` |
| **Admin route** | `/admin/reservations` |
| **DB table** | `reservations` (legacy) |
| **Rôle** | admin_ops |
| **Statuts** | pending → confirmed → paid \| cancelled |
| **Emails** | Confirmation réservation |
| **Scanner** | `/admin/scan-reservation` |
| **API/Services** | `reservations.*` |
| **État** | ⚠️ Partiel — Table legacy, route front active |
| **Décision** | **MERGE** — Fusionner avec `restaurant_reservations` ou clarifier le workflow |
| **MVP/V2** | V2 (après MVP) |
| **Problèmes** | ❌ Doublon fonctionnel avec restaurant_particuliers/entreprises/groupes |
| **Action** | Clarifier si c'est une route fallback ou un workflow distinct |

---

## 5. RESTAURANT — COMPANY BOOKINGS (Legacy)

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/company-booking` (même que entreprises) |
| **Admin route** | `/admin/company-bookings` |
| **DB table** | `company_bookings` (legacy) |
| **Rôle** | admin_boutique |
| **Statuts** | pending → confirmed → cancelled |
| **Emails** | Confirmation réservation |
| **Scanner** | Scans entreprises |
| **API/Services** | `companyBookings.*` |
| **État** | ❌ Orphelin — Doublon de restaurant_entreprises |
| **Décision** | **REMOVE** — Supprimer, utiliser `restaurant_reservations` type='entreprise' |
| **MVP/V2** | Legacy (à supprimer) |
| **Problèmes** | ❌ Deux tables pour le même flux (company_bookings vs restaurant_reservations) |
| **Action** | Migrer données vers restaurant_reservations, supprimer routes legacy |

---

## 6. RESTAURANT — CONFIGURATION

| Aspect | Détail |
|--------|--------|
| **Front route** | Aucune (admin only) |
| **Admin route** | `/admin/restaurants` |
| **DB table** | `spaces`, `restaurant_slots` |
| **Rôle** | super_admin |
| **Statuts** | N/A |
| **Emails** | Aucun |
| **Scanner** | N/A |
| **API/Services** | `restaurants.*` |
| **État** | ⚠️ Partiel — Composant vide, tables existent |
| **Décision** | **FIX** — Implémenter gestion restaurants/espaces/créneaux |
| **MVP/V2** | V2 (après MVP) |
| **Problèmes** | ⚠️ Composant AdminRestaurants vide, pas d'UI |
| **Action** | Créer UI CRUD pour spaces et restaurant_slots |

---

## 7. BÉNÉVOLES

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/benevole` |
| **Admin route** | `/admin/benevoles` |
| **DB table** | `volunteers`, `scan_history` |
| **Rôle** | admin_ops |
| **Statuts** | registered → confirmed → present \| absent \| cancelled |
| **Emails** | Email confirmation inscription + QR |
| **Scanner** | `/scanner` (public), `/admin/scan` (legacy) |
| **API/Services** | `volunteers.*`, `checkin.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Workflow complet |
| **MVP/V2** | MVP |
| **Problèmes** | ⚠️ Deux routes scanner: `/scanner` (public) et `/admin/scan` (legacy) |
| **Action** | Consolider en `/scanner` public, supprimer `/admin/scan` |

---

## 8. GOODIES

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/goodies`, `/:lang/buy/goodie/:id`, `/:lang/cart/goodies`, `/:lang/checkout/goodies` |
| **Admin route** | `/admin/goodies` (catalogue), `/admin/commandes` (commandes) |
| **DB table** | `goodies`, `goodie_variants`, `orders`, `order_items` |
| **Rôle** | admin_boutique |
| **Statuts** | reserved → pending → confirmed → delivered \| cancelled |
| **Emails** | Email confirmation commande |
| **Scanner** | `/admin/scan-product` |
| **API/Services** | `goodies.*`, `orders.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Workflow complet |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 9. PÂTISSERIE

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/patisserie`, `/:lang/buy/pastry/:id`, `/:lang/cart/pastry`, `/:lang/checkout/pastry` |
| **Admin route** | `/admin/pastries` |
| **DB table** | `pastries`, `pastry_orders` |
| **Rôle** | admin_boutique, admin_patisserie |
| **Statuts** | reserved → paid → handed → cancelled |
| **Emails** | Email confirmation commande |
| **Scanner** | `/admin/scan-product` |
| **API/Services** | `pastries.*`, `pastryOrders.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Workflow complet |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 10. TERROIR

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/terroir`, `/:lang/cart/terroir`, `/:lang/checkout/terroir` |
| **Admin route** | `/admin/terroir/products`, `/admin/terroir/orders` |
| **DB table** | `terroir_products`, `terroir_product_variants`, `terroir_orders`, `terroir_order_items`, `terroir_pickup_slots` |
| **Rôle** | admin_terroir |
| **Statuts** | reserved → pending → confirmed → delivered \| cancelled |
| **Emails** | Email confirmation commande |
| **Scanner** | `/admin/scan-product` |
| **API/Services** | `terroirModule.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Workflow complet |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 11. DONS

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/dons` |
| **Admin route** | `/admin/dons` |
| **DB table** | `donations` |
| **Rôle** | admin_dons |
| **Statuts** | promised → pending → received → handed → checked_in \| cancelled |
| **Emails** | Email confirmation promesse |
| **Scanner** | `/admin/scan-product` (validation remise) |
| **API/Services** | `donations.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Workflow complet |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 12. PAIEMENTS

| Aspect | Détail |
|--------|--------|
| **Front route** | Intégré dans `/checkout/*` |
| **Admin route** | `/admin/payments` |
| **DB table** | `payments`, `payment_logs`, `payment_methods_config` |
| **Rôle** | admin_boutique, admin_dons, admin_terroir |
| **Statuts** | pending → completed \| failed \| refunded |
| **Emails** | Notification paiement reçu |
| **Scanner** | N/A |
| **API/Services** | `payments.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Transversal, workflow complet |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 13. CALENDRIER RAMADAN

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/programme` |
| **Admin route** | `/admin/jours` |
| **DB table** | `ramadan_days` |
| **Rôle** | super_admin |
| **Statuts** | N/A (configuration) |
| **Emails** | Aucun |
| **Scanner** | N/A |
| **API/Services** | `days.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Configuration système |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 14. UTILISATEURS & RÔLES

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/connexion`, `/:lang/inscription` |
| **Admin route** | `/admin/utilisateurs` |
| **DB table** | `users` |
| **Rôle** | super_admin |
| **Statuts** | N/A |
| **Emails** | Email confirmation inscription |
| **Scanner** | N/A |
| **API/Services** | `auth.*`, `users.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Système critique |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 15. MESSAGES DE CONTACT

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/contact` |
| **Admin route** | `/admin/messages` |
| **DB table** | `contact_messages` |
| **Rôle** | super_admin |
| **Statuts** | read/unread |
| **Emails** | Email notification interne |
| **Scanner** | N/A |
| **API/Services** | `contact.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Workflow complet |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 16. CONTENU (Partenaires, Témoignages, FAQ)

| Aspect | Détail |
|--------|--------|
| **Front route** | `/:lang/faq`, `/:lang/association`, `/:lang/mentions-legales` |
| **Admin route** | `/admin/contenu` |
| **DB table** | `faq_items`, `partners`, `testimonials`, `media_gallery`, `site_settings` |
| **Rôle** | super_admin |
| **Statuts** | N/A (configuration) |
| **Emails** | Aucun |
| **Scanner** | N/A |
| **API/Services** | `public.*` |
| **État** | ✅ Connecté |
| **Décision** | **KEEP** — Configuration contenu |
| **MVP/V2** | MVP |
| **Problèmes** | Aucun identifié |

---

## 17. SCANNER (Unifié)

| Aspect | Détail |
|--------|--------|
| **Front route** | `/scanner` (public) |
| **Admin route** | `/admin/scan-product`, `/admin/scan-reservation` |
| **DB table** | `qr_tokens`, `qr_scans`, `scan_history` |
| **Rôle** | admin_ops, scanner |
| **Statuts** | active → used \| expired \| revoked |
| **Emails** | N/A |
| **Scanner** | Routes principales |
| **API/Services** | `qr.*` |
| **État** | ⚠️ Partiel — Trois routes pour un concept |
| **Décision** | **FIX** — Consolider `/scanner` (public) + `/admin/scan-product` + `/admin/scan-reservation` |
| **MVP/V2** | MVP |
| **Problèmes** | ❌ `/admin/scan` (legacy) redondant avec `/admin/scan-product` |
| **Action** | Supprimer `/admin/scan`, consolider logique dans `/scanner` et `/admin/scan-product` |

---

## 18. TABLEAU DE BORD UNIFIÉ

| Aspect | Détail |
|--------|--------|
| **Front route** | N/A (admin only) |
| **Admin route** | `/admin/unified-dashboard` |
| **DB table** | Toutes |
| **Rôle** | super_admin |
| **Statuts** | N/A |
| **Emails** | N/A |
| **Scanner** | N/A |
| **API/Services** | Tous |
| **État** | ⚠️ Partiel — Composant incomplet |
| **Décision** | **FIX** — Implémenter dashboard unifié avec statistiques |
| **MVP/V2** | V2 (après MVP) |
| **Problèmes** | ⚠️ Composant vide, pas d'UI |
| **Action** | Créer UI avec statistiques globales (réservations, commandes, dons, bénévoles) |

---

## RÉSUMÉ DES DÉCISIONS

### À GARDER (KEEP) — 14 modules
1. Restaurant Particuliers
2. Restaurant Entreprises
3. Restaurant Groupes
4. Bénévoles
5. Goodies
6. Pâtisserie
7. Terroir
8. Dons
9. Paiements
10. Calendrier Ramadan
11. Utilisateurs
12. Messages
13. Contenu
14. Scanner (après consolidation)

### À FUSIONNER (MERGE) — 1 module
1. Restaurant Réservations Ftour (legacy) → Fusionner avec restaurant_reservations

### À CORRIGER (FIX) — 3 modules
1. Restaurant Configuration → Implémenter UI CRUD
2. Scanner → Consolider 3 routes en 1 concept
3. Tableau de bord unifié → Implémenter statistiques

### À SUPPRIMER (REMOVE) — 2 modules
1. Company Bookings (legacy) → Utiliser restaurant_reservations type='entreprise'
2. Admin Scan (legacy) → Utiliser `/admin/scan-product`

---

## PLAN D'EXÉCUTION RECOMMANDÉ

### Phase 1 : Audit (✅ Fait)
- Créer Inventory.md
- Créer Admin-Front-DB-Matrix.md

### Phase 2 : Nettoyage (PR #1)
- Supprimer `/admin/company-bookings` (route + composant)
- Supprimer `/admin/scan` (route + composant)
- Supprimer `company-booking-routers.ts` (si redondant)
- Nettoyer imports dans App.tsx

### Phase 3 : Connexion & Complétion (PR #2)
- Implémenter `/admin/restaurants` (CRUD spaces + slots)
- Consolider scanner (public `/scanner` + admin `/admin/scan-product`)
- Clarifier `/admin/reservations` (Ftour legacy)

### Phase 4 : Standardisation (PR #3)
- Renommer routes/routers pour cohérence
- Aligner noms: `restaurantModule` → `restaurantReservations`
- Compléter traductions (en.ts, ar.ts)
- Documenter contrats API

### Phase 5 : QA & Tests
- Créer QA.md avec scénarios de test
- Tester workflows complets (front → admin → email → scanner)
- Valider permissions par rôle

---

## NOTES IMPORTANTES

1. **Prioriser MVP** : Garder les 14 modules "KEEP", supprimer legacy, corriger les 3 incomplets
2. **Éviter les doublons** : Une table = une source de vérité, une route admin par concept
3. **Traçabilité** : Tous les workflows doivent avoir: front form → admin list → admin detail → actions → emails
4. **Permissions** : Chaque rôle doit avoir un module dédié (sauf admin/super_admin qui voient tout)
5. **Scanner** : Concept transversal, consolider en une seule route publique + admin
