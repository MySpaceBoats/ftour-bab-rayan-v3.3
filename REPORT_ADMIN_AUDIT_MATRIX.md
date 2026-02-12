# Inventory + Matrix — Dashboard Admin Ftour Bab Rayan

## Légende
- **OK**: route existe + données réelles + actions métiers + statuts + RBAC.
- **PARTIEL**: route existe mais couverture DoD incomplète.
- **ORPHELIN**: lien dashboard qui ne couvre pas le module cible ou pointait vers un flux obsolète.

## Matrix (module → routes → pages → DB/API → actions → statuts → RBAC)

| Module | Routes | Page/Composant | Source DB/API | Actions métiers | Statuts | RBAC | État |
|---|---|---|---|---|---|---|---|
| Réservations globales | `/admin/reservations` + `?type=particulier|entreprise|groupe` | `AdminReservationsPage` | `trpc.backoffice.reservations.*` + table `reservations` | confirmer, refuser, marquer payé, supprimer, détail | pending_validation / confirmed / rejected / cancelled | `admin* restaurant` + admin/super_admin | **OK** |
| Commerce global | `/admin/commerce` + `?type=goodies|terroir|patisserie` | `AdminCommercePage` | `trpc.backoffice.commerce.*` + goodies/orders/pastry_orders | activer/désactiver, stock, suppression, update status commandes | active/inactive + pending/confirmed/delivered/cancelled | `admin_boutique/admin_patisserie/admin_terroir` | **PARTIEL** (pâtisserie produits en cours de normalisation stock) |
| Dons | `/admin/dons` | `AdminDonsPage` | `trpc.backoffice.dons.*` + donations | confirmer reçu, générer reçu, export CSV, suppression | promised/received (+ mapping UI) | admin_dons + suppression super_admin | **OK** |
| Bénévoles | `/admin/benevoles` | `AdminBenevolePage` | `trpc.backoffice.benevoles.*` + volunteers | confirmer, générer QR, marquer présent, annuler | pending/confirmed/cancelled/present | admin_ops/admin/super_admin | **OK** |
| Ops/Jours | `/admin/ops/jours` (legacy `/admin/jours` redirect) | `AdminJours` | `trpc.days.*` + ramadan_days | créer, bulk créer, ouvrir/fermer, modifier, supprimer | isOpen | super_admin | **OK** |
| Scanner unique | `/scanner` | `Scanner` | `trpc.volunteers.checkIn` | scanner/validation | valid/invalid/already scanned (volunteers) | scanner/admin_ops/admin/super_admin | **PARTIEL** (multi-entités à unifier) |
| Messages | `/admin/messages` | `AdminMessages` | `trpc.contact.list/markRead/delete` + contact_messages | détail, marquer lu, exporter CSV, supprimer (super_admin) | lu/non lu | admin list, super_admin delete | **OK** |
| Contenu | `/admin/contenu` | `AdminContenu` | CMS/API projet | CRUD FAQ + partenaires | actif/inactif | super_admin | **PARTIEL** (à valider exhaustivement sur environnement seedé) |

## Routes dashboard vérifiées
- Modules dashboard mis à jour vers routes consolidées: réservations, commerce, scanner unique, calendrier ops. Liens orphelins retirés du point d’entrée dashboard.
