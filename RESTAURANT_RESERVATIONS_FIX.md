# Fix: Restaurant Reservations - Cloudflare Worker

## Problème

Les formulaires de réservation restaurant (Particuliers, Entreprises, Groupes) échouaient avec l'erreur:

```
TRPCClientError: No procedure found on path "restaurantReservations.particulier.create"
TRPCClientError: No procedure found on path "restaurantReservations.entreprise.create"
TRPCClientError: No procedure found on path "restaurantReservations.groupe.create"
```

## Causes Racines

### 1. Router Manquant dans le Worker

**Problème**: Le router `restaurantReservations` n'existait que dans le serveur Node.js (`server/routers.ts`), mais pas dans le Cloudflare Worker (`worker/routers.ts`).

**Impact**: Les appels tRPC depuis le front pointaient vers le Worker (via `VITE_API_URL=https://api.ftourbabrayan.ma/api/trpc`), mais le Worker ne connaissait pas ces routes.

**Preuve**:
- ✅ `server/routers.ts` ligne 2468: `restaurantReservations: restaurantReservationsRouter`
- ❌ `worker/routers.ts` ligne 2101: Pas de `restaurantReservations` dans le appRouter

### 2. Dépendance au Serveur Node Local

Le document `FORM_SUBMISSION_FIX.md` suggérait de lancer le serveur local Node.js (`pnpm run dev`), mais selon les contraintes du projet:

> Il n'existe PAS de "dev local" pour l'emailing ni pour l'API.
> Le seul backend autorisé est le Cloudflare Worker (API/tRPC).

### 3. Erreurs Masquées Côté Front

Les composants React affichaient des erreurs génériques:

```typescript
} catch (error) {
  console.error('Erreur:', error);
  toast.error('Erreur lors de l\'envoi de la demande');
}
```

Sans afficher:
- Le message d'erreur réel
- Les erreurs de validation Zod
- Les détails du problème (endpoint manquant, validation échouée, etc.)

## Solution Implémentée

### 1. Création du Router `restaurantReservations` pour le Worker

**Fichier**: `worker/restaurant-reservation-router.ts` (NOUVEAU)

**Contenu**:
- ✅ Router `particulier.create` - Demandes particuliers (1-12 places)
- ✅ Router `entreprise.create` - Demandes entreprises (10-120 places)
- ✅ Router `groupe.create` - Demandes groupes (1-120 places)

**Fonctionnalités**:
- Validation des dates: 2026-02-20 → 2026-03-13
- Validation des participants: min/max selon le type
- Génération de référence unique: `RES-P-XXXXXX`, `RES-E-XXXXXX`, `RES-G-XXXXXX` (Web Crypto API)
- Génération de token QR unique (Web Crypto API)
- Insertion en base Supabase (`restaurant_reservations`)
- Envoi d'emails via Resend (client + notification interne)
- Logs structurés avec requestId unique

**Spécificités Edge Runtime**:
- Utilisation de `crypto.getRandomValues()` au lieu de `crypto.randomBytes()` (Node)
- Utilisation de Supabase client au lieu de Drizzle ORM
- Pas d'imports Node (fs, path, etc.)

### 2. Intégration dans le Worker

**Fichier modifié**: `worker/routers.ts`

**Changements**:
```typescript
// Import du nouveau router
import { restaurantReservationsRouter } from './restaurant-reservation-router';

// Ajout dans le appRouter
export const appRouter = router({
  // ... existing routers
  restaurantReservations: restaurantReservationsRouter, // NOUVEAU
});
```

### 3. Templates d'Email

**Fichier modifié**: `worker/email.ts`

**Ajouts**:
- `generateParticulierReservationRequestEmail()` - Email accusé réception
- `generateNewBookingNotificationEmail()` - Email notification équipe

### 4. Endpoint /health

**Fichier modifié**: `worker/index.ts`

**Route ajoutée**: `/health` et `/api/health`

**Réponse**:
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

**Utilité**:
- Vérifier que le déploiement contient les nouvelles fonctionnalités
- Confirmer que les secrets (RESEND_API_KEY, SUPABASE_URL) sont configurés
- Debug des problèmes de déploiement

### 5. Amélioration Affichage Erreurs Frontend

**Fichiers modifiés**:
- `client/src/features/restaurant/pages/RestaurantParticuliers.tsx`
- `client/src/features/restaurant/pages/CompanyBooking.tsx`
- `client/src/features/restaurant/pages/RestaurantGroupes.tsx`

**Changement**:
```typescript
} catch (error: any) {
  console.error('Erreur:', error);
  const errorMessage = error?.message || 'Erreur lors de l\'envoi de la demande';
  const zodErrors = error?.data?.zodError?.fieldErrors;

  if (zodErrors) {
    const fields = Object.keys(zodErrors).join(', ');
    toast.error(`Erreur de validation: ${fields}`);
  } else {
    toast.error(errorMessage);
  }
}
```

**Avantages**:
- Affichage du message d'erreur réel (ex: "La date doit être entre le 20 février et le 13 mars 2026")
- Affichage des champs en erreur (ex: "Erreur de validation: email, phone")
- Plus de diagnostic possible pour l'utilisateur et les développeurs

## Règles Métier Appliquées

### Dates Autorisées
- **Plage**: 20 février 2026 → 13 mars 2026
- **Validation**: Côté serveur (Worker)
- **Erreur si hors plage**: "La date doit être entre le 20 février et le 13 mars 2026"

### Participants
| Type | Min | Max |
|------|-----|-----|
| Particuliers | 1 | 12 |
| Entreprises | 10 | 120 |
| Groupes | 1 | 120 |

### Heure
- **Fixe**: 18h45 (pas de choix utilisateur)
- **Implementation**: `slotId: 1` dans la base

### Espace
- **Fixe**: `jardin` (pas de choix utilisateur)
- **Implementation**: `displayChoice: 'jardin'`

### Statuts
- **Création**: `status = 'pending_validation'`
- **Paiement**: `paymentStatus = 'not_requested'`
- **QR Code**: `qrStatus = 'inactive'`

**Important**: Les demandes ne sont PAS automatiquement confirmées. L'équipe doit valider manuellement.

## Fichiers Créés

1. `worker/restaurant-reservation-router.ts` - Router complet (440 lignes)
2. `RESTAURANT_RESERVATIONS_QA.md` - Plan de tests détaillé
3. `RESTAURANT_RESERVATIONS_FIX.md` - Ce document

## Fichiers Modifiés

1. `worker/index.ts` - Ajout endpoint /health
2. `worker/routers.ts` - Import et enregistrement du router
3. `worker/email.ts` - Ajout templates d'email
4. `client/src/features/restaurant/pages/RestaurantParticuliers.tsx` - Amélioration erreurs
5. `client/src/features/restaurant/pages/CompanyBooking.tsx` - Amélioration erreurs
6. `client/src/features/restaurant/pages/RestaurantGroupes.tsx` - Amélioration erreurs

## Déploiement

### Étapes
```bash
# 1. Build
pnpm run build:cloudflare

# 2. Deploy
wrangler pages deploy dist/public --project-name=ftour-bab-rayan

# 3. Vérifier le déploiement
curl https://api.ftourbabrayan.ma/health
```

### Variables d'Environnement Requises

Dans Cloudflare Dashboard (Workers & Pages > ftour-bab-rayan-v2 > Settings > Environment Variables):

- `RESEND_API_KEY` - Clé API Resend
- `SUPABASE_URL` - URL Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Clé Supabase avec droits d'écriture
- `SUPABASE_ANON_KEY` - (optionnel, fallback)
- `JWT_SECRET` - Secret JWT pour auth
- `NODE_ENV` - "production"

## Tests à Effectuer

Voir le document détaillé: [RESTAURANT_RESERVATIONS_QA.md](./RESTAURANT_RESERVATIONS_QA.md)

**Tests critiques**:
1. ✅ Endpoint /health retourne `restaurantReservations: true`
2. ✅ Formulaire Particuliers crée une demande en DB
3. ✅ Formulaire Entreprises crée une demande en DB
4. ✅ Formulaire Groupes crée une demande en DB
5. ✅ Emails sont envoyés (client + équipe)
6. ✅ Logs Worker sont présents et structurés
7. ✅ Validation des dates fonctionne
8. ✅ Erreurs détaillées affichées côté front

## Logs Attendus dans le Worker

```
[RestaurantReservations] [a1b2c3d4] Particulier request received { email: 'user@example.com', date: '2026-02-25', participants: 4 }
[RestaurantReservations] [a1b2c3d4] Creating reservation { reference: 'RES-P-A1B2C3' }
[RestaurantReservations] [a1b2c3d4] Reservation created { id: 123 }
[RestaurantReservations] [a1b2c3d4] Emails sent { customer: 're_abc123', internal: 're_def456' }
```

**Format**:
- `[RestaurantReservations]` - Module
- `[requestId]` - ID unique de la requête (8 caractères hex)
- Action + données pertinentes

## Validation Finale

Avant de considérer le ticket comme résolu:

- [ ] Worker déployé sur production
- [ ] Endpoint /health accessible et retourne les features attendues
- [ ] Variables d'environnement configurées
- [ ] 3 tests manuels (1 par formulaire) réussis
- [ ] Vérification DB: 3 lignes créées avec `status='pending_validation'`
- [ ] Vérification emails: 6 emails reçus (3 clients + 3 équipe)
- [ ] Logs Worker présents dans Cloudflare Dashboard
- [ ] Pas d'erreur "No procedure found"

## Différences avec le Serveur Node.js

| Aspect | Server Node | Worker Cloudflare |
|--------|-------------|-------------------|
| Runtime | Node.js | V8 Edge Runtime |
| ORM | Drizzle + MySQL | Supabase Client |
| Crypto | `crypto.randomBytes()` | `crypto.getRandomValues()` |
| Email | `sendEmail()` from `server/email.ts` | `sendEmail()` from `worker/email.ts` |
| Router location | `server/restaurant-reservation-routers.ts` | `worker/restaurant-reservation-router.ts` |
| Entry point | `server/_core/index.ts` | `worker/index.ts` |

## Notes Importantes

1. **Pas de dev local**: Ne PAS suggérer `pnpm run dev`. Toujours tester sur le Worker déployé.

2. **Emails réels**: Les emails sont toujours envoyés via Resend. Pas de mode "dev sans email".

3. **Base de données**: Utilise Supabase en production. Pas de MySQL local.

4. **CORS**: Le Worker gère CORS pour les domaines autorisés. Si problème CORS, vérifier la liste dans `worker/index.ts`.

5. **RLS Supabase**: Si erreur "permission denied", vérifier que le Worker utilise `SUPABASE_SERVICE_ROLE_KEY` et non `SUPABASE_ANON_KEY`.

## Rollback (Si Nécessaire)

```bash
# 1. Revenir au commit précédent
git revert HEAD
git push origin claude/cloudflare-worker-setup-EL73C

# 2. Redéployer
pnpm run deploy:cloudflare

# 3. Vérifier
curl https://api.ftourbabrayan.ma/health
```

## Support

En cas de problème:
1. Vérifier `/health` endpoint
2. Consulter les logs Cloudflare Dashboard
3. Vérifier les variables d'environnement
4. Tester avec curl directement sur l'API tRPC
5. Vérifier la console browser pour voir les erreurs réseau

## Commit Message

```
fix(worker): Add restaurantReservations router to Cloudflare Worker

- Create restaurantReservations router for Worker with 3 procedures:
  - particulier.create (1-12 participants)
  - entreprise.create (10-120 participants)
  - groupe.create (1-120 participants)

- Add /health endpoint for deployment verification

- Add email templates for reservation requests

- Improve frontend error display (show detailed messages + validation errors)

- Use Web Crypto API for reference and QR token generation

- Add structured logging with unique requestId per request

- Validate date range (2026-02-20 to 2026-03-13)

- Set default values: slotId=1 (18h45), displayChoice='jardin', status='pending_validation'

Fixes: No procedure found on path "restaurantReservations.*"

Files:
- NEW: worker/restaurant-reservation-router.ts
- MOD: worker/index.ts (health endpoint)
- MOD: worker/routers.ts (import + register router)
- MOD: worker/email.ts (email templates)
- MOD: client/src/features/restaurant/pages/*.tsx (error display)
```
