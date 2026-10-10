# Meetup entre bénévoles

Module de l'**espace bénévole** qui permet à un bénévole d'organiser une sortie, un événement ou une
rencontre, de le publier avec un pays et une ville, et aux autres bénévoles de le trouver (filtres
pays, ville, catégorie, dates), de s'y inscrire et, quand il est complet, de rejoindre une liste
d'attente avec promotion automatique.

Comme le fil, la marketplace et l'hébergement du hub, le module vit **entièrement dans le Worker
Cloudflare** (D1 pour les données, bucket R2 logique `hub` pour la photo) et est appelé en REST sous
`/hub/meetup/*`. Il n'existe pas côté serveur Node (aucune procédure tRPC).

Hors périmètre : signalement de meetups par les membres, notifications (push ou email) de promotion
depuis la liste d'attente, pastille de non-lus sur l'onglet.

## Déploiement

```bash
# production
wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/meetup.sql
# staging
wrangler d1 execute ftour-bab-rayan-staging-db --remote --env staging --file worker/d1/meetup.sql
```

`worker/d1/meetup.sql` est idempotent (`CREATE ... IF NOT EXISTS`) et dépend de `worker/d1/hub.sql`
(`hub_members`). Tant que la migration n'est pas appliquée, les routes `/hub/meetup/*` répondent par
une erreur et l'onglet Meetup affiche un message d'erreur avec un bouton « Réessayer ».

## Modèle de données (`mt_*`)

| Table | Rôle |
| --- | --- |
| `mt_meetups` | Meetup : titre, catégorie (`sortie`, `evenement`, `rencontre`, `autre`), description, pays, ville, lieu, `starts_at`/`ends_at`, capacité (1 à 500), `photo_key` (facultative), statut (`active`, `cancelled`, `hidden`), `cancelled_at` |
| `mt_participants` | Inscription : `meetup_id`, `member_id`, statut `going` ou `waitlist`. L'`id` croissant est l'ordre d'arrivée, donc l'ordre de la liste d'attente. `UNIQUE (meetup_id, member_id)` |

Règles portées par le schéma : longueurs, enums, format des dates, `ends_at > starts_at`, capacité,
une seule inscription par membre et par meetup.

**Heure sans fuseau.** `starts_at` et `ends_at` sont stockés en texte `AAAA-MM-JJTHH:MM`, c'est
l'heure locale du lieu du meetup (un meetup à Paris à 19:00 s'affiche 19:00 partout). Pour savoir
si un meetup est terminé ou commencé, la valeur est comparée à l'heure de Casablanca
(`nowMinuteCasablanca`) : une seule horloge garde les comparaisons lexicographiques, quelques heures
d'écart pour un meetup à l'étranger sont acceptées.

## API REST (`/hub/meetup/…`, session bénévole en `Authorization: Bearer`)

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `meetups?cursor&country&city&category&from&to` | Meetups à venir (non terminés), du plus proche au plus lointain, pagination par curseur `<début>_<id>` ; pays/ville insensibles à la casse |
| `POST` | `meetups` | Créer (5 par jour) ; corps validé par zod, erreurs 400 en français |
| `GET` | `places` | Pays et leurs villes réellement présents (alimente les listes déroulantes) |
| `GET` | `meetups/:id` | Fiche : participants, places restantes, liste d'attente (organisateur seulement) |
| `PUT` | `meetups/:id` | Modifier (organisateur, meetup actif) |
| `POST` | `meetups/:id/cancel` | Annuler (organisateur) |
| `POST` | `meetups/:id/join` | Participer : `{ status: "going" \| "waitlist" }` (30 par heure) |
| `POST` | `meetups/:id/leave` | Se désinscrire |
| `GET` | `mine?role=organized\|joined` | Mes meetups, passés et annulés compris |
| `GET` | `admin/meetups` | Admin (rôles `super_admin`, `admin`, `admin_ops`, hors mode démo) |
| `POST` | `admin/hide`, `admin/delete` | Masquer (soft) / supprimer (hard, inscriptions comprises), corps `{ id }` |

Aucune réponse n'expose d'email ni de téléphone. Les noms de la liste d'attente ne sont visibles que
de l'organisateur. L'organisateur doit être un membre actif dont le bénévole est confirmé ou présent.

## Liste d'attente

- **Décision de place atomique** : `joinMeetup` fait un seul `INSERT OR IGNORE … SELECT` qui compare
  le nombre d'inscrits `going` en base à la capacité au moment de l'écriture. Des inscriptions
  simultanées ne peuvent donc jamais dépasser la capacité.
- **Promotion automatique** : quand un inscrit `going` se désinscrit, ou quand l'organisateur
  augmente la capacité, les plus anciens membres `waitlist` passent à `going` jusqu'à remplir les
  places libres (même requête SQL, exécutée dans le même `batch` que la suppression ou la mise à
  jour). Un membre en attente qui part ne promeut personne.
- L'organisateur ne peut pas s'inscrire à son propre meetup ni baisser la capacité sous le nombre
  d'inscrits. Un meetup annulé ou terminé n'accepte plus d'inscription.

## Interface (espace bénévole)

- `/:lang/benevole/espace/meetup` — liste et filtres (pays, ville, catégorie, du/au)
- `/:lang/benevole/espace/meetup/nouveau` — organiser un meetup
- `/:lang/benevole/espace/meetup/:id` — fiche, participer / se désinscrire, annuler (organisateur)
- `/:lang/benevole/espace/meetup/:id/modifier` — modifier (organisateur)
- `/:lang/benevole/espace/meetup/mes-meetups` — organisés / inscrits
- Admin : section « Meetup : meetups » de `/admin/hub` (Masquer, Supprimer)

L'onglet « Meetup » vient après « Hébergement » : barre latérale sur ordinateur, barre du bas à sept
colonnes sur mobile.

## Tests

- `worker/meetup-d1.test.ts` — couche de données sur un D1 en mémoire (`node:sqlite`), sans réseau :
  validation, filtres, curseur, lieux, fiche, liste d'attente, concurrence, promotion, modération.
- `worker/meetup.test.ts` — routes REST montées via `handleHubRequest` : tracer, parcours complet,
  statuts d'erreur, surface admin.

```bash
npx vitest run worker/meetup-d1.test.ts worker/meetup.test.ts
```
