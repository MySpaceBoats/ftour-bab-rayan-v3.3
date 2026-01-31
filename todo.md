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
