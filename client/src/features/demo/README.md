# Demo Sandbox — Ftour Bab Rayan

Démo publique 100 % simulée accessible sur `/demo`.

## Architecture

```
client/src/features/demo/
├── data/
│   ├── types.ts        # Modèle du dataset démo
│   ├── generate.ts     # Générateur de données fictives (noms marocains, montants)
│   └── store.ts        # Store localStorage + pub/sub
├── hooks/
│   └── useDemoData.ts  # Hook d'abonnement au store
├── components/
│   ├── DemoLayout.tsx    # Layout global (sidebar + header + actions sandbox)
│   ├── DemoSidebar.tsx   # Navigation démo
│   ├── DemoBadge.tsx     # Badge « Mode Démo »
│   ├── DemoOnboarding.tsx# Onboarding 3 étapes
│   ├── KpiCard.tsx       # Carte KPI réutilisable
│   └── utils.ts          # Formatters (MAD, dates, temps relatif)
└── pages/
    ├── DemoLanding.tsx       # /demo (SEO friendly, indexable)
    ├── DemoDashboard.tsx     # /demo/dashboard
    ├── DemoUtilisateurs.tsx  # /demo/utilisateurs
    ├── DemoDons.tsx          # /demo/dons
    ├── DemoFtour.tsx         # /demo/ftour
    └── DemoPartenaires.tsx   # /demo/partenaires
```

## Flux de données

1. Le premier rendu appelle `getDemoDataset()`.
2. Si `localStorage` contient déjà un dataset valide (même version), on le
   charge. Sinon on génère un nouveau dataset aléatoire via
   `generateDemoDataset()`.
3. Les composants de page consomment `useDemoData()` (un `useSyncExternalStore`
   abonné au store).
4. Toute mutation (ex : ajout de don, édition d'utilisateur) passe par
   `updateDemoDataset(updater)` qui persiste et re-notifie les abonnés.

## Contraintes respectées

- ✅ Aucune API serveur appelée — le dossier est autosuffisant côté client.
- ✅ Aucun lien avec les tables Drizzle / Supabase de production.
- ✅ Les données sont **versionnées** (`DEMO_DATASET_VERSION`) : en cas de
  changement de schéma, les anciens datasets locaux sont simplement ignorés.
- ✅ Reset et régénération sandbox en un clic depuis le header.
- ✅ Sandbox total : aucun token, cookie, ni identifiant requis.
- ✅ Onboarding 3 étapes au premier accès, re-déclenchable via « Guide rapide ».
- ✅ Page `/demo` indexable (meta description, JSON-LD, `robots: index,follow`).

## Brancher une vraie API plus tard

Toute l'IO est isolée dans `data/store.ts`. Pour connecter la production :

1. Remplacer `getDemoDataset`, `updateDemoDataset`, etc. par des appels à
   l'API souhaitée (tRPC / REST / Supabase). Garder la même signature.
2. Adapter `hooks/useDemoData.ts` pour lire depuis React Query si l'API
   expose des endpoints par ressource.
3. Les composants de page restent inchangés.

## Performances

- Dataset généré paresseusement à la 1ère lecture.
- `useSyncExternalStore` évite les re-rendus inutiles.
- Les tableaux sont pagés en mémoire (max 40 lignes visibles) pour les
  listes volumineuses.
