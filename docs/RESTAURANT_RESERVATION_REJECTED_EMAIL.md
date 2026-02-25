# Email transactionnel restaurant — Réservation non disponible

## Quand cet email est envoyé

L'email **"Réservation non disponible"** est envoyé automatiquement au client quand la réservation passe au statut `refused`:

1. via l'action admin `restaurantReservations.refuse` (refus explicite),
2. via l'action admin générique `restaurantReservations.adminUpdateStatus` quand le statut est mis à `refused`.

## Template utilisé

Fonction serveur: `generateRestaurantReservationRejectedEmail` dans `server/email.ts`.

Cette fonction retourne:

- `subject`
- `html` (bulletproof table layout + CSS inline)
- `text` (version texte)

Le header est olive `#556B2F` et le footer reste aligné avec les autres emails existants.

## Variables attendues

- `firstName` (obligatoire)
- `brandName` (optionnel, défaut: `La Table du Jardin`)
- `reference` (optionnel)
- `reservationDateLong` (obligatoire)
- `reservationTime` (optionnel)
- `partySize` (obligatoire)
- `rejectionReason` (optionnel, bloc “Pourquoi ?” masqué si absent)
- `rescheduleUrl` (optionnel, bouton principal masqué si absent)
- `contactEmail` (obligatoire)
- `contactPhone` (obligatoire)
- `footerLines` (optionnel)

## Preview dev

Script de génération de previews:

```bash
pnpm tsx scripts/preview-restaurant-reservation-rejected-email.ts
```

Fichiers générés:

- `previews/restaurant/reservation-rejected.with-reason.html`
- `previews/restaurant/reservation-rejected.with-reason.txt`
- `previews/restaurant/reservation-rejected.no-reason.html`
- `previews/restaurant/reservation-rejected.no-reason.txt`

Les 2 cas sont couverts:

- avec `rejectionReason` + `rescheduleUrl`
- sans `rejectionReason` + sans `rescheduleUrl`
