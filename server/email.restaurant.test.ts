import { describe, expect, it } from "vitest";
import {
  generateRestaurantReservationDepositRequiredEmail,
  generateRestaurantReservationConfirmedEmail,
  formatCasablancaDateTimeLong,
} from "./email";

describe("Restaurant reservation transactional emails", () => {
  it("builds deposit required email with html + text", () => {
    const email = generateRestaurantReservationDepositRequiredEmail({
      firstName: "Amina",
      reference: "RES-G-123456",
      reservationDateLong: "mardi 25 février 2026",
      reservationTime: "20:30",
      partySize: 30,
      depositPercent: 50,
      depositAmount: 1500,
      estimatedTotal: 3000,
      depositDeadlineFormatted: "jeudi 27 février 2026 à 18:00",
      ribUrl: "https://example.com/rib.pdf",
    });

    expect(email.subject).toContain("Demande de réservation enregistrée");
    expect(email.subject).toContain("RES-G-123456");
    expect(email.html).toContain("#556B2F");
    expect(email.html).toContain("Télécharger le RIB");
    expect(email.html).toContain("display:none"); // preheader
    expect(email.text).toContain("Acompte requis");
    expect(email.text).toContain("Vous disposez de 48 heures");
    expect(email.html).toContain("votre réservation sera automatiquement annulée");
    expect(email.text).toContain("Date limite de paiement");
    expect(email.text).toContain("https://example.com/rib.pdf");
  });

  it("hides optional time row in confirmed email when missing", () => {
    const email = generateRestaurantReservationConfirmedEmail({
      firstName: "Amina",
      reference: "RES-G-999999",
      reservationDateLong: "mardi 25 février 2026",
      partySize: 30,
    });

    expect(email.subject).toContain("Réservation confirmée");
    expect(email.html).not.toContain("<strong>Heure");
    expect(email.text).not.toContain("Heure:");
    expect(email.html).toContain("Politique d’annulation");
  });

  it("formats casablanca date in french locale", () => {
    const formatted = formatCasablancaDateTimeLong("2026-02-25T18:00:00.000Z");
    expect(formatted.toLowerCase()).toContain("2026");
  });
});
