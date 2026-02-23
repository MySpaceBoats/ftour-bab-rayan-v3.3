# Audit SEO complet — https://www.ftourbabrayan.ma

_Date de l’audit: 2026-02-23_

## Méthodologie et périmètre
- Analyse technique et on-page réalisée via navigation réelle (Playwright) sur les pages FR/EN/AR détectées depuis la navigation principale.
- Vérifications HTTP/SEO: statut, redirections, robots, sitemap, titres, metas, balisage Hn, canonical, données structurées.
- Performance: estimation via métriques navigateur (TTFB, DCL, load event, poids transféré observé), plus diagnostic de bonnes pratiques CWV.
- Off-page/concurrence: estimation stratégique (sans accès aux outils propriétaires type Ahrefs/Semrush/GSC).

---

## 1) Audit Technique SEO

### 1.1 Indexation (robots.txt, sitemap.xml, directives)
**Constats**
1. `robots.txt` répond en 200 mais contient un mélange anormal: directives robots + HTML de l’application (fallback SPA injecté dans la réponse). **Criticité: Élevée**.
2. `sitemap.xml` renvoie du HTML (page applicative) au lieu d’un XML de sitemap. **Criticité: Élevée**.
3. Aucune directive `meta robots` détectée sur les pages principales (ni `noindex` ni `index,follow` explicite). Ce n’est pas bloquant, mais manque de pilotage. **Criticité: Faible**.

**Impact SEO**
- Les moteurs peuvent mal interpréter vos signaux d’exploration/indexation.
- Absence de sitemap exploitable = découverte/crawl plus faibles des pages profondes.

### 1.2 Structure d’URL
**Constats**
- Structure propre et lisible (`/fr/evenement`, `/fr/reservation`, `/en`, `/ar`), orientée intention. **Point positif**.
- Route inconnue (`/foo-bar-404`) répond 200 au lieu d’un 404/410 (soft 404 probable). **Criticité: Élevée**.

### 1.3 Canonical
**Constats**
- Balises `rel="canonical"` absentes sur les pages testées. **Criticité: Élevée**.

### 1.4 Redirections (301/302)
**Constats**
- Base domain et variantes slash semblent répondre proprement (pas de boucle observée).
- Pas de normalisation SEO visible (http→https, www/non-www, slash policy) dans l’audit frontal uniquement.
- Le point majeur reste le soft 404 (200). **Criticité: Élevée**.

### 1.5 Erreurs 404
**Constats**
- Les URLs inexistantes renvoient 200. **Criticité: Élevée**.

### 1.6 Titles & Meta Descriptions
**Constats**
- Titre identique sur la majorité des pages: `Ftour Bab Rayan - 12e édition`.
- Meta description identique sur les pages principales.
- Fort risque de duplication de snippets et perte de pertinence par intention. **Criticité: Élevée**.

### 1.7 Structure H1/H2/H3
**Constats**
- La page d’accueil `/fr` n’expose pas de H1 détectable au rendu audité.
- Plusieurs pages ont des H1 présents mais structure inégale (ex. répétitions de termes dans certains H1).
- H2/H3 parfois déséquilibrés selon page. **Criticité: Moyenne**.

### 1.8 Données structurées (Schema.org)
**Constats**
- Aucune donnée structurée JSON-LD détectée sur les pages testées. **Criticité: Moyenne à Élevée**.

### 1.9 Maillage interne
**Constats**
- Maillage interne globalement présent via menu principal (≈19–21 liens internes/page).
- Profondeur de contenu limitée (site événementiel, peu de pages éditoriales).
- Opportunité forte de maillage contextuel (FAQ, pages causes, pages localisées). **Criticité: Moyenne**.

### 1.10 Gestion multilingue
**Constats**
- Versions FR/EN/AR présentes.
- Absence observée de balises `hreflang` + `x-default`. **Criticité: Élevée**.
- Risque de confusion d’indexation entre versions linguistiques.

### 1.11 Mobile / HTTPS / pages dynamiques
**Constats**
- Meta viewport présent; site visiblement responsive.
- HTTPS actif.
- Application SPA: attention à l’indexabilité des routes et aux codes HTTP serveur (notamment 404).

---

## 2) Performance & Core Web Vitals

## Estimation actuelle (à confirmer avec CrUX / PSI)
- **LCP estimé**: 2.2–3.2s (probablement variable selon image héro et device).
- **CLS estimé**: 0.05–0.15 (à surveiller, dépend des médias et polices web).
- **INP estimé**: 180–280ms (JS bundle front unique à optimiser).
- **TTFB observé labo**: ~63–78ms (bon dans cet environnement de test).

### Problèmes probables détectés
1. Bundle JS/CSS d’app SPA chargé globalement (risque sur LCP/INP). **Criticité: Moyenne**.
2. Chargement Google Fonts externe multiple, potentiel blocage de rendu partiel. **Criticité: Moyenne**.
3. Aucune preuve explicite de stratégie image SEO/perf (formats next-gen, dimensions, lazy). **Criticité: Moyenne**.
4. Headers de cache/compression non validés exhaustivement côté origin (à auditer via `curl -I` hors contrainte). **Criticité: Moyenne**.

### Plan d’amélioration priorisé
1. **P1 (0–30j)**: corriger `sitemap.xml` + `robots.txt` + vrais 404/410 + canonicals.
2. **P1 (0–30j)**: personnaliser Title/Meta par template de page.
3. **P2 (1–2 mois)**: implémenter JSON-LD (`Organization`, `Event`, `FAQPage`, `BreadcrumbList`).
4. **P2 (1–2 mois)**: optimiser image pipeline (WebP/AVIF, `srcset`, lazy below-the-fold).
5. **P3 (2–3 mois)**: réduire JS initial (code splitting par route, preloading critique, suppression dépendances inutiles).

---

## 3) SEO On-Page (pages principales)

## Scoring estimé par page (sur 100)
- `/fr`: **42/100** (pas de H1 détecté + title/meta dupliqués + pas de canonical/schema)
- `/fr/evenement`: **58/100** (H1 présent mais snippets dupliqués)
- `/fr/reservation`: **61/100**
- `/fr/benevole`: **57/100**
- `/fr/galerie`: **54/100**
- `/en`: **45/100** (structure probable similaire FR, manque signaux langue/hreflang)
- `/ar`: **45/100** (idem)

### Recommandations de réécriture (exemples)
- **Home FR Title**: `Ftour Bab Rayan 2026 à Casablanca | Ftour solidaire & collecte de dons`
- **Home FR Meta**: `Participez au Ftour Bab Rayan à Casablanca: réservation, bénévolat, dons et partenariat pour soutenir les actions solidaires pendant Ramadan.`

- **Événement Title**: `Programme de l’événement Ftour Bab Rayan | Horaires, lieu, édition 2026`
- **Événement Meta**: `Découvrez le programme complet du Ftour Bab Rayan: date, lieu, déroulé de la soirée et impact social de l’édition.`

- **Réservation Title**: `Réserver votre place – Ftour Bab Rayan Casablanca`
- **Réservation Meta**: `Réservez votre place au ftour solidaire en quelques clics et recevez votre confirmation immédiatement.`

### Mots-clés à ajouter (cluster FR)
- ftour solidaire casablanca
- ftour caritatif maroc
- iftar solidaire ramadan casablanca
- association aide ramadan maroc
- événement caritatif ramadan
- faire un don repas ramadan
- devenir bénévole ramadan casablanca

### Intentions à mieux couvrir
- Information: “comment aider pendant ramadan à Casablanca”.
- Transactionnel: “réserver ftour”, “faire un don”.
- Local: “association caritative Casablanca Ramadan”.

---

## 4) SEO Off-Page (diagnostic estimatif)

### Diagnostic
- Marque potentiellement forte localement (événement identifié), mais dépendance probable au trafic marque/direct/social.
- Profil backlinks vraisemblablement concentré sur mentions presse/partenaires saisonnières.
- Levier local non maximal sans pages local SEO enrichies + citations structurées.

### Axes de développement
1. **Digital PR**: dossiers presse SEO + pages bilan d’impact annuelles (linkbait légitime).
2. **Partenariats**: backlinks depuis institutions, écoles, sponsors, médias locaux.
3. **Local SEO**: optimisation fiche Google Business (si entité locale physique), NAP cohérent, citations annuaires fiables.
4. **Social SEO**: réutiliser vidéos/photos + pages dédiées référençables (pas uniquement posts réseaux).

---

## 5) Analyse concurrentielle (3 concurrents directs)

> Concurrents proposés par proximité d’intention de recherche (iftar/solidarité/association Ramadan au Maroc):
1. **Banque Alimentaire Maroc** (requêtes dons alimentaires, solidarité Ramadan)
2. **Tadamon / associations locales Ramadan** (requêtes bénévolat/don local)
3. **Opérations Ramadan d’associations caritatives marocaines médiatisées** (pages campagne saisonnières)

### Comparatif (qualitatif)
- **Structure SEO**: acteurs institutionnels ont souvent plus de pages evergreen + communiqués.
- **Autorité**: généralement supérieure via ancienneté et liens médias.
- **Volume de contenu**: plus élevé chez ONG nationales.
- **Mots-clés dominants**: dons, aide alimentaire, ramadan maroc, bénévolat.
- **Opportunités manquées Ftour Bab Rayan**:
  - Pages guides (“Comment aider pendant Ramadan à Casablanca”).
  - Pages résultats/impact chiffré annuels.
  - FAQ SEO + pages partenaires optimisées.

---

## 6) Stratégie de croissance SEO (12 mois)

## Quick wins (30 jours)
1. Corriger `sitemap.xml` en vrai XML indexable.
2. Nettoyer `robots.txt` (sans HTML injecté, avec `Sitemap:`).
3. Implémenter vraies réponses 404/410.
4. Ajouter canonical sur toutes les pages indexables.
5. Titles/Meta uniques par page.
6. Ajouter `hreflang` FR/EN/AR + `x-default`.

## Moyen terme (3–6 mois)
1. Créer 12–20 pages SEO long-tail (dons, bénévolat, iftar solidaire, local Casablanca).
2. Intégrer JSON-LD complet.
3. Lancer un blog impact: témoignages, bilans, partenaires, transparence des dons.
4. Mettre en place dashboards GSC (requêtes, CTR, indexation).

## Long terme (12 mois)
1. Stratégie éditoriale continue (2 contenus/mois minimum).
2. Stratégie netlinking éthique (PR, médias, institutions, partenaires).
3. Pages “pilier + cluster” sur intentions clés (don, bénévolat, événement, impact).
4. Amélioration continue CWV sur mobile (objectif: CWV “Good” > 75% URLs).

## Calendrier éditorial recommandé (exemple)
- M1–M3: pages transactionnelles + FAQ + pages locales.
- M4–M6: contenus expertise/impact + guides pratiques.
- M7–M9: contenus partenaires + études d’impact + presse.
- M10–M12: refresh SEO avant Ramadan (édition suivante).

---

## 7) Synthèse exécutive

Le site possède une base propre (URLs lisibles, HTTPS, expérience de navigation correcte), mais souffre de **freins SEO critiques de fondation**: `sitemap.xml` non valide, `robots.txt` pollué, **soft 404**, absence de canonical/hreflang et duplication massive des Title/Meta.

### Tableau des priorités
| Priorité | Action | Impact SEO | Effort |
|---|---|---:|---:|
| P1 | Corriger sitemap.xml + robots.txt | Très élevé | Faible à moyen |
| P1 | Corriger soft 404 (codes 404/410 réels) | Très élevé | Moyen |
| P1 | Canonical + Title/Meta uniques | Très élevé | Faible |
| P1 | hreflang FR/EN/AR + x-default | Élevé | Moyen |
| P2 | Schema.org (Organization/Event/FAQ/Breadcrumb) | Élevé | Moyen |
| P2 | Contenu long-tail + FAQ locales | Élevé | Moyen |
| P3 | Optimisations avancées CWV (JS, images) | Moyen à élevé | Moyen à élevé |

### Estimation du potentiel de croissance SEO
- **3 mois**: +30% à +80% impressions organiques (stabilisation indexation + snippets uniques).
- **6 mois**: +80% à +180% trafic non-marque (si production de contenu + netlinking).
- **12 mois**: x2 à x4 trafic SEO qualifié sur saison Ramadan + hors-saison (grâce aux pages evergreen et cluster local).

---

## Annexes — Observations brutes clés
- Route inexistante testée (`/foo-bar-404`) retournée en 200.
- `sitemap.xml` sert du HTML applicatif.
- `robots.txt` contient directives Cloudflare + contenu HTML d’app en aval.
- Pas de canonical détecté sur les pages auditées.
- Pas de JSON-LD détecté.
- Titre/meta identiques sur de multiples routes.
