# Ftour Bab Rayan - TODO

## Phase 1 : Base de données et Authentification
- [x] Schéma de base de données complet (users, volunteers, days, goodies, orders, donations)
- [x] Système de rôles multi-niveaux (super_admin, admin_ops, admin_boutique, admin_dons, scanner)
- [x] Middleware de contrôle d'accès basé sur les rôles

## Phase 2 : Module Bénévoles
- [x] Table des jours Ramadan avec capacité maximale
- [x] Formulaire d'inscription bénévole
- [x] Génération automatique de QR code unique par inscription
- [x] Envoi d'email de confirmation avec QR code et consignes
- [x] Calendrier interactif avec compteur d'inscrits en temps réel
- [x] Fermeture automatique des jours complets

## Phase 3 : Interface Scan QR
- [x] Page de scan QR mobile-first
- [x] Lecture et validation du QR code
- [x] Affichage fiche minimale bénévole (nom, jour, statut)
- [x] Bouton validation présence
- [x] Anti-doublon (alerte si déjà scanné)
- [x] Historique des scans (audit)

## Phase 4 : Tableau de bord Bénévoles
- [x] Liste des inscrits par jour
- [x] Statuts présents/absents
- [x] Export CSV par jour
- [x] Export CSV global

## Phase 5 : Module Goodies
- [x] Table produits avec variantes (taille, couleur)
- [x] Catalogue avec photos, descriptions, prix, stock
- [x] Badges produits (best-seller, nouveau, édition Ramadan)
- [x] Panier de réservation
- [x] Formulaire client (nom, téléphone, email)
- [x] Email de confirmation avec référence commande

## Phase 6 : Back-office Goodies
- [x] Liste des commandes
- [x] Gestion des statuts (Réservé/Remis/Payé/Annulé)
- [x] Export comptable CSV

## Phase 7 : Module Promesses de Dons
- [x] Formulaire promesse de don
- [x] Choix mode paiement (virement/sur place)
- [x] Email automatique avec instructions RIB
- [x] Liste des promesses admin
- [x] Gestion des statuts (Promis/En attente/Reçu/Annulé)
- [x] Export CSV donations

## Phase 8 : Pages Publiques Vitrine
- [x] Page Accueil (hero, CTA, compteurs)
- [x] Page L'événement (pourquoi, pour qui, comment)
- [x] Page Programme (calendrier filtrable)
- [x] Page Devenir bénévole
- [x] Page Goodies (boutique)
- [x] Page Donations
- [x] Page Association Bab Rayan
- [ ] Page À propos (équipe)
- [x] Page Contact
- [x] Page FAQ
- [x] Mentions légales et Politique de confidentialité

## Phase 9 : Blocs Transparence et Crédibilité
- [x] Bloc "Où vont les dons"
- [x] Bloc "Chiffres clés" avec compteurs dynamiques
- [ ] Galerie média (photos/vidéos)
- [ ] Section témoignages
- [ ] Section partenaires/sponsors

## Phase 10 : Finalisation
- [x] Tests unitaires des procédures critiques
- [x] Optimisation mobile-first
- [ ] SEO minimal (métadonnées, sitemap)
- [x] Validation finale et checkpoint


## Phase 11 : Mise à jour du contenu avec informations réelles Bab Rayan
- [x] Analyser le site babrayan.ma pour extraire les informations
- [x] Mettre à jour la page Association avec les vraies informations
- [x] Mettre à jour la page Accueil avec le contenu réel
- [x] Mettre à jour la page Événement avec les détails Ftour
- [x] Mettre à jour les coordonnées de contact
- [ ] Ajouter les vraies images et logos si disponibles
- [ ] Mettre à jour les mentions légales avec les informations juridiques


## Phase 12 : Documentation Google Drive
- [x] Explorer le dossier Google Drive DOSSIER DIGITAUX -> DOSSIER BENEV -> FTOUR BAB RAYAN
- [x] Créer le document de contenu du site (.docx)
- [x] Créer la wireframe du site (Google Slides)
- [x] Télécharger les fichiers dans le dossier Drive


## Bugs à corriger
- [x] Erreur SQL dans la requête de statistiques bénévoles (COUNT/SUM sans alias)
- [x] Erreur SQL dans getDonationStats (COUNT/SUM sans alias)
- [x] Erreur SQL dans getOrderStats (COUNT/SUM sans alias)
- [x] Erreur JavaScript en production sur ftourbabrayan.ma (An unexpected error occurred)

## Phase 13 : Système QR Code Standard ISO/IEC 18004
- [x] Mettre à jour le schéma DB pour ajouter un token sécurisé 128 bits (qrToken)
- [x] Installer bibliothèque qrcode pour génération standard
- [x] Implémenter génération QR codes avec URL https://{domain}/checkin/{token}
- [x] Créer page publique /checkin/{token} mobile-first avec 4 états (valide, déjà validé, mauvaise date, invalide)
- [x] Implémenter validation avec anti-doublon et historique des scans
- [x] Mettre à jour back-office avec affichage QR réel et lien de test
- [x] Router checkin avec endpoints verify (public) et validate (scanner)
- [x] Tests unitaires (26 tests passés)

## Phase 14 : Intégration Resend pour emails automatiques
- [x] Configurer la clé API Resend
- [x] Créer le module d'envoi d'emails
- [x] Template email confirmation inscription bénévole (avec QR code)
- [x] Template email confirmation commande goodies
- [x] Template email promesse de don (avec RIB)
- [x] Intégrer l'envoi dans les flux existants
- [x] Tests unitaires (31 tests passés)

## Phase 15 : Migration vers Supabase (Postgres)
- [x] Configurer les variables d'environnement Supabase (URL, ANON_KEY, SERVICE_ROLE_KEY)
- [x] Installer @supabase/supabase-js
- [x] Créer le schéma de base de données Postgres avec tables et contraintes
- [x] Configurer RLS (Row Level Security) sur les tables
- [x] Créer les clients Supabase (public et admin)
- [x] Créer les services de données (volunteers, goodies, donations, checkins)
- [x] Refactorer les routers tRPC pour utiliser Supabase
- [x] Créer l'interface admin scan web avec caméra (/admin/scan)
- [x] Créer la page admin validation manuelle et exports CSV
- [ ] Migrer les données existantes vers Supabase (si nécessaire)
- [x] Tests unitaires (26 tests passés)

## Phase 16 : Implémentation Supabase Auth
- [x] Configurer Supabase Auth dans le projet
- [x] Créer le service d'authentification Supabase (server/supabase-auth.ts)
- [x] Créer la page de connexion (email/mot de passe) (/connexion)
- [x] Créer la page d'inscription (/inscription)
- [x] Mettre à jour le hook useAuth pour Supabase (nettoyage token)
- [x] Mettre à jour la Navbar avec les nouveaux boutons
- [x] Créer l'administrateur rsebbani@myspace.boats (super_admin)
- [x] Ajouter les endpoints login/signup dans le router auth
- [x] Configurer le client tRPC pour envoyer le token Supabase
- [ ] Tester la connexion sur ftourbabrayan.ma (en production)

## Phase 17 : Configuration Cloudflare Workers pour le backend
- [x] Analyser la configuration actuelle du projet
- [x] Configurer Cloudflare Workers/Pages Functions (wrangler.toml)
- [x] Adapter le code serveur pour Cloudflare Workers (worker/)
- [x] Créer les scripts de build (build:worker, build:cloudflare)
- [x] Déployer sur Cloudflare avec les secrets
- [x] Configurer le frontend pour utiliser api.ftourbabrayan.ma
- [x] Corriger l'URL API avec variable d'environnement VITE_API_URL
- [ ] Tester la connexion en production

## Fonctionnalité : Suppression des jours du calendrier
- [x] Ajouter l'endpoint de suppression dans le router (déjà existant)
- [x] Ajouter le bouton Supprimer dans l'interface admin
- [x] Corriger la fonction "Fermer" qui ne fonctionne pas (problème isOpen vs isClosed)

## Fonctionnalité : Détection automatique QR code
- [x] Implémenter la détection automatique avec jsQR
- [ ] Tester sur mobile

## Fonctionnalité : Correction envoi emails
- [x] Corriger l'envoi du mail avec QR code au bénévole (worker/email.ts)
- [x] Ajouter copie cachée (BCC) à rsebbani@myspace.boats
- [x] Inclure le rappel des jours inscrits dans l'email
- [x] Ajouter l'envoi d'email dans le worker Cloudflare

## Bug : Gestion des bénévoles
- [x] Les bénévoles inscrits n'apparaissent pas dans la liste admin
- [x] Corriger le format de retour de volunteers.listByDay (ajouter days[])

## Fonctionnalité : Upload d'images pour les goodies
- [x] Créer l'endpoint d'upload d'images vers Supabase Storage
- [x] Modifier le formulaire d'ajout de goodies pour télécharger des images PNG/JPEG
- [x] Afficher un aperçu de l'image avant l'envoi

## Tables manquantes Supabase
- [x] Créer la table testimonials
- [x] Créer la table partners
- [x] Créer le bucket de stockage 'images' (public)

## Bug : Erreur de type sur le champ price des goodies
- [x] Corriger le type du champ price (expected string, received number)

## Rebranding 2026 - Nouvelle identité visuelle olive/crème
- [x] Mettre à jour les design tokens CSS (palette olive/crème)
- [x] Ajouter les polices manuscrites (Caveat, Aref Ruqaa, Cormorant Garamond)
- [x] Rebrander le Header (fond olive-dark, texte crème)
- [x] Rebrander le Footer (fond olive-dark, texte crème)
- [x] Rebrander le Hero (fond olive, titre bilingue, 12e édition)
- [x] Rebrander les composants (Cards, Buttons, Sections)
- [x] Remplacer toutes les occurrences 2025 → 2026
- [ ] Vérifier le contraste et l'accessibilité
- [ ] Tester le responsive mobile
- [ ] Rebrander les autres pages (Evenement, Programme, Benevole, Goodies, Dons, etc.)

## Bugs de production (ftourbabrayan.ma) - 27/01/2026
- [x] Erreur price type sur ajout goodies (worker corrigé pour accepter number)
- [x] Procédure volunteers.updateStatus ajoutée dans le worker
- [x] Procédure volunteers.checkIn ajoutée dans le worker

## Phase 18 : Refonte menu et multilingue (Cahier des charges #369)
### Étape 1 - Menu principal
- [x] Supprimer l'onglet "Faire un don" du menu principal
- [x] Ajouter l'onglet "Contact" à la place
- [x] Nouveau menu : Accueil, L'événement, Devenir bénévole, Goodies solidaires, Association, Contact

### Étape 2 - Boutons CTA
- [x] Ajouter bouton "Devenir Bénévole" (CTA principal) à droite du menu
- [x] Ajouter bouton "Faire un don" (CTA secondaire) collé au premier
- [x] Boutons visibles sur desktop et mobile

### Étape 3 - Page Contact
- [x] Créer la page Contact avec formulaire (nom, email, téléphone, sujet, message)
- [x] Afficher les coordonnées de l'association
- [x] Message de confirmation après envoi

### Étape 4 - Menu supérieur (niveau 0)
- [x] Ajouter un menu fin au-dessus du menu principal
- [x] Icône loupe (recherche inline comme cloudflare.com)
- [x] Lien Admin vers la page de connexion
- [x] Numéro de téléphone cliquable
- [x] Icône globe pour les langues

### Étape 5 - Multilingue
- [x] Créer le système i18n avec contexte React
- [x] Fichiers de traduction : FR (défaut), AR (RTL), AMAZIGH, EN
- [x] Traduire menus, pages, boutons, formulaires
- [x] URLs dédiées (/fr, /ar, /amz, /en)
- [x] Mémoriser la langue sélectionnée (localStorage)
- [x] Support RTL pour l'arabe

## Bug : Les onglets de menu ne fonctionnent pas
- [x] Diagnostiquer le problème des liens de navigation
- [x] Corriger les liens dans la Navbar pour le routing multilingue

## Corrections demandées - 27/01/2026
- [x] Lien Admin doit pointer vers la page de connexion (/connexion)
- [x] Mettre à jour le numéro de téléphone : +212 610 023 555
- [x] Corriger l'erreur DialogTitle sur la page bénévole (accessibilité)

## Phase 19 : Intégration CMS Decap avec Supabase Auth et Git Gateway

### Architecture
- [x] Analyser l'architecture existante et planifier l'intégration
- [x] Définir le schéma de la table profiles (utilise public.users existante avec role)

### Backend Git Gateway
- [x] Créer l'endpoint /api/cms/session pour validation session
- [x] Créer l'endpoint /api/cms/auth pour l'authentification
- [x] Créer l'endpoint /api/cms/github/* pour proxy Git sécurisé
- [x] Créer l'endpoint /api/cms/content/* pour CRUD contenu
- [x] Implémenter la vérification du rôle admin
- [x] Sécuriser avec JWT et CORS strict
- [x] Module GitHub App pour tokens temporaires

### Configuration Decap CMS
- [x] Créer /admin/index.html avec auth Supabase
- [x] Créer /admin/config.yml avec backend custom-github
- [x] Configurer les collections (pages, articles, testimonials, partners, faq, settings)
- [x] Support multilingue intégré (FR, AR, EN, AMZ)

### Structure de contenu
- [ ] Créer /content/pages/
- [ ] Créer /content/articles/
- [ ] Créer /content/settings/

### Sécurité
- [ ] Protéger l'accès /admin (vérification rôle)
- [ ] Tokens JWT à durée limitée
- [ ] Logs d'accès CMS
- [ ] Aucun token exposé côté client

### Documentation
- [ ] Documentation technique (architecture, installation)
- [ ] Guide ajout d'un admin
- [ ] Guide utilisateur (éditeur)

### Contraintes strictes
- ❌ Pas de Netlify Identity
- ❌ Pas de CMS propriétaire
- ❌ Pas de stockage contenu hors Git
- ❌ Pas de token exposé côté client

## Phase 20 : Traduction complète et sélecteur de langues

### Sélecteur de langues
- [x] Supprimer tous les drapeaux du sélecteur
- [x] Afficher les noms natifs : Français, العربية, ⵜⴰⵎⴰⵣⵉⵖⵜ, English
- [x] Style minimaliste et sobre

### Traduction complète
- [x] Compléter fichiers i18n (fr.ts, ar.ts, en.ts, amz.ts)
- [x] Traduire page Home
- [ ] Traduire page Evenement
- [ ] Traduire page Benevole
- [ ] Traduire page Goodies
- [ ] Traduire page Dons
- [ ] Traduire page Association
- [ ] Traduire page Contact
- [ ] Traduire page FAQ
- [ ] Traduire page Mentions légales
- [ ] Traduire formulaires et messages dynamiques
- [ ] Vérifier RTL pour l'arabe

## Bugs à corriger - 27/01/2026 (après-midi)
- [x] Sélecteur de langue ne fonctionne pas après chargement de la page (déjà implémenté avec window.location.href)
- [x] Bouton d'accès à l'interface admin manquant pour les utilisateurs connectés (ajouté dans Navbar)
- [x] Renommer "Admin" en "Support" dans le top menu (traductions ajoutées)
- [x] Changer "Support" en "Admin" dans le menu de navigation


## Bugs à corriger - 27/01/2026 (soir)
- [x] Erreur NetworkError lors de l'envoi du formulaire de contact (testé et fonctionnel)
- [x] Mettre à jour le numéro de téléphone dans les coordonnées de contact (+212 610 023 555)


## Corrections - 27/01/2026 (soir suite)
- [x] Changer l'email de contact vers contact@ftourbabrayan.ma
- [x] Ajouter scroll automatique vers le haut à chaque changement de page
- [x] Lien Support doit diriger vers /contact au lieu de /connexion (déjà correct)
- [x] Lien Support doit diriger vers /connexion (pour les admins)

## Bugs - 27/01/2026 (soir - suite 2)
- [x] Bouton Administration ne redirige pas vers /admin après connexion (corrigé - redirection automatique pour les admins)
- [x] Page /admin affiche maintenant l'interface d'administration complète (routes réorganisées)
- [ ] CMS bloqué sur "Chargement du CMS..." sur ftourbabrayan.ma/admin (en pause - utiliser /admin à la place)

## Corrections CMS - 27/01/2026
- [x] Configurer le CMS sur /cms avec les bons endpoints API (même serveur que Supabase)

## Vérification API Resend - 27/01/2026
- [ ] Vérifier la configuration de l'API Resend pour l'envoi des emails
- [ ] Tester l'envoi des formulaires (contact, bénévole, commandes, dons)


## Bugs Scanner QR - 27/01/2026
- [x] Scanner QR embarqué affiche "QR code invalide" alors que le QR est valide (corrigé - ajout support URLs /checkin/)
- [x] Mettre à jour le statut du bénévole sur "Présent" après validation du QR code (déjà implémenté dans le backend)


## Gestion des utilisateurs - 27/01/2026
- [x] Créer le compte super admin admin@ftourbabrayan.ma dans Supabase

## Bug UX - 27/01/2026
- [x] Rafraîchissement automatique du statut bénévole après scan QR code (polling toutes les 5 secondes)

## Fonctionnalité - 27/01/2026
- [x] Ajouter un bouton de suppression pour les bénévoles dans l'interface admin

## Bugs Catalogue Goodies - 27/01/2026
- [x] Produits n'apparaissent pas dans l'interface admin du catalogue (problème de rôle - nécessite admin_boutique ou super_admin)
- [x] Ajouter un bouton de suppression pour les produits
- [x] Supprimer les 2 produits fantômes qui apparaissent sur le front mais pas sur le backend
- [x] Supprimer les 2 produits test de Supabase (ID 1 et 2)
- [x] Corriger le champ prix/nombre où le 0 ne s'efface pas lors de la saisie


## Corrections Page d'accueil - 28/01/2026
- [x] Boutons "Devenir bénévole" et "Faire un don" ne fonctionnent pas sur la page d'accueil (ajout préfixe langue)
- [x] Supprimer la 2ème section "Chiffres clés annuels" (avec les cartes)
- [x] Corriger tous les liens dans FAQ.tsx et Programme.tsx


## Bug Email Bénévole - 28/01/2026
- [x] Email de confirmation bénévole non envoyé lors d'inscription réelle sur le site

## Bug : Formulaire de don - 28/01/2026
- [x] Erreur de type sur le champ amount (expected string, received number)

## Bug : Worker Cloudflare - Formulaire de don - 28/01/2026
- [x] Corriger le schéma de validation amount dans le worker Cloudflare (production)

## Bug : Adresse d'expéditeur email - 28/01/2026
- [x] Corriger l'adresse d'expéditeur pour utiliser noreply@ftourbabrayan.ma au lieu de onboarding@resend.dev

## Corrections demandées - 28/01/2026
- [x] 1. Rendre la case "J'accepte les conditions" obligatoire sur le formulaire bénévole
- [x] 2. Afficher l'adresse exacte de l'association sur la page "devenir bénévole"
- [x] 3. Enlever le carré "collectés à ce jour" de la page dons (déjà absent)
- [x] 4. Remplacer le texte "adresse communiquée par email" par l'adresse exacte de l'association
- [x] 5. Corriger le bouton "s'inscrire" sur la page "voir le programme" (fonctionne correctement)
- [x] 6. Corriger le bouton "faire un don" sur la page "événement" (fonctionne correctement)
- [ ] 7. Corriger l'affichage des produits réservés qui disparaissent du catalogue même s'il reste du stock
- [ ] 8. Corriger l'affichage des produits commandés dans la liste des commandes

## Bugs 9-10 - 28/01/2026
- [ ] 9. Corriger l'affichage des commandes différent entre production (ftourbabrayan.ma) et dev (manus.im)
- [ ] 10. Corriger les envois d'emails qui ne fonctionnent pas sur production

## Correction envoi emails - 29/01/2026
- [ ] Corriger l'envoi d'email pour le formulaire goodies (comme bénévole)
- [ ] Corriger l'envoi d'email pour le formulaire contact (comme bénévole)
- [ ] Corriger l'envoi d'email pour le formulaire dons (comme bénévole)

## Module Réservation Ftour - 31/01/2026
### Phase 1 : Modèle de données
- [ ] Créer table restaurants (id, name, address, phone, active, created_at)
- [ ] Créer table restaurant_slots (id, restaurant_id, date, start_time, end_time, capacity)
- [ ] Créer table reservations (id, restaurant_id, date, slot_id, full_name, phone, email, seats, status, reference_code, qr_token, created_at)
- [ ] Créer table reservation_checkins (id, reservation_id, scanned_at, validation_mode, validated_by, created_at)

### Phase 2 : Backend et API
- [ ] Services Supabase pour restaurants et réservations
- [ ] Routes tRPC pour CRUD restaurants
- [ ] Routes tRPC pour créer/annuler réservations
- [ ] Routes tRPC pour check-in par QR/référence
- [ ] Validation anti-surbooking (capacité)

### Phase 3 : Page publique /reservation
- [ ] UI mobile-first avec étapes (date, restaurant, créneau, formulaire)
- [ ] Écran de confirmation avec référence unique
- [ ] Blocage si capacité atteinte

### Phase 4 : Dashboard admin /admin/reservations
- [ ] Vue liste avec filtres (date, restaurant, statut, créneau)
- [ ] Actions (confirmer, annuler, checked_in, no_show)
- [ ] Affichage capacités restantes
- [ ] Export CSV par jour et restaurant

### Phase 5 : Check-in QR /admin/scan-reservation
- [ ] Scanner QR avec caméra navigateur
- [ ] Validation automatique si statut et date OK
- [ ] Blocage doublons

### Phase 6 : Notifications
- [ ] Email confirmation au participant
- [ ] Email notification admin/restaurant
- [ ] Messages multilingues (FR/AR/AMZ/EN)

## Bugs Réservation - 31/01/2026
- [x] Bug: Places disponibles affiche 0 au lieu de la capacité réelle (corrigé - getAvailableSeatsSupabase retourne maintenant {available, total, reserved})
- [x] Ajouter "Restaurant Solidaire" au menu de navigation (ajouté avec traductions FR/EN/AR/AMZ)

## Modifications Ftour Solidaire - 31/01/2026
- [x] Renommer "Restaurant Solidaire" en "Ftour Solidaire" dans toutes les traductions (FR/EN/AR/AMZ)
- [x] Ajouter section admin pour gérer les réservations Ftour Solidaire (Réservations Ftour, Restaurants, Scanner Réservations)
- [x] Ajouter bloc "La Table du Jardin" sur la page /reservation avec:
  - Titre et description
  - Adresse, téléphone, horaires
  - Design olive/crème cohérent
- [x] Traduire le bloc "La Table du Jardin" dans les 4 langues (FR/EN/AR/AMZ)
- [x] Lien externe vers https://latabledujardin.ftourbabrayan.ma (nouvel onglet, rel="noopener noreferrer")


## Bug Confirmation Réservation - 31/01/2026
- [ ] Date affiche "Invalid Date" au lieu de la vraie date
- [ ] Restaurant n'affiche pas le nom
- [ ] Places n'affiche pas le nombre


## Module Livraison Goodies Solidaires - 31/01/2026
### Phase 1 : Correction bug confirmation réservation
- [ ] Corriger l'affichage de la date (Invalid Date)
- [ ] Corriger l'affichage du restaurant
- [ ] Corriger l'affichage des places

### Phase 2 : Modèle de données livraison
- [x] Ajouter champs à la table orders: delivery_mode, delivery_fee, delivery_address, delivery_phone, delivery_instructions, delivery_notes
- [x] Créer migration Drizzle pour les nouveaux champs (migration appliquée avec succès)

### Phase 3 : Choix mode de réception
- [ ] Ajouter section "Mode de réception" dans le checkout
- [ ] Options: Retrait sur place (défaut), Livraison à domicile
- [ ] Validation obligatoire du choix

### Phase 4 : Frais de livraison
- [ ] Ajouter frais de livraison fixes (30 MAD) si livraison sélectionnée
- [ ] Recalcul dynamique du total du panier
- [ ] Affichage clair: sous-total, frais, total

### Phase 5 : Formulaire adresse livraison
- [ ] Afficher uniquement si livraison sélectionnée
- [ ] Champs requis: adresse, ville, quartier, téléphone
- [ ] Champs optionnels: code postal, instructions
- [ ] Validation avant confirmation

### Phase 6 : Mise à jour panier et récapitulatif
- [ ] Afficher mode de réception dans le panier
- [ ] Afficher frais de livraison
- [ ] Afficher adresse de livraison (si applicable)
- [ ] Mention "Paiement sur place"

### Phase 7 : Dashboard admin
- [ ] Voir mode de réception pour chaque commande
- [ ] Voir adresse de livraison
- [ ] Filtres: retrait / livraison
- [ ] Export CSV avec infos livraison

### Phase 8 : Traductions multilingues
- [ ] Traduire "Mode de réception" (FR/EN/AR/AMZ)
- [ ] Traduire "Retrait sur place" (FR/EN/AR/AMZ)
- [ ] Traduire "Livraison à domicile" (FR/EN/AR/AMZ)
- [ ] Traduire "Frais de livraison" (FR/EN/AR/AMZ)
- [ ] Traduire formulaire adresse (FR/EN/AR/AMZ)


## Module Livraison Goodies - Phases restantes
- [ ] Créer une page AdminOrders pour afficher les commandes avec informations de livraison
- [ ] Ajouter les filtres pour les commandes (retrait/livraison)
- [ ] Créer une page d'export CSV avec les adresses de livraison
- [ ] Tester le module de livraison complet


## Bug Validation Email Réservation - 07/02/2026
- [x] Rendre l'email vraiment optionnel (vide = OK) - validation zod avec union et transform
- [x] Valider le format email si renseigné - regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/
- [x] Supprimer l'affichage des erreurs techniques brutes (JSON/regex) - affichage simple sous le champ
- [x] Afficher des messages d'erreur simples sous le champ email - message en rouge sous input
- [x] Ajouter traductions messages d'erreur (FR/EN/AR/AMZ) - 4 langues supportées
- [ ] Tester les 4 cas: email vide, email valide, email invalide, autres champs
- [ ] Tester sur mobile (Chrome/Android + Safari/iPhone)


## Bug Récapitulatif Réservation - 07/02/2026
- [x] Corriger l'affichage "Date invalide" dans le récapitulatif - formatDate retourne maintenant "—"
- [x] Afficher le nom du restaurant au lieu d'un champ vide - utilise fullReservation?.restaurant?.name
- [x] Afficher le nombre de places au lieu d'un champ vide - utilise fullReservation?.seats
- [x] Ajouter un endpoint GET /reservation/{reference} pour récupérer les détails - hook useQuery ajouté
- [x] Utiliser une source de vérité backend pour le récapitulatif - fullReservation comme source primaire
- [x] Ajouter fallback "—" pour les champs manquants - affichage sécurisé
- [ ] Tester le scénario complet: date+restaurant+places
- [ ] Tester refresh de page → récapitulatif correct
- [ ] Tester multilingüé → format date correct


## Module Paiement Unifié - Février 2026
### Phase 1 : Schéma de base de données
- [x] Créer table payments avec tous les champs requis
- [x] Ajouter table payment_logs pour la traçabilité
- [x] Ajouter table payment_methods pour la configuration des moyens
- [x] Créer migration Drizzle et appliquer (schéma ajouté, migration en attente)

### Phase 2 : Services backend
- [x] Service pour virement bancaire
- [x] Service pour chèque
- [x] Service pour cash
- [x] Service pour PayPal (intégration API - placeholder)
- [x] Tous les services implémentés dans supabase-services.ts

### Phase 3 : Routers tRPC
- [x] Router payments.create
- [x] Router payments.list (admin)
- [x] Router payments.getById
- [x] Router payments.validate (admin)
- [x] Router payments.cancel (admin)
- [x] Router payments.getByReference
- [x] Router payments.markChequeAsCashed
- [x] Router payments.getStats

### Phase 4 : Checkout
- [ ] Page checkout avec sélection moyen de paiement
- [ ] Affichage dynamique des instructions
- [ ] Intégration avec donations/goodies

### Phase 5 : Intégrations externes
- [ ] Intégration PayPal
- [ ] Intégration CIM
- [ ] Webhooks pour confirmations

### Phase 6 : Dashboard admin
- [ ] Liste des paiements avec filtres
- [ ] Actions de validation/annulation
- [ ] Détail complet d'un paiement
- [ ] Export CSV/Excel

### Phase 7 : Traductions
- [ ] Traductions FR/EN/AR/AMZ pour tous les textes
- [ ] Libellés, instructions, messages

### Phase 8 : Traçabilité
- [ ] Journalisation des actions admin
- [ ] Historique des changements de statut
- [ ] Audit trail complet

### Phase 9 : Tests et déploiement
- [ ] Tests unitaires des services
- [ ] Tests d'intégration checkout
- [ ] Tests des intégrations PayPal/CIM
- [ ] Checkpoint et déploiement


### Phase 4 : Checkout unifié
- [ ] Créer page Checkout.tsx avec sélection du moyen de paiement
- [ ] Ajouter formulaire pour chaque moyen (virement, chèque, cash, PayPal)
- [ ] Afficher instructions spécifiques dynamiquement
- [ ] Validation du formulaire
- [ ] Intégration avec mutations tRPC

### Phase 5 : Intégration PayPal
- [ ] Configurer credentials PayPal (client ID, secret)
- [ ] Implémenter création de paiement PayPal
- [ ] Ajouter webhook de confirmation
- [ ] Redirection sécurisée après paiement

### Phase 6 : Dashboard admin
- [ ] Créer page AdminPayments.tsx
- [ ] Afficher liste des paiements avec détails
- [ ] Ajouter filtres (statut, moyen, date)
- [ ] Implémenter actions (valider, annuler)
- [ ] Ajouter export CSV

### Phase 7 : Traductions multilingues
- [ ] Ajouter traductions checkout (FR/EN/AR/AMZ)
- [ ] Ajouter traductions dashboard (FR/EN/AR/AMZ)
- [ ] Ajouter traductions instructions paiement


## Bug Scroll Goodies - 07/02/2026
- [x] Scroll ne marche pas sur la page Goodies (Checkout) - ajout max-h-[90vh] overflow-y-auto au DialogContent


## Modifications Majeures - 07/02/2026

### Phase 1 : Page de confirmation Goodies (pickup vs livraison)
- [ ] Modifier la page de confirmation pour afficher 2 variantes selon delivery_mode
- [ ] Ajouter endpoint GET pour charger les données de commande par référence
- [ ] Variante pickup : conserver page actuelle avec "retrait sur place"
- [ ] Variante home_delivery : afficher adresse de livraison et prochaines étapes adaptées
- [ ] Afficher adresse formatée (adresse complète, ville, quartier, code postal, instructions)
- [ ] Ajouter traductions multilingues pour les deux variantes (FR/EN/AR/AMZ)
- [ ] Tester les 2 variantes et refresh de page

### Phase 2 : Harmoniser les méthodes de paiement sur tous les modules
- [ ] Créer une configuration centrale des méthodes de paiement
- [ ] Ajouter étape "Choix du moyen de paiement" dans Goodies, Ftour, Donations
- [ ] Proposer systématiquement : Cash, Virement, Chèque, PayPal
- [ ] Afficher instructions adaptées selon moyen choisi
- [ ] Ajouter traductions multilingues pour tous les moyens de paiement
- [ ] Mettre à jour le dashboard admin pour filtrer par méthode de paiement

### Phase 3 : Mettre à jour les emails transactionnels
- [ ] Identifier tous les emails envoyés (Goodies, Ftour, Donations, Admin)
- [ ] Rendre le contenu conditionnel basé sur : payment_method, payment_status, delivery_mode, module_type
- [ ] Mettre à jour emails Goodies (confirmation, statut)
- [ ] Mettre à jour emails Ftour (réservation, QR, annulation)
- [ ] Mettre à jour emails Donations (promesse, paiement reçu)
- [ ] Ajouter traductions multilingues pour tous les emails (FR/EN/AR/AMZ)
- [ ] Logger l'envoi des emails avec type, date, référence
- [ ] Tester chaque module avec chaque méthode de paiement


## Modifications Majeures - Février 2026
### Phase 1 : Page de confirmation Goodies (EN COURS)
- [x] Créer 2 variantes (pickup vs livraison) - composant GoodiesConfirmation.tsx créé
- [x] Afficher adresse de livraison si livraison
- [x] Afficher instructions de livraison
- [x] Afficher référence et montant
- [x] Ajouter traductions FR/EN (partiellement)
- [ ] Ajouter traductions AR/AMZ (manquent)
- [ ] Intégrer le composant dans la page Goodies.tsx
- [ ] Corriger les erreurs TypeScript restantes (paymentOnPlacePickupMessage, getByReference, AR/AMZ)

### Phase 2 : Harmoniser les méthodes de paiement (À FAIRE)
- [ ] Configuration centrale des moyens de paiement
- [ ] Proposer systématiquement sur tous les modules (Goodies, Ftour, Donations)
- [ ] Ajouter traductions multilingues

### Phase 3 : Mettre à jour tous les emails transactionnels (À FAIRE)
- [ ] Contenu conditionnel basé sur payment_method
- [ ] Contenu conditionnel basé sur payment_status
- [ ] Contenu conditionnel basé sur delivery_mode
- [ ] Contenu conditionnel basé sur module_type


## Phase 19 : Cahier des charges spécifique - Mise à jour globale (Février 2026)

### 1️⃣ Module Réservation Ftours
- [x] 1.1 Supprimer complètement l'affichage de la capacité restante sur la page de réservation
- [x] 1.2 Changer le thème du formulaire : blanc crémeux → noir/marron (meilleure lisibilité)
- [x] 1.3 Rendre le champ email obligatoire
- [x] 1.4 Limiter la sélection à 10 places maximum
- [x] 1.5 Afficher popup bloquante si > 10 places : "Merci de prendre contact avec nous pour les réservations de groupe supérieur à 10."
- [ ] 1.6 Popup contient bouton "Contact" qui redirige vers page Contact (utilise toast actuellement)
- [x] 1.7 Inverser l'ordre des blocs : "La Table du Jardin" en haut, formulaire en bas

### 2️⃣ Dashboard - Scanners & Restaurants
- [ ] 2.1 Créer 3 pages scanner sans authentification (protégées par URL + QR code)
  - [ ] 2.1.1 Scanner Goodies
  - [ ] 2.1.2 Scanner Ftours
  - [ ] 2.1.3 Scanner Bénévoles
- [ ] 2.2 Générer QR code dédié pour chaque scanner
- [ ] 2.3 QR affiché sur la page du scanner elle-même
- [ ] 2.4 Renommer restaurant existant en "La Table du Jardin"
- [ ] 2.5 Ajouter second restaurant : "Restaurant Corpo"
- [x] 2.6 Fixer capacité maximale : 50 places pour chacun

### 3️⃣ Module Bénévoles
- [x] 3.1 Augmenter capacité maximale à 100 bénévoles par jour
- [x] 3.2 Ajouter deux créneaux non exclusifs :
  - [x] 3.2.1 "Créneaux Préparation : 15h30 à 16h45"
  - [x] 3.2.2 "Créneaux Service : 17h00 à 19h15"
- [ ] 3.3 Bénévole peut choisir l'un ou les deux créneaux (UI à créer)
- [x] 3.4 Ajouter mention "Sac non autorisé" dans l'encadré information

### 4️⃣ Page Événement
- [x] 4.1 Supprimer complètement l'encadré "Rangement" (déjà absent)

### 5️⃣ Modifications globales
- [x] 5.1 Remplacer partout "Ftour solidaire" → "Restaurant Solidaire"
- [ ] 5.2 Dupliquer module Goodies
- [ ] 5.3 Créer nouveau module "Produits du terroir"
- [ ] 5.4 Ajouter encadré de mise en avant sur page d'accueil
- [ ] 5.5 Remplacer lien "Réservation entreprise" par "La Table du Jardin – Restaurant Solidaire"
- [ ] 5.6 Ce lien redirige vers module de réservation Ftour (grand public)

### 6️⃣ Module Réservation Entreprise (refonte complète)
- [ ] 6.1 Supprimer totalement la page de paiement
- [ ] 6.2 À la soumission du formulaire entreprise :
  - [ ] 6.2.1 Envoyer email automatique à entreprise@ftourbabrayan.ma
  - [ ] 6.2.2 Afficher page de remerciement (pas de paiement)
- [ ] 6.3 Email récapitulatif entreprise contient :
  - [ ] 6.3.1 Récapitulatif de la demande
  - [ ] 6.3.2 QR code unique "chargé" du nombre de places réservées
- [ ] 6.4 Règle QR "chargé" :
  - [ ] 6.4.1 QR scannable N fois (N = nombre de places)
  - [ ] 6.4.2 Chaque scan décrémente le compteur
  - [ ] 6.4.3 Une fois quota atteint → scan refusé
- [ ] 6.5 Dashboard admin - Section "Réservations Entreprise" :
  - [ ] 6.5.1 Voir les demandes
  - [ ] 6.5.2 Accepter une réservation (déclenche envoi email avec QR chargé)
  - [ ] 6.5.3 Gérer les statuts et détails
  - [ ] 6.5.4 Mêmes options que module Réservation Ftour particulier


## Phase 22 : Refactorisation Module Particuliers (Formulaire minimaliste événementiel)

- [ ] 22.1 Supprimer champ Heure (fixé en dur à 18h45)
- [ ] 22.2 Supprimer champ Espace (attribué automatiquement côté admin)
- [ ] 22.3 Supprimer Récapitulatif prix et logique CMI
- [ ] 22.4 Implémenter calendrier bloqué (20 février - 13 mars uniquement)
- [ ] 22.5 Limiter places à 12 maximum (au lieu de 10)
- [ ] 22.6 Simplifier formulaire (Date, Places, Nom, Tél, Email uniquement)
- [ ] 22.7 Mettre à jour texte intro : "Demande de réservation pour le ftour solidaire. Service unique à partir de 18h45."
- [ ] 22.8 Mettre à jour bouton CTA : "Envoyer ma demande" (au lieu de "Confirmer ma réservation")
- [ ] 22.9 Tester le formulaire minimaliste
- [ ] 22.10 Synchroniser traductions i18n (FR uniquement)


## Dashboard Module Fixes (Feb 12, 2026)
- [ ] Fix AdminCompanyBookings.tsx — 8 TS errors (types incompatibles, .data property)
- [ ] Fix AdminRestaurantReservations.tsx — 2 TS errors (invalid status values)
- [ ] Fix BuyPastry.tsx — 5 TS errors (getById missing, types, translations)
- [ ] Fix Pastries.tsx — 2 TS errors (missing translation keys)
- [ ] Fix BuyGoodie.tsx — TS errors (type mismatch)
- [ ] Fix PastriesConfirmation.tsx — TS errors (type mismatch)
- [ ] Fix AdminScanProduct.tsx — TS errors
- [ ] Fix Home.tsx — 2 TS errors (missing translation keys)
- [ ] Fix i18n translations — en.ts, ar.ts, amz.ts missing keys

## Dashboard Validation & New Features (Feb 12, 2026)
- [ ] Audit fonctionnel de chaque module dashboard admin
- [ ] Corriger modules défaillants identifiés
- [ ] Tester formulaires réservation (Particulier/Entreprise/Groupe)
- [x] Consolider Scanner en module unique multi-types
- [x] Compléter module Messages (/admin/messages)
- [ ] Validation finale et checkpoint

## Dashboard Admin — Modules Complets (Feb 12, 2026)
- [x] AdminPayments: Remplacer mock data par tRPC réel (payments.list/validate/cancel/markChequeAsCashed/getStats)
- [x] AdminPayments: Filtres (statut, méthode, date, recherche), détail panel, export CSV
- [x] AdminContenu: Créer content-router.ts avec CRUD tRPC pour Partners, Testimonials, FAQ
- [x] AdminContenu: Ajouter services Supabase CRUD (create/update/delete/toggleActive) pour 3 sections
- [x] AdminContenu: Remplacer état local par tRPC réel (content.partners/testimonials/faq)
- [x] AdminContenu: Formulaire création/édition, toggle actif/inactif, recherche, suppression
- [x] Enregistrer contentRouter dans appRouterUpdated
- [x] pnpm build réussi (0 erreurs TypeScript)

## Phase 23 : Scanner Unifié + Tests E2E (Feb 12, 2026)
- [x] Auditer les scanners existants et types de QR codes
- [x] Créer scanner unifié à /scanner avec détection automatique du type de QR
- [x] Supporter les types : bénévole, réservation, goodies, pâtisserie, terroir
- [x] UI de validation adaptée selon le type détecté
- [x] Tester workflow E2E : inscription bénévole → email → QR → scan → validation admin
- [x] Tester workflow E2E : réservation particulier → admin confirmation
- [x] Tester workflow E2E : commande goodies → admin gestion
- [x] Tester workflow E2E : promesse de don → admin confirmation
- [x] Corriger les problèmes identifiés (isRead → is_read dans messages)
- [x] Build réussi + checkpoint
