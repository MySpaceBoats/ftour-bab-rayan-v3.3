# Vérification rapide d'une potentielle compromission ("hack")

Date: 2026-02-24

## Résultat
Aucun indicateur clair de compromission n'a été trouvé dans le code source versionné lors de cette vérification statique.

## Contrôles effectués
1. Vérification d'état Git (`git status --short`) pour confirmer l'absence de modifications locales non expliquées.
2. Recherche de motifs souvent liés à des injections/backdoors:
   - `eval(`, `new Function`, `dangerouslySetInnerHTML`, `document.write`, exécution shell (`exec`, `spawn`), URLs potentiellement suspectes.
3. Revue des URLs externes déclarées dans le front/back pour repérer des domaines inattendus.
4. Tentative d'audit dépendances (`npm audit --omit=dev --json`).

## Observations
- Les occurrences `base64`, `atob`, `btoa` détectées sont cohérentes avec des usages fonctionnels (QR code, upload images, email templates) et ne démontrent pas une compromission à elles seules.
- Une occurrence de `dangerouslySetInnerHTML` existe côté UI (`client/src/components/ui/chart.tsx`) mais cela semble lié à la génération de styles/markup de composant; à surveiller si du contenu non fiable y est injecté.
- Les URLs externes observées semblent majoritairement légitimes (domaines du projet, Google Maps, Resend, GitHub, Supabase, api.qrserver.com, Google Fonts, Decap CMS).
- `npm audit` n'a pas pu être exécuté complètement dans cet environnement (erreur HTTP 403 sur l'endpoint advisory npm), donc pas de conclusion automatisée sur CVE dépendances.

## Limites de ce contrôle
- Contrôle statique uniquement (pas d'analyse runtime mémoire/process, pas d'EDR, pas de SIEM logs).
- Sans accès au serveur de prod (logs Nginx/Cloudflare, modifications fichiers système, users SSH), il est impossible de certifier à 100% l'absence d'attaque active.

## Actions recommandées (priorité)
1. Exécuter un scan de vulnérabilités dépendances dans un environnement avec accès npm advisory (ou `pnpm audit`, Snyk, Dependabot).
2. Vérifier les logs d'accès et d'authentification des 30 derniers jours (pics 4xx/5xx, routes inhabituelles, brute-force).
3. Activer/valider WAF + règles Cloudflare (rate limiting, bot management).
4. Rotation des secrets sensibles (API keys, tokens) si suspicion opérationnelle.
5. Ajouter un contrôle d'intégrité (hash des bundles, CSP stricte, SRI sur scripts CDN).
