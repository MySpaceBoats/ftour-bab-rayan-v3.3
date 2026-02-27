import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getSupabaseAdminClient } from "./supabase";
import * as supabaseServices from "./supabase-services";
import * as reservationServices from "./reservation-services";

// ============================================
// SCANNER ACCESS GUARD (Admin Session Required)
// ============================================
/**
 * Scanner access guard - requires active admin session
 * Allowed roles: admin, super_admin, admin_ops, scanner
 */
const scannerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ["admin", "super_admin", "admin_ops", "scanner"];

  // Check if user exists and has valid session
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Accès non autorisé – session administrateur requise",
    });
  }

  // Check if user has required role
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Accès non autorisé – session administrateur requise",
    });
  }

  return next({ ctx });
});

// ============================================
// QR TYPE DETECTION
// ============================================
type QrType =
  | "volunteer"
  | "reservation_particulier"
  | "reservation_entreprise"
  | "reservation_groupe"
  | "pastry"
  | "terroir"
  | "goodies"
  | "donation"
  | "catalog_donation"
  | "product_goodie"
  | "product_pastry"
  | "product_terroir"
  | "unknown";

export function detectQrType(token: string): QrType {
  if (token.startsWith("rp-")) return "reservation_particulier";
  if (token.startsWith("re-")) return "reservation_entreprise";
  if (token.startsWith("rg-")) return "reservation_groupe";
  if (token.startsWith("ter-") || token.startsWith("TER-")) return "terroir";
  if (token.startsWith("PASTRY-")) return "pastry";
  if (token.startsWith("FBR-")) return "goodies";
  if (token.startsWith("DON-")) return "donation";
  // Product catalog QR codes (numeric IDs prefixed by type)
  if (token.startsWith("PROD-GOODIE-")) return "product_goodie";
  if (token.startsWith("PROD-PASTRY-")) return "product_pastry";
  if (token.startsWith("PROD-TERROIR-")) return "product_terroir";
  // Hex tokens (128-bit) are volunteers
  if (/^[a-f0-9]{32,}$/i.test(token)) return "volunteer";
  // Fallback: try to detect by looking up in DB
  return "unknown";
}

export function extractTokenFromUrl(rawInput: string): string {
  const normalizedInput = rawInput.trim();

  const decodeCatalogQrImageUrl = (value: string): string => {
    try {
      const parsedUrl = new URL(value);
      if (!parsedUrl.hostname.includes("api.qrserver.com")) return value;
      const embeddedData = parsedUrl.searchParams.get("data");
      return embeddedData ? decodeURIComponent(embeddedData) : value;
    } catch {
      return value;
    }
  };

  const readProductTokenFromPath = (path: string): string | null => {
    const cleanPath = path.split("?")[0].split("#")[0].replace(/\/+$/, "");
    const parts = cleanPath.split("/").filter(Boolean);
    const buyIndex = parts.findIndex(p => p.toLowerCase() === "buy");
    if (buyIndex >= 0 && parts.length >= buyIndex + 3) {
      const category = (parts[buyIndex + 1] || "").toLowerCase();
      const rawId = parts[buyIndex + 2] || "";
      const id = rawId.replace(/\D.*$/, "");
      if (!id) return null;
      if (category === "goodie") return `PROD-GOODIE-${id}`;
      if (category === "pastry") return `PROD-PASTRY-${id}`;
      if (category === "terroir") return `PROD-TERROIR-${id}`;
    }

    // Legacy printed QR formats (without /buy/ segment)
    const legacyGoodieId = cleanPath.match(/\/(?:goodies|goodie)\/(\d+)$/i)?.[1];
    if (legacyGoodieId) return `PROD-GOODIE-${legacyGoodieId}`;
    const legacyPastryId = cleanPath.match(
      /\/(?:patisserie|pastries)\/(\d+)$/i
    )?.[1];
    if (legacyPastryId) return `PROD-PASTRY-${legacyPastryId}`;
    const legacyTerroirId = cleanPath.match(/\/terroir\/(\d+)$/i)?.[1];
    if (legacyTerroirId) return `PROD-TERROIR-${legacyTerroirId}`;

    return null;
  };

  try {
    const decodedInput = decodeCatalogQrImageUrl(normalizedInput);

    try {
      const parsedUrl = new URL(decodedInput);
      const productToken = readProductTokenFromPath(parsedUrl.pathname);
      if (productToken) return productToken;

      if (/\/terroir\/?$/i.test(parsedUrl.pathname)) return "PAGE-TERROIR";
      if (/\/dons\/?$/i.test(parsedUrl.pathname)) return "PAGE-DONS";

      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      const checkinReservationIndex = pathSegments.findIndex(
        p => p === "checkin-reservation"
      );
      if (
        checkinReservationIndex >= 0 &&
        pathSegments.length > checkinReservationIndex + 1
      ) {
        return pathSegments[checkinReservationIndex + 1];
      }
      const checkinIndex = pathSegments.findIndex(p => p === "checkin");
      if (checkinIndex >= 0 && pathSegments.length > checkinIndex + 1) {
        return pathSegments[checkinIndex + 1];
      }
      const pastryQrIndex = pathSegments.findIndex(
        p => p === "pastry" && pathSegments[pathSegments.length - 2] === "qr"
      );
      if (pastryQrIndex >= 0 && pathSegments.length > pastryQrIndex + 1) {
        return pathSegments[pastryQrIndex + 1];
      }
      const goodiesQrIndex = pathSegments.findIndex(
        p =>
          (p === "goodies" || p === "goodie") &&
          pathSegments[pathSegments.length - 2] === "qr"
      );
      if (goodiesQrIndex >= 0 && pathSegments.length > goodiesQrIndex + 1) {
        return pathSegments[goodiesQrIndex + 1];
      }
      const terroirQrIndex = pathSegments.findIndex(
        p => p === "terroir" && pathSegments[pathSegments.length - 2] === "qr"
      );
      if (terroirQrIndex >= 0 && pathSegments.length > terroirQrIndex + 1) {
        return pathSegments[terroirQrIndex + 1];
      }
    } catch {
      // Not a standard URL, fallback to string matching below.
    }

    // Handle full URLs
    if (decodedInput.includes("/checkin-reservation/")) {
      const parts = decodedInput.split("/checkin-reservation/");
      return parts[parts.length - 1].split("?")[0];
    }
    if (decodedInput.includes("/qr/pastry/")) {
      const parts = decodedInput.split("/qr/pastry/");
      return parts[parts.length - 1].split("?")[0];
    }
    if (decodedInput.includes("/qr/goodies/")) {
      const parts = decodedInput.split("/qr/goodies/");
      return parts[parts.length - 1].split("?")[0];
    }
    if (decodedInput.includes("/qr/goodie/")) {
      const parts = decodedInput.split("/qr/goodie/");
      return parts[parts.length - 1].split("?")[0];
    }
    if (decodedInput.includes("/qr/terroir/")) {
      const parts = decodedInput.split("/qr/terroir/");
      return parts[parts.length - 1].split("?")[0];
    }
    const fallbackProductToken = readProductTokenFromPath(decodedInput);
    if (fallbackProductToken) return fallbackProductToken;

    if (decodedInput.includes("/checkin/")) {
      const parts = decodedInput.split("/checkin/");
      return parts[parts.length - 1].split("?")[0];
    }
    // Generic page URLs (legacy catalog QR codes without product ID)
    if (/\/terroir\/?(\?|$)/.test(decodedInput)) {
      return "PAGE-TERROIR";
    }
    if (/\/dons\/?(\?|$)/.test(decodedInput)) {
      return "PAGE-DONS";
    }
    // Already a token
    return decodedInput.trim();
  } catch {
    return normalizedInput;
  }
}

function buildCompactToken(prefix: string, maxLength: number = 20): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2).toUpperCase();

  const prefixBudget = Math.max(0, maxLength - 1);
  const safePrefix = cleanPrefix.slice(0, prefixBudget);
  const bodyBudget = Math.max(
    4,
    maxLength - (safePrefix ? safePrefix.length + 1 : 0)
  );
  const body = `${timestamp}${random}`.slice(0, bodyBudget);

  if (!safePrefix) return body.slice(0, maxLength);
  return `${safePrefix}-${body}`.slice(0, maxLength);
}

function toSafeValidatedBy(userId: unknown): number {
  if (typeof userId === "number" && Number.isFinite(userId)) return userId;
  if (typeof userId === "string" && /^\d+$/.test(userId)) return Number(userId);
  return 0;
}

async function logQRScanSafely(params: {
  token: string;
  scope: string;
  entityId: number;
  validationAction: string;
  validatedBy: number;
  success?: boolean;
  errorMessage?: string;
}) {
  try {
    await supabaseServices.logQRScanSupabase(
      params.token,
      params.scope,
      params.entityId,
      params.validationAction,
      params.validatedBy,
      params.success ?? true,
      params.errorMessage
    );
  } catch (error: any) {
    const message = String(error?.message || error || "");
    if (message.includes("value too long for type character varying(20)")) {
      console.warn(
        "[Scanner] Ignored legacy qr_scans overflow during catalog log:",
        message
      );
      return;
    }
    throw error;
  }
}

const QR_TYPE_LABELS: Record<QrType, string> = {
  volunteer: "Bénévole",
  reservation_particulier: "Réservation Particulier",
  reservation_entreprise: "Réservation Entreprise",
  reservation_groupe: "Réservation Groupe",
  pastry: "Commande Pâtisserie",
  terroir: "Commande Terroir",
  goodies: "Commande Goodies",
  donation: "Don",
  catalog_donation: "Don (Catalogue)",
  product_goodie: "Produit Goodies",
  product_pastry: "Produit Pâtisserie",
  product_terroir: "Produit Terroir",
  unknown: "Inconnu",
};

// ============================================
// UNIFIED SCANNER ROUTER
// ============================================
export const scannerRouter = router({
  /**
   * Identify a QR code: detect its type and return entity info
   */
  identify: scannerProcedure
    .input(z.object({ rawCode: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const token = extractTokenFromUrl(input.rawCode);

      // Handle legacy generic page QR codes (no specific product ID)
      if (token === "PAGE-TERROIR") {
        return {
          type: "unknown" as QrType,
          typeLabel: "Page Terroir",
          token,
          found: false,
          error:
            "Ce QR code renvoie vers la page terroir générale. Veuillez scanner un QR code produit spécifique.",
        };
      }
      if (token === "PAGE-DONS") {
        return {
          type: "catalog_donation" as QrType,
          typeLabel: QR_TYPE_LABELS.catalog_donation,
          token,
          found: true,
          entity: {
            id: 0,
            name: "Don sur place (QR catalogue)",
            status: "pending",
            alreadyValidated: false,
          },
        };
      }

      let qrType = detectQrType(token);
      const supabase = getSupabaseAdminClient();

      // ---- VOLUNTEER (auto-validation) ----
      if (qrType === "volunteer") {
        const volunteer =
          await supabaseServices.getVolunteerByTokenSupabase(token);
        if (volunteer) {
          // Auto-validate: immediately confirm the volunteer on scan
          const validationResult =
            await supabaseServices.scanAndValidateTokenSupabase(
              token,
              ctx.user?.id
            );

          const vol = validationResult.volunteer;
          const fullName = vol
            ? `${vol.firstName} ${vol.lastName}`
            : `${volunteer.firstName} ${volunteer.lastName}`;

          return {
            type: "volunteer" as QrType,
            typeLabel: QR_TYPE_LABELS.volunteer,
            token,
            found: true,
            autoValidated: true,
            validationState:
              validationResult.state ||
              (validationResult.success ? "confirmed" : "error"),
            validationMessage: validationResult.success
              ? validationResult.state === "already_confirmed"
                ? `Déjà confirmé — ${fullName}`
                : validationResult.state === "group_entry_confirmed"
                  ? `Entrée groupe validée — ${fullName}`
                  : `Bénévole confirmé — ${fullName}`
              : validationResult.error || "Erreur de validation",
            validationSuccess: validationResult.success,
            entity: {
              id: volunteer.id,
              name: fullName,
              email: vol?.email || volunteer.email,
              phone: vol?.phone || volunteer.phone,
              status: vol?.status || volunteer.status,
              qrStatus: vol?.qrStatus || volunteer.qrStatus,
              dayNumber: volunteer.day?.dayNumber,
              dayDate: volunteer.day?.date,
              location: volunteer.day?.location,
              iftarTime: volunteer.day?.iftarTime,
              alreadyValidated:
                validationResult.state === "already_confirmed" ||
                volunteer.qrStatus === "validated",
              scannedAt: vol?.scannedAt || volunteer.scannedAt,
            },
          };
        }
        // Hex token not found as volunteer — fall through to unknown handler
        // (restaurant reservations also use hex tokens)
        qrType = "unknown";
      }

      // ---- RESERVATION (all types) ----
      if (
        qrType === "reservation_particulier" ||
        qrType === "reservation_entreprise" ||
        qrType === "reservation_groupe"
      ) {
        const reservation =
          await reservationServices.getReservationByQrTokenSupabase(token);
        if (!reservation) {
          return {
            type: qrType,
            typeLabel: QR_TYPE_LABELS[qrType],
            token,
            found: false,
            error: "Réservation introuvable",
          };
        }
        return {
          type: qrType,
          typeLabel: QR_TYPE_LABELS[qrType],
          token,
          found: true,
          entity: {
            id: reservation.id,
            name: reservation.fullName,
            email: reservation.email,
            phone: reservation.phone,
            status: reservation.status,
            guests: reservation.seats,
            date: reservation.date,
            reference: reservation.referenceCode,
            restaurantName:
              reservation.restaurant?.name || reservation.restaurantName,
            slotTime: reservation.slot?.startTime,
            qrStatus: reservation.status,
            alreadyValidated: reservation.status === "checked_in",
          },
        };
      }

      // ---- TERROIR ----
      if (qrType === "terroir" && supabase) {
        // Try by qr_token first, then by order_reference (QR codes encode the reference)
        let { data: order } = await supabase
          .from("terroir_orders")
          .select("*, terroir_order_items(*, terroir_products(name))")
          .eq("qr_token", token)
          .single();
        if (!order) {
          const { data: orderByRef } = await supabase
            .from("terroir_orders")
            .select("*, terroir_order_items(*, terroir_products(name))")
            .eq("order_reference", token)
            .single();
          order = orderByRef;
        }
        if (!order) {
          return {
            type: "terroir" as QrType,
            typeLabel: QR_TYPE_LABELS.terroir,
            token,
            found: false,
            error: "Commande terroir introuvable",
          };
        }
        return {
          type: "terroir" as QrType,
          typeLabel: QR_TYPE_LABELS.terroir,
          token,
          found: true,
          entity: {
            id: order.id,
            name: order.customer_name,
            phone: order.customer_phone,
            email: order.customer_email,
            status: order.status,
            reference: order.order_reference,
            totalAmount: order.total_amount,
            qrStatus: order.qr_status,
            alreadyValidated: order.qr_status === "validated",
            items: (order.terroir_order_items || []).map((i: any) => ({
              name: i.terroir_products?.name || `Produit #${i.product_id}`,
              quantity: i.quantity,
              price: i.unit_price,
            })),
          },
        };
      }

      // ---- PASTRY ----
      if (qrType === "pastry" && supabase) {
        // Try by qr_token first, then by reference (column is 'reference' not 'order_reference')
        let { data: pastryOrder } = await supabase
          .from("pastry_orders")
          .select("*")
          .eq("qr_token", token)
          .single();
        if (!pastryOrder) {
          const { data: pastryByRef } = await supabase
            .from("pastry_orders")
            .select("*")
            .eq("reference", token)
            .single();
          pastryOrder = pastryByRef;
        }
        if (!pastryOrder) {
          return {
            type: "pastry" as QrType,
            typeLabel: QR_TYPE_LABELS.pastry,
            token,
            found: false,
            error: "Commande pâtisserie introuvable",
          };
        }
        // Resolve pastry names from the items JSONB column
        const pastryItems: Array<{
          pastryId: number;
          quantity: number;
          price: number;
        }> = pastryOrder.items || [];
        const pastryIds = pastryItems.map(i => i.pastryId).filter(Boolean);
        let pastryNamesMap: Record<number, string> = {};
        if (pastryIds.length > 0) {
          const { data: pastries } = await supabase
            .from("pastries")
            .select("id, name")
            .in("id", pastryIds);
          if (pastries) {
            pastryNamesMap = Object.fromEntries(
              pastries.map((p: any) => [p.id, p.name])
            );
          }
        }
        return {
          type: "pastry" as QrType,
          typeLabel: QR_TYPE_LABELS.pastry,
          token,
          found: true,
          entity: {
            id: pastryOrder.id,
            name: pastryOrder.customer_name,
            phone: pastryOrder.phone,
            email: pastryOrder.email,
            status: pastryOrder.order_status,
            qrStatus: pastryOrder.qr_status,
            alreadyValidated: pastryOrder.order_status === "handed",
            reference: pastryOrder.reference,
            totalAmount: parseFloat(pastryOrder.total_amount) || 0,
            items: pastryItems.map(i => ({
              name: pastryNamesMap[i.pastryId] || `Pâtisserie #${i.pastryId}`,
              quantity: i.quantity,
              price: i.price,
            })),
          },
        };
      }

      // ---- GOODIES (orders table with FBR- prefix) ----
      if (qrType === "goodies" && supabase) {
        const { data: goodieOrder } = await supabase
          .from("orders")
          .select("*, order_items(*, goodies(name))")
          .eq("order_reference", token)
          .single();
        if (!goodieOrder) {
          return {
            type: "goodies" as QrType,
            typeLabel: QR_TYPE_LABELS.goodies,
            token,
            found: false,
            error: "Commande goodies introuvable",
          };
        }
        return {
          type: "goodies" as QrType,
          typeLabel: QR_TYPE_LABELS.goodies,
          token,
          found: true,
          entity: {
            id: goodieOrder.id,
            name: goodieOrder.customer_name,
            phone: goodieOrder.customer_phone,
            email: goodieOrder.customer_email,
            status: goodieOrder.status,
            reference: goodieOrder.order_reference,
            totalAmount: parseFloat(goodieOrder.total_amount) || 0,
            alreadyValidated: goodieOrder.status === "delivered",
            items: (goodieOrder.order_items || []).map((i: any) => ({
              name: i.goodies?.name || `Goodie #${i.goodie_id}`,
              quantity: i.quantity,
              price: i.unit_price,
            })),
          },
        };
      }

      // ---- PRODUCT GOODIE (catalog QR) ----
      if (qrType === "product_goodie" && supabase) {
        const productId = parseInt(token.replace("PROD-GOODIE-", ""), 10);
        if (!isNaN(productId)) {
          const { data: product } = await supabase
            .from("goodies")
            .select("*")
            .eq("id", productId)
            .single();
          if (product) {
            return {
              type: "product_goodie" as QrType,
              typeLabel: QR_TYPE_LABELS.product_goodie,
              token,
              found: true,
              entity: {
                id: product.id,
                name: product.name,
                status: product.is_active ? "active" : "inactive",
                totalAmount: parseFloat(product.price) || 0,
                alreadyValidated: false,
                isProduct: true,
              },
            };
          }
        }
        return {
          type: "product_goodie" as QrType,
          typeLabel: QR_TYPE_LABELS.product_goodie,
          token,
          found: false,
          error: "Produit goodies introuvable",
        };
      }

      // ---- PRODUCT PASTRY (catalog QR) ----
      if (qrType === "product_pastry" && supabase) {
        const productId = parseInt(token.replace("PROD-PASTRY-", ""), 10);
        if (!isNaN(productId)) {
          const { data: product } = await supabase
            .from("pastries")
            .select("*")
            .eq("id", productId)
            .single();
          if (product) {
            return {
              type: "product_pastry" as QrType,
              typeLabel: QR_TYPE_LABELS.product_pastry,
              token,
              found: true,
              entity: {
                id: product.id,
                name: product.name,
                status: product.active ? "active" : "inactive",
                totalAmount: parseFloat(product.price) || 0,
                alreadyValidated: false,
                isProduct: true,
              },
            };
          }
        }
        return {
          type: "product_pastry" as QrType,
          typeLabel: QR_TYPE_LABELS.product_pastry,
          token,
          found: false,
          error: "Produit pâtisserie introuvable",
        };
      }

      // ---- PRODUCT TERROIR (catalog QR) ----
      if (qrType === "product_terroir" && supabase) {
        const productId = parseInt(token.replace("PROD-TERROIR-", ""), 10);
        if (!isNaN(productId)) {
          const { data: product } = await supabase
            .from("terroir_products")
            .select("*, terroir_product_variants(price_unit)")
            .eq("id", productId)
            .single();
          if (product) {
            const firstVariant = (product as any).terroir_product_variants?.[0];
            return {
              type: "product_terroir" as QrType,
              typeLabel: QR_TYPE_LABELS.product_terroir,
              token,
              found: true,
              entity: {
                id: product.id,
                name: product.name,
                status: product.is_active ? "active" : "inactive",
                totalAmount: firstVariant?.price_unit
                  ? parseFloat(firstVariant.price_unit)
                  : 0,
                alreadyValidated: false,
                isProduct: true,
              },
            };
          }
        }
        return {
          type: "product_terroir" as QrType,
          typeLabel: QR_TYPE_LABELS.product_terroir,
          token,
          found: false,
          error: "Produit terroir introuvable",
        };
      }

      // ---- DONATION ----
      if (qrType === "donation" && supabase) {
        const { data: donation } = await supabase
          .from("donations")
          .select("*")
          .eq("donation_reference", token)
          .single();
        if (!donation) {
          return {
            type: "donation" as QrType,
            typeLabel: QR_TYPE_LABELS.donation,
            token,
            found: false,
            error: "Don introuvable",
          };
        }
        return {
          type: "donation" as QrType,
          typeLabel: QR_TYPE_LABELS.donation,
          token,
          found: true,
          entity: {
            id: donation.id,
            name: donation.donor_name,
            phone: donation.donor_phone,
            email: donation.donor_email,
            status: donation.status,
            reference: donation.donation_reference,
            amount: parseFloat(donation.amount) || 0,
            paymentMethod: donation.payment_method,
            alreadyValidated: donation.status === "received",
          },
        };
      }

      // ---- UNKNOWN: try all tables ----
      if (qrType === "unknown" && supabase) {
        // Try volunteer
        const volunteer =
          await supabaseServices.getVolunteerByTokenSupabase(token);
        if (volunteer) {
          return {
            type: "volunteer" as QrType,
            typeLabel: QR_TYPE_LABELS.volunteer,
            token,
            found: true,
            entity: {
              id: volunteer.id,
              name: `${volunteer.firstName} ${volunteer.lastName}`,
              email: volunteer.email,
              phone: volunteer.phone,
              status: volunteer.status,
              qrStatus: volunteer.qrStatus,
              dayNumber: volunteer.day?.dayNumber,
              dayDate: volunteer.day?.date,
              alreadyValidated: volunteer.qrStatus === "validated",
              scannedAt: volunteer.scannedAt,
            },
          };
        }
        // Try reservation
        const reservation =
          await reservationServices.getReservationByQrTokenSupabase(token);
        if (reservation) {
          return {
            type: "reservation_particulier" as QrType,
            typeLabel: "Réservation",
            token,
            found: true,
            entity: {
              id: reservation.id,
              name: reservation.fullName,
              email: reservation.email,
              phone: reservation.phone,
              status: reservation.status,
              guests: reservation.seats,
              date: reservation.date,
              reference: reservation.referenceCode,
              qrStatus: reservation.status,
              alreadyValidated: reservation.status === "checked_in",
            },
          };
        }
        // Try pastry order (by qr_token or reference)
        let pastryOrder = null;
        const { data: pastryByToken } = await supabase
          .from("pastry_orders")
          .select("*")
          .eq("qr_token", token)
          .single();
        pastryOrder = pastryByToken;
        if (!pastryOrder) {
          const { data: pastryByRef } = await supabase
            .from("pastry_orders")
            .select("*")
            .eq("reference", token)
            .single();
          pastryOrder = pastryByRef;
        }
        if (pastryOrder) {
          // Resolve pastry names from the items JSONB column
          const pastryItems: Array<{
            pastryId: number;
            quantity: number;
            price: number;
          }> = pastryOrder.items || [];
          const pastryIds = pastryItems.map(i => i.pastryId).filter(Boolean);
          let pastryNamesMap: Record<number, string> = {};
          if (pastryIds.length > 0) {
            const { data: pastries } = await supabase
              .from("pastries")
              .select("id, name")
              .in("id", pastryIds);
            if (pastries) {
              pastryNamesMap = Object.fromEntries(
                pastries.map((p: any) => [p.id, p.name])
              );
            }
          }
          return {
            type: "pastry" as QrType,
            typeLabel: QR_TYPE_LABELS.pastry,
            token,
            found: true,
            entity: {
              id: pastryOrder.id,
              name: pastryOrder.customer_name,
              phone: pastryOrder.phone,
              email: pastryOrder.email,
              status: pastryOrder.order_status,
              qrStatus: pastryOrder.qr_status,
              alreadyValidated: pastryOrder.order_status === "handed",
              reference: pastryOrder.reference,
              totalAmount: parseFloat(pastryOrder.total_amount) || 0,
              items: pastryItems.map(i => ({
                name: pastryNamesMap[i.pastryId] || `Pâtisserie #${i.pastryId}`,
                quantity: i.quantity,
                price: i.price,
              })),
            },
          };
        }
        // Try terroir order (by qr_token or order_reference)
        let terroirOrder = null;
        const { data: terroirByToken } = await supabase
          .from("terroir_orders")
          .select("*, terroir_order_items(*, terroir_products(name))")
          .eq("qr_token", token)
          .single();
        terroirOrder = terroirByToken;
        if (!terroirOrder) {
          const { data: terroirByRef } = await supabase
            .from("terroir_orders")
            .select("*, terroir_order_items(*, terroir_products(name))")
            .eq("order_reference", token)
            .single();
          terroirOrder = terroirByRef;
        }
        if (terroirOrder) {
          return {
            type: "terroir" as QrType,
            typeLabel: QR_TYPE_LABELS.terroir,
            token,
            found: true,
            entity: {
              id: terroirOrder.id,
              name: terroirOrder.customer_name,
              phone: terroirOrder.customer_phone,
              email: terroirOrder.customer_email,
              status: terroirOrder.status,
              qrStatus: terroirOrder.qr_status,
              alreadyValidated: terroirOrder.qr_status === "validated",
              reference: terroirOrder.order_reference,
              totalAmount: terroirOrder.total_amount,
              items: (terroirOrder.terroir_order_items || []).map((i: any) => ({
                name: i.terroir_products?.name || `Produit #${i.product_id}`,
                quantity: i.quantity,
                price: i.unit_price,
              })),
            },
          };
        }
        // Try goodies order (orders table)
        const { data: goodieOrder } = await supabase
          .from("orders")
          .select("*, order_items(*, goodies(name))")
          .eq("order_reference", token)
          .single();
        if (goodieOrder) {
          return {
            type: "goodies" as QrType,
            typeLabel: QR_TYPE_LABELS.goodies,
            token,
            found: true,
            entity: {
              id: goodieOrder.id,
              name: goodieOrder.customer_name,
              phone: goodieOrder.customer_phone,
              email: goodieOrder.customer_email,
              status: goodieOrder.status,
              reference: goodieOrder.order_reference,
              totalAmount: parseFloat(goodieOrder.total_amount) || 0,
              alreadyValidated: goodieOrder.status === "delivered",
              items: (goodieOrder.order_items || []).map((i: any) => ({
                name: i.goodies?.name || `Goodie #${i.goodie_id}`,
                quantity: i.quantity,
                price: i.unit_price,
              })),
            },
          };
        }
        // Try QR tokens (goodies)
        const { data: qrTokenRow } = await supabase
          .from("qr_tokens")
          .select("*")
          .eq("token", token)
          .single();
        if (qrTokenRow) {
          return {
            type:
              qrTokenRow.scope === "pastry"
                ? ("pastry" as QrType)
                : ("goodies" as QrType),
            typeLabel:
              qrTokenRow.scope === "pastry"
                ? QR_TYPE_LABELS.pastry
                : QR_TYPE_LABELS.goodies,
            token,
            found: true,
            entity: {
              id: qrTokenRow.id,
              status: qrTokenRow.status,
              scope: qrTokenRow.scope,
              alreadyValidated: qrTokenRow.status === "used",
              usesCount: qrTokenRow.uses_count,
              maxUses: qrTokenRow.max_uses,
            },
          };
        }
        // Try donation by reference
        const { data: donationRow } = await supabase
          .from("donations")
          .select("*")
          .eq("donation_reference", token)
          .single();
        if (donationRow) {
          return {
            type: "donation" as QrType,
            typeLabel: QR_TYPE_LABELS.donation,
            token,
            found: true,
            entity: {
              id: donationRow.id,
              name: donationRow.donor_name,
              phone: donationRow.donor_phone,
              email: donationRow.donor_email,
              status: donationRow.status,
              reference: donationRow.donation_reference,
              amount: parseFloat(donationRow.amount) || 0,
              paymentMethod: donationRow.payment_method,
              alreadyValidated: donationRow.status === "received",
            },
          };
        }
      }

      return {
        type: "unknown" as QrType,
        typeLabel: "Inconnu",
        token,
        found: false,
        error: "QR code non reconnu dans le système",
      };
    }),

  /**
   * Validate/check-in a QR code based on its type
   *
   * SECURITY:
   * - Requires admin session (scannerProcedure)
   * - Updates status atomically in database
   * - Creates audit trail for all validations
   */
  validate: scannerProcedure
    .input(
      z.object({
        token: z.string().min(1),
        type: z.enum([
          "volunteer",
          "reservation_particulier",
          "reservation_entreprise",
          "reservation_groupe",
          "pastry",
          "terroir",
          "goodies",
          "donation",
          "catalog_donation",
          "product_goodie",
          "product_pastry",
          "product_terroir",
          "unknown",
        ]),
        entityId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const supabase = getSupabaseAdminClient();
      const validatedBy = toSafeValidatedBy(ctx.user?.id);

      // ---- VOLUNTEER ----
      if (input.type === "volunteer") {
        const result = await supabaseServices.scanAndValidateTokenSupabase(
          input.token,
          ctx.user?.id
        );
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Erreur de validation bénévole",
          });
        }
        const vol = result.volunteer;
        const fullName = vol ? `${vol.firstName} ${vol.lastName}` : "";
        if (result.state === "already_confirmed") {
          return {
            success: true,
            message: `Déjà confirmé — ${fullName}`,
            state: "already_confirmed" as const,
            volunteer: vol
              ? {
                  id: vol.id,
                  name: fullName,
                  email: vol.email,
                  phone: vol.phone,
                }
              : undefined,
          };
        }
        return {
          success: true,
          message: `Bénévole confirmé — ${fullName}`,
          state: "confirmed" as const,
          volunteer: vol
            ? { id: vol.id, name: fullName, email: vol.email, phone: vol.phone }
            : undefined,
        };
      }

      // ---- RESERVATION ----
      if (input.type.startsWith("reservation_")) {
        const checkin = await reservationServices.createCheckinSupabase({
          reservationId: input.entityId,
          validationMode: "scan",
          validatedBy: ctx.user?.name || ctx.user?.email || "Scanner",
        });
        return {
          success: true,
          message: "Check-in réservation validé !",
          data: checkin,
        };
      }

      // ---- TERROIR ----
      if (input.type === "terroir" && supabase) {
        const { data: order } = await supabase
          .from("terroir_orders")
          .select("qr_status, status")
          .eq("id", input.entityId)
          .single();
        if (!order)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Commande terroir introuvable",
          });
        if (order.qr_status === "validated")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Commande déjà validée",
          });
        await supabase
          .from("terroir_orders")
          .update({ qr_status: "validated", status: "handed" })
          .eq("id", input.entityId);
        return { success: true, message: "Commande terroir remise !" };
      }

      // ---- PASTRY ----
      if (input.type === "pastry" && supabase) {
        const { data: order } = await supabase
          .from("pastry_orders")
          .select("qr_status, order_status")
          .eq("id", input.entityId)
          .single();
        if (!order)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Commande pâtisserie introuvable",
          });
        if (order.order_status === "handed")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Commande déjà remise",
          });
        await supabase
          .from("pastry_orders")
          .update({ qr_status: "validated", order_status: "handed" })
          .eq("id", input.entityId);
        return { success: true, message: "Commande pâtisserie remise !" };
      }

      // ---- GOODIES (orders table or qr_tokens) ----
      if (input.type === "goodies") {
        // Try validating via orders table first (FBR- references)
        if (supabase && input.token.startsWith("FBR-")) {
          const { data: order } = await supabase
            .from("orders")
            .select("status")
            .eq("id", input.entityId)
            .single();
          if (!order)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Commande goodies introuvable",
            });
          if (order.status === "delivered")
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Commande déjà remise",
            });
          await supabase
            .from("orders")
            .update({ status: "delivered" })
            .eq("id", input.entityId);
          return { success: true, message: "Commande goodies remise !" };
        }
        // Fallback: try via qr_tokens table
        try {
          await supabaseServices.validateQRTokenSupabase(
            input.token,
            "goodies"
          );
          return { success: true, message: "Commande goodies validée !" };
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }

      // ---- PRODUCT (catalog QR) ----
      if (input.type === "product_goodie") {
        if (!supabase)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase non configuré",
          });

        const { data: product } = await supabase
          .from("goodies")
          .select("id, name, price, is_active")
          .eq("id", input.entityId)
          .single();

        if (!product) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Produit goodies introuvable",
          });
        }
        if (!product.is_active) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ce produit goodies est inactif",
          });
        }

        const unitPrice = parseFloat(product.price as any) || 0;

        const overflowMessage = "value too long for type character varying(20)";
        const buildInsertPayload = (variant: "default" | "minimal") => {
          const base = {
            order_reference: buildCompactToken(
              "FBR",
              variant === "default" ? 20 : 10
            ),
            customer_name: variant === "default" ? "Scan goodies" : "Scan",
            customer_email: "scan@fbr.ma",
            customer_phone: "0000000000",
            total_amount: unitPrice,
          };

          if (variant === "minimal") {
            return {
              ...base,
              status: "paid",
              payment_method: "cash",
            };
          }

          return {
            ...base,
            status: "paid",
            payment_method: "cash",
            notes: "scan_catalog",
          };
        };

        let { data: createdOrder, error: orderError } = await supabase
          .from("orders")
          .insert(buildInsertPayload("default"))
          .select("id, order_reference")
          .single();

        if (
          (orderError || !createdOrder) &&
          String(orderError?.message || "").includes(overflowMessage)
        ) {
          const retry = await supabase
            .from("orders")
            .insert(buildInsertPayload("minimal"))
            .select("id, order_reference")
            .single();
          createdOrder = retry.data;
          orderError = retry.error;
        }

        if (orderError || !createdOrder) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: orderError?.message || "Création commande impossible",
          });
        }

        const { error: itemError } = await supabase.from("order_items").insert({
          order_id: createdOrder.id,
          goodie_id: product.id,
          quantity: 1,
          unit_price: unitPrice,
          total_price: unitPrice,
        });

        if (itemError) {
          await supabase.from("orders").delete().eq("id", createdOrder.id);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: itemError.message,
          });
        }

        await logQRScanSafely({
          token: input.token,
          scope: input.type,
          entityId: input.entityId,
          validationAction: "catalog_scan",
          validatedBy,
          success: true,
        });

        return {
          success: true,
          message: `Produit ajouté au board commandes (${createdOrder.order_reference}).`,
          orderId: createdOrder.id,
          orderReference: createdOrder.order_reference,
        };
      }

      if (input.type === "product_pastry") {
        if (!supabase)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase non configuré",
          });

        const { data: product } = await supabase
          .from("pastries")
          .select("id, name, price, active")
          .eq("id", input.entityId)
          .single();

        if (!product) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Produit pâtisserie introuvable",
          });
        }
        if (!product.active) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ce produit pâtisserie est inactif",
          });
        }

        const unitPrice = parseFloat(product.price as any) || 0;
        const reference = buildCompactToken("PAS", 20);
        const qrToken = buildCompactToken("PSQ", 20);

        const { data: createdOrder, error: orderError } = await supabase
          .from("pastry_orders")
          .insert({
            reference,
            customer_name: "Scan pastry",
            phone: "0000000000",
            email: "scan@fbr.ma",
            items: [{ pastryId: product.id, quantity: 1, price: unitPrice }],
            total_amount: unitPrice,
            payment_method: "cash",
            payment_status: "paid",
            order_status: "paid",
            qr_token: qrToken,
            notes: "scan_catalog",
          })
          .select("id, reference")
          .single();

        if (orderError || !createdOrder) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              orderError?.message || "Création commande pâtisserie impossible",
          });
        }

        await logQRScanSafely({
          token: input.token,
          scope: input.type,
          entityId: input.entityId,
          validationAction: "catalog_scan",
          validatedBy,
          success: true,
        });

        return {
          success: true,
          message: `Produit ajouté au board commandes pâtisserie (${createdOrder.reference}).`,
          orderId: createdOrder.id,
          orderReference: createdOrder.reference,
        };
      }

      if (input.type === "product_terroir") {
        if (!supabase)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Supabase non configuré",
          });

        const { data: product } = await supabase
          .from("terroir_products")
          .select(
            "id, name, is_active, terroir_product_variants(id, price_unit, is_active)"
          )
          .eq("id", input.entityId)
          .single();

        if (!product) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Produit terroir introuvable",
          });
        }
        if (!product.is_active) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ce produit terroir est inactif",
          });
        }

        const variants = (
          (product as any).terroir_product_variants || []
        ).filter((v: any) => v.is_active !== false);
        if (variants.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Aucune variante active disponible pour ce produit terroir",
          });
        }

        const variant = variants[0];
        const unitPrice = parseFloat(variant.price_unit as any) || 0;
        const orderReference = buildCompactToken("TER", 20);
        const qrToken = buildCompactToken("TRQ", 20);

        const { data: createdOrder, error: orderError } = await supabase
          .from("terroir_orders")
          .insert({
            order_reference: orderReference,
            customer_name: "Scan terroir",
            customer_phone: "0000000000",
            customer_email: "scan@fbr.ma",
            total_amount: unitPrice,
            status: "paid",
            payment_status: "paid",
            qr_token: qrToken,
            qr_status: "active",
            notes: "scan_catalog",
          })
          .select("id, order_reference")
          .single();

        if (orderError || !createdOrder) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              orderError?.message || "Création commande terroir impossible",
          });
        }

        const { error: itemError } = await supabase
          .from("terroir_order_items")
          .insert({
            order_id: createdOrder.id,
            product_id: product.id,
            variant_id: variant.id,
            quantity: 1,
            unit_price: unitPrice,
            total_price: unitPrice,
          });

        if (itemError) {
          await supabase
            .from("terroir_orders")
            .delete()
            .eq("id", createdOrder.id);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: itemError.message,
          });
        }

        await logQRScanSafely({
          token: input.token,
          scope: input.type,
          entityId: input.entityId,
          validationAction: "catalog_scan",
          validatedBy,
          success: true,
        });

        return {
          success: true,
          message: `Produit ajouté au board commandes terroir (${createdOrder.order_reference}).`,
          orderId: createdOrder.id,
          orderReference: createdOrder.order_reference,
        };
      }

      // ---- DONATION PAGE (catalog QR) ----
      if (input.type === "catalog_donation") {
        await logQRScanSafely({
          token: input.token,
          scope: input.type,
          entityId: 0,
          validationAction: "catalog_scan",
          validatedBy,
          success: true,
        });
        return {
          success: true,
          message: "Scan don catalogue enregistré dans le système.",
        };
      }

      // ---- DONATION ----
      if (input.type === "donation" && supabase) {
        const { data: donation } = await supabase
          .from("donations")
          .select("status")
          .eq("id", input.entityId)
          .single();
        if (!donation)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Don introuvable",
          });
        if (donation.status === "received")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Don déjà marqué comme reçu",
          });
        await supabase
          .from("donations")
          .update({ status: "received" })
          .eq("id", input.entityId);
        return { success: true, message: "Don marqué comme reçu !" };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Type de QR non supporté pour la validation",
      });
    }),
});
