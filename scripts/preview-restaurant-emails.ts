import {
  generateRestaurantReservationDepositRequiredEmail,
  generateRestaurantReservationConfirmedEmail,
} from "../server/email.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.cwd(), "tmp/email-previews");
mkdirSync(outDir, { recursive: true });

const depositEmail = generateRestaurantReservationDepositRequiredEmail({
  firstName: "Amina",
  reference: "RES-G-ABC123",
  reservationDateLong: "mardi 25 février 2026",
  reservationTime: "20:30",
  partySize: 42,
  depositPercent: 50,
  depositAmount: 2100,
  estimatedTotal: 4200,
});

const confirmedEmail = generateRestaurantReservationConfirmedEmail({
  firstName: "Amina",
  reference: "RES-G-ABC123",
  reservationDateLong: "mardi 25 février 2026",
  reservationTime: "20:30",
  partySize: 42,
  partySizeConfirmed: 40,
});

writeFileSync(resolve(outDir, "reservation-deposit-required.html"), depositEmail.html);
writeFileSync(resolve(outDir, "reservation-deposit-required.txt"), depositEmail.text);
writeFileSync(resolve(outDir, "reservation-confirmed.html"), confirmedEmail.html);
writeFileSync(resolve(outDir, "reservation-confirmed.txt"), confirmedEmail.text);

console.log("Email previews generated in:", outDir);
