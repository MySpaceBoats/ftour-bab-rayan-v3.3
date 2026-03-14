import { describe, it, expect, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { __feedbackTestUtils } from "./feedback-router";

describe("feedback security helpers", () => {
  beforeEach(() => {
    __feedbackTestUtils._feedbackRateLimitMap.clear();
  });

  it("extracts client ip from x-forwarded-for", () => {
    const ip = __feedbackTestUtils.getClientIp({
      req: {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
        ip: "9.9.9.9",
      },
    });

    expect(ip).toBe("1.2.3.4");
  });

  it("blocks when rate limit exceeds 10 requests per hour", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 10; i++) {
      __feedbackTestUtils.enforceFeedbackRateLimit(ip);
    }

    expect(() => __feedbackTestUtils.enforceFeedbackRateLimit(ip)).toThrowError(
      TRPCError
    );
  });

  it("detects expired token", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();

    expect(__feedbackTestUtils.isTokenExpired(past)).toBe(true);
    expect(__feedbackTestUtils.isTokenExpired(future)).toBe(false);
  });
});
