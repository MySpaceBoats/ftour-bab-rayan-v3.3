# 🧪 QA — Scénarios de test Ftour Bab Rayan v2

**Dernière mise à jour** : 2026-02-12  
**Objectif** : Scénarios de test end-to-end pour valider les workflows complets

---

## CONVENTIONS

- ✅ **PASS** : Test réussi
- ❌ **FAIL** : Test échoué
- ⏳ **PENDING** : À tester
- ⚠️ **PARTIAL** : Partiellement fonctionnel

---

## 1. RESTAURANT PARTICULIERS

### Scénario 1.1 : Création réservation particulier (MVP)

**Étapes** :
1. Accéder à `/:lang/restaurant/particuliers`
2. Remplir formulaire : date (20 fév - 13 mars), places (1-12), nom, téléphone, email
3. Cliquer "Envoyer ma demande"
4. Valider soumission

**Validations** :
- ✅ Formulaire accepte dates valides uniquement (20 fév - 13 mars 2026)
- ✅ Formulaire refuse dates invalides
- ✅ Places min=1, max=12
- ✅ Réservation créée en DB (status=pending_validation)
- ✅ Référence unique générée (format: RES-P-XXXXX)
- ✅ Email 1 (accusé) envoyé à utilisateur
- ✅ Email interne envoyé à équipe (digital@myspace.boats + CC heartfulness@myspace.boats)
- ✅ Page confirmation affiche référence

**Rôles** : user
**État** : ⏳ À tester

---

### Scénario 1.2 : Admin valide réservation particulier

**Prérequis** : Réservation particulier en status=pending_validation

**Étapes** :
1. Accéder à `/admin/restaurant/particuliers` (rôle: admin_restaurant_particuliers)
2. Voir liste réservations en attente
3. Cliquer sur réservation
4. Cliquer "Valider"
5. Vérifier Email 2 envoyé

**Validations** :
- ✅ Admin voit liste réservations filtrées par statut
- ✅ Détail réservation affiche : référence, date, places, contact, notes
- ✅ Bouton "Valider" disponible si status=pending_validation
- ✅ Réservation passe à status=validated_pending_payment
- ✅ QR code généré (token sécurisé)
- ✅ Email 2 (confirmation + QR) envoyé à utilisateur
- ✅ QR status passe à "active"

**Rôles** : admin_restaurant_particuliers, admin, super_admin
**État** : ⏳ À tester

---

### Scénario 1.3 : Admin refuse réservation particulier

**Prérequis** : Réservation particulier en status=pending_validation

**Étapes** :
1. Accéder à `/admin/restaurant/particuliers`
2. Sélectionner réservation
3. Cliquer "Refuser"
4. Vérifier Email 3 envoyé

**Validations** :
- ✅ Bouton "Refuser" disponible si status=pending_validation
- ✅ Réservation passe à status=refused
- ✅ Email 3 (refus) envoyé à utilisateur
- ✅ Motif refus visible en admin

**Rôles** : admin_restaurant_particuliers, admin, super_admin
**État** : ⏳ À tester

---

### Scénario 1.4 : Scanner QR réservation particulier

**Prérequis** : Réservation particulier validée (status=validated_pending_payment, QR active)

**Étapes** :
1. Accéder à `/admin/scan-reservation`
2. Scanner QR code de la réservation
3. Vérifier validation

**Validations** :
- ✅ QR scannable via `/admin/scan-reservation`
- ✅ QR status passe de "active" à "used"
- ✅ Historique scan enregistré
- ✅ Scan multiple détecté (warning)

**Rôles** : admin, admin_ops, scanner
**État** : ⏳ À tester

---

## 2. RESTAURANT ENTREPRISES

### Scénario 2.1 : Création réservation entreprise (MVP)

**Étapes** :
1. Accéder à `/:lang/company-booking`
2. Étape 1 : Remplir infos entreprise (nom, contact, email, téléphone, ICE opt, notes opt)
3. Étape 2 : Sélectionner date (20 fév - 13 mars), participants (10-120)
4. Cliquer "Envoyer ma demande"

**Validations** :
- ✅ Formulaire 2 étapes fonctionnel
- ✅ Dates valides uniquement (20 fév - 13 mars 2026)
- ✅ Participants min=10, max=120
- ✅ Réservation créée (status=pending_validation, type=entreprise)
- ✅ Référence unique générée (format: RES-E-XXXXX)
- ✅ Email 1 + Email interne envoyés
- ✅ Page confirmation affiche référence

**Rôles** : user
**État** : ⏳ À tester

---

### Scénario 2.2 : Admin valide réservation entreprise

**Prérequis** : Réservation entreprise en status=pending_validation

**Étapes** :
1. Accéder à `/admin/restaurant/entreprises`
2. Voir liste réservations
3. Sélectionner réservation
4. Cliquer "Valider"

**Validations** :
- ✅ Admin voit liste réservations entreprises
- ✅ Détail affiche : nom entreprise, contact, participants, date
- ✅ Réservation passe à status=validated_pending_payment
- ✅ QR généré et Email 2 envoyé

**Rôles** : admin_restaurant_entreprises, admin, super_admin
**État** : ⏳ À tester

---

## 3. RESTAURANT GROUPES

### Scénario 3.1 : Création réservation groupe (MVP)

**Étapes** :
1. Accéder à `/:lang/restaurant/groupes`
2. Remplir formulaire : date, taille groupe (1-120), nom groupe (opt), contact, téléphone, email, notes (opt)
3. Cliquer "Envoyer ma demande"

**Validations** :
- ✅ Dates valides uniquement (20 fév - 13 mars 2026)
- ✅ Taille groupe min=1, max=120
- ✅ Réservation créée (status=pending_validation, type=groupe)
- ✅ Référence unique générée (format: RES-G-XXXXX)
- ✅ Email 1 + Email interne envoyés
- ✅ Page confirmation affiche référence

**Rôles** : user
**État** : ⏳ À tester

---

### Scénario 3.2 : Admin valide réservation groupe

**Prérequis** : Réservation groupe en status=pending_validation

**Étapes** :
1. Accéder à `/admin/restaurant/groupes`
2. Sélectionner réservation
3. Cliquer "Valider"

**Validations** :
- ✅ Admin voit liste réservations groupes
- ✅ Détail affiche : nom groupe, contact, taille, date
- ✅ Réservation passe à status=validated_pending_payment
- ✅ QR généré et Email 2 envoyé

**Rôles** : admin_restaurant_groupes, admin, super_admin
**État** : ⏳ À tester

---

## 4. BÉNÉVOLES

### Scénario 4.1 : Inscription bénévole (MVP)

**Étapes** :
1. Accéder à `/:lang/benevole`
2. Remplir formulaire : prénom, nom, email, téléphone, ville, jour Ramadan
3. Accepter conditions
4. Cliquer "S'inscrire"

**Validations** :
- ✅ Bénévole créé en DB (status=registered)
- ✅ QR token généré (128 bits, sécurisé)
- ✅ Email confirmation + QR envoyé
- ✅ Page confirmation affiche QR code

**Rôles** : user
**État** : ⏳ À tester

---

### Scénario 4.2 : Admin gère bénévoles

**Étapes** :
1. Accéder à `/admin/benevoles`
2. Voir liste bénévoles filtrée par jour
3. Voir statuts (registered, confirmed, present, absent, cancelled)

**Validations** :
- ✅ Admin voit liste bénévoles par jour
- ✅ Filtres par statut fonctionnels
- ✅ Détail affiche : infos personnelles, jour, statut, scan info

**Rôles** : admin_ops, admin, super_admin
**État** : ⏳ À tester

---

### Scénario 4.3 : Scanner QR bénévole

**Étapes** :
1. Accéder à `/scanner` (public)
2. Scanner QR code bénévole
3. Vérifier check-in

**Validations** :
- ✅ QR scannable
- ✅ Bénévole passe de "registered" à "present"
- ✅ Scan multiple détecté (warning)
- ✅ Historique scan enregistré

**Rôles** : user, admin, scanner
**État** : ⏳ À tester

---

## 5. GOODIES

### Scénario 5.1 : Achat goodie (MVP)

**Étapes** :
1. Accéder à `/:lang/goodies`
2. Sélectionner produit
3. Cliquer "Ajouter au panier"
4. Accéder à `/:lang/cart/goodies`
5. Cliquer "Passer la commande"
6. Paiement (test mode)

**Validations** :
- ✅ Panier fonctionne
- ✅ Commande créée (status=reserved)
- ✅ Email confirmation envoyé
- ✅ Paiement enregistré

**Rôles** : user
**État** : ⏳ À tester

---

### Scénario 5.2 : Admin gère commandes goodies

**Étapes** :
1. Accéder à `/admin/commandes`
2. Voir liste commandes
3. Filtrer par statut

**Validations** :
- ✅ Admin voit liste commandes
- ✅ Filtres par statut fonctionnels
- ✅ Détail affiche : produits, quantités, prix, paiement

**Rôles** : admin_boutique, admin, super_admin
**État** : ⏳ À tester

---

## 6. PAIEMENTS

### Scénario 6.1 : Suivi paiements

**Étapes** :
1. Accéder à `/admin/payments`
2. Voir liste paiements
3. Filtrer par statut, méthode, date

**Validations** :
- ✅ Admin voit tous les paiements
- ✅ Filtres fonctionnels
- ✅ Export possible (CSV/PDF)
- ✅ Historique paiement visible

**Rôles** : admin_boutique, admin_dons, admin_terroir, admin, super_admin
**État** : ⏳ À tester

---

## 7. DONS

### Scénario 7.1 : Promesse de don (MVP)

**Étapes** :
1. Accéder à `/:lang/dons`
2. Remplir formulaire : montant, contact, email
3. Cliquer "Faire un don"

**Validations** :
- ✅ Don créé (status=promised)
- ✅ Email confirmation envoyé
- ✅ Page confirmation affiche référence

**Rôles** : user
**État** : ⏳ À tester

---

### Scénario 7.2 : Admin gère dons

**Étapes** :
1. Accéder à `/admin/dons`
2. Voir liste dons filtrée par statut
3. Marquer don comme reçu

**Validations** :
- ✅ Admin voit liste dons
- ✅ Statuts : promised → pending → received → handed → checked_in
- ✅ Filtres par statut fonctionnels

**Rôles** : admin_dons, admin, super_admin
**État** : ⏳ À tester

---

## 8. PERMISSIONS & RÔLES

### Scénario 8.1 : Accès par rôle

**Étapes** :
1. Se connecter avec user (rôle=user)
2. Accéder à `/admin` → Redirection login
3. Se connecter avec admin_restaurant_particuliers
4. Accéder à `/admin/restaurant/particuliers` → ✅ Accès
5. Accéder à `/admin/restaurant/entreprises` → ❌ Accès refusé

**Validations** :
- ✅ user ne peut pas accéder admin
- ✅ admin_restaurant_particuliers voit uniquement son module
- ✅ admin voit tous les modules
- ✅ super_admin voit tous les modules + gestion rôles

**Rôles** : Tous
**État** : ⏳ À tester

---

## 9. TRADUCTIONS

### Scénario 9.1 : Changement de langue

**Étapes** :
1. Accéder à `/fr/restaurant/particuliers`
2. Voir contenu en français
3. Accéder à `/en/restaurant/particuliers`
4. Voir contenu en anglais
5. Accéder à `/ar/restaurant/particuliers`
6. Voir contenu en arabe

**Validations** :
- ✅ Français : Tous les textes traduits
- ✅ Anglais : Tous les textes traduits (en.ts complété)
- ✅ Arabe : Tous les textes traduits (ar.ts complété)
- ✅ Pas de clés manquantes

**Rôles** : Tous
**État** : ❌ FAIL (traductions manquantes en.ts, ar.ts)

---

## 10. EMAILS

### Scénario 10.1 : Email 1 (Accusé réservation)

**Trigger** : Soumission formulaire réservation

**Validations** :
- ✅ Email reçu dans 5 secondes
- ✅ Sender : Ftour Bab Rayan <noreply@ftourbabrayan.ma>
- ✅ Recipient : Email utilisateur
- ✅ Contenu : Référence, date, places, contact support
- ✅ **SANS QR code**

**État** : ⏳ À tester

---

### Scénario 10.2 : Email interne (Notification équipe)

**Trigger** : Soumission formulaire réservation

**Validations** :
- ✅ Email reçu à digital@myspace.boats
- ✅ CC : heartfulness@myspace.boats
- ✅ Contenu : Détails réservation, lien admin, type, contact

**État** : ⏳ À tester

---

### Scénario 10.3 : Email 2 (Confirmation + QR)

**Trigger** : Admin valide réservation

**Validations** :
- ✅ Email reçu à utilisateur
- ✅ Contenu : Confirmation, QR code (image), instructions
- ✅ QR scannable

**État** : ⏳ À tester

---

### Scénario 10.4 : Email 3 (Refus)

**Trigger** : Admin refuse réservation

**Validations** :
- ✅ Email reçu à utilisateur
- ✅ Contenu : Motif refus, contact support, alternatives

**État** : ⏳ À tester

---

## 11. DASHBOARD

### Scénario 11.1 : Dashboard principal

**Étapes** :
1. Accéder à `/admin`
2. Voir modules disponibles selon rôle

**Validations** :
- ✅ user → Pas d'accès
- ✅ admin_restaurant_particuliers → Voir "Réservations Particuliers"
- ✅ admin → Voir tous les modules (sauf gestion rôles)
- ✅ super_admin → Voir tous les modules + gestion rôles
- ✅ Cartes affichent statistiques (compteurs)

**État** : ⏳ À tester

---

### Scénario 11.2 : Statistiques modules

**Étapes** :
1. Accéder à `/admin/restaurant/particuliers`
2. Voir compteurs : Total, En attente, Confirmées, Refusées, Participants

**Validations** :
- ✅ Compteurs affichés
- ✅ Compteurs mis à jour en temps réel
- ✅ Filtres par statut fonctionnels

**État** : ⏳ À tester

---

## 12. SCANNER

### Scénario 12.1 : Scanner unifié

**Étapes** :
1. Accéder à `/scanner` (public)
2. Scanner QR bénévole → Check-in bénévole
3. Scanner QR réservation → Validation réservation
4. Scanner QR produit → Validation produit

**Validations** :
- ✅ Scanner détecte type QR
- ✅ Actions appropriées selon type
- ✅ Historique scan enregistré

**État** : ⏳ À tester

---

## RÉSUMÉ DES TESTS

| Module | Scénario | État | Priorité |
|--------|----------|------|----------|
| Restaurant Particuliers | 1.1-1.4 | ⏳ | MVP |
| Restaurant Entreprises | 2.1-2.2 | ⏳ | MVP |
| Restaurant Groupes | 3.1-3.2 | ⏳ | MVP |
| Bénévoles | 4.1-4.3 | ⏳ | MVP |
| Goodies | 5.1-5.2 | ⏳ | MVP |
| Paiements | 6.1 | ⏳ | MVP |
| Dons | 7.1-7.2 | ⏳ | MVP |
| Permissions | 8.1 | ⏳ | MVP |
| Traductions | 9.1 | ❌ | MVP |
| Emails | 10.1-10.4 | ⏳ | MVP |
| Dashboard | 11.1-11.2 | ⏳ | MVP |
| Scanner | 12.1 | ⏳ | MVP |

---

## NOTES IMPORTANTES

1. **Tester en ordre** : Commencer par création (front) → Admin validation → Scanner
2. **Vérifier emails** : Tous les workflows doivent envoyer des emails
3. **Tester permissions** : Chaque rôle ne doit voir que ses modules
4. **Tester filtres** : Tous les filtres doivent fonctionner
5. **Tester erreurs** : Valider les messages d'erreur
6. **Tester edge cases** : Dates limites, capacités max, scans multiples
7. **Traductions** : Compléter en.ts et ar.ts avant MVP
