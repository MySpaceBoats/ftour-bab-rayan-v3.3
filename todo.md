# Ftour Bab Rayan - TODO

## Phase 1 : Base de données et Authentification
- [x] Schéma de base de données complet (users, volunteers, days, goodies, orders, donations)
- [x] Système de rôles multi-niveaux (super_admin, admin_ops, admin_boutique, admin_dons, scanner)
- [x] Middleware de contrôle d'accès basé sur les rôles

## Phase 2 : Module Bénévoles
- [x] Table des jours Ramadan avec capacité maximale
- [x] Formulaire d'inscription bénévole
- [x] Génération automatique de QR code unique par inscription
- [ ] Envoi d'email de confirmation avec QR code et consignes
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
- [ ] Email de confirmation avec référence commande

## Phase 6 : Back-office Goodies
- [x] Liste des commandes
- [x] Gestion des statuts (Réservé/Remis/Payé/Annulé)
- [x] Export comptable CSV

## Phase 7 : Module Promesses de Dons
- [x] Formulaire promesse de don
- [x] Choix mode paiement (virement/sur place)
- [ ] Email automatique avec instructions RIB
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
- [ ] Tester la connexion en production
