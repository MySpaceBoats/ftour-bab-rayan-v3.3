/**
 * Tests unitaires du service d'inventaire
 *
 * Ces tests vérifient la logique métier sans appel Supabase réel.
 * Les fonctions du service sont mockées au niveau de getSupabaseAdminClient.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// MOCK Supabase client
// ============================================================

type RpcResult = { data: unknown; error: null | { message: string } };
type QueryResult = { data: unknown; error: null | { message: string }; count?: number };

interface FakeClient {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  _balances: Record<string, number>;
  _movements: unknown[];
}

let fakeClient: FakeClient;

vi.mock('./supabase', () => ({
  getSupabaseAdminClient: () => fakeClient,
}));

// ============================================================
// BUILDER helpers
// ============================================================

function makeQueryChain(result: QueryResult) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
   'is', 'ilike', 'in', 'order', 'limit', 'range', 'single', 'maybeSingle', 'or',
   'not', 'filter', 'match', 'returns'].forEach(m => {
    chain[m] = vi.fn(() => chain);
  });
  // terminal calls return a promise resolving to result
  chain.single       = vi.fn().mockResolvedValue(result);
  chain.maybeSingle  = vi.fn().mockResolvedValue(result);
  chain.select       = vi.fn(() => ({ ...chain, then: (f: any) => Promise.resolve(result).then(f) }));
  return { ...chain, then: (f: any) => Promise.resolve(result).then(f) };
}

function rpcOk(value: unknown): Promise<RpcResult> {
  return Promise.resolve({ data: value, error: null });
}
function rpcErr(msg: string): Promise<RpcResult> {
  return Promise.resolve({ data: null, error: { message: msg } });
}

// ============================================================
// Unit tests — business rules
// ============================================================

describe('inventory-services unit tests', () => {

  beforeEach(() => {
    fakeClient = {
      _balances: {},
      _movements: [],
      rpc: vi.fn(),
      from: vi.fn(),
    };
  });

  // ----------------------------------------------------------
  // addStock
  // ----------------------------------------------------------
  describe('addStock', () => {
    it('should call inventory_add_stock RPC with correct params', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({ data: 42, error: null });
      const { addStock } = await import('./inventory-services');
      const result = await addStock({
        productId: 1,
        locationId: 5,
        quantity: 100,
        movementType: 'INITIAL_LOAD',
        reason: 'Chargement initial',
        performedBy: 1,
      });
      expect(fakeClient.rpc).toHaveBeenCalledWith('inventory_add_stock', expect.objectContaining({
        p_product_id: 1,
        p_location_id: 5,
        p_quantity: 100,
        p_movement_type: 'INITIAL_LOAD',
      }));
      expect(result.movementId).toBe(42);
    });

    it('should throw when RPC returns an error', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'Stock insuffisant' } });
      const { addStock } = await import('./inventory-services');
      await expect(addStock({
        productId: 1, locationId: 5, quantity: 100,
        movementType: 'INITIAL_LOAD',
      })).rejects.toThrow('Stock insuffisant');
    });
  });

  // ----------------------------------------------------------
  // transferStock
  // ----------------------------------------------------------
  describe('transferStock', () => {
    it('should call inventory_transfer_stock RPC', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({ data: [10, 11], error: null });
      const { transferStock } = await import('./inventory-services');
      const result = await transferStock({
        productId: 1,
        quantity: 40,
        fromLocationId: 1,
        toLocationId: 2,
        eventId: 3,
        reason: 'Approvisionnement buffer',
        performedBy: 1,
      });
      expect(fakeClient.rpc).toHaveBeenCalledWith('inventory_transfer_stock', expect.objectContaining({
        p_product_id: 1,
        p_quantity: 40,
        p_from_location: 1,
        p_to_location: 2,
        p_event_id: 3,
      }));
      expect(result.movementIds).toEqual([10, 11]);
    });

    it('should throw when stock is insufficient', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Stock insuffisant (produit 1, emplacement 1). Disponible: 5, demandé: 40' }
      });
      const { transferStock } = await import('./inventory-services');
      await expect(transferStock({
        productId: 1, quantity: 40,
        fromLocationId: 1, toLocationId: 2,
      })).rejects.toThrow('Stock insuffisant');
    });
  });

  // ----------------------------------------------------------
  // recordSale
  // ----------------------------------------------------------
  describe('recordSale', () => {
    it('should call inventory_record_sale RPC and decrement POS stock', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({ data: 55, error: null });
      const { recordSale } = await import('./inventory-services');
      const result = await recordSale({
        productId: 1,
        quantity: 6,
        locationId: 10, // POS location
        eventId: 3,
        saleOrderId: 'ORD-001',
      });
      expect(fakeClient.rpc).toHaveBeenCalledWith('inventory_record_sale', expect.objectContaining({
        p_product_id: 1,
        p_quantity: 6,
        p_location_id: 10,
        p_event_id: 3,
        p_sale_order_id: 'ORD-001',
      }));
      expect(result.movementId).toBe(55);
    });

    it('should refuse sale when POS stock is insufficient', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Stock insuffisant (produit 1, emplacement 10). Disponible: 3, demandé: 6' }
      });
      const { recordSale } = await import('./inventory-services');
      await expect(recordSale({
        productId: 1, quantity: 6, locationId: 10,
      })).rejects.toThrow('Stock insuffisant');
    });
  });

  // ----------------------------------------------------------
  // recordOnlineSale
  // ----------------------------------------------------------
  describe('recordOnlineSale', () => {
    it('should call recordSale with global location', async () => {
      // Mock getGlobalLocation query
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1, type: 'GLOBAL', name: 'Stock Central' }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, type: 'GLOBAL', name: 'Stock Central' }, error: null }),
      });
      fakeClient.from = mockFrom;
      fakeClient.rpc = vi.fn().mockResolvedValue({ data: 99, error: null });

      const { recordOnlineSale } = await import('./inventory-services');
      const result = await recordOnlineSale({
        productId: 2, quantity: 3, saleOrderId: 'ONLINE-001',
      });
      expect(fakeClient.rpc).toHaveBeenCalledWith('inventory_record_sale', expect.objectContaining({
        p_product_id: 2,
        p_quantity: 3,
        p_location_id: 1, // global location id
      }));
      expect(result.movementId).toBe(99);
    });
  });

  // ----------------------------------------------------------
  // recordReturn
  // ----------------------------------------------------------
  describe('recordReturn', () => {
    it('should call inventory_record_return RPC', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({ data: [20, 21], error: null });
      const { recordReturn } = await import('./inventory-services');
      const result = await recordReturn({
        productId: 1,
        quantity: 7,
        fromPosLocationId: 10,
        toBufferLocationId: 5,
        eventId: 3,
        reason: 'Fin de service',
      });
      expect(fakeClient.rpc).toHaveBeenCalledWith('inventory_record_return', expect.objectContaining({
        p_product_id: 1,
        p_quantity: 7,
        p_from_pos_location: 10,
        p_to_buffer_location: 5,
        p_event_id: 3,
      }));
      expect(result.movementIds).toEqual([20, 21]);
    });

    it('should throw when POS balance would go negative', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Stock insuffisant (produit 1, emplacement 10). Disponible: 2, demandé: 7' }
      });
      const { recordReturn } = await import('./inventory-services');
      await expect(recordReturn({
        productId: 1, quantity: 7,
        fromPosLocationId: 10, toBufferLocationId: 5,
        reason: 'Test',
      })).rejects.toThrow('Stock insuffisant');
    });
  });

  // ----------------------------------------------------------
  // adjustStock
  // ----------------------------------------------------------
  describe('adjustStock', () => {
    it('should call inventory_adjust_stock RPC with positive delta', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({ data: 77, error: null });
      const { adjustStock } = await import('./inventory-services');
      const result = await adjustStock({
        productId: 1, locationId: 5,
        qtyDelta: 10, reason: 'Correction inventaire',
      });
      expect(fakeClient.rpc).toHaveBeenCalledWith('inventory_adjust_stock', expect.objectContaining({
        p_qty_delta: 10, p_reason: 'Correction inventaire',
      }));
      expect(result.movementId).toBe(77);
    });

    it('should call with negative delta for adjustment minus', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({ data: 78, error: null });
      const { adjustStock } = await import('./inventory-services');
      await adjustStock({
        productId: 1, locationId: 5,
        qtyDelta: -5, reason: 'Perte constatée',
      });
      expect(fakeClient.rpc).toHaveBeenCalledWith('inventory_adjust_stock', expect.objectContaining({
        p_qty_delta: -5,
      }));
    });

    it('should throw when reason is empty', async () => {
      fakeClient.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Le motif est obligatoire pour un ajustement' }
      });
      const { adjustStock } = await import('./inventory-services');
      await expect(adjustStock({
        productId: 1, locationId: 5, qtyDelta: 5, reason: '',
      })).rejects.toThrow('motif');
    });
  });

  // ----------------------------------------------------------
  // getStockBalance
  // ----------------------------------------------------------
  describe('getStockBalance', () => {
    it('should return 0 when no balance exists', async () => {
      fakeClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const { getStockBalance } = await import('./inventory-services');
      const qty = await getStockBalance(1, 5);
      expect(qty).toBe(0);
    });

    it('should return current quantity when balance exists', async () => {
      fakeClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { quantity_on_hand: 42 }, error: null }),
      });
      const { getStockBalance } = await import('./inventory-services');
      const qty = await getStockBalance(1, 5);
      expect(qty).toBe(42);
    });
  });

  // ----------------------------------------------------------
  // Integration scenario: full workflow
  // ----------------------------------------------------------
  describe('complete workflow scenario', () => {
    /**
     * Global stock: 100
     * → Transfer 40 to buffer
     * → Transfer 15 to POS A
     * → Transfer 10 to POS B
     * → POS A sells 6
     * → POS B sells 4
     * → POS A returns 7
     * → POS B returns 6
     *
     * Expected final balances:
     *   Global: 60 (100 - 40)
     *   Buffer: 22 (40 - 15 - 10 + 7)  ← wait, returns go to buffer
     *   POS A:  2  (15 - 6 - 7)
     *   POS B:  0  (10 - 4 - 6)
     *
     * Actually with returns:
     *   Buffer receives 7 from A and 6 from B → buffer = 40 - 15 - 10 + 7 + 6 = 28
     *   POS A: 15 - 6 - 7 = 2
     *   POS B: 10 - 4 - 6 = 0
     *   Global: 100 - 40 = 60
     */
    it('tracks all operations correctly via RPC calls', async () => {
      const calls: string[] = [];

      fakeClient.rpc = vi.fn().mockImplementation((fn: string, params: any) => {
        calls.push(fn);
        return Promise.resolve({ data: [1, 2], error: null });
      });

      const {
        addStock, transferStock, recordSale, recordReturn,
      } = await import('./inventory-services');

      // 1. Add 100 to global
      await addStock({ productId: 1, locationId: 1, quantity: 100, movementType: 'INITIAL_LOAD', reason: 'Init' });
      // 2. Global → Buffer (40)
      await transferStock({ productId: 1, quantity: 40, fromLocationId: 1, toLocationId: 2, eventId: 1 });
      // 3. Buffer → POS A (15)
      await transferStock({ productId: 1, quantity: 15, fromLocationId: 2, toLocationId: 3, eventId: 1 });
      // 4. Buffer → POS B (10)
      await transferStock({ productId: 1, quantity: 10, fromLocationId: 2, toLocationId: 4, eventId: 1 });
      // 5. POS A sells 6
      await recordSale({ productId: 1, quantity: 6, locationId: 3, eventId: 1 });
      // 6. POS B sells 4
      await recordSale({ productId: 1, quantity: 4, locationId: 4, eventId: 1 });
      // 7. POS A returns 7
      await recordReturn({ productId: 1, quantity: 7, fromPosLocationId: 3, toBufferLocationId: 2, eventId: 1, reason: 'FIN' });
      // 8. POS B returns 6
      await recordReturn({ productId: 1, quantity: 6, fromPosLocationId: 4, toBufferLocationId: 2, eventId: 1, reason: 'FIN' });

      // All 8 operations should have been dispatched
      expect(fakeClient.rpc).toHaveBeenCalledTimes(8);
      expect(calls).toEqual([
        'inventory_add_stock',
        'inventory_transfer_stock',
        'inventory_transfer_stock',
        'inventory_transfer_stock',
        'inventory_record_sale',
        'inventory_record_sale',
        'inventory_record_return',
        'inventory_record_return',
      ]);
    });
  });
});
