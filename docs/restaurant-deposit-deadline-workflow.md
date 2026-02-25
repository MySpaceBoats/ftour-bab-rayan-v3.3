# Workflow acompte 48h — réservations restaurant

## Création de réservation

À la création (`createRestaurantReservation`):

- `deposit_deadline` est calculé à `now + 48h`
- `deposit_status` est initialisé à `pending`

## Annulation automatique

Stratégie implémentée: **vérification au chargement admin**.

- Les endpoints admin de listing (`adminListParticuliers`, `adminListGroupes`, `adminListEntreprises`) déclenchent `autoCancelExpiredPendingDeposits()`.
- Une réservation est auto-annulée si:
  - `deposit_status = 'pending'`
  - `deposit_deadline < now`
  - `status` est dans `pending_validation | pending_confirmation | validated_pending_payment`
- Actions appliquées:
  - `status = 'cancelled_auto'`
  - `deposit_status = 'expired'`
  - trace dans `notes` et log serveur
  - envoi d'un email d'annulation automatique au client

## Timezone

La date limite affichée dans les emails est formatée avec `Africa/Casablanca` via `formatCasablancaDateTimeLong`.

## Non-régression

- Les réservations payées (`deposit_status = 'paid'`) ne sont pas annulées.
- Les statuts confirmés (`paid_confirmed`, etc.) ne sont pas concernés par la condition d'auto-annulation.
