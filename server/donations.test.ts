import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  createDonation: vi.fn().mockResolvedValue(1),
  generateDonationReference: vi.fn().mockReturnValue("DON-2025-0001"),
  getAllDonations: vi.fn().mockResolvedValue([
    { id: 1, donorName: "Test Donor", donorEmail: "donor@test.com", amount: "500", paymentMethod: "transfer", status: "promised" },
    { id: 2, donorName: "Another Donor", donorEmail: "another@test.com", amount: "1000", paymentMethod: "on_site", status: "received" },
  ]),
  getDonationStats: vi.fn().mockResolvedValue({
    total: 2,
    received: 1,
    totalAmount: 1500,
    receivedAmount: 1000,
  }),
  updateDonationStatus: vi.fn().mockResolvedValue({ success: true }),
  getActiveGoodies: vi.fn().mockResolvedValue([
    { id: 1, name: "T-shirt", price: "100", isActive: true },
    { id: 2, name: "Mug", price: "50", isActive: true },
  ]),
  getVariantsByGoodie: vi.fn().mockResolvedValue([]),
  createOrder: vi.fn().mockResolvedValue(1),
  generateOrderReference: vi.fn().mockReturnValue("FBR-2025-0001"),
  getGoodieById: vi.fn().mockResolvedValue({ id: 1, name: "T-shirt", price: "100" }),
  getVariantById: vi.fn().mockResolvedValue(null),
  createOrderItem: vi.fn().mockResolvedValue(1),
  getOrderStats: vi.fn().mockResolvedValue({
    total: 10,
    reserved: 5,
    delivered: 3,
    paid: 2,
    totalAmount: 1500,
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(role: string = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: role as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Donations Router", () => {
  describe("donations.create", () => {
    it("allows public users to create donation promises", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.donations.create({
        donorName: "Test Donor",
        donorEmail: "donor@test.com",
        donorPhone: "0600000000",
        amount: "500",
        paymentMethod: "transfer",
        message: "Test donation",
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.donationReference).toBe("DON-2025-0001");
    });
  });

  describe("donations.listAll", () => {
    it("requires admin_dons role", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.donations.listAll()).rejects.toThrow();
    });

    it("returns all donations for admin_dons", async () => {
      const ctx = createAuthContext("admin_dons");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.donations.listAll();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });

  describe("donations.getStats", () => {
    it("returns donation statistics", async () => {
      const ctx = createAuthContext("admin_dons");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.donations.getStats();

      expect(result).toBeDefined();
      expect(result.total).toBe(2);
      expect(result.received).toBe(1);
      expect(result.totalAmount).toBe(1500);
      expect(result.receivedAmount).toBe(1000);
    });
  });

  describe("donations.updateStatus", () => {
    it("allows admin to update donation status", async () => {
      const ctx = createAuthContext("admin_dons");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.donations.updateStatus({
        id: 1,
        status: "received",
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
});

describe("Goodies Router", () => {
  describe("goodies.list", () => {
    it("returns active goodies for public users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.goodies.list();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });
});

describe("Orders Router", () => {
  describe("orders.create", () => {
    it("allows public users to create orders", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.orders.create({
        customerName: "Test Customer",
        customerEmail: "customer@test.com",
        customerPhone: "0600000000",
        items: [{ goodieId: 1, quantity: 2 }],
      });

      expect(result).toBeDefined();
      expect(result.orderId).toBe(1);
      expect(result.orderReference).toBe("FBR-2025-0001");
    });
  });

  describe("orders.getStats", () => {
    it("returns order statistics for admin", async () => {
      const ctx = createAuthContext("admin_boutique");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.orders.getStats();

      expect(result).toBeDefined();
      expect(result.total).toBe(10);
      expect(result.reserved).toBe(5);
      expect(result.delivered).toBe(3);
      expect(result.paid).toBe(2);
    });
  });
});
