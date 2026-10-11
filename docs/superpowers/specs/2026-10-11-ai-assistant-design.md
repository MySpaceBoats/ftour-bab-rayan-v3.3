# Assistant IA (OpenRouter, modèles gratuits) — design

## Objectif
Deux chatbots alimentés par les modèles gratuits d'OpenRouter :
- **Public** : visiteurs anonymes, FAQ (association, ftour, réservations, dons).
- **Bénévole** : membres connectés, support sur l'espace et médiation de conflits (hébergement, marketplace, offres d'emploi…). Le bot traite un maximum seul, puis escalade vers un admin.

## Hors périmètre
- Aucun outil / tool-calling : le bot ne fait que répondre.
- Aucune action sur les données (pas de fermeture d'annonce, d'annulation, de message à l'autre partie).
- Streaming (v1 non-streaming), pièces jointes, mémoire entre conversations.
- Bot dans les fils réels de messagerie.

## 1. Backend
- `POST /ai/public` (sans session) et `POST /hub/ai/chat` (session membre éligible). Réponse JSON `{reply, conversation_id?, escalated?}`.
- Secret Worker `OPENROUTER_API_KEY` (jamais côté client). Variable `AI_MODELS` : liste ordonnée de modèles `:free`. Repli : 429/5xx/timeout → modèle suivant ; tous KO → erreur 503 `ai_unavailable` (le reste du hub n'est pas affecté).
- Prompt système distinct par bot. Public : FAQ statique issue de `content/` + règles du ftour. Bénévole : guide de l'espace + contexte du membre.
- Anti-abus : public par IP (10 messages / 10 min, 500 caractères max, 6 tours d'historique) ; membre par id (30 messages / h). Compteurs en D1. Dépassement → 429.
- Sécurité : entrée non fiable, aucun outil, sortie rendue en texte.

## 2. Litiges et dossiers
- Le membre choisit « Problème avec… » parmi ses propres éléments : fils Pro/Marketplace/Séjour (via `inbox`), annonces, offres, demandes de séjour. Sans choix : question générale.
- Contexte injecté côté serveur uniquement, après contrôle de participation (404 sinon) : 20 derniers messages, statut, titre, nom de l'autre partie ; tronqué à ~4 000 caractères, balisé comme données non fiables.
- Médiation : écoute, reformulation, solutions dans les règles de l'espace. Rien n'est envoyé à l'autre partie.
- Escalade : marqueur `[ESCALADE]` émis par le bot (blocage ou 2 échecs de médiation), retiré de la réponse affichée, ou bouton « Contacter un admin ». Le serveur crée un dossier.
- Tables D1 (`worker/d1/ai.sql`) : `ai_conversations`, `ai_messages`, `ai_cases {id, member_id, source, item_id, summary, status open|closed, created_at}`. Résumé généré par le modèle ; repli sur les 6 derniers messages bruts si tous les modèles sont KO.
- Admin : liste « Dossiers IA » (ouvert/clos), détail (conversation + contexte), « Répondre » (ouvre un fil Pro direct avec le membre, notification via `hub-notify`), « Clore ». Routes admin : 403 pour non-admin.
- Vie privée : conversations purgées après 90 jours sauf si liées à un dossier ouvert (trigger planifié existant). Mention visible « conversation lue par l'assistant IA et, en cas d'escalade, par un admin ». Le bot public ne stocke rien.

## 3. Interface
- Public : bulle flottante sur les pages publiques, panneau de chat, 3 questions suggérées, compteur de caractères, messages d'erreur (limite, indisponible). Textes via i18n (fr/en/ar).
- Bénévole : entrée « Assistant » (`/:lang/benevole/espace/assistant`) + bulle dans l'espace. Sélecteur « Problème avec… », bouton « Contacter un admin », bandeau de confidentialité, historique de la conversation rechargé depuis D1.
- Admin : page « Dossiers IA » dans l'admin du hub.
- Réponses en texte brut (retours à la ligne), sans HTML ni Markdown exécutable. Indicateur « l'assistant écrit… ».

## 4. Tests (TDD, `node:sqlite` en mémoire, `fetch` OpenRouter simulé)
- Repli de modèles (429 puis succès ; tous KO → 503).
- Limites IP et membre.
- Participation (404 non-participant), troncature du contexte, marqueur `[ESCALADE]` → dossier, résumé de repli.
- Purge 90 jours épargnant les dossiers ouverts.
- Routes admin (403 non-admin).
- Hors test automatique : qualité réelle des modèles gratuits, parcours navigateur.

## 5. Déploiement
- `wrangler secret put OPENROUTER_API_KEY` (prod et `--env staging`), `AI_MODELS` dans `wrangler.toml`.
- Appliquer `worker/d1/ai.sql` sur D1 avant le déploiement : sans lui les routes IA renvoient 500, le reste du hub fonctionne.

## Précisions issues du plan
- Route publique : `POST /hub/ai/public` (même Worker et mêmes en-têtes CORS que le reste, plutôt que `/ai/public`).
- « Problème avec… » liste les conversations de la boîte unifiée (chaque fil porte déjà son annonce, offre ou séjour). Une annonce ou offre sans conversation n'est pas sélectionnable en v1.
- Réponse admin : ajoutée à la conversation du dossier (rôle `admin`) + notification cloche (type `announcement`, la table a un CHECK sur le type, pas de migration) ; pas de fil Pro avec un compte « équipe ». Tant que le dossier est ouvert, le bot ne répond plus et les messages du membre sont transmis à l'admin.
- Interface : composant existant `AIChatBox`, modifié pour afficher les messages en texte brut (le rendu Markdown de Streamdown acceptait du HTML brut, risque XSS) ; textes de la bulle publique dans un petit dictionnaire fr/en/ar local ; dans le hub, entrée « Assistant IA » dans le menu du compte + bouton flottant vers la page (pas de panneau).
- Modèle par défaut : `openrouter/free` (routeur OpenRouter), surchargeable par `AI_MODELS`.
