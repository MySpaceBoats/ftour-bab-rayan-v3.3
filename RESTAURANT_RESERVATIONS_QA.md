# QA - Restaurant Reservations Fix

## Contexte

Ce document décrit les tests à effectuer pour valider la correction des formulaires de réservation restaurant (Particuliers, Entreprises, Groupes).

## Problème Identifié

Les formulaires échouaient avec l'erreur "No procedure found on path restaurantReservations.*" car le Worker Cloudflare ne contenait pas le router `restaurantReservations`, uniquement présent dans le serveur Node.js.

## Solution Implémentée

1. **Nouveau router `restaurantReservations`** créé dans `worker/restaurant-reservation-router.ts`
   - Procédure `particulier.create`
   - Procédure `entreprise.create`
   - Procédure `groupe.create`

2. **Fonctionnalités ajoutées**:
   - Validation des dates (2026-02-20 → 2026-03-13)
   - Génération de références avec Web Crypto API (RES-P-*, RES-E-*, RES-G-*)
   - Insertion en base Supabase (table `restaurant_reservations`)
   - Envoi d'emails via Resend (client + équipe)
   - Logs structurés avec requestId unique
   - Statut `pending_validation` par défaut
   - Heure fixe 18h45 (slotId=1)

3. **Endpoint /health** ajouté pour vérifier le déploiement
   - Accessible sur `/health` ou `/api/health`
   - Retourne version, features, timestamp

4. **Amélioration erreurs front**
   - Affichage détaillé des messages d'erreur
   - Affichage des erreurs de validation Zod
   - Pas d'erreur générique masquée

## Fichiers Modifiés

### Worker (Backend)
- `worker/index.ts` - Ajout endpoint /health
- `worker/routers.ts` - Import et enregistrement du nouveau router
- `worker/restaurant-reservation-router.ts` - **NOUVEAU** Router complet
- `worker/email.ts` - Templates d'email pour réservations restaurant

### Client (Frontend)
- `client/src/features/restaurant/pages/RestaurantParticuliers.tsx` - Amélioration gestion erreurs
- `client/src/features/restaurant/pages/CompanyBooking.tsx` - Amélioration gestion erreurs
- `client/src/features/restaurant/pages/RestaurantGroupes.tsx` - Amélioration gestion erreurs

## Prérequis pour les Tests

1. **Variables d'environnement Cloudflare Worker**:
   - `RESEND_API_KEY` - Clé API Resend pour envoi d'emails
   - `SUPABASE_URL` - URL de la base Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_ANON_KEY` - Clé Supabase avec droits d'écriture

2. **Déploiement**:
   ```bash
   pnpm run build:cloudflare
   wrangler pages deploy dist/public --project-name=ftour-bab-rayan
   ```

3. **Base de données Supabase**:
   - Table `restaurant_reservations` existe
   - Permissions RLS configurées pour permettre insertion (via service_role_key)

## Plan de Tests

### Test 1: Endpoint /health

**Objectif**: Vérifier que le Worker déployé contient les nouvelles fonctionnalités

**Étapes**:
1. Ouvrir `https://api.ftourbabrayan.ma/health` dans un navigateur
2. Vérifier la réponse JSON

**Résultat attendu**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-12T...",
  "worker": "ftour-bab-rayan-v2",
  "version": "2.0.0",
  "environment": "production",
  "endpoints": {
    "trpc": "/api/trpc",
    "cms": "/api/cms",
    "health": "/health"
  },
  "features": {
    "restaurantReservations": true,
    "emailNotifications": true,
    "database": true
  }
}
```

**Critères de succès**:
- ✅ `features.restaurantReservations` = `true`
- ✅ `features.emailNotifications` = `true`
- ✅ `features.database` = `true`

---

### Test 2: Formulaire Particuliers

**Objectif**: Soumettre une demande Particuliers et vérifier DB + emails

**Étapes**:
1. Ouvrir `https://ftourbabrayan.ma/fr/restaurant/particuliers`
2. Remplir le formulaire:
   - Date: 2026-02-25
   - Nombre de places: 4
   - Nom complet: Test Particulier QA
   - Téléphone: +212600000001
   - Email: test-particulier@example.com
3. Cliquer sur "Envoyer ma demande"

**Résultat attendu**:
- ✅ Message de succès "Demande envoyée avec succès!"
- ✅ Affichage de la page de confirmation avec référence `RES-P-XXXXXX`
- ✅ Email reçu à `test-particulier@example.com` (vérifier boîte mail)
- ✅ Email reçu à `digital@myspace.boats` (notification interne)

**Vérification Base de Données**:
```sql
SELECT reference, type, name, email, date, seatsTotal, status, paymentStatus
FROM restaurant_reservations
WHERE email = 'test-particulier@example.com'
ORDER BY createdAt DESC
LIMIT 1;
```

**Critères de succès DB**:
- ✅ Ligne créée avec `type='particulier'`
- ✅ `status='pending_validation'`
- ✅ `paymentStatus='not_requested'`
- ✅ `qrStatus='inactive'`
- ✅ `slotId=1`
- ✅ `date='2026-02-25'`
- ✅ `seatsTotal=4`

**Vérification Logs Worker** (si accès Cloudflare Dashboard):
```
[RestaurantReservations] [XXXXXXXX] Particulier request received
[RestaurantReservations] [XXXXXXXX] Creating reservation { reference: 'RES-P-...' }
[RestaurantReservations] [XXXXXXXX] Reservation created { id: ... }
[RestaurantReservations] [XXXXXXXX] Emails sent { customer: '...', internal: '...' }
```

---

### Test 3: Formulaire Entreprises

**Objectif**: Soumettre une demande Entreprise et vérifier DB + emails

**Étapes**:
1. Ouvrir `https://ftourbabrayan.ma/fr/reservation/entreprise`
2. **Étape 1** - Informations Entreprise:
   - Nom entreprise: MySpace Boats QA
   - Nom contact: Test Entreprise
   - Email: test-entreprise@example.com
   - Téléphone: +212600000002
   - ICE: (optionnel, laisser vide)
   - Notes: Test QA
   - Cliquer "Suivant"
3. **Étape 2** - Détails demande:
   - Date: 2026-03-05
   - Participants: 50
   - Cliquer "Envoyer la demande"

**Résultat attendu**:
- ✅ Message "Demande envoyée avec succès!"
- ✅ Référence `RES-E-XXXXXX`
- ✅ Emails reçus

**Vérification DB**:
```sql
SELECT reference, type, name, companyName, email, date, seatsTotal, status
FROM restaurant_reservations
WHERE email = 'test-entreprise@example.com'
ORDER BY createdAt DESC
LIMIT 1;
```

**Critères de succès**:
- ✅ `type='entreprise'`
- ✅ `companyName='MySpace Boats QA'`
- ✅ `seatsTotal=50`
- ✅ `status='pending_validation'`

---

### Test 4: Formulaire Groupes

**Objectif**: Soumettre une demande Groupe et vérifier DB + emails

**Étapes**:
1. Ouvrir `https://ftourbabrayan.ma/fr/restaurant/groupes`
2. Remplir:
   - Date: 2026-02-28
   - Participants: 30
   - Nom groupe: Association Test QA
   - Nom contact: Test Groupe
   - Téléphone: +212600000003
   - Email: test-groupe@example.com
3. Soumettre

**Résultat attendu**:
- ✅ Référence `RES-G-XXXXXX`
- ✅ Emails envoyés

**Vérification DB**:
```sql
SELECT reference, type, groupName, name, email, date, seatsTotal, status
FROM restaurant_reservations
WHERE email = 'test-groupe@example.com'
ORDER BY createdAt DESC
LIMIT 1;
```

**Critères de succès**:
- ✅ `type='groupe'`
- ✅ `groupName='Association Test QA'`
- ✅ `seatsTotal=30`

---

### Test 5: Validation Dates (Hors Plage)

**Objectif**: Vérifier que les dates hors plage sont rejetées

**Étapes**:
1. Ouvrir formulaire Particuliers
2. Saisir date: 2026-02-15 (avant 20 février)
3. Soumettre

**Résultat attendu**:
- ✅ Message d'erreur: "La date doit être entre le 20 février et le 13 mars 2026"
- ✅ Pas d'insertion en DB

**Test complémentaire**:
- Date: 2026-03-20 (après 13 mars) → même erreur

---

### Test 6: Validation Participants

**Objectif**: Vérifier les limites min/max

**Tests Particuliers**:
- 0 participants → Erreur "participantsCount must be at least 1"
- 13 participants → Erreur "participantsCount must be at most 12"

**Tests Entreprises**:
- 5 participants → Erreur "participantsCount must be at least 10"
- 150 participants → Erreur "participantsCount must be at most 120"

**Tests Groupes**:
- 0 participants → Erreur
- 150 participants → Erreur

---

### Test 7: Validation Email

**Objectif**: Vérifier validation email

**Étapes**:
1. Formulaire Particuliers
2. Email: "invalid-email"
3. Soumettre

**Résultat attendu**:
- ✅ Erreur "Email invalide"

---

### Test 8: Affichage Erreurs Détaillées

**Objectif**: Vérifier que les erreurs ne sont plus masquées

**Étapes**:
1. Soumettre formulaire avec données invalides
2. Observer le toast d'erreur

**Résultat attendu**:
- ✅ Si erreur de validation: "Erreur de validation: firstName, email" (liste des champs)
- ✅ Si erreur serveur: Message d'erreur du serveur (pas "Erreur d'envoi" générique)

---

### Test 9: Logs Worker

**Objectif**: Vérifier que les logs structurés sont présents

**Accès**: Cloudflare Dashboard > Workers & Pages > ftour-bab-rayan-v2 > Logs

**Chercher dans les logs**:
```
[RestaurantReservations] [requestId] Particulier request received
[RestaurantReservations] [requestId] Creating reservation
[RestaurantReservations] [requestId] Reservation created
[RestaurantReservations] [requestId] Emails sent
```

**Critères de succès**:
- ✅ RequestId présent et cohérent
- ✅ Logs structurés et lisibles
- ✅ Pas d'erreur "No procedure found"

---

## Résumé des Tests

| # | Test | Statut | Notes |
|---|------|--------|-------|
| 1 | /health endpoint | ⏳ À tester | |
| 2 | Formulaire Particuliers | ⏳ À tester | |
| 3 | Formulaire Entreprises | ⏳ À tester | |
| 4 | Formulaire Groupes | ⏳ À tester | |
| 5 | Validation dates | ⏳ À tester | |
| 6 | Validation participants | ⏳ À tester | |
| 7 | Validation email | ⏳ À tester | |
| 8 | Erreurs détaillées | ⏳ À tester | |
| 9 | Logs Worker | ⏳ À tester | |

## Causes Racines Identifiées

1. **Router manquant dans Worker**: Le router `restaurantReservations` n'existait que dans `server/routers.ts`, pas dans `worker/routers.ts`
2. **Pas de version Worker fonctionnelle**: Le document FORM_SUBMISSION_FIX.md mentionnait le serveur Node local, mais selon les contraintes, seul le Worker Cloudflare doit être utilisé
3. **Erreurs masquées côté front**: Les catch blocks affichaient uniquement "Erreur d'envoi" sans détails

## Validation Finale

Avant de considérer la correction comme complète, vérifier:

- [ ] Les 3 formulaires créent des demandes avec `status='pending_validation'`
- [ ] Aucune demande ne passe directement en `status='confirmed'`
- [ ] L'heure est toujours 18h45 (`slotId=1`)
- [ ] Les emails sont envoyés (client + équipe)
- [ ] Les logs Worker sont présents et structurés
- [ ] L'endpoint /health confirme `restaurantReservations: true`
- [ ] Pas d'erreur "No procedure found"

## Rollback (Si Nécessaire)

En cas de problème critique:
```bash
# Revenir au commit précédent
git revert HEAD
git push origin claude/cloudflare-worker-setup-EL73C

# Redéployer
pnpm run deploy:cloudflare
```
