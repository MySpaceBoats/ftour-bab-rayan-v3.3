import { describe, expect, it } from "vitest";
import { generateOpaqueToken, hashOpaqueToken } from "./restaurant-reservation-services";

describe("reservation payment token", () => {
  it("generates opaque token and deterministic hash", () => {
    const token = generateOpaqueToken();
    expect(token.length).toBeGreaterThan(20);
    const h1 = hashOpaqueToken(token);
    const h2 = hashOpaqueToken(token);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});
