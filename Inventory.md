# 📋 Inventory — Ftour Bab Rayan v2

**Dernière mise à jour** : 2026-02-12  
**Objectif** : Inventaire exhaustif des routes publiques, modules admin, tables, services et emails

---

## A) ROUTES PUBLIQUES (Front)

### A1) Routes principales (sans paramètre de langue)
- `/` → Redirection vers `/:lang` (détection automatique)
- `/scanner` → Scanner QR (bénévoles + produits)
- `/checkin/:token` → Validation QR bénévole
- `/checkin-reservation/:token` → Validation QR réservation restaurant

### A2) Routes avec paramètre de langue `/:lang`

#### Pages principales
- `/:lang` → Home (accueil)
- `/:lang/programme` → Programme Ramadan
- `/:lang/evenement` → Événement
- `/:lang/association` → Association Bab Rayan
- `/:lang/contact` → Formulaire de contact
- `/:lang/faq` → FAQ
- `/:lang/mentions-legales` → Mentions légales
- `/:lang/benevole` → Inscription bénévoles

#### Restaurant (Réservations)
- `/:lang/restaurant/particuliers` → Formulaire réservation particuliers (1-12 places)
- `/:lang/restaurant/groupes` → Formulaire réservation groupes (1-120 places)
- `/:lang/reservation` → Réservation (legacy/fallback)
- `/:lang/company-booking` → Formulaire réservation entreprises (10-120 places)
- `/:lang/company-booking-confirmation/:reference` → Confirmation entreprise
- `/:lang/company-booking-space/:token` → Sélection espace entreprise

#### Commerce (Goodies, Pâtisserie, Terroir)
- `/:lang/goodies` → Catalogue goodies
- `/:lang/buy/goodie/:id` → Achat goodie
- `/:lang/patisserie` → Catalogue pâtisserie
- `/:lang/buy/pastry/:id` → Achat pâtisserie
- `/:lang/terroir` → Catalogue produits terroir
- `/:lang/cart/:type` → Panier (type: goodies|pastry|terroir)
- `/:lang/checkout/:type` → Paiement unifié

#### Solidarité
- `/:lang/dons` → Promesses de dons

#### Auth
- `/:lang/connexion` → Login
- `/:lang/inscription` → Signup

---

## B) ROUTES ADMIN (Dashboard)

### B1) Routes principales
- `/admin` → Dashboard principal (liste des modules)
- `/admin/unified-dashboard` → Tableau de bord unifié (super_admin)

### B2) Restaurant
- `/admin/restaurant/particuliers` → Gestion réservations particuliers
- `/admin/restaurant/entreprises` → Gestion réservations entreprises
- `/admin/restaurant/groupes` → Gestion réservations groupes
- `/admin/restaurants` → Configuration restaurants (super_admin)
- `/admin/restaurant-reservations` → Vue unifiée réservations restaurant
- `/admin/reservations` → Réservations Ftour (legacy)
- `/admin/company-bookings` → Réservations entreprises (legacy)
- `/admin/scan-reservation` → Scanner réservations restaurant

### B3) Commerce
- `/admin/commandes` → Commandes goodies
- `/admin/goodies` → Catalogue goodies
- `/admin/pastries` → Pâtisserie (commandes + billets)
- `/admin/terroir/orders` → Commandes terroir
- `/admin/terroir/products` → Catalogue terroir
- `/admin/payments` → Suivi paiements

### B4) Engagement
- `/admin/benevoles` → Gestion bénévoles
- `/admin/jours` → Calendrier Ramadan (super_admin)
- `/admin/scan` → Scanner bénévoles (legacy)
- `/admin/scan-product` → Scanner produits

### B5) Solidarité
- `/admin/dons` → Gestion dons

### B6) Système
- `/admin/utilisateurs` → Gestion utilisateurs (super_admin)
- `/admin/messages` → Messages de contact
- `/admin/contenu` → Partenaires, témoignages, FAQ

---

## C) TABLES BASE DE DONNÉES (35 tables)

### C1) Authentification & Utilisateurs
- `users` — Utilisateurs (id, openId, name, email, phone, role, createdAt, updatedAt, lastSignedIn)
  - Roles: user, admin, super_admin, admin_ops, admin_boutique, admin_dons, scanner, admin_restaurant_particuliers, admin_restaurant_entreprises, admin_restaurant_groupes, admin_patisserie, admin_terroir

### C2) Ramadan & Calendrier
- `ramadan_days` — Jours Ramadan (id, date, dayNumber, maxCapacity, currentCount, isClosed, location, startTime, endTime, instructions)

### C3) Bénévoles
- `volunteers` — Inscriptions bénévoles (id, firstName, lastName, email, phone, city, dayId, qrToken, qrStatus, status, scannedAt, scannedBy, acceptedTerms, emailSent, notes)
  - Status: registered, confirmed, present, absent, cancelled
  - QR Status: generated, validated, expired, invalid
- `scan_history` — Historique scans (id, volunteerId, scannedBy, action, success, timestamp)

### C4) Restaurant (Réservations)
- `restaurant_reservations` — Réservations restaurant (id, reference, type, email, phone, name, date, seatsTotal, status, paymentStatus, qrStatus, qrCode, qrToken, validatedAt, validatedBy, notes, createdAt, updatedAt)
  - Type: particulier, entreprise, groupe
  - Status: pending_validation, validated_pending_payment, paid_confirmed, refused
  - Payment Status: not_requested, pending_payment, paid, failed, refunded
  - QR Status: inactive, active, used, revoked
- `restaurant_slots` — Créneaux horaires (id, restaurantId, date, time, maxCapacity, currentCount)
- `restaurant_reservation_allocations` — Allocations places (id, reservationId, slotId, seatsAllocated)
- `spaces` — Espaces restaurants (id, name, capacity, location)

### C5) Entreprises (Company Bookings)
- `company_bookings` — Réservations entreprises (id, companyName, contactName, email, phone, status, participantsCount, notes, createdAt, updatedAt)
  - Status: pending, confirmed, cancelled
- `company_tickets` — Billets entreprises (id, bookingId, ticketNumber, status, checkedInAt)
  - Status: issued, checked_in, no_show, cancelled
- `company_booking_scans` — Scans entreprises (id, ticketId, scannedAt, scannedBy)
- `booking_holds` — Réservations temporaires (id, bookingId, heldAt, expiresAt)

### C6) Goodies
- `goodies` — Produits goodies (id, name, description, price, image, stock, createdAt, updatedAt)
- `goodie_variants` — Variantes goodies (id, goodieId, variantName, variantValue, stock)

### C7) Pâtisserie
- `pastries` — Produits pâtisserie (id, name, description, price, image, stock, createdAt, updatedAt)
- `pastry_orders` — Commandes pâtisserie (id, reference, email, name, phone, items, status, paymentStatus, totalPrice, createdAt, updatedAt)
  - Status: reserved, paid, handed, cancelled
  - Payment Status: pending, confirmed, paid, cancelled

### C8) Terroir
- `terroir_products` — Produits terroir (id, name, description, price, image, stock, createdAt, updatedAt)
- `terroir_product_variants` — Variantes terroir (id, productId, variantName, variantValue, stock)
- `terroir_orders` — Commandes terroir (id, reference, email, name, phone, status, paymentStatus, totalPrice, createdAt, updatedAt)
- `terroir_order_items` — Lignes commandes terroir (id, orderId, productId, variantId, quantity, price)
- `terroir_pickup_slots` — Créneaux de retrait (id, date, time, maxCapacity, currentCount)

### C9) Commandes & Paiements
- `orders` — Commandes (id, reference, type, email, name, phone, status, paymentStatus, totalPrice, channel, createdAt, updatedAt)
  - Type: goodies, pastry, donation, ftour
  - Status: reserved, pending, confirmed, delivered, cancelled
  - Payment Status: pending, confirmed, paid, cancelled
  - Channel: online, on_site_qr, on_site_admin
- `order_items` — Lignes commandes (id, orderId, productId, variantId, quantity, price)
- `payments` — Paiements (id, reference, amount, method, status, orderId, createdAt, updatedAt)
  - Method: cash, bank_transfer, check, paypal, cmi, card
  - Status: pending, completed, failed, refunded
- `payment_logs` — Logs paiements (id, paymentId, status, message, timestamp)
- `payment_methods_config` — Configuration méthodes paiement (id, method, enabled, config)

### C10) Dons
- `donations` — Promesses de dons (id, reference, email, name, phone, amount, status, createdAt, updatedAt)
  - Status: promised, pending, received, cancelled, handed, checked_in

### C11) QR Codes
- `qr_tokens` — Tokens QR (id, token, type, entityId, status, expiresAt, createdAt)
  - Type: volunteer, reservation, product, company_ticket
  - Status: active, used, expired, revoked
- `qr_scans` — Scans QR (id, tokenId, scannedAt, scannedBy, action, success)

### C12) Contenu & Configuration
- `contact_messages` — Messages de contact (id, name, email, phone, subject, message, read, createdAt)
- `site_settings` — Paramètres site (id, key, value, type)
- `partners` — Partenaires (id, name, logo, description, link, createdAt)
- `testimonials` — Témoignages (id, name, text, image, createdAt)
- `faq_items` — FAQ (id, question, answer, order, createdAt, updatedAt)
- `media_gallery` — Galerie média (id, title, image, category, createdAt)

---

## D) SERVICES & ROUTERS tRPC

### D1) Routers principaux
- `auth` — Authentification (signin, signup, logout, me)
- `days` — Calendrier Ramadan
- `volunteers` — Bénévoles
- `checkin` — Check-in bénévoles
- `goodies` — Goodies
- `orders` — Commandes
- `donations` — Dons
- `contact` — Messages de contact
- `users` — Utilisateurs
- `public` — Données publiques
- `upload` — Upload fichiers
- `restaurants` — Restaurants
- `reservations` — Réservations (legacy)
- `payments` — Paiements
- `pastries` — Pâtisserie
- `pastryOrders` — Commandes pâtisserie
- `qr` — QR codes
- `companyBookings` — Réservations entreprises
- `restaurantReservations` — Réservations restaurant (particuliers, entreprises, groupes)
- `restaurantModule` — Admin restaurant (lister, valider, refuser)
- `terroirModule` — Admin terroir

### D2) Services (fichiers)
- `restaurant-reservation-services.ts` — CRUD réservations restaurant
- `company-booking-services.ts` — CRUD réservations entreprises
- `qr-service.ts` — Gestion QR codes
- `reservation-services.ts` — Services réservations (legacy)
- `supabase-services.ts` — Services Supabase génériques

### D3) Routers spécialisés
- `restaurant-reservation-routers.ts` — Routers réservations restaurant
- `company-booking-routers.ts` — Routers réservations entreprises
- `pastry-routers.ts` — Routers pâtisserie

---

## E) EMAILS & NOTIFICATIONS

### E1) Restaurant Particuliers
1. **Email 1** (Accusé de réception) → Utilisateur
   - Template: `generateParticulierReservationRequestEmail`
   - Trigger: Soumission formulaire
   - Contenu: Référence, date, places, contact
   - **SANS QR code**

2. **Email interne** → Équipe (digital@myspace.boats + CC heartfulness@myspace.boats)
   - Template: `generateNewBookingNotificationEmail`
   - Trigger: Soumission formulaire
   - Contenu: Détails réservation, lien admin

3. **Email 2** (Confirmation + QR) → Utilisateur
   - Template: `generateParticulierReservationConfirmedEmail`
   - Trigger: Admin validation
   - Contenu: Confirmation, QR code, instructions

4. **Email 3** (Refus) → Utilisateur
   - Template: `generateParticulierReservationRefusedEmail`
   - Trigger: Admin refus
   - Contenu: Motif refus, contact support

### E2) Restaurant Entreprises
1. **Email 1** (Accusé) → Utilisateur
2. **Email interne** → Équipe
3. **Email 2** (Confirmation + QR) → Utilisateur
4. **Email 3** (Refus) → Utilisateur

### E3) Restaurant Groupes
1. **Email 1** (Accusé) → Utilisateur
2. **Email interne** → Équipe
3. **Email 2** (Confirmation + QR) → Utilisateur
4. **Email 3** (Refus) → Utilisateur

### E4) Autres modules
- **Bénévoles** → Email confirmation inscription + QR
- **Goodies** → Email confirmation commande
- **Pâtisserie** → Email confirmation commande
- **Terroir** → Email confirmation commande
- **Dons** → Email confirmation promesse
- **Contact** → Email notification interne

### E5) Configuration email
- **Sender** : `Ftour Bab Rayan <noreply@ftourbabrayan.ma>` (domaine vérifié Resend)
- **API** : Resend (https://api.resend.com/emails)
- **Auth** : `RESEND_API_KEY` (variable d'environnement)

---

## F) SCANNER QR

### F1) Routes scanner
- `/scanner` → Scanner public (bénévoles + produits)
- `/admin/scan` → Scanner admin bénévoles (legacy)
- `/admin/scan-product` → Scanner admin produits
- `/admin/scan-reservation` → Scanner réservations restaurant

### F2) Types QR
- **Bénévole** → Token sécurisé 128 bits → `/checkin/:token`
  - Valide: registered → confirmed → present
  - Scans multiples détectés
  
- **Réservation restaurant** → Token sécurisé → `/checkin-reservation/:token`
  - Valide: validated_pending_payment → paid_confirmed
  - Marque comme "used" après scan
  
- **Produit** → Token sécurisé → Scan produit
  - Valide: active → used
  - Enregistre historique scan

---

## G) STATUTS & WORKFLOWS

### G1) Réservation Restaurant
```
pending_validation 
  ↓ (Admin validation)
validated_pending_payment (QR généré, Email 2 envoyé)
  ↓ (Paiement reçu)
paid_confirmed (Réservation finalisée)

OU

pending_validation 
  ↓ (Admin refus)
refused (Email 3 envoyé)
```

### G2) Bénévole
```
registered (inscription)
  ↓ (Email confirmation envoyé)
confirmed (Email reçu)
  ↓ (Scan QR)
present (présent)

OU

absent (non présent)
cancelled (annulation)
```

### G3) Commande (Goodies, Pâtisserie, Terroir)
```
reserved (réservation)
  ↓ (Paiement)
pending (paiement en attente)
  ↓ (Paiement reçu)
confirmed (confirmée)
  ↓ (Remise)
delivered (livrée)

OU

cancelled (annulée)
```

### G4) Don
```
promised (promesse)
  ↓ (Paiement)
pending (en attente)
  ↓ (Paiement reçu)
received (reçu)
  ↓ (Remise)
handed (remis)
  ↓ (Scan QR)
checked_in (validé)

OU

cancelled (annulé)
```

---

## H) RÔLES & PERMISSIONS

| Rôle | Description | Modules accessibles |
|------|-------------|---------------------|
| `user` | Utilisateur standard | Aucun admin |
| `admin` | Administrateur complet | Tous sauf gestion rôles |
| `super_admin` | Super administrateur | Tous + gestion rôles |
| `admin_ops` | Opérations | Bénévoles, Calendrier, Scanner, Réservations Ftour |
| `admin_boutique` | Commerce | Goodies, Pâtisserie, Terroir, Commandes, Paiements |
| `admin_dons` | Dons | Dons, Paiements |
| `admin_restaurant_particuliers` | Restaurant Particuliers | Réservations particuliers |
| `admin_restaurant_entreprises` | Restaurant Entreprises | Réservations entreprises |
| `admin_restaurant_groupes` | Restaurant Groupes | Réservations groupes |
| `admin_patisserie` | Pâtisserie | Pâtisserie |
| `admin_terroir` | Terroir | Terroir |
| `scanner` | Scanner | Scanner bénévoles + produits |

---

## I) COMPOSANTS ADMIN

| Composant | Route | Tables | Rôles | État |
|-----------|-------|--------|-------|------|
| AdminDashboard | `/admin` | - | all | ✅ |
| AdminRestaurantParticuliers | `/admin/restaurant/particuliers` | restaurant_reservations | admin_restaurant_particuliers | ✅ |
| AdminRestaurantEntreprises | `/admin/restaurant/entreprises` | restaurant_reservations | admin_restaurant_entreprises | ✅ |
| AdminRestaurantGroupes | `/admin/restaurant/groupes` | restaurant_reservations | admin_restaurant_groupes | ✅ |
| AdminRestaurantReservations | `/admin/restaurant-reservations` | restaurant_reservations | admin, super_admin | ✅ |
| AdminReservations | `/admin/reservations` | reservations | admin_ops | ⚠️ Legacy |
| AdminCompanyBookings | `/admin/company-bookings` | company_bookings | admin_boutique | ⚠️ Legacy |
| AdminRestaurants | `/admin/restaurants` | spaces, restaurant_slots | super_admin | ⚠️ Incomplete |
| AdminScanReservation | `/admin/scan-reservation` | restaurant_reservations, qr_scans | admin, scanner | ✅ |
| AdminBenevoles | `/admin/benevoles` | volunteers, scan_history | admin_ops | ✅ |
| AdminJours | `/admin/jours` | ramadan_days | super_admin | ✅ |
| AdminScan | `/admin/scan` | volunteers, scan_history | admin_ops, scanner | ⚠️ Legacy |
| AdminScanProduct | `/admin/scan-product` | qr_tokens, qr_scans | admin_ops, scanner | ✅ |
| AdminGoodies | `/admin/goodies` | goodies, goodie_variants | admin_boutique | ✅ |
| AdminCommandes | `/admin/commandes` | orders, order_items | admin_boutique | ✅ |
| AdminPastries | `/admin/pastries` | pastries, pastry_orders | admin_boutique, admin_patisserie | ✅ |
| AdminTerroirProducts | `/admin/terroir/products` | terroir_products, terroir_product_variants | admin_terroir | ✅ |
| AdminTerroirOrders | `/admin/terroir/orders` | terroir_orders, terroir_order_items | admin_terroir | ✅ |
| AdminDons | `/admin/dons` | donations | admin_dons | ✅ |
| AdminPayments | `/admin/payments` | payments, payment_logs | admin_boutique, admin_dons, admin_terroir | ✅ |
| AdminUtilisateurs | `/admin/utilisateurs` | users | super_admin | ✅ |
| AdminMessages | `/admin/messages` | contact_messages | super_admin | ✅ |
| AdminContenu | `/admin/contenu` | partners, testimonials, faq_items, media_gallery | super_admin | ✅ |
| AdminUnifiedDashboard | `/admin/unified-dashboard` | all | super_admin | ⚠️ Incomplete |

---

## J) PROBLÈMES IDENTIFIÉS (À RÉSOUDRE)

### J1) Redondances
- ❌ `/admin/reservations` (legacy) vs `/admin/restaurant-reservations` (nouveau)
- ❌ `/admin/company-bookings` (legacy) vs `/admin/restaurant/entreprises` (nouveau)
- ❌ `/admin/scan` (legacy) vs `/admin/scan-product` (nouveau)

### J2) Incohérences de noms
- `restaurantReservations` vs `restaurantModule` (même données, routes différentes)
- `companyBookings` vs `restaurantModule.entreprises` (confusion)
- `terroirModule` vs `terroir*` (inconsistance)

### J3) Modules incomplets
- `AdminRestaurants` — Configuration restaurants (vide)
- `AdminUnifiedDashboard` — Tableau unifié (incomplet)
- `AdminReservations` — Réservations Ftour (legacy, à clarifier)

### J4) Routes orphelines
- `/admin/company-booking-space/:token` (front) — Pas de route admin correspondante
- `/admin/company-booking-confirmation/:reference` (front) — Pas de route admin correspondante

### J5) Traductions manquantes
- 35+ clés en anglais (en.ts) et arabe (ar.ts)
- Clés restaurant_particuliers, restaurant_entreprises, restaurant_groupes
- Clés companyBooking*

---

## K) PROCHAINES ÉTAPES

1. ✅ **Audit complet** (ce document)
2. ⏳ **Matrice de cohérence** (Admin-Front-DB-Matrix.md)
3. ⏳ **PR #1 : Nettoyage** (suppression legacy)
4. ⏳ **PR #2 : Connexion & complétion**
5. ⏳ **PR #3 : Standardisation**
6. ⏳ **QA.md : Scénarios de test**
