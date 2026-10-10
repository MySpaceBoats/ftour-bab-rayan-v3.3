# Hébergement entre bénévoles (façon Airbnb)

Module de l'**espace bénévole** qui permet à un bénévole d'héberger un autre bénévole pendant
l'événement : annonces de logement, recherche par dates, demandes de séjour, messagerie dans la
demande, avis et modération admin.

Comme le fil et la marketplace du hub, le module vit **entièrement dans le Worker Cloudflare**
(D1 pour les données, bucket R2 logique `hub` pour les photos) et est appelé en REST sous
`/hub/stay/*`. Il n'existe pas côté serveur Node (aucune procédure tRPC).

## Déploiement

```bash
# production
wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/stay.sql
# staging
wrangler d1 execute ftour-bab-rayan-staging-db --remote --env staging --file worker/d1/stay.sql
```

`worker/d1/stay.sql` est idempotent (`CREATE TABLE IF NOT EXISTS`) et dépend de `worker/d1/hub.sql`
(`hub_members`, `hub_sessions`). Tant que la migration n'est pas appliquée, l'API renvoie une erreur
et le badge de navigation reste simplement à zéro (l'échec est avalé côté client).

## Modèle de données (`st_*`)

| Table | Rôle |
| --- | --- |
| `st_listings` | Annonce : titre, description, type (`chambre`, `studio`, `appartement`, `maison`, `canape`, `tente`), ville/quartier, capacité, pièces, `price_type` (`gratuit`, `participation`, `prix`), prix/nuit, équipements (JSON), fenêtre `available_from`/`available_to`, statut (`active`, `paused`, `hidden`), téléphone/WhatsApp |
| `st_listing_media` | Photos (0 à 6) : `r2_key` dans le bucket logique `hub` |
| `st_requests` | Demande de séjour : `guest_id`, `host_id` (dénormalisé), dates, voyageurs, message, statut (`pending`, `accepted`, `declined`, `cancelled`), réponse de l'hôte |
| `st_request_messages` | Fil de discussion d'une demande (`visible` / `hidden`) |
| `st_reviews` | Avis du voyageur (1 à 5) — un seul par demande, après acceptation |
| `st_reports` | Signalements (`listing` ou `message`) pour l'admin |

Règles portées par le schéma : longueurs, enums, format `AAAA-MM-JJ`, `end_date > start_date`,
`guest_id <> host_id`, cohérence prix/`price_type` (`gratuit` ⇒ prix 0, `prix` ⇒ prix > 0).

## API REST (`/hub/stay/…`, session bénévole en `Authorization: Bearer`)

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `listings?cursor&kind&city&q&priceType&guests&from&to&mine` | Recherche paginée ; un filtre de dates ne garde que les fenêtres libres |
| `POST` | `listings` | Publier (5/jour) |
| `GET`/`PUT`/`DELETE` | `listings/:id` | Fiche / modifier / masquer (propriétaire) |
| `POST` | `listings/:id/status` | `active` ou `paused` |
| `POST` | `listings/:id/requests` | Envoyer une demande de séjour (10/jour) |
| `GET` | `requests?role=guest\|host\|all` | Mes demandes envoyées / reçues |
| `GET` | `requests/:id` | Détail (participants uniquement) |
| `POST` | `requests/:id/status` | `accept` / `decline` (hôte), `cancel` (participant) |
| `GET`/`POST` | `requests/:id/messages` | Fil de la demande (60 messages/h) |
| `POST` | `requests/:id/read` | Marquer comme lu |
| `POST` | `requests/:id/review` | Avis du voyageur (après acceptation) |
| `GET` | `unread` | Badge : messages non lus + demandes reçues en attente |
| `POST` | `report` | Signaler un logement ou un message |
| `GET` | `admin/listings`, `admin/reports` | Admin (rôles `super_admin`, `admin`, `admin_ops`, hors mode démo) |
| `POST` | `admin/hide`, `admin/reports/:id/dismiss` | Masquer / ignorer |

**Anti-double réservation** : une demande `pending` bloque déjà ses dates. Deux demandes ne peuvent
donc jamais se chevaucher sur un même logement, et accepter une demande n'oblige pas à refuser les
autres. L'hôte ne peut pas réserver son propre logement.

## Interface (espace bénévole)

- `/:lang/benevole/espace/hebergement` — recherche et liste des logements
- `/:lang/benevole/espace/hebergement/nouveau` — publier un logement
- `/:lang/benevole/espace/hebergement/:id` — fiche, demande de séjour, avis
- `/:lang/benevole/espace/hebergement/:id/modifier` — modifier (propriétaire)
- `/:lang/benevole/espace/hebergement/demandes` — demandes envoyées / reçues
- `/:lang/benevole/espace/hebergement/demandes/:requestId` — fil de discussion, décisions, avis
- Admin : section « Hébergement » de `/admin/hub`

Aucun paiement ne transite par le site : le prix (ou la participation) est indicatif et se règle
directement entre bénévoles.

## Tests

- `worker/stay-d1.test.ts` — 22 tests de la couche de données (validation, recherche, fenêtres de
  disponibilité, anti-chevauchement, décisions, messagerie, avis, modération) sur un D1 en mémoire
  (`node:sqlite`), sans réseau.
- `worker/stay.test.ts` — 4 tests des routes REST (auth, parcours complet hôte→voyageur, statuts
  d'erreur, surface admin) montés via `handleHubRequest`.

```bash
npx vitest run worker/stay-d1.test.ts worker/stay.test.ts
```
