# Phases 3-6 : Harmonisation Paiements & Intégration PayPal

## Phase 3 : Harmoniser les méthodes de paiement
- [ ] Créer composant `PaymentMethodSelector.tsx` réutilisable
- [ ] Ajouter traductions pour les méthodes de paiement (FR, EN, AR, AMZ)
- [ ] Intégrer dans Goodies.tsx
- [ ] Intégrer dans Donations.tsx
- [ ] Intégrer dans Reservations.tsx
- [ ] Tester les 4 langues

## Phase 4 : Emails transactionnels conditionnels
- [ ] Créer template email Goodies (pickup)
- [ ] Créer template email Goodies (home delivery)
- [ ] Créer template email Donations
- [ ] Créer template email Reservations
- [ ] Ajouter fonction `sendTransactionalEmail` au router
- [ ] Tester envoi emails avec contenu dynamique

## Phase 5 : Dashboard AdminPayments
- [ ] Créer page `AdminPayments.tsx`
- [ ] Ajouter router `admin.payments.list`
- [ ] Implémenter filtres (date, statut, module)
- [ ] Ajouter export CSV
- [ ] Ajouter pagination
- [ ] Ajouter statistiques (total, par module, par statut)
- [ ] Tester avec données de test

## Phase 6 : Intégration PayPal
- [ ] Ajouter PayPal SDK au template
- [ ] Créer composant `PayPalButton.tsx`
- [ ] Implémenter webhook PayPal
- [ ] Ajouter router `payments.paypal.create`
- [ ] Ajouter router `payments.paypal.webhook`
- [ ] Tester flux complet PayPal
- [ ] Gérer les erreurs et cas limites

## Statut Global
- [x] Phase 1 : Corrections TypeScript
- [x] Phase 2 : GoodiesConfirmation
- [ ] Phase 3 : Harmonisation paiements
- [ ] Phase 4 : Emails transactionnels
- [ ] Phase 5 : Dashboard AdminPayments
- [ ] Phase 6 : Intégration PayPal
