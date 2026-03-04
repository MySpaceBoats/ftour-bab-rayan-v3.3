import { describe, expect, it } from "vitest";
import {
  getCurrentReservationDate,
  isReservationValidForCurrentDate,
} from "./reservation-services";

describe("reservation check-in date validation", () => {
  it("accepts reservation for the current Ramadan timezone date", () => {
    const today = getCurrentReservationDate("Africa/Casablanca");

    expect(isReservationValidForCurrentDate(today, today)).toBe(true);
  });

  it("rejects reservation from another day", () => {
    const currentDate = "2026-03-10";

    expect(isReservationValidForCurrentDate("2026-03-09", currentDate)).toBe(false);
    expect(isReservationValidForCurrentDate("2026-03-11", currentDate)).toBe(false);
  });

  it("computes date in a configurable timezone", () => {
    const date = getCurrentReservationDate("UTC");

    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
