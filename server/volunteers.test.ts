import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getRamadanDays: vi.fn().mockResolvedValue([
    { id: 1, date: new Date("2025-03-01"), dayNumber: 1, maxCapacity: 50, currentCount: 10, isClosed: false },
    { id: 2, date: new Date("2025-03-02"), dayNumber: 2, maxCapacity: 50, currentCount: 50, isClosed: false },
    { id: 3, date: new Date("2025-03-03"), dayNumber: 3, maxCapacity: 50, currentCount: 25, isClosed: true },
  ]),
  getRamadanDayById: vi.fn().mockResolvedValue(
    { id: 1, date: new Date("2025-03-01"), dayNumber: 1, maxCapacity: 50, currentCount: 10, isClosed: false }
  ),
  getVolunteersByDay: vi.fn().mockResolvedValue([
    { id: 1, firstName: "Test", lastName: "User", email: "test@test.com", phone: "0600000000", status: "registered" },
  ]),
  getAllVolunteers: vi.fn().mockResolvedValue([
    { id: 1, firstName: "Test", lastName: "User", email: "test@test.com", phone: "0600000000", status: "registered", dayId: 1 },
  ]),
  getVolunteerStats: vi.fn().mockResolvedValue({
    total: 100,
    present: 75,
    absent: 25,
  }),
  createVolunteer: vi.fn().mockResolvedValue({ id: 1, qrCode: "QR123456" }),
  getVolunteerByQrCode: vi.fn().mockResolvedValue({
    id: 1,
    firstName: "Test",
    lastName: "User",
    email: "test@test.com",
    dayId: 1,
    status: "registered",
  }),
  markVolunteerPresent: vi.fn().mockResolvedValue({ success: true }),
  createScanHistory: vi.fn().mockResolvedValue({ id: 1 }),
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

describe("Volunteers Router", () => {
  describe("days.list", () => {
    it("returns list of ramadan days for public users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.days.list();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty("dayNumber");
      expect(result[0]).toHaveProperty("maxCapacity");
    });

    it("includes availability information", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.days.list();

      // Day 1: 10/50, not closed - available
      expect(result[0].currentCount).toBeLessThan(result[0].maxCapacity);
      expect(result[0].isClosed).toBe(false);

      // Day 2: 50/50, not closed - full
      expect(result[1].currentCount).toBe(result[1].maxCapacity);

      // Day 3: closed
      expect(result[2].isClosed).toBe(true);
    });
  });

  describe("volunteers.listByDay", () => {
    it("requires admin authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.volunteers.listByDay({})).rejects.toThrow();
    });

    it("returns volunteers for admin_ops users", async () => {
      const ctx = createAuthContext("admin_ops");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.volunteers.listByDay({ dayId: 1 });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("volunteers.getStats", () => {
    it("returns statistics for admin users", async () => {
      const ctx = createAuthContext("admin_ops");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.volunteers.getStats();

      expect(result).toBeDefined();
      expect(result.total).toBe(100);
      expect(result.present).toBe(75);
      expect(result.absent).toBe(25);
    });
  });
});

describe("Scanner functionality", () => {
  describe("volunteers.scan", () => {
    it("requires scanner or admin role", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.volunteers.getByQrCode({ qrCode: "QR123456" })).rejects.toThrow();
    });

    it("returns volunteer info for scanner users", async () => {
      const ctx = createAuthContext("scanner");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.volunteers.getByQrCode({ qrCode: "QR123456" });

      expect(result).toBeDefined();
      expect(result.volunteer).toBeDefined();
      expect(result.volunteer.firstName).toBe("Test");
      expect(result.volunteer.lastName).toBe("User");
    });
  });

  describe("volunteers.checkIn", () => {
    it("requires scanner role", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.volunteers.checkIn({ qrCode: "QR123456" })).rejects.toThrow();
    });
  });
});
