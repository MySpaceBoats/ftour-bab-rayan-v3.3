# Amis, abonnements et favoris de l'espace bénévole — design

Date : 2026-10-11 · Statut : implémenté · Prérequis : espace bénévole (`2026-10-09-volunteer-hub-design.md`). Aucun fichier `market*`, `pro*`, `stay*`, `meetup*`, `messenger*` modifié.

## Objectif

Façon Facebook : un membre envoie une demande d'ami, suit les publications de quelqu'un sans accord, marque des comptes en favoris, et filtre le fil selon ces relations.

Succès : A envoie une demande à B ; B l'accepte ; les deux se suivent et s'affichent dans « Mes amis » ; A suit C sans demande ; A marque C en favori ; dans le fil, A choisit « Favoris » et ne voit que les posts de C (plus les annonces épinglées).

## Décisions utilisateur

- Le fil reste **global par défaut** ; un filtre au choix : Tous / Amis / Abonnements / Favoris.
- **Ami = suivi mutuel automatique** ; « Suivre » seul est unilatéral.
- **Favori** = étoile privée posée par le suiveur sur un compte suivi.

## Rulings

- Retirer un ami supprime l'amitié ; les suivis restent (l'utilisateur peut se désabonner).
- Se désabonner supprime le suivi, donc l'étoile. Un ami ne peut pas être désabonné tant que l'amitié existe (l'ami est suivi par construction) → `409`.
- **Pas de nouveau type dans `hub_notifications`** : sa contrainte `CHECK (type IN …)` ne se modifie pas de façon idempotente en D1. Le nombre de demandes reçues est ajouté à une réponse existante (un `COUNT` indexé) pour le badge ; pas de polling supplémentaire (quota D1 déjà dépassé).
- Pas de blocage, de suggestions ni de liste d'amis visible par des tiers (hors périmètre).

## Réutilisé du hub (inchangé)

`getSession`, `MemberRow`, `HubError`, `iso`, `readJson/num/id/str` (`hub-http.ts`), enveloppe d'erreurs JSON, garde client « réponse non JSON = erreur » (`call()`), visibilité membre `status` actif + volontaire `confirmed|present`.

## Données (`worker/d1/social.sql`, idempotent, appliqué avant le déploiement)

| Table | Colonnes |
|---|---|
| `hub_friendships` | requester_id, addressee_id (FK `hub_members` ON DELETE CASCADE), status (`pending`/`accepted`), created_at ; PK (requester_id, addressee_id) ; CHECK requester_id <> addressee_id ; index (addressee_id, status) |
| `hub_follows` | follower_id, followee_id (FK CASCADE), favorite (0/1, défaut 0), created_at ; PK (follower_id, followee_id) ; CHECK follower_id <> followee_id ; index (followee_id) |

Une paire d'amis n'a qu'une ligne : si B demande alors que A a déjà une demande en attente vers B, la demande de B **accepte** celle de A (pas de doublon croisé).

## API (module `worker/social-d1.ts` + `worker/social.ts`, délégué depuis `hub.ts` par le préfixe `social/`)

Toutes les routes exigent une session valide. POST/DELETE uniquement (CORS inchangé).

| Route | Effet |
|---|---|
| `GET social/relation/:id` | `{ friendship: none|sent|received|friends, following, favorite, friends_count, followers_count }` ; 404 si membre invisible ou soi-même |
| `POST social/friend/request {id}` | crée `pending` (ou accepte la demande croisée) ; 409 si déjà ami/en attente |
| `POST social/friend/accept {id}` | seul le destinataire ; passe en `accepted` + `INSERT OR IGNORE` des deux suivis |
| `POST social/friend/decline {id}` | seul le destinataire ; supprime la ligne |
| `DELETE social/friend/:id` | annule ma demande envoyée ou retire un ami ; supprime la ligne |
| `POST social/follow {id}` / `DELETE social/follow/:id` | suivre / ne plus suivre |
| `POST social/favorite {id, on}` | bascule l'étoile ; 409 si je ne suis pas ce membre |
| `GET social/friends`, `social/requests`, `social/following` | listes paginées par curseur (≤ 50) : `{id, display_name, avatar_key, favorite?}`, requests → `{received[], sent[]}` |
| `GET feed?scope=all|friends|following|favorites` | `scope` inconnu → 400 ; défaut `all` (comportement actuel) |

Fil filtré : `loadPosts` reçoit un `scope` ; le filtre ajoute `AND EXISTS (SELECT 1 FROM hub_follows f WHERE f.follower_id = ? AND f.followee_id = p.member_id [AND f.favorite = 1])` (`following`/`favorites`) ou `… hub_friendships … status='accepted'` des deux sens (`friends`). Les annonces épinglées restent toujours présentes. Les propres posts du viewer ne sont pas ajoutés.

Limites : 20 demandes d'ami/h par membre, 50 demandes en attente envoyées au plus, 200 suivis au plus. Messages d'erreur FR, `HubError` (`invalid`, `not_found`, `conflict`, `rate_limited`, `forbidden`).

PII : jamais d'email ni de téléphone dans ces réponses. Un tiers ne voit pas qui est ami/suivi de qui (les listes sont celles du viewer ; les compteurs seuls sont publics).

## UI (`client/src/features/hub/social/`)

- Profil membre (`HubProfilePage`) : bloc `RelationBar` — bouton d'amitié selon l'état (Ajouter / Demande envoyée·Annuler / Accepter·Refuser / Amis ✓), Suivre·Suivi, ★ Favori (visible si suivi), compteurs.
- Fil (`HubPage`) : pastilles Tous / Amis / Abonnements / Favoris ; choix mémorisé par défaut en `localStorage` (try/catch), `all` si absent.
- Page `/benevole/espace/amis` : onglets Demandes (reçues + envoyées), Amis, Suivis (étoile modifiable). Lien dans la navigation de `HubShell` avec badge du nombre de demandes reçues.
- Routes spécifiques avant `:id` dans `App.tsx`. Aucun polling nouveau.

## Tests

Faux D1 `node:sqlite` (style `market.test.ts`) : machine d'états de l'amitié (demande, croisée, accepte, refuse, annule, retire), suivi mutuel à l'acceptation, désabonnement d'un ami refusé, favori nécessitant un suivi, tiers/suspendu/soi-même → 404, doublons, limites de débit, filtres de fil (chaque `scope` + annonces toujours présentes + `scope` invalide), absence d'email dans les réponses, `Object.hasOwn` sur les entrées. Client : `tsc` propre.

## Démo et exploitation

`scripts/hub-demo` : quelques amitiés/suivis/favoris entre profils de démo ; le nettoyage supprime ces lignes (cascade FK sur les membres de démo, et lignes croisées avec de vrais membres). `social.sql` s'applique par `wrangler d1 execute … --file worker/d1/social.sql` **avant** `pnpm build:cloudflare` + déploiement du Worker.

## Hors périmètre

Blocage, suggestions d'amis, listes d'amis visibles par des tiers, nouveaux types de notification, polling temps réel.
