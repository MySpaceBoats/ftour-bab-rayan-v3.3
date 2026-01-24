import { describe, expect, it } from "vitest";
import { verifyResendApiKey, generateVolunteerConfirmationEmail, generateOrderConfirmationEmail, generateDonationConfirmationEmail } from "./email";

describe("Resend API Key Validation", () => {
  it("should have a valid Resend API key configured", async () => {
    const isValid = await verifyResendApiKey();
    expect(isValid).toBe(true);
  });
});

describe("Email Templates", () => {
  it("generates volunteer confirmation email with QR code", () => {
    const data = {
      firstName: "Ahmed",
      lastName: "Benali",
      email: "ahmed@example.com",
      dayNumber: 15,
      dayDate: "15 Mars 2026",
      location: "Association Bab Rayan, Casablanca",
      startTime: "18h00",
      qrToken: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
      baseUrl: "https://ftourbabrayan.ma",
    };

    const email = generateVolunteerConfirmationEmail(data);

    expect(email.subject).toContain("Confirmation inscription");
    expect(email.subject).toContain("Jour 15");
    expect(email.html).toContain("Ahmed Benali");
    expect(email.html).toContain("15 du Ramadan");
    expect(email.html).toContain("15 Mars 2026");
    expect(email.html).toContain("QR Code");
    expect(email.html).toContain("api.qrserver.com");
    expect(email.html).toContain(data.qrToken);
  });

  it("generates order confirmation email with items", () => {
    const data = {
      firstName: "Fatima",
      lastName: "Alaoui",
      email: "fatima@example.com",
      phone: "+212 6 12 34 56 78",
      orderId: "FBR-2026-001",
      items: [
        { name: "T-shirt Ftour", variant: "M - Vert", quantity: 2, price: 150 },
        { name: "Mug solidaire", quantity: 1, price: 50 },
      ],
      totalAmount: 350,
      baseUrl: "https://ftourbabrayan.ma",
    };

    const email = generateOrderConfirmationEmail(data);

    expect(email.subject).toContain("Commande");
    expect(email.subject).toContain("FBR-2026-001");
    expect(email.html).toContain("Fatima Alaoui");
    expect(email.html).toContain("FBR-2026-001");
    expect(email.html).toContain("T-shirt Ftour");
    expect(email.html).toContain("M - Vert");
    expect(email.html).toContain("350 MAD");
    expect(email.html).toContain("paiement se fait sur place");
  });

  it("generates donation confirmation email with bank details for transfer", () => {
    const data = {
      firstName: "Mohammed",
      lastName: "Tazi",
      email: "mohammed@example.com",
      amount: 500,
      paymentMethod: "transfer" as const,
      donationId: "DON-2026-042",
      baseUrl: "https://ftourbabrayan.ma",
    };

    const email = generateDonationConfirmationEmail(data);

    expect(email.subject).toContain("Merci pour votre don");
    expect(email.html).toContain("Mohammed Tazi");
    expect(email.html).toContain("500 MAD");
    expect(email.html).toContain("DON-2026-042");
    expect(email.html).toContain("Attijariwafa Bank");
    expect(email.html).toContain("RIB");
    expect(email.html).toContain("IBAN");
  });

  it("generates donation confirmation email for on-site payment", () => {
    const data = {
      firstName: "Sara",
      lastName: "Idrissi",
      email: "sara@example.com",
      amount: 200,
      paymentMethod: "on_site" as const,
      donationId: "DON-2026-043",
      baseUrl: "https://ftourbabrayan.ma",
    };

    const email = generateDonationConfirmationEmail(data);

    expect(email.subject).toContain("Merci pour votre don");
    expect(email.html).toContain("Sara Idrissi");
    expect(email.html).toContain("200 MAD");
    expect(email.html).toContain("Don sur place");
    expect(email.html).not.toContain("RIB");
  });
});
