import { getSupabaseAdminClient } from "./supabase";
import crypto from "crypto";

// ============================================================
// TYPES
// ============================================================

export type MovementType =
  | "INITIAL_LOAD"
  | "PURCHASE_IN"
  | "DONATION_IN"
  | "PRODUCTION_IN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "SALE"
  | "RETURN_IN"
  | "RETURN_OUT"
  | "ADJUSTMENT_PLUS"
  | "ADJUSTMENT_MINUS";

export type StockEntryMovementType =
  | "INITIAL_LOAD"
  | "PURCHASE_IN"
  | "DONATION_IN"
  | "PRODUCTION_IN";

export type LocationType = "GLOBAL" | "EVENT_BUFFER" | "POS";
export type EventStatus = "draft" | "open" | "closed" | "archived";

function db() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase admin client non configuré");
  return client;
}

function parseError(error: any): string {
  // PostgREST wraps PL/pgSQL RAISE EXCEPTION messages in "message"
  return error?.message || error?.details || "Erreur interne";
}

function makeStockEntrySlug(productId: number): string {
  return `stk_${productId}_${crypto.randomBytes(10).toString("hex")}`;
}

// ============================================================
// PRODUCTS
// ============================================================

export async function createInventoryProduct(input: {
  productType: string;
  sourceProductId?: number | null;
  sourceVariantId?: number | null;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  category?: string | null;
  unit?: string;
}) {
  const { data, error } = await db()
    .from("inventory_products")
    .insert({
      product_type: input.productType,
      source_product_id: input.sourceProductId ?? null,
      source_variant_id: input.sourceVariantId ?? null,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      name: input.name,
      category: input.category ?? null,
      unit: input.unit ?? "piece",
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(parseError(error));

  // Generate QR slug immediately so the stock-entry page always has a code ready
  try {
    const slug = await ensureStockEntryQrSlug(data.id);
    return { ...data, stock_entry_qr_slug: slug };
  } catch {
    return data;
  }
}

export async function updateInventoryProduct(
  id: number,
  input: {
    name?: string;
    sku?: string | null;
    barcode?: string | null;
    category?: string | null;
    unit?: string;
    isActive?: boolean;
  }
) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.sku !== undefined) patch.sku = input.sku;
  if (input.barcode !== undefined) patch.barcode = input.barcode;
  if (input.category !== undefined) patch.category = input.category;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await db()
    .from("inventory_products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(parseError(error));
  return data;
}

export async function listInventoryProducts(filters?: {
  isActive?: boolean;
  productType?: string;
  search?: string;
}) {
  let q = db().from("inventory_products").select("*").order("name");

  if (filters?.isActive !== undefined) q = q.eq("is_active", filters.isActive);
  if (filters?.productType) q = q.eq("product_type", filters.productType);
  if (filters?.search) q = q.ilike("name", `%${filters.search}%`);

  const { data, error } = await q;
  if (error) throw new Error(parseError(error));
  return data ?? [];
}

export async function getInventoryProductById(id: number) {
  const { data, error } = await db()
    .from("inventory_products")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}

// Sync: map un produit existant → inventory_product (upsert)
export async function syncInventoryProduct(input: {
  productType: string;
  sourceProductId: number;
  sourceVariantId?: number | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
}) {
  // Try to find existing
  let q = db()
    .from("inventory_products")
    .select("*")
    .eq("product_type", input.productType)
    .eq("source_product_id", input.sourceProductId);
  if (input.sourceVariantId) {
    q = q.eq("source_variant_id", input.sourceVariantId);
  } else {
    q = q.is("source_variant_id", null);
  }
  const { data: existing } = await q.maybeSingle();

  if (existing) {
    const { data, error } = await db()
      .from("inventory_products")
      .update({
        name: input.name,
        sku: input.sku ?? null,
        category: input.category ?? null,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(parseError(error));
    return data;
  }

  return createInventoryProduct(input);
}

// ============================================================
// CATALOG SYNC — import all existing catalog products
// ============================================================

export async function syncAllCatalogProducts(): Promise<{
  synced: number;
  errors: number;
  details: string[];
}> {
  let synced = 0;
  let errors = 0;
  const details: string[] = [];

  // --- Goodies ---
  const { data: goodies, error: goodiesErr } = await db()
    .from("goodies")
    .select("id, name, category");
  if (goodiesErr) {
    errors++;
    details.push(`goodies fetch error: ${goodiesErr.message}`);
  }
  for (const g of goodies ?? []) {
    try {
      await syncInventoryProduct({
        productType: "goodie",
        sourceProductId: g.id,
        name: g.name,
        category: g.category ?? null,
      });
      synced++;
    } catch (e: any) {
      errors++;
      details.push(`goodie#${g.id}: ${e.message}`);
    }
  }

  // --- Goodie variants ---
  const { data: goodieVariants, error: gvErr } = await db()
    .from("goodie_variants")
    .select("id, goodie_id, name, sku, size, color, goodies(name, category)");
  if (gvErr) {
    errors++;
    details.push(`goodie_variants fetch error: ${gvErr.message}`);
  }
  for (const v of goodieVariants ?? []) {
    try {
      const parent = (v as any).goodies;
      const variantLabel =
        (v as any).name ||
        [(v as any).size, (v as any).color].filter(Boolean).join(" / ") ||
        `#${v.id}`;
      await syncInventoryProduct({
        productType: "goodie_variant",
        sourceProductId: (v as any).goodie_id,
        sourceVariantId: v.id,
        name: parent ? `${parent.name} – ${variantLabel}` : variantLabel,
        sku: (v as any).sku ?? null,
        category: parent?.category ?? null,
      });
      synced++;
    } catch (e: any) {
      errors++;
      details.push(`goodie_variant#${v.id}: ${e.message}`);
    }
  }

  // --- Terroir products ---
  const { data: terroirProducts, error: terroirErr } = await db()
    .from("terroir_products")
    .select("id, name, category");
  if (terroirErr) {
    errors++;
    details.push(`terroir_products fetch error: ${terroirErr.message}`);
  }
  for (const t of terroirProducts ?? []) {
    try {
      await syncInventoryProduct({
        productType: "terroir_product",
        sourceProductId: t.id,
        name: t.name,
        category: t.category ?? null,
      });
      synced++;
    } catch (e: any) {
      errors++;
      details.push(`terroir_product#${t.id}: ${e.message}`);
    }
  }

  // --- Terroir variants ---
  const { data: terroirVariants, error: terroirVarErr } = await db()
    .from("terroir_product_variants")
    .select("id, product_id, label, sku, terroir_products(name, category)");
  if (terroirVarErr) {
    errors++;
    details.push(
      `terroir_product_variants fetch error: ${terroirVarErr.message}`
    );
  }
  for (const v of terroirVariants ?? []) {
    try {
      const parent = (v as any).terroir_products;
      await syncInventoryProduct({
        productType: "terroir_variant",
        sourceProductId: (v as any).product_id,
        sourceVariantId: v.id,
        name: parent ? `${parent.name} – ${v.label}` : v.label,
        sku: v.sku ?? null,
        category: parent?.category ?? null,
      });
      synced++;
    } catch (e: any) {
      errors++;
      details.push(`terroir_variant#${v.id}: ${e.message}`);
    }
  }

  // --- Pastries ---
  const { data: pastries, error: pastriesErr } = await db()
    .from("pastries")
    .select("id, name, category");
  if (pastriesErr) {
    errors++;
    details.push(`pastries fetch error: ${pastriesErr.message}`);
  }
  for (const p of pastries ?? []) {
    try {
      await syncInventoryProduct({
        productType: "pastry",
        sourceProductId: p.id,
        name: p.name,
        category: p.category ?? null,
      });
      synced++;
    } catch (e: any) {
      errors++;
      details.push(`pastry#${p.id}: ${e.message}`);
    }
  }

  return { synced, errors, details };
}

export async function ensureStockEntryQrSlug(
  productId: number
): Promise<string> {
  const { data: existing, error: existingErr } = await db()
    .from("inventory_products")
    .select("id, stock_entry_qr_slug")
    .eq("id", productId)
    .single();

  if (existingErr) throw new Error(parseError(existingErr));
  if (existing?.stock_entry_qr_slug) return existing.stock_entry_qr_slug;

  for (let i = 0; i < 5; i++) {
    const slug = makeStockEntrySlug(productId);
    const { data, error } = await db()
      .from("inventory_products")
      .update({ stock_entry_qr_slug: slug })
      .eq("id", productId)
      .is("stock_entry_qr_slug", null)
      .select("stock_entry_qr_slug")
      .single();

    if (!error && data?.stock_entry_qr_slug) return data.stock_entry_qr_slug;

    const { data: refreshed } = await db()
      .from("inventory_products")
      .select("stock_entry_qr_slug")
      .eq("id", productId)
      .single();

    if (refreshed?.stock_entry_qr_slug) return refreshed.stock_entry_qr_slug;
  }

  throw new Error(
    "Impossible de générer un QR d’entrée de stock pour ce produit"
  );
}

export async function regenerateStockEntryQrSlug(
  productId: number
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const slug = makeStockEntrySlug(productId);
    const { data, error } = await db()
      .from("inventory_products")
      .update({ stock_entry_qr_slug: slug, stock_entry_qr_enabled: true })
      .eq("id", productId)
      .select("stock_entry_qr_slug")
      .single();
    if (!error && data?.stock_entry_qr_slug) return data.stock_entry_qr_slug;
  }
  throw new Error("Impossible de régénérer le QR d’entrée de stock");
}

export async function setStockEntryQrEnabled(
  productId: number,
  enabled: boolean
) {
  const { data, error } = await db()
    .from("inventory_products")
    .update({ stock_entry_qr_enabled: enabled })
    .eq("id", productId)
    .select("id, stock_entry_qr_enabled")
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}

export async function getStockEntryBySlug(slug: string) {
  const { data, error } = await db()
    .from("inventory_products")
    .select("*")
    .eq("stock_entry_qr_slug", slug)
    .maybeSingle();
  if (error) throw new Error(parseError(error));
  if (!data) throw new Error("Produit introuvable");
  if (!data.stock_entry_qr_enabled) throw new Error("QR inactif");
  return data;
}

export async function listStockEntryProducts(filters?: {
  search?: string;
  isActive?: boolean;
}) {
  // Global location is optional — products still load even if no location is configured yet
  let globalLoc: { id: number } | null = null;
  try {
    globalLoc = await getGlobalLocation();
  } catch {
    // No global location configured yet; stock balances will default to 0
  }

  let q = db().from("inventory_products").select("*").order("name");

  if (filters?.isActive !== undefined) q = q.eq("is_active", filters.isActive);
  if (filters?.search) {
    const pattern = `%${filters.search}%`;
    q = q.or(
      `name.ilike.${pattern},sku.ilike.${pattern},category.ilike.${pattern},barcode.ilike.${pattern}`
    );
  }

  const { data: products, error } = await q;
  if (error) throw new Error(parseError(error));

  const rows = products ?? [];

  await Promise.all(
    rows
      .filter((p: any) => !p.stock_entry_qr_slug)
      .map((p: any) => ensureStockEntryQrSlug(p.id))
  );

  const productIds = rows.map((p: any) => p.id);

  let balances: Array<{ product_id: number; quantity_on_hand: number }> = [];
  if (globalLoc) {
    const { data } = await db()
      .from("inventory_stock_balances")
      .select("product_id, quantity_on_hand")
      .eq("location_id", globalLoc.id)
      .in("product_id", productIds.length ? productIds : [-1]);
    balances = data ?? [];
  }

  const { data: qrMovements } = await db()
    .from("inventory_movements")
    .select(
      "id, product_id, quantity, movement_type, created_at, performed_by, reason, note, reference_type"
    )
    .eq("reference_type", "QR_STOCK_ENTRY")
    .in("product_id", productIds.length ? productIds : [-1])
    .order("created_at", { ascending: false });

  const byBalance = new Map<number, number>(
    balances.map((b: any) => [b.product_id, b.quantity_on_hand])
  );
  const byLastMovement = new Map<number, any>();
  for (const m of qrMovements ?? []) {
    if (!byLastMovement.has(m.product_id)) byLastMovement.set(m.product_id, m);
  }

  const normalized = await Promise.all(
    rows.map(async (p: any) => {
      const slug =
        p.stock_entry_qr_slug ?? (await ensureStockEntryQrSlug(p.id));
      return {
        ...p,
        stock_entry_qr_slug: slug,
        global_stock: byBalance.get(p.id) ?? 0,
        last_qr_entry: byLastMovement.get(p.id) ?? null,
      };
    })
  );

  return { globalLocationId: globalLoc?.id ?? null, products: normalized };
}

export async function getStockEntryProductDetail(productId: number) {
  const globalLoc = await getGlobalLocation();
  const product = await getInventoryProductById(productId);
  const slug =
    product.stock_entry_qr_slug ?? (await ensureStockEntryQrSlug(productId));
  const current = await getStockBalance(productId, globalLoc.id);

  const { data: history } = await db()
    .from("inventory_movements")
    .select("*, users(id, username, email)")
    .eq("product_id", productId)
    .eq("reference_type", "QR_STOCK_ENTRY")
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    product: { ...product, stock_entry_qr_slug: slug },
    globalLocation: globalLoc,
    globalStock: current,
    history: history ?? [],
    lastEntry: (history ?? [])[0] ?? null,
  };
}

export async function getQrStockEntryHistory(limit = 100) {
  const { data, error } = await db()
    .from("inventory_movements")
    .select(
      `
      *,
      inventory_products ( id, name, category, sku ),
      users ( id, username, email )
    `
    )
    .eq("reference_type", "QR_STOCK_ENTRY")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 300));
  if (error) throw new Error(parseError(error));
  return data ?? [];
}

// ============================================================
// EVENTS
// ============================================================

export async function createInventoryEvent(input: {
  name: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: EventStatus;
}) {
  const { data, error } = await db()
    .from("inventory_events")
    .insert({
      name: input.name,
      description: input.description ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      status: input.status ?? "draft",
    })
    .select()
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}

export async function updateInventoryEvent(
  id: number,
  input: {
    name?: string;
    description?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    status?: EventStatus;
  }
) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await db()
    .from("inventory_events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}

export async function listInventoryEvents(filters?: { status?: EventStatus }) {
  let q = db()
    .from("inventory_events")
    .select("*")
    .order("created_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw new Error(parseError(error));
  return data ?? [];
}

export async function getInventoryEventById(id: number) {
  const { data, error } = await db()
    .from("inventory_events")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}

// ============================================================
// LOCATIONS
// ============================================================

export async function createInventoryLocation(input: {
  type: LocationType;
  code: string;
  name: string;
  eventId?: number | null;
  parentLocationId?: number | null;
  metadata?: Record<string, unknown> | null;
}) {
  const { data, error } = await db()
    .from("inventory_locations")
    .insert({
      type: input.type,
      code: input.code,
      name: input.name,
      event_id: input.eventId ?? null,
      parent_location_id: input.parentLocationId ?? null,
      is_active: true,
      metadata: input.metadata ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}

export async function listInventoryLocations(filters?: {
  type?: LocationType;
  eventId?: number;
  isActive?: boolean;
}) {
  let q = db().from("inventory_locations").select("*").order("name");
  if (filters?.type) q = q.eq("type", filters.type);
  if (filters?.eventId !== undefined) q = q.eq("event_id", filters.eventId);
  if (filters?.isActive !== undefined) q = q.eq("is_active", filters.isActive);
  const { data, error } = await q;
  if (error) throw new Error(parseError(error));
  return data ?? [];
}

export async function getInventoryLocationById(id: number) {
  const { data, error } = await db()
    .from("inventory_locations")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}

export async function getGlobalLocation() {
  const { data, error } = await db()
    .from("inventory_locations")
    .select("*")
    .eq("type", "GLOBAL")
    .eq("is_active", true)
    .limit(1)
    .single();
  if (error)
    throw new Error(
      "Emplacement global non trouvé. Veuillez exécuter la migration SQL."
    );
  return data;
}

// ============================================================
// STOCK BALANCES
// ============================================================

export async function getStockBalance(
  productId: number,
  locationId: number
): Promise<number> {
  const { data } = await db()
    .from("inventory_stock_balances")
    .select("quantity_on_hand")
    .eq("product_id", productId)
    .eq("location_id", locationId)
    .maybeSingle();
  return data?.quantity_on_hand ?? 0;
}

export async function getStockBalancesByLocation(locationId: number) {
  const { data, error } = await db()
    .from("inventory_stock_balances")
    .select("*, inventory_products(*)")
    .eq("location_id", locationId)
    .order("quantity_on_hand", { ascending: false });
  if (error) throw new Error(parseError(error));
  return data ?? [];
}

export async function getStockBalancesByProduct(productId: number) {
  const { data, error } = await db()
    .from("inventory_stock_balances")
    .select("*, inventory_locations(*)")
    .eq("product_id", productId);
  if (error) throw new Error(parseError(error));
  return data ?? [];
}

export async function getStockOverview() {
  // Agrégats par type d'emplacement
  const { data, error } = await db().from("inventory_stock_balances").select(`
      quantity_on_hand,
      inventory_products ( id, name, category, product_type ),
      inventory_locations ( id, type, name, event_id )
    `);
  if (error) throw new Error(parseError(error));
  return data ?? [];
}

/**
 * Résumé agrégé du stock (KPIs) — retourne un petit objet au lieu de toutes les lignes.
 * Beaucoup plus rapide pour le tableau de bord.
 */
export async function getStockSummary(): Promise<{
  globalQty: number;
  bufferQty: number;
  posQty: number;
  lowStockCount: number;
  outOfStockCount: number;
  activeProductCount: number;
}> {
  const [balancesResult, productsResult] = await Promise.all([
    db()
      .from("inventory_stock_balances")
      .select("quantity_on_hand, inventory_locations!inner ( type )"),
    db()
      .from("inventory_products")
      .select("id", { count: "planned", head: true })
      .eq("is_active", true),
  ]);

  if (balancesResult.error) throw new Error(parseError(balancesResult.error));

  let globalQty = 0;
  let bufferQty = 0;
  let posQty = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const b of balancesResult.data ?? []) {
    const type = (b as any).inventory_locations?.type as string | undefined;
    const qty: number = b.quantity_on_hand;
    if (type === "GLOBAL") globalQty += qty;
    else if (type === "EVENT_BUFFER") bufferQty += qty;
    else if (type === "POS") posQty += qty;
    if (qty === 0) outOfStockCount++;
    else if (qty <= 5) lowStockCount++;
  }

  return {
    globalQty,
    bufferQty,
    posQty,
    lowStockCount,
    outOfStockCount,
    activeProductCount: productsResult.count ?? 0,
  };
}

// ============================================================
// STOCK MOVEMENTS (transactional — via RPC)
// ============================================================

/**
 * Approvisionner le stock (entrée en stock global ou autre emplacement)
 */
export async function addStock(input: {
  productId: number;
  locationId: number;
  quantity: number;
  movementType:
    | "INITIAL_LOAD"
    | "PURCHASE_IN"
    | "DONATION_IN"
    | "PRODUCTION_IN";
  reason?: string;
  note?: string;
  performedBy?: number;
  referenceType?: string;
  referenceId?: string;
}) {
  const { data, error } = await db().rpc("inventory_add_stock", {
    p_product_id: input.productId,
    p_location_id: input.locationId,
    p_quantity: input.quantity,
    p_movement_type: input.movementType,
    p_reason: input.reason ?? null,
    p_note: input.note ?? null,
    p_performed_by: input.performedBy ?? null,
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
  });
  if (error) throw new Error(parseError(error));
  return { movementId: data as number };
}

export async function recordStockEntry(input: {
  productId: number;
  qty: number;
  entryType?: StockEntryMovementType;
  note?: string;
  reason?: string;
  eventId?: number;
  posLocationId?: number;
  userId?: number;
  source?: "QR_STOCK_ENTRY";
}) {
  const qty = Number(input.qty);
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error("Quantité invalide: entier positif requis");
  }

  const product = await getInventoryProductById(input.productId);
  if (!product) throw new Error("Produit introuvable");
  if (!product.stock_entry_qr_enabled) throw new Error("QR inactif");

  const globalLocation = await getGlobalLocation();
  const movementType = input.entryType ?? "PURCHASE_IN";

  const res = await addStock({
    productId: input.productId,
    locationId: globalLocation.id,
    quantity: qty,
    movementType,
    reason: input.reason ?? "Entrée stock via QR",
    note: input.note,
    performedBy: input.userId,
    referenceType: input.source ?? "QR_STOCK_ENTRY",
    referenceId:
      product.stock_entry_qr_slug ??
      (await ensureStockEntryQrSlug(input.productId)),
  });

  let resolvedEventId: number | null = input.eventId ?? null;
  let resolvedPosLocationId: number | null = input.posLocationId ?? null;

  if (resolvedPosLocationId) {
    const posLocation = await getInventoryLocationById(resolvedPosLocationId);
    if (!posLocation)
      throw new Error("Point de vente introuvable pour ce scanner.");
    if (posLocation.type !== "POS")
      throw new Error("L’emplacement sélectionné n’est pas un point de vente.");
    if (!posLocation.event_id)
      throw new Error(
        "Le point de vente sélectionné n’est lié à aucun événement."
      );
    if (resolvedEventId && resolvedEventId !== posLocation.event_id) {
      throw new Error(
        "Le point de vente ne correspond pas à l’événement configuré."
      );
    }
    resolvedEventId = posLocation.event_id;
  }

  if (resolvedEventId || resolvedPosLocationId) {
    const { error: updateMovementErr } = await db()
      .from("inventory_movements")
      .update({
        event_id: resolvedEventId,
        pos_location_id: resolvedPosLocationId,
      })
      .eq("id", res.movementId);
    if (updateMovementErr) throw new Error(parseError(updateMovementErr));
  }

  const newGlobalBalance = await getStockBalance(
    input.productId,
    globalLocation.id
  );

  return {
    movementId: res.movementId,
    globalLocationId: globalLocation.id,
    newGlobalBalance,
    eventId: resolvedEventId,
    posLocationId: resolvedPosLocationId,
  };
}

/**
 * Transfert entre emplacements (global→buffer ou buffer→POS)
 */
export async function transferStock(input: {
  productId: number;
  quantity: number;
  fromLocationId: number;
  toLocationId: number;
  eventId?: number | null;
  reason?: string;
  note?: string;
  performedBy?: number;
}) {
  const { data, error } = await db().rpc("inventory_transfer_stock", {
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_from_location: input.fromLocationId,
    p_to_location: input.toLocationId,
    p_event_id: input.eventId ?? null,
    p_reason: input.reason ?? null,
    p_note: input.note ?? null,
    p_performed_by: input.performedBy ?? null,
  });
  if (error) throw new Error(parseError(error));
  return { movementIds: data as number[] };
}

/**
 * Enregistrer une vente sur place (décrémente POS)
 */
export async function recordSale(input: {
  productId: number;
  quantity: number;
  locationId: number;
  eventId?: number | null;
  saleOrderId?: string;
  saleLineId?: string;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  performedBy?: number;
}) {
  const { data, error } = await db().rpc("inventory_record_sale", {
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_location_id: input.locationId,
    p_event_id: input.eventId ?? null,
    p_sale_order_id: input.saleOrderId ?? null,
    p_sale_line_id: input.saleLineId ?? null,
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
    p_note: input.note ?? null,
    p_performed_by: input.performedBy ?? null,
  });
  if (error) throw new Error(parseError(error));
  return { movementId: data as number };
}

/**
 * Enregistrer une vente en ligne (décrémente stock global)
 */
export async function recordOnlineSale(input: {
  productId: number;
  quantity: number;
  saleOrderId?: string;
  saleLineId?: string;
  referenceType?: string;
  referenceId?: string;
  performedBy?: number;
}) {
  const globalLoc = await getGlobalLocation();
  return recordSale({
    ...input,
    locationId: globalLoc.id,
    eventId: null,
    note: "Vente en ligne",
  });
}

/**
 * Retour POS → buffer
 */
export async function recordReturn(input: {
  productId: number;
  quantity: number;
  fromPosLocationId: number;
  toBufferLocationId: number;
  eventId?: number | null;
  reason?: string;
  note?: string;
  performedBy?: number;
}) {
  const { data, error } = await db().rpc("inventory_record_return", {
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_from_pos_location: input.fromPosLocationId,
    p_to_buffer_location: input.toBufferLocationId,
    p_event_id: input.eventId ?? null,
    p_reason: input.reason ?? null,
    p_note: input.note ?? null,
    p_performed_by: input.performedBy ?? null,
  });
  if (error) throw new Error(parseError(error));
  return { movementIds: data as number[] };
}

/**
 * Ajustement manuel (motif obligatoire)
 */
export async function adjustStock(input: {
  productId: number;
  locationId: number;
  qtyDelta: number;
  reason: string;
  note?: string;
  performedBy?: number;
}) {
  const { data, error } = await db().rpc("inventory_adjust_stock", {
    p_product_id: input.productId,
    p_location_id: input.locationId,
    p_qty_delta: input.qtyDelta,
    p_reason: input.reason,
    p_note: input.note ?? null,
    p_performed_by: input.performedBy ?? null,
  });
  if (error) throw new Error(parseError(error));
  return { movementId: data as number };
}

// ============================================================
// MOVEMENT HISTORY
// ============================================================

export async function getMovementHistory(filters?: {
  productId?: number;
  locationId?: number;
  eventId?: number;
  movementType?: MovementType;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(filters?.limit ?? 50, 500);
  const offset = filters?.offset ?? 0;

  let q = db()
    .from("inventory_movements")
    .select(
      `
      *,
      inventory_products ( id, name, category, product_type, sku ),
      from_location:inventory_locations!inventory_movements_from_location_id_fkey ( id, name, type, code ),
      to_location:inventory_locations!inventory_movements_to_location_id_fkey ( id, name, type, code ),
      pos_location:inventory_locations!inventory_movements_pos_location_id_fkey ( id, name, type, code ),
      inventory_events ( id, name )
    `,
      { count: "planned" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.productId) q = q.eq("product_id", filters.productId);
  if (filters?.locationId) {
    // mouvements impliquant cet emplacement (source ou destination)
    q = q.or(
      `from_location_id.eq.${filters.locationId},to_location_id.eq.${filters.locationId},pos_location_id.eq.${filters.locationId}`
    );
  }
  if (filters?.eventId) q = q.eq("event_id", filters.eventId);
  if (filters?.movementType) q = q.eq("movement_type", filters.movementType);
  if (filters?.dateFrom) q = q.gte("created_at", filters.dateFrom);
  if (filters?.dateTo) q = q.lte("created_at", filters.dateTo);

  const { data, error, count } = await q;
  if (error) throw new Error(parseError(error));
  return { movements: data ?? [], total: count ?? 0 };
}

// ============================================================
// EVENT REPORT — bilan par POS
// ============================================================

export async function getEventReport(eventId: number) {
  // Locations liées à l'événement
  const { data: locations, error: locErr } = await db()
    .from("inventory_locations")
    .select("*")
    .eq("event_id", eventId);
  if (locErr) throw new Error(parseError(locErr));

  const posLocations = (locations ?? []).filter((l: any) => l.type === "POS");
  const bufferLocation = (locations ?? []).find(
    (l: any) => l.type === "EVENT_BUFFER"
  );

  // Balances courantes
  const { data: balances } = await db()
    .from("inventory_stock_balances")
    .select("*, inventory_products(*), inventory_locations(*)")
    .in(
      "location_id",
      (locations ?? []).map((l: any) => l.id)
    );

  // Mouvements de l'événement pour calcul des bilan par POS
  const { data: movements } = await db()
    .from("inventory_movements")
    .select("*")
    .eq("event_id", eventId);

  const posReports = posLocations.map((pos: any) => {
    const dispatched = (movements ?? [])
      .filter(
        (m: any) =>
          m.movement_type === "TRANSFER_IN" && m.to_location_id === pos.id
      )
      .reduce((s: number, m: any) => s + m.quantity, 0);

    const sold = (movements ?? [])
      .filter(
        (m: any) => m.movement_type === "SALE" && m.pos_location_id === pos.id
      )
      .reduce((s: number, m: any) => s + m.quantity, 0);

    const returned = (movements ?? [])
      .filter(
        (m: any) =>
          m.movement_type === "RETURN_OUT" && m.from_location_id === pos.id
      )
      .reduce((s: number, m: any) => s + m.quantity, 0);

    const currentStock = (balances ?? [])
      .filter((b: any) => b.location_id === pos.id)
      .reduce((s: number, b: any) => s + b.quantity_on_hand, 0);

    return {
      location: pos,
      dispatched,
      sold,
      returned,
      theoreticalRemaining: dispatched - sold - returned,
      currentStock,
      variance: currentStock - (dispatched - sold - returned),
    };
  });

  return {
    eventId,
    bufferLocation: bufferLocation ?? null,
    posReports,
    balances: balances ?? [],
  };
}

// ============================================================
// INVENTORY COUNTS
// ============================================================

export async function createInventoryCount(input: {
  locationId: number;
  eventId?: number | null;
  countedBy?: number;
  notes?: string | null;
}) {
  // Préparer les lignes attendues depuis les soldes actuels
  const balances = await getStockBalancesByLocation(input.locationId);

  const { data: count, error } = await db()
    .from("inventory_counts")
    .insert({
      location_id: input.locationId,
      event_id: input.eventId ?? null,
      status: "in_progress",
      counted_by: input.countedBy ?? null,
      started_at: new Date().toISOString(),
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(parseError(error));

  // Créer les lignes d'inventaire
  if (balances.length > 0) {
    const lines = balances.map((b: any) => ({
      count_id: count.id,
      product_id: b.product_id,
      expected_qty: b.quantity_on_hand,
      counted_qty: null,
    }));
    const { error: linesError } = await db()
      .from("inventory_count_lines")
      .insert(lines);
    if (linesError) throw new Error(parseError(linesError));
  }

  return count;
}

export async function updateCountLine(
  countLineId: number,
  countedQty: number,
  note?: string
) {
  const { data, error } = await db()
    .from("inventory_count_lines")
    .update({ counted_qty: countedQty, note: note ?? null })
    .eq("id", countLineId)
    .select()
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}

export async function completeInventoryCount(
  countId: number,
  performedBy?: number
) {
  // Get count and lines
  const { data: count } = await db()
    .from("inventory_counts")
    .select("*, inventory_count_lines(*)")
    .eq("id", countId)
    .single();

  if (!count) throw new Error("Inventaire non trouvé");

  // Apply adjustments for lines where variance != 0
  for (const line of count.inventory_count_lines ?? []) {
    if (line.counted_qty === null) continue;
    const variance = line.counted_qty - line.expected_qty;
    if (variance !== 0) {
      await adjustStock({
        productId: line.product_id,
        locationId: count.location_id,
        qtyDelta: variance,
        reason: `Ajustement inventaire physique #${countId}`,
        note: line.note ?? undefined,
        performedBy,
      });
    }
  }

  const { data, error } = await db()
    .from("inventory_counts")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", countId)
    .select()
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}

export async function getInventoryCountWithLines(countId: number) {
  const { data, error } = await db()
    .from("inventory_counts")
    .select(
      `*, inventory_count_lines(*, inventory_products(*)), inventory_locations(*)`
    )
    .eq("id", countId)
    .single();
  if (error) throw new Error(parseError(error));
  return data;
}
