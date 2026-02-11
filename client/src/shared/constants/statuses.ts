// ============================================
// STATUTS MÉTIERS — Source unique de vérité
// ============================================
// Tous les statuts transactionnels, paiement, QR
// sont définis ici avec leurs labels i18n.
// ============================================

/**
 * 6.1 Status transactionnel (réservations / commandes)
 */
export const TRANSACTION_STATUS = {
  SUBMITTED: 'submitted',
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  PAID: 'paid',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
} as const;

export type TransactionStatus = (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

/**
 * 6.2 Paiement
 */
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/**
 * 6.3 QR
 */
export const QR_STATUS = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  USED: 'used',
  REVOKED: 'revoked',
} as const;

export type QrStatus = (typeof QR_STATUS)[keyof typeof QR_STATUS];

// ============================================
// MAPPING: status → variant (pour StatusBadge)
// ============================================

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';

export const TRANSACTION_STATUS_VARIANT: Record<TransactionStatus, BadgeVariant> = {
  [TRANSACTION_STATUS.SUBMITTED]: 'info',
  [TRANSACTION_STATUS.PENDING_CONFIRMATION]: 'warning',
  [TRANSACTION_STATUS.CONFIRMED]: 'success',
  [TRANSACTION_STATUS.PAID]: 'success',
  [TRANSACTION_STATUS.READY]: 'info',
  [TRANSACTION_STATUS.COMPLETED]: 'default',
  [TRANSACTION_STATUS.CANCELLED]: 'danger',
  [TRANSACTION_STATUS.REJECTED]: 'danger',
};

export const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, BadgeVariant> = {
  [PAYMENT_STATUS.PENDING]: 'warning',
  [PAYMENT_STATUS.PAID]: 'success',
  [PAYMENT_STATUS.FAILED]: 'danger',
  [PAYMENT_STATUS.REFUNDED]: 'secondary',
};

export const QR_STATUS_VARIANT: Record<QrStatus, BadgeVariant> = {
  [QR_STATUS.INACTIVE]: 'secondary',
  [QR_STATUS.ACTIVE]: 'success',
  [QR_STATUS.USED]: 'default',
  [QR_STATUS.REVOKED]: 'danger',
};

// ============================================
// LABELS FR (fallback — i18n devrait surcharger)
// ============================================

export const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  [TRANSACTION_STATUS.SUBMITTED]: 'Soumis',
  [TRANSACTION_STATUS.PENDING_CONFIRMATION]: 'En attente de confirmation',
  [TRANSACTION_STATUS.CONFIRMED]: 'Confirmé',
  [TRANSACTION_STATUS.PAID]: 'Payé',
  [TRANSACTION_STATUS.READY]: 'Prêt',
  [TRANSACTION_STATUS.COMPLETED]: 'Terminé',
  [TRANSACTION_STATUS.CANCELLED]: 'Annulé',
  [TRANSACTION_STATUS.REJECTED]: 'Rejeté',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  [PAYMENT_STATUS.PENDING]: 'En attente',
  [PAYMENT_STATUS.PAID]: 'Payé',
  [PAYMENT_STATUS.FAILED]: 'Échoué',
  [PAYMENT_STATUS.REFUNDED]: 'Remboursé',
};

export const QR_STATUS_LABEL: Record<QrStatus, string> = {
  [QR_STATUS.INACTIVE]: 'Inactif',
  [QR_STATUS.ACTIVE]: 'Actif',
  [QR_STATUS.USED]: 'Utilisé',
  [QR_STATUS.REVOKED]: 'Révoqué',
};

// ============================================
// LEGACY MAPPING — Bridge vers les statuts existants DB
// ============================================
// Les statuts DB actuels ne correspondent pas exactement
// aux statuts normalisés. Ces maps permettent la transition.
// ============================================

/** Map les statuts de réservation restaurant vers les statuts normalisés */
export const RESTAURANT_STATUS_MAP: Record<string, TransactionStatus> = {
  submitted: TRANSACTION_STATUS.SUBMITTED,
  pending_confirmation: TRANSACTION_STATUS.PENDING_CONFIRMATION,
  confirmed: TRANSACTION_STATUS.CONFIRMED,
  rejected: TRANSACTION_STATUS.REJECTED,
  cancelled: TRANSACTION_STATUS.CANCELLED,
  completed: TRANSACTION_STATUS.COMPLETED,
  no_show: TRANSACTION_STATUS.CANCELLED,
};

/** Map les statuts de commande goodies vers les statuts normalisés */
export const ORDER_STATUS_MAP: Record<string, TransactionStatus> = {
  reserved: TRANSACTION_STATUS.SUBMITTED,
  pending: TRANSACTION_STATUS.PENDING_CONFIRMATION,
  confirmed: TRANSACTION_STATUS.CONFIRMED,
  delivered: TRANSACTION_STATUS.COMPLETED,
  cancelled: TRANSACTION_STATUS.CANCELLED,
};

/** Map les statuts de paiement DB vers les statuts normalisés */
export const PAYMENT_DB_STATUS_MAP: Record<string, PaymentStatus> = {
  pending: PAYMENT_STATUS.PENDING,
  processing: PAYMENT_STATUS.PENDING,
  paid: PAYMENT_STATUS.PAID,
  confirmed: PAYMENT_STATUS.PAID,
  cashed: PAYMENT_STATUS.PAID,
  failed: PAYMENT_STATUS.FAILED,
  cancelled: PAYMENT_STATUS.FAILED,
  refunded: PAYMENT_STATUS.REFUNDED,
  not_applicable: PAYMENT_STATUS.PENDING,
};
