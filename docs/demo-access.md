# Accès démonstration (mode démo)

## Accès direct sans identifiants
- URL: `/demo`
- Comportement: active automatiquement un compte de démonstration, puis redirige vers `/admin/unified-dashboard`.
- Ce mode ne nécessite pas de login/mot de passe.
- Les modules admin affichent des jeux de données fictifs limités (comptes démo), pas les données réelles.

## Identifiants de démonstration suggérés (si nécessaire)
- Nom d'utilisateur (email): `demo@ftourbabrayan.ma`
- Mot de passe par défaut: `Demo@2026!BabRayan`

> Recommandation: réserver ces identifiants aux environnements de test/staging.

## Limites de sécurité en mode démo
- Les mutations (création/modification/suppression) sont bloquées en mode démo.
- Seules des données de démonstration sont renvoyées pour les écrans admin principaux (utilisateurs, commandes, dons, pâtisserie, terroir, entrées cash).
