# QA E2E — Dashboard Admin Ftour Bab Rayan

## Pré-requis
- [ ] Variables Supabase configurées (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Compte admin + super_admin disponibles
- [ ] `pnpm install` exécuté

## 1) Réservations globales
- [ ] Créer une réservation depuis le front public (particulier/entreprise/groupe)
- [ ] Vérifier apparition dans `/admin/reservations`
- [ ] Filtrer par `type`, `status`, `payment`, `date`, `search`
- [ ] Ouvrir détail et vérifier données contact/date/statut
- [ ] Action **Confirmer** puis vérifier statut en DB
- [ ] Action **Refuser** puis vérifier statut en DB
- [ ] Action **Marquer payé** puis vérifier `payment_status` en DB
- [ ] Action **Supprimer** puis vérifier suppression en DB

## 2) Commerce global
- [ ] Vérifier produits dans `/admin/commerce?tab=products`
- [ ] Filtrer par type (goodies/terroir/patisserie)
- [ ] Action **Activer/Désactiver** produit
- [ ] Action **Ajuster stock**
- [ ] Action **Supprimer produit** (si autorisé)
- [ ] Créer une commande publique puis vérifier `/admin/commerce?tab=orders`
- [ ] Action **Confirmer** commande, vérifier DB
- [ ] Action **Livrer** commande, vérifier DB

## 3) Dons
- [ ] Créer un don public
- [ ] Vérifier apparition dans `/admin/dons`
- [ ] Filtrer par statut/reçu/recherche
- [ ] Action **Confirmer reçu**
- [ ] Action **Générer reçu**
- [ ] Action **Exporter CSV**
- [ ] Action **Supprimer** (super_admin uniquement)

## 4) Bénévoles
- [ ] S’inscrire comme bénévole côté front
- [ ] Vérifier apparition dans `/admin/benevoles`
- [ ] Action **Confirmer**
- [ ] Action **Générer QR**
- [ ] Action **Marquer présent**
- [ ] Action **Annuler**

## 5) Ops / Jours
- [ ] Ouvrir `/admin/ops/jours`
- [ ] Créer un jour
- [ ] Créer des jours en masse
- [ ] Ouvrir/Fermer un jour
- [ ] Modifier capacité et horaires
- [ ] Supprimer un jour

## 6) Scanner
- [ ] Ouvrir `/scanner` avec rôle autorisé
- [ ] Scanner un QR bénévole valide
- [ ] Vérifier message succès et présence DB
- [ ] Scanner un QR invalide et vérifier erreur UI

## 7) Messages
- [ ] Envoyer message via formulaire contact public
- [ ] Vérifier apparition dans `/admin/messages`
- [ ] Ouvrir détail
- [ ] Action **Marquer lu** et vérifier `is_read` DB
- [ ] Export CSV messages
- [ ] Suppression message (super_admin)

## 8) Contenu
- [ ] CRUD FAQ
- [ ] CRUD Partenaires
- [ ] Activer / désactiver

## Non-régression build
- [ ] `pnpm build` passe sans erreur bloquante
