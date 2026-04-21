# Accès démonstration

Le site propose **deux modes de démonstration distincts** :

## 1. Sandbox public `/demo` (recommandé)

- URL : `https://www.ftourbabrayan.ma/demo`
- Landing page publique et indexable par les moteurs de recherche.
- 5 modules sandbox accessibles librement, sans compte :
  - `/demo/dashboard` — KPI globaux et graphiques
  - `/demo/utilisateurs` — bénévoles, bénéficiaires, donateurs (fiches éditables)
  - `/demo/dons` — historique, charts, ajout de faux dons
  - `/demo/ftour` — planning des repas, menus, statistiques journalières
  - `/demo/partenaires` — entreprises partenaires fictives
- **Aucune API réelle n'est appelée**. Les données sont générées aléatoirement
  côté navigateur et stockées dans `localStorage`
  (clé : `ftour_demo_dataset_v1`).
- Deux actions sandbox disponibles depuis n'importe quelle page :
  - « Générer de nouvelles données » — nouveau dataset aléatoire
  - « Reset démo » — remet l'état vierge
- Le code vit sous `client/src/features/demo/`.

## 2. Accès démo admin `/demo-access` (legacy, interne)

- URL : `/demo-access`
- Active un compte de démonstration côté front (`localStorage`) puis redirige
  vers `/admin/unified-dashboard` (données de staging réelles).
- Réservé aux environnements internes / staging — **ne pas diffuser
  publiquement**.

### Identifiants éventuels pour `/admin` en staging

- Email : `demo@ftourbabrayan.ma`
- Mot de passe : `Demo@2026!BabRayan`

## Brancher la version réelle plus tard

Le sandbox a été conçu pour rester totalement découplé de la production :

1. Tous les appels de données passent par le hook `useDemoData()`
   (`client/src/features/demo/hooks/useDemoData.ts`), qui lit le store local.
2. Pour brancher une vraie API (tRPC, REST, Supabase…), il suffit de remplacer
   l'implémentation de `useDemoData()` et des helpers de `data/store.ts` par
   des appels réels — aucun composant de page n'a besoin d'être modifié.
3. Les types du modèle démo (`data/types.ts`) peuvent servir de base au
   schéma de données de production ou être mappés vers les types Drizzle
   existants.
