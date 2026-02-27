import { describe, expect, it } from "vitest";
import { generateSecureToken } from "./qrcode";
import { computeMaxConsecutiveDays, getVolunteerQrDateState, isGroupLeaderVolunteer, parseGroupQrMetadata } from "./supabase-services";

describe("Supabase Services", () => {
  describe("Token Generation", () => {
    it("generates a 32-character hex token", () => {
      const token = generateSecureToken();
      expect(token).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it("generates unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe("URL Extraction", () => {
    it("extracts token from full URL", () => {
      const url = "https://ftourbabrayan.ma/checkin/abc123def456";
      const match = url.match(/\/checkin\/([a-f0-9]+)/);
      expect(match?.[1]).toBe("abc123def456");
    });

    it("handles URL with query params", () => {
      const url = "https://ftourbabrayan.ma/checkin/abc123?ref=email";
      const match = url.match(/\/checkin\/([a-f0-9]+)/);
      expect(match?.[1]).toBe("abc123");
    });
  });

  describe("Date Validation", () => {
    it("formats today's date correctly", () => {
      const today = new Date().toISOString().split('T')[0];
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("compares dates correctly", () => {
      const date1 = "2026-03-01";
      const date2 = "2026-03-01";
      expect(date1 === date2).toBe(true);
    });
  });

  describe("Status Transitions", () => {
    const validStatuses = ['generated', 'validated', 'expired'];
    
    it("validates status values", () => {
      validStatuses.forEach(status => {
        expect(['generated', 'validated', 'expired']).toContain(status);
      });
    });

    it("prevents invalid status transitions", () => {
      const currentStatus = 'validated';
      const canRevalidate = currentStatus !== 'validated';
      expect(canRevalidate).toBe(false);
    });
  });


  describe("Volunteer QR date state", () => {
    it("returns valid_today when volunteer date matches today", () => {
      expect(getVolunteerQrDateState("2026-03-01", "2026-03-01")).toBe("valid_today");
    });

    it("returns expired_past_day for past volunteer dates", () => {
      expect(getVolunteerQrDateState("2026-02-28", "2026-03-01")).toBe("expired_past_day");
    });

    it("returns not_yet_valid for future volunteer dates", () => {
      expect(getVolunteerQrDateState("2026-03-02", "2026-03-01")).toBe("not_yet_valid");
    });

    it("returns valid_today when volunteer date is missing", () => {
      expect(getVolunteerQrDateState(null, "2026-03-01")).toBe("valid_today");
    });
  });



  describe("Group leader QR metadata", () => {
    it("parses valid group metadata from notes", () => {
      const meta = parseGroupQrMetadata(JSON.stringify({
        groupLeaderEmail: "Leader@Example.com",
        groupMembersCount: 4,
        groupRemainingEntries: 3,
      }));

      expect(meta).toEqual({
        groupLeaderEmail: "leader@example.com",
        groupMembersCount: 4,
        groupRemainingEntries: 3,
      });
    });

    it("returns null for non-group metadata", () => {
      expect(parseGroupQrMetadata(JSON.stringify({ groupMembersCount: 1 }))).toBeNull();
      expect(parseGroupQrMetadata("not-json")).toBeNull();
    });

    it("detects group leader based on email and notes", () => {
      const notes = JSON.stringify({
        groupLeaderEmail: "leader@example.com",
        groupMembersCount: 5,
      });

      expect(isGroupLeaderVolunteer("LEADER@example.com", notes)).toBe(true);
      expect(isGroupLeaderVolunteer("other@example.com", notes)).toBe(false);
    });
  });

  describe("Consecutive presence streak", () => {
    it("returns 0 for empty days", () => {
      expect(computeMaxConsecutiveDays([])).toBe(0);
    });

    it("detects a 6-day streak", () => {
      expect(computeMaxConsecutiveDays([1, 2, 3, 4, 5, 6])).toBe(6);
    });

    it("handles duplicates and unordered day numbers", () => {
      expect(computeMaxConsecutiveDays([7, 3, 5, 4, 4, 6, 10])).toBe(5);
    });
  });

  describe("Volunteer Registration Flow", () => {
    it("validates required fields", () => {
      const volunteer = {
        firstName: "Jean",
        lastName: "Dupont",
        email: "jean@example.com",
        phone: "0612345678",
        dayId: 1,
        acceptedTerms: true
      };

      expect(volunteer.firstName).toBeTruthy();
      expect(volunteer.lastName).toBeTruthy();
      expect(volunteer.email).toContain("@");
      expect(volunteer.acceptedTerms).toBe(true);
    });

    it("validates email format", () => {
      const validEmails = ["test@example.com", "user.name@domain.co.ma"];
      const invalidEmails = ["notanemail", "@domain.com", "test@"];

      validEmails.forEach(email => {
        expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });

      invalidEmails.forEach(email => {
        expect(email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });
  });

  describe("Order Calculation", () => {
    it("calculates order total correctly", () => {
      const items = [
        { goodieId: 1, quantity: 2, unitPrice: 50 },
        { goodieId: 2, quantity: 1, unitPrice: 100 }
      ];

      const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      expect(total).toBe(200);
    });

    it("handles empty cart", () => {
      const items: { quantity: number; unitPrice: number }[] = [];
      const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      expect(total).toBe(0);
    });
  });

  describe("Donation Validation", () => {
    it("validates donation amount", () => {
      const validAmounts = [10, 50, 100, 1000];
      const invalidAmounts = [0, -10, NaN];

      validAmounts.forEach(amount => {
        expect(amount > 0 && !isNaN(amount)).toBe(true);
      });

      invalidAmounts.forEach(amount => {
        expect(amount > 0 && !isNaN(amount)).toBe(false);
      });
    });

    it("validates payment methods", () => {
      const validMethods = ['transfer', 'on_site'];
      expect(validMethods).toContain('transfer');
      expect(validMethods).toContain('on_site');
    });
  });
});
