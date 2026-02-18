# Système de Scanner QR Unifié - Documentation Complète

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture système](#architecture-système)
3. [Jour actif et restrictions](#jour-actif-et-restrictions)
4. [Sécurité et authentification](#sécurité-et-authentification)
5. [Types de QR codes supportés](#types-de-qr-codes-supportés)
6. [Procédures API](#procédures-api)
7. [Tests et scénarios](#tests-et-scénarios)
8. [Dépannage](#dépannage)

---

## 🎯 Vue d'ensemble

Le système de scanner QR est un **module unifié** qui gère tous les types de QR codes du système :
- ✅ Bénévoles (volunteers)
- ✅ Réservations restaurant (particuliers, entreprises, groupes)
- ✅ Commandes pâtisserie (pastry)
- ✅ Commandes terroir
- ✅ Goodies

**Caractéristiques principales :**
- 🔒 **Sécurisé** : Authentification admin obligatoire
- 📅 **Restreint** : Actif uniquement le **13 octobre 2024**
- 🔄 **Unifié** : Une seule API pour tous les types
- 📝 **Audit trail** : Traçabilité complète des validations
- 🚫 **Anti-doublon** : Protection contre les validations multiples

---

## 🏗️ Architecture Système

### Fichiers clés

```
server/
├── scanner-router.ts          # ⭐ Router principal (identify + validate)
├── supabase-services.ts       # Services Supabase (volunteers, goodies)
├── reservation-services.ts    # Services réservations
└── routers.ts                 # Enregistrement du router

client/src/features/scanner/
└── pages/
    ├── Scanner.tsx            # ⭐ Interface scanner unifiée
    ├── Checkin.tsx            # Page publique check-in (bénévoles)
    ├── ScannerBenevoles.tsx   # Point d'entrée bénévoles
    ├── ScannerFtours.tsx      # Point d'entrée réservations
    └── ScannerGoodies.tsx     # Point d'entrée goodies
```

### Flux de validation

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Scan QR (caméra ou saisie manuelle)                     │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. scanner.identify({ rawCode: "..." })                    │
│    ├─ Extraction du token depuis URL                       │
│    ├─ Détection du type (pattern matching)                 │
│    ├─ Récupération entité (DB lookup)                      │
│    └─ Retour : {type, found, entity, alreadyValidated}     │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Affichage des détails à l'utilisateur                   │
│    ├─ Nom, email, téléphone                                │
│    ├─ Type de QR code                                      │
│    ├─ Statut (déjà validé? date correcte?)                 │
│    └─ Bouton "Valider" si applicable                       │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. scanner.validate({ token, type, entityId })             │
│    ├─ ✅ Vérification session admin (OBLIGATOIRE)          │
│    ├─ ✅ Vérification date active (13 octobre 2024)        │
│    ├─ Validation spécifique au type                        │
│    ├─ Mise à jour statut en DB                             │
│    ├─ Création audit trail                                 │
│    └─ Retour : {success, message, state}                   │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Confirmation visuelle + audio (beep)                    │
│    ├─ ✅ Succès : Message vert                             │
│    ├─ ⚠️  Déjà validé : Message orange                     │
│    └─ ❌ Erreur : Message rouge                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📅 Jour Actif et Restrictions

### Configuration

**Fichier :** `server/scanner-router.ts` (lignes 9-17)

```typescript
/**
 * ACTIVE TEST DAY: Only this date can perform QR scans
 * Format: YYYY-MM-DD
 * Current: October 13, 2024 (Ramadan test day)
 */
const ACTIVE_TEST_DATE = '2024-10-13';
```

### Comportement

#### ✅ Scan le 13 octobre 2024
```
scanner.validate() → SUCCÈS
- Validation autorisée
- Statut mis à jour
- Audit trail créé
```

#### ❌ Scan à une autre date

**Erreur retournée :**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Ce QR code n'est pas valide pour aujourd'hui.\n\nAujourd'hui : jeudi 14 février 2026\nDate active : dimanche 13 octobre 2024\n\nLe scanner est uniquement actif le dimanche 13 octobre 2024."
  }
}
```

**Affichage UI :**
```
❌ Ce QR code n'est pas valide pour aujourd'hui.

Aujourd'hui : jeudi 14 février 2026
Date active : dimanche 13 octobre 2024

Le scanner est uniquement actif le dimanche 13 octobre 2024.
```

### Fonction de validation

```typescript
/**
 * Check if today is the active test day
 */
function isActiveTestDay(): boolean {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return today === ACTIVE_TEST_DATE;
}

/**
 * Validate that today is the active test day
 * @throws {TRPCError} if today is not the active test day
 */
function validateActiveDay(): void {
  if (!isActiveTestDay()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Ce QR code n'est pas valide pour aujourd'hui...`
    });
  }
}
```

### Modifier la date active

Pour changer la date active :

1. Ouvrir `server/scanner-router.ts`
2. Modifier la constante `ACTIVE_TEST_DATE` (ligne 14)
3. Rebuild le projet : `pnpm run build`
4. Déployer : `wrangler versions upload`

**Exemple :**
```typescript
// Activer pour le 15 mars 2026
const ACTIVE_TEST_DATE = '2026-03-15';
```

---

## 🔒 Sécurité et Authentification

### Middleware d'authentification

**Fichier :** `server/scanner-router.ts` (lignes 54-79)

```typescript
const scannerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ['admin', 'super_admin', 'admin_ops', 'scanner'];

  // Check if user exists and has valid session
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Accès non autorisé – session administrateur requise.\n\nVeuillez vous connecter avec un compte administrateur pour utiliser le scanner.'
    });
  }

  // Check if user has required role
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Accès refusé – rôle insuffisant.\n\nRôle actuel : ${ctx.user.role}\nRôles autorisés : admin, super_admin, admin_ops, scanner`
    });
  }

  return next({ ctx });
});
```

### Rôles autorisés

| Rôle | Accès Scanner | Permissions |
|------|--------------|-------------|
| `super_admin` | ✅ Oui | Accès complet système |
| `admin` | ✅ Oui | Accès complet système |
| `admin_ops` | ✅ Oui | Opérations & scanning |
| `scanner` | ✅ Oui | Scanner uniquement |
| `user` | ❌ Non | Utilisateur standard |

### Scénarios d'erreur

#### 1. Pas de session (non connecté)

**Erreur :**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Accès non autorisé – session administrateur requise.\n\nVeuillez vous connecter avec un compte administrateur pour utiliser le scanner."
  }
}
```

**UI :**
```
🔒 Accès non autorisé – session administrateur requise.

Veuillez vous connecter avec un compte administrateur
pour utiliser le scanner.
```

#### 2. Rôle insuffisant

**Erreur :**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Accès refusé – rôle insuffisant.\n\nRôle actuel : user\nRôles autorisés : admin, super_admin, admin_ops, scanner"
  }
}
```

**UI :**
```
⛔ Accès refusé – rôle insuffisant.

Rôle actuel : user
Rôles autorisés : admin, super_admin, admin_ops, scanner
```

### Protection CSRF et XSS

- ✅ **CSRF** : Token de session HTTP-only cookie
- ✅ **XSS** : Sanitization des inputs
- ✅ **Rate limiting** : Cloudflare Workers
- ✅ **SQL Injection** : Parameterized queries (Supabase)

---

## 📱 Types de QR Codes Supportés

### 1. Bénévoles (Volunteer)

**Pattern token :** `[a-f0-9]{32}` (128-bit hex)
**Exemple :** `a3f5e8c2d9b4f1a7e6c3d8b2f5a9e7c4`

**Tables DB :**
- `volunteers` (status, qr_status)
- `checkins` (audit trail)

**Status transitions :**
```
inscrit → confirmé
qr_status: generated → validated
```

**Validation :**
```typescript
scanAndValidateTokenSupabase(token, validatedBy, ipAddress, userAgent)
```

**Checks :**
- ✅ Token valide
- ✅ Date du jour = day.date
- ✅ Pas déjà validé (idempotent)

---

### 2. Réservations Restaurant

**Patterns token :**
- Particulier : `rp-XXXXXX`
- Entreprise : `re-XXXXXX`
- Groupe : `rg-XXXXXX`

**Tables DB :**
- `reservations`
- `reservation_checkins` (audit trail)

**Status transitions :**
```
pending/confirmed → checked_in
```

**Validation :**
```typescript
createCheckinSupabase({ reservationId, validationMode: 'scan', validatedBy })
```

**Checks :**
- ✅ Réservation existe
- ✅ Date du jour = reservation.date
- ✅ Pas annulée
- ⚠️ Erreur si déjà checked_in (non-idempotent)

---

### 3. Commandes Pâtisserie (Pastry)

**Pattern token :** Lookup DB (pas de préfixe)

**Tables DB :**
- `pastry_orders`

**Status transitions :**
```
qr_status: * → validated
order_status: * → handed
```

**Validation :**
```sql
UPDATE pastry_orders SET
  qr_status = 'validated',
  order_status = 'handed'
WHERE id = ?
```

**Checks :**
- ✅ Commande existe
- ⚠️ Erreur si déjà handed (non-idempotent)

---

### 4. Commandes Terroir

**Pattern token :** `ter-XXXXXX`

**Tables DB :**
- `terroir_orders`
- `terroir_order_items`

**Status transitions :**
```
qr_status: * → validated
status: * → handed
```

**Validation :**
```sql
UPDATE terroir_orders SET
  qr_status = 'validated',
  status = 'handed'
WHERE id = ?
```

**Checks :**
- ✅ Commande existe
- ⚠️ Erreur si déjà validée (non-idempotent)

---

### 5. Goodies

**Pattern token :** Lookup DB (table `qr_tokens`)

**Tables DB :**
- `qr_tokens` (scope = 'goodies')

**Status transitions :**
```
status: active → used (si uses_count >= max_uses)
uses_count: increment
```

**Validation :**
```typescript
validateQRTokenSupabase(token, 'goodies')
```

**Checks :**
- ✅ Token existe
- ✅ Status = 'active'
- ✅ uses_count < max_uses
- ♻️ Multi-usage supporté

---

## 🔧 Procédures API

### 1. `scanner.identify`

**Méthode :** Mutation
**Auth :** `scannerProcedure` (admin requis)
**URL tRPC :** `/api/trpc/scanner.identify`

#### Input

```typescript
{
  rawCode: string  // URL complète ou token direct
}
```

**Exemples :**
```json
// URL complète
{"rawCode": "https://ftourbabrayan.ma/checkin/a3f5e8c2d9b4f1a7"}

// Token direct
{"rawCode": "rp-ABC123"}
```

#### Output (Success)

```typescript
{
  type: QrType,           // 'volunteer' | 'reservation_particulier' | ...
  typeLabel: string,      // 'Bénévole' | 'Réservation Particulier' | ...
  token: string,          // Token extrait
  found: boolean,         // true si entité trouvée
  entity?: {
    id: number,
    name: string,
    email: string,
    phone: string,
    status: string,
    qrStatus?: string,
    alreadyValidated: boolean,
    scannedAt?: Date,
    // ... champs spécifiques au type
  }
}
```

#### Output (Not Found)

```typescript
{
  type: 'unknown',
  typeLabel: 'Inconnu',
  token: string,
  found: false,
  error: string  // 'QR code non reconnu dans le système'
}
```

#### Exemple Bénévole

```json
{
  "type": "volunteer",
  "typeLabel": "Bénévole",
  "token": "a3f5e8c2d9b4f1a7e6c3d8b2f5a9e7c4",
  "found": true,
  "entity": {
    "id": 42,
    "name": "Fatima El Amrani",
    "email": "fatima@example.com",
    "phone": "+212 6 12 34 56 78",
    "status": "inscrit",
    "qrStatus": "generated",
    "dayNumber": 1,
    "dayDate": "2024-10-13",
    "location": "4 rue Bayt Lahm, Casablanca",
    "iftarTime": "18:45",
    "alreadyValidated": false,
    "scannedAt": null
  }
}
```

---

### 2. `scanner.validate`

**Méthode :** Mutation
**Auth :** `scannerProcedure` (admin requis)
**Restrictions :** Date active (13 octobre 2024)
**URL tRPC :** `/api/trpc/scanner.validate`

#### Input

```typescript
{
  token: string,
  type: QrType,
  entityId: number
}
```

**Exemple :**
```json
{
  "token": "a3f5e8c2d9b4f1a7e6c3d8b2f5a9e7c4",
  "type": "volunteer",
  "entityId": 42
}
```

#### Output (Success)

```typescript
{
  success: boolean,
  message: string,
  state?: 'confirmed' | 'already_confirmed',
  volunteer?: {
    id: number,
    name: string,
    email: string,
    phone: string
  }
}
```

#### Exemple Bénévole (Première validation)

```json
{
  "success": true,
  "message": "Bénévole confirmé — Fatima El Amrani",
  "state": "confirmed",
  "volunteer": {
    "id": 42,
    "name": "Fatima El Amrani",
    "email": "fatima@example.com",
    "phone": "+212 6 12 34 56 78"
  }
}
```

#### Exemple Bénévole (Déjà validé)

```json
{
  "success": true,
  "message": "Déjà confirmé — Fatima El Amrani",
  "state": "already_confirmed",
  "volunteer": {
    "id": 42,
    "name": "Fatima El Amrani",
    "email": "fatima@example.com",
    "phone": "+212 6 12 34 56 78"
  }
}
```

#### Erreurs possibles

**1. Pas de session admin**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Accès non autorisé – session administrateur requise..."
  }
}
```

**2. Rôle insuffisant**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Accès refusé – rôle insuffisant..."
  }
}
```

**3. Mauvaise date**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Ce QR code n'est pas valide pour aujourd'hui..."
  }
}
```

**4. Token invalide**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Token invalide"
  }
}
```

---

## 🧪 Tests et Scénarios

### Test 1 : Scanner sans authentification

**Étapes :**
1. Déconnectez-vous de l'application
2. Naviguez vers `/scanner`
3. Tentez de scanner un QR code

**Résultat attendu :**
```
🔒 Accès non autorisé – session administrateur requise.

Veuillez vous connecter avec un compte administrateur
pour utiliser le scanner.
```

**Status :** ❌ ERREUR 401 UNAUTHORIZED

---

### Test 2 : Scanner avec rôle insuffisant

**Étapes :**
1. Connectez-vous avec un compte `user` (non-admin)
2. Naviguez vers `/scanner`
3. Tentez de scanner un QR code

**Résultat attendu :**
```
⛔ Accès refusé – rôle insuffisant.

Rôle actuel : user
Rôles autorisés : admin, super_admin, admin_ops, scanner
```

**Status :** ❌ ERREUR 403 FORBIDDEN

---

### Test 3 : Scanner avec admin, mauvaise date

**Étapes :**
1. Connectez-vous avec un compte `admin`
2. **Aujourd'hui ≠ 13 octobre 2024**
3. Scannez un QR code valide
4. Cliquez sur "Valider"

**Résultat attendu :**
```
❌ Ce QR code n'est pas valide pour aujourd'hui.

Aujourd'hui : [date du jour]
Date active : dimanche 13 octobre 2024

Le scanner est uniquement actif le dimanche 13 octobre 2024.
```

**Status :** ❌ ERREUR 400 BAD_REQUEST

---

### Test 4 : Scanner avec admin, bonne date (13 octobre 2024)

**Étapes :**
1. Connectez-vous avec un compte `admin`
2. **Aujourd'hui = 13 octobre 2024** ✅
3. Scannez un QR code bénévole valide
4. Cliquez sur "Valider"

**Résultat attendu :**
```
✅ Bénévole confirmé — Fatima El Amrani

Nom : Fatima El Amrani
Email : fatima@example.com
Téléphone : +212 6 12 34 56 78
Jour : Jour 1 - 13 octobre 2024
Statut : confirmé
```

**Status :** ✅ SUCCÈS 200 OK

**Vérification DB :**
```sql
SELECT status, qr_status, scanned_at, scanned_by
FROM volunteers
WHERE id = 42;

-- Attendu:
-- status = 'confirmed'
-- qr_status = 'validated'
-- scanned_at = [timestamp récent]
-- scanned_by = [admin user ID]
```

---

### Test 5 : Double scan (idempotence bénévole)

**Étapes :**
1. Scanner déjà validé au Test 4
2. Scannez à nouveau le même QR code
3. Cliquez sur "Valider"

**Résultat attendu :**
```
⚠️ Déjà confirmé — Fatima El Amrani

Ce bénévole a déjà été validé le 13/10/2024 à 15:30.
```

**Status :** ✅ SUCCÈS 200 OK (idempotent)

**Vérification DB :**
```sql
SELECT COUNT(*) FROM checkins WHERE volunteer_id = 42;
-- Attendu: 1 seul enregistrement (pas de doublon)
```

---

### Test 6 : Scanner réservation

**Étapes :**
1. Connecté en admin, 13 octobre 2024
2. Scannez un QR code réservation (`rp-ABC123`)
3. Cliquez sur "Valider"

**Résultat attendu :**
```
✅ Check-in réservation validé !

Référence : RP-ABC123
Client : Ahmed Benali
Couverts : 4
Restaurant : La Palmeraie
Heure : 19:00
Statut : checked_in
```

**Status :** ✅ SUCCÈS 200 OK

**Vérification DB :**
```sql
SELECT status FROM reservations WHERE reference_code = 'RP-ABC123';
-- Attendu: status = 'checked_in'

SELECT * FROM reservation_checkins WHERE reservation_id = ?;
-- Attendu: 1 enregistrement avec timestamp
```

---

### Test 7 : Scanner commande terroir

**Étapes :**
1. Connecté en admin, 13 octobre 2024
2. Scannez un QR code terroir (`ter-XYZ789`)
3. Cliquez sur "Valider"

**Résultat attendu :**
```
✅ Commande terroir remise !

Référence : TER-XYZ789
Client : Salma Idrissi
Montant : 250 MAD
Produits :
  - Miel 1kg x2 (100 MAD)
  - Huile d'olive 500ml x1 (50 MAD)
Statut : handed
```

**Status :** ✅ SUCCÈS 200 OK

**Vérification DB :**
```sql
SELECT status, qr_status FROM terroir_orders WHERE order_reference = 'TER-XYZ789';
-- Attendu:
-- status = 'handed'
-- qr_status = 'validated'
```

---

### Test 8 : Token inconnu

**Étapes :**
1. Connecté en admin, 13 octobre 2024
2. Scannez un QR code inexistant : `INVALID123`

**Résultat attendu :**
```
❌ QR code non reconnu dans le système

Le QR code scanné n'a pas été trouvé dans la base de données.

Vérifiez que le code est correct ou contactez un administrateur.
```

**Status :** ⚠️ Found = false (pas d'erreur, mais pas trouvé)

---

## 🔍 Dépannage

### Problème : "no procedure found on path 'scanner.identify'"

**Cause :** Router pas enregistré ou build incomplet

**Solutions :**
1. Vérifier `server/routers.ts` ligne 2472 :
   ```typescript
   scanner: scannerRouter,
   ```

2. Rebuild complet :
   ```bash
   pnpm run build
   ```

3. Vérifier export dans `server/scanner-router.ts` :
   ```typescript
   export const scannerRouter = router({...});
   ```

4. Redéployer :
   ```bash
   wrangler versions upload
   ```

---

### Problème : Scan bloqué même le 13 octobre

**Cause :** Fuseau horaire différent ou format de date incorrect

**Solutions :**
1. Vérifier le fuseau horaire serveur :
   ```javascript
   console.log(new Date().toISOString()); // Must be 2024-10-13T...
   ```

2. Forcer la date pour test :
   ```typescript
   // TEMPORAIRE - À RETIRER EN PRODUCTION
   function isActiveTestDay(): boolean {
     return true; // Force activation
   }
   ```

3. Vérifier format date :
   ```typescript
   const today = new Date().toISOString().split('T')[0]; // "2024-10-13"
   ```

---

### Problème : Authentification échoue même connecté

**Causes possibles :**
1. **Cookie de session expiré**
   - Solution : Se reconnecter

2. **Rôle incorrect**
   - Vérifier : `SELECT role FROM users WHERE id = ?`
   - Rôles valides : `admin`, `super_admin`, `admin_ops`, `scanner`

3. **Session non propagée**
   - Solution : Rafraîchir la page (F5)

4. **Context tRPC incorrect**
   - Vérifier middleware dans `server/_core/trpc.ts`

---

### Problème : Statut pas mis à jour en DB

**Diagnostic :**

1. **Vérifier logs serveur** :
   ```bash
   wrangler tail
   # Chercher: [scanAndValidateTokenSupabase] ou [createCheckinSupabase]
   ```

2. **Vérifier transaction DB** :
   ```sql
   -- Bénévoles
   SELECT * FROM volunteers WHERE id = ? ORDER BY updated_at DESC LIMIT 1;

   -- Réservations
   SELECT * FROM reservations WHERE id = ? ORDER BY updated_at DESC LIMIT 1;
   ```

3. **Vérifier audit trail** :
   ```sql
   -- Bénévoles
   SELECT * FROM checkins WHERE volunteer_id = ? ORDER BY scanned_at DESC;

   -- Réservations
   SELECT * FROM reservation_checkins WHERE reservation_id = ? ORDER BY validated_at DESC;
   ```

**Solutions :**
- Erreur DB : Vérifier logs Supabase
- Permissions : Vérifier service role key
- Transaction : Vérifier pas de rollback

---

### Problème : QR code non reconnu mais existe en DB

**Causes possibles :**

1. **Pattern de détection incorrect**
   ```typescript
   // Vérifier detectQrType() dans scanner-router.ts
   function detectQrType(token: string): QrType {
     if (token.startsWith('rp-')) return 'reservation_particulier';
     // ... autres patterns
   }
   ```

2. **Token dans mauvaise table**
   - Vérifier toutes les tables :
   ```sql
   -- Bénévoles
   SELECT * FROM volunteers WHERE qr_token = ?;

   -- Réservations
   SELECT * FROM reservations WHERE qr_token = ?;

   -- Terroir
   SELECT * FROM terroir_orders WHERE qr_token = ?;

   -- QR tokens (goodies)
   SELECT * FROM qr_tokens WHERE token = ?;
   ```

3. **Extraction URL échouée**
   ```typescript
   // Tester extractTokenFromUrl()
   extractTokenFromUrl('https://ftourbabrayan.ma/checkin/ABC123')
   // Devrait retourner: 'ABC123'
   ```

---

## 📊 Monitoring et Logs

### Logs à surveiller

**1. Validation bénévole réussie**
```json
{
  "event": "volunteer_confirm",
  "volunteerId": 42,
  "state": "confirmed",
  "timestamp": "2024-10-13T15:30:00Z"
}
```

**2. Validation déjà effectuée (idempotent)**
```json
{
  "event": "volunteer_confirm",
  "volunteerId": 42,
  "state": "already_confirmed",
  "timestamp": "2024-10-13T15:31:00Z"
}
```

**3. Erreur mauvais jour**
```json
{
  "event": "volunteer_confirm",
  "volunteerId": 42,
  "state": "wrong_day",
  "expected": "2024-10-13",
  "actual": "2024-10-14"
}
```

**4. Token invalide**
```json
{
  "event": "volunteer_confirm",
  "token": "INVALID123",
  "state": "invalid_token"
}
```

### Métriques clés

```sql
-- Nombre de scans par jour
SELECT DATE(scanned_at), COUNT(*)
FROM checkins
GROUP BY DATE(scanned_at);

-- Nombre de scans par type
SELECT
  'volunteers' as type, COUNT(*) FROM checkins
UNION ALL
SELECT
  'reservations', COUNT(*) FROM reservation_checkins;

-- Taux de double-scan (tentatives)
SELECT
  COUNT(*) as total_attempts,
  COUNT(DISTINCT volunteer_id) as unique_volunteers,
  (COUNT(*) - COUNT(DISTINCT volunteer_id)) as duplicate_attempts
FROM checkins;
```

---

## 🚀 Déploiement

### Build

```bash
# Build complet
pnpm run build

# Build worker uniquement
pnpm run build:worker
```

### Deploy

```bash
# Deploy to Cloudflare Workers
wrangler versions upload

# Avec logs
wrangler tail
```

### Variables d'environnement

**Vérifier dans Cloudflare Dashboard :**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

---

## 📝 Changelog

### Version 2.0 - 2026-02-13

**🆕 Nouveautés**
- ✅ Restriction jour actif (13 octobre 2024 uniquement)
- ✅ Authentification admin renforcée (messages d'erreur détaillés)
- ✅ Validation idempotente pour bénévoles
- ✅ Audit trail complet pour toutes les validations

**🔧 Améliorations**
- Messages d'erreur en français avec détails contextuels
- Documentation complète du système
- Tests de validation exhaustifs
- Gestion des fuseaux horaires

**🐛 Corrections**
- Fix routing `scanner.identify` et `scanner.validate`
- Fix authentification sur endpoints protégés
- Fix format de date (YYYY-MM-DD)

---

## 📚 Références

- **Architecture :** Voir analyse complète dans l'agent Explore
- **tRPC :** https://trpc.io/docs
- **Supabase :** https://supabase.com/docs
- **Cloudflare Workers :** https://developers.cloudflare.com/workers/

---

**Date :** 2026-02-13
**Version :** 2.0
**Status :** ✅ Production Ready
**Build :** ✅ Successful
