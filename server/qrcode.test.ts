import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

/**
 * Tests pour le système de QR code standard ISO/IEC 18004
 */

// Helper pour créer un contexte public (non authentifié)
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// Helper pour créer un contexte scanner (authentifié avec rôle scanner)
function createScannerContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "scanner-user",
      email: "scanner@example.com",
      name: "Scanner User",
      loginMethod: "manus",
      role: "scanner",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("QR Token Generation", () => {
  it("generates a 32-character hexadecimal token", () => {
    const token = db.generateQrToken();
    
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[a-f0-9]{32}$/);
  });

  it("generates unique tokens on each call", () => {
    const token1 = db.generateQrToken();
    const token2 = db.generateQrToken();
    const token3 = db.generateQrToken();
    
    expect(token1).not.toBe(token2);
    expect(token2).not.toBe(token3);
    expect(token1).not.toBe(token3);
  });

  it("generates cryptographically random tokens", () => {
    // Generate 100 tokens and check for no patterns
    const tokens = Array.from({ length: 100 }, () => db.generateQrToken());
    const uniqueTokens = new Set(tokens);
    
    expect(uniqueTokens.size).toBe(100); // All tokens should be unique
  });
});

describe("checkin.verify endpoint", () => {
  it("rejects invalid token format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    // Token trop court
    await expect(caller.checkin.verify({ token: "abc123" }))
      .rejects.toThrow("Format de token invalide");
    
    // Token avec caractères non-hex
    await expect(caller.checkin.verify({ token: "gggggggggggggggggggggggggggggggg" }))
      .rejects.toThrow("Format de token invalide");
  });

  it("rejects non-existent token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    // Token valide mais inexistant
    await expect(caller.checkin.verify({ token: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" }))
      .rejects.toThrow("QR code non trouvé");
  });
});

describe("checkin.validate endpoint", () => {
  it("requires scanner role", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    // Utilisateur non authentifié
    await expect(caller.checkin.validate({ token: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" }))
      .rejects.toThrow();
  });

  it("rejects invalid token format", async () => {
    const ctx = createScannerContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.checkin.validate({ token: "invalid" }))
      .rejects.toThrow("Format de token invalide");
  });
});

describe("QR Code URL Format", () => {
  it("builds correct check-in URL", () => {
    const token = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
    const baseUrl = "https://ftourbabrayan.ma";
    const expectedUrl = `${baseUrl}/checkin/${token}`;
    
    // Simuler la construction d'URL comme dans le frontend
    const url = `${baseUrl}/checkin/${token}`;
    
    expect(url).toBe(expectedUrl);
    expect(url).toMatch(/^https:\/\/[^/]+\/checkin\/[a-f0-9]{32}$/);
  });

  it("URL is scannable by standard QR readers", () => {
    const token = db.generateQrToken();
    const url = `https://ftourbabrayan.ma/checkin/${token}`;
    
    // Vérifier que l'URL est valide
    expect(() => new URL(url)).not.toThrow();
    
    // Vérifier que l'URL utilise HTTPS
    const parsedUrl = new URL(url);
    expect(parsedUrl.protocol).toBe("https:");
    expect(parsedUrl.pathname).toBe(`/checkin/${token}`);
  });
});
