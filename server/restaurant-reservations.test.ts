import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as reservationServices from './restaurant-reservation-services';
import { sendEmail } from './email';

// Mock sendEmail
vi.mock('./email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

describe('Restaurant Reservations Workflow', () => {
  let reservationId: number;
  let reference: string;

  describe('Particulier Reservation Flow', () => {
    it('should create a particulier reservation with pending_validation status', async () => {
      const reservation = await reservationServices.createRestaurantReservation({
        reference: 'RES-P-TEST001',
        type: 'particulier',
        name: 'Jean Dupont',
        email: 'jean@example.com',
        phone: '+212612345678',
        date: new Date('2026-02-20'),
        seatsTotal: 4,
        qrToken: 'test-qr-token-001',
        displayChoice: 'jardin',
      });

      expect(reservation).toBeDefined();
      expect(reservation?.reference).toBe('RES-P-TEST001');
      expect(reservation?.type).toBe('particulier');
      expect(reservation?.status).toBe('pending_validation');
      expect(reservation?.paymentStatus).toBe('not_requested');
      expect(reservation?.qrStatus).toBe('inactive');

      reservationId = reservation?.id || 0;
      reference = reservation?.reference || '';
    });

    it('should retrieve reservation by reference', async () => {
      const reservation = await reservationServices.getRestaurantReservationByReference(reference);
      
      expect(reservation).toBeDefined();
      expect(reservation?.reference).toBe(reference);
      expect(reservation?.name).toBe('Jean Dupont');
      expect(reservation?.email).toBe('jean@example.com');
    });

    it('should update reservation status to validated_pending_payment', async () => {
      const updated = await reservationServices.updateRestaurantReservationStatus(
        reservationId,
        'validated_pending_payment'
      );

      expect(updated?.status).toBe('validated_pending_payment');
    });

    it('should update payment status to pending_payment', async () => {
      const updated = await reservationServices.updateRestaurantReservationPaymentStatus(
        reservationId,
        'pending_payment'
      );

      expect(updated?.paymentStatus).toBe('pending_payment');
    });

    it('should activate QR code', async () => {
      const updated = await reservationServices.activateQrCode(reservationId);

      expect(updated?.qrStatus).toBe('active');
      expect(updated?.status).toBe('paid_confirmed');
      expect(updated?.paymentStatus).toBe('paid');
    });
  });

  describe('Entreprise Reservation Flow', () => {
    let entrepriseReservationId: number;

    it('should create an entreprise reservation', async () => {
      const reservation = await reservationServices.createRestaurantReservation({
        reference: 'RES-E-TEST001',
        type: 'entreprise',
        name: 'Marie Martin',
        email: 'marie@company.com',
        phone: '+212612345679',
        date: new Date('2026-03-01'),
        seatsTotal: 50,
        qrToken: 'test-qr-token-002',
        displayChoice: 'brasserie',
        companyName: 'Tech Solutions SA',
        notes: 'Team building event',
      });

      expect(reservation?.type).toBe('entreprise');
      expect(reservation?.companyName).toBe('Tech Solutions SA');
      expect(reservation?.seatsTotal).toBe(50);

      entrepriseReservationId = reservation?.id || 0;
    });

    it('should refuse an entreprise reservation', async () => {
      const updated = await reservationServices.updateRestaurantReservationStatus(
        entrepriseReservationId,
        'refused'
      );

      expect(updated?.status).toBe('refused');
    });
  });

  describe('Groupe Reservation Flow', () => {
    it('should create a groupe reservation', async () => {
      const reservation = await reservationServices.createRestaurantReservation({
        reference: 'RES-G-TEST001',
        type: 'groupe',
        name: 'Ahmed Bennani',
        email: 'ahmed@group.com',
        phone: '+212612345680',
        date: new Date('2026-02-28'),
        seatsTotal: 20,
        qrToken: 'test-qr-token-003',
        displayChoice: 'jardin',
        groupName: 'Association Culturelle',
        groupType: 'association',
      });

      expect(reservation?.type).toBe('groupe');
      expect(reservation?.groupName).toBe('Association Culturelle');
      expect(reservation?.seatsTotal).toBe(20);
    });
  });

  describe('Reservation Cancellation', () => {
    it('should cancel a reservation', async () => {
      const reservation = await reservationServices.createRestaurantReservation({
        reference: 'RES-P-CANCEL',
        type: 'particulier',
        name: 'Test Cancel',
        email: 'cancel@example.com',
        phone: '+212612345681',
        date: new Date('2026-02-25'),
        seatsTotal: 2,
        qrToken: 'test-qr-token-cancel',
      });

      const cancelled = await reservationServices.cancelRestaurantReservation(
        reservation?.id || 0
      );

      expect(cancelled?.status).toBe('cancelled');
    });
  });

  describe('QR Code Management', () => {
    it('should mark QR code as used', async () => {
      const reservation = await reservationServices.createRestaurantReservation({
        reference: 'RES-P-QR-TEST',
        type: 'particulier',
        name: 'QR Test',
        email: 'qr@example.com',
        phone: '+212612345682',
        date: new Date('2026-03-05'),
        seatsTotal: 3,
        qrToken: 'test-qr-token-special',
      });

      const qrToken = reservation?.qrToken || '';
      const marked = await reservationServices.markQrCodeAsUsed(qrToken);

      expect(marked?.qrStatus).toBe('used');
    });
  });

  describe('List Reservations', () => {
    it('should list all reservations', async () => {
      const reservations = await reservationServices.listRestaurantReservations({
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(reservations)).toBe(true);
      expect(reservations.length).toBeGreaterThan(0);
    });
  });
});
