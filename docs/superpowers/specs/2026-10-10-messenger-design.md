# Messagerie unifiée « Messenger » — design

## Objectif
Une messagerie de type Messenger dans l'espace bénévole. Chaque section (Pro, Marketplace, Hébergement) garde sa messagerie et ses règles, mais toutes les conversations arrivent dans « Mes messages ». Statut en ligne des membres et chat instantané (WebSocket).

## Hors périmètre
- Fusion des tables `pro_*`, `mk_*`, `st_*` : aucune migration, aucun message copié.
- « Vu à HH:MM », bouton « apparaître hors ligne », messages de groupe, pièces jointes.

## 1. Boîte unifiée
- `GET /hub/pro/inbox` fusionne les fils Pro, Marketplace et demandes de séjour du membre, triés par `last_message_at` décroissant (100 max).
- Ligne : `{ source: "pro"|"market"|"stay", id, other:{id,display_name,avatar}, context, last_body, last_message_at, unread }`. `context` : titre de l'offre, de l'annonce ou du séjour (vide pour un fil direct).
- Les règles de visibilité de chaque module s'appliquent : annonce masquée, membre suspendu ou non éligible, fil vide côté vendeur/hôte.
- `GET /hub/pro/unread` renvoie la somme des trois sources. `last_body` est tronqué à 140 caractères côté serveur.
- Les anciens endpoints (`market/threads`, `stay/requests`, leurs messages et unread) restent inchangés.

## 2. Interface
- Page « Mes messages » à `/pro/messages` : deux volets sur desktop (liste / conversation), liste puis conversation sur mobile. Filtre Tout / Pro / Marketplace / Séjours.
- Un composant de conversation unique avec un adaptateur par source : `list`, `send`, `read`. Les règles (limites, longueurs, 404 pour les non-participants) restent celles du module.
- Séjour : le chat affiche un lien « Voir la demande » ; accepter/refuser reste sur la page de la demande.
- Les anciennes pages de messages Marketplace et Hébergement redirigent vers la boîte (`/marketplace/messages` et `/marketplace/messages/:id` vers l'entrée correspondante).
- La barre du hub : une entrée « Messages » avec une pastille unique (somme des non-lus), qui remplace « Mes messages » et les pastilles Pro/Séjour pour la messagerie.
- Chat direct : « Écrire » sur chaque fiche membre ouvre/crée un fil Pro direct (`job_id` 0). Un panneau « En ligne » liste les membres connectés avec « Écrire ».

## 3. Temps réel
- Durable Object `HubChat` (SQLite, API hibernation), instance globale unique.
- `GET /hub/ws` (upgrade WebSocket) : le Worker valide la session (jeton en paramètre de requête, les navigateurs ne peuvent pas poser d'en-tête) et un membre éligible non suspendu, puis transmet au Durable Object avec l'id du membre.
- Événements serveur → client : `presence_snapshot {online:[ids]}` à la connexion, `presence {id, online}` à chaque changement, `message {source, thread_id}` au destinataire, `typing {source, thread_id, from}`.
- Événement client → serveur : `typing {to, source, thread_id}`. Le Durable Object ne relaie qu'au destinataire nommé, sans écrire en base.
- Envoi : toujours par le REST du module (règles, limites, D1 source de vérité). Après l'insertion, le Worker notifie le Durable Object (`waitUntil`) qui pousse `message` aux sockets du destinataire. Le client recharge le fil concerné.
- En ligne = au moins un socket ouvert. Fermeture ou erreur du dernier socket → hors ligne.
- Repli : si le WebSocket est indisponible, le polling actuel (10 s conversation, 30 s non-lus) continue ; reconnexion avec délai croissant (1 s à 30 s).
- Un jeton de session expiré ou révoqué ferme la connexion (4401) et le client ne se reconnecte pas.
- Le Durable Object ne pousse rien au sujet d'un membre suspendu et ne le déclare pas en ligne.

## 4. Configuration
- `wrangler.toml` : `[[durable_objects.bindings]]` `HUB_CHAT` / classe `HubChat`, `[[migrations]]` `tag = "v1"`, `new_sqlite_classes = ["HubChat"]`, en prod et dans `[env.staging]`.
- La classe est exportée depuis `worker/index.ts`. `Env.HUB_CHAT` est optionnel : absent, `ws` répond 503 et tout le reste fonctionne.
- Aucune table D1 ajoutée. Le Worker se déploie avec `pnpm build:cloudflare && npx wrangler deploy`.

## 5. Tests
- `pro-d1` : fusion de l'inbox (tri, 3 sources, somme des non-lus, annonce masquée, membre suspendu, fil vide) — écrits avant le code.
- Routes : `inbox`, `unread` (somme), `ws` (401 sans session, 503 sans binding, 403 suspendu).
- Module pur `hub-chat-core` (présence, relais, typing, déconnexion) testé avec de faux sockets.
- Hors test automatique : le parcours WebSocket en navigateur (`wrangler dev` manuel).

## Précisions
- Un membre avec plusieurs onglets ouverts est en ligne tant qu'un socket reste ouvert.
- Tous les membres éligibles voient le statut de tous les autres.
