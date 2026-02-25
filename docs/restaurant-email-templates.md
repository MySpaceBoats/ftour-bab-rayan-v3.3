# Templates emails — Réservations restaurant

Les nouveaux templates transactionnels restaurant sont définis dans `server/email.ts`:

- `generateRestaurantReservationDepositRequiredEmail`
- `generateRestaurantReservationConfirmedEmail`

## Branding / Couleurs

Les valeurs par défaut sont centralisées dans `RESTAURANT_DEFAULT_BRANDING`.

Variables principales:

- `headerColor` (olive par défaut: `#556B2F`)
- `brandName` (par défaut: `La Table du Jardin`)
- `ribUrl`
- `contactEmail` / `contactPhone`
- `addressLines` et `footerLines`

## Prévisualisation locale

Générer des snapshots HTML/TXT:

```bash
pnpm preview:restaurant-emails
```

Fichiers générés:

- `tmp/email-previews/reservation-deposit-required.html`
- `tmp/email-previews/reservation-deposit-required.txt`
- `tmp/email-previews/reservation-confirmed.html`
- `tmp/email-previews/reservation-confirmed.txt`


## Variables acompte (Email #1)

Le template `generateRestaurantReservationDepositRequiredEmail` expose désormais:

- `depositPercent`
- `depositAmount`
- `estimatedTotal`
- `depositDeadlineFormatted` (date limite de paiement formatée côté backend, timezone `Africa/Casablanca`)

Texte ajouté dans la version HTML et TXT:

- délai de 48h pour verser l'acompte
- annulation automatique en absence de versement
