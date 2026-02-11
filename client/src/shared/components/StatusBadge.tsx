import { Badge } from "@/components/ui/badge";
import {
  type BadgeVariant,
  type TransactionStatus,
  type PaymentStatus,
  type QrStatus,
  TRANSACTION_STATUS_VARIANT,
  TRANSACTION_STATUS_LABEL,
  PAYMENT_STATUS_VARIANT,
  PAYMENT_STATUS_LABEL,
  QR_STATUS_VARIANT,
  QR_STATUS_LABEL,
} from "@/shared/constants/statuses";

// ============================================
// StatusBadge — Composant unique pour tous les statuts
// ============================================

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-800 border-gray-200",
  success: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  danger: "bg-red-100 text-red-800 border-red-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
  secondary: "bg-gray-50 text-gray-600 border-gray-100",
};

interface StatusBadgeProps {
  /** Le type de statut à afficher */
  type: "transaction" | "payment" | "qr";
  /** La valeur du statut */
  status: string;
  /** Label custom (surcharge le label par défaut) */
  label?: string;
  /** Classes CSS supplémentaires */
  className?: string;
}

export function StatusBadge({ type, status, label, className }: StatusBadgeProps) {
  let variant: BadgeVariant = "default";
  let displayLabel = label ?? status;

  switch (type) {
    case "transaction": {
      const s = status as TransactionStatus;
      variant = TRANSACTION_STATUS_VARIANT[s] ?? "default";
      displayLabel = label ?? TRANSACTION_STATUS_LABEL[s] ?? status;
      break;
    }
    case "payment": {
      const s = status as PaymentStatus;
      variant = PAYMENT_STATUS_VARIANT[s] ?? "default";
      displayLabel = label ?? PAYMENT_STATUS_LABEL[s] ?? status;
      break;
    }
    case "qr": {
      const s = status as QrStatus;
      variant = QR_STATUS_VARIANT[s] ?? "default";
      displayLabel = label ?? QR_STATUS_LABEL[s] ?? status;
      break;
    }
  }

  return (
    <Badge variant="outline" className={`${VARIANT_CLASSES[variant]} ${className ?? ""}`}>
      {displayLabel}
    </Badge>
  );
}
