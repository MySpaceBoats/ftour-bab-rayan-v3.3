# Modération IA du Hub (étape 1 : moteur + fil) — design

## Objectif
Une IA analyse les posts et commentaires du fil de l'espace bénévole. En cas de violation du règlement, elle masque le contenu (réversible), puis prévient l'auteur et l'administrateur par mail et par la messagerie de l'espace. Un admin peut restaurer un contenu masqué à tort.

## Périmètre
**Dans cette étape :** règlement, moteur d'analyse, posts et commentaires texte, masquage, notifications (cloche, mail, messagerie), écran admin de revue et restauration, tests hors ligne.

**Décidé pour la suite (hors de cette étape, chacune aura sa spec) :**
- Étape 2 : annonces (Marketplace, hébergement, Pro, Meetup). Chaque module doit d'abord prouver comment un contenu se masque.
- Étape 3 : messages privés. Demande un traitement vie privée dédié (information des membres, minimisation).

**Hors périmètre :** analyse des images, suppression définitive, sanctions sur le compte (suspension), blocage avant publication, page publique du règlement.

## Décisions prises avec le demandeur
- Le règlement est rédigé par nous, validé par le demandeur avant mise en production.
- Action sur violation : masquage (`status = 'hidden'`), jamais de suppression. Un admin peut restaurer.
- Analyse après publication, en tâche de fond. La publication n'est jamais bloquée ni ralentie.
- Les cas douteux sont seulement signalés à l'admin, sans masquage.

## 1. Règlement
Source unique : `worker/moderation-rules.ts`, tableau `RULES` de `{ id, title, description }`. Le même texte alimente l'invite du modèle et les messages envoyés aux membres.

| id | titre |
|----|-------|
| R1 | Respect : pas d'insultes ni d'attaques personnelles |
| R2 | Pas de propos haineux ni discriminatoires |
| R3 | Pas de harcèlement ni de menaces |
| R4 | Pas de spam ni de publicité non sollicitée |
| R5 | Pas de données personnelles d'autrui (téléphone, adresse, etc.) |
| R6 | Pas d'arnaque, de fraude ni de fausses informations dangereuses |
| R7 | Pas de contenu illégal ou sexuellement explicite |

Le texte détaillé de chaque description est rédigé dans l'implémentation et relu par le demandeur avant déploiement.

## 2. Données
Nouveau fichier `worker/d1/moderation.sql`, appliqué à la main sur la D1 de prod avant le déploiement du code (même procédure que `hub.sql`).

```sql
CREATE TABLE IF NOT EXISTS hub_moderation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  rule TEXT,
  confidence REAL,
  reason TEXT,
  action TEXT NOT NULL CHECK (action IN ('hidden','flagged','restored','error')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at TEXT,
  restored_by TEXT,
  UNIQUE (target_type, target_id)
);
```

- `reviewed_at` : posé quand un admin a traité la ligne (restaurée, confirmée ou ignorée). `restored_by` : e-mail de l'admin (les admins du site sont des comptes Supabase, pas des `hub_members`).
- `UNIQUE(target_type, target_id)` garantit une analyse par contenu et empêche de réanalyser un contenu restauré.
- Les tables `hub_posts` et `hub_comments` ne changent pas. Le statut `hidden` existant est réutilisé.
- Les motifs `CHECK … GLOB` de plus de 50 octets sont refusés par D1 : aucun n'est utilisé ici.

## 3. Moteur (`worker/moderation-core.ts`)
Module pur, sans accès à la base ni au réseau, injecté avec `complete` (de `ai-core.ts`) et la liste de modèles `AI_MODELS`.

- **Invite système :** liste des règles et consigne de répondre uniquement par un JSON `{ "violation": boolean, "rule": "R1".."R7"|null, "confidence": 0..1, "reason": string }`.
- **Entrée non fiable :** le contenu du membre est inséré entre balises de données ; l'invite précise de ne suivre aucune instruction qu'il contient.
- **`parseVerdict(text)`** : extrait et valide le JSON. Tout écart (JSON invalide, règle inconnue, confiance hors de 0..1) donne « pas de violation ».
- **`decide(verdict)`** :
  - `violation` et `confidence ≥ 0.85` : `hidden`.
  - `violation` et `0.5 ≤ confidence < 0.85` : `flagged`.
  - sinon : aucune action.
- Le modèle n'a ni outil ni accès à la base. Seul le code applique l'action.
- Le champ `reason` est tronqué (200 caractères) avant stockage et affichage.

## 4. Orchestration (`worker/moderation.ts`)
`moderate(d, deps, type, id)` :
1. Si une ligne `hub_moderation` existe déjà pour la cible : sortir.
2. Charger le contenu (visible uniquement) et son auteur. Ignorer l'auteur « Équipe Ftour » et les `moderator`.
3. Appeler le modèle ; une seule nouvelle tentative en cas d'échec. Après deux échecs : ligne `error`, contenu inchangé.
4. Selon `decide` : masquer + notifier, ou signaler, ou ne rien enregistrer d'autre.

Branchement dans `worker/hub.ts` : après `createPost` et `addComment`, un `background("moderate post" | "moderate comment", …)` identique au `background("notify comment", …)` actuel (`waitUntil` si disponible). Jamais d'exception vers le client. Sans `OPENROUTER_API_KEY`, la modération est ignorée.

## 5. Notifications
Déclenchées quand un contenu est masqué ; un simple signalement ne notifie que l'admin.

**Auteur :**
- Notification dans l'espace (cloche), de type `announcement` (type existant : aucun changement de schéma, car `hub_notifications` et `hub_notification_prefs` contraignent `type` par un `CHECK`).
- Mail via `hub-notify` (Resend).
- Message dans la messagerie, envoyé par le compte « Équipe Ftour » dans un fil Pro direct, écrit directement en base (`pro_threads` / `pro_messages`) car `openThread`/`sendMessage` exigent des membres bénévoles confirmés, ce que le compte Équipe n'est pas. Le fil est en lecture seule pour le membre (une réponse est refusée par `sendMessage`) : le message indique l'adresse de contact.
- Contenu : règle violée (titre et description), raison, extrait masqué, et comment contester (répondre au message ou écrire à `support@ftourbabrayan.ma`).

**Administrateur :**
- Mail à `MODERATION_ADMIN_EMAIL` (variable Worker, par défaut `support@ftourbabrayan.ma`).
- Pour chaque `hub_members` avec `role = 'moderator'` (hors compte Équipe) : notification dans l'espace et message de l'Équipe Ftour dans la messagerie, avec extrait, auteur, règle et lien vers l'écran de modération.

Pour que le fil Équipe soit visible dans la messagerie du membre, un nouveau prédicat SQL `viewOk` (`pro-d1.ts`) remplace `memberOk` uniquement dans les lectures de la boîte de réception (`listThreads`, `listMessages`, `unreadTotal`, et les deux filtres de `messenger-d1.ts`). Il accepte en plus le compte Équipe actif. Les écritures (`openThread`, `sendMessage`) gardent `memberOk` : personne ne peut écrire à l'Équipe.

Un échec d'un canal (mail, messagerie, cloche) ne bloque pas les autres et est journalisé ; le masquage reste acquis.

## 6. Écran admin
Dans `client/src/features/hub/admin/AdminHub.tsx`, nouvel onglet « Modération IA » :
- Liste des 100 dernières décisions (filtre « à revoir » ou « toutes ») : date, auteur, extrait, règle, confiance, statut (`hidden`, `flagged`, `restored`, `error`).
- **Restaurer** : sur un contenu masqué, `status = 'visible'`, ligne passée à `restored` (`restored_by`, `reviewed_at`), notification à l'auteur ; sur un contenu signalé, simple clôture de la ligne (`restored`), sans notification.
- **Confirmer** : sur un contenu masqué, clôt la ligne (`reviewed_at`) ; sur un contenu signalé, masque le contenu (`action = 'hidden'`) et notifie l'auteur et les admins comme un masquage automatique.

Routes dans `hub.ts`, réservées aux admins (403 sinon) :
- `GET admin/moderation?filter=review|all`
- `POST admin/moderation/restore` `{ id }`
- `POST admin/moderation/confirm` `{ id }`

## 7. Vie privée et transparence
- Mention sous le champ de publication : « Les contenus sont analysés automatiquement. »
- Le règlement et les messages envoyés aux membres mentionnent cette analyse.
- Le contenu envoyé au modèle n'est pas conservé côté IA. Seuls la règle, la raison (tronquée) et la confiance sont enregistrées.
- Le contenu masqué reste en base (visible des admins) pour permettre la restauration.

## 8. Tests (Vitest, hors ligne)
Faux D1 (`test-d1.ts`) et faux `fetch` du modèle, comme les tests du Hub.
- `parseVerdict` : JSON valide, JSON invalide, règle inconnue, confiance hors bornes.
- `decide` : valeurs limites 0.5 et 0.85.
- `moderate` : masque, signale, ignore ; contenu déjà traité non réanalysé ; contenu restauré non réanalysé ; auteur Équipe et `moderator` ignorés ; contenu contenant des instructions au modèle ne change pas la décision d'un faux modèle ; panne du modèle avec deux échecs : ligne `error`, contenu visible ; absence de clé : aucune ligne.
- Notifications : auteur (cloche, mail, message) et admins quand masqué ; seulement l'admin quand signalé ; échec d'un canal n'empêche pas les autres.
- Admin : liste, restauration, confirmation, 403 pour non-admin.
- Critère de livraison : `pnpm test` et `pnpm check` sans nouvelle erreur par rapport à la base de référence.

## 9. Déploiement
1. Appliquer `worker/d1/moderation.sql` sur la D1 de prod (et staging).
2. Définir `MODERATION_ADMIN_EMAIL` si différent de la valeur par défaut. `OPENROUTER_API_KEY` et `AI_MODELS` existent déjà.
3. Déployer le worker puis Pages depuis une branche issue de `main`.

## Hypothèses à vérifier au début du plan
- ~~Le compte Équipe peut ouvrir un fil Pro~~ : vérifié, c'est faux (`memberOk` exige un bénévole confirmé). Résolu par l'écriture directe et `viewOk` (section 5).
- Les administrateurs de l'espace sont des `hub_members` avec `role = 'moderator'`. Si l'admin est un compte Supabase séparé, il ne reçoit que le mail.
- ~~`hub_notifications` contraint `type`~~ : vérifié, oui (`CHECK`). Résolu en réutilisant `announcement` (section 5).
- Les modèles `:free` renvoient du JSON exploitable avec cette invite ; sinon le prompt est ajusté, les seuils restent inchangés.
