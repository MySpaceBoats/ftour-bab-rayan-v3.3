# Plan de corrections (ordre des PR)

## PR1 — Stabilisation routes + RBAC + anti-liens morts ✅
- Aligner dashboard vers `/admin/reservations`, `/admin/commerce`, `/admin/ops/jours`, `/scanner`.
- Garder redirect legacy `/admin/jours`.
- Vérifier permissions de navigation.

## PR2 — Backoffice API contract unifié ✅
- Ajouter endpoints manquants côté `backoffice.*` utilisés par le front:
  - `reservations.confirm/reject/markPaid/delete`
  - `commerce.listProducts/listOrders/updateStock/toggleProduct/deleteProduct/updateOrderStatus`
  - `dons.confirm/generateReceipt/delete/export`
  - `benevoles.confirm/generateQR/markPresent/cancel`
- Brancher sur DB réelle (Supabase) et supprimer TODO bloquants.

## PR3 — Messages admin complets ✅
- `mark as read` persistant en DB (plus local-only).
- suppression super_admin côté API + UI.

## PR4 — Scanner multi-entités (à livrer ensuite)
- Unifier lookup token vers réservation + goodies + terroir + pâtisserie + bénévole.
- Ajouter action de validation contextualisée par type.

## PR5 — QA E2E + hardening
- Parcours bout-en-bout par module (création front → visibilité admin → action → vérification DB).
- Captures d’écran et checklist de non-régression.
